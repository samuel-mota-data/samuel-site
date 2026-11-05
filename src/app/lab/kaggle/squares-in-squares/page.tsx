import type { Metadata } from 'next'
import SquaresSim from '@/components/lab/squares/SquaresSim'
import ScorePanels, { type Summary } from '@/components/lab/squares/ScorePanels'
import summary from '@/lib/kaggle/squares-summary.json'

export const metadata: Metadata = {
  title: 'Squares in Squares · Lab · Samuel Mota',
  description:
    'Empacotar n quadrados unitários no menor quadrado possível, n = 1 a 1000: compressão física, validação exata e registro de experimentos.',
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] sm:text-xs text-signal uppercase tracking-[0.22em] mb-3">{children}</p>
}

export default function Page() {
  const s = summary as Summary
  return (
    <div className="min-h-screen bg-ink text-white overflow-x-clip">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-ink/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          <a href="/" className="font-display font-bold tracking-tight text-lg">
            Samuel Mota<span className="text-signal">.</span>
          </a>
          <a href="/lab" className="font-mono text-xs text-white/50 hover:text-signal transition-colors">← /lab · squares</a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-16">
        <header className="max-w-3xl">
          <Kicker>Lab · Desafios de otimização · Kaggle</Kicker>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">Squares in Squares</h1>
          <p className="mt-4 text-white/60 text-base sm:text-lg">
            Empacotar n quadrados de lado 1 no menor quadrado possível, para cada n de 1 a 1000. Para a maioria dos n a melhor solução
            ainda é desconhecida pela matemática.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 font-mono text-xs">
            <a href="https://www.kaggle.com/competitions/squares-in-squares" target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-white/15 text-white/80 hover:border-signal hover:text-signal transition-colors">
              Competição no Kaggle ↗
            </a>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-4">
          {[
            ['Regra', 'Nenhum par de quadrados pode se invadir. Encostar pode. Cada quadrado tem centro (x, y) e ângulo livres.'],
            ['Medida', 'L é o lado da caixa que envolve todos os cantos. Score de cada puzzle: L / √n − 1. O total soma os 1000.'],
            ['Piso', 'A grade simples (L = ⌈√n⌉) vale cerca de 28,94 pontos. Tudo que se ganha vem de suavizar os degraus da grade.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-white/10 bg-panel p-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-signal">{t}</p>
              <p className="mt-2 text-sm text-white/70">{d}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <div className="max-w-3xl">
            <Kicker>Técnica · compressão física</Kicker>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">Apertar e sacudir</h2>
            <p className="mt-3 text-white/60">
              Os quadrados começam soltos. As paredes fecham devagar e recuam quando a pressão sobe. Quando a caixa para de encolher, uma
              sacudida desfaz o entalamento, como bater o pote de arroz na mesa. Um teste exato do eixo separador julga cada quadro: os
              quadrados ficam vermelhos se houver qualquer invasão.
            </p>
          </div>
          <SquaresSim />
          <p className="text-xs text-white/45 max-w-3xl">
            Os corpos físicos são 1,2% maiores que os quadrados reais, uma margem contra a pequena interpenetração tolerada por motores
            de física. Por isso a compressão não encosta perfeitamente e fica um pouco acima dos recordes, mas mostra onde a grade
            entala e onde há espaço a ganhar.
          </p>
        </section>

        <section className="space-y-4">
          <div className="max-w-3xl">
            <Kicker>Registro de experimentos</Kicker>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">Cada tentativa vira dado</h2>
            <p className="mt-3 text-white/60">
              O motor de otimização roda fora do site. Toda solução passa por um validador com as mesmas regras da métrica oficial,
              incluindo certificação com aritmética intervalar de alta precisão, e entra num log com técnica, parâmetros, L, score e
              tempo. Esta página mostra só o agregado.
            </p>
          </div>
          <ScorePanels s={s} />
          <p className="text-xs text-white/45 max-w-3xl">
            As coordenadas das soluções ficam privadas até o fim da competição (18/07/2027), conforme as regras de compartilhamento
            do Kaggle.
          </p>
        </section>
      </main>
    </div>
  )
}
