import { useContext } from 'react'
import { FeedSetupContext } from './feedSetupContext'

export function useFeedSetup() {
  const ctx = useContext(FeedSetupContext)
  if (!ctx) {
    throw new Error('useFeedSetup must be used within FeedSetupProvider')
  }
  return ctx
}
