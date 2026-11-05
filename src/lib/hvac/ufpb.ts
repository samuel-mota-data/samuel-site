import type { Inputs } from './model'

/**
 * Variação da corrente RMS em relação à condição sem falha (FL = 6,28 A), medida no
 * dataset da UFPB (de Oliveira et al., Data 2024, 9(9):106), média das janelas de 1 s.
 * `fit` = usada para calibrar; `val` = validação fora da amostra.
 */
export const UFPB: { id: string; name: string; x: Partial<Inputs>; dI: number; use: 'fit' | 'val' }[] = [
  { id: 'CI30', name: 'Condensador 30%', x: { condBlock: 0.3 }, dI: 0.126, use: 'fit' },
  { id: 'CI60', name: 'Condensador 60%', x: { condBlock: 0.6 }, dI: 0.273, use: 'fit' },
  { id: 'CD30', name: 'Capacitor −30%', x: { capLoss: 0.3 }, dI: 0.095, use: 'fit' },
  { id: 'FI50', name: 'Filtro 50%', x: { filterBlock: 0.5 }, dI: 0.032, use: 'val' },
  { id: 'CD30FI50', name: 'Capacitor + filtro', x: { capLoss: 0.3, filterBlock: 0.5 }, dI: 0.08, use: 'val' },
  { id: 'CD30CI30', name: 'Capacitor + cond. 30%', x: { capLoss: 0.3, condBlock: 0.3 }, dI: 0.157, use: 'val' },
  { id: 'CI60FI50', name: 'Cond. 60% + filtro', x: { condBlock: 0.6, filterBlock: 0.5 }, dI: 0.287, use: 'val' },
  { id: 'CD30CI60', name: 'Capacitor + cond. 60%', x: { capLoss: 0.3, condBlock: 0.6 }, dI: 0.395, use: 'val' },
]
