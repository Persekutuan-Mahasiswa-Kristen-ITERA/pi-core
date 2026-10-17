CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
-- Row Level Security: enabled with NO public policies (NFR-7, ADR-0009).
ALTER TABLE "jwks" ENABLE ROW LEVEL SECURITY;
