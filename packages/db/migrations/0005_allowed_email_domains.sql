CREATE TABLE "allowed_email_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" "citext" NOT NULL,
	"allow_subdomains" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "allowed_email_domains_domain_uq" ON "allowed_email_domains" USING btree ("domain");--> statement-breakpoint
-- Row Level Security: enabled with NO policies (NFR-7, ADR-0009) — see 0000_init.sql.
ALTER TABLE "allowed_email_domains" ENABLE ROW LEVEL SECURITY;