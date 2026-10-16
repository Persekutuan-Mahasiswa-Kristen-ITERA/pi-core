CREATE TABLE "org_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"org_name" text NOT NULL,
	"logo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "org_settings_singleton_uq" ON "org_settings" USING btree ("singleton") WHERE "org_settings"."singleton";

--> statement-breakpoint
-- NFR-7: RLS on with zero policies. Nothing reaches these tables except through the Worker, which
-- connects as the table owner; a policy would only widen access, and there is no client path at all.
ALTER TABLE "org_settings" ENABLE ROW LEVEL SECURITY;
