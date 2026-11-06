/**
 * Digital twin dinâmico de uma câmara fria de resfriados (R404A, unidade condensadora,
 * válvula de expansão termostática, degelo elétrico). Passo de 1 minuto, dias simulados.
 *
 * Física simplificada mas fechada em energia:
 *   - Caixa: C·dT/dt = paredes + porta (sensível) + produto + ventilador + vazamento do degelo − Q_evap
 *   - Ciclo quase-estático a cada minuto ligado (Te, Tc por balanço, como no digital twin do split)
 *   - Gelo: umidade que entra pela porta e pelo produto vira gelo na serpentina abaixo de 0 °C;
 *     reduz o UA do evaporador. Degelo derrete com a resistência; termina por temperatura ou tempo.
 *   - Vazamento: o reservatório segura até `KNEE`; abaixo disso falta líquido na válvula.
 *   - Válvula termostática: ajuste estático (offset) e bulbo solto (alimenta demais e oscila).
 * Alarmes com os limites e atrasos típicos dos manuais (Danfoss EKC/AK-CC, Full Gauge, Carel).
 */

export type Defrost = 'tempo' | 'demanda'

export type CRParams = {
  days: number
  seed: number
  tSet: number // setpoint da caixa [°C]
  tExt: number // T externa média [°C]
  rhExt: number // umidade externa média [0–1]
  doors: number // aberturas de porta por dia
  leak: number // vazamento [% da carga por dia]
  txvOffset: number // desregulagem do superaquecimento estático [K]
  bulbLoose: boolean // bulbo da válvula solto / mal isolado
  condFoul: number // sujeira do condensador [% de ar perdido por dia]
  heater: number // saúde da resistência de degelo [0–1]
  defrost: Defrost
  defPerDay: number // degelos por dia no modo por tempo
}

export const HEALTHY: CRParams = {
  days: 60,
  seed: 3,
  tSet: 2,
  tExt: 27,
  rhExt: 0.7,
  doors: 40,
  leak: 0,
  txvOffset: 0,
  bulbLoose: false,
  condFoul: 0,
  heater: 1,
  defrost: 'tempo',
  defPerDay: 4,
}

/** Limites dos alarmes (valores típicos de instalação, ver research_notes/Alarmes de controladores). */
export const LIM = {
  diff: 2, // diferencial do termostato [K]
  a1: 8, // A13 / Athi: temperatura alta [°C]
  a1Delay: 30, // A03 [min]
  a1AfterDef: 90, // A12: sem alarme até 90 min após degelo
  d04: 45, // tempo máximo de degelo [min]
  tEndDef: 10, // temperatura de fim de degelo [°C]
  shHigh: 20, // ASHH [K]
  shHighDelay: 30,
  shLow: 2, // ASHL / LSH [K]
  shLowDelay: 10,
  teLop: -30, // pressostato de baixa (Te) [°C]
  tcHigh: 55, // pressostato de alta (Tc) [°C]
  tDis: 115, // temperatura de descarga [°C]
  minOff: 3, // tempo mínimo desligado [min]
}

const R_GAS = 8.314 / 97.6 // R404A [kJ/kg·K]
const K = 1.1
export const KNEE = 0.72 // fração de carga em que o reservatório esvazia
const UA_E0 = 350 // W/K
const UA_C0 = 450 // W/K
const VDN = 0.00131 // m³/s
const C_BOX = 600e3 // J/K
const C_COIL = 90e3 // J/K
const UA_WALL = 25 // W/K
const Q_PRODUCT = 350 // W
const FAN_E = 150 // W
const FAN_C = 120 // W
const HEATER_W = 3000 // W
const FROST_REF = 1.5 // kg

/** Saturação do R404A [bar abs], ajuste de Clausius-Clapeyron (−30 a 50 °C). */
export function psat(t: number) {
  return Math.exp(10.478 - 2371 / (t + 273.15))
}
export function tsat(p: number) {
  return 2371 / (10.478 - Math.log(p)) - 273.15
}
function wAir(t: number, rh: number) {
  const pv = rh * 0.61078 * Math.exp((17.27 * t) / (t + 237.3))
  return (0.622 * pv) / (101.3 - pv)
}

function rng(seed: number) {
  let r = seed * 7919 + 13
  return () => {
    r = (r * 16807) % 2147483647
    return r / 2147483647
  }
}

/** Balanço do ciclo com a caixa a tBox. Retorna Te, Tc, potências e temperaturas. */
function cycle(tBox: number, tExt: number, uaE: number, uaC: number, sh: number, sc: number, guess: { te: number; tc: number }) {
  let te = guess.te
  let tc = guess.tc
  let m = 0
  let w = 0
  let q = 0
  let pr = 1
  for (let i = 0; i < 12; i++) {
    const pe = psat(te)
    const pc = psat(tc)
    pr = pc / pe
    const etaV = Math.max(0.05, 1 - 0.05 * (pr ** (1 / K) - 1))
    const tSuc = te + sh + 273.15
    const vSuc = (R_GAS * tSuc) / (pe * 100)
    m = (etaV * VDN) / vSuc
    w = (m * (K / (K - 1)) * R_GAS * tSuc * (pr ** ((K - 1) / K) - 1) * 1000) / 0.65
    const dh = (190 - 0.6 * te) * 1000 - 1400 * (tc - sc - te) + 900 * sh
    q = m * Math.max(20e3, dh)
    const teN = tBox - q / uaE
    const tcN = tExt + (q + w) / uaC
    te += 0.5 * (teN - te)
    tc += 0.5 * (tcN - tc)
  }
  const tDis = (te + sh + 273.15) * (1 + (pr ** ((K - 1) / K) - 1) / 0.65) - 273.15
  return { te, tc, q, w, tDis }
}

export type AlarmEvent = { t: number; code: string; name: string }

export type Daily = {
  duty: number
  kwhComp: number
  kwhDef: number
  kwhFan: number
  nDef: number
  defDur: number // média [min]
  defByTime: number
  sh: number // mediana ligado
  shStd: number
  sc: number
  approach: number // Tc − T ext
  dTcoil: number // T caixa − T serpentina, ligado
  tBoxMax: number
  frostMax: number
  charge: number
  tExt: number
  rh: number
  starts: number
}

export type Run = {
  minutes: number
  /** séries por minuto (só quando `keepMinutes`) */
  m?: {
    tBox: Float32Array
    tCoil: Float32Array
    comp: Uint8Array
    def: Uint8Array
    door: Uint8Array
    frost: Float32Array
    sh: Float32Array
    sc: Float32Array
    te: Float32Array
    tc: Float32Array
    tDis: Float32Array
    pElec: Float32Array
    tExt: Float32Array
    charge: Float32Array
  }
  daily: Daily[]
  alarms: AlarmEvent[]
}

const median = (a: number[]) => {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}
const std = (a: number[]) => {
  if (a.length < 2) return 0
  const mu = a.reduce((s, v) => s + v, 0) / a.length
  return Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / a.length)
}

export function simulate(p: CRParams, keepMinutes = false): Run {
  const N = p.days * 1440
  const rnd = rng(p.seed)
  const noise = rng(p.seed + 101)

  // Clima e portas: dependem só da semente (o digital twin saudável vê o mesmo dia)
  const dayOff: number[] = []
  const dayRh: number[] = []
  const doorAt = new Uint8Array(N)
  for (let d = 0; d < p.days; d++) {
    dayOff.push((rnd() - 0.5) * 6)
    dayRh.push(Math.min(0.95, Math.max(0.35, p.rhExt + (rnd() - 0.5) * 0.4)))
    const n = Math.round(p.doors * (0.7 + 0.6 * rnd()))
    for (let i = 0; i < n; i++) doorAt[d * 1440 + 420 + Math.floor(rnd() * 780)] = 1
  }

  const M = keepMinutes
    ? {
        tBox: new Float32Array(N),
        tCoil: new Float32Array(N),
        comp: new Uint8Array(N),
        def: new Uint8Array(N),
        door: new Uint8Array(N),
        frost: new Float32Array(N),
        sh: new Float32Array(N),
        sc: new Float32Array(N),
        te: new Float32Array(N),
        tc: new Float32Array(N),
        tDis: new Float32Array(N),
        pElec: new Float32Array(N),
        tExt: new Float32Array(N),
        charge: new Float32Array(N),
      }
    : undefined

  let tBox = p.tSet
  let tCoil = p.tSet - 8
  let frost = 0.2
  let comp = false
  let offFor = 99
  let defLeft = 0 // >0: em degelo
  let defElapsed = 0
  let sinceDef = 999
  let lastDefAt = 0
  let lockout = 0
  const guess = { te: -8, tc: 40 }
  const wBox = wAir(p.tSet, 0.9)
  const alarms: AlarmEvent[] = []
  const timers: Record<string, number> = {}
  const active: Record<string, boolean> = {}
  const lastAt: Record<string, number> = {}
  const raise = (code: string, name: string, cond: boolean, delay: number, t: number) => {
    timers[code] = cond ? (timers[code] ?? 0) + 1 : 0
    const on = timers[code] >= delay
    // um episódio por código a cada 6 h (o controlador mantém o alarme até reconhecimento)
    if (on && !active[code] && t - (lastAt[code] ?? -1e9) > 360) {
      alarms.push({ t, code, name })
      lastAt[code] = t
    }
    active[code] = on
  }

  // acumuladores diários
  let acc = newAcc()
  const daily: Daily[] = []
  let baseDTcoil = 0
  let baseCount = 0

  for (let t = 0; t < N; t++) {
    const day = Math.floor(t / 1440)
    const hour = (t % 1440) / 60
    const tExt = p.tExt + dayOff[day] + 5 * Math.sin((2 * Math.PI * (hour - 9)) / 24)
    const rh = dayRh[day]
    const charge = Math.max(0.2, 1 - (p.leak / 100) * (t / 1440))
    const foul = Math.min(0.85, (p.condFoul / 100) * (t / 1440))
    const door = doorAt[t] === 1
    // resistência de degelo perdendo potência aos poucos (elementos queimando)
    const heater = 1 - (1 - p.heater) * Math.min(1, t / (p.days * 1440 * 0.6))

    // --- Válvula e carga ---
    let sh = 6 + p.txvOffset
    if (p.bulbLoose) {
      // bulbo soltando aos poucos: a válvula alimenta demais e passa a "caçar" (período ~30 min)
      const sev = Math.min(1, t / (30 * 1440))
      sh += -1 - 4 * sev + (1 + 3.5 * sev) * Math.sin((2 * Math.PI * t) / 30) + 0.5 * (noise() * 2 - 1)
    }
    if (charge < KNEE) sh += 60 * (KNEE - charge)
    sh = Math.min(60, Math.max(0.5, sh))
    const sc = 6 * Math.min(1, Math.max(0, (charge - KNEE) / (1 - KNEE)))
    const starve = charge < KNEE ? (charge / KNEE) ** 2 : 1
    const usage = Math.min(1.05, Math.max(0.2, 1 - (sh - 6) / 45))
    const frostF = 1 / (1 + (frost / FROST_REF) ** 2)
    const uaE = UA_E0 * frostF * usage * starve
    const uaC = UA_C0 * (1 - foul) ** 0.8

    // --- Degelo ---
    let startDef = false
    if (defLeft <= 0 && sinceDef > 0) {
      if (p.defrost === 'tempo') {
        startDef = t - lastDefAt >= 1440 / p.defPerDay
      } else {
        // por demanda: ΔT caixa−serpentina subiu ~2,5 K acima do limpo, ou 24 h sem degelo
        const dT = comp ? tBox - tCoil : 0
        startDef = (t - lastDefAt >= 240 && comp && baseCount > 30 && dT > baseDTcoil / baseCount + 2.5) || t - lastDefAt >= 1440
      }
    }
    if (startDef) {
      defLeft = 1
      defElapsed = 0
      lastDefAt = t
      comp = false
      acc.nDef++
    }

    let qEvap = 0
    let pElec = FAN_E
    let qHeaterBox = 0
    let te = tCoil
    let tc = tExt
    let tDis = tExt
    if (defLeft > 0) {
      defElapsed++
      const heat = HEATER_W * heater * 60 // J por minuto
      pElec = HEATER_W * heater
      qHeaterBox = 0.25 * HEATER_W * heater
      let e = 0.6 * heat
      if (tCoil < 0) {
        const need = (0 - tCoil) * C_COIL
        const use = Math.min(e, need)
        tCoil += use / C_COIL
        e -= use
      }
      if (e > 0 && frost > 0) {
        const melt = Math.min(frost, e / 334e3)
        frost -= melt
        e -= melt * 334e3
      }
      if (e > 0 && frost <= 0) tCoil += e / C_COIL
      const endByTemp = tCoil >= LIM.tEndDef
      const endByTime = defElapsed >= LIM.d04
      if (endByTemp || endByTime) {
        defLeft = 0
        sinceDef = 0
        acc.defDurSum += defElapsed
        if (endByTime && !endByTemp) {
          acc.defByTime++
          alarms.push({ t, code: 'dEF', name: 'Degelo terminado por tempo' })
        }
      }
    } else {
      sinceDef++
      // termostato
      offFor = comp ? 0 : offFor + 1
      if (lockout > 0) {
        lockout--
        comp = false
      } else if (!comp && tBox > p.tSet + LIM.diff / 2 && offFor >= LIM.minOff) {
        comp = true
        acc.starts++
      } else if (comp && tBox < p.tSet - LIM.diff / 2) comp = false

      if (comp) {
        const c = cycle(tBox, tExt, uaE, uaC, sh, sc, guess)
        guess.te = c.te
        guess.tc = c.tc
        te = c.te
        tc = c.tc
        tDis = c.tDis
        qEvap = c.q
        pElec = FAN_E + FAN_C + c.w
        tCoil += (te + 1 - tCoil) / 3
        // pressostato de baixa: desarma e trava 20 min
        if (te < LIM.teLop) {
          comp = false
          lockout = 20
        }
        acc.on++
        acc.shOn.push(sh)
        acc.scOn.push(sc)
        acc.approach.push(tc - tExt)
        if (sinceDef > 60) acc.dTcoil.push(tBox - tCoil)
        // referência do degelo por demanda: ΔT com serpentina limpa, no começo da operação
        if (frost < 0.3 && sinceDef > 60 && baseCount < 200) {
          baseDTcoil += tBox - tCoil
          baseCount++
        }
        acc.kwhComp += (pElec - FAN_E) / 60000
      } else {
        tCoil += (tBox - tCoil) / 15
      }
    }
    // umidade → gelo
    const moist = (door ? Math.max(0, wAir(tExt, rh) - wBox) * 3.6 : 0) + 0.6 / 1440
    if (tCoil < 0) frost += moist

    // --- Caixa ---
    const qDoor = door ? 2500 + 60 * (tExt - tBox) : 0
    const qLoad = UA_WALL * (tExt - 4 - tBox) + qDoor + Q_PRODUCT + (defLeft > 0 ? 0 : FAN_E) + qHeaterBox
    tBox += ((qLoad - qEvap) * 60) / C_BOX

    // --- Alarmes do controlador ---
    raise('A1', 'Temperatura alta na câmara', tBox > LIM.a1 && sinceDef > LIM.a1AfterDef && defLeft <= 0, LIM.a1Delay, t)
    raise('ASHH', 'Superaquecimento alto', comp && sh > LIM.shHigh, LIM.shHighDelay, t)
    raise('ASHL', 'Superaquecimento baixo', comp && sh < LIM.shLow, LIM.shLowDelay, t)
    raise('LOP', 'Pressão de evaporação baixa', lockout > 0, 1, t)
    raise('HP', 'Pressão de condensação alta', comp && tc > LIM.tcHigh, 10, t)
    raise('tDis', 'Temperatura de descarga alta', comp && tDis > LIM.tDis, 10, t)

    // energia de ventiladores e degelo
    acc.kwhFan += (defLeft > 0 ? 0 : FAN_E + (comp ? FAN_C : 0)) / 60000
    if (defLeft > 0) acc.kwhDef += (HEATER_W * heater) / 60000
    acc.tBoxMax = Math.max(acc.tBoxMax, tBox)
    acc.frostMax = Math.max(acc.frostMax, frost)

    if (M) {
      M.tBox[t] = tBox
      M.tCoil[t] = tCoil
      M.comp[t] = comp ? 1 : 0
      M.def[t] = defLeft > 0 ? 1 : 0
      M.door[t] = door ? 1 : 0
      M.frost[t] = frost
      M.sh[t] = comp ? sh : NaN
      M.sc[t] = sc
      M.te[t] = comp ? te : NaN
      M.tc[t] = comp ? tc : NaN
      M.tDis[t] = comp ? tDis : NaN
      M.pElec[t] = pElec
      M.tExt[t] = tExt
      M.charge[t] = charge
    }

    if (t % 1440 === 1439) {
      daily.push({
        duty: acc.on / 1440,
        kwhComp: acc.kwhComp,
        kwhDef: acc.kwhDef,
        kwhFan: acc.kwhFan,
        nDef: acc.nDef,
        defDur: acc.nDef ? acc.defDurSum / acc.nDef : 0,
        defByTime: acc.defByTime,
        sh: median(acc.shOn),
        shStd: std(acc.shOn),
        sc: median(acc.scOn),
        approach: median(acc.approach),
        dTcoil: median(acc.dTcoil),
        tBoxMax: acc.tBoxMax,
        frostMax: acc.frostMax,
        charge,
        tExt: p.tExt + dayOff[day],
        rh,
        starts: acc.starts,
      })
      acc = newAcc()
    }
  }
  return { minutes: N, m: M, daily, alarms }
}

function newAcc() {
  return {
    on: 0,
    kwhComp: 0,
    kwhDef: 0,
    kwhFan: 0,
    nDef: 0,
    defDurSum: 0,
    defByTime: 0,
    shOn: [] as number[],
    scOn: [] as number[],
    approach: [] as number[],
    dTcoil: [] as number[],
    tBoxMax: -99,
    frostMax: 0,
    starts: 0,
  }
}
