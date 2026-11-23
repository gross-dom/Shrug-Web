import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { App } from './App'
import { SITE } from './content'
import { ROUTES, Router, type Path } from './router'

// What vc/prerender.mjs calls for each page: the page as HTML, and what its <head> says.
export { ROUTES, SITE }

export function render(path: Path) {
  return renderToString(
    <StrictMode>
      <Router start={path}>
        <App />
      </Router>
    </StrictMode>,
  )
}
