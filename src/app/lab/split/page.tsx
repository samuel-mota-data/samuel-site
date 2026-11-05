import type { Metadata } from 'next'
import LabApp from '@/components/lab/LabApp'

export const metadata: Metadata = {
  title: 'Split · Lab · Samuel Mota',
  description:
    'Simulador físico de ar-condicionado split calibrado com dados reais: falhas injetadas, assinatura elétrica, diagnóstico e prognóstico com sensor mínimo.',
}

export default function Page() {
  return <LabApp />
}
