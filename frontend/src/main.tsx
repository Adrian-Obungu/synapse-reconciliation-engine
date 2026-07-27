/**
 * Application entry point for the Synapse Reconciliation Engine.
 * Mounts the root React component into the DOM.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
