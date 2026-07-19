import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  GraduationCap,
  School,
  MapPin,
  Wallet,
  ClipboardCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  BookOpen,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { GHANA_REGIONS } from '../data/mock'
import { ProgrammeSelect } from '../components/ProgrammeSelect'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { cn } from '../lib/cn'

const INSTITUTIONS = [
  'Kwame Nkrumah University of Science & Technology',
  'University of Ghana',
  'University of Cape Coast',
  'University of Education, Winneba',
  'University for Development Studies',
  'University of Health and Allied Sciences',
  'University of Energy and Natural Resources',
  'University of Mines and Technology',
  'University of Professional Studies, Accra',
  'Ashesi University',
  'GIMPA',
  'Accra Technical University',
  'Kumasi Technical University',
  'Takoradi Technical University',
  'Ho Technical University',
]

const stepsMeta = [
  { icon: GraduationCap, title: 'Student type' },
  { icon: BookOpen, title: 'Academics' },
  { icon: MapPin, title: 'Origin & region' },
  { icon: Wallet, title: 'Financial need' },
  { icon: ClipboardCheck, title: 'Review' },
]

const inputCls =
  'h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mt-5">
      <label className="mb-2 block text-sm font-semibold text-ink-700">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Nothing is pre-answered: matches are only as honest as the data behind
  // them, so every value here must come from the student.
  const [studentType, setStudentType] = useState<'' | 'SHS' | 'University'>('')
  // SHS track
  const [shsSchool, setShsSchool] = useState('')
  const [shsLevel, setShsLevel] = useState('')
  const [wassceStatus, setWassceStatus] = useState('')
  // University track
  const [institution, setInstitution] = useState('')
  const [studentId, setStudentId] = useState('')
  const [universityLevel, setUniversityLevel] = useState('')
  const [standing, setStanding] = useState('')
  // Shared
  const [aggregate, setAggregate] = useState('') // keep as string so "unanswered" is representable
  const [programme, setProgramme] = useState('')
  const [region, setRegion] = useState('')
  const [district, setDistrict] = useState('')
  const [need, setNeed] = useState('')

  const aggregateNum = aggregate === '' ? null : Number(aggregate)
  const aggregateValid = aggregateNum !== null && aggregateNum >= 6 && aggregateNum <= 54
  const needsAggregate = studentType === 'University' || wassceStatus === 'released'

  const stepValid = (): boolean => {
    switch (step) {
      case 0:
        return studentType !== ''
      case 1:
        if (studentType === 'SHS') {
          return (
            shsSchool.trim().length > 1 &&
            shsLevel !== '' &&
            wassceStatus !== '' &&
            programme !== '' &&
            (wassceStatus !== 'released' || aggregateValid)
          )
        }
        return (
          institution.trim().length > 1 &&
          programme !== '' &&
          universityLevel !== '' &&
          standing !== '' &&
          aggregateValid
        )
      case 2:
        return region !== '' && district.trim().length > 1
      case 3:
        return need !== ''
      default:
        return true
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        profile: {
          ...user?.profile,
          student_type: studentType,
          shs_school: studentType === 'SHS' ? shsSchool.trim() : '',
          shs_level: studentType === 'SHS' ? shsLevel : '',
          wassce_status: studentType === 'SHS' ? wassceStatus : 'released',
          institution: studentType === 'University' ? institution.trim() : '',
          student_id: studentType === 'University' ? studentId.trim() : '',
          university_level: studentType === 'University' ? universityLevel : '',
          academic_standing: studentType === 'University' ? standing : '',
          programme,
          wassce_aggregate: needsAggregate && aggregateValid ? aggregateNum : null,
          region,
          home_district: district.trim(),
          need_level: need,
        },
      }
      const updatedUser = await api.auth.updateMe(payload)
      setUser(updatedUser)
      navigate('/app/matches')
    } catch (err: any) {
      setError(err.message || 'Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const next = () => (step < 4 ? setStep(step + 1) : save())
  const back = () => setStep((s) => Math.max(0, s - 1))

  const reviewRows: { l: string; v: string }[] =
    studentType === 'SHS'
      ? [
          { l: 'Student type', v: 'SHS student' },
          { l: 'School', v: shsSchool },
          { l: 'Level', v: shsLevel },
          {
            l: 'WASSCE',
            v:
              wassceStatus === 'released'
                ? `Results released · aggregate ${aggregate}`
                : wassceStatus === 'awaiting'
                  ? 'Awaiting results'
                  : 'Not yet written',
          },
          { l: 'Intended programme', v: programme },
          { l: 'Home region', v: `${region} · ${district}` },
          { l: 'Financial need', v: `${need} need` },
        ]
      : [
          { l: 'Student type', v: 'University student' },
          { l: 'Institution', v: institution },
          { l: 'Programme', v: programme },
          { l: 'Level', v: universityLevel === 'Postgraduate' ? 'Postgraduate' : `Level ${universityLevel}` },
          { l: 'Academic standing', v: standing },
          { l: 'WASSCE aggregate', v: aggregate },
          { l: 'Home region', v: `${region} · ${district}` },
          { l: 'Financial need', v: `${need} need` },
        ]

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Logo />
          <span className="text-sm text-ink-400">Your profile powers your matches</span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* Stepper */}
        <div className="mb-10 flex items-center justify-between">
          {stepsMeta.map((s, i) => (
            <div key={s.title} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className={cn(
                    'grid h-11 w-11 place-items-center rounded-xl border-2 transition-colors',
                    i < step && 'border-brand-600 bg-brand-600 text-white',
                    i === step && 'border-brand-600 bg-brand-50 text-brand-700',
                    i > step && 'border-ink-200 bg-white text-ink-300',
                  )}
                >
                  {i < step ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                <p className={cn('hidden text-xs font-semibold sm:block', i <= step ? 'text-ink-800' : 'text-ink-400')}>
                  {s.title}
                </p>
              </div>
              {i < stepsMeta.length - 1 && (
                <div className={cn('mx-2 h-0.5 flex-1 rounded', i < step ? 'bg-brand-600' : 'bg-ink-200')} />
              )}
            </div>
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-ink-200/70 bg-white p-6 shadow-sm sm:p-8"
        >
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Which best describes you?</h2>
              <p className="mt-1 text-ink-500">
                SHS and university students qualify for different scholarships, so the matching
                engine needs to know which you are.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {[
                  {
                    v: 'SHS' as const,
                    icon: School,
                    title: 'SHS student',
                    desc: 'In senior high school or completed, planning for tertiary education',
                  },
                  {
                    v: 'University' as const,
                    icon: GraduationCap,
                    title: 'University student',
                    desc: 'Enrolled in a university, technical university or college',
                  },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setStudentType(o.v)}
                    className={cn(
                      'rounded-2xl border-2 p-6 text-left transition',
                      studentType === o.v
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-ink-200 bg-white hover:border-ink-300',
                    )}
                  >
                    <o.icon
                      className={cn('h-8 w-8', studentType === o.v ? 'text-brand-700' : 'text-ink-400')}
                    />
                    <p className="mt-3 font-display text-lg font-bold text-ink-900">{o.title}</p>
                    <p className="mt-1 text-sm text-ink-500">{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && studentType === 'SHS' && (
            <div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Your SHS details</h2>
              <p className="mt-1 text-ink-500">
                Awards for tertiary entry are matched from these.
              </p>

              <Field label="Senior high school">
                <input
                  value={shsSchool}
                  onChange={(e) => setShsSchool(e.target.value)}
                  placeholder="e.g. Prempeh College"
                  className={inputCls}
                />
              </Field>

              <Field label="Current level">
                <select value={shsLevel} onChange={(e) => setShsLevel(e.target.value)} className={inputCls}>
                  <option value="">Select your level…</option>
                  <option>Form 1</option>
                  <option>Form 2</option>
                  <option>Form 3</option>
                  <option value="Completed">Completed SHS</option>
                </select>
              </Field>

              <Field label="WASSCE status">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { v: 'not_written', l: 'Not yet written' },
                    { v: 'awaiting', l: 'Awaiting results' },
                    { v: 'released', l: 'Results released' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setWassceStatus(o.v)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-sm font-medium transition',
                        wassceStatus === o.v
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                      )}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </Field>

              {wassceStatus === 'released' && (
                <Field
                  label="WASSCE aggregate (best six)"
                  hint="From 6 (best possible) to 54. You can find it on your results slip."
                >
                  <input
                    type="number"
                    min={6}
                    max={54}
                    value={aggregate}
                    onChange={(e) => setAggregate(e.target.value)}
                    placeholder="e.g. 12"
                    className={inputCls}
                  />
                </Field>
              )}
              {wassceStatus !== '' && wassceStatus !== 'released' && (
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No problem — add your aggregate when results are released. Until then, matches
                  that need it will show as pending rather than confirmed.
                </p>
              )}

              <Field label="Programme you intend to study">
                <ProgrammeSelect value={programme} onChange={setProgramme} className={inputCls} />
              </Field>
            </div>
          )}

          {step === 1 && studentType === 'University' && (
            <div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Your university details</h2>
              <p className="mt-1 text-ink-500">
                Continuing-student awards are matched from these.
              </p>

              <Field label="Institution">
                <input
                  list="institutions"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Start typing your institution…"
                  className={inputCls}
                />
                <datalist id="institutions">
                  {INSTITUTIONS.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Programme of study">
                  <ProgrammeSelect value={programme} onChange={setProgramme} className={inputCls} />
                </Field>
                <Field label="Current level">
                  <select
                    value={universityLevel}
                    onChange={(e) => setUniversityLevel(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select your level…</option>
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="400">Level 400</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Academic standing" hint="Use your latest transcript classification.">
                  <select value={standing} onChange={(e) => setStanding(e.target.value)} className={inputCls}>
                    <option value="">Select standing…</option>
                    <option>First Class</option>
                    <option>Second Class Upper</option>
                    <option>Second Class Lower</option>
                    <option>Third Class</option>
                    <option>Pass</option>
                    <option>No results yet</option>
                  </select>
                </Field>
                <Field label="WASSCE aggregate (best six)" hint="6 (best) to 54 — still used by many awards.">
                  <input
                    type="number"
                    min={6}
                    max={54}
                    value={aggregate}
                    onChange={(e) => setAggregate(e.target.value)}
                    placeholder="e.g. 8"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Student ID (optional)">
                <input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 1821122"
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Origin & region</h2>
              <p className="mt-1 text-ink-500">
                District schemes prioritise indigenes, so this unlocks local awards.
              </p>

              <label className="mb-2 mt-7 block text-sm font-semibold text-ink-700">Home region</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {GHANA_REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegion(r)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-sm font-medium transition',
                      region === r
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <Field label="Home district (MMDA)" hint="e.g. Kumasi Metropolitan, Ho Municipal, Bongo District">
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Enter your home district…"
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Financial need</h2>
              <p className="mt-1 text-ink-500">
                Many awards are need-based. This stays private and encrypted.
              </p>

              <div className="mt-7 space-y-3">
                {[
                  { v: 'High', d: 'Scholarship is essential for me to study or remain enrolled' },
                  { v: 'Moderate', d: 'Significant help needed alongside other support' },
                  { v: 'Low', d: 'Primarily seeking merit-based recognition' },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setNeed(o.v)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition',
                      need === o.v ? 'border-brand-600 bg-brand-50' : 'border-ink-200 bg-white hover:border-ink-300',
                    )}
                  >
                    <div
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                        need === o.v ? 'border-brand-600 bg-brand-600' : 'border-ink-300',
                      )}
                    >
                      {need === o.v && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="font-semibold text-ink-800">{o.v} need</p>
                      <p className="text-sm text-ink-500">{o.d}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Review your profile</h2>
              <p className="mt-1 text-ink-500">
                Your matches are computed from exactly these details — check them before saving.
              </p>

              {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}

              <div className="mt-6 grid gap-2.5">
                {reviewRows.map((row) => (
                  <div key={row.l} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
                    <span className="text-sm text-ink-500">{row.l}</span>
                    <span className="text-sm font-semibold text-ink-800">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                step === 0 ? 'invisible' : 'text-ink-600 hover:bg-ink-100',
              )}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={next}
              disabled={saving || !stepValid()}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : step === 4 ? 'Save & see my matches' : 'Continue'}
              {!saving && <ArrowRight className="h-4.5 w-4.5" />}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
