-- Chronicle 7.0 — evidência manual de índice e de equivalência de conjunto.
--
-- Não é um teste automatizado: nenhum harness do repo roda `memoriesService` contra Postgres
-- real. Este arquivo existe para a conferência ser reproduzível em vez de ser uma afirmação.
-- Rodar com o dev DB: `PGPASSWORD=chronicle psql -h localhost -U chronicle -d chronicle -f <este arquivo>`
--
-- Tudo acontece dentro de transação e termina em ROLLBACK: o dev DB fica como estava.
-- Confinado ao dev DB; `pnpm db:push` continua proibido sem pedido explícito.

BEGIN;

-- =====================================================================
-- PARTE 1 — Os índices são usados?
-- =====================================================================
-- 60k memórias em 50 usuários, espalhadas por ~6,8 anos (60k horas) para que
-- a consulta de intervalo de ano tenha dado em 2026 — com minutos seriam só 41 dias
-- e a sonda 1E não provaria nada. A proporção de público importa e é o
-- resultado principal: ver nota no fim.

INSERT INTO users (id, name, email)
SELECT 'u' || n, 'Usuario ' || n, 'u' || n || '@local.invalid' FROM generate_series(1, 50) n;

-- 2% público: a razão realista de um app de memórias. `g % 50 = 0` => 1200 de 60000.
-- Só 1% do `content` contém o termo do trigram, senão o índice não tem o que provar.
INSERT INTO memories (user_id, title, content, memory_date, weather_desc, location_name, is_public)
SELECT 'u' || (1 + (g % 50)),
       'Memory ' || g,
       CASE WHEN g % 100 = 0 THEN 'uma viagem inesquecivel a praia' ELSE 'rotina comum do dia ' || g END,
       TIMESTAMP '2023-01-01' + (g || ' hours')::interval,
       CASE WHEN g % 3 = 0 THEN 'Ensolarado' ELSE 'Nublado' END,
       CASE WHEN g % 100 = 0 THEN 'Porto de Sao Joao' ELSE 'Casa' END,
       (g % 50 = 0)
FROM generate_series(1, 60000) g;

ANALYZE memories;

\echo ''
\echo '=== 1A) FEED LOGADO: is_public = true OR user_id = $1  (a consulta mais importante) ==='
\echo '--- Esperado: BitmapOr com os DOIS bracos em Bitmap Index Scan. ---'
\echo '--- Um índice parcial em (memory_date DESC) WHERE is_public não conseguiria isto: ---'
\echo '--- o Postgres não prova que um OR implica is_public = true, e o ignoraria. ---'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories
WHERE is_public = true OR user_id = 'u1'
ORDER BY memory_date DESC LIMIT 20;

\echo ''
\echo '=== 1B) Braço só is_public = true ==='
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories WHERE is_public = true ORDER BY memory_date DESC LIMIT 20;

\echo ''
\echo '=== 1C) Braço só user_id = $1 ==='
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories WHERE user_id = 'u1' ORDER BY memory_date DESC LIMIT 20;

\echo ''
\echo '=== 1D) Trigram: content ILIKE %viagem%  (~1% das linhas) ==='
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories WHERE content ILIKE '%viagem%';

\echo ''
\echo '=== 1E) Filtro de ano/mês, nos TRÊS formatos que o serviço realmente emite ==='
\echo '--- findAll sempre começa com user_id OU is_public (memories.service.ts:166-185), ---'
\echo '--- então a data NUNCA aparece sozinha. Isto é o que prova o ponto: ---'
\echo '--- memory_date é coluna não-liderante e os dois btree a atendem assim mesmo. ---'
-- Caso 1: feed anônimo + ano -> is_public = true AND range
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories
WHERE is_public = true
  AND memory_date >= make_date(2026, 1, 1) AND memory_date < make_date(2027, 1, 1)
ORDER BY memory_date DESC LIMIT 20;

-- Caso 2: feed logado + ano -> o OR dos dois braços, cada um indexado
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories
WHERE (is_public = true OR user_id = 'u1')
  AND memory_date >= make_date(2026, 1, 1) AND memory_date < make_date(2027, 1, 1)
ORDER BY memory_date DESC LIMIT 20;

-- Caso 3: minhas memórias + ano -> so user_id = $1
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories
WHERE user_id = 'u1'
  AND memory_date >= make_date(2026, 1, 1) AND memory_date < make_date(2027, 1, 1)
ORDER BY memory_date DESC LIMIT 20;

\echo ''
\echo '=== 1F) O contraexemplo, e por que ele NÃO é dívida ==='
\echo '--- Um range de data PURO dá Seq Scan, porque nenhum índice começa por ---'
\echo '--- memory_date. A tentação é criar memories(memory_date DESC) e medir ---'
\echo '--- ganho (4.01ms -> 1.46ms). Mas essa query não é executada por ---'
\echo '--- ninguém: ela não tem is_public nem user_id, e o serviço sempre põe ---'
\echo '--- um dos dois. O índice pagaria escrita e disco para servir nada. ---'
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories
WHERE memory_date >= make_date(2026, 1, 1) AND memory_date < make_date(2027, 1, 1);

-- =====================================================================
-- PARTE 2 — Onde o planner volta a Seq Scan, e por que isso está ok
-- =====================================================================
-- 20% público. O planner prefere Seq Scan: 12k de 60k linhas casam, e ele
-- quer só as 20 mais recentes. Isso é a decisão CORRETA, não um defeito —
-- registrar é o ponto, para ninguém ler "Seq Scan" e achar que o índice falhou.
-- DELETE e não TRUNCATE: `memories` é referenciada por foreign key e o
-- TRUNCATE é recusado ("cannot truncate a table referenced in a foreign key
-- constraint"). Apaga só as linhas de sondagem, nunca as de verdade.
DELETE FROM memories WHERE user_id ~ '^u[0-9]+$';
INSERT INTO memories (user_id, title, content, memory_date, is_public)
SELECT 'u' || (1 + (g % 50)), 'Memory ' || g, 'conteudo ' || g,
       TIMESTAMP '2023-01-01' + (g || ' hours')::interval,
       (g % 5 = 0)                                    -- 20% público
FROM generate_series(1, 60000) g;
ANALYZE memories;

\echo ''
\echo '=== 2A) 20% público, feed logado: Seq Scan esperado e correto ==='
EXPLAIN (ANALYZE, COSTS OFF)
SELECT id FROM memories
WHERE is_public = true OR user_id = 'u1'
ORDER BY memory_date DESC LIMIT 20;

-- =====================================================================
-- PARTE 3 — Equivalência de conjunto: intervalo == EXTRACT
-- =====================================================================
-- Só vale com `SHOW TimeZone` = UTC. `dateRange` monta instantes UTC
-- (Date.UTC) enquanto `localDate` grava meia-noite local
-- (new Date(y, m-1, d, 0,0,0,0)); com sessão em UTC os dois concordam.
-- Fora de UTC a divergência é conhecida e está registrada como limitação
-- aceita da 7.0.

SHOW TimeZone;

CREATE TEMP TABLE janela (ano int, mes int, label text);
INSERT INTO janela VALUES
  (2025, 12, 'dez/2025 cruza 31/12'),
  (2026,  1, 'jan/2026 cruza 01/01'),
  (2026,  2, 'fev/2026'),
  (2026,  6, 'jun/2026'),
  (2026, 12, 'dez/2026 cruza 31/12'),
  (2027,  1, 'jan/2027');

CREATE TEMP TABLE d (ts timestamp);
INSERT INTO d VALUES
  ('2025-12-31 00:00:00'), ('2025-12-31 23:59:59'),
  ('2026-01-01 00:00:00'),  ('2026-01-31 23:59:59'),
  ('2026-02-01 00:00:00'),  ('2026-06-15 12:00:00'),
  ('2026-12-31 23:59:59'),  ('2027-01-01 00:00:00');

\echo ''
\echo '=== 3A) EXTRACT vs intervalo half-open, só linhas de fronteira ==='
\echo '--- Esperado: divergencias = 0 em todas as janelas. ---'
-- O fim é o 1º dia do mês seguinte. Dezembro precisa virar 01/01 do ano+1,
-- que é o que Date.UTC(year, 12, 1) faz no serviço: o mês do JS é 0-indexed
-- e o 12 transborda para janeiro. `make_date` é 1-indexed e REJEITA mês 13
-- ("date field value out of range: 2025-13-01"), então o caso tem de ser
-- escrito à mão — e é a armadilha silenciosa do item equivalente no código.
SELECT w.label,
       count(*) FILTER (WHERE EXTRACT(YEAR FROM d.ts) = w.ano
                          AND EXTRACT(MONTH FROM d.ts) = w.mes)  AS via_extract,
       count(*) FILTER (WHERE d.ts >= make_date(w.ano, w.mes, 1)
                          AND d.ts <  CASE WHEN w.mes = 12 THEN make_date(w.ano + 1, 1, 1)
                                            ELSE make_date(w.ano, w.mes + 1, 1) END) AS via_intervalo,
       count(*) FILTER (WHERE (EXTRACT(YEAR FROM d.ts) = w.ano
                               AND EXTRACT(MONTH FROM d.ts) = w.mes)
                          IS DISTINCT FROM (d.ts >= make_date(w.ano, w.mes, 1)
                          AND d.ts < CASE WHEN w.mes = 12 THEN make_date(w.ano + 1, 1, 1)
                                         ELSE make_date(w.ano, w.mes + 1, 1) END)) AS divergencias
FROM janela w CROSS JOIN d
GROUP BY w.ano, w.mes, w.label
ORDER BY w.ano, w.mes;

\echo ''
\echo '=== 3B) As duas travessias, isoladas ==='
SELECT '2025-12-31 23:59:59'::timestamp AS ts,
       'ainda e dezembro'::text        AS pertence_a;
SELECT '2026-01-01 00:00:00'::timestamp AS ts,
       'ja e janeiro'::text             AS pertence_a;

ROLLBACK;
