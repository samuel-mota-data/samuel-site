'use client'
import type { Inputs, State } from '@/lib/hvac/model'

/**
 * Diagrama de blocos no estilo Simulink, em dois subsistemas:
 * ELÉTRICA (o que o sensor mede) e CICLO FRIGORÍFICO (o que o digital twin simula).
 */

type B = {
  x: number
  y: number
  w: number
  title: string
  lines: string[]
  fault?: boolean
  accent?: boolean
  dashed?: boolean
}

const H = 78

function Block({ b }: { b: B }) {
  const stroke = b.fault ? '#f87171' : b.accent ? '#f7e921' : 'rgba(255,255,255,0.5)'
  return (
    <g>
      <rect
        x={b.x}
        y={b.y}
        width={b.w}
        height={H}
        rx={6}
        fill={b.fault ? 'rgba(248,113,113,0.08)' : '#0d121b'}
        stroke={stroke}
        strokeWidth={b.fault || b.accent ? 1.6 : 1.1}
        strokeDasharray={b.dashed ? '4 3' : undefined}
      />
      {/* portas de entrada/saída, como no Simulink */}
      <path d={`M${b.x - 1},${b.y + H / 2 - 4} l5,4 l-5,4z`} fill={stroke} />
      <path d={`M${b.x + b.w},${b.y + H / 2 - 4} l5,4 l-5,4z`} fill={stroke} />
      <text x={b.x + b.w / 2} y={b.y + 20} fill={b.fault ? '#fca5a5' : '#f1f5f9'} fontSize="12.5" fontWeight="600" textAnchor="middle" fontFamily="var(--font-sans)">
        {b.fault ? '⚠ ' : ''}
        {b.title}
      </text>
      <line x1={b.x + 10} x2={b.x + b.w - 10} y1={b.y + 28} y2={b.y + 28} stroke="rgba(255,255,255,0.08)" />
      {b.lines.map((l, i) => (
        <text key={i} x={b.x + b.w / 2} y={b.y + 44 + i * 14} fill="#f7e921" fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">
          {l}
        </text>
      ))}
    </g>
  )
}

function Wire({
  d,
  label,
  color = 'rgba(255,255,255,0.45)',
}: {
  d: string
  label?: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }
  color?: string
}) {
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} markerEnd={color.startsWith('#f7') ? 'url(#arrY)' : 'url(#arr)'} />
      {label && (
        <text x={label.x} y={label.y} fill={color.startsWith('#f7') ? '#f7e921' : '#94a3b8'} fontSize="10.5" textAnchor={label.anchor ?? 'middle'} fontFamily="var(--font-mono)">
          {label.text}
        </text>
      )}
    </g>
  )
}

function Frame({ x, y, w, h, title, sub }: { x: number; y: number; w: number; h: number; title: string; sub: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="rgba(255,255,255,0.015)" stroke="rgba(148,163,184,0.25)" strokeDasharray="6 5" />
      <text x={x + 14} y={y + 20} fill="#94a3b8" fontSize="10.5" letterSpacing="2" fontFamily="var(--font-mono)">
        {title}
        <tspan fill="#64748b" letterSpacing="0"> · {sub}</tspan>
      </text>
    </g>
  )
}

export default function BlockDiagram({ x, s, diag }: { x: Inputs; s: State; diag: { label: string; resid: number } }) {
  const R1 = 52
  const R2 = 200
  const blocks: B[] = [
    // Elétrica
    { x: 26, y: R1, w: 104, title: 'Rede', lines: [`${x.volts.toFixed(0)} V`, '60 Hz'] },
    { x: 152, y: R1, w: 112, title: 'Alicate SCT', lines: [`${s.irms.toFixed(2)} A`, `${s.pElec.toFixed(0)} W`], accent: true },
    { x: 286, y: R1, w: 108, title: 'Motor PSC', lines: [`C ${(35 * (1 - x.capLoss)).toFixed(0)} µF`, `FP ${s.pf.toFixed(2)}`], fault: x.capLoss > 0.05 },
    { x: 26, y: R2, w: 104, title: 'Clima (API)', lines: [`T ext ${x.tAmb.toFixed(1)} °C`], dashed: true },
    {
      x: 152,
      y: R2,
      w: 242,
      title: 'Diagnóstico',
      lines: [...diag.label.split(" + ").slice(0, 2).map((l, i, a) => (i < a.length - 1 ? `${l} +` : l)), `resíduo ${(diag.resid * 100).toFixed(1)}%`],
      accent: diag.label === 'Normal',
      fault: diag.label !== 'Normal',
    },
    // Ciclo frigorífico
    { x: 446, y: R1, w: 150, title: 'Compressor', lines: [`${(s.wShaft / 1000).toFixed(2)} kW no eixo`, `Tdes ${s.tDischarge.toFixed(0)} °C`], fault: s.tDischarge > 105 || s.trips.length > 0 },
    { x: 722, y: R1, w: 156, title: 'Condensador', lines: [`Pc ${s.pCond.toFixed(1)} bar`, `Tc ${s.tCond.toFixed(1)} °C · ar ${x.tAmb.toFixed(0)} °C`], fault: x.condBlock > 0.05 },
    { x: 722, y: R2, w: 156, title: 'Expansão', lines: [`SC ${s.subcool.toFixed(1)} K`, `carga ${Math.round(x.charge * 100)}%`], fault: x.charge < 0.95 },
    { x: 446, y: R2, w: 150, title: 'Evaporador', lines: [`Te ${s.tEvap.toFixed(1)} °C · SH ${s.superheat.toFixed(1)} K`, `ar ${x.tIn.toFixed(0)} °C`], fault: x.filterBlock > 0.05 },
  ]
  const mid1 = R1 + H / 2
  const mid2 = R2 + H / 2
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e15] overflow-x-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#11151d] font-mono text-[11px]">
        <span className="text-white/70">split_r410a.slx</span>
        <span className={s.trips.length ? 'text-red-400' : 'text-green-400'}>{s.trips.length ? '■ parado' : '▶ rodando'}</span>
      </div>
      <svg viewBox="0 0 900 300" className="w-full min-w-[720px] h-auto block" role="img" aria-label="Diagrama de blocos do split">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0L10,5L0,10z" fill="rgba(255,255,255,0.6)" />
          </marker>
          <marker id="arrY" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0L10,5L0,10z" fill="#f7e921" />
          </marker>
        </defs>

        <Frame x={10} y={10} w={400} h={282} title="ELÉTRICA" sub="o que o sensor mede" />
        <Frame x={428} y={10} w={462} h={282} title="CICLO FRIGORÍFICO" sub="o que o digital twin simula" />

        {/* elétrica */}
        <Wire d={`M135,${mid1} H150`} />
        <Wire d={`M269,${mid1} H284`} />
        <Wire d={`M208,${R1 + H} V${R2 - 2}`} color="#f7e921" label={{ x: 216, y: (R1 + H + R2) / 2 + 4, text: 'i(t), v(t)', anchor: 'start' }} />
        <Wire d={`M135,${mid2} H150`} />

        {/* eixo: atravessa do motor para o compressor */}
        <Wire d={`M399,${mid1} H444`} label={{ x: 420, y: mid1 - 8, text: 'eixo' }} />

        {/* ciclo */}
        <Wire d={`M601,${mid1} H720`} label={{ x: 660, y: mid1 - 8, text: 'gás quente' }} />
        <Wire d={`M800,${R1 + H} V${R2 - 2}`} label={{ x: 808, y: (R1 + H + R2) / 2 + 4, text: 'líquido', anchor: 'start' }} />
        <Wire d={`M722,${mid2} H603`} label={{ x: 660, y: mid2 - 8, text: 'expandido' }} />
        <Wire d={`M521,${R2} V${R1 + H + 2}`} label={{ x: 529, y: (R1 + H + R2) / 2 + 4, text: 'sucção', anchor: 'start' }} />

        {blocks.map(b => (
          <Block key={b.title} b={b} />
        ))}
      </svg>
    </div>
  )
}
