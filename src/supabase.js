import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* El modo demostración (?demo) no necesita Supabase: por eso no se corta
   la carga acá. Sin las variables, App muestra el aviso en pantalla. */
export const FALTA_CONFIG = !url || !anon
  ? "Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. " +
    "Créalas en el archivo .env local y en las variables de entorno de Vercel."
  : null;

export const supabase = FALTA_CONFIG ? null : createClient(url, anon);
