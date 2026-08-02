import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { cn } from '../lib/cn'
import { Alert, Button, Checkbox, Field, Input } from '../components/ui'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [show, setShow] = useState(false)
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      navigate('/onboarding')
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

  return (
    <AuthShell>
      <div>
        <p className="t-overline text-ink-muted">Get started</p>
        <h1 className="t-h1 mt-3 text-ink">Create your account</h1>
        <p className="t-body mt-3 text-ink-muted">
          Under two minutes, and there are no application fees — ever.
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
