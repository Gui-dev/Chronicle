# Task 3.5 — Criar Memória (Design)

## Objetivo

Criar formulário multi-passo (wizard) para criação de memórias com upload de fotos, busca de música (Spotify), geocoding com auto-preenchimento de clima, e adição de pessoas/tags.

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Layout do formulário | Wizard multi-passo (5 passos) |
| Framework de formulário | React Hook Form + Zod |
| Busca de música | Busca inline (debounced) |
| Upload de fotos | Drag & drop + preview |
| Clima | Auto-preenchimento ao selecionar localização |
| Pessoas/tags | Chips/Tags (Enter para adicionar, X para remover) |
| Abordagem de implementação | React Hook Form + componentes por step |

## Estrutura de Arquivos

```
apps/web/src/
├── app/(dashboard)/memories/new/
│   └── page.tsx                    → Página do wizard (client component)
├── components/
│   ├── create-memory-wizard.tsx    → Componente principal do wizard
│   ├── steps/
│   │   ├── step-basic-info.tsx     → Título, data, texto
│   │   ├── step-location.tsx       → Busca geocoding + clima auto
│   │   ├── step-music.tsx          → Busca Spotify inline
│   │   ├── step-photos.tsx         → Drag & drop + preview
│   │   └── step-people.tsx         → Chips para pessoas e tags
│   └── chip-input.tsx              → Componente reutilizável de chips
├── hooks/
│   ├── use-create-memory.ts        → Hook: mutation + upload fotos
│   ├── use-geocoding.ts            → Hook: busca localização (debounced)
│   ├── use-spotify-search.ts       → Hook: busca música (debounced)
│   └── use-weather.ts              → Hook: busca clima por coords
```

**Dependência nova:** `react-hook-form` + `@hookform/resolvers`

## Componentes

### `create-memory-wizard.tsx`

Componente client que orquestra o wizard:

- `useForm` com `zodResolver(createMemorySchema)` do `@chronicle/schemas`
- Estado: `currentStep` (0-4), `photos` (File[]), `isSubmitting`
- Renderiza step atual baseado em `currentStep`
- Botões: "Anterior" (se step > 0), "Próximo" / "Criar Memória" (step 4)
- Validação por step: apenas `title` e `memoryDate` são obrigatórios (step 0)
- No submit:
  1. `useCreateMemory.mutateAsync(data)` → cria memória
  2. Se há fotos, upload sequencial via `POST /api/memories/:id/photos`
  3. Redireciona para `/`

### Steps

| Step | Componente | Campos |
|------|-----------|--------|
| 0 | `step-basic-info.tsx` | título (obrigatório), data (obrigatório), texto |
| 1 | `step-location.tsx` | busca geocoding (debounce 300ms), seleciona resultado, auto-busca clima |
| 2 | `step-music.tsx` | busca Spotify (debounce 300ms), seleciona resultado |
| 3 | `step-photos.tsx` | drag & drop area, preview grid, remover imagem |
| 4 | `step-people.tsx` | chip-input para pessoas, chip-input para tags |

### `chip-input.tsx`

Componente reutilizável:
- Props: `label`, `placeholder`, `value: string[]`, `onChange: (value: string[]) => void`
- Input + lista de chips abaixo
- Digita + Enter → adiciona chip
- Chip com botão X para remover

## Hooks

### `use-create-memory.ts`

```ts
useMutation({
  mutationFn: (data: CreateMemoryInput) => api.post('/api/memories', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['memories'] })
  }
})
```

### `use-geocoding.ts`

```ts
useQuery({
  queryKey: ['geocoding', searchTerm],
  queryFn: () => api.get(`/api/geocoding?q=${searchTerm}`),
  enabled: searchTerm.length >= 2,
})
```

Debounce 300ms via `setTimeout` no handler de input.

### `use-spotify-search.ts`

```ts
useQuery({
  queryKey: ['spotify-search', searchTerm],
  queryFn: () => api.get(`/api/spotify/search?q=${searchTerm}`),
  enabled: searchTerm.length >= 2,
})
```

Debounce 300ms.

### `use-weather.ts`

```ts
useQuery({
  queryKey: ['weather', lat, lng],
  queryFn: () => api.get(`/api/weather?latitude=${lat}&longitude=${lng}`),
  enabled: !!lat && !!lng,
})
```

## Fluxo de Dados

```
Usuário preenche step 0
  → válido? → step 1
    → busca geocoding → seleciona local
      → auto-busca weather → preenche temp/desc/icon
        → step 2
          → busca spotify → seleciona música
            → step 3
              → arrasta fotos → File[]
                → step 4
                  → adiciona pessoas/tags
                    → submit
                      → POST /api/memories (body: CreateMemoryInput)
                        → POST /api/memories/:id/photos (cada foto)
                          → redirect /
```

## Padrões Existentes

- Segue padrão de hooks: `use-memories.ts`, `use-filters.ts`
- Usa `api.post()` de `api-client.ts`
- Usa `useQuery`/`useMutation` do Tanstack Query
- UI: componentes de `@chronicle/ui` (Button, Card, Input, Label)
- Nomes de arquivos: kebab-case
- Cores: primary `#f0c040`, background `#0a0a0f`, card `#1a1a2e`
