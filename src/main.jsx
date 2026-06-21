import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initDataLoader } from './utils/dataLoader'

// Load the pre-computed risk JSON (Python pipeline output) before first paint
// so the synchronous getNodeState()/getAllState() getters are populated. The
// boot sequence then has real data ready with zero flicker. We render either
// way — panels degrade gracefully if the data is missing.
function mount() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

initDataLoader().finally(mount)
