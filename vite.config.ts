import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { aircraftApiPlugin } from './server/aircraftApiPlugin'

function loadServerEnv(mode: string): void {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value
  }
}

export default defineConfig(({ mode }) => {
  loadServerEnv(mode)

  return {
    plugins: [react(), tailwindcss(), aircraftApiPlugin()],
    define: {
      CESIUM_BASE_URL: JSON.stringify('/'),
    },
    optimizeDeps: {
      include: ['cesium'],
    },
    build: {
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        input: 'index.html',
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'cesium',
                test: /[\\/]@cesium[\\/]/,
                priority: 30,
              },
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    server: {
      strictPort: true,
    },
  }
})
