export type UnitStatus = 'ok' | 'warn' | 'alert' | 'off'

export type TwinEvent = {
  unit: string
  status: UnitStatus
  liters: number
}

export const STATUS_COLOR: Record<UnitStatus, string> = {
  ok: '#34d399',
  warn: '#f7e921',
  alert: '#f87171',
  off: '#64748b',
}
