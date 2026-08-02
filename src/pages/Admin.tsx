import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/endpoints'
import {
  BookOpen,
  Users,
  ClipboardList,
  Wallet,
  Search,
  Download,
  Plus,
  Inbox,
} from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  FilterChip,
  Input,
  Modal,
  Select,
  Stat,
  StatRow,
  StatusPill,
  TableWrap,
  Td,
  Th,
  Textarea,
  Tr,
} from '../components/ui'
import { TableSkeleton } from '../components/skeletons'
import { useTheme } from '../contexts/ThemeContext'
import { listItem, stagger } from '../lib/motion'

const statusFilter = ['All', 'Submitted', 'Under Review', 'Interview', 'Awarded', 'Rejected'] as const

const providerTypes = ['Government', 'Corporate', 'International', 'Foundation']
const levelScopes: [string, string][] = [
  ['tertiary_any', 'Any undergraduate'],
  ['tertiary_entry', 'Entering tertiary (SHS grads / L100)'],
  ['tertiary_continuing', 'Continuing tertiary'],
  ['shs', 'SHS students'],
  ['postgraduate', 'Postgraduate'],
  ['unknown', 'Not classified'],
]

const genderScopes: [string, string][] = [
  ['any', 'Open to all genders'],
  ['female', 'Women only'],
  ['male', 'Men only'],
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
  gender_scope: 'any',
  source_url: '',
  summary: '',
}

/**
 * Recharts needs literal colour strings, so resolve the design tokens from the
 * document at render time. Re-runs on theme change so charts follow dark mode.
 */
function useChartTheme() {
  const { theme } = useTheme()
  return useMemo(() => {
    const read = (name: string, fallback: string) => {
      if (typeof window === 'undefined') return fallback
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      return v ? `rgb(${v})` : fallback
    }
    return {
      accent: read('--accent', 'rgb(242 176 30)'),
      ink: read('--ink', 'rgb(11 11 12)'),
      muted: read('--ink-muted', 'rgb(124 121 114)'),
      rule: read('--rule', 'rgb(227 223 214)'),
      surface: read('--surface', 'rgb(255 255 255)'),
      series: [
        read('--accent', 'rgb(242 176 30)'),
        read('--ink', 'rgb(11 11 12)'),
        read('--state-progress', 'rgb(47 111 181)'),
        read('--state-positive', 'rgb(26 127 75)'),
        read('--state-special', 'rgb(109 74 168)'),
        read('--ink-faint', 'rgb(168 164 155)'),
      ],
    }
    // `theme` is the trigger, not a value we read: the CSS variables change
    // when the class on <html> flips.
  }, [theme])
}

export default function Admin() {
  const [statusTab, setStatusTab] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const chart = useChartTheme()

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
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const byStatus: { status: string; count: number }[] = adminStats.byStatus || []
  const byRegion: { region: string; count: number }[] = adminStats.byRegion || []
  const totalRegion = byRegion.reduce((s, r) => s + r.count, 0)
  const interviews = byStatus.find((s) => s.status === 'Interview')?.count || 0
  const awarded = byStatus.find((s) => s.status === 'Awarded')?.count || 0

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
    const rows = filteredApps.map((a) => [
      a.id,
      a.student,
      a.programme,
      a.scholarship,
      a.aggregate,
      a.region,
      a.status,
    ])
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

  if (loading) return <TableSkeleton />

  const tooltipStyle = {
    background: chart.surface,
    border: `1px solid ${chart.rule}`,
    borderRadius: 6,
    fontSize: 12,
    color: chart.ink,
    boxShadow: 'none',
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div className="min-w-0">
          <p className="t-overline text-accent">Staff only</p>
          <h1 className="t-h1 mt-2 text-ink">Admin console</h1>
          <p className="t-body mt-2 max-w-prose text-ink-muted">
            Platform-wide scholarship and application management.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="subtle"
            onClick={exportCsv}
            disabled={filteredApps.length === 0}
            icon={<Download className="h-4 w-4" />}
            className="flex-1 justify-center sm:flex-none"
          >
            Export CSV
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              setForm(emptyForm)
              setFormError('')
              setShowAdd(true)
            }}
            icon={<Plus className="h-4 w-4" />}
            className="flex-1 justify-center sm:flex-none"
          >
            Add scholarship
          </Button>
        </div>
      </header>

      {addedNote && <Alert tone="success">{addedNote}</Alert>}

      <StatRow>
        <Stat
          label="Total scholarships"
          value={adminStats.totalScholarships}
          detail={`${adminStats.verifiedScholarships} verified sources`}
          icon={<BookOpen />}
        />
        <Stat
          label="Active applicants"
          value={Number(adminStats.activeApplicants).toLocaleString()}
          detail={`${Number(adminStats.registeredUsers).toLocaleString()} registered`}
          icon={<Users />}
        />
        <Stat
          label="Applications"
          value={Number(adminStats.applicationsThisCycle).toLocaleString()}
          detail={`${interviews} in interview`}
          icon={<ClipboardList />}
        />
        <Stat
          label="Awards disbursed"
          value={adminStats.awardsDisbursed}
          detail={`Across ${awarded} award${awarded === 1 ? '' : 's'}`}
          tone="accent"
          icon={<Wallet />}
        />
      </StatRow>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card as="section" className="lg:col-span-3">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="t-h3 text-ink">Applications by status</h2>
          </div>
          <div className="px-2 py-5 sm:px-4">
            {byStatus.length === 0 || adminStats.applicationsThisCycle === 0 ? (
              <p className="t-sm py-12 text-center text-ink-muted">No applications yet.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byStatus} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <XAxis
                      dataKey="status"
                      tick={{ fill: chart.muted, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chart.rule }}
                      interval={0}
                      height={44}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: chart.muted, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: chart.rule, opacity: 0.4 }}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: chart.ink, fontWeight: 600 }}
                    />
                    <Bar dataKey="count" name="Applications" fill={chart.accent} radius={[3, 3, 0, 0]} maxBarSize={52} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        <Card as="section" className="lg:col-span-2">
          <div className="border-b border-rule px-5 py-4">
            <h2 className="t-h3 text-ink">Applicants by region</h2>
          </div>
          <div className="px-5 py-5">
            {totalRegion === 0 ? (
              <p className="t-sm py-12 text-center text-ink-muted">No region data yet.</p>
            ) : (
              <>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byRegion}
                        dataKey="count"
                        nameKey="region"
                        innerRadius={44}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {byRegion.map((_, i) => (
                          <Cell key={i} fill={chart.series[i % chart.series.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="rule-list mt-4 border-t border-rule">
                  {byRegion.map((r, i) => (
                    <li key={r.region} className="flex items-center gap-2.5 py-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: chart.series[i % chart.series.length] }}
                        aria-hidden
                      />
                      <span className="t-sm min-w-0 flex-1 truncate text-ink-secondary">
                        {r.region}
                      </span>
                      <span className="tabular t-sm font-semibold text-ink">
                        {r.count.toLocaleString()}
                      </span>
                      <span className="tabular t-xs w-9 shrink-0 text-right text-ink-muted">
                        {((r.count / totalRegion) * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Applications */}
      <Card as="section" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4">
          <h2 className="t-h3 text-ink">All applications</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students…"
            aria-label="Search applications"
            inputSize="sm"
            icon={<Search />}
            className="sm:w-60"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-rule px-5 py-3">
          {statusFilter.map((f) => (
            <FilterChip key={f} active={statusTab === f} onClick={() => setStatusTab(f)}>
              {f}
            </FilterChip>
          ))}
        </div>

        {filteredApps.length === 0 ? (
          <EmptyState
            className="m-5 border-0"
            icon={<Inbox />}
            title={
              adminApplications.length === 0
                ? 'No applications submitted yet'
                : 'Nothing matches these filters'
            }
            description={
              adminApplications.length === 0
                ? 'Student applications will appear here as they come in.'
                : 'Try another status, or clear the search.'
            }
          />
        ) : (
          <>
            {/* Phones get a card list; the table would force a sideways scroll */}
            <motion.ul
              initial="hidden"
              animate="show"
              variants={stagger(0, 0.02)}
              className="rule-list sm:hidden"
            >
              {filteredApps.map((a) => (
                <motion.li key={a.id} variants={listItem} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{a.student}</p>
                      <p className="t-xs mt-0.5 font-mono text-ink-muted">{a.id}</p>
                    </div>
                    <StatusPill status={a.status} className="shrink-0" />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      ['Programme', a.programme],
                      ['Scholarship', a.scholarship],
                      ['Aggregate', a.aggregate],
                      ['Region', a.region],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="min-w-0">
                        <dt className="t-overline text-ink-faint">{label}</dt>
                        <dd className="t-xs mt-0.5 truncate text-ink-secondary">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </motion.li>
              ))}
            </motion.ul>

            <div className="hidden sm:block">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Student</Th>
                    <Th>Programme</Th>
                    <Th>Scholarship</Th>
                    <Th align="center">Agg.</Th>
                    <Th>Region</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((a) => (
                    <Tr key={a.id}>
                      <Td className="whitespace-nowrap font-mono text-xs font-semibold text-ink">
                        {a.id}
                      </Td>
                      <Td className="whitespace-nowrap font-medium text-ink">{a.student}</Td>
                      <Td className="whitespace-nowrap">{a.programme}</Td>
                      <Td className="whitespace-nowrap">{a.scholarship}</Td>
                      <Td align="center" className="tabular whitespace-nowrap font-semibold text-ink">
                        {a.aggregate}
                      </Td>
                      <Td className="whitespace-nowrap">{a.region}</Td>
                      <Td>
                        <StatusPill status={a.status} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>

            <p className="t-xs border-t border-rule px-5 py-3 text-ink-muted">
              Showing <span className="tabular font-semibold text-ink">{filteredApps.length}</span> of{' '}
              <span className="tabular">{adminApplications.length}</span> applications
            </p>
          </>
        )}
      </Card>

      {/* Add Scholarship modal */}
      <Modal
        open={showAdd}
        onClose={() => !saving && setShowAdd(false)}
        title="Add a scholarship"
        description="No application link needed — the app reads the source page and finds the real form itself."
        size="lg"
        footer={
          <>
            <Button
              variant="subtle"
              onClick={() => setShowAdd(false)}
              disabled={saving}
              block
              className="sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={submitAdd}
              loading={saving}
              block
              className="sm:w-auto"
            >
              Add scholarship
            </Button>
          </>
        }
      >
        <form onSubmit={submitAdd} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="ad-name" required>
              <Input
                id="ad-name"
                data-autofocus
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="MTN Bright Scholarship"
              />
            </Field>
            <Field label="Provider" htmlFor="ad-provider" required>
              <Input
                id="ad-provider"
                required
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="MTN Ghana Foundation"
              />
            </Field>
            <Field label="Provider type" htmlFor="ad-ptype">
              <Select
                id="ad-ptype"
                value={form.provider_type}
                onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
              >
                {providerTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Who is it for?" htmlFor="ad-scope">
              <Select
                id="ad-scope"
                value={form.level_scope}
                onChange={(e) => setForm({ ...form, level_scope: e.target.value })}
              >
                {levelScopes.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Award" htmlFor="ad-amount">
              <Input
                id="ad-amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="GH₵ 10,000 / year"
              />
            </Field>
            <Field label="Deadline" htmlFor="ad-deadline">
              <Input
                id="ad-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </Field>
            <Field label="Eligible regions" htmlFor="ad-region" hint="“All”, or a comma-separated list.">
              <Input
                id="ad-region"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="All · or Ashanti, Greater Accra"
              />
            </Field>
            <Field
              label="Eligible programmes"
              htmlFor="ad-progs"
              hint="“All”, or a comma-separated list."
            >
              <Input
                id="ad-progs"
                value={form.programmes}
                onChange={(e) => setForm({ ...form, programmes: e.target.value })}
                placeholder="All · or BSc Computer Science, LLB Law"
              />
            </Field>
            <Field label="Gender restriction" htmlFor="ad-gender">
              <Select
                id="ad-gender"
                value={form.gender_scope}
                onChange={(e) => setForm({ ...form, gender_scope: e.target.value })}
              >
                {genderScopes.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Scholarship page link" htmlFor="ad-url">
              <Input
                id="ad-url"
                type="url"
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                placeholder="https://provider.org/scholarships/…"
              />
            </Field>
          </div>

          <Field label="Summary" htmlFor="ad-summary">
            <Textarea
              id="ad-summary"
              rows={3}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="A short description of the award and who should apply."
            />
          </Field>

          {formError && <Alert tone="danger">{formError}</Alert>}
        </form>
      </Modal>
    </div>
  )
}
