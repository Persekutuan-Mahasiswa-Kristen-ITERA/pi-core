CREATE TABLE "mobile_auth_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"member_id" uuid NOT NULL,
	"code_challenge" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_auth_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "mobile_auth_codes" ADD CONSTRAINT "mobile_auth_codes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mobile_auth_codes_expires_idx" ON "mobile_auth_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mobile_auth_codes_member_idx" ON "mobile_auth_codes" USING btree ("member_id");--> statement-breakpoint
-- Row Level Security: enabled with NO policies (NFR-7, ADR-0009) — see 0000_init.sql.
ALTER TABLE "mobile_auth_codes" ENABLE ROW LEVEL SECURITY;