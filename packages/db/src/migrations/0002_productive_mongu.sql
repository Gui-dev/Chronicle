CREATE TABLE "narrative_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" uuid NOT NULL,
	"narrative" text NOT NULL,
	"mood" varchar(50),
	"themes" text[],
	"version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "narrative_versions" ADD CONSTRAINT "narrative_versions_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "narrative_versions_memory_idx" ON "narrative_versions" USING btree ("memory_id");