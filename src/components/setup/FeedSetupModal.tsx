import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { notifyFeedConfigUpdated, saveFeedConfig } from '../../lib/feedConfig'

interface FeedSetupModalProps {
  open: boolean
  initialApplication: string
  initialContact: string
  issues: string[]
  onClose: () => void
  onSaved: () => void
}

export function FeedSetupModal({
  open,
  initialApplication,
  initialContact,
  issues,
  onClose,
  onSaved,
}: FeedSetupModalProps) {
  const [application, setApplication] = useState(initialApplication)
  const [contact, setContact] = useState(initialContact)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setApplication(initialApplication)
    setContact(initialContact)
    setError(null)
  }, [open, initialApplication, initialContact])

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveFeedConfig({ application, contact })
      notifyFeedConfigUpdated()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feed identity')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="liveatc-modal-backdrop feed-setup-backdrop" role="presentation">
      <div
        className="liveatc-modal feed-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-setup-title"
      >
        <div className="liveatc-modal-head">
          <div>
            <div className="liveatc-modal-eyebrow">INITIAL SETUP</div>
            <h2 id="feed-setup-title">Live radar identity</h2>
          </div>
          <button
            type="button"
            className="liveatc-modal-close"
            aria-label="Close setup dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="liveatc-modal-copy">
          ADS-B providers require every caller to identify itself. Enter your name
          and email. FreqScope saves these locally to <code>.env.local</code> and
          sends them only as upstream request headers. Do not use{' '}
          <strong>FreqScope</strong> as your name.
        </p>

        {issues.length > 0 && (
          <div className="feed-setup-issues" role="status">
            <div className="feed-setup-issues__title">Configuration required</div>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <form className="feed-setup-form" onSubmit={handleSubmit}>
          <label className="feed-setup-field">
            <span>Your name</span>
            <input
              type="text"
              name="application"
              autoComplete="name"
              placeholder="Jane Smith"
              value={application}
              onChange={(event) => setApplication(event.target.value)}
              required
            />
          </label>

          <label className="feed-setup-field">
            <span>Email</span>
            <input
              type="email"
              name="contact"
              autoComplete="email"
              placeholder="you@example.com"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              required
            />
          </label>

          {error && (
            <p className="feed-setup-error" role="alert">
              {error}
            </p>
          )}

          <div className="feed-setup-actions">
            <button type="button" className="feed-setup-secondary" onClick={onClose}>
              Set up later
            </button>
            <button type="submit" className="feed-setup-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Enable live radar'}
            </button>
          </div>
        </form>

        <div className="liveatc-modal-foot">
          <span>
            You can also edit <code>.env.local</code> manually. See README for details.
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
