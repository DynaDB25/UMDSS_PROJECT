import { useState, useRef, useEffect } from 'react'
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
} from 'lucide-react'
import { Alert, Badge, Button, Card, DataRow } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { downloadPdf, downloadDocx, deriveTitle } from '../lib/exportDoc'
import { cn } from '../lib/cn'
import type { ChatMessage } from '../data/types'

// Offer downloads on substantial answers (essays, letters, interview guides),
// not on short chatty replies.
const isDownloadable = (text: string) => text.trim().length > 240

const greetingMessage = (name: string): ChatMessage => ({
  id: 'm-1',
  role: 'bot',
  text: `Hello ${name} 👋  I'm your Scholarship Decision Bot. I know your profile, your matches and your applications, so my advice actually fits you. I can compare awards, check eligibility, plan your deadlines, write your essays and personal statements (download them as PDF or Word), and run full interview prep. What would you like to start with?`,
  quickReplies: [
    'Which scholarships should I prioritise?',
    'Write my personal statement',
    'Prep me for an interview',
    'Plan my upcoming deadlines',
  ],
})

const tips = [
  { title: 'Interview prep', desc: 'Run a mock interview for my strongest scholarship' },
  { title: 'Essay drafts', desc: 'Draft a personal statement outline from my profile' },
  { title: 'Deadline planning', desc: 'Give me a week-by-week plan for my open deadlines' },
  { title: 'Compare awards', desc: 'Compare my top two scholarship matches' },
]

// Render a single line with inline **bold** without pulling in a markdown lib.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <strong key={i} className="font-bold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

// Lightweight formatter for LLM output: headings, bullets, blank-line spacing.
function MessageBody({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-2" />
        const header = line.match(/^#{1,6}\s+(.*)$/)
        if (header)
          return (
            <p key={i} className="font-display font-bold tracking-tight">
              {renderInline(header[1])}
            </p>
          )
        const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
        if (bullet)
          return (
            <div key={i} className="flex gap-2.5">
              <span className="mt-[7px] h-1 w-1 shrink-0 rotate-45 bg-current opacity-45" aria-hidden />
              <span className="min-w-0 flex-1">{renderInline(bullet[1])}</span>
            </div>
          )
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

export default function Assistant() {
  const { user } = useAuth()
  const firstName = user?.first_name || 'there'
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingMessage(firstName)])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down' | undefined>>({})
  const [exportError, setExportError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // The auth user loads asynchronously; once we know their name, personalise the
  // opening greeting — but only while the conversation is still untouched, so we
  // never clobber an in-progress chat.
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'm-1' ? [greetingMessage(firstName)] : prev,
    )
  }, [firstName])

  // Ask Groq (via our backend) for a reply to a conversation that ends on a user
  // turn, then append the bot's answer. Shared by send and regenerate.
  const requestReply = async (convo: ChatMessage[]) => {
    setIsTyping(true)
    try {
      const payload = convo
        .filter((m) => m.text?.trim())
        .map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        }))
      const { reply } = await api.assistant.chat(payload)
      setMessages([...convo, { id: `m-${Date.now()}`, role: 'bot', text: reply }])
    } catch (err: any) {
      setMessages([
        ...convo,
        {
          id: `m-${Date.now()}`,
          role: 'bot',
          text: err?.message || "Sorry — I couldn't reach the assistant just now. Please try again.",
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const sendMessage = (text: string) => {
    if (!text.trim() || isTyping) return
    const userMsg: ChatMessage = { id: `m-${Date.now()}`, role: 'user', text: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    requestReply(next)
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
    if (isTyping) return
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user')
    if (lastUserIdx === -1) return
    const trimmed = messages.slice(0, lastUserIdx + 1)
    setMessages(trimmed)
    requestReply(trimmed)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-ink text-canvas"
            aria-hidden
          >
            <Bot className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="t-h2 text-ink">Decision bot</h1>
            <p className="t-sm mt-0.5 text-ink-muted">
              Grounded in your profile, matches and applications
            </p>
          </div>
        </div>
        <Badge tone="positive" className="shrink-0">
          Online
        </Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card className="flex h-[calc(100dvh-16rem)] min-h-[26rem] flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
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
                        <p className="t-overline mb-2 text-ink-muted">Decision bot</p>
                        <div className="t-body text-ink-secondary">
                          <MessageBody text={m.text} />
                        </div>

                        {m.id !== 'm-1' && (
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
                                disabled={isTyping}
                                aria-label="Regenerate answer"
                                className="grid h-7 w-7 place-items-center rounded-sm text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-40"
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
                ))}
              </AnimatePresence>

              {/* Quick replies (only before the first exchange) */}
              {messages.length === 1 && messages[0].quickReplies && (
                <div className="flex flex-wrap gap-2 pl-4 sm:pl-5">
                  {messages[0].quickReplies.map((qr) => (
                    <button
                      key={qr}
                      type="button"
                      onClick={() => sendMessage(qr)}
                      disabled={isTyping}
                      className="rounded-full border border-rule px-3.5 py-1.5 text-[0.8125rem] font-semibold text-ink-secondary transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {/* Typing indicator */}
              {isTyping && (
                <div className="border-l-2 border-accent pl-4 sm:pl-5">
                  <p className="t-overline mb-2 text-ink-muted">Decision bot</p>
                  <div className="flex items-center gap-1.5" role="status" aria-label="Thinking">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-accent"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
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
                  placeholder="Ask me anything about your scholarships…"
                  aria-label="Message the decision bot"
                  className="h-11 min-w-0 flex-1 rounded-md border border-rule bg-surface px-4 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-ink focus:outline-none"
                />
                <Button
                  type="submit"
                  variant="accent"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-md"
                  disabled={!input.trim() || isTyping}
                  aria-label="Send message"
                >
                  <Send className="h-4.5 w-4.5" />
                </Button>
              </form>
              <p className="t-xs mt-2.5 text-center text-ink-faint">
                AI-generated using your ScholarCircle data. Always verify deadlines and eligibility
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
                    disabled={isTyping}
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
            </dl>
          </Card>

          <section className="rounded-md bg-band px-5 py-5">
            <p className="t-overline text-accent">Grounded answers</p>
            <p className="t-sm mt-2.5 leading-relaxed text-band-muted">
              Replies are based on <span className="font-semibold text-band-on">your</span> profile,
              matches and applications — not generic advice. Always confirm deadlines on the
              provider&apos;s site.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
