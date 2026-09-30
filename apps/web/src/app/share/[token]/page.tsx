import { SharePreview } from '@/components/share-preview'
import type { Metadata } from 'next'

// A share link is a temporary door, not a page for search. noindex is courtesy
// (spec §6) — revocation is the real guarantee — and it needs a server
// component: `export const metadata` is ignored in a 'use client' file.
export const metadata: Metadata = {
  title: 'Memória compartilhada — Chronicle',
  robots: { index: false, follow: false },
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SharePreview token={token} />
}
