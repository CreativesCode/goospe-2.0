import Link from 'next/link'
import { ThemeToggle } from '@/shared/components/theme-toggle'

/** Panel de marca (solo tablet/web): degradado, isotipo de fondo y el claim. */
function BrandPanel() {
  return (
    <aside className="relative hidden flex-col overflow-hidden bg-goospe-gradient p-10 text-on-brand md:flex">
      <img
        src="/brand/isotipo-white.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-[10%] -right-[12%] w-[70%] opacity-[0.16]"
      />
      <Link href="/feed" className="relative self-start">
        <img src="/brand/logo-white-suggest.svg" alt="Goospe sugiere" className="h-10" />
      </Link>
      <div className="relative mt-auto">
        <p className="text-[clamp(40px,4.6vw,68px)] font-light leading-[0.98] tracking-[-0.035em]">
          ¿Dónde voy <span className="font-medium">hoy?</span>
        </p>
        <p className="mt-4 max-w-[380px] text-[17px] leading-[1.5]">
          Guarda lugares, confirma eventos y deja que Goospe aprenda lo que te gusta.
        </p>
      </div>
    </aside>
  )
}

// Pantalla dividida 1fr / 1fr desde tablet; en móvil queda solo la columna del formulario.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-surface md:grid-cols-2">
      <BrandPanel />
      <div className="flex min-w-0 flex-col px-5 pb-[calc(20px+var(--sab))] pt-[calc(20px+var(--sat))] md:p-10">
        <div className="flex items-center justify-between">
          <Link href="/feed" className="md:hidden">
            <img src="/brand/logo-color.svg" alt="Goospe" className="h-[26px] dark:hidden" />
            <img src="/brand/logo-white.svg" alt="Goospe" className="hidden h-[26px] dark:block" />
          </Link>
          <ThemeToggle className="ml-auto" />
        </div>
        <main className="my-auto w-full max-w-[400px] self-center py-8">{children}</main>
      </div>
    </div>
  )
}
