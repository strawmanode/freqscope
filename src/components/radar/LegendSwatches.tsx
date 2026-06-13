export function TargetLegendDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 0 1px ${color}`,
      }}
    />
  )
}

export function PolygonLegendSwatch({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="13"
      viewBox="0 0 18 13"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path
        d="M2 4.5 7 1.5 15.5 3.5 16 9.5 10 11.5 3.5 10.5 1.5 7Z"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TfrLegendSwatch({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="13"
      viewBox="0 0 18 13"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <ellipse
        cx="9"
        cy="6.5"
        rx="7.2"
        ry="4.9"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function LandmarkLegendSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 11,
        height: 11,
        background: color,
        opacity: 0.85,
        boxShadow: `0 0 0 1px ${color}`,
      }}
    />
  )
}
