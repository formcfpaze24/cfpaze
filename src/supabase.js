// ══════════════════════════════════════════════════════════════════
// ☁️  CONFIGURATION SUPABASE — CFPA-ZE
// Remplacez les valeurs ci-dessous par celles de votre projet Supabase
// ══════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  || "VOTRE_SUPABASE_URL";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "VOTRE_SUPABASE_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseKey);
