CREATE INDEX "memories_user_date_idx" ON "memories" USING btree ("user_id","memory_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "memories_public_date_idx" ON "memories" USING btree ("is_public","memory_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "memory_people_memory_idx" ON "memory_people" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "memory_photos_memory_idx" ON "memory_photos" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "memory_tags_memory_idx" ON "memory_tags" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "memory_tags_name_idx" ON "memory_tags" USING btree ("name");