import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
// Oswald is the card's face: here it is only on the member's card in My VIP
import '@fontsource/oswald/latin-700.css'
// The design's own stylesheet, as it was drawn (store/design/screens/store.css), and then the little that a
// drawing cannot say: a real window's size, somewhere to type, and how things move
import './styles.css'
import './app.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
