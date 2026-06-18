import Link from 'next/link'
import { ThemeToggle } from '@/shared/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-goospe-gradient p-5">
      <span className="dark absolute right-4 top-4">
        <ThemeToggle />
      </span>
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-xl ring-1 ring-line">
        <Link href="/feed" className="mb-6 flex justify-center">
          <img src="/brand/logo-color.svg" alt="Goospe" className="h-8 dark:hidden" />
          <img src="/brand/logo-white.svg" alt="Goospe" className="hidden h-8 dark:block" />
        </Link>
        {children}
      </div>
    </div>
  )
}
