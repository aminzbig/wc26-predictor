import { SocialComposer } from '../components/SocialComposer'
import { SocialHero } from '../components/SocialHero'
import { SocialCard } from '../components/SocialCard'
import { useSocialPosts } from '../hooks/useSocialPosts'

export function Social() {
  const { hero, feed, loading, me, isAdmin, matchList, mine, post, react, remove } = useSocialPosts()
  const canDelete = (authorId: string) => authorId === me || isAdmin

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display uppercase text-[26px] tracking-wide text-center">The Wall</h1>

      <SocialComposer matchList={matchList} onPost={post} />

      {loading ? (
        <p className="text-center opacity-60 text-[13px] py-8">Loading the wall…</p>
      ) : (
        <>
          <SocialHero
            view={hero}
            canDelete={!!hero && canDelete(hero.author_id)}
            tapped={hero ? mine[hero.id] ?? [] : []}
            onReact={k => hero && react(hero.id, k)}
            onDelete={() => hero && remove(hero.id)}
          />

          {feed.length > 0 && (
            <div className="text-center text-[11px] font-900 uppercase tracking-widest opacity-45 my-2">
              — earlier —
            </div>
          )}

          <div className="flex flex-col gap-2">
            {feed.map(v => (
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
        </>
      )}
    </div>
  )
}
