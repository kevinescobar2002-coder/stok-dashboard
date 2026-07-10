import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. " +
    "Créalas en el archivo .env local y en las variables de entorno de Vercel."
  );
}

export const supabase = createClient(url, anon);
