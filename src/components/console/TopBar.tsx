interface TopBarProps {
  icao: string
  airportName: string
  aircraftCount: number
  zuluStr: string
  onBack: () => void
}

export function TopBar({
  icao,
  airportName,
  aircraftCount,
  zuluStr,
  onBack,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button type="button" className="back-link" onClick={onBack}>
          ← Search
        </button>
        <span className="icao">{icao}</span>
      </div>
      <div
        className="top-bar-center"
        style={{ textAlign: 'center', minWidth: 0, flex: 1, overflow: 'hidden' }}
      >
        <span className="airport-name">{airportName}</span>
      </div>
      <div className="top-right">
        <div className="top-right-count">{aircraftCount} AIRCRAFT</div>
        <div>{zuluStr}</div>
      </div>
    </header>
  )
}
