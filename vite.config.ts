import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Fallback to empty string to prevent build crashes if key is missing
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    }
  }
})