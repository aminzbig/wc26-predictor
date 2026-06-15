import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  upsertPost, removePost, bump, toView,
  type SocialPostRow, type PlayerLite, type MatchLite, type PostView,
  type Reaction, type SocialColor,
} from '../lib/social'

export function useSocialPosts() {
  const { player } = useAuth()
  const [rows, setRows] = useState<SocialPostRow[]>([])
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({})
  const [matches, setMatches] = useState<Record<string, MatchLite>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [p, m, posts] = await Promise.all([
        supabase.from('players').select('id, name, flag_code'),
        supabase.from('matches').select('id, home_code, away_code, home_label, away_label'),
        supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      if (!active) return
      const pmap: Record<string, PlayerLite> = {}
      for (const r of p.data ?? []) pmap[r.id] = { name: r.name, flag_code: r.flag_code }
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

  async function post(body: string, color: SocialColor, matchId: string | null) {
    if (!player) return
    await supabase.from('social_posts').insert({
      author_id: player.id, body, color, match_id: matchId,
    })
    // INSERT echo via realtime adds the card.
  }

  async function react(postId: string, key: Reaction) {
    setRows(prev => prev.map(r => (r.id === postId ? bump(r, key) : r))) // optimistic
    await supabase.rpc('react_to_post', { p_id: postId, kind: key })
    // UPDATE echo reconciles the true count.
  }

  async function remove(postId: string) {
    setRows(prev => removePost(prev, postId)) // optimistic
    await supabase.from('social_posts').delete().eq('id', postId)
  }

  const matchList: MatchLite[] = useMemo(() => Object.values(matches), [matches])

  return {
    hero: views[0] ?? null,
    feed: views.slice(1),
    loading,
    me: player?.id ?? null,
    isAdmin: player?.is_admin ?? false,
    matchList,
    post, react, remove,
  }
}
