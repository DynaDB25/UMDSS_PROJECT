import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Send,
  RefreshCcw,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  FileText,
  FileType2,
  Mic,
  Square,
  X,
  Compass,
  CalendarClock,
  Scale,
} from 'lucide-react'
import { Alert, Badge, Button, Card, Modal, Progress } from '../components/ui'
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
})

// Shown as tappable cards on the empty state, so a student never faces a blank
// box wondering what to ask.
const SUGGESTIONS = [
  { icon: Compass, title: 'Where to focus', text: 'Which scholarships should I prioritise, and why?' },
  { icon: FileText, title: 'Draft my statement', text: 'Write my personal statement in my own voice' },
  { icon: CalendarClock, title: 'Plan my deadlines', text: 'Give me a week by week plan for my open deadlines' },
  { icon: Scale, title: 'Compare two awards', text: 'Compare my top two scholarship matches side by side' },
]

// A compact, always-available set of prompts pinned above the composer, so a
// "quick tap" is one reach away for the whole conversation, not only at the start.
const QUICK_PROMPTS = [
  'Which should I prioritise?',
  'What is blocking my strongest match?',
  'Draft my personal statement',
  'Plan my open deadlines',
  'Compare my top two matches',
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

/**
 * Strip the machinery the UI already renders as chrome, so it never shows up as
 * raw text in the reply. The score sits in a chip on the message, the question
 * number drives the progress bar, so both markers are pulled out of the body.
 * Whatever the model wrote around them (the improved answer, the next question)
 * flows on untouched.
 */
function stripMarkers(text: string) {
  return text
    .replace(/\*\*Score:\s*\d{1,2}\s*\/\s*10\*\*[ \t]*\n?/gi, '')
    .replace(/\*\*Question\s+\d\s+of\s+\d\*\*[ \t]*\n?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/, '')
}

// Render a line with inline emphasis, and crucially, never let raw markdown
// characters reach the screen. Models reach for **bold**, *italic* and
// `code` even when told not to; showing those markers literally is exactly the
// "looks like a machine wrote it" tell the student should never see. Paired
// markers become styling; any stray marker that never closed is dropped.
function renderInline(text: string) {
  return text
    .split(/(\*\*[\s\S]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g)
    .map((part, i) => {
      if (/^\*\*[\s\S]+\*\*$/.test(part))
        return (
          <strong key={i} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        )
      if (/^\*[^*\n]+\*$/.test(part))
        return (
          <em key={i} className="italic">
            {part.slice(1, -1)}
          </em>
        )
      if (/^`[^`\n]+`$/.test(part)) return <span key={i}>{part.slice(1, -1)}</span>
      // Plain text: strip stray asterisks/backticks that never formed a pair.
      return <span key={i}>{part.replace(/[*`]/g, '')}</span>
    })
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

/** Three-dot "thinking" indicator, shown before the first token lands. */
function ThinkingDots() {
  return (
    <span className="flex items-center gap-1.5" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-accent"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
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
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Nothing sent yet: show the welcome canvas instead of a lone greeting bubble.
  const isFirstRun = messages.length === 1

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

  // Keep the composer sized to its content: grows with a long draft, springs
  // back after send. Capped so it never eats the whole conversation.
  const resizeInput = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`
  }, [])
  useEffect(resizeInput, [input, resizeInput])

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
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[32rem] flex-col">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-sm',
              interview ? 'bg-accent text-accent-on' : 'bg-ink text-canvas',
            )}
            aria-hidden
          >
            {interview ? <Mic className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h1 className="t-h3 text-ink">{interview ? 'Mock interview' : 'Decision bot'}</h1>
            <p className="t-xs mt-0.5 truncate text-ink-muted">
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
      <AnimatePresence initial={false}>
        {interview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="shrink-0 overflow-hidden"
          >
            <Card className="mb-4 px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-overline text-ink-muted">
                  {debriefed
                    ? 'Interview complete'
                    : `Question ${Math.max(1, currentQuestion)} of ${INTERVIEW_QUESTIONS}`}
                </p>
                <p className="tabular t-xs text-ink-muted">
                  {scores.length} answer{scores.length === 1 ? '' : 's'} scored
                  {avgScore !== null && ` · avg ${avgScore}/10`}
                </p>
              </div>
              <Progress
                className="mt-2.5"
                tone="accent"
                value={debriefed ? 100 : (Math.max(1, currentQuestion) / INTERVIEW_QUESTIONS) * 100}
              />
              {/* Per-question score dots, filled as answers are graded */}
              <div className="mt-3 flex items-center gap-1.5">
                {Array.from({ length: INTERVIEW_QUESTIONS }).map((_, i) => {
                  const s = scores[i]
                  return (
                    <span
                      key={i}
                      title={s !== undefined ? `Question ${i + 1}: ${s}/10` : `Question ${i + 1}`}
                      className={cn(
                        'tabular grid h-6 flex-1 place-items-center rounded-sm border text-[0.625rem] font-bold',
                        s === undefined
                          ? 'border-rule text-ink-faint'
                          : s >= 8
                            ? 'border-state-positive/40 bg-state-positive/10 text-state-positive'
                            : s >= 5
                              ? 'border-state-attention/40 bg-state-attention/10 text-state-attention'
                              : 'border-state-negative/40 bg-state-negative/10 text-state-negative',
                      )}
                    >
                      {s === undefined ? i + 1 : s}
                    </span>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation surface */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isFirstRun ? (
            /* ---------- Welcome canvas ---------- */
            <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-5 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-md bg-ink text-canvas" aria-hidden>
                <Bot className="h-7 w-7" />
              </span>
              <h2 className="t-h2 mt-5 text-ink">
                Hi {firstName}, where should we start?
              </h2>
              <p className="t-body mt-2.5 max-w-md text-ink-muted">
                I read your profile, your matches and where each application stands. Ask me
                something specific, or start here.
              </p>
              <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => sendMessage(s.text)}
                    className="group flex items-start gap-3 rounded-md border border-rule bg-surface p-4 text-left transition-colors hover:border-ink hover:bg-surface-sunken"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-surface-sunken text-ink transition-colors group-hover:bg-accent group-hover:text-accent-on">
                      <s.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-semibold text-ink">{s.title}</span>
                      <span className="t-xs mt-0.5 block text-ink-muted">{s.text}</span>
                    </span>
                    <ArrowRight
                      className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-ink"
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ---------- Transcript ---------- */
            <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  const score = m.role === 'bot' ? readScore(m.text) : null
                  const streaming = m.id === streamingId
                  const body = m.role === 'bot' ? stripMarkers(m.text) : m.text
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
                            {body ? (
                              <>
                                <MessageBody text={body} />
                                {streaming && <StreamCaret />}
                              </>
                            ) : (
                              <ThinkingDots />
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
                                    onClick={() => savePdf(stripMarkers(m.text))}
                                    className="t-xs flex items-center gap-1 rounded-sm px-1.5 py-1 font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                                  >
                                    <FileText className="h-3.5 w-3.5" /> PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveWord(stripMarkers(m.text))}
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
                          <MessageBody text={body} />
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-rule bg-canvas">
          <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4">
            {exportError && (
              <Alert tone="danger" className="mb-3">
                {exportError}
              </Alert>
            )}

            {/* Persistent quick-tap prompts, available for the whole chat */}
            {!interview && !isFirstRun && (
              <div className="mb-2.5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    disabled={isStreaming}
                    className="shrink-0 whitespace-nowrap rounded-full border border-rule px-3 py-1.5 text-[0.8125rem] font-medium text-ink-secondary transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage(input)
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter drops to a new line for longer drafts.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                rows={1}
                placeholder={
                  interview ? 'Answer the panel…' : 'Ask me anything about your scholarships…'
                }
                aria-label="Message the decision bot"
                className="max-h-44 min-h-[2.75rem] min-w-0 flex-1 resize-none rounded-md border border-rule bg-surface px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-ink focus:outline-none"
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
            <p className="t-xs mt-2 text-center text-ink-faint">
              AI generated using your ScholarCircle data. Always verify deadlines and eligibility
              with the provider.
            </p>
          </div>
        </div>
      </Card>

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
