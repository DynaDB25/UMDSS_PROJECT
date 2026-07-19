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
} from 'lucide-react'
import { Card, Badge } from '../components/ui'
import { cn } from '../lib/cn'
import type { ChatMessage } from '../data/types'

const initialMessages: ChatMessage[] = [
  {
    id: 'm-1',
    role: 'bot',
    text: "Hello Benjamin 👋  I'm your Scholarship Decision Bot. I can help you compare awards, draft essays, prepare for interviews, or answer eligibility questions. What would you like help with today?",
    quickReplies: [
      'Compare MTN vs GETFund',
      'Help me write an essay',
      'Prepare for my MTN interview',
      'Which scholarships can I still apply for?',
    ],
  },
]

const botResponses: Record<string, string> = {
  'Compare MTN vs GETFund':
    "Great question! Here's a quick comparison:\n\n**MTN Bright Scholarship**\n• Amount: GH₵ 10,000/year + laptop + internship\n• Match score: 96% — your strongest match\n• Deadline: 14 Jul 2026\n• Extras: Paid MTN internship, mentorship, data bundle\n\n**GETFund National Scholarship**\n• Amount: Full tuition + GH₵ 6,000 stipend\n• Match score: 92% — also very strong\n• Deadline: 31 Jul 2026\n• Extras: Book allowance, renewable yearly\n\n**My recommendation:** Apply for both! MTN gives career-specific perks (internship + laptop) while GETFund covers more of your tuition. They are not mutually exclusive.",
  'Help me write an essay':
    "I'd love to help you draft an essay! For the Mastercard Foundation Scholars application, you'll need a personal essay (500-700 words). Let's start with an outline:\n\n1. **Opening hook** — A defining moment that shaped your goals\n2. **Your story** — Background, challenges you've overcome, why computer engineering\n3. **Impact vision** — How the scholarship enables you to give back to Ghana\n4. **Closing** — A forward-looking statement connecting your ambition to the foundation's mission\n\nWould you like me to draft a full essay based on your profile, or would you prefer to write section by section?",
  'Prepare for my MTN interview':
    "Your MTN Bright Scholarship interview is on **Thu 03 Jul, 10:00 AM at MTN House, Accra**. Here's how to prepare:\n\n**Likely questions:**\n1. Why did you choose Computer Engineering?\n2. How will this scholarship impact your community?\n3. Describe a technical project you've worked on\n4. Where do you see yourself in 5 years?\n\n**Tips:**\n• Research MTN's current CSR initiatives in Ghana\n• Prepare a 60-second elevator pitch about yourself\n• Dress formally — business formal is expected\n• Bring printed copies of your documents\n• Arrive 30 minutes early\n\nWant me to do a mock interview with you?",
  'Which scholarships can I still apply for?':
    "Based on your profile and current deadlines, here are the scholarships still open:\n\n1. **District-Level Scheme** — closes **05 Jul** (6 days!) ⚠️\n   → You've submitted but need to upload Proof of District Origin\n\n2. **MTN Bright** — closes **14 Jul** (15 days)\n   → Application in interview stage ✅\n\n3. **GETFund National** — closes **31 Jul** (32 days)\n   → Under review ✅\n\n4. **Mastercard Foundation** — closes **20 Aug** (52 days)\n   → Draft started — finish your personal essay\n\n5. **Stanbic Future Leaders** — closes **10 Sep** (73 days)\n   → Not yet applied; you're a partial match (71%)\n\n6. **Chevening-Ghana** — closes **01 Oct** (94 days)\n   → Not yet applied; strong match (88%) but needs leadership essay\n\n**Priority action:** Upload your district origin proof ASAP — that deadline is in 6 days!",
}

const tips = [
  { title: 'Interview prep', desc: 'Ask me to run a mock interview for any scholarship' },
  { title: 'Essay drafts', desc: 'I can generate first-draft essays from your profile' },
  { title: 'Deadline planning', desc: 'Get a week-by-week action plan for all open deadlines' },
  { title: 'Compare awards', desc: 'Side-by-side comparison of any two scholarships' },
]

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = (text: string) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = { id: `m-${Date.now()}`, role: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    setTimeout(() => {
      const reply =
        botResponses[text.trim()] ??
        "I've looked at your profile and the current scholarship database. Could you give me a bit more detail about what you'd like help with? For example:\n\n• Compare two specific scholarships\n• Draft or review an essay\n• Prepare for an interview\n• Check your eligibility for a specific award"

      const botMsg: ChatMessage = {
        id: `m-${Date.now() + 1}`,
        role: 'bot',
        text: reply,
      }
      setIsTyping(false)
      setMessages((prev) => [...prev, botMsg])
    }, 1200 + Math.random() * 800)
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
            <p className="text-sm text-ink-500">AI-powered scholarship advisor</p>
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
                      m.role === 'bot'
                        ? 'bg-ink-50 text-ink-800'
                        : 'bg-brand-700 text-white',
                    )}
                  >
                    {m.text.split('\n').map((line, i) => (
                      <span key={i}>
                        {line.startsWith('**') ? (
                          <strong>{line.replace(/\*\*/g, '')}</strong>
                        ) : (
                          line
                        )}
                        {i < m.text.split('\n').length - 1 && <br />}
                      </span>
                    ))}

                    {m.role === 'bot' && (
                      <div className="mt-2 flex items-center gap-2 border-t border-ink-200/60 pt-2">
                        <button className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-600">
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-600">
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                        <button className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-600">
                          <RefreshCcw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Quick replies */}
            {messages.length === 1 && messages[0].quickReplies && (
              <div className="flex flex-wrap gap-2 pl-11">
                {messages[0].quickReplies.map((qr) => (
                  <button
                    key={qr}
                    onClick={() => sendMessage(qr)}
                    className="rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 pl-0"
              >
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
                placeholder="Ask me anything about scholarships…"
                className="h-11 flex-1 rounded-xl border border-ink-200 bg-ink-50 px-4 text-sm text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-800 disabled:opacity-40 disabled:hover:bg-brand-700"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-ink-400">
              Responses are AI-generated. Always verify deadline dates and eligibility details.
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
                onClick={() => sendMessage(tip.title === 'Compare awards' ? 'Compare MTN vs GETFund' : tip.desc)}
                className="group flex w-full items-center gap-3 rounded-xl border border-ink-200/70 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
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
          <h2 className="font-display text-lg font-bold text-ink-900">Conversation stats</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Messages today', value: String(messages.length) },
              { label: 'Scholarships discussed', value: '4' },
              { label: 'Essays drafted', value: '0' },
              { label: 'Mock interviews', value: '0' },
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
              <MessageSquareText className="h-4 w-4" /> SMS Mode
            </div>
            <p className="mt-2 text-sm leading-snug">
              Can't access the web app? Text <span className="font-bold text-gold-300">SCHOLAR</span> to{' '}
              <span className="font-semibold">1393</span> to chat with the bot via SMS.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
