import { supabase } from './supabase'

export function nameToSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
export function slugToEmail(slug: string): string {
  return `${slug}@players.wc26.local`
}

export async function signUp(name: string, pin: string) {
  const slug = nameToSlug(name)
  if (!slug) throw new Error('Please enter your name')
  if (pin.length < 6) throw new Error('PIN must be at least 6 characters')
  const { error } = await supabase.auth.signUp({
    email: slugToEmail(slug), password: pin,
    options: { data: { name: name.trim(), slug } },
  })
  if (error) throw new Error(error.message)
}

export async function login(name: string, pin: string) {
  const slug = nameToSlug(name)
  const { error } = await supabase.auth.signInWithPassword({
    email: slugToEmail(slug), password: pin,
  })
  if (error) throw new Error('Wrong name or PIN')
}

export async function logout() {
  await supabase.auth.signOut()
}
