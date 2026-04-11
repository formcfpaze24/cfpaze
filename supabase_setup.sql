-- ══════════════════════════════════════════════════════════════
-- CFPA-ZÉ — Script d'initialisation Supabase
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Table des utilisateurs (admin + formateurs)
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  password     TEXT NOT NULL,
  nom          TEXT,
  prenom       TEXT,
  role         TEXT NOT NULL DEFAULT 'formateur', -- 'admin' | 'formateur'
  metier_id    TEXT,
  niveaux      TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des apprenants (par période)
CREATE TABLE IF NOT EXISTS apprenants (
  id           TEXT PRIMARY KEY,
  periode_key  TEXT NOT NULL,   -- ex: "20252026_S1"
  nom          TEXT,
  prenom       TEXT,
  metier_id    TEXT,
  niveau       TEXT,
  sexe         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apprenants_periode ON apprenants(periode_key);

-- 3. Table des notes (une ligne par apprenant par période)
CREATE TABLE IF NOT EXISTS notes (
  apprenant_id TEXT NOT NULL,
  periode_key  TEXT NOT NULL,
  data         JSONB DEFAULT '{}',   -- ex: {"m1": 14, "m2": 16, ...}
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (apprenant_id, periode_key)
);
CREATE INDEX IF NOT EXISTS idx_notes_periode ON notes(periode_key);

-- 4. Table de configuration (métiers + modules par période)
CREATE TABLE IF NOT EXISTS config (
  periode_key  TEXT NOT NULL,
  type         TEXT NOT NULL,   -- 'metiers' | 'modules'
  items        JSONB DEFAULT '[]',
  PRIMARY KEY (periode_key, type)
);

-- ── Activer le temps réel sur les tables critiques ──────────────
ALTER TABLE apprenants REPLICA IDENTITY FULL;
ALTER TABLE notes      REPLICA IDENTITY FULL;

-- ── Désactiver Row Level Security (accès public via anon key) ───
-- Pour une sécurité renforcée plus tard, vous pouvez configurer
-- des politiques RLS selon les rôles.
ALTER TABLE users      DISABLE ROW LEVEL SECURITY;
ALTER TABLE apprenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE config     DISABLE ROW LEVEL SECURITY;

-- ── Activer les tables dans la publication Realtime ─────────────
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE apprenants;
  ALTER PUBLICATION supabase_realtime ADD TABLE notes;
COMMIT;

-- ══════════════════════════════════════════════════════════════
-- Vérification : toutes les tables créées
-- ══════════════════════════════════════════════════════════════
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users','apprenants','notes','config');
