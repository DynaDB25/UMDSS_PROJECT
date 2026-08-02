import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/endpoints'
import type { AppNotification } from '../data/types'
import {
  Bell,
  MessageSquareText,
  Mail,
  Settings2,
  CalendarClock,
  CheckCheck,
  Smartphone,
  Sparkles,
  GraduationCap,
} from 'lucide-react'
import { Card, Badge } from '../components/ui'
import { cn } from '../lib/cn'

const channelIcon = {
  SMS: MessageSquareText,
  Email: Mail,
  System: Bell,
}

const catIcon = {
  Deadline: CalendarClock,
  Status: CheckCheck,
  Interview: GraduationCap,
  Match: Sparkles,
  System: Settings2,
}

const catColor: Record<string, string> = {
  Deadline: 'bg-rose-50 text-rose-600',
  Status: 'bg-emerald-50 text-emerald-600',
  Interview: 'bg-violet-50 text-violet-600',
  Match: 'bg-brand-50 text-brand-600',
  System: 'bg-ink-100 text-ink-500',
}

const tabs = ['All', 'SMS', 'Email', 'System'] as const

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<(typeof tabs)[number]>('All')

  useEffect(() => {
    api.notifications.list().then(setItems).finally(() => setLoading(false))
  }, [])

  const filtered = tab === 'All' ? items : items.filter((n) => n.channel === tab)
  const unread = items.filter((n) => !n.read).length

  const markAll = () => {
    api.notifications.markAllRead().then(() => {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    })
  }
  
  if (loading) return <div>Loading notifications...</div>

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-600" />
            <h1 className="font-display text-2xl font-extrabold text-ink-900">Notifications</h1>
            {unread > 0 && <Badge tone="brand">{unread} new</Badge>}
          </div>
          <button onClick={markAll} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Mark all read
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-xl px-3.5 py-2 text-sm font-medium transition',
                tab === t
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((n, i) => {
            const ChIcon = channelIcon[n.channel]
            const CatIcon = catIcon[n.category]
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card
                  className={cn(
                    'flex gap-4 p-4 transition hover:shadow-sm',
                    !n.read && 'ring-1 ring-brand-200',
                  )}
                >
                  <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', catColor[n.category])}>
                    <CatIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ink-900">{n.title}</p>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                      </div>
                      <span className="shrink-0 text-xs text-ink-400">{n.time}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{n.body}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ink-400">
                      <ChIcon className="h-3.5 w-3.5" />
                      Sent via {n.channel}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Preferences rail */}
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink-900">Delivery channels</h2>
          <p className="mt-1 text-sm text-ink-500">
            SMS is the primary channel, tuned for low-bandwidth districts.
          </p>

          <div className="mt-5 space-y-3">
            {[
              { icon: Smartphone, label: 'SMS alerts', sub: 'Hubtel · +233 24 712 0098', on: true, primary: true },
              { icon: Mail, label: 'Email alerts', sub: 'benjamin.darko@st.knust.edu.gh', on: true },
              { icon: Bell, label: 'In-app alerts', sub: 'Shown on your dashboard', on: true },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-3 rounded-xl border border-ink-200/70 p-3.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <c.icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-800">{c.label}</p>
                    {c.primary && <Badge tone="gold">Primary</Badge>}
                  </div>
                  <p className="truncate text-xs text-ink-400">{c.sub}</p>
                </div>
                <span className={cn('relative h-6 w-11 rounded-full transition', c.on ? 'bg-brand-600' : 'bg-ink-200')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', c.on ? 'left-[22px]' : 'left-0.5')} />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink-900">Alert types</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Deadline reminders', sub: '7 and 2 days before close' },
              { label: 'Interview schedules', sub: 'As soon as a slot is set' },
              { label: 'Application status', sub: 'When a reviewer updates' },
              { label: 'New matches', sub: 'When criteria change' },
            ].map((a) => (
              <label key={a.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-800">{a.label}</p>
                  <p className="text-xs text-ink-400">{a.sub}</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4.5 w-4.5 rounded border-ink-300 text-brand-600 focus:ring-brand-200" />
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
