/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type { User } from '../types'
import { useNavigate } from 'react-router-dom'

export function Login({ register = false }: { register?: boolean }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      const body = register
        ? { name: f.get('name'), email: f.get('email'), password: f.get('password'), language: f.get('language') }
        : { email: f.get('email'), password: f.get('password') }
      const result = await api<{ access_token: string; user: User }>(register ? '/auth/register' : '/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      login(result.access_token, result.user)
      if (result.user.role === 'administrator') navigate('/admin')
      else if (result.user.role === 'municipal_officer') navigate('/admin')
      else navigate('/')
    } catch (err: Error | any) {
      setError(err.message)
    }
  }

  return (
    <div className="px-4 py-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">{register ? 'Create Account' : 'Welcome Back'}</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        {register && (
          <>
            <label className="block text-sm font-medium text-slate-700">Full Name
              <input name="name" className="mt-1 w-full rounded-lg border p-2.5 text-sm" minLength={2} required />
            </label>
            <label className="block text-sm font-medium text-slate-700">Preferred Language
              <select name="language" className="mt-1 w-full rounded-lg border p-2.5 text-sm">
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </label>
          </>
        )}
        <label className="block text-sm font-medium text-slate-700">Email Address
          <input name="email" type="email" className="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="e.g. rohan@citizen.com" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">Password
          <input name="password" type="password" className="mt-1 w-full rounded-lg border p-2.5 text-sm" minLength={8} required />
        </label>
        <button className="w-full bg-emerald-600 text-white font-medium p-3 rounded-lg hover:bg-emerald-700">{register ? 'Sign Up' : 'Login'}</button>
      </form>
      <div className="mt-6 text-center text-sm text-slate-500">
        {register ? (
          <>Already have an account? <button onClick={() => navigate('/login')} className="text-emerald-600 font-medium">Login</button></>
        ) : (
          <>New here? <button onClick={() => navigate('/register')} className="text-emerald-600 font-medium">Create Account</button></>
        )}
      </div>
    </div>
  )
}
