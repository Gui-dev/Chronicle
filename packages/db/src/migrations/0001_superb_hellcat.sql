CREATE INDEX "memories_user_date_idx" ON "memories" USING btree ("user_id","memory_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "memories_public_date_idx" ON "memories" USING btree ("is_public","memory_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "memory_people_memory_idx" ON "memory_people" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "memory_photos_memory_idx" ON "memory_photos" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "memory_tags_memory_idx" ON "memory_tags" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "memory_tags_name_idx" ON "memory_tags" USING btree ("name");--> statement-breakpoint
-- `memory_tags.name` entra na lista pelo mesmo motivo dos outros: o filtro de tag e
-- `ilike(memoryTags.name, '%tag%')`, com wildcard inicial, que btree nao atende. O indice btree
-- `memory_tags_name_idx` da Task 4 fica para o caminho de igualdade exata; sozinho ele nao serve
-- o `#tag`.
--
-- GIN trigram indexes: `search`, `location` and `weather` all match with
-- ilike '%term%'. A leading wildcard cannot use a btree, so without trigram the
-- new search is a sequential scan — the exact cost this phase exists to remove.
--
-- These live in the migration only, never in the Drizzle schema: `gin_trgm_ops`
-- requires the pg_trgm extension, which drizzle-kit cannot reason about when
-- diffing the schema, and the schema tests are `getTableConfig` introspection
-- with no database connection at all.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX memories_title_trgm_idx ON memories USING gin (title gin_trgm_ops);--> statement-breakpoint
CREATE INDEX memories_content_trgm_idx ON memories USING gin (content gin_trgm_ops);--> statement-breakpoint
CREATE INDEX memories_location_trgm_idx ON memories USING gin (location_name gin_trgm_ops);--> statement-breakpoint
CREATE INDEX memories_weather_trgm_idx ON memories USING gin (weather_desc gin_trgm_ops);--> statement-breakpoint
CREATE INDEX memory_tags_name_trgm_idx ON memory_tags USING gin (name gin_trgm_ops);