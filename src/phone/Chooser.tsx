import { SITE } from '../data/site'
import { goToVariant, VARIANTS } from './variants'

// The list of versions, for choosing between them. It is scaffolding for the
// prototype, not part of any of them.

export function Chooser() {
  return (
    <div className="chooser">
      <header className="chooser__head">
        <div className="chooser__mark" aria-hidden>
          {SITE.mark}
        </div>
        <h2 className="chooser__title">Ten ways to be on a phone</h2>
        <p className="chooser__sub">From the most familiar to the least. Tap one to try it; the bar at the top brings you back.</p>
      </header>
      <ol className="chooser__list">
        {VARIANTS.map((v) => (
          <li key={v.id}>
            <button type="button" className="chooser__item" onClick={() => goToVariant(v.id)}>
              <span className="chooser__n">{v.id}</span>
              <span className="chooser__text">
                <b>{v.name}</b>
                <span>{v.pitch}</span>
                <em>{v.uses}</em>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
