import Link from 'next/link'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Goospe — ¿dónde voy hoy? Lugares y eventos en Puerto Varas',
  description:
    'Descubre dónde ir en Puerto Varas: cafés, restaurantes, bares y eventos cerca de ti, con un conserje IA que decide por ti en 30 segundos.',
  alternates: { canonical: '/' },
}

export default async function Landing() {
  const sb = createAdminClient()
  const { count } = await sb.from('places').select('*', { count: 'exact', head: true }).eq('is_published', true)

  return (
    <main className="min-h-[100dvh] bg-goospe-gradient text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <img src="/brand/logo-white.svg" alt="Goospe" className="h-7" />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/eventos" className="text-white/80 hover:text-white">Eventos</Link>
          <Link href="/buscar" className="text-white/80 hover:text-white">Buscar</Link>
          <Link href="/login" className="rounded-full bg-white/15 px-4 py-1.5 font-medium backdrop-blur hover:bg-white/25">
            Entrar
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-16 pt-12 text-center sm:pt-20">
        <h1 className="text-4xl font-medium leading-tight sm:text-6xl">¿Dónde voy hoy?</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/85 sm:text-xl">
          Abre Goospe, dinos con quién estás y cuánto quieres gastar. Te decimos dónde ir en
          Puerto Varas — decidido en 30 segundos.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/feed" className="rounded-full bg-white px-8 py-3.5 text-lg font-medium text-goospe-green-dark shadow-lg transition hover:bg-white/90">
            Abrir Goospe
          </Link>
          <Link href="/concierge" className="rounded-full bg-white/15 px-8 py-3.5 text-lg font-medium backdrop-blur transition hover:bg-white/25">
            ✨ Decídeme
          </Link>
        </div>

        {typeof count === 'number' && (
          <p className="mt-6 text-sm text-white/70">{count} lugares de Puerto Varas ya en Goospe</p>
        )}
      </section>

      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-5 pb-20 sm:grid-cols-3">
        {[
          { icon: '📲', title: 'Feed de lugares', text: 'Scroll de cards cercanas tipo TikTok: foto, vibe, precio y distancia.' },
          { icon: '✨', title: 'Conserje IA', text: 'Escribe qué buscas y te damos 3 opciones con el porqué de cada una.' },
          { icon: '📅', title: 'Eventos de hoy', text: 'Qué pasa esta semana cerca de ti, con confirmación de un toque.' },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl bg-white/10 p-5 text-left backdrop-blur">
            <div className="text-2xl">{c.icon}</div>
            <h2 className="mt-2 font-medium">{c.title}</h2>
            <p className="mt-1 text-sm text-white/75">{c.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-white/15 px-5 py-6 text-center text-sm text-white/60">
        <div className="mx-auto max-w-5xl">
          Goospe · Puerto Varas, Chile ·{' '}
          <Link href="/panel" className="hover:text-white">¿Tienes un negocio?</Link>
        </div>
      </footer>
    </main>
  )
}
