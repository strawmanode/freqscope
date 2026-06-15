import fs from 'fs'
import path from 'path'

export class FeedConfigurationError extends Error {
  readonly status = 500

  constructor(message: string) {
    super(message)
    this.name = 'FeedConfigurationError'
  }
}

const PLACEHOLDER_FEED_VALUES = new Set([
  'freqscope',
  'local development',
  'yourappname',
  'your-app-name',
  'yourname',
  'you@example.com',
  'your-email@example.com',
])

const PLACEHOLDER_FEED_FRAGMENTS = [
  'freqscope',
  'local development',
  'yourappname',
  'your-app-name',
  'yourname',
  'you@example.com',
  'your-email@example.com',
]

export type FeedConfigStatus = {
  configured: boolean
  application: string | null
  contact: string | null
  issues: string[]
}

function envString(name: string): string | null {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

/**
 * Directory that holds the writable `.env.local` feed-identity file.
 *
 * In the Vite dev server this is the project root (process.cwd()). In the
 * packaged desktop app the project directory is read-only, so the Electron
 * main process sets FREQSCOPE_CONFIG_DIR to a writable per-user location
 * (app.getPath('userData')).
 */
export function feedConfigDir(): string {
  return process.env.FREQSCOPE_CONFIG_DIR?.trim() || process.cwd()
}

function envLocalPath(): string {
  return path.join(feedConfigDir(), '.env.local')
}

/**
 * Loads `.env.local` from {@link feedConfigDir} into process.env without
 * overwriting values that are already set. Vite loads env vars itself, so this
 * is only used by the standalone production server / Electron main process.
 */
export function loadEnvLocal(): void {
  const envPath = envLocalPath()
  if (!fs.existsSync(envPath)) return

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

function fieldLabel(name: string): string {
  if (name === 'AIRCRAFT_FEED_APPLICATION' || name === 'AIRCRAFT_FEED_X_APPLICATION') {
    return 'Your name'
  }
  if (name === 'AIRCRAFT_FEED_CONTACT' || name === 'AIRCRAFT_FEED_X_CONTACT') {
    return 'Email'
  }
  return name
}

export const feedFieldLabel = fieldLabel

export function validateFeedIdentityValue(name: string, value: string): void {
  const normalized = value.toLowerCase()
  const isPlaceholder =
    PLACEHOLDER_FEED_VALUES.has(normalized) ||
    PLACEHOLDER_FEED_FRAGMENTS.some((fragment) => normalized.includes(fragment))

  if (isPlaceholder) {
    throw new FeedConfigurationError(
      `${fieldLabel(name)} must be your own name or email, not FreqScope or the example placeholder values`,
    )
  }
}

function validateEmail(contact: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    throw new FeedConfigurationError('Email must be a valid email address')
  }
}

function readOptionalFeedEnv(name: string): string | null {
  const value = envString(name)
  if (!value) return null
  validateFeedIdentityValue(name, value)
  return value
}

function readRequiredFeedEnv(name: string): string {
  const value = envString(name)
  if (!value) {
    throw new FeedConfigurationError(
      `${fieldLabel(name)} must be set in .env.local before using the live aircraft feed`,
    )
  }
  validateFeedIdentityValue(name, value)
  return value
}

export function getFeedConfigStatus(): FeedConfigStatus {
  const application =
    readOptionalFeedEnv('AIRCRAFT_FEED_X_APPLICATION') ??
    envString('AIRCRAFT_FEED_APPLICATION')
  const contact = envString('AIRCRAFT_FEED_CONTACT')
  const issues: string[] = []

  if (!application) {
    issues.push('Your name is missing')
  } else {
    try {
      validateFeedIdentityValue('AIRCRAFT_FEED_APPLICATION', application)
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err))
    }
  }

  if (!contact) {
    issues.push('Email is missing')
  } else {
    try {
      validateFeedIdentityValue('AIRCRAFT_FEED_CONTACT', contact)
      validateEmail(contact)
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err))
    }
  }

  for (const name of [
    'AIRCRAFT_FEED_USER_AGENT',
    'AIRCRAFT_FEED_X_APPLICATION',
    'AIRCRAFT_FEED_X_CONTACT',
  ] as const) {
    const value = envString(name)
    if (!value) continue
    try {
      validateFeedIdentityValue(name, value)
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err))
    }
  }

  return {
    configured: issues.length === 0,
    application,
    contact,
    issues,
  }
}

/** Ensures feed identity env vars are valid; throws FeedConfigurationError when not. */
export function assertFeedConfigured(): void {
  readRequiredFeedEnv('AIRCRAFT_FEED_CONTACT')
  if (readOptionalFeedEnv('AIRCRAFT_FEED_X_APPLICATION') === null) {
    readRequiredFeedEnv('AIRCRAFT_FEED_APPLICATION')
  }
}

function upsertEnvLocal(updates: Record<string, string>): void {
  const envPath = envLocalPath()
  fs.mkdirSync(path.dirname(envPath), { recursive: true })
  const lines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8').split('\n')
    : []

  for (const [key, value] of Object.entries(updates)) {
    const prefix = `${key}=`
    const line = `${key}=${value}`
    const index = lines.findIndex((entry) => entry.startsWith(prefix))
    if (index >= 0) lines[index] = line
    else lines.push(line)
  }

  const body = lines
    .join('\n')
    .replace(/\n+$/, '')
  fs.writeFileSync(envPath, `${body}\n`, 'utf8')
}

export function applyFeedConfig(input: {
  application: string
  contact: string
}): FeedConfigStatus {
  const application = input.application.trim()
  const contact = input.contact.trim()

  if (!application) {
    throw new FeedConfigurationError('Your name is required')
  }
  if (!contact) {
    throw new FeedConfigurationError('Email is required')
  }

  validateFeedIdentityValue('AIRCRAFT_FEED_APPLICATION', application)
  validateFeedIdentityValue('AIRCRAFT_FEED_CONTACT', contact)
  validateEmail(contact)

  process.env.AIRCRAFT_FEED_APPLICATION = application
  process.env.AIRCRAFT_FEED_CONTACT = contact

  upsertEnvLocal({
    AIRCRAFT_FEED_APPLICATION: application,
    AIRCRAFT_FEED_CONTACT: contact,
  })

  return getFeedConfigStatus()
}
