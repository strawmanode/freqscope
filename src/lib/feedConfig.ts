export type FeedConfigStatus = {
  configured: boolean
  application: string | null
  contact: string | null
  issues: string[]
}

export async function fetchFeedConfigStatus(): Promise<FeedConfigStatus> {
  const res = await fetch('/api/feed-config')
  if (!res.ok) {
    throw new Error(`Feed config status ${res.status}`)
  }
  return (await res.json()) as FeedConfigStatus
}

export async function saveFeedConfig(input: {
  application: string
  contact: string
}): Promise<FeedConfigStatus> {
  const res = await fetch('/api/feed-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as FeedConfigStatus & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Feed config save ${res.status}`)
  }
  return data
}

export function isFeedConfigurationError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('feed identity') ||
    lower.includes('.env.local') ||
    lower.includes('aircraft_feed_')
  )
}

export const FEED_CONFIG_UPDATED_EVENT = 'freqscope:feed-config-updated'

export function notifyFeedConfigUpdated(): void {
  window.dispatchEvent(new CustomEvent(FEED_CONFIG_UPDATED_EVENT))
}
