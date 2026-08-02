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
  Filter,
  ChevronDown,
  ArrowLeft,
  BarChart3,
  PieChart,
} from 'lucide-react'
import { Card, StatusPill, Badge } from '../components/ui'
import {
  applicationsTrend,
  regionDistribution,
} from '../data/mock'
import { cn } from '../lib/cn'

const statusFilter = ['All', 'Submitted', 'Under Review', 'Interview', 'Awarded', 'Rejected'] as const

export default function Admin() {
  const [statusTab, setStatusTab] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  
  const [adminStats, setAdminStats] = useState({
    totalScholarships: 0,
    activeApplicants: 0,
    applicationsThisCycle: 0,
    awardsDisbursed: "0",
  })
  const [adminApplications, setAdminApplications] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      api.admin.stats(),
      api.admin.applications(),
    ]).then(([stats, apps]) => {
      setAdminStats(stats)
      setAdminApplications(apps)
    }).finally(() => setLoading(false))
  }, [])
  
  const stats = [
    { label: 'Total scholarships', value: String(adminStats.totalScholarships), icon: BookOpen, tone: 'bg-brand-50 text-brand-700', change: '+4 this cycle' },
    { label: 'Active applicants', value: adminStats.activeApplicants.toLocaleString(), icon: Users, tone: 'bg-violet-50 text-violet-700', change: '+18% vs last cycle' },
    { label: 'Applications this cycle', value: adminStats.applicationsThisCycle.toLocaleString(), icon: ClipboardList, tone: 'bg-amber-50 text-amber-700', change: '+23% vs last cycle' },
    { label: 'Awards disbursed', value: adminStats.awardsDisbursed, icon: Wallet, tone: 'bg-emerald-50 text-emerald-700', change: 'Total this year' },
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

  const maxTrend = Math.max(...applicationsTrend.map((d) => d.matches))
  const totalRegion = regionDistribution.reduce((s, r) => s + r.value, 0)
  const regionColors = ['bg-brand-600', 'bg-brand-400', 'bg-amber-500', 'bg-violet-500', 'bg-emerald-500', 'bg-ink-300']

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
            >
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
            <button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-ink-700 ring-1 ring-inset ring-ink-200 transition hover:bg-ink-50">
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800">
              + Add Scholarship
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div className={cn('grid h-10 w-10 place-items-center rounded-xl', s.tone)}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-300" />
                </div>
                <p className="mt-4 font-display text-2xl font-extrabold text-ink-900">{s.value}</p>
                <p className="text-sm text-ink-500">{s.label}</p>
                <p className="mt-1 text-xs font-medium text-ink-400">{s.change}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Trend chart */}
          <Card className="p-5 sm:p-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand-600" />
                <h2 className="font-display text-lg font-bold text-ink-900">Applications trend</h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-ink-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Matches
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold-500" /> Applications
                </span>
              </div>
            </div>
            <div className="mt-6 flex items-end gap-3" style={{ height: 200 }}>
              {applicationsTrend.map((d) => (
                <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end gap-1" style={{ height: 180 }}>
                    <div
                      className="flex-1 rounded-t-md bg-brand-200 transition-all duration-500"
                      style={{ height: `${(d.matches / maxTrend) * 100}%` }}
                      title={`${d.matches} matches`}
                    />
                    <div
                      className="flex-1 rounded-t-md bg-gold-400 transition-all duration-500"
                      style={{ height: `${(d.applications / maxTrend) * 100}%` }}
                      title={`${d.applications} applications`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-ink-400">{d.month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Region distribution */}
          <Card className="p-5 sm:p-6 lg:col-span-2">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-brand-600" />
              <h2 className="font-display text-lg font-bold text-ink-900">By region</h2>
            </div>

            {/* Horizontal stacked bar as pie substitute */}
            <div className="mt-6 flex h-6 overflow-hidden rounded-full">
              {regionDistribution.map((r, i) => (
                <div
                  key={r.region}
                  className={cn('transition-all duration-500', regionColors[i])}
                  style={{ width: `${(r.value / totalRegion) * 100}%` }}
                  title={`${r.region}: ${r.value}`}
                />
              ))}
            </div>

            <div className="mt-5 space-y-2.5">
              {regionDistribution.map((r, i) => (
                <div key={r.region} className="flex items-center gap-2.5">
                  <span className={cn('h-3 w-3 rounded-full', regionColors[i])} />
                  <span className="flex-1 text-sm text-ink-600">{r.region}</span>
                  <span className="text-sm font-semibold text-ink-800">
                    {r.value.toLocaleString()}
                  </span>
                  <span className="w-12 text-right text-xs text-ink-400">
                    {((r.value / totalRegion) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Applications table */}
        <div className="mt-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-ink-900">Recent applications</h2>
              <div className="flex items-center gap-2">
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
            </div>

            <div className="flex flex-wrap gap-2 border-b border-ink-200/70 px-5 py-3 sm:px-6">
              {statusFilter.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusTab(f)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    statusTab === f
                      ? 'bg-brand-700 text-white'
                      : 'bg-ink-50 text-ink-600 hover:bg-ink-100',
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
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className="transition hover:bg-ink-50/60"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-brand-700 sm:px-6">
                        {a.id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-medium text-ink-800">
                        {a.student}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-ink-600">{a.programme}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-ink-600">{a.scholarship}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-semibold text-ink-700">
                        {a.aggregate}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-ink-600">{a.region}</td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <StatusPill status={a.status} />
                      </td>
                    </motion.tr>
                  ))}
                  {filteredApps.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-ink-400">
                        No applications match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-ink-200/70 px-5 py-3 sm:px-6">
              <p className="text-xs text-ink-400">
                Showing {filteredApps.length} of {adminApplications.length} applications
              </p>
              <div className="flex items-center gap-1">
                <button className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100">
                  ‹
                </button>
                <button className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-xs font-semibold text-white">
                  1
                </button>
                <button className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100">
                  ›
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
