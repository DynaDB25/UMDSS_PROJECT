import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Send,
  Sparkles,
  Lightbulb,
  RefreshCcw,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  MessageSquareText,
  FileText,
  FileType2,
} from 'lucide-react'
import { Card, Badge } from '../components/ui'
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
      <strong key={i}>{part.slice(2, -2)}</strong>
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
        if (line.trim() === '') return <div key={i} className="h-1.5" />
        const header = line.match(/^#{1,6}\s+(.*)$/)
        if (header) return <p key={i} className="font-bold">{renderInline(header[1])}</p>
        const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
        if (bullet)
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-[3px] text-current opacity-50">•</span>
              <span className="flex-1">{renderInline(bullet[1])}</span>
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
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({})
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
        .map((m) => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text }))
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
    try {
      downloadPdf(deriveTitle(text), text)
    } catch (e) {
      console.error(e)
      alert('Sorry, I could not create the PDF. Please try again.')
    }
  }

  const saveWord = async (text: string) => {
    try {
      await downloadDocx(deriveTitle(text), text)
    } catch (e) {
      console.error(e)
      alert('Sorry, I could not create the Word file. Please try again.')
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
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink-900">Decision Bot</h1>
            <p className="text-sm text-ink-500">AI adviser grounded in your profile &amp; matches</p>
          </div>
          <Badge tone="green" className="ml-2">Online</Badge>
        </div>

        {/* Chat area */}
        <Card className="flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 420 }}>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}
                >
                  {m.role === 'bot' && (
                    <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      m.role === 'bot' ? 'bg-ink-50 text-ink-800' : 'bg-brand-700 text-white',
                    )}
                  >
                    <MessageBody text={m.text} />

                    {m.role === 'bot' && m.id !== 'm-1' && (
                      <div className="mt-2 flex items-center gap-2 border-t border-ink-200/60 pt-2">
                        <button
                          onClick={() => setFeedback((f) => ({ ...f, [m.id]: f[m.id] === 'up' ? undefined as any : 'up' }))}
                          title="Helpful"
                          className={cn(
                            'grid h-6 w-6 place-items-center rounded hover:bg-ink-100',
                            feedback[m.id] === 'up' ? 'text-emerald-600' : 'text-ink-400 hover:text-ink-600',
                          )}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setFeedback((f) => ({ ...f, [m.id]: f[m.id] === 'down' ? undefined as any : 'down' }))}
                          title="Not helpful"
                          className={cn(
                            'grid h-6 w-6 place-items-center rounded hover:bg-ink-100',
                            feedback[m.id] === 'down' ? 'text-rose-600' : 'text-ink-400 hover:text-ink-600',
                          )}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                        {/* Regenerate only the latest answer */}
                        {m.id === messages[messages.length - 1].id && (
                          <button
                            onClick={regenerate}
                            disabled={isTyping}
                            title="Regenerate"
                            className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-600 disabled:opacity-40"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Download document-length answers as PDF or Word */}
                        {isDownloadable(m.text) && (
                          <div className="ml-auto flex items-center gap-1">
                            <span className="text-[10px] font-medium text-ink-400">Save as</span>
                            <button
                              onClick={() => savePdf(m.text)}
                              title="Download as PDF"
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-ink-500 hover:bg-ink-100 hover:text-rose-600"
                            >
                              <FileText className="h-3.5 w-3.5" /> PDF
                            </button>
                            <button
                              onClick={() => saveWord(m.text)}
                              title="Download as Word"
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-ink-500 hover:bg-ink-100 hover:text-sky-600"
                            >
                              <FileType2 className="h-3.5 w-3.5" /> Word
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Quick replies (only before the first exchange) */}
            {messages.length === 1 && messages[0].quickReplies && (
              <div className="flex flex-wrap gap-2 pl-11">
                {messages[0].quickReplies.map((qr) => (
                  <button
                    key={qr}
                    onClick={() => sendMessage(qr)}
                    disabled={isTyping}
                    className="rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-ink-50 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-ink-200/70 p-3 sm:p-4">
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
                className="h-11 flex-1 rounded-xl border border-ink-200 bg-ink-50 px-4 text-sm text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-800 disabled:opacity-40 disabled:hover:bg-brand-700"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-ink-400">
              AI-generated using your ScholarCircle data. Always verify deadlines and eligibility with the provider.
            </p>
          </div>
        </Card>
      </div>

      {/* Right rail */}
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-gold-500" />
            <h2 className="font-display text-lg font-bold text-ink-900">What I can do</h2>
          </div>
          <div className="mt-4 space-y-3">
            {tips.map((tip) => (
              <button
                key={tip.title}
                onClick={() => sendMessage(tip.desc)}
                disabled={isTyping}
                className="group flex w-full items-center gap-3 rounded-xl border border-ink-200/70 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800">{tip.title}</p>
                  <p className="text-xs text-ink-400">{tip.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink-900">This conversation</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Messages exchanged', value: String(messages.length) },
              { label: 'Questions you asked', value: String(messages.filter((m) => m.role === 'user').length) },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm text-ink-600">{s.label}</span>
                <span className="text-sm font-semibold text-ink-800">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-200">
              <MessageSquareText className="h-4 w-4" /> Grounded answers
            </div>
            <p className="mt-2 text-sm leading-snug">
              Replies are based on <span className="font-semibold text-gold-300">your</span> profile,
              matches and applications — not generic advice. Always confirm deadlines on the provider&apos;s site.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
