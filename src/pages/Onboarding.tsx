import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GraduationCap, School, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { Logo } from '../components/Logo'
import { GHANA_REGIONS } from '../data/mock'
import { ProgrammeSelect } from '../components/ProgrammeSelect'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { cn } from '../lib/cn'
import { Alert, Button, DataRow, Field, Input, Select } from '../components/ui'

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

const STEP_TITLES = ['Student type', 'Academics', 'Background', 'Financial need', 'Review']

/* ------------------------------------------------------------------ *
 * Local building blocks
 * ------------------------------------------------------------------ */

/** Selection row with a gold left edge when chosen. */
function ChoiceRow({
  selected,
  onSelect,
  title,
  desc,
  icon,
  className,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  desc?: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative w-full overflow-hidden rounded-md border p-4 text-left transition-colors duration-[--dur] sm:p-5',
        selected
          ? 'border-ink bg-surface-sunken'
          : 'border-rule bg-surface hover:border-rule-strong',
        className,
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 transition-colors duration-[--dur]',
          selected ? 'bg-accent' : 'bg-transparent',
        )}
        aria-hidden
      />
      <span className="flex items-start gap-3 pl-2">
        {icon && (
          <span className={cn('mt-0.5 shrink-0 [&_svg]:h-5 [&_svg]:w-5', selected ? 'text-ink' : 'text-ink-faint')}>
            {icon}
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-display text-base font-bold tracking-tight text-ink">{title}</span>
          {desc && <span className="t-sm mt-1 block text-ink-muted">{desc}</span>}
        </span>
      </span>
    </button>
  )
}

/** Compact chip used for region / gender / status grids. */
function ChoiceChip({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-md border px-3 py-2.5 text-[0.8125rem] font-semibold transition-colors duration-[--dur]',
        selected
          ? 'border-ink bg-ink text-canvas'
          : 'border-rule bg-surface text-ink-secondary hover:border-rule-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function StepIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-rule pb-5">
      <h2 className="t-h2 text-ink">{title}</h2>
      <p className="t-body mt-2 max-w-prose text-ink-muted">{desc}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

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
  const [gender, setGender] = useState('')
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
        return region !== '' && district.trim().length > 1 && gender !== ''
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
          gender,
          need_level: need,
        },
      }
      const updatedUser = await api.auth.updateMe(payload)
      setUser(updatedUser)
      navigate('/app/scholarships')
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
          { l: 'Gender', v: gender },
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
          { l: 'Gender', v: gender },
          { l: 'Financial need', v: `${need} need` },
        ]

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo size="sm" className="sm:hidden" />
          <Logo className="hidden sm:flex" />
          <span className="t-overline text-ink-muted">
            Step {step + 1} <span className="text-ink-faint">of 5</span>
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Progress rail */}
        <div>
          <div className="flex items-end justify-between gap-4">
            <p className="t-overline text-accent">{STEP_TITLES[step]}</p>
            <p className="tabular t-xs text-ink-muted">{Math.round(((step + 1) / 5) * 100)}%</p>
          </div>
          <div className="mt-3 flex gap-1.5" role="list" aria-label="Onboarding progress">
            {STEP_TITLES.map((title, i) => (
              <span
                key={title}
                role="listitem"
                aria-current={i === step ? 'step' : undefined}
                aria-label={`${title}${i < step ? ' (completed)' : ''}`}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-[--dur]',
                  i < step && 'bg-ink',
                  i === step && 'bg-accent',
                  i > step && 'bg-rule',
                )}
              />
            ))}
          </div>
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
          className="mt-8 rounded-md border border-rule bg-surface p-5 sm:p-8"
        >
          {/* -------- Step 0: student type -------- */}
          {step === 0 && (
            <div className="space-y-6">
              <StepIntro
                title="Which best describes you?"
                desc="SHS and university students qualify for different scholarships, so the matching engine needs to know which you are."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceRow
                  selected={studentType === 'SHS'}
                  onSelect={() => setStudentType('SHS')}
                  icon={<School />}
                  title="SHS student"
                  desc="In senior high school or completed, planning for tertiary education"
                />
                <ChoiceRow
                  selected={studentType === 'University'}
                  onSelect={() => setStudentType('University')}
                  icon={<GraduationCap />}
                  title="University student"
                  desc="Enrolled in a university, technical university or college"
                />
              </div>
            </div>
          )}

          {/* -------- Step 1: SHS -------- */}
          {step === 1 && studentType === 'SHS' && (
            <div className="space-y-6">
              <StepIntro
                title="Your SHS details"
                desc="Awards for tertiary entry are matched from these."
              />

              <Field label="Senior high school" htmlFor="ob-school" required>
                <Input
                  id="ob-school"
                  value={shsSchool}
                  onChange={(e) => setShsSchool(e.target.value)}
                  placeholder="e.g. Prempeh College"
                />
              </Field>

              <Field label="Current level" htmlFor="ob-level" required>
                <Select id="ob-level" value={shsLevel} onChange={(e) => setShsLevel(e.target.value)}>
                  <option value="">Select your level…</option>
                  <option>Form 1</option>
                  <option>Form 2</option>
                  <option>Form 3</option>
                  <option value="Completed">Completed SHS</option>
                </Select>
              </Field>

              <Field label="WASSCE status" required>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { v: 'not_written', l: 'Not yet written' },
                    { v: 'awaiting', l: 'Awaiting results' },
                    { v: 'released', l: 'Results released' },
                  ].map((o) => (
                    <ChoiceChip
                      key={o.v}
                      selected={wassceStatus === o.v}
                      onSelect={() => setWassceStatus(o.v)}
                    >
                      {o.l}
                    </ChoiceChip>
                  ))}
                </div>
              </Field>

              {wassceStatus === 'released' && (
                <Field
                  label="WASSCE aggregate (best six)"
                  htmlFor="ob-agg"
                  required
                  hint="From 6 (best possible) to 54. You can find it on your results slip."
                >
                  <Input
                    id="ob-agg"
                    type="number"
                    min={6}
                    max={54}
                    inputMode="numeric"
                    value={aggregate}
                    onChange={(e) => setAggregate(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </Field>
              )}
              {wassceStatus !== '' && wassceStatus !== 'released' && (
                <Alert tone="warning">
                  No problem — add your aggregate when results are released. Until then, matches that
                  need it will show as pending rather than confirmed.
                </Alert>
              )}

              <Field label="Programme you intend to study" required>
                <ProgrammeSelect value={programme} onChange={setProgramme} />
              </Field>
            </div>
          )}

          {/* -------- Step 1: University -------- */}
          {step === 1 && studentType === 'University' && (
            <div className="space-y-6">
              <StepIntro
                title="Your university details"
                desc="Continuing-student awards are matched from these."
              />

              <Field label="Institution" htmlFor="ob-inst" required>
                <Input
                  id="ob-inst"
                  list="institutions"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Start typing your institution…"
                />
                <datalist id="institutions">
                  {INSTITUTIONS.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Programme of study" required>
                  <ProgrammeSelect value={programme} onChange={setProgramme} />
                </Field>
                <Field label="Current level" htmlFor="ob-ulevel" required>
                  <Select
                    id="ob-ulevel"
                    value={universityLevel}
                    onChange={(e) => setUniversityLevel(e.target.value)}
                  >
                    <option value="">Select your level…</option>
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="400">Level 400</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  label="Academic standing"
                  htmlFor="ob-standing"
                  required
                  hint="Use your latest transcript classification."
                >
                  <Select id="ob-standing" value={standing} onChange={(e) => setStanding(e.target.value)}>
                    <option value="">Select standing…</option>
                    <option>First Class</option>
                    <option>Second Class Upper</option>
                    <option>Second Class Lower</option>
                    <option>Third Class</option>
                    <option>Pass</option>
                    <option>No results yet</option>
                  </Select>
                </Field>
                <Field
                  label="WASSCE aggregate (best six)"
                  htmlFor="ob-uagg"
                  required
                  hint="6 (best) to 54 — still used by many awards."
                >
                  <Input
                    id="ob-uagg"
                    type="number"
                    min={6}
                    max={54}
                    inputMode="numeric"
                    value={aggregate}
                    onChange={(e) => setAggregate(e.target.value)}
                    placeholder="e.g. 8"
                  />
                </Field>
              </div>

              <Field label="Student ID" htmlFor="ob-sid" hint="Optional.">
                <Input
                  id="ob-sid"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 1821122"
                />
              </Field>
            </div>
          )}

          {/* -------- Step 2: background -------- */}
          {step === 2 && (
            <div className="space-y-6">
              <StepIntro
                title="Your background"
                desc="District schemes prioritise indigenes, so this unlocks local awards."
              />

              <Field label="Home region" required>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {GHANA_REGIONS.map((r) => (
                    <ChoiceChip key={r} selected={region === r} onSelect={() => setRegion(r)}>
                      {r}
                    </ChoiceChip>
                  ))}
                </div>
              </Field>

              <Field
                label="Home district (MMDA)"
                htmlFor="ob-district"
                required
                hint="e.g. Kumasi Metropolitan, Ho Municipal, Bongo District"
              >
                <Input
                  id="ob-district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Enter your home district…"
                />
              </Field>

              <Field
                label="Gender"
                required
                hint="A number of funders run women-only scholarships, especially in STEM and leadership. Telling us lets the matcher surface those instead of hiding them."
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  {['Female', 'Male', 'Prefer not to say'].map((g) => (
                    <ChoiceChip key={g} selected={gender === g} onSelect={() => setGender(g)}>
                      {g}
                    </ChoiceChip>
                  ))}
                </div>
              </Field>

              {gender === 'Prefer not to say' && (
                <Alert tone="warning">
                  That is completely fine. Awards restricted to one gender will show as
                  &ldquo;confirm eligibility&rdquo; rather than a definite match, since we cannot
                  verify that criterion for you.
                </Alert>
              )}
            </div>
          )}

          {/* -------- Step 3: need -------- */}
          {step === 3 && (
            <div className="space-y-6">
              <StepIntro
                title="Financial need"
                desc="Many awards are need-based. This stays private and encrypted."
              />
              <div className="space-y-3">
                {[
                  { v: 'High', d: 'A scholarship is essential for me to study or remain enrolled' },
                  { v: 'Moderate', d: 'Significant help needed alongside other support' },
                  { v: 'Low', d: 'Primarily seeking merit-based recognition' },
                ].map((o) => (
                  <ChoiceRow
                    key={o.v}
                    selected={need === o.v}
                    onSelect={() => setNeed(o.v)}
                    title={`${o.v} need`}
                    desc={o.d}
                  />
                ))}
              </div>
            </div>
          )}

          {/* -------- Step 4: review -------- */}
          {step === 4 && (
            <div className="space-y-6">
              <StepIntro
                title="Review your profile"
                desc="Your matches are computed from exactly these details — check them before saving."
              />

              {error && <Alert tone="danger">{error}</Alert>}

              <dl className="rule-list border-y border-rule">
                {reviewRows.map((row) => (
                  <DataRow key={row.l} label={row.l} value={row.v || '—'} />
                ))}
              </dl>
            </div>
          )}

          {/* -------- Controls -------- */}
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={back}
              disabled={step === 0}
              className={cn(step === 0 && 'invisible hidden sm:inline-flex')}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Back
            </Button>
            <Button
              variant="accent"
              size="lg"
              onClick={next}
              loading={saving}
              disabled={!stepValid()}
              className="w-full justify-center sm:w-auto"
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              {step === 4 ? 'Save & see my matches' : 'Continue'}
            </Button>
          </div>
        </motion.div>

        <p className="t-xs mt-6 flex items-center justify-center gap-2 text-ink-muted">
          <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
          Your answers stay private and are only used to compute your matches.
        </p>
      </div>
    </div>
  )
}
