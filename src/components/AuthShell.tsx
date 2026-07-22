import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Quote, ShieldCheck, Sparkles, BellRing } from 'lucide-react'
import { Logo } from './Logo'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-800 to-brand-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative">
          <Link to="/" className="inline-block">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 backdrop-blur">
                <svg viewBox="0 0 32 32" className="h-5 w-5">
                  <path d="M16 5 L27 10.5 L16 16 L5 10.5 Z" fill="#fbbf24" />
                  <path d="M8.5 13 V19 C8.5 21.7 11.8 23.8 16 23.8 C20.2 23.8 23.5 21.7 23.5 19 V13 L16 16.5 Z" fill="#fff" />
                </svg>
              </div>
              <span className="font-display text-lg font-extrabold text-white">ScholarCircle</span>
            </div>
          </Link>
        </div>

        <div className="relative">
          <Quote className="h-10 w-10 text-gold-400/60" />
          <p className="mt-4 font-display text-3xl font-bold leading-tight text-white">
            No qualified student should miss funding because the alert came four days too late.
          </p>
          <p className="mt-4 text-brand-200">
            A unified platform for scholarship matching, secure documents and SMS-first deadline
            alerts, built for students across Ghana.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: Sparkles, text: 'Matched to awards you actually qualify for' },
              { icon: ShieldCheck, text: 'Documents encrypted and reused, upload once' },
              { icon: BellRing, text: 'SMS alerts before every deadline and interview' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-sm text-brand-100">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-gold-300" />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex -space-x-2">
            {['bg-amber-400', 'bg-rose-400', 'bg-sky-400', 'bg-emerald-400'].map((c) => (
              <div key={c} className={`h-8 w-8 rounded-full border-2 border-brand-900 ${c}`} />
            ))}
          </div>
          <p className="text-sm text-brand-200">Joining 12,800+ students this application cycle</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  )
}
