'use client'
import { useState } from 'react'

type Props = {
  vendors: string[]
  vendorDetail: string[]
  transport: string[]
  core: string
  coreDetail: string
  outputs: string[]
  outputDetail: string[]
}

const W = 960
const H = 380
const VX = 16
const VW = 210
const NH = 58
const CX = 375
const CW = 250
const CH = 150
const OX = 724
const OW = 220

const vy = (i: number) => 26 + i * 86
const oy = (i: number) => vy(i)
const coreY = H / 2 - CH / 2

function inPath(i: number) {
  const x1 = VX + VW
  const y1 = vy(i) + NH / 2
  const x2 = CX
  const y2 = H / 2 - 45 + i * 30
  return `M${x1},${y1} C${x1 + 70},${y1} ${x2 - 70},${y2} ${x2},${y2}`
}

function outPath(i: number) {
  const x1 = CX + CW
  const y1 = H / 2 - 45 + i * 30
  const x2 = OX
  const y2 = oy(i) + NH / 2
  return `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`
}

export default function ArchitectureFlow({ vendors, vendorDetail, transport, core, coreDetail, outputs, outputDetail }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const dim = (i: number) => hover !== null && hover !== i

  return (
    <>
      {/* Desktop/tablet: diagrama */}
      <svg viewBox={`0 0 ${W} ${H}`} className="hidden md:block w-full h-auto" role="img" aria-label={`${vendors.join(', ')} → ${core} → ${outputs.join(', ')}`}>
        <defs>
          <linearGradient id="coreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7e921" stopOpacity="0.16" />
            <stop offset="1" stopColor="#f7e921" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Caminhos de entrada */}
        {vendors.map((_, i) => (
          <g key={`in-${i}`} opacity={dim(i) ? 0.15 : 1} style={{ transition: 'opacity .25s' }}>
            <path id={`in-${i}`} d={inPath(i)} fill="none" stroke={hover === i ? '#f7e921' : '#334155'} strokeWidth={hover === i ? 2 : 1.25} />
            <circle r="3.5" fill="#f7e921">
              <animateMotion dur={`${2.2 + i * 0.35}s`} repeatCount="indefinite" begin={`${i * 0.4}s`}>
                <mpath href={`#in-${i}`} />
              </animateMotion>
            </circle>
            <text x={VX + VW + 14} y={vy(i) + NH / 2 - 8} fill="#94a3b8" fontSize="11" fontFamily="var(--font-mono)">{transport[i]}</text>
          </g>
        ))}

        {/* Caminhos de saída */}
        {outputs.map((_, i) => (
          <g key={`out-${i}`}>
            <path id={`out-${i}`} d={outPath(i)} fill="none" stroke={hover !== null ? '#f7e921' : '#334155'} strokeOpacity={hover !== null ? 0.7 : 1} strokeWidth="1.25" style={{ transition: 'stroke .25s' }} />
            <circle r="3" fill="#34d399">
              <animateMotion dur={`${1.8 + i * 0.3}s`} repeatCount="indefinite" begin={`${0.6 + i * 0.3}s`}>
                <mpath href={`#out-${i}`} />
              </animateMotion>
            </circle>
          </g>
        ))}

        {/* Fabricantes */}
        {vendors.map((v, i) => (
          <g
            key={v}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            style={{ cursor: 'default', outline: 'none', transition: 'opacity .25s' }}
            opacity={dim(i) ? 0.35 : 1}
          >
            <rect x={VX} y={vy(i)} width={VW} height={NH} rx="10" fill="#0d121b" stroke={hover === i ? '#f7e921' : '#1e293b'} />
            <text x={VX + 16} y={vy(i) + 24} fill="#f8fafc" fontSize="14" fontWeight="600">{v}</text>
            <text x={VX + 16} y={vy(i) + 43} fill="#64748b" fontSize="11.5" fontFamily="var(--font-mono)">{vendorDetail[i]}</text>
          </g>
        ))}

        {/* Núcleo */}
        <rect x={CX} y={coreY} width={CW} height={CH} rx="16" fill="url(#coreGrad)" stroke="#f7e921" strokeOpacity="0.55" />
        <text x={CX + CW / 2} y={coreY + 64} fill="#f7e921" fontSize="17" fontWeight="700" textAnchor="middle">{core}</text>
        <text x={CX + CW / 2} y={coreY + 88} fill="#cbd5e1" fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">{coreDetail}</text>

        {/* Saídas */}
        {outputs.map((o, i) => (
          <g key={o}>
            <rect x={OX} y={oy(i)} width={OW} height={NH} rx="10" fill="#0d121b" stroke="#1e293b" />
            <circle cx={OX + 18} cy={oy(i) + 20} r="4" fill="#34d399" />
            <text x={OX + 32} y={oy(i) + 25} fill="#e2e8f0" fontSize="14" fontWeight="600">{o}</text>
            <text x={OX + 32} y={oy(i) + 43} fill="#64748b" fontSize="11" fontFamily="var(--font-mono)">{outputDetail[i]}</text>
          </g>
        ))}
      </svg>

      {/* Mobile: lista empilhada */}
      <div className="md:hidden flex flex-col gap-2">
        {vendors.map((v, i) => (
          <div key={v} className="rounded-lg border border-white/8 bg-[#0d121b] px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{v}</span>
              <span className="font-mono text-[11px] text-white/40">{transport[i]}</span>
            </div>
            <p className="font-mono text-xs text-white/45 mt-1">{vendorDetail[i]}</p>
          </div>
        ))}
        <div className="text-center text-signal py-1" aria-hidden>↓</div>
        <div className="rounded-xl border border-signal/50 bg-signal/[0.07] px-4 py-4 text-center">
          <p className="font-bold text-signal">{core}</p>
          <p className="font-mono text-xs text-white/60 mt-1">{coreDetail}</p>
        </div>
        <div className="text-center text-signal py-1" aria-hidden>↓</div>
        <div className="grid grid-cols-2 gap-2">
          {outputs.map((o, i) => (
            <div key={o} className="rounded-lg border border-white/8 bg-[#0d121b] px-3 py-2.5">
              <p className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden />
                {o}
              </p>
              <p className="font-mono text-[11px] text-white/45 mt-1">{outputDetail[i]}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
