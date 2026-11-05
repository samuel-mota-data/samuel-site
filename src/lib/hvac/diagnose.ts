import { NOMINAL, P, simulate, type Inputs, type State } from './model'

/**
 * Diagnóstico com sensor mínimo: só o que um disjuntor inteligente mede (corrente, tensão,
 * harmônicas) + temperatura externa de uma API de clima (sem sensor no equipamento).
 *
 * 1. Linha de base: corrente esperada do equipamento SAUDÁVEL para aquele clima e tensão.
 * 2. 3ª harmônica acima do normal → capacitor; desconta o efeito dele na corrente.
 * 3. Resíduo restante: positivo → troca de calor no condensador; negativo → falta de carga.
 */
export function diagnose(x: Inputs, s: State) {
  const healthy = simulate({ ...NOMINAL, tAmb: x.tAmb, tIn: x.tIn, volts: x.volts })
  const dh3 = s.h3 - healthy.h3
  const capEst = Math.max(0, dh3 / 0.12)
  const iCorr = s.irms / (1 + P.capGain * capEst)
  const resid = iCorr / healthy.irms - 1
  const found: string[] = []
  if (capEst > 0.1) found.push(`Capacitor −${Math.round(capEst * 100)}%`)
  if (resid > 0.04) found.push('Condensador sujo')
  if (resid < -0.04) found.push('Baixa carga / vazamento')
  return {
    expected: healthy.irms,
    resid,
    capEst,
    label: found.length ? found.join(' + ') : 'Normal',
  }
}
