import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The kit's tokens and looks live in the stage's stylesheet; the desktop is
// the stage here, so it is loaded directly.
import './kit/stage.css'
import './styles/base.css'
import './styles/os.css'
import './styles/apps.css'
import './styles/ios.css'
import './styles/phone.css'
import { Desktop } from './os/Desktop'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Desktop />
  </StrictMode>,
)
