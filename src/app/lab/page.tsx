import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lab · Samuel Mota',
  description: 'Gêmeos digitais de refrigeração: falhas injetadas, assinatura elétrica, diagnóstico e prognóstico com sensor mínimo.',
}

const PROJECTS = [
  {
    href: '/lab/split',
    status: 'ativo',
    title: 'Split 18.000 BTU',
    text: 'Gêmeo digital calibrado com medições reais. Falhas de condensador, filtro, capacitor e vazamento vistas só pela energia.',
    tags: ['R410A', 'motor PSC', 'dataset UFPB', '3D'],
  },
  {
    href: null,
    status: 'em pesquisa',
    title: 'Câmara fria',
    text: 'Microvazamento, degelo, porta aberta e proteção do compressor, com o mínimo de sensores.',
    tags: ['prognóstico', 'compressor', 'sensor mínimo'],
  },
]

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
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <p className="font-mono text-[11px] sm:text-xs text-signal uppercase tracking-[0.22em] mb-3">Lab · Manutenção preditiva</p>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] max-w-3xl">
          Gêmeos digitais de refrigeração
        </h1>
        <p className="mt-4 text-white/60 max-w-2xl">
          Falhas físicas simuladas e injetadas, validadas contra dados reais publicados, e identificadas pela assinatura elétrica.
        </p>
        <div className="mt-10 grid md:grid-cols-2 gap-5">
          {PROJECTS.map(p => {
            const body = (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className={`font-mono text-[11px] uppercase tracking-widest ${p.href ? 'text-signal' : 'text-white/40'}`}>{p.status}</span>
                  {p.href && <span className="font-mono text-xs text-white/50 group-hover:text-signal transition-colors">abrir →</span>}
                </div>
                <h2 className="font-display text-2xl font-bold">{p.title}</h2>
                <p className="mt-2 text-sm text-white/60">{p.text}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {p.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded border border-white/10 font-mono text-[11px] text-white/55">{t}</span>
                  ))}
                </div>
              </>
            )
            return p.href ? (
              <a key={p.title} href={p.href} className="group rounded-2xl border border-white/10 bg-panel p-6 hover:border-signal/60 transition-colors">{body}</a>
            ) : (
              <div key={p.title} className="rounded-2xl border border-dashed border-white/10 p-6 opacity-70">{body}</div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
