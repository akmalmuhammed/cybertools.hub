import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

function applyInitialTheme(): void {
  if (typeof window === 'undefined') return

  try {
    const stored = window.localStorage.getItem('theme-storage')
    const parsed = stored ? JSON.parse(stored) as { state?: { theme?: 'dark' | 'light' } } : null
    const theme = parsed?.state?.theme === 'dark' ? 'dark' : 'light'
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  } catch {
    window.document.documentElement.classList.remove('dark')
    window.document.documentElement.classList.add('light')
  }
}

applyInitialTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
