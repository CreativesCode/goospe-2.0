import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-goospe-gradient p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Link href="/feed" className="mb-6 flex justify-center">
          <img src="/brand/logo-color.svg" alt="Goospe" className="h-8" />
        </Link>
        {children}
      </div>
    </div>
  )
}
