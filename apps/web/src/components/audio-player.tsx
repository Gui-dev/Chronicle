'use client'

export function AudioPlayer() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-card bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-card" />
          <div>
            <p className="text-sm font-medium text-text">Nenhuma música selecionada</p>
            <p className="text-xs text-muted">Selecione uma memória para ouvir</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="text-muted transition-colors hover:text-text">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Play</title>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
