import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initReferenceData } from './lib/referenceData'

// Refresh bundled reference data (airports/frequencies/airspace) before the
// first render so the app uses the freshest copy the server can provide. This
// never rejects and is time-boxed, so it won't block startup if offline.
async function bootstrap() {
  await initReferenceData()
  createRoot(document.getElementById('root')!).render(<App />)
}

void bootstrap()
