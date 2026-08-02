import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/endpoints'
import { Alert, Button, Checkbox, Field, Input } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.auth.login({ email, password })
      login(res.tokens.access, res.tokens.refresh, res.user)
      navigate('/app')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div>
        <p className="t-overline text-ink-muted">Welcome back</p>
        <h1 className="t-h1 mt-3 text-ink">Sign in to ScholarCircle</h1>
        <p className="t-body mt-3 text-ink-muted">
          Pick up where you left off with your matches and applications.
        </p>

        {error && (
          <Alert tone="danger" className="mt-6">
            {error}
          </Alert>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleLogin}>
          <Field label="Email or phone" htmlFor="login-email">
            <Input
              id="login-email"
              name="email"
              type="text"
              autoComplete="username"
              inputSize="lg"
              required
              placeholder="you@school.edu.gh"
              icon={<Mail />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field
            label={
              <span className="flex w-full items-center justify-between gap-3">
                Password
                <a href="#" className="text-xs font-semibold text-ink-muted hover:text-ink">
                  Forgot password?
                </a>
              </span>
            }
            htmlFor="login-password"
          >
            <Input
              id="login-password"
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              inputSize="lg"
              required
              placeholder="Your password"
              icon={<Lock />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <Checkbox defaultChecked label="Keep me signed in on this device" />

          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            loading={loading}
            iconRight={<ArrowRight className="h-4 w-4" />}
          >
            Sign in
          </Button>
        </form>

        <div className="my-7 flex items-center gap-4">
          <span className="h-px flex-1 bg-rule" />
          <span className="t-overline text-ink-faint">or</span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        <Button variant="subtle" size="lg" block>
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
          </svg>
          Continue with Google
        </Button>

        <p className="t-sm mt-9 text-center text-ink-muted">
          New to ScholarCircle?{' '}
          <Link to="/register" className="font-semibold text-ink underline underline-offset-4 hover:text-accent">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
