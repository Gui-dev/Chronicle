import { SearchResults } from '@/components/search-results'

interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  // `?q=a&q=b` reaches the page as an array. Every chip is built from one
  // string, so the page takes the first and the rest is dropped.
  const query = (Array.isArray(q) ? q[0] : q) ?? ''

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-text">Busca</h1>
      {query ? (
        <p className="mb-8 text-muted">
          Resultados para <span className="text-text">{query}</span>
        </p>
      ) : (
        <p className="mb-8 text-muted">
          Use a busca no topo da página: <code className="text-primary">#tag</code>,{' '}
          <code className="text-primary">@pessoa</code>,{' '}
          <code className="text-primary">ano:2026</code>,{' '}
          <code className="text-primary">mes:9</code>,{' '}
          <code className="text-primary">clima:sol</code>,{' '}
          <code className="text-primary">local:praia</code>.
        </p>
      )}

      <SearchResults query={query} />
    </div>
  )
}
