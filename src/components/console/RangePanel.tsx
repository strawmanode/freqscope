import { CommStatus } from './CommStatus'

const RANGE_OPTIONS = [5, 10, 20, 40, 80, 160] as const
const TOOL_OPTIONS = ['LEGEND', 'LNAV', 'WX MAP', 'CONFIG'] as const

interface RangePanelProps {
  rangeNm: number
  onRangeChange: (nm: number) => void
  onConfigOpen: () => void
  onLegendOpen: () => void
  onResetView: () => void
}

export function RangePanel({
  rangeNm,
  onRangeChange,
  onConfigOpen,
  onLegendOpen,
  onResetView,
}: RangePanelProps) {
  return (
    <aside className="side-panel metal noise">
      <div className="inset">
        <div className="section-title">STATUS</div>
        <CommStatus />
      </div>

      <div className="inset grow range-inset">
        <div className="section-title">RANGE</div>
        <div className="range-grid" role="group" aria-label="Radar range">
          {RANGE_OPTIONS.map((nm) => (
            <button
              key={nm}
              type="button"
              className={`btn range-btn ${nm === 20 ? 'worn' : ''} ${rangeNm === nm ? 'active' : ''}`}
              aria-pressed={rangeNm === nm}
              onClick={() => onRangeChange(nm)}
            >
              <span className="range-value">{nm}</span>
              <span className="range-unit">NM</span>
            </button>
          ))}
        </div>
      </div>

      <div className="inset">
        <div className="section-title">TOOLS</div>
        {TOOL_OPTIONS.map((tool) => (
          <div key={tool} className="btn-tooltip-wrap">
            {tool === 'CONFIG' ? (
              <button type="button" className="btn" onClick={onConfigOpen}>{tool}</button>
            ) : tool === 'LEGEND' ? (
              <button type="button" className="btn" onClick={onLegendOpen}>{tool}</button>
            ) : tool === 'LNAV' ? (
              <>
                <button type="button" className="btn" onClick={onResetView}>RESET VIEW</button>
                <span className="btn-tooltip">Reset camera to default position</span>
              </>
            ) : (
              <>
                <button type="button" className="btn disabled" disabled>{tool}</button>
                <span className="btn-tooltip">Slotted for future development</span>
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
