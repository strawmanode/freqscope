import type { AircraftFilter, AltFilter, CallsignFilter } from '../radar/types'

const TRAFFIC_OPTIONS: AircraftFilter[] = ['AIR', 'GND', 'ALL']
const ALT_FILTER_OPTIONS: AltFilter[] = ['TWR', 'TRACON', 'CTR', 'ALL']
const CALLSIGN_OPTIONS: CallsignFilter[] = ['ALL', 'ID']

interface DisplayFiltersProps {
  trafficFilter: AircraftFilter
  altFilter: AltFilter
  callsignFilter: CallsignFilter
  onTrafficChange: (f: AircraftFilter) => void
  onAltFilterChange: (f: AltFilter) => void
  onCallsignFilterChange: (f: CallsignFilter) => void
}

function isTrafficDisabled(opt: AircraftFilter, altFilter: AltFilter): boolean {
  // GND is incompatible with TRACON and CTR
  return opt === 'GND' && (altFilter === 'TRACON' || altFilter === 'CTR')
}

function isAltDisabled(opt: AltFilter, trafficFilter: AircraftFilter): boolean {
  // TRACON and CTR are incompatible with GND
  return (opt === 'TRACON' || opt === 'CTR') && trafficFilter === 'GND'
}

export function DisplayFilters({
  trafficFilter,
  altFilter,
  callsignFilter,
  onTrafficChange,
  onAltFilterChange,
  onCallsignFilterChange,
}: DisplayFiltersProps) {
  const handleTrafficChange = (opt: AircraftFilter) => {
    if (opt === 'GND' && (altFilter === 'TRACON' || altFilter === 'CTR')) {
      // Auto-correct alt filter to TWR when switching to GND
      onAltFilterChange('TWR')
    }
    onTrafficChange(opt)
  }

  const handleAltFilterChange = (opt: AltFilter) => {
    if ((opt === 'TRACON' || opt === 'CTR') && trafficFilter === 'GND') {
      // Auto-correct traffic filter to AIR when switching to TRACON or CTR
      onTrafficChange('AIR')
    }
    onAltFilterChange(opt)
  }

  return (
    <section className="bsec bsec-filters metal noise">
      <div className="bsec-title">DISPLAY FILTERS</div>
      <div className="filter-group">
        <div className="filter-label">TRAFFIC</div>
        <div className="filter-pills">
          {TRAFFIC_OPTIONS.map((opt) => {
            const disabled = isTrafficDisabled(opt, altFilter)
            return (
              <button
                key={opt}
                type="button"
                className={`fpill ${trafficFilter === opt ? 'on' : ''} ${disabled ? 'fpill-disabled' : ''}`}
                onClick={() => !disabled && handleTrafficChange(opt)}
                style={disabled ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
      <div className="filter-group">
        <div className="filter-label">ALT FILTER</div>
        <div className="filter-pills">
          {ALT_FILTER_OPTIONS.map((opt) => {
            const disabled = isAltDisabled(opt, trafficFilter)
            return (
              <button
                key={opt}
                type="button"
                className={`fpill ${altFilter === opt ? 'on' : ''} ${disabled ? 'fpill-disabled' : ''}`}
                onClick={() => !disabled && handleAltFilterChange(opt)}
                style={disabled ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
      <div className="filter-group">
        <div className="filter-label">CALLSIGN</div>
        <div className="filter-pills">
          {CALLSIGN_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`fpill ${callsignFilter === opt ? 'on' : ''}`}
              onClick={() => onCallsignFilterChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
