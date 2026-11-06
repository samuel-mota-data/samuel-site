import type { Metadata } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' })
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  metadataBase: new URL('https://samuel.simia.digital'),
  title: 'Samuel Mota — IoT Engineer · Smart City · Digital Twin',
  description:
    'Sistemas IoT de ponta a ponta: dispositivos, redes NB-IoT/LTE, MQTT, integração de fabricantes em Python, plataforma Django, alertas e digital twin. 12 anos do painel elétrico ao produto.',
  openGraph: {
    title: 'Samuel Mota — IoT Engineer · Smart City · Digital Twin',
    description: 'Do sensor no campo ao digital twin.',
    images: ['/samuel.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
