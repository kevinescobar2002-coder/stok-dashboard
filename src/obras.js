import { supabase } from "./supabase";

/* ============================================================
   Obras y membresías.

   Una obra es un espacio cerrado: su n8n, su planilla y su
   `obra_id` (la llave que separa las filas dentro de Sheets).
   Una persona puede estar en varias y cambia entre ellas.

   La configuración técnica ya no cuelga del usuario sino de la
   obra: si el jefe de terreno corrige la dirección de n8n, la
   corrige para todo el equipo, no solo para él.
   ============================================================ */

export const SIN_OBRA = {
  id: null, nombre: "", obraId: "", codigo: "",
  base: "", linkPlanilla: "", linkCarpeta: "", rol: "bodeguero",
};

const desdeFila = (o, rol) => ({
  id: o.id,
  nombre: o.nombre || "",
  obraId: o.obra_id || "",
  codigo: o.codigo || "",
  base: o.base_n8n || "",
  linkPlanilla: o.link_planilla || "",
  linkCarpeta: o.link_carpeta || "",
  rol: rol || "bodeguero",
});

/* Las funciones de Postgres que devuelven una fila llegan como objeto,
   pero según la versión de PostgREST pueden llegar envueltas en un array. */
const unaFila = (d) => (Array.isArray(d) ? d[0] : d);

/* n8n abre la planilla y la carpeta de la obra por su ID, no por el enlace.
   Se extrae acá, al guardar, y no allá: así el error ("ese enlace no es una
   planilla") se ve en el momento en que alguien lo pega, y no a las 06:00
   de la mañana siguiente cuando el agente de predicción no encuentra nada. */
export const idPlanilla = (url) => (String(url || "").match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/) || [])[1] || "";
export const idCarpeta  = (url) => (String(url || "").match(/\/folders\/([A-Za-z0-9_-]+)/) || [])[1] || "";

const mensaje = (error) => {
  const m = String(error?.message || "");
  if (m.includes("duplicate key") && m.includes("obras_obra_id")) return "Ya existe una obra con ese identificador.";
  if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "Sin conexión con Supabase.";
  return m || "No se pudo completar la operación.";
};

/* ---------- lectura ----------
   Devolvemos { obras, error } por separado a propósito: confundir
   "falló la consulta" con "no tienes obras" mandaría a alguien que
   ya tiene obra a la pantalla de crear una nueva. */
export async function cargarObras(userId) {
  const { data, error } = await supabase
    .from("miembros")
    .select("rol, desde, obra:obras(*)")
    .eq("usuario", userId)
    .order("desde", { ascending: true });

  if (error) return { obras: null, error: mensaje(error) };
  const obras = (data || []).filter((m) => m.obra).map((m) => desdeFila(m.obra, m.rol));
  return { obras, error: null };
}

export async function leerObraActiva(userId) {
  const { data, error } = await supabase
    .from("configuracion").select("obra_activa").eq("user_id", userId).maybeSingle();
  if (error) return { id: null, error: mensaje(error) };
  return { id: data?.obra_activa || null, error: null };
}

export async function fijarObraActiva(userId, obraUuid) {
  const { error } = await supabase
    .from("configuracion")
    .upsert({ user_id: userId, obra_activa: obraUuid }, { onConflict: "user_id" });
  if (error) throw new Error(mensaje(error));
}

/* ---------- alta ---------- */
export async function unirseAObra(codigo) {
  const { data, error } = await supabase.rpc("unirse_a_obra", { p_codigo: String(codigo || "").trim() });
  if (error) throw new Error(mensaje(error));
  const fila = unaFila(data);
  /* El rol real puede ser 'admin' si ya pertenecía; se corrige en la
     próxima carga de obras, que es la fuente de verdad. */
  return desdeFila(fila, "bodeguero");
}

/* ---------- administración (solo admin: lo impone RLS) ---------- */
export async function guardarObra(obra) {
  const sheet = idPlanilla(obra.linkPlanilla);
  const carpeta = idCarpeta(obra.linkCarpeta);
  if (obra.linkPlanilla && !sheet)
    throw new Error("Ese enlace no parece una planilla de Google Sheets.");
  if (obra.linkCarpeta && !carpeta)
    throw new Error("Ese enlace no parece una carpeta de Google Drive.");

  const { error } = await supabase.from("obras").update({
    nombre: obra.nombre,
    base_n8n: obra.base,
    link_planilla: obra.linkPlanilla,
    link_carpeta: obra.linkCarpeta,
    sheet_id: sheet,
    carpeta_id: carpeta,
  }).eq("id", obra.id);
  if (error) throw new Error(mensaje(error));
}

export async function rotarCodigo(obraUuid) {
  const { data, error } = await supabase.rpc("rotar_codigo", { p_obra: obraUuid });
  if (error) throw new Error(mensaje(error));
  return data;
}

export async function salirDeObra(obraUuid, userId) {
  const { error } = await supabase.from("miembros").delete().eq("obra", obraUuid).eq("usuario", userId);
  if (error) throw new Error(mensaje(error));
}

export async function cargarEquipo(obraUuid) {
  const { data, error } = await supabase
    .from("miembros").select("usuario, rol, desde").eq("obra", obraUuid);
  if (error) return [];
  return data || [];
}
