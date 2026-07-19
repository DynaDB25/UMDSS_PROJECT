import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { cn } from '../lib/cn'

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
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
          Create your account
        </h1>
        <p className="mt-2 text-ink-500">It takes under two minutes. No application fees, ever.</p>
        
        {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}

        <form className="mt-8 space-y-4" onSubmit={handleRegister}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Full name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-400" />
              <input
                name="full_name"
                required
                placeholder="e.g. Benjamin Darko"
                className="h-12 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-400" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@school.edu.gh"
                  className="h-12 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Phone (for SMS)</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-400" />
                <input
                  name="phone"
                  placeholder="024 123 4567"
                  required
                  pattern="^(\+233|0)\s?\d{2}\s?\d{3}\s?\d{4}$"
                  title="Enter a Ghanaian number, e.g. 024 123 4567 or +233 24 123 4567"
                  className="h-12 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-400" />
              <input
                type={show ? 'text' : 'password'}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Create a strong password"
                className="h-12 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-11 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
              >
                {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-3">
              {checks.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium',
                    c.ok ? 'text-emerald-600' : 'text-ink-400',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-4 w-4 place-items-center rounded-full',
                      c.ok ? 'bg-emerald-100' : 'bg-ink-100',
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-ink-600">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200" />
            <span>
              I agree to the <a href="#" className="font-semibold text-brand-600">Terms</a> and{' '}
              <a href="#" className="font-semibold text-brand-600">Privacy Policy</a>, including
              encrypted storage of my documents.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !checks.every((c) => c.ok)}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create account'}
            {!loading && <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-ink-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
