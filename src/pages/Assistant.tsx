import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Send,
  Sparkles,
  RefreshCcw,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  FileText,
  FileType2,
  Mic,
  Square,
  X,
} from 'lucide-react'
import { Alert, Badge, Button, Card, DataRow, Modal, Progress } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { api, type ChatTurn } from '../api/endpoints'
import type { MatchResult } from '../data/types'
import { downloadPdf, downloadDocx, deriveTitle } from '../lib/exportDoc'
import { cn } from '../lib/cn'
import type { ChatMessage } from '../data/types'

// Offer downloads on substantial answers (essays, letters, interview guides),
// not on short chatty replies.
const isDownloadable = (text: string) => text.trim().length > 240

const INTERVIEW_QUESTIONS = 6

/**
 * Message ids must be unique.
 *
 * These were derived from Date.now() alone, and starting an interview creates
 * the user turn and the bot placeholder in the same millisecond. The ids
 * collided, so every streamed chunk was appended to the student's own message
 * instead of the panel's reply.
 */
let messageSeq = 0
const nextId = () => `m-${Date.now()}-${++messageSeq}`

const greetingMessage = (name: string): ChatMessage => ({
  id: 'm-1',
  role: 'bot',
  text: `Hi ${name}. I know your profile, your matches and where each application stands, so ask me anything specific and I can actually answer it.\n\nI can compare two awards, tell you what is blocking a match, draft a personal statement in your voice, or sit you down for a real mock interview.`,
  quickReplies: [
    'Which scholarships should I prioritise?',
    'Write my personal statement',
    'Plan my upcoming deadlines',
  ],
})

const tips = [
  { title: 'Interview prep', desc: 'What should I expect from a scholarship panel?' },
  { title: 'Essay drafts', desc: 'Draft a personal statement outline from my profile' },
  { title: 'Deadline planning', desc: 'Give me a week by week plan for my open deadlines' },
  { title: 'Compare awards', desc: 'Compare my top two scholarship matches' },
]

/* ------------------------------------------------------------------ *
 * Interview parsing, the protocol asks the model for stable markers,
 * so the UI can show progress and a score without a second round trip.
 * ------------------------------------------------------------------ */

const SCORE_RE = /\*\*Score:\s*(\d{1,2})\s*\/\s*10\*\*/i
const QUESTION_RE = /\*\*Question\s+(\d)\s+of\s+\d\*\*/i
const DEBRIEF_RE = /\*\*Debrief\*\*/i

function readScore(text: string): number | null {
  const m = text.match(SCORE_RE)
  return m ? Math.min(10, Number(m[1])) : null
}

function readQuestionNumber(text: string): number | null {
  const m = text.match(QUESTION_RE)
  return m ? Number(m[1]) : null
}

/** Strip the markers the header already renders, so they don't appear twice. */
function stripMarkers(text: string) {
  return text.replace(SCORE_RE, '').replace(/^\s*\n/, '')
}

// Render a single line with inline **bold** without pulling in a markdown lib.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <strong key={i} className="font-bold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

type Block =
  | { kind: 'para'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'space' }

/**
 * Group raw model output into blocks.
 *
 * Models often hard-wrap prose at ~80 columns. Treating each source line as its
 * own paragraph put a gap after every wrapped line, so consecutive prose lines
 * are joined back into one paragraph and only a blank line starts a new one.
 */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []

  const flush = () => {
    if (para.length) {
      blocks.push({ kind: 'para', text: para.join(' ') })
      para = []
    }
  }

  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      flush()
      // Collapse runs of blank lines into a single gap.
      if (blocks.length && blocks[blocks.length - 1].kind !== 'space') {
        blocks.push({ kind: 'space' })
      }
      continue
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      flush()
      blocks.push({ kind: 'heading', text: heading[1] })
      continue
    }
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    if (bullet) {
      flush()
      blocks.push({ kind: 'bullet', text: bullet[1] })
      continue
    }
    para.push(line.trim())
  }
  flush()

  // A trailing gap adds nothing but whitespace under the message.
  while (blocks.length && blocks[blocks.length - 1].kind === 'space') blocks.pop()
  return blocks
}

// Lightweight formatter for LLM output: headings, bullets, blank-line spacing.
function MessageBody({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {toBlocks(text).map((b, i) => {
        if (b.kind === 'space') return <div key={i} className="h-2.5" />
        if (b.kind === 'heading')
          return (
            <p key={i} className="font-display font-bold tracking-tight text-ink">
              {renderInline(b.text)}
            </p>
          )
        if (b.kind === 'bullet')
          return (
            <div key={i} className="flex gap-2.5">
              <span className="mt-[7px] h-1 w-1 shrink-0 rotate-45 bg-current opacity-45" aria-hidden />
              <span className="min-w-0 flex-1">{renderInline(b.text)}</span>
            </div>
          )
        return <p key={i}>{renderInline(b.text)}</p>
      })}
    </div>
  )
}

// Typing pace. The floor is a comfortable reading speed; the backlog term means
// a fast reply catches up instead of crawling behind an artificial limit.
const BASE_CPS = 190
const BACKLOG_GAIN = 5.5

/**
 * Releases streamed text at a steady, readable pace.
 *
 * Providers chunk very differently: Groq emits a token at a time, Gemini often a
 * whole sentence or paragraph at once. Appending each chunk the instant it lands
 * makes the reply lurch forward in blocks, which reads as broken. This queues
 * whatever arrives and releases it on the animation frame, so the answer always
 * types out smoothly no matter which model produced it.
 */
function useTypewriter(append: (chunk: string) => void) {
  const queue = useRef('')
  const frame = useRef<number | null>(null)
  const last = useRef(0)
  const settled = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  const tick = useCallback(() => {
    const now = performance.now()
    // A backgrounded tab stops firing frames; cap the gap so it does not dump
    // the whole backlog in one jump when the student comes back.
    const elapsed = Math.min(now - last.current, 100)
    last.current = now

    const backlog = queue.current.length
    if (backlog === 0) {
      stop()
      const done = settled.current
      settled.current = null
      done?.()
      return
    }

    const take = Math.max(1, Math.round(((BASE_CPS + backlog * BACKLOG_GAIN) * elapsed) / 1000))
    const chunk = queue.current.slice(0, take)
    queue.current = queue.current.slice(chunk.length)
    append(chunk)

    frame.current = requestAnimationFrame(tick)
  }, [append, stop])

  const start = useCallback(() => {
    stop()
    queue.current = ''
    settled.current = null
  }, [stop])

  const push = useCallback(
    (text: string) => {
      queue.current += text
      if (frame.current === null) {
        last.current = performance.now()
        frame.current = requestAnimationFrame(tick)
      }
    },
    [tick],
  )

  /** Resolves once everything queued has actually been shown. */
  const drain = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (queue.current.length === 0) {
          resolve()
          return
        }
        settled.current = resolve
      }),
    [],
  )

  /** Show whatever is left at once: the student stopped, or something failed. */
  const flush = useCallback(() => {
    stop()
    const rest = queue.current
    queue.current = ''
    settled.current = null
    if (rest) append(rest)
  }, [append, stop])

  useEffect(() => () => stop(), [stop])

  return { start, push, drain, flush }
}

/** Caret that trails the text while a reply is still being written. */
function StreamCaret() {
  return (
    <span
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-accent align-baseline"
      aria-hidden
    />
  )
}

export default function Assistant() {
  const { user } = useAuth()
  const firstName = user?.first_name || 'there'
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingMessage(firstName)])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down' | undefined>>({})
  const [exportError, setExportError] = useState('')

  // Interview session
  const [interview, setInterview] = useState<{ active: boolean; target: string } | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [matches, setMatches] = useState<MatchResult[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Which bot message the typewriter is currently filling in.
  const streamTargetRef = useRef<string | null>(null)
  const appendToStream = useCallback((chunk: string) => {
    const id = streamTargetRef.current
    if (!id) return
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: m.text + chunk } : m)))
  }, [])
  const {
    start: startTyping,
    push: pushTyping,
    drain: drainTyping,
    flush: flushTyping,
  } = useTypewriter(appendToStream)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    api.matches
      .list()
      .then((m) => setMatches(m.filter((x) => x.status !== 'Not eligible')))
      .catch(() => setMatches([]))
  }, [])

  // The auth user loads asynchronously; once we know their name, personalise the
  // opening greeting, but only while the conversation is still untouched so we
  // never clobber an in-progress chat.
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'm-1' ? [greetingMessage(firstName)] : prev,
    )
  }, [firstName])

  // Stop generating on unmount so an abandoned stream doesn't keep writing.
  useEffect(() => () => abortRef.current?.abort(), [])

  /**
   * Stream a reply for a conversation that ends on a user turn. Text is
   * appended to a placeholder bot message as each chunk lands.
   */
  const requestReply = useCallback(
    async (convo: ChatMessage[], opts?: { mode?: 'interview'; target?: string }) => {
      const botId = nextId()
      const controller = new AbortController()
      abortRef.current = controller

      setIsStreaming(true)
      setStreamingId(botId)
      setMessages([...convo, { id: botId, role: 'bot', text: '' }])
      streamTargetRef.current = botId
      startTyping()

      const payload: ChatTurn[] = convo
        .filter((m) => m.text?.trim())
        .map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        }))

      const activeInterview = opts?.mode === 'interview' || interview?.active
      const target = opts?.target ?? interview?.target

      try {
        await api.assistant.stream(
          payload,
          (delta) => pushTyping(delta),
          {
            mode: activeInterview ? 'interview' : 'chat',
            scholarship: activeInterview ? target : undefined,
            signal: controller.signal,
          },
        )
        // The network is done, but the typewriter may still be catching up.
        await drainTyping()
      } catch (err: any) {
        // Show whatever already arrived rather than losing it behind the queue.
        flushTyping()
        // An aborted stream is the student pressing stop, not a failure.
        if (err?.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId && !m.text.trim()
                ? { ...m, text: 'Stopped. Ask me something else whenever you are ready.' }
                : m,
            ),
          )
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId
                ? {
                    ...m,
                    text:
                      m.text ||
                      err?.message ||
                      "Sorry, I couldn't reach the assistant just now. Please try again.",
                  }
                : m,
            ),
          )
        }
      } finally {
        streamTargetRef.current = null
        setIsStreaming(false)
        setStreamingId(null)
        abortRef.current = null
      }
    },
    [interview, startTyping, pushTyping, drainTyping, flushTyping],
  )

  const sendMessage = (text: string) => {
    if (!text.trim() || isStreaming) return
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    requestReply(next)
  }

  const stopGenerating = () => abortRef.current?.abort()

  const startInterview = (target: string) => {
    setShowPicker(false)
    setInterview({ active: true, target })
    const opener: ChatMessage = {
      id: nextId(),
      role: 'user',
      text: `Start the mock interview for ${target}. I am ready.`,
    }
    const next = [...messages, opener]
    setMessages(next)
    requestReply(next, { mode: 'interview', target })
  }

  const endInterview = () => {
    abortRef.current?.abort()
    setInterview(null)
  }

  const savePdf = (text: string) => {
    setExportError('')
    try {
      downloadPdf(deriveTitle(text), text)
    } catch (e) {
      console.error(e)
      setExportError('Sorry, I could not create the PDF. Please try again.')
    }
  }

  const saveWord = async (text: string) => {
    setExportError('')
    try {
      await downloadDocx(deriveTitle(text), text)
    } catch (e) {
      console.error(e)
      setExportError('Sorry, I could not create the Word file. Please try again.')
    }
  }

  // Re-ask from the last user message (drops the previous bot answer).
  const regenerate = () => {
    if (isStreaming) return
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user')
    if (lastUserIdx === -1) return
    requestReply(messages.slice(0, lastUserIdx + 1))
  }

  // Interview progress, read from the markers the model emits.
  const botText = messages.filter((m) => m.role === 'bot').map((m) => m.text)
  const currentQuestion = botText.reduce<number>(
    (acc, t) => readQuestionNumber(t) ?? acc,
    interview ? 1 : 0,
  )
  const debriefed = botText.some((t) => DEBRIEF_RE.test(t))
  const scores = botText.map(readScore).filter((s): s is number => s !== null)
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-sm',
              interview ? 'bg-accent text-accent-on' : 'bg-ink text-canvas',
            )}
            aria-hidden
          >
            {interview ? <Mic className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h1 className="t-h2 text-ink">{interview ? 'Mock interview' : 'Decision bot'}</h1>
            <p className="t-sm mt-0.5 truncate text-ink-muted">
              {interview ? interview.target : 'Grounded in your profile, matches and applications'}
            </p>
          </div>
        </div>

        {interview ? (
          <div className="flex items-center gap-2">
            {avgScore !== null && <Badge tone="accent">Avg {avgScore}/10</Badge>}
            <Button variant="subtle" size="sm" onClick={endInterview} icon={<X className="h-3.5 w-3.5" />}>
              End interview
            </Button>
          </div>
        ) : (
          <Button
            variant="accent"
            size="sm"
            onClick={() => setShowPicker(true)}
            icon={<Mic className="h-4 w-4" />}
          >
            Start mock interview
          </Button>
        )}
      </header>

      {/* Live interview progress */}
      {interview && (
        <Card className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-overline text-ink-muted">
              {debriefed ? 'Interview complete' : `Question ${Math.max(1, currentQuestion)} of ${INTERVIEW_QUESTIONS}`}
            </p>
            <p className="tabular t-xs text-ink-muted">
              {scores.length} answer{scores.length === 1 ? '' : 's'} scored
            </p>
          </div>
          <Progress
            className="mt-2.5"
            tone="accent"
            value={debriefed ? 100 : (Math.max(1, currentQuestion) / INTERVIEW_QUESTIONS) * 100}
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card className="flex h-[calc(100dvh-16rem)] min-h-[26rem] flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  const score = m.role === 'bot' ? readScore(m.text) : null
                  const streaming = m.id === streamingId
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
                      className={cn('flex', m.role === 'user' && 'justify-end')}
                    >
                      {m.role === 'bot' ? (
                        /* Editorial: the bot speaks as page text behind a gold rule */
                        <div className="min-w-0 max-w-full border-l-2 border-accent pl-4 sm:pl-5">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <p className="t-overline text-ink-muted">
                              {interview ? 'Panel' : 'Decision bot'}
                            </p>
                            {score !== null && (
                              <span
                                className={cn(
                                  'tabular rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold',
                                  score >= 8
                                    ? 'border-state-positive/40 text-state-positive'
                                    : score >= 5
                                      ? 'border-state-attention/40 text-state-attention'
                                      : 'border-state-negative/40 text-state-negative',
                                )}
                              >
                                Score {score}/10
                              </span>
                            )}
                          </div>

                          <div className="t-body text-ink-secondary">
                            {m.text ? (
                              <>
                                <MessageBody text={stripMarkers(m.text)} />
                                {streaming && <StreamCaret />}
                              </>
                            ) : (
                              <span className="flex items-center gap-1.5" aria-label="Thinking">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-accent"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                  />
                                ))}
                              </span>
                            )}
                          </div>

                          {m.id !== 'm-1' && !streaming && (
                            <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-rule pt-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setFeedback((f) => ({ ...f, [m.id]: f[m.id] === 'up' ? undefined : 'up' }))
                                }
                                aria-label="Helpful"
                                aria-pressed={feedback[m.id] === 'up'}
                                className={cn(
                                  'grid h-7 w-7 place-items-center rounded-sm transition-colors hover:bg-surface-sunken',
                                  feedback[m.id] === 'up' ? 'text-state-positive' : 'text-ink-faint hover:text-ink',
                                )}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setFeedback((f) => ({
                                    ...f,
                                    [m.id]: f[m.id] === 'down' ? undefined : 'down',
                                  }))
                                }
                                aria-label="Not helpful"
                                aria-pressed={feedback[m.id] === 'down'}
                                className={cn(
                                  'grid h-7 w-7 place-items-center rounded-sm transition-colors hover:bg-surface-sunken',
                                  feedback[m.id] === 'down' ? 'text-state-negative' : 'text-ink-faint hover:text-ink',
                                )}
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>

                              {/* Regenerate only the latest answer */}
                              {m.id === messages[messages.length - 1].id && (
                                <button
                                  type="button"
                                  onClick={regenerate}
                                  aria-label="Regenerate answer"
                                  className="grid h-7 w-7 place-items-center rounded-sm text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                                >
                                  <RefreshCcw className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Download document-length answers as PDF or Word */}
                              {isDownloadable(m.text) && (
                                <div className="ml-auto flex items-center gap-1">
                                  <span className="t-overline text-ink-faint">Save as</span>
                                  <button
                                    type="button"
                                    onClick={() => savePdf(m.text)}
                                    className="t-xs flex items-center gap-1 rounded-sm px-1.5 py-1 font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                                  >
                                    <FileText className="h-3.5 w-3.5" /> PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveWord(m.text)}
                                    className="t-xs flex items-center gap-1 rounded-sm px-1.5 py-1 font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                                  >
                                    <FileType2 className="h-3.5 w-3.5" /> Word
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="t-body max-w-[85%] rounded-lg rounded-br-sm bg-ink px-4 py-3 text-canvas">
                          <MessageBody text={m.text} />
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* Quick replies (only before the first exchange) */}
              {messages.length === 1 && messages[0].quickReplies && (
                <div className="flex flex-wrap gap-2 pl-4 sm:pl-5">
                  {messages[0].quickReplies.map((qr) => (
                    <button
                      key={qr}
                      type="button"
                      onClick={() => sendMessage(qr)}
                      disabled={isStreaming}
                      className="rounded-full border border-rule px-3.5 py-1.5 text-[0.8125rem] font-semibold text-ink-secondary transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-rule px-3 py-3 sm:px-4">
              {exportError && (
                <Alert tone="danger" className="mb-3">
                  {exportError}
                </Alert>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage(input)
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    interview ? 'Answer the panel…' : 'Ask me anything about your scholarships…'
                  }
                  aria-label="Message the decision bot"
                  className="h-11 min-w-0 flex-1 rounded-md border border-rule bg-surface px-4 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-ink focus:outline-none"
                />
                {isStreaming ? (
                  <Button
                    type="button"
                    variant="subtle"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-md"
                    onClick={stopGenerating}
                    aria-label="Stop generating"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="accent"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-md"
                    disabled={!input.trim()}
                    aria-label="Send message"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </Button>
                )}
              </form>
              <p className="t-xs mt-2.5 text-center text-ink-faint">
                AI generated using your ScholarCircle data. Always verify deadlines and eligibility
                with the provider.
              </p>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Card as="section">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="t-h3 text-ink">What I can do</h2>
            </div>
            <ul className="rule-list">
              {tips.map((tip) => (
                <li key={tip.title}>
                  <button
                    type="button"
                    onClick={() => sendMessage(tip.desc)}
                    disabled={isStreaming}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-sunken disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-semibold text-ink">
                        {tip.title}
                      </span>
                      <span className="t-xs mt-0.5 block text-ink-muted">{tip.desc}</span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-ink"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card as="section" className="px-5 py-4">
            <h2 className="t-overline text-ink-muted">This conversation</h2>
            <dl className="rule-list mt-2">
              <DataRow label="Messages exchanged" value={messages.length} />
              <DataRow
                label="Questions you asked"
                value={messages.filter((m) => m.role === 'user').length}
              />
              {avgScore !== null && <DataRow label="Interview average" value={`${avgScore}/10`} />}
            </dl>
          </Card>

          <section className="rounded-md bg-band px-5 py-5">
            <p className="t-overline text-accent">Grounded answers</p>
            <p className="t-sm mt-2.5 leading-relaxed text-band-muted">
              Replies are based on <span className="font-semibold text-band-on">your</span> profile,
              matches and applications, not generic advice. Always confirm deadlines on the
              provider&apos;s site.
            </p>
          </section>
        </div>
      </div>

      {/* Interview target picker */}
      <Modal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        title="Run a mock interview"
        description="Six questions, one at a time, with an honest score and a sharper version of every answer."
      >
        {matches.length > 0 ? (
          <ul className="rule-list">
            {matches.slice(0, 8).map((m) => (
              <li key={m.scholarship.id}>
                <button
                  type="button"
                  onClick={() => startInterview(`${m.scholarship.name} (${m.scholarship.provider})`)}
                  className="group flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:bg-surface-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {m.scholarship.name}
                    </span>
                    <span className="t-xs mt-0.5 block truncate text-ink-muted">
                      {m.scholarship.provider}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-ink"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-body text-ink-muted">
            You have no eligible matches yet, so I have nothing specific to interview you for.
            Complete your profile first and the panel will be tailored to the real award.
          </p>
        )}
      </Modal>
    </div>
  )
}
