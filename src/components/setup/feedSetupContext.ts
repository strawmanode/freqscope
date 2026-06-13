import { createContext } from 'react'
import type { FeedConfigStatus } from '../../lib/feedConfig'

export type FeedSetupContextValue = {
  status: FeedConfigStatus | null
  loading: boolean
  openSetup: () => void
  refresh: () => Promise<void>
}

export const FeedSetupContext = createContext<FeedSetupContextValue | null>(null)
