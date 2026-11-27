import { Window } from '../kit/window'
import '../styles/desk/investors.css'

// Investor Portal (Dom, 27 Nov): a folder on the desk with nothing in it yet. It opens as a folder with
// nothing in it does on a Mac: its name in the bar, an empty window, and how many things at its foot.
export function PortalApp() {
  return (
    <Window className="app portal" title="Investor Portal" lightsSize="large" barSize="tall" body={{ className: 'portal__body', role: 'group', 'aria-label': 'Investor Portal: no items' }}>
      <div className="portal__empty" />
      <p className="portal__foot">0 items</p>
    </Window>
  )
}
