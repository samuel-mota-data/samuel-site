'use client'
import type { Inputs, State } from '@/lib/hvac/model'

/** Diagrama de blocos no estilo Simulink, com os valores ao vivo dentro de cada bloco. */

type B = { x: number; y: number; w: number; h: number; title: string; lines: string[]; fault?: boolean; accent?: boolean }

function Block({ b }: { b: B }) {
  const stroke = b.fault ? '#f87171' : b.accent ? '#f7e921' : 'rgba(255,255,255,0.55)'
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="#0d121b" stroke={stroke} strokeWidth={b.fault ? 2 : 1.2} />
      <text x={b.x + b.w / 2} y={b.y + 17} fill={b.fault ? '#f87171' : '#e5e7eb'} fontSize="12" fontWeight="600" textAnchor="middle" fontFamily="var(--font-sans)">
        {b.fault ? '⚠ ' : ''}{b.title}
      </text>
      {b.lines.map((l, i) => (
        <text key={i} x={b.x + b.w / 2} y={b.y + 35 + i * 14} fill="#f7e921" fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">
          {l}
        </text>
      ))}
    </g>
  )
}

function Wire({ d, label, color = 'rgba(255,255,255,0.45)' }: { d: string; label?: [number, number, string]; color?: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={1.3} markerEnd="url(#arr)" />
      {label && (
        <text x={label[0]} y={label[1]} fill="#6b7280" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)">{label[2]}</text>
      )}
    </g>
  )
}

export default function BlockDiagram({ x, s, diag }: { x: Inputs; s: State; diag: string }) {
  const blocks: B[] = [
    { x: 10, y: 30, w: 100, h: 62, title: 'Rede', lines: [`${x.volts.toFixed(0)} V · 60 Hz`] },
    { x: 150, y: 30, w: 110, h: 62, title: 'Alicate SCT', lines: [`${s.irms.toFixed(2)} A`, `${s.pElec.toFixed(0)} W`], accent: true },
    { x: 300, y: 30, w: 120, h: 62, title: 'Motor PSC', lines: [`C ${(35 * (1 - x.capLoss)).toFixed(0)} µF`, `FP ${s.pf.toFixed(2)}`], fault: x.capLoss > 0.05 },
    { x: 460, y: 30, w: 120, h: 62, title: 'Compressor', lines: [`${(s.wShaft / 1000).toFixed(2)} kW eixo`, `Tdes ${s.tDischarge.toFixed(0)} °C`], fault: s.tDischarge > 105 },
    { x: 610, y: 30, w: 145, h: 62, title: 'Condensador', lines: [`ar ${x.tAmb.toFixed(1)} °C · ${s.pCond.toFixed(1)} bar`, `Tc ${s.tCond.toFixed(1)} °C`], fault: x.condBlock > 0.05 },
    { x: 610, y: 168, w: 145, h: 62, title: 'Expansão', lines: [`SC ${s.subcool.toFixed(1)} K`], fault: x.charge < 0.95 },
    { x: 440, y: 168, w: 150, h: 62, title: 'Evaporador', lines: [`ar ${x.tIn.toFixed(1)} °C · Te ${s.tEvap.toFixed(1)}`, `SH ${s.superheat.toFixed(1)} K`], fault: x.filterBlock > 0.05 },
    { x: 150, y: 168, w: 230, h: 62, title: 'Diagnóstico (só elétrica + clima)', lines: [diag], accent: true },
  ]
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e15] overflow-x-auto">
      <div className="px-3 py-2 border-b border-white/10 bg-[#11151d] font-mono text-[11px] text-white/70">split_r410a.slx</div>
      <svg viewBox="0 0 760 250" className="w-full min-w-[640px] h-auto block" role="img" aria-label="Diagrama de blocos do split">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0L10,5L0,10z" fill="rgba(255,255,255,0.6)" />
          </marker>
        </defs>
        <Wire d="M110,61 H148" />
        <Wire d="M260,61 H298" />
        <Wire d="M420,61 H458" label={[440, 54, 'eixo']} />
        <Wire d="M580,61 H608" label={[594, 54, 'gás']} />
        <Wire d="M682,92 V166" label={[712, 132, 'líquido']} />
        <Wire d="M610,199 H592" />
        <Wire d="M520,168 V94" label={[545, 132, 'sucção']} />
        <Wire d="M205,92 V166" color="#f7e921" label={[232, 132, 'i(t), v(t)']} />
        {blocks.map(b => <Block key={b.title} b={b} />)}
      </svg>
    </div>
  )
}
