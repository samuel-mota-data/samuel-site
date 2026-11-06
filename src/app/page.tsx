'use client'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import ArchitectureFlow from '@/components/ArchitectureFlow'
import { STATUS_COLOR, type TwinEvent, type UnitStatus } from '@/lib/twin'
import { content, stack, type Lang } from '@/lib/content'

const TwinBuilding = dynamic(() => import('@/components/TwinBuilding'), { ssr: false })

const CONTACT = {
  whatsapp: 'https://wa.me/5521969847330',
  email: 'samuel_.mota@hotmail.com',
  linkedin: 'https://www.linkedin.com/in/samuel--mota',
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] sm:text-xs text-signal uppercase tracking-[0.22em] mb-4">{children}</p>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">{children}</h2>
}

export default function Page() {
  const [lang, setLang] = useState<Lang>('pt')
  const [feed, setFeed] = useState<(TwinEvent & { at: string })[]>([])
  const [total, setTotal] = useState(1391)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lang')
      if (saved === 'pt' || saved === 'en') setLang(saved)
      else if (!navigator.language.toLowerCase().startsWith('pt')) setLang('en')
    } catch {}
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
    try { localStorage.setItem('lang', lang) } catch {}
  }, [lang])

  const onEvent = useCallback((e: TwinEvent) => {
    const at = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    setFeed(f => [{ ...e, at }, ...f].slice(0, 5))
    setTotal(t => t + Math.max(1, Math.round(e.liters / 20)))
  }, [])

  const t = content[lang]
  const statusLabel = Object.fromEntries(t.twin.legend) as Record<UnitStatus, string>

  return (
    <div className="min-h-screen bg-ink text-white overflow-x-clip">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-ink/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <a href="#topo" className="font-display font-bold tracking-tight text-lg">
            Samuel Mota<span className="text-signal">.</span>
          </a>
          <div className="hidden md:flex gap-7 text-sm text-white/55">
            <a href="#caso" className="hover:text-white transition-colors">{t.nav.case}</a>
            <a href="#twin" className="hover:text-white transition-colors">{t.nav.twin}</a>
            <a href="#experiencia" className="hover:text-white transition-colors">{t.nav.cv}</a>
            <a href="#competencias" className="hover:text-white transition-colors">{t.nav.skills}</a>
            <a href="#contato" className="hover:text-white transition-colors">{t.nav.contact}</a>
          </div>
          <div className="flex rounded-lg border border-white/10 p-0.5 font-mono text-xs" role="group" aria-label="Idioma / Language">
            {(['pt', 'en'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`px-2.5 py-1 rounded-md uppercase transition-colors ${lang === l ? 'bg-signal text-black' : 'text-white/50 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header id="topo" className="relative blueprint">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink pointer-events-none" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-28 sm:pt-32 pb-16 grid lg:grid-cols-[1.05fr_1fr] gap-6 lg:gap-4 items-center min-h-[92vh]">
          <div>
            <Kicker>{t.hero.kicker}</Kicker>
            <h1 className="font-display text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.2rem] font-bold tracking-tight mb-7">
              {t.hero.title[0]}<br />
              <span className="text-signal">{t.hero.title[1]}</span>
            </h1>
            <p className="text-lg text-white/60 leading-relaxed max-w-xl mb-8">{t.hero.lead}</p>

            <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-xs text-white/45 mb-10" aria-label="Trajetória">
              {t.hero.path.map((p, i) => (
                <li key={p} className="flex items-center gap-2">
                  <span className={i === t.hero.path.length - 1 ? 'text-signal' : ''}>{p}</span>
                  {i < t.hero.path.length - 1 && <span className="text-white/20" aria-hidden>→</span>}
                </li>
              ))}
            </ol>

            <div className="flex gap-3 flex-wrap">
              <a href="#caso" className="px-6 py-3 bg-signal text-black font-semibold rounded-lg hover:bg-signal/90 transition-colors">{t.hero.ctaCase}</a>
              <a href="#contato" className="px-6 py-3 border border-white/15 text-white/80 rounded-lg hover:border-white/35 hover:text-white transition-colors">{t.hero.ctaContact}</a>
            </div>
          </div>

          {/* Digital twin (recriação) */}
          <div className="relative h-[360px] sm:h-[460px] lg:h-[540px] -mx-4 sm:mx-0">
            <TwinBuilding onEvent={onEvent} className="absolute inset-0" />

            <div className="absolute top-3 left-4 sm:left-2 font-mono text-[11px] text-white/55 flex items-center gap-2 pointer-events-none">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              {t.hero.hudTitle} · 42 {t.hero.hudUnits}
            </div>
            <span className="absolute top-3 right-4 sm:right-2 font-mono text-[10px] uppercase tracking-widest text-white/35 border border-white/10 rounded px-1.5 py-0.5 pointer-events-none">
              {t.hero.hudSim}
            </span>

            <ul className="absolute bottom-2 left-4 sm:left-2 font-mono text-[11px] leading-5 pointer-events-none min-h-[100px]" aria-hidden>
              {feed.map((e, i) => (
                <li key={`${e.at}-${e.unit}-${i}`} className="flex gap-2" style={{ opacity: 1 - i * 0.18 }}>
                  <span className="text-white/30">{e.at}</span>
                  <span className="text-white/70 w-12">{e.unit}</span>
                  <span style={{ color: STATUS_COLOR[e.status] }}>{e.status === 'off' ? '—' : `${e.liters} L`}</span>
                </li>
              ))}
            </ul>
            <span className="absolute bottom-3 right-4 sm:right-2 font-mono text-[10px] text-white/30 pointer-events-none">{t.hero.hudHint}</span>
          </div>
        </div>
      </header>

      {/* Resumo */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-24">
        <div className="grid md:grid-cols-[auto_1fr] gap-8 items-center rounded-2xl border border-white/8 bg-white/[0.02] p-6 sm:p-8">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image src="/samuel.png" alt="Samuel Mota" width={112} height={112} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/35 mb-2">{t.summary.title}</p>
            <p className="text-lg sm:text-xl text-white/75 leading-relaxed">{t.summary.text}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          {t.summary.facts.map(([num, label]) => (
            <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
              <p className="font-display text-3xl sm:text-4xl font-bold text-signal mb-1">{num}</p>
              <p className="text-sm text-white/50 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Caso principal */}
      <section id="caso" className="max-w-6xl mx-auto px-4 sm:px-8 pb-28 scroll-mt-20">
        <Kicker>{t.case.kicker}</Kicker>
        <SectionTitle>{t.case.title}</SectionTitle>
        <p className="text-lg sm:text-xl text-white/60 leading-relaxed max-w-3xl mt-6">{t.case.lead}</p>
        <p className="mt-5 inline-flex items-start gap-2 text-xs text-white/40 border border-white/8 rounded-lg px-3 py-2 max-w-3xl">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px shrink-0" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          {t.case.confidential}
        </p>

        {/* O que eu fiz */}
        <h3 className="font-display text-2xl font-semibold mt-16 mb-6">{t.case.roleTitle}</h3>
        <div className="grid md:grid-cols-2 gap-px bg-white/8 rounded-2xl overflow-hidden border border-white/8">
          {t.case.role.map(([title, text], i) => (
            <div key={title} className="bg-ink p-6 sm:p-7 flex gap-5">
              <span className="font-mono text-xs text-signal/80 pt-1 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="font-semibold mb-1.5">{title}</p>
                <p className="text-sm text-white/50 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Arquitetura */}
        <div className="mt-16 rounded-2xl border border-white/8 bg-white/[0.02] p-5 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
            <h3 className="font-display text-2xl font-semibold">{t.case.archTitle}</h3>
            <p className="hidden md:block font-mono text-xs text-white/35">{t.case.archLead}</p>
          </div>
          <ArchitectureFlow {...t.case.arch} />
        </div>

        {/* Decisões */}
        <h3 className="font-display text-2xl font-semibold mt-16 mb-6">{t.case.decisionsTitle}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {t.case.decisions.map(([title, text]) => (
            <div key={title} className="rounded-xl border border-white/8 bg-white/[0.02] p-6 hover:border-white/20 transition-colors">
              <p className="font-semibold mb-2">{title}</p>
              <p className="text-sm text-white/50 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Casos de uso */}
        <h3 className="font-display text-2xl font-semibold mt-16 mb-6">{t.case.usesTitle}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {t.case.uses.map(([name, text]) => (
            <div key={name} className="rounded-xl border border-white/8 p-5">
              <p className="font-display font-semibold text-lg mb-1">{name}</p>
              <p className="text-sm text-white/45 leading-snug">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/35 mr-2">{t.case.stackTitle}</span>
          {stack.map(s => (
            <span key={s} className="font-mono text-xs px-2.5 py-1 rounded-md bg-white/5 text-white/55">{s}</span>
          ))}
        </div>
      </section>

      {/* Digital twin */}
      <section id="twin" className="max-w-6xl mx-auto px-4 sm:px-8 pb-28 scroll-mt-20">
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-start">
          <div>
            <Kicker>{t.twin.kicker}</Kicker>
            <SectionTitle>{t.twin.title}</SectionTitle>
            <p className="text-lg text-white/60 leading-relaxed mt-6 max-w-2xl">{t.twin.text}</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-6">
              {t.twin.legend.map(([k, label]) => (
                <li key={k} className="flex items-center gap-2 text-sm text-white/55">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[k as UnitStatus] }} aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Cartão de unidade (recriação), reage ao feed do 3D */}
          <div className="rounded-2xl border border-white/10 bg-panel p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-display font-semibold">{feed[0]?.unit ? `${lang === 'pt' ? 'Unidade' : 'Unit'} ${feed[0].unit}` : lang === 'pt' ? 'Unidade B-302' : 'Unit B-302'}</p>
                <p className="font-mono text-[11px] text-white/35">pulse meter · ch 2</p>
              </div>
              {(() => {
                const s: UnitStatus = feed[0]?.status ?? 'ok'
                return (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: STATUS_COLOR[s], background: `${STATUS_COLOR[s]}1a` }}>
                    {statusLabel[s]}
                  </span>
                )
              })()}
            </div>
            <div className="mx-auto w-44 h-44 rounded-full border border-white/10 bg-ink flex flex-col items-center justify-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">{lang === 'pt' ? 'acumulado' : 'total'}</p>
              <p className="font-mono text-xl tabular-nums tracking-wider">
                {String(total).padStart(8, '0').split('').map((d, i) => (
                  <span key={i} className={`inline-block px-[3px] py-0.5 mx-px rounded-sm ${i >= 5 ? 'bg-red-500/80' : 'bg-white/10'}`}>{d}</span>
                ))}
              </p>
              <p className="font-mono text-[10px] text-white/30 mt-2">{lang === 'pt' ? 'litros' : 'liters'}</p>
            </div>
            <p className="text-center font-mono text-[10px] text-white/25 mt-4">{t.hero.hudSim}</p>
          </div>
        </div>

        <h3 className="font-display text-2xl font-semibold mt-14 mb-6">{t.twin.pointsTitle}</h3>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {t.twin.points.map(([title, text], i) => (
            <li key={title} className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
              <p className="font-mono text-xs text-signal/80 mb-3 tabular-nums">{String(i + 1).padStart(2, '0')}</p>
              <p className="font-semibold mb-1.5">{title}</p>
              <p className="text-sm text-white/50 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Experiência */}
      <section id="experiencia" className="max-w-6xl mx-auto px-4 sm:px-8 pb-28 scroll-mt-20">
        <SectionTitle>{t.cv.title}</SectionTitle>
        <ol className="mt-10 relative border-l border-white/10 ml-1.5">
          {t.cv.jobs.map((j, i) => (
            <li key={j.org} className="pl-7 sm:pl-10 pb-12 last:pb-0 relative">
              <span className={`absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${i === 0 ? 'bg-signal border-signal' : 'bg-ink border-white/30'}`} aria-hidden />
              <div className="grid md:grid-cols-[220px_1fr] gap-2 md:gap-10">
                <div>
                  <p className="font-mono text-xs text-white/40 tabular-nums">{j.period}</p>
                  <p className="font-display text-xl font-semibold mt-1">{j.org}</p>
                </div>
                <div>
                  <p className="text-signal/90 font-medium mb-3">{j.role}</p>
                  <ul className="flex flex-col gap-2">
                    {j.bullets.map(b => (
                      <li key={b} className="text-white/60 leading-relaxed flex gap-3">
                        <span className="text-white/25 select-none" aria-hidden>—</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Competências */}
      <section id="competencias" className="max-w-6xl mx-auto px-4 sm:px-8 pb-28 scroll-mt-20">
        <SectionTitle>{t.skills.title}</SectionTitle>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {t.skills.groups.map(([group, items], i) => (
            <div key={group} className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
              <div className="flex items-baseline justify-between mb-4">
                <p className="font-display font-semibold text-lg">{group}</p>
                <span className="font-mono text-[11px] text-white/25 tabular-nums">L{i + 1}</span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {items.map(s => (
                  <li key={s} className="font-mono text-xs px-2.5 py-1 rounded-md bg-white/5 text-white/60">{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-3 grid md:grid-cols-[2fr_1fr] gap-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <p className="font-display font-semibold text-lg mb-4">{t.education.title}</p>
            <ul className="flex flex-col gap-2 text-white/60">
              {t.education.items.map(e => <li key={e}>{e}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <p className="font-display font-semibold text-lg mb-4">{t.education.langTitle}</p>
            <ul className="flex flex-col gap-2 text-white/60">
              {t.education.langs.map(e => <li key={e}>{e}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="relative blueprint scroll-mt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink pointer-events-none" aria-hidden />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-8 py-28 text-center">
          <SectionTitle>{t.contact.title}<span className="text-signal">.</span></SectionTitle>
          <p className="text-lg text-white/55 mt-6 mb-10">{t.contact.text}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-signal text-black font-semibold rounded-lg hover:bg-signal/90 transition-colors">LinkedIn</a>
            <a href={`mailto:${CONTACT.email}`} className="px-6 py-3 border border-white/15 text-white/80 rounded-lg hover:border-white/35 hover:text-white transition-colors">E-mail</a>
            <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className="px-6 py-3 border border-white/15 text-white/80 rounded-lg hover:border-white/35 hover:text-white transition-colors">WhatsApp</a>
          </div>
          <p className="font-mono text-xs text-white/35 mt-8">{CONTACT.email}</p>
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row gap-2 sm:items-center justify-between text-xs text-white/30">
          <span>© 2026 Samuel Mota</span>
          <span>{t.footer}</span>
        </div>
      </footer>
    </div>
  )
}
