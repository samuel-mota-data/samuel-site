import { HEALTHY, simulate, type CRParams, type Run } from './model'

/**
 * Momento ótimo de recarga num vazamento lento que não compensa consertar.
 * Curva de penalidade de energia × carga vem do gêmeo (vazamento de referência de 1 %/dia
 * contra o gêmeo saudável, mesmo clima). Para cada carga de recarga r:
 *   intervalo T = (1 − r) / vazamento
 *   custo/dia = (visita + gás reposto + energia extra no intervalo + emergência se passar do alarme) / T
 */

export type EconInputs = {
  leakPctDay: number // vazamento real [%/dia]
  chargeKg: number
  gasPrice: number // R$/kg
  visit: number // R$ por visita programada
  emergency: number // R$ extra se a recarga for de emergência (perda de produto, hora extra)
  tariff: number // R$/kWh
}

export type PenaltyCurve = { charge: number[]; kwhDay: number[]; alarmCharge: number }

export function penaltyCurve(env: Pick<CRParams, 'tExt' | 'rhExt' | 'doors' | 'seed' | 'tSet'>): PenaltyCurve {
  const base = { ...HEALTHY, ...env, days: 60 }
  const leak = simulate({ ...base, leak: 1 })
  const twin = simulate(base)
  const charge: number[] = []
  const kwhDay: number[] = []
  leak.daily.forEach((d, i) => {
    const t = twin.daily[i]
    charge.push(d.charge)
    kwhDay.push(Math.max(0, d.kwhComp + d.kwhDef + d.kwhFan - (t.kwhComp + t.kwhDef + t.kwhFan)))
  })
  // suaviza (o clima do dia mexe na diferença)
  const smooth = kwhDay.map((_, i) => {
    const w = kwhDay.slice(Math.max(0, i - 3), i + 4)
    return w.reduce((s, v) => s + v, 0) / w.length
  })
  const first = leak.alarms.find(a => ['ASHH', 'LOP', 'A1'].includes(a.code))
  const alarmCharge = first ? 1 - (first.t / 1440) * 0.01 : 0.35
  return { charge, kwhDay: smooth, alarmCharge }
}

function penaltyAt(c: PenaltyCurve, q: number) {
  // carga cai com o tempo: charge[] é decrescente
  for (let i = 0; i < c.charge.length - 1; i++) {
    if (q <= c.charge[i] && q >= c.charge[i + 1]) {
      const f = (c.charge[i] - q) / (c.charge[i] - c.charge[i + 1])
      return c.kwhDay[i] + f * (c.kwhDay[i + 1] - c.kwhDay[i])
    }
  }
  return q > c.charge[0] ? c.kwhDay[0] : c.kwhDay[c.kwhDay.length - 1]
}

/** Φ(z) — normal padrão acumulada. */
function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

export type EconResult = {
  points: { r: number; days: number; costDay: number; energy: number; pEmergency: number }[]
  best: { r: number; days: number; costDay: number }
  emergencyOnly: { r: number; days: number; costDay: number }
}

export function optimize(curve: PenaltyCurve, e: EconInputs): EconResult {
  const leak = Math.max(0.02, e.leakPctDay) / 100
  const points: EconResult['points'] = []
  for (let r = 0.98; r >= 0.36; r -= 0.01) {
    const T = (1 - r) / leak
    let kwh = 0
    for (let d = 0; d < T; d++) kwh += penaltyAt(curve, 1 - leak * d)
    // a taxa real de vazamento varia (±30 %): quanto mais perto do alarme, maior a chance de
    // ele disparar antes da visita programada e virar emergência
    const pEm = phi((curve.alarmCharge - r) / (0.3 * (1 - r)))
    const gas = (1 - r) * e.chargeKg * e.gasPrice
    const cost = e.visit + gas + kwh * e.tariff + pEm * e.emergency
    points.push({ r: +r.toFixed(2), days: T, costDay: cost / T, energy: kwh, pEmergency: pEm })
  }
  const best = points.reduce((a, b) => (b.costDay < a.costDay ? b : a))
  // "só na emergência": recarga quando o alarme dispara
  const em = points.reduce((a, b) => (Math.abs(b.r - curve.alarmCharge) < Math.abs(a.r - curve.alarmCharge) ? b : a))
  const emCost = (em.costDay * em.days + (1 - em.pEmergency) * e.emergency) / em.days
  return { points, best, emergencyOnly: { r: em.r, days: em.days, costDay: emCost } }
}

export type Bundle = { run: Run; twin: Run; alt: Run }
