/**
 * Calibração do digital twin com os dados elétricos da UFPB.
 * Rodar: node scripts/calibrate-hvac.ts
 *
 * Ajusta 3 parâmetros só com as falhas SIMPLES (FL, CI30, CI60, CD30) e usa as
 * falhas DUPLAS como validação fora da amostra.
 */
import { NOMINAL, P, simulate, type Inputs } from '../src/lib/hvac/model.ts'
import { UFPB } from '../src/lib/hvac/ufpb.ts'

const I_FL = 6.28

function rel(x: Partial<Inputs>) {
  return simulate({ ...NOMINAL, ...x }).irms / simulate(NOMINAL).irms - 1
}

// 1) vdN para bater a corrente absoluta sem falha
let lo = 0.0003, hi = 0.0015
for (let i = 0; i < 60; i++) {
  P.vdN = (lo + hi) / 2
  if (simulate(NOMINAL).irms > I_FL) hi = P.vdN
  else lo = P.vdN
}
// 2) airCond por mínimos quadrados em CI30 e CI60
let best = { e: Infinity, a: 0 }
for (let a = 0.2; a <= 1.2; a += 0.0025) {
  P.airCond = a
  const e = (rel({ condBlock: 0.3 }) - 0.126) ** 2 + (rel({ condBlock: 0.6 }) - 0.273) ** 2
  if (e < best.e) best = { e, a }
}
P.airCond = best.a
// 3) capGain para CD30
lo = 0; hi = 1
for (let i = 0; i < 60; i++) {
  P.capGain = (lo + hi) / 2
  if (rel({ capLoss: 0.3 }) > 0.095) hi = P.capGain
  else lo = P.capGain
}

const fl = simulate(NOMINAL)
console.log(`vdN=${P.vdN.toFixed(6)} airCond=${P.airCond.toFixed(3)} capGain=${P.capGain.toFixed(3)}`)
console.log(`FL: I=${fl.irms.toFixed(2)} A  P=${fl.pElec.toFixed(0)} W  FP=${fl.pf.toFixed(3)}  Te=${fl.tEvap.toFixed(1)}  Tc=${fl.tCond.toFixed(1)}  Q=${fl.qEvap.toFixed(0)} W  COP=${fl.cop.toFixed(2)}  Tdes=${fl.tDischarge.toFixed(0)}`)
console.log('cond      uso   medido   modelo   erro(pp)')
for (const c of UFPB) {
  const k = c.id
  const m = rel(c.x)
  console.log(`${k.padEnd(9)} ${c.use}  ${(100 * c.dI).toFixed(1).padStart(6)}%  ${(100 * m).toFixed(1).padStart(6)}%  ${(100 * (m - c.dI)).toFixed(1).padStart(6)}`)
}
