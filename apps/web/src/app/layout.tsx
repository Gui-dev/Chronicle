import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chronicle - Soundtrack da sua vida',
  description: 'Your life, your memories, your soundtrack',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-background text-text min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
