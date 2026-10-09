import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

async function start() {
  if (__DEMO__) (await import('./demo/boot')).seedDemoSession()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
      <App />
      </AuthProvider>
    </StrictMode>,
  )
}

start()
