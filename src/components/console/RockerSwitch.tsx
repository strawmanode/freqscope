interface RockerSwitchProps {
  label?: string
  on: boolean
  onToggle: () => void
  disabled?: boolean
  tooltip?: string
}

export function RockerSwitch({ label = '', on, onToggle, disabled = false, tooltip }: RockerSwitchProps) {
  return (
    <div className="rocker-wrap">
      {label ? <span className="rocker-label">{label}</span> : null}
      <div className="rocker-tooltip-wrap">
        <button
          type="button"
          className={`rocker ${on ? 'littop' : 'up litbot'}`}
          onClick={disabled ? undefined : onToggle}
          aria-pressed={on}
          aria-disabled={disabled}
          style={disabled ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
        >
          <div className="face top" />
          <div className="face bot" />
          <div className="glow top-glow" />
          <div className="glow bot-glow" />
        </button>
        {tooltip && <span className="rocker-tooltip">{tooltip}</span>}
      </div>
    </div>
  )
}
