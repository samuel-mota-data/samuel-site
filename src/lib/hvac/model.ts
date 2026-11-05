/**
 * Gêmeo digital de um split (R410A, compressor rotativo, motor PSC com capacitor de partida permanente).
 *
 * Modelo quase-estático:
 *   - Saturação R410A por Clausius-Clapeyron ajustada (0–50 °C, erro < 2%).
 *   - Compressor: deslocamento volumétrico fixo, rendimento volumétrico e isentrópico.
 *   - Trocadores: Q = UA·ΔT, com UA proporcional a (vazão de ar)^0,8.
 *   - Motor: corrente ativa + corrente de magnetização (saturação ~V³); capacitor degradado
 *     aumenta a corrente (efeito semi-empírico calibrado com a UFPB).
 *
 * Calibração: dados elétricos da UFPB (de Oliveira et al., Data 2024, 9(9):106),
 * ver `calibrate.ts`. Sem dependências: roda no navegador e no Node.
 */

export type Inputs = {
  tAmb: number // temperatura externa [°C]
  tIn: number // temperatura interna [°C]
  volts: number // tensão RMS da rede [V]
  condBlock: number // obstrução da entrada de ar do condensador [0–1]
  filterBlock: number // obstrução do filtro do evaporador [0–1]
  capLoss: number // perda de capacitância do capacitor [0–1]
  charge: number // carga de refrigerante relativa [0–1], 1 = nominal
}

export type State = {
  tEvap: number
  tCond: number
  pEvap: number // bar
  pCond: number // bar
  superheat: number
  subcool: number
  tDischarge: number
  massFlow: number // kg/s
  qEvap: number // W (capacidade)
  wShaft: number // W
  pElec: number // W (unidade externa: compressor + ventilador)
  irms: number // A
  pf: number
  h3: number // 3ª harmônica relativa
  h5: number
  ripple: number // modulação de torque na rotação
  cop: number
  trips: string[] // proteções que atuariam
}

export const NOMINAL: Inputs = {
  tAmb: 30,
  tIn: 24,
  volts: 220,
  condBlock: 0,
  filterBlock: 0,
  capLoss: 0,
  charge: 1,
}

/** Parâmetros físicos. Os marcados com (cal) vêm de `calibrate.ts`. */
export const P = {
  vdN: 0.000697, // deslocamento × rotação [m³/s] (≈ 12 cm³ a 58 rps) (cal: FL ≈ 6,28 A)
  k: 1.15, // expoente politrópico do R410A vapor
  clearance: 0.04,
  etaIs: 0.7,
  uaEvap: 200, // W/K
  uaCond: 290, // W/K
  airCond: 0.972, // queda de vazão por fração obstruída no condensador (cal: CI30/CI60)
  airEvap: 0.5, // idem filtro do evaporador
  fanW: 150, // ventilador da unidade externa [W]
  etaMotor: 0.86,
  iMag0: 1.7, // corrente de magnetização a 220 V [A]
  capGain: 0.317, // aumento de corrente por perda de capacitância (cal: CD30)
  shNom: 5, // superaquecimento nominal [K]
  scNom: 5, // sub-resfriamento nominal [K]
  rla: 8.6, // corrente de placa (RLA) [A]
  pHighTrip: 41.5, // pressostato de alta [bar]
  tDisTrip: 115, // proteção térmica de descarga [°C]
  pLowTrip: 4.8, // pressostato de baixa [bar] (≈ -15 °C de evaporação)
}

const R_GAS = 8.314 / 72.6 // kJ/(kg·K), R410A

/** Pressão de saturação do R410A [bar]. */
export function psat(tC: number) {
  return Math.exp(10.768 - 2374 / (tC + 273.15))
}

function solve(x: Inputs) {
  const airC = Math.max(0.05, 1 - P.airCond * x.condBlock)
  const airE = Math.max(0.05, 1 - P.airEvap * x.filterBlock)
  // Falta de carga: parte do evaporador vira superaquecimento e o sub-resfriamento some.
  const lack = Math.max(0, 1 - x.charge)
  const superheat = P.shNom + 45 * lack
  const subcool = Math.max(0, P.scNom * (1 - 2.5 * lack))
  const uaE = P.uaEvap * airE ** 0.8 * Math.max(0.15, 1 - 1.6 * lack)
  const uaC = P.uaCond * airC ** 0.8

  let tE = 7
  let tC = 45
  let out = { m: 0, w: 0, q: 0, pr: 1 }
  for (let it = 0; it < 200; it++) {
    const pE = psat(tE)
    const pC = psat(tC)
    const pr = pC / pE
    const k = P.k
    const etaV = Math.max(0.05, 1 - P.clearance * (pr ** (1 / k) - 1))
    const tSuc = tE + superheat + 273.15
    const vSuc = (R_GAS * tSuc) / (pE * 100) // m³/kg
    const m = (etaV * P.vdN) / vSuc
    const w = (m * (k / (k - 1)) * R_GAS * tSuc * (pr ** ((k - 1) / k) - 1) * 1000) / P.etaIs
    const latent = (230 - 1.2 * tE) * 1000
    const dh = latent - 1600 * (tC - subcool - tE) + 900 * superheat
    const q = m * dh
    // Atualização amortecida das temperaturas de saturação
    const tEnew = x.tIn - q / uaE
    const tCnew = x.tAmb + (q + w) / uaC
    tE += 0.3 * (tEnew - tE)
    tC += 0.3 * (tCnew - tC)
    out = { m, w, q, pr }
  }
  return { tE, tC, superheat, subcool, ...out }
}

export function simulate(x: Inputs): State {
  const s = solve(x)
  const k = P.k
  const tDischarge =
    (s.tE + s.superheat + 273.15) * (1 + (s.pr ** ((k - 1) / k) - 1) / P.etaIs) - 273.15
  const pComp = s.w / P.etaMotor
  const pElec = pComp + P.fanW
  // Corrente: parte ativa (P/V) + magnetização (satura com V³); capacitor fraco eleva tudo.
  const iAct = pElec / x.volts
  const iMag = P.iMag0 * (x.volts / 220) ** 3
  const capFactor = 1 + P.capGain * x.capLoss
  const irms = Math.hypot(iAct, iMag) * capFactor
  const pf = pElec / (x.volts * irms)
  const pCond = psat(s.tC)
  const trips: string[] = []
  if (pCond > P.pHighTrip) trips.push('Pressostato de alta')
  if (psat(s.tE) < P.pLowTrip) trips.push('Pressostato de baixa')
  if (tDischarge > P.tDisTrip) trips.push('Temperatura de descarga')
  if (irms > P.rla * 1.15) trips.push('Sobrecorrente')
  return {
    tEvap: s.tE,
    tCond: s.tC,
    pEvap: psat(s.tE),
    pCond,
    superheat: s.superheat,
    subcool: s.subcool,
    tDischarge,
    massFlow: s.m,
    qEvap: s.q,
    wShaft: s.w,
    pElec,
    irms,
    pf,
    h3: 0.03 + 0.12 * x.capLoss,
    h5: 0.015 + 0.03 * x.capLoss,
    ripple: 0.01 + 0.012 * (s.pr - 2),
    cop: s.q / pElec,
    trips,
  }
}

/** Forma de onda de corrente e tensão (como o alicate e o trafo leriam). */
export function waveform(x: Inputs, st: State, fs = 2048, seconds = 1, seed = 1) {
  const n = Math.round(fs * seconds)
  const i = new Float64Array(n)
  const v = new Float64Array(n)
  const phi = Math.acos(Math.min(1, st.pf))
  const fRot = 58.3 // rotação do compressor (escorregamento)
  let r = seed
  const rnd = () => {
    r = (r * 16807) % 2147483647
    return r / 2147483647 - 0.5
  }
  for (let j = 0; j < n; j++) {
    const t = j / fs
    const w = 2 * Math.PI * 60 * t
    const mod = 1 + st.ripple * Math.sin(2 * Math.PI * fRot * t)
    i[j] =
      Math.SQRT2 * st.irms * mod *
        (Math.sin(w - phi) + st.h3 * Math.sin(3 * w - 2 * phi) + st.h5 * Math.sin(5 * w + phi)) +
      0.04 * rnd()
    v[j] = Math.SQRT2 * x.volts * (Math.sin(w) + 0.02 * Math.sin(5 * w)) + 0.5 * rnd()
  }
  return { i, v, fs }
}

/** Espectro de amplitude (FFT radix-2, janela de Hann). n deve ser potência de 2. */
export function spectrum(sig: Float64Array, fs: number) {
  const n = sig.length
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let j = 0; j < n; j++) re[j] = sig[j] * (0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (n - 1)))
  for (let j = 1, b = 0; j < n; j++) {
    let bit = n >> 1
    for (; b & bit; bit >>= 1) b ^= bit
    b ^= bit
    if (j < b) {
      ;[re[j], re[b]] = [re[b], re[j]]
      ;[im[j], im[b]] = [im[b], im[j]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let s = 0; s < n; s += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k)
        const wi = Math.sin(ang * k)
        const a = s + k
        const b = a + len / 2
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
  }
  const half = n / 2
  const mag = new Float64Array(half)
  for (let k = 0; k < half; k++) mag[k] = (4 * Math.hypot(re[k], im[k])) / n
  return { mag, df: fs / n }
}

/**
 * Prognóstico: degradação progressiva ao longo de `days` dias com clima variando.
 * Linha de base "saudável" aprendida pelo próprio modelo (corrente esperada dado clima e rede);
 * o resíduo acumulado (EWMA) dispara o alerta antes de a proteção desligar o compressor.
 */
export function prognosis(kind: 'cond' | 'leak', ratePerDay: number, days = 120, seed = 7) {
  let r = seed
  const rnd = () => {
    r = (r * 16807) % 2147483647
    return r / 2147483647 - 0.5
  }
  const rows: { day: number; tAmb: number; irms: number; expected: number; resid: number; ewma: number; severity: number; trip: boolean }[] = []
  let ewma = 0
  let alertDay: number | null = null
  let tripDay: number | null = null
  for (let d = 0; d < days; d++) {
    const tAmb = 29 + 4 * Math.sin((2 * Math.PI * d) / 60) + 3 * rnd()
    const volts = 220 + 8 * rnd()
    const severity = Math.min(1, ratePerDay * d)
    const x: Inputs = {
      ...NOMINAL,
      tAmb,
      volts,
      condBlock: kind === 'cond' ? severity : 0,
      charge: kind === 'leak' ? 1 - severity : 1,
    }
    const st = simulate(x)
    const irms = st.irms * (1 + 0.006 * rnd() * 2)
    const expected = simulate({ ...NOMINAL, tAmb, volts }).irms
    const resid = (irms - expected) / expected
    ewma = 0.2 * resid + 0.8 * ewma
    const trip = st.trips.length > 0
    if (alertDay === null && d > 14 && Math.abs(ewma) > 0.03) alertDay = d
    if (tripDay === null && trip) tripDay = d
    rows.push({ day: d, tAmb, irms, expected, resid, ewma, severity, trip })
  }
  return { rows, alertDay, tripDay }
}
