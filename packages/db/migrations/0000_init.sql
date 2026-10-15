CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."org_unit_type" AS ENUM('organization', 'bph', 'department', 'bureau', 'division');--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"full_name" text NOT NULL,
	"nim" text,
	"faculty" text,
	"study_program" text,
	"cohort_year" integer,
	"phone" text,
	"avatar_key" text,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"google_sub" text,
	"auth_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "members_email_unique" UNIQUE("email"),
	CONSTRAINT "members_google_sub_unique" UNIQUE("google_sub"),
	CONSTRAINT "members_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "org_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"type" "org_unit_type" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"path" text,
	"depth" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_id_org_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."org_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_full_name_idx" ON "members" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "members_status_idx" ON "members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "members_deleted_at_idx" ON "members" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_units_parent_slug_uq" ON "org_units" USING btree ("parent_id","slug") WHERE "org_units"."parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "org_units_root_slug_uq" ON "org_units" USING btree ("slug") WHERE "org_units"."parent_id" is null;--> statement-breakpoint
CREATE INDEX "org_units_parent_idx" ON "org_units" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "org_units_path_idx" ON "org_units" USING btree ("path");--> statement-breakpoint
-- Row Level Security: enabled with NO policies (NFR-7, ADR-0009).
-- The Worker connects as the table owner, so RLS does not gate our own queries; every other
-- role (e.g. the Supabase Data API, should it ever be enabled) is denied by default.
-- Application-level authorization is the `can()` core; RLS is defence-in-depth.
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_units" ENABLE ROW LEVEL SECURITY;