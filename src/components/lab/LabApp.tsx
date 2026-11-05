'use client'
import { useMemo, useState } from 'react'
import { NOMINAL, P, prognosis, simulate, spectrum, waveform, type Inputs } from '@/lib/hvac/model'
import { diagnose } from '@/lib/hvac/diagnose'
import { UFPB } from '@/lib/hvac/ufpb'
import BlockDiagram from './BlockDiagram'
import Scope from './Scope'

const YELLOW = '#f7e921'
const CYAN = '#22d3ee'
const RED = '#f87171'
const GREEN = '#4ade80'

type SliderDef = { key: keyof Inputs; label: string; min: number; max: number; step: number; unit: string; pct?: boolean }

const AMBIENT: SliderDef[] = [
  { key: 'tAmb', label: 'Temperatura externa', min: 15, max: 42, step: 0.5, unit: '°C' },
  { key: 'tIn', label: 'Temperatura interna', min: 18, max: 30, step: 0.5, unit: '°C' },
  { key: 'volts', label: 'Tensão da rede', min: 190, max: 245, step: 1, unit: 'V' },
]
const FAULTS: SliderDef[] = [
  { key: 'condBlock', label: 'Condensador obstruído', min: 0, max: 0.8, step: 0.05, unit: '%', pct: true },
  { key: 'filterBlock', label: 'Filtro do evaporador sujo', min: 0, max: 0.8, step: 0.05, unit: '%', pct: true },
  { key: 'capLoss', label: 'Capacitor degradado', min: 0, max: 0.6, step: 0.05, unit: '%', pct: true },
  { key: 'charge', label: 'Carga de gás', min: 0.3, max: 1, step: 0.05, unit: '%', pct: true },
]

const PRESETS: { label: string; x: Partial<Inputs> }[] = [
  { label: 'Sem falha', x: {} },
  { label: 'CI30', x: { condBlock: 0.3 } },
  { label: 'CI60', x: { condBlock: 0.6 } },
  { label: 'CD30', x: { capLoss: 0.3 } },
  { label: 'FI50', x: { filterBlock: 0.5 } },
  { label: 'CD30+CI60', x: { capLoss: 0.3, condBlock: 0.6 } },
  { label: 'Vazamento', x: { charge: 0.6 } },
  { label: 'Dia quente', x: { tAmb: 38 } },
]

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] sm:text-xs text-signal uppercase tracking-[0.22em] mb-3">{children}</p>
}

function Slider({ d, value, onChange }: { d: SliderDef; value: number; onChange: (v: number) => void }) {
  const shown = d.pct ? `${Math.round(value * 100)}` : value.toFixed(d.step < 1 ? 1 : 0)
  const active = d.pct && (d.key === 'charge' ? value < 0.999 : value > 0.001)
  return (
    <label className="block">
      <span className="flex justify-between text-xs mb-1">
        <span className={active ? 'text-red-400' : 'text-white/70'}>{d.label}</span>
        <span className="font-mono text-signal">{shown} {d.unit}</span>
      </span>
      <input
        type="range"
        min={d.min}
        max={d.max}
        step={d.step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full accent-[#f7e921]"
      />
    </label>
  )
}

function Meter({ label, value, limit, unit, invert = false, min = 0 }: { label: string; value: number; limit: number; unit: string; invert?: boolean; min?: number }) {
  // invert: o perigo é ficar ABAIXO do limite (pressostato de baixa)
  const max = invert ? limit * 2.5 : limit * 1.25
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const lim = (limit - min) / (max - min)
  const bad = invert ? value < limit : value > limit
  const warn = invert ? value < limit * 1.25 : value > limit * 0.85
  const color = bad ? RED : warn ? '#fbbf24' : GREEN
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-white/60">{label}</span>
        <span className="font-mono" style={{ color }}>{value.toFixed(1)} {unit}</span>
      </div>
      <div className="relative h-2 rounded bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${frac * 100}%`, background: color }} />
        <div className="absolute -inset-y-1 w-px bg-white/70" style={{ left: `${lim * 100}%` }} title={`limite ${limit} ${unit}`} />
      </div>
    </div>
  )
}

function ValidationChart() {
  const rows = UFPB.map(c => ({ ...c, model: simulate({ ...NOMINAL, ...c.x }).irms / simulate(NOMINAL).irms - 1 }))
  const W = 640, rowH = 34, L = 170, max = 0.45
  const sx = (v: number) => L + ((v + 0.05) / (max + 0.05)) * (W - L - 20)
  const H = rows.length * rowH + 30
  return (
    <div className="rounded-xl border border-white/10 bg-black overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] h-auto block" role="img" aria-label="Medido na UFPB vs modelo">
        {[-0.05, 0, 0.1, 0.2, 0.3, 0.4].map(t => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={8} y2={H - 20} stroke={t === 0 ? '#4b5563' : '#1f2a1f'} />
            <text x={sx(t)} y={H - 6} fill="#6b7280" fontSize="10" textAnchor="middle" fontFamily="monospace">{`${Math.round(t * 100)}%`}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = 12 + i * rowH
          return (
            <g key={r.id}>
              <text x={L - 10} y={y + 11} fill={r.use === 'fit' ? '#e5e7eb' : '#9ca3af'} fontSize="11" textAnchor="end">{r.name}</text>
              <text x={L - 10} y={y + 24} fill="#6b7280" fontSize="9" textAnchor="end" fontFamily="monospace">{r.use === 'fit' ? 'calibração' : 'validação'}</text>
              <rect x={Math.min(sx(0), sx(r.dI))} y={y} width={Math.abs(sx(r.dI) - sx(0))} height={10} fill="#9ca3af" />
              <rect x={Math.min(sx(0), sx(r.model))} y={y + 13} width={Math.abs(sx(r.model) - sx(0))} height={10} fill={YELLOW} />
            </g>
          )
        })}
      </svg>
      <div className="flex gap-4 px-3 py-2 border-t border-white/10 font-mono text-[11px] text-white/60">
        <span className="flex items-center gap-1.5"><i className="w-3 h-2 bg-[#9ca3af] inline-block" />medido (UFPB)</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-2 bg-signal inline-block" />gêmeo digital</span>
        <span className="ml-auto">Δ corrente vs sem falha</span>
      </div>
    </div>
  )
}

export default function LabApp() {
  const [x, setX] = useState<Inputs>(NOMINAL)
  const [kind, setKind] = useState<'cond' | 'leak'>('cond')
  const [rate, setRate] = useState(0.8)

  const s = useMemo(() => simulate(x), [x])
  const diag = useMemo(() => diagnose(x, s), [x, s])
  const wave = useMemo(() => waveform(x, s), [x, s])
  const base = useMemo(() => {
    const st = simulate(NOMINAL)
    return waveform(NOMINAL, st)
  }, [])
  const spec = useMemo(() => {
    const sp = spectrum(wave.i, wave.fs)
    const db = Array.from(sp.mag, m => 20 * Math.log10(m + 1e-4))
    return { db, f: db.map((_, k) => k * sp.df) }
  }, [wave])
  const prog = useMemo(() => {
    const p = prognosis(kind, rate / 100)
    // Depois da parada o compressor está desligado: não há o que medir.
    return { ...p, rows: p.tripDay !== null ? p.rows.slice(0, p.tripDay + 1) : p.rows }
  }, [kind, rate])

  const n = Math.round(wave.fs * 0.05)
  const tMs = Array.from({ length: n }, (_, j) => (j / wave.fs) * 1000)
  const set = (k: keyof Inputs) => (v: number) => setX(p => ({ ...p, [k]: v }))
  const lead = prog.alertDay !== null && prog.tripDay !== null ? prog.tripDay - prog.alertDay : null

  return (
    <div className="min-h-screen bg-ink text-white overflow-x-clip">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-ink/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          <a href="/" className="font-display font-bold tracking-tight text-lg">
            Samuel Mota<span className="text-signal">.</span>
          </a>
          <span className="font-mono text-xs text-white/50">/lab · gêmeo digital</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-16">
        <header className="max-w-3xl">
          <Kicker>Lab · Manutenção preditiva</Kicker>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
            Falhas de um ar-condicionado vistas só pela energia
          </h1>
          <p className="mt-4 text-white/60 text-base sm:text-lg">
            Gêmeo digital de um split de 18.000 BTU, calibrado com medições reais de laboratório. Injete falhas e veja a assinatura
            elétrica, a proteção do compressor e o diagnóstico com o mínimo de sensores.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 font-mono text-xs">
            <a href="https://github.com/samuel-mota-data/hvac-fdd-lab" target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-white/15 text-white/80 hover:border-signal hover:text-signal transition-colors">
              Análise dos dados reais (Python) ↗
            </a>
            <a href="https://github.com/samuel-mota-data/samuel-site/tree/main/src/lib/hvac" target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-white/15 text-white/80 hover:border-signal hover:text-signal transition-colors">
              Código do gêmeo digital ↗
            </a>
          </div>
        </header>

        {/* Simulador */}
        <section className="grid lg:grid-cols-[290px_1fr] gap-6 items-start">
          <aside className="rounded-xl border border-white/10 bg-panel p-4 space-y-5 lg:sticky lg:top-20">
            <div>
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-2">Cenários</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setX({ ...NOMINAL, ...p.x })}
                    className="px-2 py-1 rounded border border-white/15 text-[11px] font-mono text-white/75 hover:border-signal hover:text-signal transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest">Ambiente</p>
              {AMBIENT.map(d => <Slider key={d.key} d={d} value={x[d.key]} onChange={set(d.key)} />)}
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[11px] text-red-400/80 uppercase tracking-widest">Falhas injetadas</p>
              {FAULTS.map(d => <Slider key={d.key} d={d} value={x[d.key]} onChange={set(d.key)} />)}
            </div>
            <div className="space-y-3 pt-1 border-t border-white/10">
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest pt-3">Proteção do compressor</p>
              <Meter label="Pressão de alta" value={s.pCond} limit={P.pHighTrip} unit="bar" />
              <Meter label="Pressão de baixa" value={s.pEvap} limit={P.pLowTrip} unit="bar" invert />
              <Meter label="Temp. de descarga" value={s.tDischarge} limit={P.tDisTrip} unit="°C" min={20} />
              <Meter label="Corrente vs placa" value={s.irms} limit={P.rla * 1.15} unit="A" />
              <p className={`text-xs font-mono ${s.trips.length ? 'text-red-400' : 'text-green-400'}`}>
                {s.trips.length ? `PARADA: ${s.trips.join(', ')}` : 'Operando'}
              </p>
            </div>
          </aside>

          <div className="space-y-4 min-w-0">
            <BlockDiagram x={x} s={s} diag={`${diag.label} · resíduo ${(diag.resid * 100).toFixed(1)}%`} />
            <div className="grid xl:grid-cols-2 gap-4">
              <Scope
                title="Scope 1 · corrente no alicate"
                xLabel="ms"
                xRange={[0, 50]}
                series={[
                  { y: base.i.subarray(0, n), x: tMs, color: '#4b5563', label: 'sem falha', width: 1 },
                  { y: wave.i.subarray(0, n), x: tMs, color: YELLOW, label: 'i(t) [A]' },
                ]}
              />
              <Scope
                title="Scope 2 · espectro da corrente"
                xLabel="Hz"
                xRange={[0, 420]}
                yRange={[-70, 25]}
                series={[{ y: spec.db, x: spec.f, color: CYAN, label: 'dB(A)' }]}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Corrente', `${s.irms.toFixed(2)} A`, `esperado ${diag.expected.toFixed(2)}`],
                ['Potência', `${s.pElec.toFixed(0)} W`, `FP ${s.pf.toFixed(3)}`],
                ['Capacidade', `${(s.qEvap / 1000).toFixed(2)} kW`, `COP ${s.cop.toFixed(2)}`],
                ['3ª harmônica', `${(s.h3 * 100).toFixed(1)}%`, `5ª ${(s.h5 * 100).toFixed(1)}%`],
              ].map(([k, v, sub]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-panel px-4 py-3">
                  <p className="text-[11px] text-white/50">{k}</p>
                  <p className="font-mono text-xl text-signal">{v}</p>
                  <p className="font-mono text-[11px] text-white/40">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Validação */}
        <section className="grid lg:grid-cols-[1fr_1.4fr] gap-8 items-center">
          <div>
            <Kicker>Validação</Kicker>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">O modelo confere com o laboratório?</h2>
            <ul className="mt-5 space-y-3 text-white/65 text-sm">
              <li><b className="text-white">3 falhas simples</b> calibram o modelo.</li>
              <li><b className="text-white">Falhas duplas</b> ficam de fora e testam a previsão: erro de 0,6 a 6,3 pontos percentuais.</li>
              <li><b className="text-red-400">Filtro 50%</b>: a física prevê −2%, o laboratório mediu +3%. A diferença cabe em efeitos não medidos (clima do dia), então essa falha não se separa só pela corrente.</li>
            </ul>
            <p className="mt-5 text-xs text-white/40">
              Dados: de Oliveira et al., <i>Analysis of Split-System Air Conditioner Faults through Electrical Measurement Data</i>,
              Data 2024, 9(9):106 (UFPB, CC-BY-NC).
            </p>
          </div>
          <ValidationChart />
        </section>

        {/* Prognóstico */}
        <section className="space-y-5">
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end">
            <div>
              <Kicker>Prognóstico</Kicker>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">Avisar antes de o compressor parar</h2>
              <p className="mt-3 text-white/60 text-sm max-w-2xl">
                120 dias com clima e rede variando e uma falha piorando devagar. A linha de base sabe quanto o equipamento saudável
                consumiria naquele dia; o alerta sai do resíduo acumulado, não de um limite fixo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex rounded-lg border border-white/15 overflow-hidden font-mono text-xs">
                {([['cond', 'Condensador sujando'], ['leak', 'Vazamento lento']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setKind(k)} className={`px-3 py-2 ${kind === k ? 'bg-signal text-black' : 'text-white/70 hover:text-white'}`}>{l}</button>
                ))}
              </div>
              <label className="text-xs text-white/60 w-48">
                <span className="flex justify-between"><span>Degradação</span><span className="font-mono text-signal">{rate.toFixed(1)} %/dia</span></span>
                <input type="range" min={0.3} max={1.5} step={0.1} value={rate} onChange={e => setRate(+e.target.value)} className="w-full accent-[#f7e921]" />
              </label>
            </div>
          </div>

          <div className="grid xl:grid-cols-2 gap-4">
            <Scope
              title="Scope 3 · corrente diária"
              xLabel="dia"
              xRange={[0, 119]}
              series={[
                { y: prog.rows.map(r => r.expected), x: prog.rows.map(r => r.day), color: '#6b7280', label: 'esperado (saudável)', dash: '3 3' },
                { y: prog.rows.map(r => r.irms), x: prog.rows.map(r => r.day), color: YELLOW, label: 'medido [A]' },
              ]}
              markers={[
                ...(prog.alertDay !== null ? [{ x: prog.alertDay, color: '#fbbf24', label: 'alerta' }] : []),
                ...(prog.tripDay !== null ? [{ x: prog.tripDay, color: RED, label: 'parada' }] : []),
              ]}
            />
            <Scope
              title="Scope 4 · resíduo acumulado (EWMA)"
              xLabel="dia"
              xRange={[0, 119]}
              series={[{ y: prog.rows.map(r => r.ewma * 100), x: prog.rows.map(r => r.day), color: CYAN, label: 'resíduo [%]' }]}
              hLines={[{ y: kind === 'cond' ? 3 : -3, color: '#fbbf24', label: 'limiar ±3%' }]}
              markers={[
                ...(prog.alertDay !== null ? [{ x: prog.alertDay, color: '#fbbf24', label: 'alerta' }] : []),
                ...(prog.tripDay !== null ? [{ x: prog.tripDay, color: RED, label: 'parada' }] : []),
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-2xl">
            {[
              ['Alerta', prog.alertDay !== null ? `dia ${prog.alertDay}` : '—', '#fbbf24'],
              ['Parada', prog.tripDay !== null ? `dia ${prog.tripDay}` : 'não ocorre', RED],
              ['Antecedência', lead !== null ? `${lead} dias` : '—', GREEN],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-panel px-4 py-3">
                <p className="text-[11px] text-white/50">{k}</p>
                <p className="font-mono text-xl" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Método */}
        <section>
          <Kicker>Método e limites</Kicker>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Física', 'R410A, compressor rotativo, trocadores UA·ΔT, motor PSC. Equilíbrio quase-estático resolvido a cada mudança.'],
              ['Sensor mínimo', 'Só corrente, tensão e harmônicas (um disjuntor inteligente) + temperatura externa de API de clima.'],
              ['Confusão por sessão', 'No dataset real, um modelo que só vê a tensão acerta 96–99%. Por isso o teste intercalado é feito aqui, na simulação.'],
              ['Limites', 'Capacitor e harmônicas são semi-empíricos. Validação em outro equipamento (NIST, ASHRAE RP-1043) é o próximo passo.'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-panel p-4">
                <p className="font-display font-semibold mb-1.5">{k}</p>
                <p className="text-sm text-white/60">{v}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
