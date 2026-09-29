ALTER TABLE "memories" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "share_expires_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "memories_share_token_idx" ON "memories" USING btree ("share_token") WHERE "memories"."share_token" is not null;