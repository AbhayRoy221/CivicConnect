import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { User } from '../types'
import { useNavigate, Link } from 'react-router-dom'
import { FileText, TrendingUp, Bell, Award, ArrowRight, ArrowLeft } from 'lucide-react'

export function Login({ register = false }: { register?: boolean }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const f = new FormData(e.currentTarget)

    try {
      const body = register
        ? {
            name: f.get('name'),
            email: f.get('email'),
            password: f.get('password'),
            language: f.get('language'),
          }
        : {
            email: f.get('email'),
            password: f.get('password'),
          }

      const result = await api<{ access_token: string; user: User }>(
        register ? '/auth/register' : '/auth/login',
        undefined,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      )

      login(result.access_token, result.user)

      if (result.user.role === 'administrator') {
        navigate('/admin')
      } else if (result.user.role === 'municipal_officer') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }
    } catch (err: Error | any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen relative flex items-center justify-center bg-cover bg-center overflow-x-hidden p-4 sm:p-6 lg:p-12 font-sans"
      style={{
        backgroundImage: "url('/assets/auth/nagarmitra-login-hero.png')",
      }}
    >
      {/* Background Readability Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-white/25 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto py-6 flex flex-col justify-between">

        {/* Top Floating Navigation: Back to Home */}
        <div className="mb-6 lg:mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white/90 hover:bg-white backdrop-blur-md px-4 py-2.5 rounded-full border border-slate-200/80 shadow-sm transition-all hover:shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>Back to Home</span>
          </Link>
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px] gap-10 xl:gap-20 items-center">

          {/* Left Hero Content */}
          <section className="max-w-[720px] lg:pr-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wide shadow-xs backdrop-blur-sm mb-6">
              <span>🌿</span>
              <span>A Cleaner, Safer, Better Tomorrow</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[66px] font-black tracking-tight leading-[1.04] mb-6">
              <span className="block text-slate-950">Your City</span>
              <span className="block text-emerald-700">Our Shared Responsibility</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed max-w-[600px] mb-8">
              Report civic issues, track resolutions, and be a part of a smarter, cleaner and more livable city with NagarMitra.
            </p>

            {/* Feature Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[650px]">
              <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-xs hover:shadow-md transition">
                <div className="w-10 h-10 rounded-xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center shadow-xs mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Report</h3>
                <p className="text-xs text-slate-600 mt-0.5">Raise civic issues</p>
              </div>

              <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-xs hover:shadow-md transition">
                <div className="w-10 h-10 rounded-xl bg-blue-100/90 text-blue-700 flex items-center justify-center shadow-xs mb-3">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Track</h3>
                <p className="text-xs text-slate-600 mt-0.5">Live updates</p>
              </div>

              <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-xs hover:shadow-md transition">
                <div className="w-10 h-10 rounded-xl bg-amber-100/90 text-amber-700 flex items-center justify-center shadow-xs mb-3">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Alerts</h3>
                <p className="text-xs text-slate-600 mt-0.5">City advisories</p>
              </div>

              <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-xs hover:shadow-md transition">
                <div className="w-10 h-10 rounded-xl bg-purple-100/90 text-purple-700 flex items-center justify-center shadow-xs mb-3">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Rewards</h3>
                <p className="text-xs text-slate-600 mt-0.5">Earn civic points</p>
              </div>
            </div>
          </section>

          {/* Right Auth Card */}
          <section className="w-full">
            <div className="w-full bg-white/95 backdrop-blur-xl rounded-[32px] p-8 sm:p-10 shadow-2xl border border-white/90">

              {/* Brand Header inside card */}
              <div className="flex flex-col items-center mb-8">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-xs">
                    <span className="text-xl">🌿</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold text-2xl text-slate-900 tracking-tight leading-none">
                      Nagar<span className="text-emerald-600">Mitra</span>
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      People • Cities • Change
                    </span>
                  </div>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-center">
                  {register ? 'Create an Account' : 'Welcome Back'}
                </h2>

                <p className="text-sm text-slate-500 mt-1.5 text-center max-w-[300px]">
                  {register
                    ? 'Join NagarMitra to start making a real difference in your neighborhood.'
                    : 'Log in to report civic issues and track resolutions in real-time.'}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm font-medium border border-red-100 flex items-start gap-2.5">
                  <span className="text-base leading-none">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={submit} className="space-y-4">
                {register && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Full Name
                      </label>
                      <input
                        name="name"
                        type="text"
                        className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        placeholder="e.g. Rahul Kadam"
                        minLength={2}
                        autoComplete="name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Preferred Language
                      </label>
                      <select
                        name="language"
                        className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      >
                        <option value="en">English</option>
                        <option value="hi">हिन्दी (Hindi)</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    name="email"
                    type="email"
                    inputMode="email"
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    placeholder="e.g. rohan@citizen.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <input
                    name="password"
                    type="password"
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    placeholder="Enter your password"
                    minLength={register ? 8 : undefined}
                    maxLength={register ? 128 : undefined}
                    autoComplete={register ? 'new-password' : 'current-password'}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait active:scale-[0.99]"
                >
                  <span>
                    {loading
                      ? 'Processing...'
                      : register
                      ? 'Create Account'
                      : 'Login'}
                  </span>
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              {/* Switch between Register / Login */}
              <div className="mt-6 text-center text-xs font-semibold text-slate-500">
                {register ? (
                  <>
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="text-emerald-600 font-bold hover:text-emerald-700 hover:underline"
                    >
                      Login here
                    </Link>
                  </>
                ) : (
                  <>
                    New here?{' '}
                    <Link
                      to="/register"
                      className="text-emerald-600 font-bold hover:text-emerald-700 hover:underline"
                    >
                      Create an Account
                    </Link>
                  </>
                )}
              </div>

            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
