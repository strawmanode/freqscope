import {
  useCallback,
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
import { FeedSetupContext } from './feedSetupContext'

export function FeedSetupProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<FeedConfigStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
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
    let cancelled = false

    void (async () => {
      try {
        const next = await fetchFeedConfigStatus()
        if (cancelled) return
        setStatus(next)
        setModalOpen(!next.configured)
      } catch (err) {
        if (cancelled) return
        console.warn('[feedSetup] status check failed:', err)
        setStatus(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

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

  const modalKey = modalOpen
    ? `${status?.application ?? ''}:${status?.contact ?? ''}`
    : 'closed'

  return (
    <FeedSetupContext.Provider value={value}>
      {children}
      <FeedSetupModal
        key={modalKey}
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
