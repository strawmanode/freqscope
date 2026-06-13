export function CommStatus() {
  return (
    <div className="comm-rows-inline">
      <div className="comm-row">
        <span className="led green" />
        <span>COMM 1</span>
      </div>
      <div className="comm-row">
        <span className="led amber" />
        <span>COMM 2</span>
      </div>
      <div className="comm-row">
        <span className="led green" />
        <span>DATA</span>
      </div>
    </div>
  )
}
