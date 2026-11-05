/**
 * Painéis do registro de experimentos (dados agregados, sem coordenadas).
 * Gerado pelo motor local: `python -m squares.publish`.
 */

export type Summary = {
  updated: string
  total: number
  grid_total: number
  improved_puzzles: number
  per_n: { n: number; L: number; score: number; grid: number; technique: string }[]
  history: { ts: string; total: number; technique: string; n: number }[]
  techniques: { name: string; tries: number; valid: number; improvements: number; seconds: number; gain: number; wins: number }[]
}

const LEADER = 22.0544214515

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/45">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/45">{hint}</p>}
    </div>
  )
}

function ScoreByN({ data }: { data: Summary['per_n'] }) {
  // Escala log: o score vai de ~0,4 (n pequeno) a ~0,001 (n grande); em escala linear os n grandes somem.
  const W = 1000, H = 240, P = 40, LO = -3.2, HI = 0
  const x = (n: number) => P + ((n - 1) / (data.length - 1)) * (W - 2 * P)
  const y = (v: number) => H - P - ((Math.max(Math.log10(Math.max(v, 1e-6)), LO) - LO) / (HI - LO)) * (H - 2 * P)
  const line = (k: 'grid' | 'score') => data.map(d => `${x(d.n).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Score por puzzle em escala logarítmica: grade simples contra a melhor solução atual">
      {[0.001, 0.01, 0.1, 1].map(v => (
        <g key={v}>
          <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.08)" />
          <text x={P - 6} y={y(v) + 4} textAnchor="end" className="fill-white/40" fontSize="11">{v}</text>
        </g>
      ))}
      {[1, 250, 500, 750, 1000].map(n => (
        <text key={n} x={x(n)} y={H - 8} textAnchor="middle" className="fill-white/40" fontSize="11">{n}</text>
      ))}
      <polyline points={line('grid')} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <polyline points={line('score')} fill="none" stroke="#f7e921" strokeWidth="1.2" />
    </svg>
  )
}

function History({ s }: { s: Summary }) {
  const pts = [{ i: 0, total: s.grid_total }, ...s.history.map((h, i) => ({ i: i + 1, total: h.total }))]
  if (pts.length < 2) return <p className="text-sm text-white/50">Ainda sem melhorias registradas além da grade.</p>
  const W = 1000, H = 200, P = 34
  const lo = Math.min(LEADER, ...pts.map(p => p.total)), hi = s.grid_total
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P)
  const y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P)
  const d = pts.map((p, k) => (k ? `H${x(p.i).toFixed(1)}V${y(p.total).toFixed(1)}` : `M${x(p.i).toFixed(1)},${y(p.total).toFixed(1)}`)).join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolução do score total a cada melhoria">
      <line x1={P} x2={W - P} y1={y(LEADER)} y2={y(LEADER)} stroke="#f87171" strokeDasharray="5 4" />
      <text x={W - P} y={y(LEADER) - 6} textAnchor="end" className="fill-red-300" fontSize="11">líder do leaderboard {LEADER.toFixed(2)}</text>
      <text x={P} y={y(hi) - 6} className="fill-white/45" fontSize="11">grade {hi.toFixed(2)}</text>
      <path d={d} fill="none" stroke="#f7e921" strokeWidth="2" />
    </svg>
  )
}

export default function ScorePanels({ s }: { s: Summary }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Score total (menor é melhor)" value={s.total.toFixed(4)} hint={`atualizado ${s.updated.replace('T', ' ')}`} />
        <Stat label="Grade simples" value={s.grid_total.toFixed(4)} hint="não fazer nada" />
        <Stat label="Ganho sobre a grade" value={(s.grid_total - s.total).toFixed(4)} hint={`${s.improved_puzzles} de 1000 puzzles melhorados`} />
        <Stat label="Líder do leaderboard" value={LEADER.toFixed(4)} hint={`distância ${(s.total - LEADER).toFixed(4)}`} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-panel p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="font-display text-lg font-bold">Score de cada puzzle</h3>
          <p className="font-mono text-[11px] text-white/50">
            <span className="text-white/70">—</span> grade &nbsp; <span className="text-signal">—</span> melhor atual
          </p>
        </div>
        <ScoreByN data={s.per_n} />
        <p className="mt-2 text-xs text-white/45">
          Escala logarítmica. Os dentes de serra recomeçam logo depois de cada quadrado perfeito (n = k² + 1), onde a grade desperdiça uma
          linha inteira; quadrados perfeitos têm score 0 e encostam no piso do gráfico.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-panel p-4 sm:p-6">
        <h3 className="font-display text-lg font-bold mb-3">Evolução do score total</h3>
        <History s={s} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-panel p-4 sm:p-6 overflow-x-auto">
        <h3 className="font-display text-lg font-bold mb-3">Técnicas</h3>
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-widest text-white/45 text-left">
              <th className="py-2 pr-3">Técnica</th><th className="pr-3">Tentativas</th><th className="pr-3">Válidas</th>
              <th className="pr-3">Puzzles vencidos</th><th className="pr-3">Ganho no score</th><th>Tempo</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {s.techniques.map(t => (
              <tr key={t.name} className="border-t border-white/5">
                <td className="py-2 pr-3 font-mono text-signal">{t.name}</td>
                <td className="pr-3">{t.tries}</td>
                <td className="pr-3">{t.valid}</td>
                <td className="pr-3">{t.name === 'grade' ? '—' : t.wins}</td>
                <td className="pr-3">{t.name === 'grade' ? 'referência' : t.gain.toFixed(4)}</td>
                <td>{t.seconds < 60 ? `${t.seconds.toFixed(1)} s` : `${(t.seconds / 60).toFixed(1)} min`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
