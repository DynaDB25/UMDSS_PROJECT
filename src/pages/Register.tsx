import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Check, ShieldCheck, RefreshCw,
} from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { cn } from '../lib/cn'
import { Alert, Button, Checkbox, Field, Input } from '../components/ui'

/**
 * The one-time-code step shown straight after an account is created. The
 * account already exists and the student is signed in by this point, so a
 * failure to verify is never a dead end: they can resend, or skip and verify
 * later from Settings. An unverified number still receives alerts, so skipping
 * costs nothing today and simply leaves the number unconfirmed.
 */
type OtpInfo = {
  channel: 'SMS' | 'Email'
  sentTo: string
  phone: string
  altChannel: 'SMS' | 'Email' | null
}

function PhoneVerify({ onDone }: { onDone: () => void }) {
  const [info, setInfo] = useState<OtpInfo | null>(null)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const sentOnce = useRef(false)

  // No argument resends on whatever channel the server leads with; passing one
  // is the student taking the other route offered once the countdown is up.
  const send = useCallback(async (channel?: 'sms' | 'email') => {
    setError('')
    setSending(true)
    try {
      const res = await api.auth.requestPhoneOtp(channel ? { channel } : {})
      setInfo({
        channel: res.channel,
        sentTo: res.sentTo,
        phone: res.phone,
        altChannel: res.altChannel,
      })
      setResendIn(res.resendIn || 60)
      setCode('')
    } catch (e: any) {
      setError(e.message || 'We could not send a code right now. You can skip and verify later.')
    } finally {
      setSending(false)
    }
  }, [])

  useEffect(() => {
    if (sentOnce.current) return
    sentOnce.current = true
    send()
  }, [send])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setVerifying(true)
    try {
      await api.auth.verifyPhoneOtp(code.trim())
      onDone()
    } catch (e: any) {
      setError(e.message || 'That code did not work. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h1 className="t-h1 mt-5 text-ink">Verify your phone</h1>
      {/* sentTo is masked server-side to match the channel the code actually
          went out on, so this can never name the wrong kind of destination.
          The number is called out separately: it is what is being verified,
          whichever channel carried the code there. */}
      <p className="t-body mt-3 text-ink-muted">
        {info ? (
          <>
            We {info.channel === 'Email' ? 'emailed' : 'texted'} a 6 digit code to{' '}
            <span className="font-semibold text-ink">{info.sentTo}</span>. Enter it below to
            confirm {info.phone} is your number.
          </>
        ) : (
          'Sending you a 6 digit code.'
        )}
      </p>

      {error && (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      )}

      <form className="mt-8 space-y-5" onSubmit={verify}>
        <Field label="Verification code" htmlFor="otp-code" required>
          <Input
            id="otp-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            inputSize="lg"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="tabular tracking-[0.4em]"
          />
        </Field>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          block
          loading={verifying}
          disabled={code.length !== 6}
          iconRight={<ArrowRight className="h-4 w-4" />}
        >
          Verify and continue
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => send()}
          disabled={sending || resendIn > 0}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', sending && 'animate-spin')} />
          {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Skip for now
        </button>
      </div>

      {/* The other route, held back until the resend cooldown is up. Offering
          it immediately would just be two buttons racing the same 60 seconds,
          and every send costs either credits or a slot in the hourly cap. */}
      {info?.altChannel && resendIn === 0 && (
        <p className="t-xs mt-4 text-ink-muted">
          Still nothing?{' '}
          <button
            type="button"
            onClick={() => send(info.altChannel === 'SMS' ? 'sms' : 'email')}
            disabled={sending}
            className="inline-flex items-center gap-1.5 font-semibold text-ink underline underline-offset-4 hover:text-accent disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
          >
            {info.altChannel === 'SMS' ? (
              <>
                <Phone className="h-3 w-3" />
                Send it by SMS instead
              </>
            ) : (
              <>
                <Mail className="h-3 w-3" />
                Send it by email instead
              </>
            )}
          </button>
        </p>
      )}
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [show, setShow] = useState(false)
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // 'form' collects the details; 'verify' confirms the phone by one-time code.
  const [step, setStep] = useState<'form' | 'verify'>('form')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const formData = new FormData(e.target as HTMLFormElement)

    // Split full name
    const fullName = formData.get('full_name') as string
    const parts = fullName.trim().split(' ')
    const first_name = parts[0]
    const last_name = parts.slice(1).join(' ')

    try {
      const res = await api.auth.register({
        first_name,
        last_name,
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: pwd,
      })
      login(res.tokens.access, res.tokens.refresh, res.user)
      // Signed in now; confirm the phone before onboarding rather than after.
      setStep('verify')
    } catch (err: any) {
      setError(err.message || 'Failed to register account')
    } finally {
      setLoading(false)
    }
  }

  const checks = [
    { label: '8+ characters', ok: pwd.length >= 8 },
    { label: 'A number', ok: /\d/.test(pwd) },
    { label: 'A capital letter', ok: /[A-Z]/.test(pwd) },
  ]

  if (step === 'verify') {
    return (
      <AuthShell>
        <PhoneVerify onDone={() => navigate('/onboarding')} />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div>
        <p className="t-overline text-ink-muted">Get started</p>
        <h1 className="t-h1 mt-3 text-ink">Create your account</h1>
        <p className="t-body mt-3 text-ink-muted">
          Under two minutes, and there are no application fees, ever.
        </p>

        {error && (
          <Alert tone="danger" className="mt-6">
            {error}
          </Alert>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleRegister}>
          <Field label="Full name" htmlFor="reg-name" required>
            <Input
              id="reg-name"
              name="full_name"
              required
              autoComplete="name"
              inputSize="lg"
              placeholder="e.g. Benjamin Darko"
              icon={<User />}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" htmlFor="reg-email" required>
              <Input
                id="reg-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputSize="lg"
                placeholder="you@school.edu.gh"
                icon={<Mail />}
              />
            </Field>
            <Field label="Phone" htmlFor="reg-phone" required hint="Used for SMS deadline alerts.">
              <Input
                id="reg-phone"
                name="phone"
                required
                autoComplete="tel"
                inputSize="lg"
                placeholder="024 123 4567"
                pattern="^(\+233|0)\s?\d{2}\s?\d{3}\s?\d{4}$"
                title="Enter a Ghanaian number, e.g. 024 123 4567 or +233 24 123 4567"
                icon={<Phone />}
              />
            </Field>
          </div>

          <Field label="Password" htmlFor="reg-password" required>
            <Input
              id="reg-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              inputSize="lg"
              required
              placeholder="Create a strong password"
              icon={<Lock />}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              trailing={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              }
            />
          </Field>

          <ul className="rule-list border-y border-rule">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    'grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border transition-colors duration-[--dur]',
                    c.ok
                      ? 'border-state-positive bg-state-positive text-white'
                      : 'border-rule-strong text-transparent',
                  )}
                  aria-hidden
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className={cn('t-sm', c.ok ? 'text-ink' : 'text-ink-muted')}>{c.label}</span>
              </li>
            ))}
          </ul>

          <Checkbox
            required
            label={
              <>
                I agree to the{' '}
                <a href="#" className="font-semibold text-ink underline underline-offset-4">
                  Terms
                </a>{' '}
                and{' '}
                <a href="#" className="font-semibold text-ink underline underline-offset-4">
                  Privacy Policy
                </a>
                , including encrypted storage of my documents.
              </>
            }
          />

          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            loading={loading}
            disabled={!checks.every((c) => c.ok)}
            iconRight={<ArrowRight className="h-4 w-4" />}
          >
            Create account
          </Button>
        </form>

        <p className="t-sm mt-9 text-center text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-ink underline underline-offset-4 hover:text-accent">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
