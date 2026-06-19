import Link from 'next/link'
import type { Metadata } from 'next'
import { Smartphone, Sparkles, Calendar, Compass } from 'lucide-react'
import { ThemeToggle } from '@/shared/components/theme-toggle'
import { createAdminClient } from '@/lib/supabase/admin'

// ISR: la landing solo muestra un conteo de lugares; se regenera cada hora.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Goospe — ¿dónde voy hoy? Lugares y eventos en Puerto Varas',
  description:
    'Descubre dónde ir en Puerto Varas: cafés, restaurantes, bares y eventos cerca de ti, con un conserje IA que decide por ti en 30 segundos.',
  alternates: { canonical: '/' },
}

const STEPS = [
  { n: 1, title: 'Dinos el plan', text: 'Con quién sales, qué presupuesto y qué ambiente buscas. Tres toques.' },
  { n: 2, title: 'Goospe elige', text: 'El conserje IA combina tu gusto, la hora y la cercanía para decidir contigo.' },
  { n: 3, title: 'Anda', text: 'Guarda, pide cómo llegar o confirma tu asistencia. Sin scroll infinito.' },
]

const CONCIERGE_PICKS = [
  { n: 1, name: 'Bar La Cervecería', why: 'Tranquilo y con mesas para grupo, sin disparar la cuenta.' },
  { n: 2, name: 'Patio Cervecero', why: 'Al aire libre y relajado, perfecto para conversar.' },
  { n: 3, name: 'Café del Lago', why: 'Si prefieren sin alcohol: terraza y rica repostería.' },
]

export default async function Landing() {
  const sb = createAdminClient()
  const { count } = await sb.from('places').select('*', { count: 'exact', head: true }).eq('is_published', true)

  return (
    <main className="min-h-[100dvh] bg-surface">
      {/* ===== Hero (gradiente, constante en ambos temas) ===== */}
      <div className="bg-goospe-gradient text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pb-5 pt-[calc(1.25rem+var(--sat))] lg:px-8">
          <img src="/brand/logo-white.svg" alt="Goospe" className="h-7" />
          <nav className="flex items-center gap-3 text-sm sm:gap-5">
            <Link href="/eventos" className="hidden text-white/85 hover:text-white sm:inline">Eventos</Link>
            <Link href="/buscar" className="hidden text-white/85 hover:text-white sm:inline">Buscar</Link>
            <span className="dark"><ThemeToggle /></span>
            <Link href="/login" className="rounded-full border border-white/25 bg-white/15 px-4 py-1.5 font-medium backdrop-blur hover:bg-white/25">
              Entrar
            </Link>
          </nav>
        </header>

        <section className="mx-auto max-w-3xl px-5 pb-14 pt-12 text-center sm:pt-20 lg:pt-24">
          <h1 className="text-4xl font-light leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            ¿Dónde voy <span className="font-medium">hoy?</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/90 sm:text-xl">
            Dinos con quién estás y cuánto quieres gastar. Te decimos dónde ir en
            Puerto Varas — decidido en 30 segundos.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/feed" className="rounded-full bg-white px-8 py-3.5 text-lg font-medium text-goospe-green-dark shadow-lg transition hover:bg-white/90">
              Abrir Goospe
            </Link>
            <Link href="/concierge" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-8 py-3.5 text-lg font-medium backdrop-blur transition hover:bg-white/25">
              <Sparkles size={20} strokeWidth={1.75} /> Decídeme
            </Link>
          </div>

          {typeof count === 'number' && (
            <p className="mt-6 text-sm text-white/80">{count} lugares de Puerto Varas ya en Goospe</p>
          )}
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-5 pb-16 sm:grid-cols-3 lg:px-8">
          {[
            { icon: Smartphone, title: 'Feed de lugares', text: 'Cards cercanas con foto, vibe, precio y distancia.' },
            { icon: Sparkles, title: 'Conserje IA', text: 'Escribe qué buscas y te damos 3 opciones con su porqué.' },
            { icon: Calendar, title: 'Eventos de hoy', text: 'Qué pasa esta semana cerca, con RSVP de un toque.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/20 bg-white/10 p-6 text-left backdrop-blur">
              <Icon size={26} strokeWidth={1.75} />
              <h2 className="mt-3 font-medium">{title}</h2>
              <p className="mt-1.5 text-sm text-white/80">{text}</p>
            </div>
          ))}
        </section>
      </div>

      {/* ===== Cómo funciona (papel) ===== */}
      <section className="px-5 py-20 text-center lg:py-24">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-goospe-green">Cómo funciona</div>
        <h2 className="mt-3 text-3xl font-light tracking-tight text-fg sm:text-4xl">
          Decidir es de <span className="font-medium">un toque</span>
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-3xl border border-line bg-card p-7 text-left">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-goospe-green/10 text-lg font-medium text-goospe-green-dark">
                {s.n}
              </div>
              <h3 className="mt-5 text-lg font-medium text-fg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-soft">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Conserje highlight ===== */}
      <section className="border-y border-line bg-card/40 px-5 py-20 lg:py-24">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-goospe-green">El conserje</div>
            <h2 className="mt-3 text-3xl font-light leading-tight tracking-tight text-fg sm:text-4xl">
              Decide por mí, <span className="font-medium">en serio</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-fg-soft sm:text-lg">
              Escribe en lenguaje natural —“algo chill y barato para 3 cerca del centro”— y te damos
              tres opciones con el porqué de cada una. Compartible: la app que te mandó al lugar perfecto.
            </p>
            <Link
              href="/concierge"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-goospe-gradient px-6 py-3 font-medium text-white shadow-lg transition hover:opacity-95"
            >
              <Sparkles size={18} strokeWidth={1.75} /> Probar Decídeme
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {CONCIERGE_PICKS.map((p) => (
              <div key={p.n} className="flex gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-goospe-gradient text-lg font-medium text-white/90">
                  {p.n}
                </span>
                <div>
                  <div className="font-medium text-fg">{p.name}</div>
                  <p className="mt-0.5 text-sm leading-snug text-fg-soft">{p.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Cierre B2B + footer ===== */}
      <section className="px-5 py-16 text-center">
        <Compass size={28} strokeWidth={1.5} className="mx-auto text-goospe-green" />
        <h2 className="mt-4 text-2xl font-light tracking-tight text-fg sm:text-3xl">
          ¿Tienes un negocio en Puerto Varas?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-fg-soft">
          Reclama tu ficha, sube tu carta y destácate en el feed. Gratis durante el piloto.
        </p>
        <Link
          href="/panel"
          className="mt-6 inline-flex rounded-full border border-goospe-green/40 px-6 py-3 font-medium text-goospe-green-dark transition hover:bg-goospe-green/10"
        >
          Ir al panel de negocio
        </Link>
      </section>

      <footer className="border-t border-line px-5 py-6 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <span>Goospe · Puerto Varas, Chile</span>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/terminos" className="transition hover:text-fg">Términos</Link>
            <Link href="/privacidad" className="transition hover:text-fg">Privacidad</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
