import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { liveAtcSearchUrl } from '../../lib/liveatc'
import type { Frequency } from '../../types'

type LiveAtcGroup = {
  key: string
  label: string
  detail: string
  types: string[]
}

const LIVEATC_GROUPS: LiveAtcGroup[] = [
  {
    key: 'atis',
    label: 'ATIS',
    detail: 'Airport weather, runway, and arrival/departure information.',
    types: ['ATIS'],
  },
  {
    key: 'clearance',
    label: 'Clearance',
    detail: 'IFR clearance, route amendments, and departure instructions before taxi.',
    types: ['CLD', 'CLR'],
  },
  {
    key: 'ground',
    label: 'Ground / Ramp',
    detail: 'Taxi, push, ramp movement, and surface coordination.',
    types: ['GND', 'RAMP'],
  },
  {
    key: 'tower',
    label: 'Tower',
    detail: 'Runway crossings, takeoffs, landings, and pattern traffic.',
    types: ['TWR'],
  },
  {
    key: 'tracon',
    label: 'Approach / Departure',
    detail: 'Terminal arrival sequencing, vectors, climbs, and descents.',
    types: ['APP', 'APCH', 'DEP'],
  },
  {
    key: 'center',
    label: 'Center',
    detail: 'Enroute sectors outside the terminal area.',
    types: [
      'CTR',
      'ARTCC',
      'ZTL',
      'ZBW',
      'ZNY',
      'ZDC',
      'ZJX',
      'ZHU',
      'ZFW',
      'ZAB',
      'ZLA',
      'ZOA',
      'ZSE',
      'ZDV',
      'ZLC',
      'ZMP',
      'ZAU',
      'ZID',
      'ZOB',
      'ZME',
    ],
  },
]

const GROUP_SHORT_LABELS: Record<string, string> = {
  atis: 'ATIS',
  clearance: 'CLR',
  ground: 'GND',
  tower: 'TWR',
  tracon: 'APP',
  center: 'CTR',
}

function groupAirportFrequencies(frequencies: Frequency[]) {
  return LIVEATC_GROUPS.map((group) => ({
    ...group,
    frequencies: frequencies.filter((freq) => group.types.includes(freq.type)),
  })).filter((group) => group.frequencies.length > 0)
}

interface LiveAtcModuleProps {
  icao: string
  airportName: string
  frequencies: Frequency[]
}

export function LiveAtcModule({ icao, airportName, frequencies }: LiveAtcModuleProps) {
  const [open, setOpen] = useState(false)
  const liveAtcUrl = useMemo(() => liveAtcSearchUrl(icao), [icao])
  const groups = useMemo(() => groupAirportFrequencies(frequencies), [frequencies])

  return (
    <>
      <section className="bsec bsec-liveatc metal noise">
        <div className="bsec-title">AUDIO</div>
        <div className="liveatc-module">
          <div className="liveatc-readout">
            <div className="liveatc-kicker">LIVEATC HANDOFF</div>
            <div className="liveatc-headline">
              <span className="liveatc-airport">{icao}</span>
              <span className="liveatc-name" title={airportName}>
                {airportName}
              </span>
            </div>
            <div className="liveatc-chips">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <span key={group.key} className="liveatc-chip" title={group.label}>
                    {GROUP_SHORT_LABELS[group.key] ?? group.label}
                  </span>
                ))
              ) : (
                <span className="liveatc-chip liveatc-chip-empty">NO LOCAL FREQUENCIES</span>
              )}
            </div>
          </div>
          <div className="liveatc-actions">
            <button type="button" className="liveatc-info-btn" onClick={() => setOpen(true)}>
              GUIDE
            </button>
            <a
              className="liveatc-link-btn"
              href={liveAtcUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              LIVEATC
            </a>
          </div>
        </div>
      </section>

      {open &&
        createPortal(
          <div className="liveatc-modal-backdrop" onClick={() => setOpen(false)}>
            <section className="liveatc-modal" onClick={(e) => e.stopPropagation()}>
              <div className="liveatc-modal-head">
                <div>
                  <div className="liveatc-modal-eyebrow">LIVEATC.NET</div>
                  <h2>{icao} Frequency Guide</h2>
                </div>
                <button
                  type="button"
                  className="liveatc-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close LiveATC frequency guide"
                >
                  x
                </button>
              </div>

              <p className="liveatc-modal-copy">
                LiveATC may offer feeds for several radio positions at an airport.
                Availability varies by airport, and feeds can combine multiple frequencies.
              </p>

              <div className="liveatc-guide-grid">
                {LIVEATC_GROUPS.map((group) => {
                  const matches = groups.find((g) => g.key === group.key)?.frequencies ?? []
                  return (
                    <article key={group.key} className="liveatc-guide-row">
                      <div>
                        <h3>{group.label}</h3>
                        <p>{group.detail}</p>
                      </div>
                      <div className="liveatc-guide-freqs">
                        {matches.length > 0
                          ? matches.slice(0, 4).map((freq) => (
                              <span key={`${group.key}-${freq.frequency}-${freq.label}`}>
                                {freq.frequency}
                              </span>
                            ))
                          : <span>--</span>}
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="liveatc-modal-foot">
                <span>FreqScope opens LiveATC in a separate tab and does not embed audio.</span>
                <a href={liveAtcUrl} target="_blank" rel="noopener noreferrer">
                  Open {icao} on LiveATC
                </a>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  )
}
