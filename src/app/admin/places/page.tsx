import Link from 'next/link'
import { Plus, Star, Bookmark, Image as ImageIcon, Search, BadgeCheck } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PublishToggle } from '@/features/admin/PublishToggle'

export const dynamic = 'force-dynamic'

const PRICE = ['', '$', '$$', '$$$', '$$$$']

type Row = {
  id: string; name: string; slug: string; is_published: boolean | null; claimed: boolean | null
  business_id: string | null; price_level: number | null; source: string
  place_categories: { categories: { name: string } | null }[] | null
  place_stats: { rating: number | null; saves_count: number | null; reviews_count: number | null } | null
  place_photos: { count: number }[] | null
}

export default async function AdminLugaresPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; cat?: string; page?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const estado = sp.estado ?? 'all'
  const cat = sp.cat ?? 'all'
  const admin = createAdminClient()

  const [{ data: cats }, places] = await Promise.all([
    admin.from('categories').select('id, slug, name').order('name'),
    (async () => {
      let query = admin
        .from('places')
        .select('id, name, slug, is_published, claimed, business_id, price_level, source, place_categories(categories(name)), place_stats(rating, saves_count, reviews_count), place_photos(count)')
        .order('name')
      if (q) query = query.ilike('name', `%${q}%`)
      if (estado === 'pub') query = query.eq('is_published', true)
      if (estado === 'hidden') query = query.eq('is_published', false)
      if (estado === 'claimed') query = query.eq('claimed', true)
      const { data } = await query.limit(500)
      return (data ?? []) as unknown as Row[]
    })(),
  ])

  const categories = (cats ?? []) as { id: number; slug: string; name: string }[]

  // filtro por categoría en memoria (PostgREST no filtra fácil sobre la tabla join anidada)
  const catName = cat === 'all' ? null : categories.find((c) => c.slug === cat)?.name ?? null
  const rows = catName
    ? places.filter((p) => (p.place_categories ?? []).some((pc) => pc.categories?.name === catName))
    : places

  // paginación
  const PAGE = 50
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1))
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE)

  // dueños de los lugares reclamados (solo de la página visible)
  const bizIds = [...new Set(pageRows.map((r) => r.business_id).filter(Boolean))] as string[]
  let ownerByBiz: Record<string, string> = {}
  if (bizIds.length) {
    const { data: members } = await admin
      .from('business_members')
      .select('business_id, profiles(display_name)')
      .in('business_id', bizIds)
      .eq('role', 'owner')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownerByBiz = Object.fromEntries(((members ?? []) as any[]).map((m) => [m.business_id, m.profiles?.display_name || 'Dueño']))
  }

  const filterLink = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ ...(q ? { q } : {}), estado, cat, ...patch })
    for (const [k, v] of [...next.entries()]) if (v === 'all' || v === '') next.delete(k)
    const s = next.toString()
    return `/admin/places${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-fg">Lugares</h1>
          <p className="text-sm text-fg-soft">{rows.length} {rows.length === 1 ? 'lugar' : 'lugares'} · crea y edita cualquier ficha.</p>
        </div>
        <Link href="/admin/places/new" className="inline-flex items-center gap-1.5 rounded-full bg-goospe-gradient px-4 py-2 text-sm font-medium text-white shadow">
          <Plus size={16} /> Nuevo lugar
        </Link>
      </header>

      {/* buscador + filtros */}
      <div className="space-y-3">
        <form className="relative max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre…"
            className="w-full rounded-full border border-line bg-card py-2 pl-9 pr-3 text-sm text-fg outline-none focus:border-goospe-green focus:ring-2 focus:ring-goospe-green/30" />
          {estado !== 'all' && <input type="hidden" name="estado" value={estado} />}
          {cat !== 'all' && <input type="hidden" name="cat" value={cat} />}
        </form>
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'Todos'], ['pub', 'Publicados'], ['hidden', 'Ocultos'], ['claimed', 'Reclamados']].map(([k, label]) => (
            <Link key={k} href={filterLink({ estado: k })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${estado === k ? 'bg-goospe-green/10 text-goospe-green-dark' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}>
              {label}
            </Link>
          ))}
          <span className="mx-1 w-px self-stretch bg-line" />
          <Link href={filterLink({ cat: 'all' })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${cat === 'all' ? 'bg-goospe-green/10 text-goospe-green-dark' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}>
            Toda categoría
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={filterLink({ cat: c.slug })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${cat === c.slug ? 'bg-goospe-green/10 text-goospe-green-dark' : 'border border-line bg-card text-fg-soft hover:text-fg'}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* tabla */}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card py-16 text-center text-sm text-muted">Sin resultados con estos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Lugar</th>
                <th className="px-3 py-3 font-medium">Categorías</th>
                <th className="px-3 py-3 text-center font-medium">Estado</th>
                <th className="px-3 py-3 text-right font-medium"><ImageIcon size={13} className="inline" /></th>
                <th className="px-3 py-3 text-right font-medium"><Star size={13} className="inline" /></th>
                <th className="px-3 py-3 text-right font-medium"><Bookmark size={13} className="inline" /></th>
                <th className="px-3 py-3 font-medium">Dueño</th>
                <th className="px-4 py-3 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => {
                const cnames = (p.place_categories ?? []).map((pc) => pc.categories?.name).filter(Boolean)
                const photos = p.place_photos?.[0]?.count ?? 0
                const st = p.place_stats
                return (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/places/${p.id}`} className="font-medium text-fg hover:text-goospe-green">{p.name}</Link>
                      {p.price_level ? <span className="ml-2 text-xs text-muted">{PRICE[p.price_level]}</span> : null}
                    </td>
                    <td className="px-3 py-3 text-fg-soft">{cnames.join(', ') || '—'}</td>
                    <td className="px-3 py-3 text-center"><PublishToggle id={p.id} published={!!p.is_published} /></td>
                    <td className="px-3 py-3 text-right tabular-nums text-fg-soft">{photos}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-fg-soft">{st?.rating ? Number(st.rating).toFixed(1) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-fg-soft">{st?.saves_count ?? 0}</td>
                    <td className="px-3 py-3 text-fg-soft">
                      {p.claimed && p.business_id ? (
                        <span className="inline-flex items-center gap-1 text-goospe-green-dark"><BadgeCheck size={13} /> {ownerByBiz[p.business_id] ?? 'Dueño'}</span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/places/${p.id}`} className="text-xs font-medium text-goospe-green hover:underline">Editar</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Página {page} de {pages}</span>
          <div className="flex items-center gap-2">
            {page > 1
              ? <Link href={filterLink({ page: String(page - 1) })} className="rounded-full border border-line bg-card px-3 py-1 font-medium text-fg-soft transition hover:text-fg">Anterior</Link>
              : <span className="rounded-full border border-line px-3 py-1 text-muted opacity-50">Anterior</span>}
            {page < pages
              ? <Link href={filterLink({ page: String(page + 1) })} className="rounded-full border border-line bg-card px-3 py-1 font-medium text-fg-soft transition hover:text-fg">Siguiente</Link>
              : <span className="rounded-full border border-line px-3 py-1 text-muted opacity-50">Siguiente</span>}
          </div>
        </div>
      )}
    </div>
  )
}
