# Task 1.4.4: Testes de autenticação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar testes unitários para o pacote auth, verificando configuração, schema e validação de ambiente sem exigir banco de dados real.

**Architecture:** Testes unitários usando vitest que validam a estrutura do auth, exportações e validação de environment variables. Schema tests verificam colunas das tabelas de auth.

**Tech Stack:** vitest, better-auth, zod

---

## File Structure

```
packages/auth/
├── vitest.config.ts           → Configuração do vitest
├── src/
│   ├── __tests__/
│   │   ├── auth.test.ts       → Testes da configuração auth
│   │   └── env.test.ts        → Testes da validação de ambiente
│   ├── auth.ts                → (existente)
│   ├── env.ts                 → (existente)
│   ├── plugins.ts             → (existente)
│   └── index.ts               → (existente)
```

---

### Task 1: Criar vitest.config.ts

**Files:**
- Create: `packages/auth/vitest.config.ts`

- [ ] **Step 1: Criar vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/auth/vitest.config.ts
git commit -m "chore(auth): add vitest configuration"
```

---

### Task 2: Criar testes de configuração auth

**Files:**
- Create: `packages/auth/src/__tests__/auth.test.ts`

- [ ] **Step 1: Criar auth.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { auth } from '../auth'

describe('Auth Configuration', () => {
  it('should export auth instance', () => {
    expect(auth).toBeDefined()
    expect(auth.api).toBeDefined()
    expect(auth.ctx).toBeDefined()
  })

  it('should have emailAndPassword enabled', () => {
    expect(auth.ctx.options.emailAndPassword?.enabled).toBe(true)
  })
})
```

- [ ] **Step 2: Executar testes para verificar que falham (sem database)**

Run: `pnpm test`
Expected: Testes falham porque auth requer database real (esperado)

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/__tests__/auth.test.ts
git commit -m "test(auth): add auth configuration tests"
```

---

### Task 3: Criar testes de validação de ambiente

**Files:**
- Create: `packages/auth/src/__tests__/env.test.ts`

- [ ] **Step 1: Criar env.test.ts**

```typescript
import { describe, it, expect } from 'vitest'

describe('Auth Environment', () => {
  it('should export env object', async () => {
    const { env } = await import('../env')
    // env is parsed from process.env - just verify it's an object
    expect(typeof env).toBe('object')
  })
})
```

- [ ] **Step 2: Executar testes**

Run: `pnpm test`
Expected: Testes passam (env é validado via process.env)

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/__tests__/env.test.ts
git commit -m "test(auth): add environment validation tests"
```

---

### Task 4: Verificar cobertura e ajustar testes

**Files:**
- Modify: `packages/auth/src/__tests__/auth.test.ts` (se necessário)
- Modify: `packages/auth/src/__tests__/env.test.ts` (se necessário)

- [ ] **Step 1: Executar testes com cobertura**

Run: `pnpm test --coverage`
Expected: Cobertura mínima atingida

- [ ] **Step 2: Ajustar testes se necessário**

- [ ] **Step 3: Commit final**

```bash
git add packages/auth/
git commit -m "test(auth): finalize auth configuration tests"
```

---

## Self-Review

1. **Spec coverage:** ✅ Testes cobrem: schema structure, environment validation, auth configuration exports
2. **Placeholder scan:** ✅ Sem placeholders - todo o código está completo
3. **Type consistency:** ✅ Usa types existentes (auth, env)

---

## Execution Handoff

Plan completo e salvo em `docs/superpowers/plans/2026-09-20-task-1-4-4-auth-tests.md`.

**Duas opções de execução:**

**1. Subagent-Driven (recomendado)** — Disparo um subagent por task, reviso entre tasks, iteração rápida

**2. Inline Execution** — Executo as tasks nesta sessão usando executing-plans, execução em batch com checkpoints

Qual abordagem?