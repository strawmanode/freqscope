import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FeedSetupProvider } from './components/setup/FeedSetupProvider'
import { Home } from './pages/Home'
import { Scope } from './pages/Scope'

export default function App() {
  return (
    <BrowserRouter>
      <FeedSetupProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scope" element={<Navigate to="/" replace />} />
          <Route path="/scope/:icao" element={<Scope />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FeedSetupProvider>
    </BrowserRouter>
  )
}
