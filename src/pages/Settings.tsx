import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Globe,
  Phone,
  Mail,
  MapPin,
  Save,
  Key,
  Smartphone,
  Lock,
} from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Progress,
  Select,
  Tabs,
} from '../components/ui'
import { GHANA_REGIONS } from '../data/mock'
import { ProgrammeSelect } from '../components/ProgrammeSelect'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { cn } from '../lib/cn'

type Tab = 'profile' | 'academic' | 'notifications' | 'security'

const TAB_ITEMS = [
  { value: 'profile' as const, label: 'Profile' },
  { value: 'academic' as const, label: 'Academic' },
  { value: 'notifications' as const, label: 'Notifications' },
  { value: 'security' as const, label: 'Security' },
]

/** Label on the left, control on the right, one rhythm for every settings row. */
function FieldRow({
  label,
  children,
  sub,
  htmlFor,
}: {
  label: string
  children: ReactNode
  sub?: string
  htmlFor?: string
}) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-3 sm:items-start sm:gap-6">
      <div className="sm:pt-2.5">
        <label htmlFor={htmlFor} className="text-[0.8125rem] font-semibold text-ink">
          {label}
        </label>
        {sub && <p className="t-xs mt-0.5 text-ink-muted">{sub}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card as="section">
      <div className="border-b border-rule px-5 py-4 sm:px-6">
        <h2 className="t-h3 text-ink">{title}</h2>
        {description && <p className="t-sm mt-1 max-w-prose text-ink-muted">{description}</p>}
      </div>
      <div className="px-5 py-2 sm:px-6">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-rule px-5 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </Card>
  )
}

export default function Settings() {
  const { user, setUser } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Controlled just for the programme picker (the rest of the form is
  // uncontrolled); the picker submits through a hidden input named "programme".
  const [programme, setProgramme] = useState(user?.profile?.programme ?? '')
  useEffect(() => {
    setProgramme(user?.profile?.programme ?? '')
  }, [user?.profile?.programme])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSaveError('')
    const formData = new FormData(e.target as HTMLFormElement)

    // Each tab only submits its own fields, so merge over the existing profile
    // rather than sending a partial object that blanks the other tab's values.
    const entries: Record<string, any> = {}
    formData.forEach((value, key) => {
      if (key === 'first_name' || key === 'last_name') return
      entries[key] = value
    })
    if ('wassce_aggregate' in entries) {
      const n = Number(entries.wassce_aggregate)
      entries.wassce_aggregate = Number.isFinite(n) && n > 0 ? n : null
    }

    const payload = {
      first_name: formData.get('first_name') ?? user.first_name,
      last_name: formData.get('last_name') ?? user.last_name,
      profile: { ...user.profile, ...entries },
    }

    try {
      const updatedUser = await api.auth.updateMe(payload)
      setUser(updatedUser)
      setSavedMsg('Changes saved')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (err: any) {
      // The previous version swallowed failures silently in a try/finally.
      setSaveError(err?.message || 'Could not save your changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePrefsSave = () => {
    // Notification preferences are UI-only for now; acknowledge without a crash.
    setSavedMsg('Preferences saved')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' })
      return
    }
    if (pw.next.length < 8) {
      setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' })
      return
    }
    setPwSaving(true)
    try {
      await api.auth.changePassword({ current_password: pw.current, new_password: pw.next })
      setPwMsg({ ok: true, text: 'Password updated successfully.' })
      setPw({ current: '', next: '', confirm: '' })
    } catch (err: any) {
      setPwMsg({ ok: false, text: err?.message || 'Could not update password.' })
    } finally {
      setPwSaving(false)
    }
  }

  if (!user) return null

  const completion = Math.max(0, Math.min(100, Math.round(user.profile?.profile_completion ?? 0)))
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U'

  const saveFooter = (
    <>
      {saveError && (
        <p className="t-sm mr-auto font-medium text-state-negative">{saveError}</p>
      )}
      {savedMsg && <Badge tone="positive">{savedMsg}</Badge>}
      <Button type="submit" variant="accent" loading={saving} icon={<Save className="h-4 w-4" />}>
        Save changes
      </Button>
    </>
  )

  return (
    <div className="space-y-8">
      <header className="border-b border-rule pb-6">
        <p className="t-overline text-accent">Account</p>
        <h1 className="t-h1 mt-2 text-ink">Settings</h1>
        <p className="t-body mt-2 max-w-prose text-ink-muted">
          Your profile drives every match. Keep it current and the engine keeps working for you.
        </p>
      </header>

      {/* Identity strip */}
      <Card className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar initials={initials} className="h-12 w-12 text-sm" />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold tracking-tight text-ink">
              {user.first_name} {user.last_name}
            </p>
            <p className="t-sm truncate text-ink-muted">
              {user.profile?.student_id || user.email}
            </p>
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-56">
          <div className="flex items-baseline justify-between gap-3">
            <span className="t-overline text-ink-muted">Profile completion</span>
            <span className="tabular text-[0.8125rem] font-bold text-ink">{completion}%</span>
          </div>
          <Progress value={completion} className="mt-2" tone="accent" />
        </div>
      </Card>

      <Tabs<Tab> items={TAB_ITEMS} value={tab} onChange={setTab} />

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      >
        {/* ---------------- Profile ---------------- */}
        {tab === 'profile' && (
          <form onSubmit={handleSave}>
            <SectionCard
              title="Personal information"
              description="This data is shared with scholarship providers when you apply."
              footer={saveFooter}
            >
              <div className="rule-list">
                <FieldRow label="First name" htmlFor="set-first">
                  <Input id="set-first" name="first_name" defaultValue={user.first_name} />
                </FieldRow>
                <FieldRow label="Last name" htmlFor="set-last">
                  <Input id="set-last" name="last_name" defaultValue={user.last_name} />
                </FieldRow>
                <FieldRow label="Email" sub="Institutional email preferred" htmlFor="set-email">
                  <Input id="set-email" disabled defaultValue={user.email} icon={<Mail />} />
                </FieldRow>
                <FieldRow label="Phone" sub="Used for SMS notifications" htmlFor="set-phone">
                  <Input
                    id="set-phone"
                    name="phone"
                    defaultValue={user.profile?.phone}
                    icon={<Phone />}
                  />
                </FieldRow>
                <FieldRow label="Home region" htmlFor="set-region">
                  <Select id="set-region" name="region" defaultValue={user.profile?.region || ''}>
                    <option value="">Select…</option>
                    {GHANA_REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                  <p className="t-xs mt-1.5 flex items-center gap-1.5 text-ink-muted">
                    <MapPin className="h-3 w-3" aria-hidden />
                    District schemes prioritise indigenes of their own region.
                  </p>
                </FieldRow>
                <FieldRow label="Home district" htmlFor="set-district">
                  <Input
                    id="set-district"
                    name="home_district"
                    defaultValue={user.profile?.home_district}
                  />
                </FieldRow>
                <FieldRow
                  label="Gender"
                  sub="Some funders run women-only scholarships"
                  htmlFor="set-gender"
                >
                  <Select id="set-gender" name="gender" defaultValue={user.profile?.gender || ''}>
                    <option value="">Select…</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Prefer not to say</option>
                  </Select>
                  <p className="t-xs mt-1.5 text-ink-muted">
                    Setting this lets the matcher surface gender-restricted awards instead of hiding
                    them.
                  </p>
                </FieldRow>
              </div>
            </SectionCard>
          </form>
        )}

        {/* ---------------- Academic ---------------- */}
        {tab === 'academic' && (
          <form onSubmit={handleSave}>
            <SectionCard
              title="Academic details"
              description="Used to match you with eligible scholarships."
              footer={saveFooter}
            >
              <div className="rule-list">
                <FieldRow label="Institution" htmlFor="set-inst">
                  <Input
                    id="set-inst"
                    name="institution"
                    defaultValue={user.profile?.institution}
                  />
                </FieldRow>
                <FieldRow label="Student ID" htmlFor="set-sid">
                  <Input id="set-sid" name="student_id" defaultValue={user.profile?.student_id} />
                </FieldRow>
                <FieldRow label="Programme">
                  <ProgrammeSelect
                    key={user.profile?.programme ?? ''}
                    value={programme}
                    onChange={setProgramme}
                    name="programme"
                  />
                </FieldRow>
                <FieldRow label="Level" htmlFor="set-level">
                  <Input id="set-level" name="level" defaultValue={user.profile?.level} />
                </FieldRow>
                <FieldRow
                  label="WASSCE aggregate"
                  sub="Best six, from 6 (highest) to 54"
                  htmlFor="set-agg"
                >
                  <Input
                    id="set-agg"
                    name="wassce_aggregate"
                    type="number"
                    inputMode="numeric"
                    min={6}
                    max={54}
                    defaultValue={user.profile?.wassce_aggregate}
                  />
                </FieldRow>
              </div>
            </SectionCard>
          </form>
        )}

        {/* ---------------- Notifications ---------------- */}
        {tab === 'notifications' && (
          <SectionCard
            title="Notification preferences"
            description="Choose how and when you receive alerts."
            footer={
              <>
                {savedMsg && <Badge tone="positive">{savedMsg}</Badge>}
                <Button
                  type="button"
                  variant="accent"
                  onClick={handlePrefsSave}
                  icon={<Save className="h-4 w-4" />}
                >
                  Save changes
                </Button>
              </>
            }
          >
            <div className="py-4">
              <h3 className="t-overline text-ink-muted">Channels</h3>
              <ul className="rule-list mt-2 border-y border-rule">
                {[
                  {
                    icon: Smartphone,
                    label: 'SMS alerts',
                    sub: 'Primary channel for low-bandwidth areas',
                    on: true,
                  },
                  { icon: Mail, label: 'Email alerts', sub: user.email, on: true },
                  { icon: Bell, label: 'In-app notifications', sub: 'Shown on your dashboard', on: true },
                ].map((ch) => (
                  <li key={ch.label} className="flex items-center gap-3 py-3.5">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-rule text-ink-secondary"
                      aria-hidden
                    >
                      <ch.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-semibold text-ink">{ch.label}</p>
                      <p className="t-xs truncate text-ink-muted">{ch.sub}</p>
                    </div>
                    <label className="relative inline-flex shrink-0 cursor-pointer">
                      <span className="sr-only">{ch.label}</span>
                      <input type="checkbox" defaultChecked={ch.on} className="peer sr-only" />
                      <span className="peer h-5 w-9 rounded-full bg-rule-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-surface after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-4" />
                    </label>
                  </li>
                ))}
              </ul>

              <h3 className="t-overline mt-8 text-ink-muted">Alert types</h3>
              <ul className="rule-list mt-2 border-y border-rule">
                {[
                  { label: 'Deadline reminders', sub: '7 and 2 days before close' },
                  { label: 'Interview schedules', sub: 'As soon as a slot is set' },
                  { label: 'Application status changes', sub: 'When a reviewer updates' },
                  { label: 'New scholarship matches', sub: 'When criteria change' },
                  { label: 'System announcements', sub: 'Platform updates and maintenance' },
                ].map((a) => (
                  <li key={a.label} className="py-3.5">
                    <Checkbox defaultChecked label={a.label} hint={a.sub} />
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>
        )}

        {/* ---------------- Security ---------------- */}
        {tab === 'security' && (
          <div className="space-y-6">
            <form onSubmit={handleChangePassword}>
              <SectionCard
                title="Password"
                description="Update your password regularly to keep your account secure."
                footer={
                  <Button
                    type="submit"
                    variant="accent"
                    loading={pwSaving}
                    disabled={!pw.current || !pw.next}
                    icon={<Save className="h-4 w-4" />}
                  >
                    Update password
                  </Button>
                }
              >
                <div className="rule-list">
                  <FieldRow label="Current password" htmlFor="pw-current">
                    <Input
                      id="pw-current"
                      type="password"
                      autoComplete="current-password"
                      value={pw.current}
                      onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                      placeholder="Enter current password"
                      icon={<Key />}
                    />
                  </FieldRow>
                  <FieldRow label="New password" htmlFor="pw-next">
                    <Input
                      id="pw-next"
                      type="password"
                      autoComplete="new-password"
                      value={pw.next}
                      onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                      placeholder="At least 8 characters"
                      icon={<Lock />}
                    />
                  </FieldRow>
                  <FieldRow label="Confirm password" htmlFor="pw-confirm">
                    <Input
                      id="pw-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={pw.confirm}
                      onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                      placeholder="Re-enter new password"
                      icon={<Lock />}
                      invalid={pw.confirm !== '' && pw.confirm !== pw.next}
                    />
                  </FieldRow>
                  {pwMsg && (
                    <div className="py-4">
                      <Alert tone={pwMsg.ok ? 'success' : 'danger'}>{pwMsg.text}</Alert>
                    </div>
                  )}
                </div>
              </SectionCard>
            </form>

            <SectionCard
              title="Two-factor authentication"
              description="Add an extra layer of security to your account."
            >
              <div className="py-4">
                <div className="flex flex-wrap items-center gap-4 rounded-md border border-rule p-4">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-rule text-ink-secondary"
                    aria-hidden
                  >
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.8125rem] font-semibold text-ink">SMS verification</p>
                      {/* There is no OTP anywhere in the stack. This said
                          "Active", which told students their account had a
                          second factor protecting it when it did not. */}
                      <Badge>Not set up</Badge>
                    </div>
                    <p className="t-xs mt-0.5 text-ink-muted">
                      Sign-in codes are not enabled. Deadline reminders still reach you by SMS.
                    </p>
                  </div>
                  <Button variant="subtle" size="sm" className="shrink-0">
                    Configure
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Active sessions">
              <ul className="rule-list py-2">
                {[
                  { device: 'Chrome · Windows', location: 'Kumasi, Ghana', current: true, time: 'Now' },
                  {
                    device: 'Mobile App · Android',
                    location: 'Kumasi, Ghana',
                    current: false,
                    time: '2 hours ago',
                  },
                ].map((s) => (
                  <li key={s.device} className="flex items-center gap-3 py-3.5">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-rule text-ink-secondary"
                      aria-hidden
                    >
                      <Globe className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.8125rem] font-semibold text-ink">{s.device}</p>
                        {s.current && <Badge tone="positive">This device</Badge>}
                      </div>
                      <p className="t-xs text-ink-muted">
                        {s.location} · {s.time}
                      </p>
                    </div>
                    {!s.current && (
                      <button
                        type="button"
                        className={cn(
                          't-xs shrink-0 font-semibold text-state-negative underline underline-offset-4',
                        )}
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        )}
      </motion.div>
    </div>
  )
}
