CREATE TABLE "periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periods_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"unit_type" "org_unit_type" NOT NULL,
	"rank" integer NOT NULL,
	"is_unique_per_unit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_key_unique" UNIQUE("key"),
	CONSTRAINT "positions_id_unit_type_uq" UNIQUE("id","unit_type"),
	CONSTRAINT "positions_id_unique_per_unit_uq" UNIQUE("id","is_unique_per_unit")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"org_unit_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"unit_type" "org_unit_type" NOT NULL,
	"is_unique_per_unit" boolean DEFAULT false NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Hand-moved: drizzle-kit emits this after the foreign keys that need it, which fails.
-- The composite FK `(org_unit_id, unit_type) -> (id, type)` requires it to exist first.
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_id_type_uq" UNIQUE("id","type");--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_org_unit_id_org_units_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_position_unit_type_fk" FOREIGN KEY ("position_id","unit_type") REFERENCES "public"."positions"("id","unit_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_position_unique_per_unit_fk" FOREIGN KEY ("position_id","is_unique_per_unit") REFERENCES "public"."positions"("id","is_unique_per_unit") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_org_unit_type_fk" FOREIGN KEY ("org_unit_id","unit_type") REFERENCES "public"."org_units"("id","type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "periods_single_active_uq" ON "periods" USING btree ("is_active") WHERE "periods"."is_active";--> statement-breakpoint
CREATE INDEX "positions_unit_type_idx" ON "positions" USING btree ("unit_type");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_member_unit_position_period_uq" ON "assignments" USING btree ("member_id","org_unit_id","position_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_unique_per_unit_uq" ON "assignments" USING btree ("org_unit_id","period_id","position_id") WHERE "assignments"."is_unique_per_unit";--> statement-breakpoint
CREATE INDEX "assignments_member_idx" ON "assignments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "assignments_period_idx" ON "assignments" USING btree ("period_id");--> statement-breakpoint
-- Fill the two columns `assignments` derives from the position, so callers only pass `position_id`.
-- The composite foreign keys then make an inconsistent value impossible rather than merely unlikely.
CREATE OR REPLACE FUNCTION assignments_fill_from_position() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT p.unit_type, p.is_unique_per_unit
    INTO NEW.unit_type, NEW.is_unique_per_unit
    FROM positions p
   WHERE p.id = NEW.position_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'position % does not exist', NEW.position_id;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER assignments_fill_from_position_trg
BEFORE INSERT OR UPDATE OF position_id ON "assignments"
FOR EACH ROW EXECUTE FUNCTION assignments_fill_from_position();--> statement-breakpoint
-- Row Level Security: enabled with NO policies (NFR-7, ADR-0009) — see 0000_init.sql.
ALTER TABLE "periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;