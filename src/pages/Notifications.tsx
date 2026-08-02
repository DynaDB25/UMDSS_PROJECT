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
  Inbox,
} from 'lucide-react'
import { Badge, Button, Card, Checkbox, EmptyState, SegmentedControl } from '../components/ui'
import { PageListSkeleton } from '../components/skeletons'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { listItem, stagger } from '../lib/motion'

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

const catTone: Record<string, string> = {
  Deadline: 'border-state-negative/30 text-state-negative',
  Status: 'border-state-positive/30 text-state-positive',
  Interview: 'border-state-special/30 text-state-special',
  Match: 'border-accent/40 text-accent',
  System: 'border-rule text-ink-muted',
}

type Tab = 'All' | 'SMS' | 'Email' | 'System'
const TABS: Tab[] = ['All', 'SMS', 'Email', 'System']

export default function Notifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('All')

  useEffect(() => {
    api.notifications
      .list()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageListSkeleton label="Loading notifications" rows={5} />

  const filtered = tab === 'All' ? items : items.filter((n) => n.channel === tab)
  const unread = items.filter((n) => !n.read).length

  const markAll = () => {
    api.notifications.markAllRead().then(() => {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    })
  }

  // Delivery targets come from the signed-in student's own profile.
  const phone = user?.profile?.phone || 'No phone number on file'
  const email = user?.email || 'No email on file'

  const channels = [
    { icon: Smartphone, label: 'SMS alerts', sub: `Hubtel · ${phone}`, on: true, primary: true },
    { icon: Mail, label: 'Email alerts', sub: email, on: true },
    { icon: Bell, label: 'In-app alerts', sub: 'Shown on your dashboard', on: true },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div className="min-w-0">
          <p className="t-overline text-accent">Alerts</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="t-h1 text-ink">Notifications</h1>
            {unread > 0 && <Badge tone="accent">{unread} new</Badge>}
          </div>
          <p className="t-body mt-2 max-w-prose text-ink-muted">
            Deadline, status and interview alerts, delivered SMS-first for low-bandwidth districts.
          </p>
        </div>
        {unread > 0 && (
          <Button variant="subtle" onClick={markAll} icon={<CheckCheck className="h-4 w-4" />}>
            Mark all read
          </Button>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            items={TABS.map((t) => ({
              value: t,
              label: t,
              count: t === 'All' ? items.length : items.filter((n) => n.channel === t).length,
            }))}
            className="max-w-full overflow-x-auto"
          />

          {filtered.length > 0 ? (
            <motion.ul
              initial="hidden"
              animate="show"
              variants={stagger(0, 0.04)}
              className="rule-list overflow-hidden rounded-md border border-rule bg-surface"
            >
              {filtered.map((n) => {
                const ChIcon = channelIcon[n.channel]
                const CatIcon = catIcon[n.category]
                return (
                  <motion.li
                    key={n.id}
                    variants={listItem}
                    className={cn('relative flex gap-4 px-4 py-4 sm:px-5', !n.read && 'bg-accent-soft/40')}
                  >
                    {/* Unread reads as a gold edge rather than a dot */}
                    {!n.read && (
                      <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden />
                    )}
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-sm border',
                        catTone[n.category],
                      )}
                      aria-hidden
                    >
                      <CatIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={cn(
                            'text-sm leading-snug',
                            n.read ? 'font-medium text-ink-secondary' : 'font-semibold text-ink',
                          )}
                        >
                          {n.title}
                        </p>
                        <span className="tabular t-xs shrink-0 text-ink-muted">{n.time}</span>
                      </div>
                      <p className="t-sm mt-1.5 leading-relaxed text-ink-muted">{n.body}</p>
                      <p className="t-xs mt-2.5 flex items-center gap-1.5 font-medium text-ink-faint">
                        <ChIcon className="h-3.5 w-3.5" aria-hidden />
                        Sent via {n.channel}
                        {!n.read && <span className="ml-1 font-bold text-accent">· Unread</span>}
                      </p>
                    </div>
                  </motion.li>
                )
              })}
            </motion.ul>
          ) : (
            <EmptyState
              icon={<Inbox />}
              title={items.length === 0 ? 'No notifications yet' : `Nothing sent via ${tab}`}
              description={
                items.length === 0
                  ? 'Deadline reminders, status changes and interview invitations will land here.'
                  : 'Try a different channel to see the rest of your alerts.'
              }
              action={
                items.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab('All')}
                    className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
                  >
                    Show all channels
                  </button>
                ) : undefined
              }
            />
          )}
        </div>

        {/* Preferences rail */}
        <div className="space-y-6">
          <Card as="section">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="t-h3 text-ink">Delivery channels</h2>
              <p className="t-sm mt-1 text-ink-muted">
                SMS is the primary channel, tuned for low-bandwidth districts.
              </p>
            </div>
            <ul className="rule-list">
              {channels.map((c) => (
                <li key={c.label} className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-rule text-ink-secondary"
                    aria-hidden
                  >
                    <c.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[0.8125rem] font-semibold text-ink">{c.label}</p>
                      {c.primary && <Badge tone="accent">Primary</Badge>}
                    </div>
                    <p className="t-xs truncate text-ink-muted">{c.sub}</p>
                  </div>
                  <span
                    className={cn(
                      'relative h-5 w-9 shrink-0 rounded-full',
                      c.on ? 'bg-accent' : 'bg-rule-strong',
                    )}
                    role="img"
                    aria-label={c.on ? `${c.label} on` : `${c.label} off`}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-[left]',
                        c.on ? 'left-[1.125rem]' : 'left-0.5',
                      )}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card as="section">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="t-h3 text-ink">Alert types</h2>
            </div>
            <ul className="rule-list">
              {[
                { label: 'Deadline reminders', sub: '7 and 2 days before close' },
                { label: 'Interview schedules', sub: 'As soon as a slot is set' },
                { label: 'Application status', sub: 'When a reviewer updates' },
                { label: 'New matches', sub: 'When criteria change' },
              ].map((a) => (
                <li key={a.label} className="px-5 py-3.5">
                  <Checkbox defaultChecked label={a.label} hint={a.sub} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
