import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Demo mode (mock API + role switcher) is compiled in only for Vercel preview builds
// or when VITE_DEMO=true. Production builds set it to false so the mock code is dropped.
const demo = process.env.VERCEL_ENV === 'preview' || process.env.VITE_DEMO === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(),react()],
  define: { __DEMO__: JSON.stringify(demo) },
})
