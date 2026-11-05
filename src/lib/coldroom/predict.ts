import type { Daily, Run } from './model'

/**
 * Camada preditiva: compara cada dia com o GÊMEO SAUDÁVEL (mesmo clima, mesmas portas, sem falha).
 * Um alerta sai quando o desvio persiste 2 dias seguidos. Cada família de alerta aponta para os
 * alarmes do controlador que ela antecipa.
 */

export type Family = {
  id: string
  name: string // sinal precursor
  sensor: string
  alarms: string[] // códigos do controlador que antecipa
  test: (d: Daily, twin: Daily) => boolean
  value: (d: Daily, twin: Daily) => number
  unit: string
}

export const FAMILIES: Family[] = [
  {
    id: 'leak',
    name: 'Subresfriamento caindo',
    sensor: 'P alta + T linha de líquido',
    alarms: ['ASHH', 'LOP', 'A1'],
    test: (d, t) => t.sc - d.sc >= 2,
    value: (d, t) => d.sc - t.sc,
    unit: 'K',
  },
  {
    id: 'txv',
    name: 'Superaquecimento acima do gêmeo',
    sensor: 'P baixa + T sucção',
    alarms: ['ASHH', 'A1'],
    test: (d, t) => d.sh - t.sh >= 4 && t.sc - d.sc < 2,
    value: (d, t) => d.sh - t.sh,
    unit: 'K',
  },
  {
    id: 'bulb',
    name: 'Superaquecimento oscilando',
    sensor: 'P baixa + T sucção',
    alarms: ['ASHL'],
    test: d => d.shStd >= 1.2,
    value: d => d.shStd,
    unit: 'K (desvio)',
  },
  {
    id: 'cond',
    name: 'Condensação subindo (Tc − T ext)',
    sensor: 'P alta + T externa',
    alarms: ['HP', 'tDis'],
    test: (d, t) => d.approach - t.approach >= 3,
    value: (d, t) => d.approach - t.approach,
    unit: 'K',
  },
  {
    id: 'def',
    name: 'Degelo mais longo',
    sensor: 'T serpentina (S2)',
    alarms: ['dEF', 'A1'],
    test: (d, t) => d.defDur - t.defDur >= 4,
    value: (d, t) => d.defDur - t.defDur,
    unit: 'min',
  },
  {
    id: 'duty',
    name: 'Compressor ligado mais tempo',
    sensor: 'corrente do compressor',
    alarms: ['A1'],
    test: (d, t) => d.duty - t.duty >= 0.06,
    value: (d, t) => 100 * (d.duty - t.duty),
    unit: 'p.p.',
  },
]

export type Finding = {
  family: Family
  alertDay: number | null
  alarmDay: number | null
  alarmCode: string | null
  lead: number | null
  extraKwh: number // energia a mais até o alerta... até o fim da simulação
}

export function predict(run: Run, twin: Run): Finding[] {
  const days = Math.min(run.daily.length, twin.daily.length)
  const firstAlarm = (codes: string[]) => {
    const a = run.alarms.find(x => codes.includes(x.code))
    return a ? { day: a.t / 1440, code: a.code } : null
  }
  const extra = run.daily.slice(0, days).reduce((s, d, i) => {
    const t = twin.daily[i]
    return s + (d.kwhComp + d.kwhDef + d.kwhFan) - (t.kwhComp + t.kwhDef + t.kwhFan)
  }, 0)
  return FAMILIES.map(f => {
    let streak = 0
    let alertDay: number | null = null
    for (let i = 0; i < days; i++) {
      const d = run.daily[i]
      if (!Number.isFinite(d.sh) && f.id !== 'def' && f.id !== 'duty') continue
      streak = f.test(d, twin.daily[i]) ? streak + 1 : 0
      if (streak >= 2) {
        alertDay = i + 1 // fim do 2º dia
        break
      }
    }
    const al = firstAlarm(f.alarms)
    return {
      family: f,
      alertDay,
      alarmDay: al ? al.day : null,
      alarmCode: al ? al.code : null,
      lead: alertDay !== null && al ? al.day - alertDay : null,
      extraKwh: extra,
    }
  })
}

export function totalKwh(run: Run) {
  return run.daily.reduce((s, d) => s + d.kwhComp + d.kwhDef + d.kwhFan, 0)
}
