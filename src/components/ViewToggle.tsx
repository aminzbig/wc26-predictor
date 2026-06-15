import { Layers, LayoutGrid } from 'lucide-react'

export type View = 'deck' | 'grid'

// Segmented control for the matches header: a black track (the "rectangle") with
// the active mode shown as a white chip INSET inside it; the inactive mode is
// transparent (just dimmed label on the black track). Each segment carries its
// icon AND label so the options stay self-explanatory.
export function ViewToggle({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <div className="flex items-center gap-0.5 border-2 border-paper bg-ink p-0.5">
      {([['deck', Layers, 'Deck'], ['grid', LayoutGrid, 'Grid']] as const).map(([v, Icon, label]) =>
        <button
          key={v}
          onClick={() => setView(v)}
          aria-label={`${label} view`}
          aria-pressed={view === v}
          className={`flex items-center gap-1 px-2 h-[22px] transition-colors font-sans font-900 text-[10px] uppercase tracking-widest ${view === v ? 'bg-paper text-ink' : 'bg-transparent text-paper/50'}`}
        >
          <Icon size={13} />
          {label}
        </button>)}
    </div>
  )
}
