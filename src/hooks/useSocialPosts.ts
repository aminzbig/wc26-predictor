import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  upsertPost, removePost, bump, toView, addReaction, byKickoff,
  type SocialPostRow, type PlayerLite, type MatchLite, type PostView,
  type Reaction, type SocialColor, type SocialFont, type SocialScale,
} from '../lib/social'

// "Reactions I tapped" live only on this device — we don't track per-user reactions
// server-side (counts are unlimited-tap). Persisted so highlights survive a reload.
const MINE_KEY = 'wc26-social-reactions'
function loadMine(): Record<string, Reaction[]> {
  try { return JSON.parse(localStorage.getItem(MINE_KEY) ?? '{}') } catch { return {} }
}

export function useSocialPosts() {
  const { player } = useAuth()
  const [rows, setRows] = useState<SocialPostRow[]>([])
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({})
  const [matches, setMatches] = useState<Record<string, MatchLite>>({})
  const [mine, setMine] = useState<Record<string, Reaction[]>>(loadMine)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [p, m, posts] = await Promise.all([
        supabase.from('players').select('id, name, flag_code, avatar_url'),
        supabase.from('matches').select('id, home_code, away_code, home_label, away_label, kickoff_at'),
        supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      if (!active) return
      const pmap: Record<string, PlayerLite> = {}
      for (const r of p.data ?? []) pmap[r.id] = { name: r.name, flag_code: r.flag_code, avatar_url: r.avatar_url }
      const mmap: Record<string, MatchLite> = {}
      for (const r of m.data ?? []) mmap[r.id] = r as MatchLite
      setPlayers(pmap)
      setMatches(mmap)
      setRows((posts.data ?? []) as SocialPostRow[])
      setLoading(false)
    }
    load()

    const ch = supabase.channel('social_posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_posts' },
        (payload) => setRows(prev => upsertPost(prev, payload.new as SocialPostRow)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'social_posts' },
        (payload) => setRows(prev => upsertPost(prev, payload.new as SocialPostRow)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'social_posts' },
        (payload) => setRows(prev => removePost(prev, (payload.old as { id: string }).id)))
      .subscribe()

    return () => { active = false; supabase.removeChannel(ch) }
  }, [])

  const views: PostView[] = useMemo(
    () => rows.map(r => toView(r, players, matches)),
    [rows, players, matches],
  )

  async function post(body: string, color: SocialColor, font: SocialFont, scale: SocialScale, matchId: string | null) {
    if (!player) return
    await supabase.from('social_posts').insert({
      author_id: player.id, body, color, font, scale, match_id: matchId,
    })
    // INSERT echo via realtime adds the card.
  }

  async function react(postId: string, key: Reaction) {
    setRows(prev => prev.map(r => (r.id === postId ? bump(r, key) : r))) // optimistic
    setMine(prev => {
      const next = { ...prev, [postId]: addReaction(prev[postId] ?? [], key) }
      try { localStorage.setItem(MINE_KEY, JSON.stringify(next)) } catch { /* ignore quota */ }
      return next
    })
    await supabase.rpc('react_to_post', { p_id: postId, kind: key })
    // UPDATE echo reconciles the true count.
  }

  async function remove(postId: string) {
    setRows(prev => removePost(prev, postId)) // optimistic
    await supabase.from('social_posts').delete().eq('id', postId)
  }

  const matchList: MatchLite[] = useMemo(
    () => Object.values(matches).sort(byKickoff),
    [matches],
  )

  return {
    hero: views[0] ?? null,
    feed: views.slice(1),
    loading,
    me: player?.id ?? null,
    isAdmin: player?.is_admin ?? false,
    matchList,
    mine,
    post, react, remove,
  }
}
