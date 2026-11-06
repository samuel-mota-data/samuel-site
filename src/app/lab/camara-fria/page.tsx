import type { Metadata } from 'next'
import ColdRoomApp from '@/components/lab/ColdRoomApp'

export const metadata: Metadata = {
  title: 'Câmara fria · Lab · Samuel Mota',
  description:
    'Digital twin de câmara fria: falhas injetadas, alarmes dos controladores, alerta preditivo dias antes, degelo por demanda e momento ótimo de recarga de gás.',
}

export default function Page() {
  return <ColdRoomApp />
}
