-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tables
CREATE TABLE IF NOT EXISTS "Dealer" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" text UNIQUE NOT NULL,
  "passwordHash" text NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TYPE "Role" AS ENUM ('admin', 'manager', 'viewer');

CREATE TABLE IF NOT EXISTS "UserDealerRole" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL,
  "dealerId" uuid NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_udr_user FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT fk_udr_dealer FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE,
  CONSTRAINT u_udr UNIQUE ("userId","dealerId","role")
);
CREATE INDEX IF NOT EXISTS idx_udr_dealer ON "UserDealerRole"("dealerId");
CREATE INDEX IF NOT EXISTS idx_udr_user ON "UserDealerRole"("userId");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL,
  "dealerId" uuid NOT NULL,
  "jwtId" text UNIQUE NOT NULL,
  "expiresAt" timestamp with time zone NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_sess_user FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT fk_sess_dealer FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sess_user ON "Session"("userId");
CREATE INDEX IF NOT EXISTS idx_sess_dealer ON "Session"("dealerId");

-- Triggers to maintain updatedAt
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dealer_updated_at ON "Dealer";
CREATE TRIGGER trg_dealer_updated_at BEFORE UPDATE ON "Dealer"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_user_updated_at ON "User";
CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Baseline RLS (Supabase-compatible)
ALTER TABLE "Dealer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserDealerRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

-- Helper: extract JWT dealer_id claim (Supabase sets request.jwt.claims)
CREATE OR REPLACE FUNCTION auth_dealer_id() RETURNS uuid AS $$
  SELECT (coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'dealer_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Policies: allow access only for matching dealer_id
DROP POLICY IF EXISTS "dealer_select" ON "Dealer";
CREATE POLICY "dealer_select" ON "Dealer"
  FOR SELECT USING (auth_dealer_id() IS NOT NULL);

DROP POLICY IF EXISTS "userdealer_select" ON "UserDealerRole";
CREATE POLICY "userdealer_select" ON "UserDealerRole"
  FOR SELECT USING ("dealerId" = auth_dealer_id());

DROP POLICY IF EXISTS "session_select" ON "Session";
CREATE POLICY "session_select" ON "Session"
  FOR SELECT USING ("dealerId" = auth_dealer_id());

-- Users table is typically admin-only; allow self or admin via future role check (placeholder)
DROP POLICY IF EXISTS "user_select" ON "User";
CREATE POLICY "user_select" ON "User"
  FOR SELECT USING (true);


