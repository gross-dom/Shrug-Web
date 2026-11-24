import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
// DM Sans for everything on the page; Unbounded for the four page names in the menu and nothing else;
// DM Mono for the small type (the page names in the bar, the filters, the labels on FAQ, the foot), the labels
// on placeholders and the initials in an avatar; its Medium is for the one page name that is the current page
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/unbounded/latin-700.css'
import '@fontsource/dm-mono/latin-400.css'
import '@fontsource/dm-mono/latin-500.css'
import './styles.css'
import { App } from './App'
import { pathOf, Router } from './router'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <Router start={pathOf(window.location.pathname)}>
      <App />
    </Router>
  </StrictMode>
)
// Built, the page arrives already written (vc/prerender.mjs) and is taken over as it stands; in development it is drawn afresh
if (root.firstElementChild) hydrateRoot(root, app)
else createRoot(root).render(app)
