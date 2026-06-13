import { useEffect, useState } from 'react'
import { fetchAircraftPhoto, type AircraftPhoto } from '../../lib/aircraftPhoto'
import type { SelectedAircraft } from './types'

function DetailField({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="aircraft-detail-card__field-label">{label}</div>
      <div
        className={`aircraft-detail-card__field-value${accent ? ' aircraft-detail-card__field-value--accent' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}

export function AircraftDetailCard({
  aircraft,
  onClose,
  jRingNm,
  onToggleJRing,
}: {
  aircraft: SelectedAircraft
  onClose: () => void
  jRingNm: number | null
  onToggleJRing: () => void
}) {
  const identityParts = [
    aircraft.registration ? `REG ${aircraft.registration}` : null,
    `HEX ${aircraft.hex}`,
    aircraft.category ? `CAT ${aircraft.category.toUpperCase()}` : null,
  ].filter(Boolean)

  // Card is keyed by icao24+registration at the render site, so photo state
  // resets via remount; no synchronous setState needed here.
  const [photo, setPhoto] = useState<AircraftPhoto | null>(null)
  const [photoLoaded, setPhotoLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchAircraftPhoto(aircraft.icao24, aircraft.registration).then((result) => {
      if (!cancelled) {
        setPhoto(result)
        setPhotoLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [aircraft.icao24, aircraft.registration])

  return (
    <div className="aircraft-detail-card">
      <div className="aircraft-detail-card__header">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="aircraft-detail-card__callsign">{aircraft.callsign}</div>
            {aircraft.aircraftType && (
              <div className="aircraft-detail-card__type">{aircraft.aircraftType}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="aircraft-detail-card__close"
            aria-label="Deselect aircraft"
          >
            ×
          </button>
        </div>

        {identityParts.length > 0 && (
          <div className="aircraft-detail-card__identity">
            {identityParts.join('  ·  ')}
          </div>
        )}
      </div>

      {photo ? (
        <a
          className="aircraft-detail-card__photo"
          href={photo.link}
          target="_blank"
          rel="noreferrer"
          title={`Photo © ${photo.photographer} — planespotters.net`}
        >
          <img
            src={photo.thumbnailUrl}
            alt={`${aircraft.aircraftType ?? 'Aircraft'} ${aircraft.registration ?? aircraft.callsign}`}
            loading="lazy"
          />
          <span className="aircraft-detail-card__photo-credit">
            © {photo.photographer}
          </span>
        </a>
      ) : photoLoaded ? (
        <div className="aircraft-detail-card__photo aircraft-detail-card__photo--empty">
          <span>No photo on planespotters.net for this aircraft</span>
        </div>
      ) : null}

      <div className="aircraft-detail-card__divider" />

      <div className="aircraft-detail-card__grid">
        <DetailField label="ALT MSL" value={aircraft.altitude} accent />
        <DetailField label="ALT AGL" value={aircraft.altitudeAgl} />
        <DetailField label="GROUND SPEED" value={aircraft.groundspeed} />
        <DetailField
          label="VERTICAL SPEED"
          value={`${aircraft.verticalRate}${aircraft.trend !== '—' ? ` ${aircraft.trend}` : ''}`}
        />
        <DetailField label="HEADING" value={aircraft.heading} />
        <DetailField label="FROM FIELD" value={aircraft.distanceNm} />
      </div>

      <div className="aircraft-detail-card__divider" />

      <div className="aircraft-detail-card__footer">
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
          <div>
            <div className="aircraft-detail-card__field-label">SQUAWK</div>
            <div className="aircraft-detail-card__field-value">{aircraft.squawk}</div>
          </div>
          <div className="flex items-center gap-2">
            {aircraft.phase && aircraft.phase !== 'unknown' && (
              <span
                className="aircraft-detail-card__chip aircraft-detail-card__chip--phase"
                data-phase={aircraft.phase}
              >
                {aircraft.phase.toUpperCase()}
              </span>
            )}
            <button
              type="button"
              onClick={onToggleJRing}
              title="Separation halo around this target (J)"
              className={`aircraft-detail-card__chip aircraft-detail-card__chip--jring${jRingNm ? ' is-active' : ''}`}
            >
              {jRingNm ? `J-RING ${jRingNm}` : 'J-RING'}
            </button>
          </div>
        </div>

        <div className="aircraft-detail-card__meta">
          <div>{aircraft.position}</div>
          <div style={{ marginTop: 2 }}>
            {aircraft.onGround ? 'ON GROUND' : 'AIRBORNE'}
            {'  ·  '}
            {aircraft.lastSeen}
          </div>
        </div>

        {(aircraft.isMilitary || aircraft.emergency) && (
          <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 8 }}>
            {aircraft.isMilitary && (
              <span
                style={{
                  fontSize: 8,
                  letterSpacing: 2,
                  padding: '2px 6px',
                  borderRadius: 2,
                  color: '#fbbf24',
                  border: '1px solid rgba(251, 191, 36, 0.45)',
                }}
              >
                MIL
              </span>
            )}
            {aircraft.emergency && (
              <span
                style={{
                  fontSize: 8,
                  letterSpacing: 2,
                  padding: '2px 6px',
                  borderRadius: 2,
                  color: '#f87171',
                  border: '1px solid rgba(248, 113, 113, 0.45)',
                }}
              >
                {aircraft.emergency.toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
