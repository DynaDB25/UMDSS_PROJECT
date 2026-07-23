import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { api } from '../api/endpoints'
import {
  ShieldCheck,
  BookOpen,
  Users,
  ClipboardList,
  Wallet,
  ArrowUpRight,
  Search,
  Download,
  ArrowLeft,
  BarChart3,
  PieChart,
  Plus,
  X,
} from 'lucide-react'
import { Card, StatusPill } from '../components/ui'
import { cn } from '../lib/cn'

const statusFilter = ['All', 'Submitted', 'Under Review', 'Interview', 'Awarded', 'Rejected'] as const

const statusColors: Record<string, string> = {
  Draft: 'bg-ink-300',
  Submitted: 'bg-brand-400',
  'Under Review': 'bg-amber-400',
  Interview: 'bg-violet-500',
  Awarded: 'bg-emerald-500',
  Rejected: 'bg-rose-400',
}

const regionColors = ['bg-brand-600', 'bg-brand-400', 'bg-amber-500', 'bg-violet-500', 'bg-emerald-500', 'bg-ink-300']

const providerTypes = ['Government', 'Corporate', 'International', 'Foundation']
const levelScopes: [string, string][] = [
  ['tertiary_any', 'Any undergraduate'],
  ['tertiary_entry', 'Entering tertiary (SHS grads / L100)'],
  ['tertiary_continuing', 'Continuing tertiary'],
  ['shs', 'SHS students'],
  ['postgraduate', 'Postgraduate'],
  ['unknown', 'Not classified'],
]

const emptyForm = {
  name: '',
  provider: '',
  provider_type: 'Foundation',
  amount: '',
  deadline: '',
  region: '',
  programmes: '',
  level_scope: 'tertiary_any',
  summary: '',
}

export default function Admin() {
  const [statusTab, setStatusTab] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [adminStats, setAdminStats] = useState<any>({
    totalScholarships: 0,
    verifiedScholarships: 0,
    activeApplicants: 0,
    registeredUsers: 0,
    applicationsThisCycle: 0,
    awardsDisbursed: '0',
    byStatus: [],
    byRegion: [],
  })
  const [adminApplications, setAdminApplications] = useState<any[]>([])

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [addedNote, setAddedNote] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([api.admin.stats(), api.admin.applications()])
      .then(([stats, apps]) => {
        setAdminStats(stats)
        setAdminApplications(apps as any[])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const byStatus: { status: string; count: number }[] = adminStats.byStatus || []
  const byRegion: { region: string; count: number }[] = adminStats.byRegion || []
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count))
  const totalRegion = byRegion.reduce((s, r) => s + r.count, 0)
  const interviews = byStatus.find((s) => s.status === 'Interview')?.count || 0
  const awarded = byStatus.find((s) => s.status === 'Awarded')?.count || 0

  const stats = [
    { label: 'Total scholarships', value: String(adminStats.totalScholarships), icon: BookOpen, tone: 'bg-brand-50 text-brand-700', sub: `${adminStats.verifiedScholarships} verified sources` },
    { label: 'Active applicants', value: Number(adminStats.activeApplicants).toLocaleString(), icon: Users, tone: 'bg-violet-50 text-violet-700', sub: `${Number(adminStats.registeredUsers).toLocaleString()} registered` },
    { label: 'Applications', value: Number(adminStats.applicationsThisCycle).toLocaleString(), icon: ClipboardList, tone: 'bg-amber-50 text-amber-700', sub: `${interviews} in interview` },
    { label: 'Awards disbursed', value: adminStats.awardsDisbursed, icon: Wallet, tone: 'bg-emerald-50 text-emerald-700', sub: `across ${awarded} award${awarded === 1 ? '' : 's'}` },
  ]

  const filteredApps = adminApplications.filter((a) => {
    const matchesStatus = statusTab === 'All' || a.status === statusTab
    const matchesSearch =
      !search ||
      a.student.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      a.scholarship.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const exportCsv = () => {
    const headers = ['ID', 'Student', 'Programme', 'Scholarship', 'Aggregate', 'Region', 'Status']
    const rows = filteredApps.map((a) => [a.id, a.student, a.programme, a.scholarship, a.aggregate, a.region, a.status])
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scholarcircle-applications-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.provider.trim()) {
      setFormError('Name and provider are both required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const created: any = await api.admin.createScholarship(form)
      setShowAdd(false)
      setForm(emptyForm)
      setAddedNote(`Added “${created?.name || form.name}”.`)
      load()
      setTimeout(() => setAddedNote(''), 5000)
    } catch (err: any) {
      setFormError(err?.message || 'Could not add the scholarship. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-ink-50 text-ink-500">Loading admin console…</div>

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-ink-900">Admin Console</h1>
              <p className="text-sm text-ink-500">Scholarship management dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={filteredApps.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-ink-700 ring-1 ring-inset ring-ink-200 transition hover:bg-ink-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              onClick={() => {
                setForm(emptyForm)
                setFormError('')
                setShowAdd(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" /> Add Scholarship
            </button>
          </div>
        </div>

        {addedNote && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {addedNote}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div className={cn('grid h-10 w-10 place-items-center rounded-xl', s.tone)}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-300" />
                </div>
                <p className="mt-4 font-display text-2xl font-extrabold text-ink-900">{s.value}</p>
                <p className="text-sm text-ink-500">{s.label}</p>
                <p className="mt-1 text-xs font-medium text-ink-400">{s.sub}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Applications by status */}
          <Card className="p-5 sm:p-6 lg:col-span-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              <h2 className="font-display text-lg font-bold text-ink-900">Applications by status</h2>
            </div>
            {adminStats.applicationsThisCycle === 0 ? (
              <p className="mt-8 text-center text-sm text-ink-400">No applications yet.</p>
            ) : (
              <div className="mt-6 flex items-end gap-3" style={{ height: 200 }}>
                {byStatus.map((d) => (
                  <div key={d.status} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full items-end justify-center" style={{ height: 160 }}>
                      <div
                        className={cn('w-full max-w-[46px] rounded-t-md transition-all duration-500', statusColors[d.status] || 'bg-ink-300')}
                        style={{ height: `${Math.max(d.count === 0 ? 0 : 6, (d.count / maxStatus) * 100)}%` }}
                        title={`${d.count} ${d.status}`}
                      />
                    </div>
                    <span className="font-display text-sm font-bold text-ink-800">{d.count}</span>
                    <span className="text-center text-[11px] font-medium leading-tight text-ink-400">{d.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* By region */}
          <Card className="p-5 sm:p-6 lg:col-span-2">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-brand-600" />
              <h2 className="font-display text-lg font-bold text-ink-900">Applicants by region</h2>
            </div>

            {totalRegion === 0 ? (
              <p className="mt-8 text-center text-sm text-ink-400">No region data yet.</p>
            ) : (
              <>
                <div className="mt-6 flex h-6 overflow-hidden rounded-full">
                  {byRegion.map((r, i) => (
                    <div
                      key={r.region}
                      className={cn('transition-all duration-500', regionColors[i % regionColors.length])}
                      style={{ width: `${(r.count / totalRegion) * 100}%` }}
                      title={`${r.region}: ${r.count}`}
                    />
                  ))}
                </div>

                <div className="mt-5 space-y-2.5">
                  {byRegion.map((r, i) => (
                    <div key={r.region} className="flex items-center gap-2.5">
                      <span className={cn('h-3 w-3 rounded-full', regionColors[i % regionColors.length])} />
                      <span className="flex-1 text-sm text-ink-600">{r.region}</span>
                      <span className="text-sm font-semibold text-ink-800">{r.count.toLocaleString()}</span>
                      <span className="w-12 text-right text-xs text-ink-400">{((r.count / totalRegion) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Applications table */}
        <div className="mt-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-ink-900">All applications</h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students…"
                  className="h-9 w-56 rounded-lg border border-ink-200 bg-ink-50 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-ink-200/70 px-5 py-3 sm:px-6">
              {statusFilter.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusTab(f)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    statusTab === f ? 'bg-brand-700 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200/70 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-3 sm:px-6">ID</th>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Programme</th>
                    <th className="px-3 py-3">Scholarship</th>
                    <th className="px-3 py-3 text-center">Agg.</th>
                    <th className="px-3 py-3">Region</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200/50">
                  {filteredApps.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.02 }}
                      className="transition hover:bg-ink-50/60"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-brand-700 sm:px-6">{a.id}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-medium text-ink-800">{a.student}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-ink-600">{a.programme}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-ink-600">{a.scholarship}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-semibold text-ink-700">{a.aggregate}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-ink-600">{a.region}</td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <StatusPill status={a.status} />
                      </td>
                    </motion.tr>
                  ))}
                  {filteredApps.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-ink-400">
                        {adminApplications.length === 0 ? 'No applications have been submitted yet.' : 'No applications match your filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-ink-200/70 px-5 py-3 text-xs text-ink-400 sm:px-6">
              Showing {filteredApps.length} of {adminApplications.length} applications
            </div>
          </Card>
        </div>
      </div>

      {/* Add Scholarship modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => !saving && setShowAdd(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ink-200/70 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-ink-900">Add a scholarship</h3>
              <button onClick={() => setShowAdd(false)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitAdd} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name *">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="MTN Bright Scholarship" />
                </Field>
                <Field label="Provider *">
                  <input required value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className={inputCls} placeholder="MTN Ghana Foundation" />
                </Field>
                <Field label="Provider type">
                  <select value={form.provider_type} onChange={(e) => setForm({ ...form, provider_type: e.target.value })} className={inputCls}>
                    {providerTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Who is it for?">
                  <select value={form.level_scope} onChange={(e) => setForm({ ...form, level_scope: e.target.value })} className={inputCls}>
                    {levelScopes.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Award">
                  <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} placeholder="GH₵ 10,000 / year" />
                </Field>
                <Field label="Deadline">
                  <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Eligible regions">
                  <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={inputCls} placeholder="All  ·  or  Ashanti, Greater Accra" />
                </Field>
                <Field label="Eligible programmes">
                  <input value={form.programmes} onChange={(e) => setForm({ ...form, programmes: e.target.value })} className={inputCls} placeholder="All  ·  or  BSc Computer Science, LLB Law" />
                </Field>
              </div>
              <Field label="Summary">
                <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="A short description of the award and who should apply." />
              </Field>

              {formError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-100">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
                  {saving ? 'Adding…' : 'Add scholarship'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-600">{label}</span>
      {children}
    </label>
  )
}
