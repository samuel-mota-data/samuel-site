'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { HEALTHY, KNEE, LIM, simulate, type CRParams, type Run } from '@/lib/coldroom/model'
import { predict, totalKwh } from '@/lib/coldroom/predict'
import { optimize, penaltyCurve, type EconInputs } from '@/lib/coldroom/econ'
import Scope from './Scope'

const ColdRoomScene = dynamic(() => import('./ColdRoomScene'), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-white/10 bg-panel aspect-[4/3] sm:aspect-[16/9]" />,
})

const YELLOW = '#f7e921'
const CYAN = '#22d3ee'
const RED = '#f87171'
const GREEN = '#4ade80'
const GRAY = '#6b7280'

const PRESETS: { label: string; x: Partial<CRParams> }[] = [
  { label: 'Saudável', x: {} },
  { label: 'Microvazamento', x: { leak: 0.5 } },
  { label: 'Vazamento', x: { leak: 1 } },
  { label: 'Válvula desregulada', x: { txvOffset: 8 } },
  { label: 'Bulbo solto', x: { bulbLoose: true } },
  { label: 'Resistência fraca', x: { heater: 0.4 } },
  { label: 'Condensador sujando', x: { condFoul: 1.5 } },
  { label: 'Úmido + muita porta', x: { rhExt: 0.9, doors: 80 } },
  { label: 'Seco + pouca porta', x: { rhExt: 0.45, doors: 15, tExt: 20 } },
]

type SliderDef = { key: keyof CRParams; label: string; min: number; max: number; step: number; fmt: (v: number) => string; fault?: boolean }
const AMB: SliderDef[] = [
  { key: 'tExt', label: 'Temperatura externa média', min: 15, max: 35, step: 0.5, fmt: v => `${v.toFixed(1)} °C` },
  { key: 'rhExt', label: 'Umidade externa média', min: 0.35, max: 0.95, step: 0.05, fmt: v => `${Math.round(v * 100)} %` },
  { key: 'doors', label: 'Aberturas de porta por dia', min: 5, max: 120, step: 5, fmt: v => `${v}` },
]
const FAULTS: SliderDef[] = [
  { key: 'leak', label: 'Vazamento de gás', min: 0, max: 1.5, step: 0.05, fmt: v => `${v.toFixed(2)} %/dia`, fault: true },
  { key: 'txvOffset', label: 'Válvula desregulada (SH)', min: -3, max: 14, step: 1, fmt: v => `${v > 0 ? '+' : ''}${v} K`, fault: true },
  { key: 'condFoul', label: 'Condensador sujando', min: 0, max: 2, step: 0.1, fmt: v => `${v.toFixed(1)} %/dia`, fault: true },
  { key: 'heater', label: 'Resistência de degelo (final)', min: 0.3, max: 1, step: 0.05, fmt: v => `${Math.round(v * 100)} %`, fault: true },
]

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] sm:text-xs text-signal uppercase tracking-[0.22em] mb-3">{children}</p>
}

function Range({ d, value, onChange, onCommit }: { d: SliderDef; value: number; onChange: (v: number) => void; onCommit: () => void }) {
  const isFault = d.fault && (d.key === 'heater' ? value < 0.99 : d.key === 'txvOffset' ? value !== 0 : value > 0)
  return (
    <label className="block">
      <span className="flex justify-between text-xs mb-1">
        <span className={isFault ? 'text-red-400' : 'text-white/70'}>{d.label}</span>
        <span className="font-mono text-signal">{d.fmt(value)}</span>
      </span>
      <input
        type="range"
        min={d.min}
        max={d.max}
        step={d.step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onTouchEnd={onCommit}
        className="w-full accent-[#f7e921]"
      />
    </label>
  )
}

function fmtClock(min: number) {
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = Math.floor(min % 60)
  return `Dia ${d + 1} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

type Bundle = { run: Run; twin: Run; alt: Run }

function Timeline({ findings, days, onPick }: { findings: ReturnType<typeof predict>; days: number; onPick: (day: number) => void }) {
  const rows = findings.filter(f => f.alertDay !== null || f.alarmDay !== null)
  const W = 680
  const L = 210
  const sx = (d: number) => L + (d / days) * (W - L - 20)
  const H = Math.max(1, rows.length) * 44 + 34
  if (!rows.length)
    return <div className="rounded-xl border border-white/10 bg-panel p-6 text-sm text-white/60">Nenhum desvio do digital twin e nenhum alarme em {days} dias. Equipamento saudável.</div>
  return (
    <div className="rounded-xl border border-white/10 bg-black overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] h-auto block" role="img" aria-label="Linha do tempo: alerta preditivo e alarme do controlador">
        {[0, 10, 20, 30, 40, 50, 60].filter(d => d <= days).map(d => (
          <g key={d}>
            <line x1={sx(d)} x2={sx(d)} y1={8} y2={H - 22} stroke="#1f2a1f" />
            <text x={sx(d)} y={H - 8} fill={GRAY} fontSize="10" textAnchor="middle" fontFamily="monospace">{`d${d}`}</text>
          </g>
        ))}
        {rows.map((f, i) => {
          const y = 22 + i * 44
          return (
            <g key={f.family.id}>
              <text x={L - 12} y={y + 4} fill="#e5e7eb" fontSize="11.5" textAnchor="end">{f.family.name}</text>
              <text x={L - 12} y={y + 18} fill={GRAY} fontSize="9.5" textAnchor="end" fontFamily="monospace">{f.family.sensor}</text>
              {f.alertDay !== null && f.alarmDay !== null && f.alarmDay > f.alertDay && (
                <>
                  <line x1={sx(f.alertDay)} x2={sx(f.alarmDay)} y1={y} y2={y} stroke={GREEN} strokeWidth={2} strokeDasharray="4 3" />
                  <text x={(sx(f.alertDay) + sx(f.alarmDay)) / 2} y={y - 7} fill={GREEN} fontSize="10.5" textAnchor="middle" fontFamily="monospace">
                    {`${f.lead!.toFixed(0)} dias antes`}
                  </text>
                </>
              )}
              {f.alertDay !== null && (
                <circle cx={sx(f.alertDay)} cy={y} r={6} fill={GREEN} className="cursor-pointer" onClick={() => onPick(f.alertDay!)}>
                  <title>{`Alerta preditivo no dia ${f.alertDay}`}</title>
                </circle>
              )}
              {f.alarmDay !== null && (
                <g className="cursor-pointer" onClick={() => onPick(f.alarmDay!)}>
                  <rect x={sx(f.alarmDay) - 6} y={y - 6} width={12} height={12} fill={RED} transform={`rotate(45 ${sx(f.alarmDay)} ${y})`} />
                  <text x={sx(f.alarmDay) + 10} y={y + 4} fill={RED} fontSize="10.5" fontFamily="monospace">{f.alarmCode}</text>
                  <title>{`Alarme ${f.alarmCode} no dia ${f.alarmDay.toFixed(1)}`}</title>
                </g>
              )}
              {f.alertDay !== null && f.alarmDay === null && (
                <text x={sx(f.alertDay) + 10} y={y + 4} fill={GRAY} fontSize="10.5" fontFamily="monospace">alarme ainda não tocou</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-4 px-3 py-2 border-t border-white/10 font-mono text-[11px] text-white/60">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />alerta preditivo (desvio do digital twin)</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rotate-45 bg-red-400 inline-block" />alarme do controlador (manuais)</span>
        <span className="ml-auto">clique para ir ao dia</span>
      </div>
    </div>
  )
}

export default function ColdRoomApp() {
  const [p, setP] = useState<CRParams>(HEALTHY)
  const [draft, setDraft] = useState<CRParams>(HEALTHY)
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [busy, setBusy] = useState(true)
  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(120) // minutos simulados por segundo
  const tRef = useRef(0)
  const [econ, setEcon] = useState<EconInputs>({ leakPctDay: 0.3, chargeKg: 8, gasPrice: 120, visit: 450, emergency: 3000, tariff: 0.9 })

  // simulação (fora da renderização, com indicador)
  useEffect(() => {
    setBusy(true)
    const id = setTimeout(() => {
      const run = simulate(p, true)
      const twin = simulate({ ...HEALTHY, seed: p.seed, tSet: p.tSet, tExt: p.tExt, rhExt: p.rhExt, doors: p.doors, days: p.days, defrost: p.defrost, defPerDay: p.defPerDay })
      const alt = simulate({ ...p, defrost: p.defrost === 'tempo' ? 'demanda' : 'tempo' })
      setBundle({ run, twin, alt })
      setBusy(false)
    }, 30)
    return () => clearTimeout(id)
  }, [p])

  const curve = useMemo(() => penaltyCurve({ tExt: p.tExt, rhExt: p.rhExt, doors: p.doors, seed: p.seed, tSet: p.tSet }), [p.tExt, p.rhExt, p.doors, p.seed, p.tSet])
  const leakForEcon = p.leak > 0 ? p.leak : econ.leakPctDay
  const opt = useMemo(() => optimize(curve, { ...econ, leakPctDay: leakForEcon }), [curve, econ, leakForEcon])
  const findings = useMemo(() => (bundle ? predict(bundle.run, bundle.twin) : []), [bundle])

  // relógio da simulação
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)) // o rAF pode vir antes do performance.now()
      last = now
      const N = p.days * 1440
      if (playing) tRef.current = (tRef.current + dt * speed) % N
      if (now - lastUi > 100) {
        lastUi = now
        setClock(tRef.current)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, p.days])

  const commit = () => setP(draft)
  const setD = (k: keyof CRParams) => (v: number) => setDraft(d => ({ ...d, [k]: v }))
  const applyPreset = (x: Partial<CRParams>) => {
    const n = { ...HEALTHY, defrost: draft.defrost, ...x }
    setDraft(n)
    setP(n)
    tRef.current = 0
  }
  const goDay = (day: number) => {
    tRef.current = Math.max(0, day * 1440 - 60)
    setClock(tRef.current)
  }

  if (!bundle)
    return (
      <div className="min-h-screen bg-ink text-white grid place-items-center font-mono text-sm text-white/60">simulando 60 dias…</div>
    )

  const { run, twin, alt } = bundle
  const m = run.m!
  const i = Math.min(run.minutes - 1, Math.max(0, Math.floor(clock) || 0))
  const day = Math.floor(i / 1440)
  const days = run.daily.length
  const dayIdx = Array.from({ length: days }, (_, k) => k + 0.5)
  const dayStart = day * 1440
  const hrs = Array.from({ length: 1440 }, (_, k) => k / 60)
  const kwhRun = totalKwh(run)
  const kwhTwin = totalKwh(twin)
  const kwhAlt = totalKwh(alt)
  const timeRun = p.defrost === 'tempo' ? kwhRun : kwhAlt
  const demRun = p.defrost === 'demanda' ? kwhRun : kwhAlt
  const month = (k: number) => (k / days) * 30
  const activeAlarms = run.alarms.filter(a => a.t <= i && i - a.t < 120)
  const firstAlerts = findings.filter(f => f.alertDay !== null)
  const markersDays = [
    { x: day + 0.5, color: YELLOW, label: 'agora' },
    ...firstAlerts.slice(0, 1).map(f => ({ x: f.alertDay!, color: GREEN, label: 'alerta' })),
    ...(run.alarms[0] ? [{ x: run.alarms[0].t / 1440, color: RED, label: run.alarms[0].code }] : []),
  ]
  const todaysAlarms = run.alarms.filter(a => a.t >= dayStart && a.t < dayStart + 1440)

  return (
    <div className="min-h-screen bg-ink text-white overflow-x-clip">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-ink/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          <a href="/" className="font-display font-bold tracking-tight text-lg">
            Samuel Mota<span className="text-signal">.</span>
          </a>
          <a href="/lab" className="font-mono text-xs text-white/50 hover:text-signal transition-colors">← /lab · câmara fria</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-16">
        <header className="max-w-3xl">
          <Kicker>Lab · Manutenção preditiva</Kicker>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">Câmara fria: avisar antes do alarme</h1>
          <p className="mt-4 text-white/60 text-base sm:text-lg">
            60 dias simulados minuto a minuto. O controlador dispara os alarmes dos manuais (Danfoss, Full Gauge, Carel); a predição
            compara cada dia com um digital twin saudável e avisa antes. Mais degelo por demanda e o momento ótimo de recarga de gás.
          </p>
        </header>

        {/* Simulador */}
        <section className="grid lg:grid-cols-[290px_1fr] gap-6 items-start">
          <aside className="rounded-xl border border-white/10 bg-panel p-4 space-y-5 lg:sticky lg:top-20">
            <div>
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-2">Cenários</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(pr => (
                  <button key={pr.label} onClick={() => applyPreset(pr.x)} className="px-2 py-1 rounded border border-white/15 text-[11px] font-mono text-white/75 hover:border-signal hover:text-signal transition-colors">
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest">Ambiente e uso</p>
              {AMB.map(d => <Range key={d.key} d={d} value={draft[d.key] as number} onChange={setD(d.key)} onCommit={commit} />)}
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[11px] text-red-400/80 uppercase tracking-widest">Falhas injetadas</p>
              {FAULTS.map(d => <Range key={d.key} d={d} value={draft[d.key] as number} onChange={setD(d.key)} onCommit={commit} />)}
              <label className="flex items-center justify-between text-xs">
                <span className={draft.bulbLoose ? 'text-red-400' : 'text-white/70'}>Bulbo da válvula soltando</span>
                <input
                  type="checkbox"
                  checked={draft.bulbLoose}
                  onChange={e => {
                    const n = { ...draft, bulbLoose: e.target.checked }
                    setDraft(n)
                    setP(n)
                  }}
                  className="accent-[#f7e921] w-4 h-4"
                />
              </label>
            </div>
            <div className="space-y-2 pt-1 border-t border-white/10">
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest pt-3">Estratégia de degelo</p>
              <div className="flex rounded-lg border border-white/15 overflow-hidden font-mono text-xs">
                {(['tempo', 'demanda'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => {
                      const n = { ...draft, defrost: k }
                      setDraft(n)
                      setP(n)
                    }}
                    className={`flex-1 px-3 py-2 ${draft.defrost === k ? 'bg-signal text-black' : 'text-white/70 hover:text-white'}`}
                  >
                    {k === 'tempo' ? `Por tempo (${draft.defPerDay}/dia)` : 'Por demanda'}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-4 min-w-0">
            <div className="relative">
              <ColdRoomScene run={run} tRef={tRef} p={p} />
              {busy && <div className="absolute inset-0 grid place-items-center bg-black/40 rounded-xl font-mono text-sm text-signal">simulando 60 dias…</div>}
            </div>
            {/* player */}
            <div className="rounded-xl border border-white/10 bg-panel px-4 py-3 flex flex-wrap items-center gap-3">
              <button onClick={() => setPlaying(v => !v)} className="w-9 h-9 rounded-lg bg-signal text-black font-bold" aria-label={playing ? 'Pausar' : 'Tocar'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <span className="font-mono text-sm text-signal w-36">{fmtClock(i)}</span>
              <input
                type="range"
                min={0}
                max={run.minutes - 1}
                step={10}
                value={i}
                onChange={e => {
                  tRef.current = +e.target.value
                  setClock(+e.target.value)
                }}
                className="flex-1 min-w-[140px] accent-[#f7e921]"
                aria-label="Linha do tempo"
              />
              <div className="flex rounded-lg border border-white/15 overflow-hidden font-mono text-[11px]">
                {[
                  [30, '½ h/s'],
                  [120, '2 h/s'],
                  [720, '½ dia/s'],
                  [2880, '2 dias/s'],
                ].map(([v, l]) => (
                  <button key={v} onClick={() => setSpeed(v as number)} className={`px-2 py-1.5 ${speed === v ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                ['T caixa', `${m.tBox[i].toFixed(1)} °C`, m.tBox[i] > LIM.a1 ? RED : YELLOW],
                ['Compressor', m.def[i] ? 'degelo' : m.comp[i] ? 'ligado' : 'parado', m.def[i] ? RED : m.comp[i] ? GREEN : GRAY],
                ['Gelo na serpentina', `${m.frost[i].toFixed(2)} kg`, m.frost[i] > 1.6 ? RED : CYAN],
                ['Carga de gás', `${Math.round(m.charge[i] * 100)} %`, m.charge[i] < KNEE ? RED : YELLOW],
                ['Alarme ativo', activeAlarms.length ? activeAlarms[activeAlarms.length - 1].code : '—', activeAlarms.length ? RED : GRAY],
              ].map(([k, v, c]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-panel px-3 py-2.5">
                  <p className="text-[11px] text-white/50">{k}</p>
                  <p className="font-mono text-lg" style={{ color: c }}>{v}</p>
                </div>
              ))}
            </div>
            <Scope
              title={`Scope 1 · ${fmtClock(dayStart).split(' · ')[0]} minuto a minuto`}
              xLabel="hora"
              xRange={[0, 24]}
              yRange={[-25, 15]}
              series={[
                { y: m.tCoil.subarray(dayStart, dayStart + 1440), x: hrs, color: CYAN, label: 'T serpentina', width: 1 },
                { y: m.tBox.subarray(dayStart, dayStart + 1440), x: hrs, color: YELLOW, label: 'T caixa' },
              ]}
              hLines={[{ y: LIM.a1, color: RED, label: `alarme A1 > ${LIM.a1} °C` }]}
              markers={[
                { x: (i - dayStart) / 60, color: '#ffffff', label: 'agora' },
                ...todaysAlarms.slice(0, 3).map(a => ({ x: (a.t - dayStart) / 60, color: RED, label: a.code })),
              ]}
            />
          </div>
        </section>

        {/* Alarme × predição */}
        <section className="space-y-5">
          <div className="max-w-3xl">
            <Kicker>Alarme × predição</Kicker>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">Quantos dias antes dá para saber</h2>
            <p className="mt-3 text-white/60 text-sm">
              O alarme olha o valor de agora contra um limite fixo. A predição olha a tendência contra o digital twin saudável, com o mesmo clima e
              as mesmas aberturas de porta, e só avisa quando o desvio dura 2 dias seguidos.
            </p>
          </div>
          <Timeline findings={findings} days={days} onPick={goDay} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl">
            {[
              ['Alarmes do controlador', `${new Set(run.alarms.map(a => a.code)).size} tipo(s) · ${run.alarms.length} episódio(s)`, run.alarms.length ? RED : GREEN],
              ['Primeiro alerta preditivo', firstAlerts.length ? `dia ${Math.min(...firstAlerts.map(f => f.alertDay!))}` : '—', GREEN],
              ['Energia a mais que o digital twin', `${(kwhRun - kwhTwin).toFixed(0)} kWh`, kwhRun - kwhTwin > 20 ? RED : YELLOW],
              ['Custo da falha no período', `R$ ${Math.max(0, (kwhRun - kwhTwin) * econ.tariff).toFixed(0)}`, YELLOW],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-panel px-4 py-3">
                <p className="text-[11px] text-white/50">{k}</p>
                <p className="font-mono text-lg" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>
          <div className="grid xl:grid-cols-2 gap-4">
            <Scope
              title="Scope 2 · subresfriamento e superaquecimento (mediana do dia)"
              xLabel="dia"
              xRange={[0, days]}
              series={[
                { y: twin.daily.map(d => d.sc), x: dayIdx, color: GRAY, label: 'SC digital twin', dash: '3 3' },
                { y: run.daily.map(d => d.sc), x: dayIdx, color: CYAN, label: 'SC [K]' },
                { y: run.daily.map(d => d.sh), x: dayIdx, color: RED, label: 'SH [K]' },
              ]}
              markers={markersDays}
            />
            <Scope
              title="Scope 3 · energia por dia"
              xLabel="dia"
              xRange={[0, days]}
              series={[
                { y: twin.daily.map(d => d.kwhComp + d.kwhDef + d.kwhFan), x: dayIdx, color: GRAY, label: 'digital twin', dash: '3 3' },
                { y: run.daily.map(d => d.kwhComp + d.kwhDef + d.kwhFan), x: dayIdx, color: YELLOW, label: 'total [kWh]' },
                { y: run.daily.map(d => d.kwhDef), x: dayIdx, color: RED, label: 'degelo' },
              ]}
              markers={markersDays}
            />
            <Scope
              title="Scope 4 · duração média do degelo"
              xLabel="dia"
              xRange={[0, days]}
              series={[
                { y: twin.daily.map(d => d.defDur), x: dayIdx, color: GRAY, label: 'digital twin', dash: '3 3' },
                { y: run.daily.map(d => d.defDur), x: dayIdx, color: RED, label: 'degelo [min]' },
              ]}
              hLines={[{ y: LIM.d04, color: RED, label: `d04 = ${LIM.d04} min (termina por tempo)` }]}
              markers={markersDays}
            />
            <Scope
              title="Scope 5 · condensação acima da T externa e duty cycle"
              xLabel="dia"
              xRange={[0, days]}
              series={[
                { y: twin.daily.map(d => d.approach), x: dayIdx, color: GRAY, label: 'digital twin', dash: '3 3' },
                { y: run.daily.map(d => d.approach), x: dayIdx, color: '#fb923c', label: 'Tc − Text [K]' },
                { y: run.daily.map(d => d.duty * 100 / 4), x: dayIdx, color: GREEN, label: 'duty ÷ 4 [%]' },
              ]}
              markers={markersDays}
            />
          </div>
        </section>

        {/* Economia */}
        <section className="space-y-8">
          <div className="max-w-3xl">
            <Kicker>Economia</Kicker>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">Degelo por demanda e recarga na hora certa</h2>
          </div>
          <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6 items-start">
            <div className="rounded-xl border border-white/10 bg-panel p-5 space-y-4">
              <p className="font-display font-semibold text-lg">Degelo: por tempo × por demanda</p>
              <p className="text-sm text-white/60">
                Mesmo clima, mesmas portas, mesmas falhas. O degelo por demanda só entra quando a diferença entre o ar e a serpentina mostra
                gelo de verdade.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['Por tempo', timeRun],
                    ['Por demanda', demRun],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5">
                    <p className="text-[11px] text-white/50">{k}</p>
                    <p className="font-mono text-lg text-signal">{month(v).toFixed(0)} kWh/mês</p>
                  </div>
                ))}
              </div>
              {timeRun - demRun >= 0 ? (
                <div className="rounded-lg border border-green-400/30 bg-green-400/5 px-4 py-3">
                  <p className="text-[11px] text-green-300/80">Economia por evaporador</p>
                  <p className="font-mono text-2xl text-green-300">
                    {(100 * (timeRun - demRun) / timeRun).toFixed(1)} % · R$ {(month(timeRun - demRun) * econ.tariff).toFixed(0)}/mês
                  </p>
                  <p className="text-xs text-white/50 mt-1">× 20 evaporadores ≈ R$ {(month(timeRun - demRun) * econ.tariff * 20).toFixed(0)}/mês. Mais em dia seco e com pouca porta.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3">
                  <p className="text-[11px] text-red-300/80">Degelo por demanda gastou mais</p>
                  <p className="font-mono text-2xl text-red-300">+{(100 * (demRun - timeRun) / timeRun).toFixed(1)} %</p>
                  <p className="text-xs text-white/50 mt-1">
                    Com falha no ciclo (vazamento, válvula), a serpentina fica fria por falta de gás e o sensor de gelo dispara degelos à toa.
                    Degelo por demanda só funciona junto com o diagnóstico.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-panel p-5 space-y-4">
              <p className="font-display font-semibold text-lg">Microvazamento: quando recarregar</p>
              <p className="text-sm text-white/60">
                Quando consertar o furo não compensa: recarregar cedo gasta visitas; tarde demais vira emergência. A incerteza da taxa de
                vazamento (±30 %) entra como risco de o alarme chegar antes da visita.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {(
                  [
                    ['leakPctDay', 'Vazamento %/dia', 0.05],
                    ['chargeKg', 'Carga [kg]', 1],
                    ['gasPrice', 'Gás R$/kg', 5],
                    ['visit', 'Visita R$', 50],
                    ['emergency', 'Emergência R$', 250],
                    ['tariff', 'Energia R$/kWh', 0.05],
                  ] as const
                ).map(([k, l, step]) => (
                  <label key={k} className="block">
                    <span className="text-white/50">{l}{k === 'leakPctDay' && p.leak > 0 ? ' (do cenário)' : ''}</span>
                    <input
                      type="number"
                      step={step}
                      value={k === 'leakPctDay' && p.leak > 0 ? p.leak : econ[k]}
                      disabled={k === 'leakPctDay' && p.leak > 0}
                      onChange={e => setEcon(s => ({ ...s, [k]: Math.max(0, +e.target.value) }))}
                      className="mt-1 w-full rounded-md bg-black/50 border border-white/15 px-2 py-1.5 font-mono text-signal disabled:opacity-60"
                    />
                  </label>
                ))}
              </div>
              <Scope
                title="Custo por dia × carga em que se recarrega"
                xLabel="% de gás perdido até a recarga"
                xRange={[2, 64]}
                series={[{ y: opt.points.map(pt => pt.costDay), x: opt.points.map(pt => 100 - pt.r * 100), color: YELLOW, label: 'R$/dia' }]}
                markers={[
                  { x: 100 - opt.best.r * 100, color: GREEN, label: 'ótimo' },
                  { x: 100 - KNEE * 100, color: CYAN, label: 'joelho' },
                  { x: 100 - curve.alarmCharge * 100, color: RED, label: 'alarme' },
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-green-400/30 bg-green-400/5 px-3 py-2.5">
                  <p className="text-[11px] text-green-300/80">Recarga programada</p>
                  <p className="font-mono text-base text-green-300">
                    com {Math.round(opt.best.r * 100)} % de carga · a cada {opt.best.days.toFixed(0)} dias
                  </p>
                  <p className="font-mono text-sm text-white/70">R$ {(opt.best.costDay * 30).toFixed(0)}/mês</p>
                </div>
                <div className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2.5">
                  <p className="text-[11px] text-red-300/80">Só quando o alarme tocar</p>
                  <p className="font-mono text-base text-red-300">com {Math.round(opt.emergencyOnly.r * 100)} % · emergência</p>
                  <p className="font-mono text-sm text-white/70">R$ {(opt.emergencyOnly.costDay * 30).toFixed(0)}/mês</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Método */}
        <section>
          <Kicker>Método e limites</Kicker>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Física', 'R404A, unidade condensadora, válvula termostática, degelo elétrico. Balanço de energia da caixa, gelo pela umidade da porta e do produto, passo de 1 minuto.'],
              ['Alarmes', 'Limites e atrasos típicos dos manuais públicos: temperatura alta (A1), degelo por tempo (d04), superaquecimento alto e baixo, pressostatos, descarga.'],
              ['Predição', 'Digital twin saudável com o mesmo clima e as mesmas portas como referência; desvio persistente de 2 dias vira alerta. Sensores do degrau 0–2 da escada.'],
              ['Limites', 'Modelo didático, não calibrado em câmara real. O joelho do reservatório (72 % de carga) e as taxas de gelo são premissas a ajustar com dados de campo.'],
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
