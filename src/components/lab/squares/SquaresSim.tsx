'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Compressão física 2D: paredes fecham sobre n quadrados soltos, com sacudidas
 * quando a caixa entala. Física via matter-js (CDN); o juiz é um teste exato do
 * eixo separador sobre os quadrados unitários reais, igual à regra do Kaggle.
 * Os corpos físicos são 1,2% maiores que os quadrados reais: margem contra a
 * pequena interpenetração que todo motor de jogo tolera.
 */

const MATTER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js'
const KNOWN: Record<number, number> = {
  2: 2, 3: 2, 4: 2, 5: 2.7071, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3.7071, 11: 3.8771, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4,
  17: 4.6756, 18: 4.8229, 19: 4.8856, 20: 5, 21: 5, 22: 5, 23: 5, 24: 5, 25: 5, 26: 5.6213, 27: 5.7071, 28: 5.8284,
  29: 5.9344, 30: 6,
}
const U = 40
const PAD = 1.012

type Pt = [number, number]
type State = [number, number, number][]

function corners(x: number, y: number, a: number): Pt[] {
  const c = Math.cos(a) / 2, s = Math.sin(a) / 2
  return [[x + c - s, y + s + c], [x - c - s, y - s + c], [x - c + s, y - s - c], [x + c + s, y + s - c]]
}

function separated(A: Pt[], B: Pt[]) {
  for (const P of [A, B]) for (let i = 0; i < 2; i++) {
    const ax = P[i + 1][0] - P[i][0], ay = P[i + 1][1] - P[i][1]
    let a1 = Infinity, a2 = -Infinity, b1 = Infinity, b2 = -Infinity
    for (const p of A) { const d = p[0] * ax + p[1] * ay; a1 = Math.min(a1, d); a2 = Math.max(a2, d) }
    for (const p of B) { const d = p[0] * ax + p[1] * ay; b1 = Math.min(b1, d); b2 = Math.max(b2, d) }
    if (a2 <= b1 + 1e-12 || b2 <= a1 + 1e-12) return true
  }
  return false
}

function evaluate(st: State) {
  const C = st.map(s => corners(s[0], s[1], s[2]))
  const bad = new Array(C.length).fill(false)
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) if (!separated(C[i], C[j])) bad[i] = bad[j] = true
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity
  for (const P of C) for (const p of P) { x1 = Math.min(x1, p[0]); x2 = Math.max(x2, p[0]); y1 = Math.min(y1, p[1]); y2 = Math.max(y2, p[1]) }
  return { C, bad, L: Math.max(x2 - x1, y2 - y1), x1, y1, ok: !bad.some(Boolean) }
}

declare global { interface Window { Matter?: any } }

function loadMatter(): Promise<any> {
  if (window.Matter) return Promise.resolve(window.Matter)
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = MATTER_SRC
    s.async = true
    s.onload = () => res(window.Matter)
    s.onerror = rej
    document.head.appendChild(s)
  })
}

type Metrics = { L: number; ok: boolean; best: number | null; shakes: number }

export default function SquaresSim() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [n, setN] = useState(5)
  const [running, setRunning] = useState(true)
  const [auto, setAuto] = useState(true)
  const [showBest, setShowBest] = useState(false)
  const [m, setM] = useState<Metrics>({ L: 0, ok: false, best: null, shakes: 0 })
  const [error, setError] = useState(false)
  const ctl = useRef({ running: true, auto: true, showBest: false, shake: () => {}, reset: () => {} })

  useEffect(() => { ctl.current.running = running }, [running])
  useEffect(() => { ctl.current.auto = auto }, [auto])
  useEffect(() => { ctl.current.showBest = showBest }, [showBest])

  useEffect(() => {
    let raf = 0, alive = true
    loadMatter().then(Matter => {
      if (!alive || !canvas.current) return
      const { Engine, Bodies, Composite, Body } = Matter
      const cv = canvas.current, ctx = cv.getContext('2d')!
      let engine: any, boxes: any[], walls: any[], W = 0, W0 = 0, frame = 0, lastProg = 0, progW = 0, shakes = 0
      let best = Infinity, bestSnap: State | null = null

      const setWalls = () => {
        const h = W / 2, T = 400
        Body.setPosition(walls[0], { x: -h - T / 2, y: 0 }); Body.setPosition(walls[1], { x: h + T / 2, y: 0 })
        Body.setPosition(walls[2], { x: 0, y: -h - T / 2 }); Body.setPosition(walls[3], { x: 0, y: h + T / 2 })
      }
      const init = () => {
        engine = Engine.create(); engine.gravity.y = 0; engine.positionIterations = 20; engine.velocityIterations = 12
        const k = Math.ceil(Math.sqrt(n)); W = W0 = k * 1.6 * U; const cell = W / k
        boxes = Array.from({ length: n }, (_, i) => {
          const b = Bodies.rectangle(-W / 2 + cell * (i % k + 0.5), -W / 2 + cell * (Math.floor(i / k) + 0.5), U * PAD, U * PAD,
            { friction: 0.02, frictionStatic: 0, frictionAir: 0.06, restitution: 0, slop: 0.01 })
          Body.setAngle(b, Math.random() * Math.PI / 2)
          return b
        })
        const o = { isStatic: true, friction: 0, slop: 0.01 }
        walls = [Bodies.rectangle(0, 0, 400, 8000, o), Bodies.rectangle(0, 0, 400, 8000, o), Bodies.rectangle(0, 0, 8000, 400, o), Bodies.rectangle(0, 0, 8000, 400, o)]
        setWalls(); Composite.add(engine.world, [...boxes, ...walls])
        frame = lastProg = 0; progW = W; shakes = 0; best = Infinity; bestSnap = null
      }
      const shake = () => {
        W *= 1.07
        for (const b of boxes) {
          Body.setVelocity(b, { x: (Math.random() - 0.5) * 7, y: (Math.random() - 0.5) * 7 })
          Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.25)
        }
        shakes++; progW = W; lastProg = frame; setWalls()
      }
      ctl.current.shake = shake
      ctl.current.reset = init

      const step = () => {
        for (let s = 0; s < 4; s++) {
          Engine.update(engine, 1000 / 60); frame++
          let d = 0
          for (const p of engine.pairs.list) if (p.isActive && p.collision) d = Math.max(d, p.collision.depth || 0)
          if (d < 0.08) W -= 0.12; else if (d > 0.3) W += 0.06
          setWalls()
          if (W < progW - 0.5) { progW = W; lastProg = frame }
          if (ctl.current.auto && frame - lastProg > 260) shake()
        }
      }
      const draw = (ev: ReturnType<typeof evaluate>, walled: boolean) => {
        const dpr = window.devicePixelRatio || 1, S = cv.getBoundingClientRect().width
        cv.width = S * dpr; cv.height = S * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S)
        const sc = (S * 0.9) / W0, T = (x: number, y: number): Pt => [S / 2 + x * sc, S / 2 + y * sc]
        if (walled) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(S / 2 - (W / 2) * sc, S / 2 - (W / 2) * sc, W * sc, W * sc) }
        ev.C.forEach((P, i) => {
          ctx.beginPath(); P.forEach((p, j) => { const q = T(p[0] * U, p[1] * U); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]) }); ctx.closePath()
          ctx.fillStyle = ev.bad[i] ? 'rgba(239,68,68,0.75)' : 'rgba(45,212,191,0.55)'; ctx.fill()
          ctx.strokeStyle = ev.bad[i] ? '#fca5a5' : '#5eead4'; ctx.lineWidth = 1; ctx.stroke()
        })
        const a = T(ev.x1 * U, ev.y1 * U)
        ctx.setLineDash([6, 4]); ctx.strokeStyle = '#f7e921'; ctx.lineWidth = 2; ctx.strokeRect(a[0], a[1], ev.L * U * sc, ev.L * U * sc); ctx.setLineDash([])
      }

      init()
      const loop = () => {
        if (!alive) return
        if (ctl.current.showBest && bestSnap) draw(evaluate(bestSnap), false)
        else {
          if (ctl.current.running) step()
          const st: State = boxes.map(b => [b.position.x / U, b.position.y / U, b.angle])
          const ev = evaluate(st)
          if (ev.ok && ev.L < best - 1e-6) { best = ev.L; bestSnap = st }
          draw(ev, true)
          if (frame % 8 === 0) setM({ L: ev.L, ok: ev.ok, best: Number.isFinite(best) ? best : null, shakes })
        }
        raf = requestAnimationFrame(loop)
      }
      loop()
    }).catch(() => setError(true))
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [n])

  const btn = 'px-3 py-1.5 rounded-lg border border-white/15 font-mono text-xs text-white/80 hover:border-signal hover:text-signal transition-colors'
  const card = 'rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2.5'
  const label = 'font-mono text-[10px] uppercase tracking-widest text-white/45'
  const val = 'font-display text-xl font-bold tabular-nums'

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label htmlFor="sq-n" className="font-mono text-xs text-white/60">n</label>
        <input id="sq-n" type="range" min={2} max={30} value={n} onChange={e => { setShowBest(false); setN(+e.target.value) }} className="flex-1 min-w-[140px] accent-[#f7e921]" />
        <span className="font-mono text-sm font-bold w-6">{n}</span>
        <button className={btn} onClick={() => { setShowBest(false); ctl.current.reset() }}>Reiniciar</button>
        <button className={btn} onClick={() => setRunning(r => !r)}>{running ? 'Pausar' : 'Continuar'}</button>
        <button className={btn} onClick={() => ctl.current.shake()}>Sacudir</button>
        <label className="flex items-center gap-2 font-mono text-xs text-white/60">
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="accent-[#f7e921]" /> sacudir sozinho
        </label>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="relative">
          <canvas ref={canvas} className="w-full aspect-square rounded-xl bg-ink" />
          {error && <p className="absolute inset-0 grid place-items-center text-sm text-white/60">Não foi possível carregar o motor de física.</p>}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className={card}><p className={label}>L agora</p><p className={val}>{m.L ? m.L.toFixed(4) : '—'}</p></div>
          <div className={card}><p className={label}>Válido agora</p><p className={`${val} ${m.ok ? 'text-teal-300' : 'text-red-400'}`}>{m.ok ? 'sim' : 'não'}</p></div>
          <div className={`${card} col-span-2`}>
            <p className={label}>Melhor L válido · score</p>
            <p className={val}>{m.best ? `${m.best.toFixed(4)} · ${(m.best / Math.sqrt(n) - 1).toFixed(4)}` : '—'}</p>
          </div>
          <div className={card}><p className={label}>Grade simples</p><p className={val}>{Math.ceil(Math.sqrt(n))}</p></div>
          <div className={card}><p className={label}>Recorde conhecido</p><p className={val}>{KNOWN[n]}</p></div>
          <div className={card}><p className={label}>Ideal √n</p><p className={val}>{Math.sqrt(n).toFixed(3)}</p></div>
          <div className={card}><p className={label}>Sacudidas</p><p className={val}>{m.shakes}</p></div>
          <button className={`${btn} col-span-2 py-2`} onClick={() => setShowBest(b => !b)} disabled={!m.best}>
            {showBest ? 'Voltar para a simulação' : 'Mostrar melhor encontrado'}
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-white/50">
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-400/70 mr-1.5 align-middle" />quadrado ok</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/80 mr-1.5 align-middle" />sobreposto (teste exato)</span>
        <span><i className="inline-block w-3 border-t-2 border-dashed border-signal mr-1.5 align-middle" />caixa L medida</span>
        <span><i className="inline-block w-3 border-t-2 border-white/35 mr-1.5 align-middle" />paredes</span>
      </div>
    </div>
  )
}
