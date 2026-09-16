/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
const API = 'http://localhost:8000/api'

export async function api<T>(url: string, token?: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.status === 204 ? ({} as T) : res.json()
}

export const getGisSyncStatus = async (token: string) => {
  return api<any>('/admin/gis-sync-status', token)
}
