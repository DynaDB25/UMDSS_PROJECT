import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  User,
  GraduationCap,
  Bell,
  Shield,
  Globe,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Save,
  ChevronRight,
  Eye,
  EyeOff,
  Key,
  Smartphone,
  Lock,
} from 'lucide-react'
import { Card, Avatar, Badge, Progress } from '../components/ui'
import { GHANA_REGIONS } from '../data/mock'
import { ProgrammeSelect } from '../components/ProgrammeSelect'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { cn } from '../lib/cn'

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'academic', label: 'Academic', icon: GraduationCap },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
] as const

type Tab = (typeof tabs)[number]['id']

function FieldRow({
  label,
  children,
  sub,
}: {
  label: string
  children: React.ReactNode
  sub?: string
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-3 sm:items-center">
      <div>
        <p className="text-sm font-medium text-ink-700">{label}</p>
        {sub && <p className="text-xs text-ink-400">{sub}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  )
}

const inputCls =
  'h-10 w-full rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm text-ink-700 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'
const selectCls =
  'h-10 w-full rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm text-ink-700 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 appearance-none'

export default function Settings() {
  const { user, setUser } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
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
    const formData = new FormData(e.target as HTMLFormElement)
    const payload = {
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      profile: {
        phone: formData.get('phone'),
        home_district: formData.get('home_district'),
        region: formData.get('region'),
        institution: formData.get('institution'),
        programme: formData.get('programme'),
        student_id: formData.get('student_id'),
        level: formData.get('level'),
        wassce_aggregate: Number(formData.get('wassce_aggregate')),
      }
    }

    try {
      const updatedUser = await api.auth.updateMe(payload)
      setUser(updatedUser)
      setSavedMsg('Changes saved')
      setTimeout(() => setSavedMsg(''), 2500)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-brand-600" />
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Settings</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar tabs */}
        <div className="space-y-2 lg:col-span-1">
          <Card className="p-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  tab === t.id
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                <t.icon
                  className={cn('h-[18px] w-[18px]', tab === t.id ? 'text-brand-600' : 'text-ink-400')}
                />
                {t.label}
                <ChevronRight className="ml-auto h-4 w-4 text-ink-300" />
              </button>
            ))}
          </Card>

          {/* Profile completion */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Avatar initials={`${user.first_name[0]}${user.last_name[0]}`} className="h-12 w-12 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-800">{user.first_name} {user.last_name}</p>
                <p className="truncate text-xs text-ink-400">{user.profile?.student_id}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-600">Profile completion</span>
                <span className="font-semibold text-brand-700">{user.profile?.profile_completion || 0}%</span>
              </div>
              <Progress value={user.profile?.profile_completion || 0} className="mt-1.5" />
              <p className="mt-1.5 text-[11px] text-ink-400">
                Add a leadership essay to reach 100%
              </p>
            </div>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'profile' && (
              <form onSubmit={handleSave}>
                <Card className="divide-y divide-ink-200/70">
                  <div className="p-5 sm:p-6">
                    <h2 className="font-display text-lg font-bold text-ink-900">Personal information</h2>
                    <p className="mt-1 text-sm text-ink-500">
                      This data is shared with scholarship providers when you apply.
                    </p>
                  </div>
                  <div className="space-y-5 p-5 sm:p-6">
                    <FieldRow label="First name">
                      <input name="first_name" className={inputCls} defaultValue={user.first_name} />
                    </FieldRow>
                    <FieldRow label="Last name">
                      <input name="last_name" className={inputCls} defaultValue={user.last_name} />
                    </FieldRow>
                    <FieldRow label="Email" sub="Institutional email preferred">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                        <input disabled className={cn(inputCls, 'pl-9')} defaultValue={user.email} />
                      </div>
                    </FieldRow>
                    <FieldRow label="Phone" sub="Used for SMS notifications">
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                        <input name="phone" className={cn(inputCls, 'pl-9')} defaultValue={user.profile?.phone} />
                      </div>
                    </FieldRow>
                    <FieldRow label="Home region">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                        <select name="region" className={cn(selectCls, 'pl-9')} defaultValue={user.profile?.region}>
                          {GHANA_REGIONS.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </FieldRow>
                    <FieldRow label="Home district">
                      <input name="home_district" className={inputCls} defaultValue={user.profile?.home_district} />
                    </FieldRow>
                  </div>
                  <div className="flex items-center justify-end gap-3 p-5 sm:p-6">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </Card>
              </form>
            )}

            {tab === 'academic' && (
              <form onSubmit={handleSave}>
                <Card className="divide-y divide-ink-200/70">
                  <div className="p-5 sm:p-6">
                    <h2 className="font-display text-lg font-bold text-ink-900">Academic details</h2>
                    <p className="mt-1 text-sm text-ink-500">
                      Used to match you with eligible scholarships.
                    </p>
                  </div>
                  <div className="space-y-5 p-5 sm:p-6">
                    <FieldRow label="Institution">
                      <input name="institution" className={inputCls} defaultValue={user.profile?.institution} />
                    </FieldRow>
                    <FieldRow label="Student ID">
                      <input name="student_id" className={inputCls} defaultValue={user.profile?.student_id} />
                    </FieldRow>
                    <FieldRow label="Programme">
                      <ProgrammeSelect
                        key={user.profile?.programme ?? ''}
                        value={programme}
                        onChange={setProgramme}
                        name="programme"
                        className={selectCls}
                      />
                    </FieldRow>
                    <FieldRow label="Level">
                      <input name="level" className={inputCls} defaultValue={user.profile?.level} />
                    </FieldRow>
                    <FieldRow label="WASSCE aggregate" sub="Best aggregate score (6 is highest)">
                      <input
                        name="wassce_aggregate"
                        type="number"
                        min={6}
                        max={36}
                        className={inputCls}
                        defaultValue={user.profile?.wassce_aggregate}
                      />
                    </FieldRow>
                  </div>
                  <div className="flex items-center justify-end gap-3 p-5 sm:p-6">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                    >
                      <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </Card>
              </form>
            )}

            {tab === 'notifications' && (
              <Card className="divide-y divide-ink-200/70">
                <div className="p-5 sm:p-6">
                  <h2 className="font-display text-lg font-bold text-ink-900">
                    Notification preferences
                  </h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Choose how and when you receive alerts.
                  </p>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-ink-800">Channels</h3>
                  {[
                    { icon: Smartphone, label: 'SMS alerts', sub: 'Primary channel for low-bandwidth areas', on: true },
                    { icon: Mail, label: 'Email alerts', sub: user.email, on: true },
                    { icon: Bell, label: 'In-app notifications', sub: 'Shown on your dashboard', on: true },
                  ].map((ch) => (
                    <div key={ch.label} className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <ch.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-800">{ch.label}</p>
                        <p className="text-xs text-ink-400">{ch.sub}</p>
                      </div>
                      <label className="relative inline-flex cursor-pointer">
                        <input type="checkbox" defaultChecked={ch.on} className="peer sr-only" />
                        <div className="peer h-6 w-11 rounded-full bg-ink-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-brand-600 peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  ))}

                  <div className="pt-3">
                    <h3 className="text-sm font-semibold text-ink-800">Alert types</h3>
                    <div className="mt-3 space-y-3">
                      {[
                        { label: 'Deadline reminders', sub: '7 and 2 days before close' },
                        { label: 'Interview schedules', sub: 'As soon as a slot is set' },
                        { label: 'Application status changes', sub: 'When a reviewer updates' },
                        { label: 'New scholarship matches', sub: 'When criteria change' },
                        { label: 'System announcements', sub: 'Platform updates and maintenance' },
                      ].map((a) => (
                        <label key={a.label} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-ink-700">{a.label}</p>
                            <p className="text-xs text-ink-400">{a.sub}</p>
                          </div>
                          <input
                            type="checkbox"
                            defaultChecked
                            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-5 sm:p-6">
                  {savedMsg && <Badge tone="green">{savedMsg}</Badge>}
                  <button
                    type="button"
                    onClick={handlePrefsSave}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                  >
                    <Save className="h-4 w-4" /> Save changes
                  </button>
                </div>
              </Card>
            )}

            {tab === 'security' && (
              <div className="space-y-6">
                <form onSubmit={handleChangePassword}>
                  <Card className="divide-y divide-ink-200/70">
                    <div className="p-5 sm:p-6">
                      <h2 className="font-display text-lg font-bold text-ink-900">Password</h2>
                      <p className="mt-1 text-sm text-ink-500">
                        Update your password regularly to keep your account secure.
                      </p>
                    </div>
                    <div className="space-y-5 p-5 sm:p-6">
                      <FieldRow label="Current password">
                        <div className="relative">
                          <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                          <input
                            type="password"
                            value={pw.current}
                            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                            className={cn(inputCls, 'pl-9')}
                            placeholder="Enter current password"
                          />
                        </div>
                      </FieldRow>
                      <FieldRow label="New password">
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                          <input
                            type="password"
                            value={pw.next}
                            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                            className={cn(inputCls, 'pl-9')}
                            placeholder="At least 8 characters"
                          />
                        </div>
                      </FieldRow>
                      <FieldRow label="Confirm password">
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                          <input
                            type="password"
                            value={pw.confirm}
                            onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                            className={cn(inputCls, 'pl-9')}
                            placeholder="Re-enter new password"
                          />
                        </div>
                      </FieldRow>
                      {pwMsg && (
                        <p className={cn('text-sm font-medium', pwMsg.ok ? 'text-emerald-600' : 'text-rose-600')}>
                          {pwMsg.text}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-3 p-5 sm:p-6">
                      <button
                        type="submit"
                        disabled={pwSaving || !pw.current || !pw.next}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" /> {pwSaving ? 'Updating…' : 'Update password'}
                      </button>
                    </div>
                  </Card>
                </form>

                <Card className="divide-y divide-ink-200/70">
                  <div className="p-5 sm:p-6">
                    <h2 className="font-display text-lg font-bold text-ink-900">
                      Two-factor authentication
                    </h2>
                    <p className="mt-1 text-sm text-ink-500">
                      Add an extra layer of security to your account.
                    </p>
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-4 rounded-xl border border-ink-200/70 p-4">
                      <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Smartphone className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-ink-800">SMS verification</p>
                          <Badge tone="green">Active</Badge>
                        </div>
                        <p className="text-xs text-ink-400">
                          Codes sent to {user.profile?.phone}
                        </p>
                      </div>
                      <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50">
                        Configure
                      </button>
                    </div>
                  </div>
                </Card>

                <Card className="divide-y divide-ink-200/70">
                  <div className="p-5 sm:p-6">
                    <h2 className="font-display text-lg font-bold text-ink-900">Active sessions</h2>
                  </div>
                  <div className="space-y-3 p-5 sm:p-6">
                    {[
                      { device: 'Chrome · Windows', location: 'Kumasi, Ghana', current: true, time: 'Now' },
                      { device: 'Mobile App · Android', location: 'Kumasi, Ghana', current: false, time: '2 hours ago' },
                    ].map((s) => (
                      <div key={s.device} className="flex items-center gap-3 rounded-xl border border-ink-200/70 p-3.5">
                        <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-100 text-ink-500">
                          <Globe className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-ink-800">{s.device}</p>
                            {s.current && <Badge tone="green">This device</Badge>}
                          </div>
                          <p className="text-xs text-ink-400">{s.location} · {s.time}</p>
                        </div>
                        {!s.current && (
                          <button className="text-xs font-medium text-rose-600 hover:text-rose-700">
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
