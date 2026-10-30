import { num } from "./ui";

/* ============================================================
   Metodología STOK v0.1 en código.

   Todo lo que el dashboard sabe de la metodología vive acá: niveles de
   control, escalera de madurez, excepciones, KPIs con sus metas y el
   evento estándar que se entrega al ERP. Las pantallas solo pintan.

   Los datos nuevos llegan del mismo GET /webhook/stok/api/dashboard
   (contrato v5, ver docs/contrato-dashboard-v5.md). Todas las listas son
   opcionales: si n8n todavía no las manda, cada pantalla lo dice en vez
   de mostrar un cero que parezca "todo bien".
   ============================================================ */

/* ---------- niveles de control (sección 4) ---------- */
export const NIVELES = {
  N0: { nombre: "Origen", unidad: "Paquete etiquetado por el proveedor", descuento: "Se lee al recibir" },
  N1: { nombre: "Unitario", unidad: "Cada ítem, tag anti-metal", descuento: "Préstamo con responsable" },
  N2: { nombre: "Lote", unidad: "Pallet, caja, paquete o carrete", descuento: "Por cantidad, con saldo" },
  N3: { nombre: "Contenedor", unidad: "Bin o caja reutilizable", descuento: "Por reposición del bin" },
  N4: { nombre: "Balance", unidad: "Sin tag", descuento: "Guía vs. avance programado" },
};
export const ORDEN_NIVELES = ["N0", "N1", "N2", "N3", "N4"];

/* ---------- escalera de madurez (sección 7) ---------- */
export const ESCALONES = [
  { n: 0, nombre: "Orden", que: "Zonificación, catálogo y punto de paso único", intervencion: "Alta" },
  { n: 1, nombre: "Recepción digital", que: "Punto Cero + guía DTE + tags + lector de mano", intervencion: "Media" },
  { n: 2, nombre: "Control de flujo", que: "Pórtico RFID + credenciales + alertas", intervencion: "Baja" },
  { n: 3, nombre: "Conteo inteligente", que: "Cámara con IA para unidades sueltas", intervencion: "Muy baja" },
  { n: 4, nombre: "Bodega predictiva", que: "Kits desde la programación + tag en origen + compras anticipadas", intervencion: "Mínima" },
];

/* Si la planilla no declara el escalón, se deduce de lo que la obra ya usa.
   Es una pista, no una certificación: el escalón real lo aprueba el
   administrador de obra cuando el anterior cumple sus KPIs 4 semanas. */
export function escalonDe(d) {
  if (d.metodologia && d.metodologia.escalon !== undefined && d.metodologia.escalon !== "")
    return { n: num(d.metodologia.escalon), declarado: true };
  const fuentes = new Set((d.movimientos || []).map((m) => String(m.fuente || "").toUpperCase()));
  let n = 0;
  if ((d.recepciones || []).length || (d.lotes || []).length) n = 1;
  if (fuentes.has("PORTICO") || (d.lectores || []).length) n = Math.max(n, 2);
  if (fuentes.has("CAMARA")) n = Math.max(n, 3);
  if ((d.kits || []).length && (d.lotes || []).some((l) => l.nivel === "N0")) n = 4;
  return { n, declarado: false };
}

export const TIPOLOGIAS = {
  A: "Bodega cerrada con una puerta",
  B: "Bodega cerrada + acopio exterior",
  C: "Edificio en altura con pañoles por piso",
  D: "Obra chica, sin pórtico",
};

/* ---------- excepciones de recepción (sección 5) ----------
   Plazo en horas: propuesta inicial, se valida con cada constructora. */
export const EXCEPCIONES = {
  sin_oc: { txt: "Guía sin OC", accion: "Recibida en cuarentena", responsable: "Adquisiciones", horas: 48 },
  faltante: { txt: "Llegó menos de lo indicado", accion: "Saldo pendiente en la OC", responsable: "Adquisiciones", horas: 48 },
  exceso: { txt: "Llegó más de lo pedido", accion: "Exceso por aprobar", responsable: "Jefe de bodega", horas: 24 },
  sustituto: { txt: "Llegó un material distinto", accion: "Sustituto con foto", responsable: "Jefe de terreno", horas: 24 },
  danado: { txt: "Material dañado", accion: "Rechazo parcial con foto", responsable: "Adquisiciones", horas: 48 },
  entrega_directa: { txt: "Entrega directa en el frente", accion: "Entrada y salida inmediata", responsable: "Capataz", horas: 0 },
  fuera_horario: { txt: "Llegó fuera de horario", accion: "Recepción provisoria", responsable: "Guardia o capataz", horas: 24 },
};

/* Vence = creada + plazo. Una excepción sin plazo (entrega directa) se resuelve en el momento. */
export function venceExcepcion(e) {
  if (e.plazo) return new Date(e.plazo);
  const h = EXCEPCIONES[e.tipo]?.horas ?? 48;
  return new Date(new Date(e.creada).getTime() + h * 3600e3);
}

/* ---------- órdenes de compra (pre-recepción) ---------- */
const CERRADAS = ["recibida", "cerrada"];
export const hoyIso = () => new Date().toISOString().slice(0, 10);
export const mananaIso = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

export function estadoOC(oc) {
  const entrega = String(oc.fecha_entrega || "").slice(0, 10);
  if (CERRADAS.includes(oc.estado)) return { id: oc.estado, txt: oc.estado === "cerrada" ? "Cerrada" : "Recibida", tono: "ok" };
  if (!entrega) return { id: "sin_fecha", txt: "Sin fecha de entrega", tono: "warn" };
  if (entrega < hoyIso()) return { id: "vencida", txt: "Vencida", tono: "crit" };
  if (oc.fecha_necesidad && entrega > String(oc.fecha_necesidad).slice(0, 10)) return { id: "riesgo", txt: "Riesgo de quiebre", tono: "warn" };
  if (oc.estado === "parcial") return { id: "parcial", txt: "Recibida parcial", tono: "neutro" };
  return { id: "agendada", txt: entrega === hoyIso() ? "Llega hoy" : entrega === mananaIso() ? "Llega mañana" : "Agendada", tono: "neutro" };
}

/* Avance por línea: "recibidas 12 de 39". */
export function avanceOC(oc) {
  const lineas = oc.lineas || [];
  const pedido = lineas.reduce((s, l) => s + num(l.cantidad), 0);
  const recibido = lineas.reduce((s, l) => s + Math.min(num(l.recibida), num(l.cantidad)), 0);
  return { pedido, recibido, pct: pedido ? recibido / pedido : 0 };
}

/* ---------- cruce de tres vías (OC · guía · conteo) ---------- */
export function cruceLinea(l, conOC = true) {
  if (!conOC) return { ok: false, txt: "Sin OC" };
  const esperado = num(l.esperado), declarado = num(l.declarado ?? l.esperado), contado = num(l.contado);
  if (contado === declarado && declarado === esperado) return { ok: true, txt: "Conforme" };
  if (contado < declarado) return { ok: false, txt: `Faltan ${declarado - contado}` };
  if (contado > esperado) return { ok: false, txt: `Sobran ${contado - esperado}` };
  return { ok: false, txt: "Guía distinta a la OC" };
}

/* ---------- movimientos y eventos ----------
   Se consideran capturados sin digitación todos los que no vienen marcados
   como MANUAL. La tablet cuenta como automática: ahí la persona confirma,
   no escribe. */
export const FUENTES = {
  PORTICO: "Pórtico RFID", CAMARA: "Cámara IA", TABLET: "Tablet", LECTOR_MANO: "Lector de mano",
  ERP: "ERP", DTE: "Guía DTE", MANUAL: "Digitado a mano",
};
export const fuenteDe = (m) => String(m.fuente || "PORTICO").toUpperCase();
export const esNoAutorizada = (m) => m.autorizada === false || String(m.confianza || "").toUpperCase() === "SIN_IDENTIFICAR";

/* El evento estándar de la sección 6: lo mismo para cualquier ERP. */
export function aEvento(m, obraId) {
  const delta = num(m.delta);
  const tipo = String(m.tipo || (delta >= 0 ? "ENTRADA" : "SALIDA")).toUpperCase();
  /* Una devolución vuelve desde la partida; una entrada llega del proveedor. */
  const desde = tipo === "DEVOLUCION" ? m.partida || "Obra" : delta >= 0 ? "Proveedor" : m.zona || "Bodega";
  const hacia = delta >= 0 ? m.zona || "Bodega" : m.partida || "";
  return {
    event_id: m.event_id || `${obraId}-${m.ts}-${m.lote_id || m.material_id || m.nombre}`,
    tipo,
    fecha_hora: m.ts,
    obra: obraId,
    lote_id: m.lote_id || "",
    articulo_erp: m.articulo_erp || m.material_id || "",
    nombre: m.nombre || "",
    cantidad: Math.abs(delta),
    unidad: m.unidad || "",
    origen: m.origen || desde,
    destino: m.destino || hacia,
    oc: m.oc || "",
    guia: m.guia || "",
    responsable: m.responsable || "",
    fuente: fuenteDe(m),
    confianza: String(m.confianza || (esNoAutorizada(m) ? "SIN_IDENTIFICAR" : "CONFIRMADO")).toUpperCase(),
    evidencia: m.evidencia || "",
  };
}

const CAMPOS_EVENTO = ["event_id", "tipo", "fecha_hora", "obra", "lote_id", "articulo_erp", "nombre", "cantidad", "unidad",
  "origen", "destino", "oc", "guia", "responsable", "fuente", "confianza", "evidencia"];

export function eventosCSV(eventos) {
  const celda = (v) => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  /* Punto y coma: Excel en español abre así el archivo sin preguntar. */
  return [CAMPOS_EVENTO.join(";"), ...eventos.map((e) => CAMPOS_EVENTO.map((k) => celda(e[k])).join(";"))].join("\n");
}

export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- conteo cíclico por ABC ---------- */
export const FRECUENCIA_ABC = { A: 7, B: 30, C: 90 }; // días entre conteos
const TOLERANCIA = 0.02; // ±2 % se considera exacto

export const conteoExacto = (c) => {
  const s = num(c.sistema), f = num(c.fisico);
  return s === 0 ? f === 0 : Math.abs(s - f) / s <= TOLERANCIA;
};
export const conteoVencido = (c) => {
  const dias = FRECUENCIA_ABC[c.clase] ?? 30;
  return !c.ultimo_conteo || Date.now() - new Date(c.ultimo_conteo) > dias * 864e5;
};

/* ---------- KPIs (sección 8) ----------
   valor = null cuando falta el dato: la pantalla muestra "sin datos",
   nunca un 0 que se confunda con un resultado. */
const pct = (a, b) => (b ? a / b : null);
const semana = (ts) => Date.now() - new Date(ts) <= 7 * 864e5;

export function calcularKPIs(d) {
  const movs = d.movimientos || [];
  const rec = d.recepciones || [];
  const conteosA = (d.conteos || []).filter((c) => c.clase === "A");
  const ocs = d.ordenes_compra || [];
  const partidas = d.consumo_partidas || [];
  const conDuracion = rec.filter((r) => r.duracion_min !== undefined && r.duracion_min !== "");
  const presupuesto = partidas.reduce((s, p) => s + num(p.presupuestado), 0);
  const real = partidas.reduce((s, p) => s + num(p.real), 0);

  return [
    { id: "captura", nombre: "Captura automática", meta: "≥ 90 %", tipo: "pct", mejor: "alto", umbral: 0.9,
      valor: pct(movs.filter((m) => fuenteDe(m) !== "MANUAL").length, movs.length),
      como: "Movimientos sin digitación / total" },
    { id: "exactitud", nombre: "Exactitud de inventario", meta: "≥ 95 %", tipo: "pct", mejor: "alto", umbral: 0.95,
      valor: pct(conteosA.filter(conteoExacto).length, conteosA.length),
      como: "Conteo físico vs. STOK en materiales A (±2 %)" },
    { id: "no_autorizadas", nombre: "Salidas sin identificar", meta: "a la baja", tipo: "n", mejor: "bajo", umbral: 0,
      valor: movs.length ? movs.filter((m) => esNoAutorizada(m) && semana(m.ts)).length : null,
      como: "Cruces del pórtico sin salida autorizada, 7 días" },
    { id: "mismo_dia", nombre: "Recepciones el mismo día", meta: "≥ 95 %", tipo: "pct", mejor: "alto", umbral: 0.95,
      valor: pct(rec.filter((r) => r.cerrada_ts && String(r.cerrada_ts).slice(0, 10) === String(r.ts).slice(0, 10)).length, rec.length),
      como: "Recepciones cerradas el mismo día / total" },
    { id: "tiempo", nombre: "Tiempo de recepción", meta: "< 5 min", tipo: "min", mejor: "bajo", umbral: 5,
      valor: conDuracion.length ? conDuracion.reduce((s, r) => s + num(r.duracion_min), 0) / conDuracion.length : null,
      como: "Promedio de minutos por camión" },
    { id: "quiebres", nombre: "Quiebres de stock", meta: "bajar vs. línea base", tipo: "n", mejor: "bajo", umbral: 0,
      valor: (d.materiales || []).length ? (d.materiales || []).filter((m) => num(m.stock) <= 0 && num(m.minimo) > 0).length : null,
      como: "Materiales con mínimo y sin stock" },
    { id: "oc_vencidas", nombre: "OC vencidas", meta: "bajar vs. línea base", tipo: "n", mejor: "bajo", umbral: 0,
      valor: ocs.length ? ocs.filter((o) => estadoOC(o).id === "vencida").length : null,
      como: "Fecha de entrega pasada y sin recepción" },
    { id: "merma", nombre: "Merma", meta: "medir y bajar", tipo: "pct", mejor: "bajo", umbral: 0,
      valor: presupuesto ? (real - presupuesto) / presupuesto : null,
      como: "Consumo real vs. presupuestado por partida" },
  ];
}

/* Tono de un KPI contra su meta. Los "a la baja" sin umbral numérico
   solo se marcan cuando hay algo que mirar. */
export function tonoKPI(k) {
  if (k.valor === null) return "neutro";
  if (k.mejor === "alto") return k.valor >= k.umbral ? "ok" : k.valor >= k.umbral - 0.1 ? "warn" : "crit";
  if (k.id === "tiempo") return k.valor < k.umbral ? "ok" : k.valor < k.umbral * 1.5 ? "warn" : "crit";
  if (k.id === "merma") return k.valor <= 0.03 ? "ok" : k.valor <= 0.08 ? "warn" : "crit";
  return k.valor <= k.umbral ? "ok" : "warn";
}

export function textoKPI(k) {
  if (k.valor === null) return "sin datos";
  if (k.tipo === "pct") return `${(k.valor * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })} %`;
  if (k.tipo === "min") return `${k.valor.toLocaleString("es-CL", { maximumFractionDigits: 1 })} min`;
  return String(k.valor);
}

/* ---------- reglas de oro ---------- */
export const REGLAS = [
  "Nada entra sin pasar por el Punto Cero.",
  "Nada sale sin un responsable y una partida.",
  "Toda diferencia tiene un dueño y un plazo.",
  "Se controla por zona, no por estante.",
  "Toda OC trae su fecha de entrega comprometida.",
  "El papel convive 2 semanas y después desaparece.",
];
