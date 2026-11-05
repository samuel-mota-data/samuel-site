import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lab · Samuel Mota',
  description:
    'Gêmeos digitais de refrigeração com falhas injetadas e diagnóstico pela assinatura elétrica, e desafios de otimização do Kaggle com registro de experimentos.',
}

type Project = { href: string | null; status: string; title: string; text: string; tags: string[] }

const SECTIONS: { kicker: string; title: string; text: string; projects: Project[] }[] = [
  {
    kicker: 'Lab · Manutenção preditiva',
    title: 'Gêmeos digitais de refrigeração',
    text: 'Falhas físicas simuladas e injetadas, validadas contra dados reais publicados, e identificadas pela assinatura elétrica.',
    projects: [
      {
        href: '/lab/split',
        status: 'ativo',
        title: 'Split 18.000 BTU',
        text: 'Gêmeo digital calibrado com medições reais. Falhas de condensador, filtro, capacitor e vazamento vistas só pela energia.',
        tags: ['R410A', 'motor PSC', 'dataset UFPB', '3D'],
      },
      {
        href: '/lab/camara-fria',
        status: 'ativo',
        title: 'Câmara fria',
        text: 'Alarmes dos controladores × alerta preditivo dias antes, degelo por demanda e o momento ótimo de recarga num microvazamento.',
        tags: ['R404A', 'degelo', 'alarmes', 'recarga ótima', '3D'],
      },
    ],
  },
  {
    kicker: 'Lab · Desafios de otimização',
    title: 'Kaggle',
    text: 'Problemas abertos com placar público. Cada técnica testada vira log: parâmetros, resultado, tempo e ganho sobre a referência.',
    projects: [
      {
        href: '/lab/kaggle/squares-in-squares',
        status: 'ativo',
        title: 'Squares in Squares',
        text: 'Empacotar n quadrados unitários no menor quadrado, n = 1 a 1000. Compressão física, validação exata e evolução do score.',
        tags: ['otimização', 'geometria', 'física 2D', 'Kaggle'],
      },
    ],
  },
]

function Card({ p }: { p: Project }) {
  const body = (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className={`font-mono text-[11px] uppercase tracking-widest ${p.href ? 'text-signal' : 'text-white/40'}`}>{p.status}</span>
        {p.href && <span className="font-mono text-xs text-white/50 group-hover:text-signal transition-colors">abrir →</span>}
      </div>
      <h3 className="font-display text-2xl font-bold">{p.title}</h3>
      <p className="mt-2 text-sm text-white/60">{p.text}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {p.tags.map(t => (
          <span key={t} className="px-2 py-0.5 rounded border border-white/10 font-mono text-[11px] text-white/55">{t}</span>
        ))}
      </div>
    </>
  )
  return p.href ? (
    <a href={p.href} className="group rounded-2xl border border-white/10 bg-panel p-6 hover:border-signal/60 transition-colors">{body}</a>
  ) : (
    <div className="rounded-2xl border border-dashed border-white/10 p-6 opacity-70">{body}</div>
  )
}

export default function LabIndex() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <a href="/" className="font-display font-bold tracking-tight text-lg">
            Samuel Mota<span className="text-signal">.</span>
          </a>
          <span className="font-mono text-xs text-white/50">/lab</span>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-16 space-y-20">
        <h1 className="sr-only">Lab de Samuel Mota</h1>
        {SECTIONS.map(s => (
          <section key={s.title}>
            <p className="font-mono text-[11px] sm:text-xs text-signal uppercase tracking-[0.22em] mb-3">{s.kicker}</p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] max-w-3xl">{s.title}</h2>
            <p className="mt-4 text-white/60 max-w-2xl">{s.text}</p>
            <div className="mt-10 grid md:grid-cols-2 gap-5">
              {s.projects.map(p => <Card key={p.title} p={p} />)}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
