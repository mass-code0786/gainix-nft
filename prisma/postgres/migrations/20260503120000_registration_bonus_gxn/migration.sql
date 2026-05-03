ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registration_bonus_given" BOOLEAN NOT NULL DEFAULT false;
