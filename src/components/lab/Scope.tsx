'use client'
/** Osciloscópio no estilo Simulink: fundo preto, grade, traços coloridos. */

export type Series = { y: ArrayLike<number>; x?: ArrayLike<number>; color: string; label: string; dash?: string; width?: number }
export type Marker = { x: number; color: string; label: string }

const W = 560
const H = 220
const PAD = { l: 44, r: 10, t: 22, b: 26 }

function ticks(min: number, max: number, n = 5) {
  const span = max - min || 1
  const step0 = span / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10))
  return out
}

function fmt(v: number) {
  const a = Math.abs(v)
  if (a < 1e-9) return '0'
  if (a >= 1000) return v.toFixed(0)
  if (a >= 10) return v.toFixed(0)
  if (a >= 1) return v.toFixed(1)
  return v.toFixed(2)
}

export default function Scope({
  title,
  series,
  xRange,
  yRange,
  xLabel,
  markers = [],
  hLines = [],
}: {
  title: string
  series: Series[]
  xRange: [number, number]
  yRange?: [number, number]
  xLabel: string
  markers?: Marker[]
  hLines?: { y: number; color: string; label: string }[]
}) {
  let [y0, y1] = yRange ?? [Infinity, -Infinity]
  if (!yRange) {
    for (const s of series) for (let i = 0; i < s.y.length; i++) {
      const v = s.y[i]
      if (v < y0) y0 = v
      if (v > y1) y1 = v
    }
    for (const h of hLines) { y0 = Math.min(y0, h.y); y1 = Math.max(y1, h.y) }
    const m = (y1 - y0) * 0.08 || 1
    y0 -= m
    y1 += m
  }
  const [x0, x1] = xRange
  const r1 = (n: number) => Math.round(n * 10) / 10 // evita diferença servidor/cliente na hidratação
  const sx = (x: number) => r1(PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r))
  const sy = (y: number) => r1(PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b))

  const path = (s: Series) => {
    let d = ''
    for (let i = 0; i < s.y.length; i++) {
      const x = s.x ? s.x[i] : i
      if (x < x0 || x > x1) continue
      d += `${d ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(Math.max(y0, Math.min(y1, s.y[i]))).toFixed(1)}`
    }
    return d
  }

  return (
    <figure className="rounded-xl border border-white/10 bg-black overflow-hidden">
      <figcaption className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/10 bg-[#11151d] font-mono text-[11px]">
        <span className="text-white/80 truncate">{title}</span>
        <span className="flex gap-3 shrink-0">
          {series.map(s => (
            <span key={s.label} className="flex items-center gap-1.5 text-white/60">
              <i className="inline-block w-3 h-0.5" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={title}>
        {ticks(x0, x1, 6).map(t => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} stroke="#1f2a1f" />
            <text x={sx(t)} y={H - 9} fill="#6b7280" fontSize="10" textAnchor="middle" fontFamily="monospace">{fmt(t)}</text>
          </g>
        ))}
        {ticks(y0, y1, 4).map(t => (
          <g key={`y${t}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#1f2a1f" />
            <text x={PAD.l - 6} y={sy(t) + 3} fill="#6b7280" fontSize="10" textAnchor="end" fontFamily="monospace">{fmt(t)}</text>
          </g>
        ))}
        <text x={W - PAD.r} y={PAD.t - 7} fill="#6b7280" fontSize="10" textAnchor="end" fontFamily="monospace">{xLabel}</text>
        {hLines.map(h => (
          <g key={h.label}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(h.y)} y2={sy(h.y)} stroke={h.color} strokeDasharray="4 4" />
            <text x={PAD.l + 4} y={sy(h.y) - 4} fill={h.color} fontSize="10" fontFamily="monospace">{h.label}</text>
          </g>
        ))}
        {series.map(s => (
          <path key={s.label} d={path(s)} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.4} strokeDasharray={s.dash} strokeLinejoin="round" />
        ))}
        {markers.map(m => (
          <g key={m.label}>
            <line x1={sx(m.x)} x2={sx(m.x)} y1={PAD.t} y2={H - PAD.b} stroke={m.color} strokeWidth={1.5} />
            <text x={sx(m.x) + 4} y={PAD.t + 11} fill={m.color} fontSize="10" fontFamily="monospace">{m.label}</text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
