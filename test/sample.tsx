/**
 * Health dashboard: loads the user and shows their daily steps.
 */
import React, { useState } from 'react'
import { View } from 'react-native'
import { useIsHealthDataAvailable } from './health'

export async function loadUser(id: string, retries = 3) {
  let attempt = 0
  while (attempt < retries) {
    try {
      const res = await fetch(`/api/users/${id}`)
      if (res.ok) return res.json()
      else if (res.status === 404) throw new Error('missing')
    } catch (err) {
      attempt++
    }
  }
  return null
}

export const Total = ({ items }: { items: number[] }) => {
  const total = items.filter(x => x > 0).reduce((a, b) => a + b, 0)
  items.forEach(i => {
    if (i > 100) console.log('big', i)
  })
  return <div>{total > 0 ? total : 'none'}</div>
}

class Cart {
  add(x: number) { this.items.push(x); this.count++ }
}

export async function expoFetch(url: string, init?: RequestInit, ...extraHeaders: string[]) {
  return fetch(url, init)
}

export function HealthCard({ userId }: { userId: string }) {
  const isAvailable = useIsHealthDataAvailable();
  const [stepCount, setStepCount] = useState(0);
  if (!isAvailable) setStepCount(userProfile?.dailySteps ?? 0);
  return <View>{stepCount}</View>;
}
