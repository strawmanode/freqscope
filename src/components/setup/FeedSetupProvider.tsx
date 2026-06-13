import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  FEED_CONFIG_UPDATED_EVENT,
  fetchFeedConfigStatus,
  type FeedConfigStatus,
} from '../../lib/feedConfig'
import { FeedSetupModal } from './FeedSetupModal'

type FeedSetupContextValue = {
  status: FeedConfigStatus | null
  loading: boolean
  openSetup: () => void
  refresh: () => Promise<void>
}

const FeedSetupContext = createContext<FeedSetupContextValue | null>(null)

export function useFeedSetup(): FeedSetupContextValue {
  const ctx = useContext(FeedSetupContext)
  if (!ctx) {
    throw new Error('useFeedSetup must be used within FeedSetupProvider')
  }
  return ctx
}

export function FeedSetupProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<FeedConfigStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchFeedConfigStatus()
      setStatus(next)
      setModalOpen(!next.configured)
    } catch (err) {
      console.warn('[feedSetup] status check failed:', err)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onUpdated = () => {
      void refresh()
    }
    window.addEventListener(FEED_CONFIG_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(FEED_CONFIG_UPDATED_EVENT, onUpdated)
  }, [refresh])

  const openSetup = useCallback(() => {
    setModalOpen(true)
  }, [])

  const value = useMemo(
    () => ({
      status,
      loading,
      openSetup,
      refresh,
    }),
    [status, loading, openSetup, refresh],
  )

  return (
    <FeedSetupContext.Provider value={value}>
      {children}
      <FeedSetupModal
        open={modalOpen}
        initialApplication={status?.application ?? ''}
        initialContact={status?.contact ?? ''}
        issues={status?.issues ?? []}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          void refresh()
        }}
      />
    </FeedSetupContext.Provider>
  )
}
