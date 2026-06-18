import { SocialComposer } from '../components/SocialComposer'
import { SocialCard } from '../components/SocialCard'
import { useSocialPosts } from '../hooks/useSocialPosts'

export function Social() {
  const { hero, feed, loading, me, isAdmin, matchList, mine, post, react, remove } = useSocialPosts()
  const canDelete = (authorId: string) => authorId === me || isAdmin
  // All posts render at the same size — newest first, no oversized lead card.
  const posts = hero ? [hero, ...feed] : feed

  return (
    <div className="flex flex-col gap-2">
      <SocialComposer matchList={matchList} onPost={post} />

      {loading ? (
        <p className="text-center opacity-60 text-[13px] py-8">Loading the wall…</p>
      ) : posts.length === 0 ? (
        <div className="border-[3px] border-dashed border-ink p-8 text-center">
          <p className="font-display uppercase text-[18px]">Be the first to post</p>
          <p className="text-[13px] opacity-60 mt-1">Start the trash talk below ⚽</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map(v => (
            <SocialCard
              key={v.id}
              view={v}
              canDelete={canDelete(v.author_id)}
              tapped={mine[v.id] ?? []}
              onReact={k => react(v.id, k)}
              onDelete={() => remove(v.id)}
            />
          ))}
        </div>
      )}

      {/* Spacer so the last card clears the docked composer pill. */}
      <div aria-hidden className="h-16" />
    </div>
  )
}
