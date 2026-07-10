import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "./supabase";

/* ============================================================
   STOK · SALA DE CONTROL — Bodega de obra
   Cuentas en Supabase · inventario en Google Sheets vía n8n.
   Tres agentes: captura, predicción y acción.
   ============================================================ */

const F = {
  disp: { fontFamily: "'Archivo',sans-serif", fontVariationSettings: "'wdth' 125", fontWeight: 900, textTransform: "uppercase", letterSpacing: ".005em" },
  mono: { fontFamily: "'IBM Plex Mono',monospace" },
  ui: { fontFamily: "'Schibsted Grotesk','Archivo',sans-serif", letterSpacing: "-.011em" },
};
const C = {
  fondo: "#F6F7FA", panel: "#FFFFFF", suave: "#F2F4F9", linea: "#E3E7F1",
  navy: "#0F1B3D", naranja: "#E8622C",
  texto: "#0F1B3D", tenue: "#5B6785", apagado: "#8B94AC",
  verde: "#0E9F6E", ambar: "#B7791F", rojo: "#D64545",
};

const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
const clp = (n) => "$" + Math.round(num(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const hora = (iso) => { try { return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };
const ahora = () => new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

/* La configuración vive en Supabase, ligada al usuario: te sigue entre dispositivos. */
const CFG_VACIA = { base: "", obraId: "OBRA-001", linkPlanilla: "", linkCarpeta: "" };

async function cargarCfg(userId) {
  const { data, error } = await supabase.from("configuracion").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return CFG_VACIA;
  return { base: data.base_n8n || "", obraId: data.obra_id || "OBRA-001",
           linkPlanilla: data.link_planilla || "", linkCarpeta: data.link_carpeta || "" };
}
async function guardarCfg(userId, cfg) {
  await supabase.from("configuracion").upsert({
    user_id: userId, base_n8n: cfg.base, obra_id: cfg.obraId,
    link_planilla: cfg.linkPlanilla, link_carpeta: cfg.linkCarpeta,
  }, { onConflict: "user_id" });
}

function estadoDe(m) {
  const s = num(m.stock), mn = num(m.minimo);
  if (mn > 0 && s < mn) return { id: "critico", txt: "BAJO MÍNIMO", color: C.rojo };
  if (mn > 0 && s < mn * 1.25) return { id: "pronto", txt: "REPONER PRONTO", color: C.ambar };
  return { id: "ok", txt: "OK", color: C.verde };
}
const colorUrgencia = (u) => (u === "alta" ? C.rojo : u === "media" ? C.ambar : C.verde);

/* ---------- datos de muestra: se usan solo si aún no hay n8n conectado ---------- */
const MUESTRA = {
  obra_id: "OBRA-001", actualizado: new Date().toISOString(), fecha: new Date().toISOString().slice(0, 10),
  materiales: [
    { material_id: "MAT-01", nombre: "Cemento 25 kg", categoria: "Áridos y cementos", zona: "bodega", unidad: "saco", stock: 1, minimo: 2, maximo: 12, proveedor: "Cementos Bío Bío", precio_ref: 5990, tag_registrado: true },
    { material_id: "MAT-02", nombre: "Fierro estriado 12 mm", categoria: "Acero", zona: "bodega", unidad: "barra", stock: 3, minimo: 2, maximo: 20, proveedor: "CAP Acero", precio_ref: 8490, tag_registrado: true },
    { material_id: "MAT-03", nombre: "Plancha OSB 11 mm", categoria: "Maderas", zona: "bodega", unidad: "plancha", stock: 2, minimo: 2, maximo: 15, proveedor: "LP Chile", precio_ref: 13990, tag_registrado: true },
    { material_id: "MAT-04", nombre: "Ladrillo fiscal", categoria: "Albañilería", zona: "bodega", unidad: "pallet", stock: 2, minimo: 1, maximo: 8, proveedor: "Princesa", precio_ref: 45000, tag_registrado: true },
    { material_id: "MAT-05", nombre: "Tubería PVC 110 mm", categoria: "Sanitario", zona: "bodega", unidad: "tira", stock: 3, minimo: 2, maximo: 10, proveedor: "Vinilit", precio_ref: 7290, tag_registrado: true },
    { material_id: "MAT-06", nombre: "Cable THHN 2,5 mm²", categoria: "Eléctrico", zona: "bodega", unidad: "rollo", stock: 2, minimo: 2, maximo: 6, proveedor: "Cobrex", precio_ref: 38990, tag_registrado: true },
    { material_id: "MAT-07", nombre: "Pintura látex 1 gl", categoria: "Terminaciones", zona: "bodega", unidad: "galón", stock: 3, minimo: 2, maximo: 12, proveedor: "Sipa", precio_ref: 15990, tag_registrado: true },
    { material_id: "MAT-08", nombre: "Yeso cartón 15 mm", categoria: "Tabiquería", zona: "bodega", unidad: "plancha", stock: 2, minimo: 2, maximo: 18, proveedor: "Volcán", precio_ref: 9990, tag_registrado: true },
    { material_id: "MAT-09", nombre: "Taladro percutor", categoria: "Herramientas", zona: "bodega", unidad: "unidad", stock: 0, minimo: 1, maximo: 2, proveedor: "Bosch", precio_ref: 89990, tag_registrado: true },
    { material_id: "MAT-10", nombre: "Casco de seguridad", categoria: "EPP", zona: "bodega", unidad: "unidad", stock: 3, minimo: 2, maximo: 15, proveedor: "3M", precio_ref: 6490, tag_registrado: false },
  ],
  movimientos: [
    { ts: new Date(Date.now() - 3e5).toISOString(), nombre: "Taladro percutor", direccion: "salida", delta: -1, stock: 0, lector: "LECTOR-1" },
    { ts: new Date(Date.now() - 9e5).toISOString(), nombre: "Cemento 25 kg", direccion: "salida", delta: -1, stock: 1, lector: "LECTOR-1" },
    { ts: new Date(Date.now() - 15e5).toISOString(), nombre: "Cemento 25 kg", direccion: "salida", delta: -1, stock: 2, lector: "LECTOR-1" },
    { ts: new Date(Date.now() - 26e5).toISOString(), nombre: "Yeso cartón 15 mm", direccion: "entrada", delta: 1, stock: 2, lector: "LECTOR-1" },
  ],
  predicciones: [
    { material_id: "MAT-09", nombre: "Taladro percutor", consumo_diario: 0.07, dias_para_quiebre: 0, fecha_quiebre: "hoy", urgencia: "alta", partida: "Instalación de tabiquería", razonamiento: "Sin unidades en bodega y la partida de tabiquería parte mañana." },
    { material_id: "MAT-01", nombre: "Cemento 25 kg", consumo_diario: 0.5, dias_para_quiebre: 2, fecha_quiebre: "2026-07-12", urgencia: "alta", partida: "Radier sector norte", razonamiento: "El radier del sector norte consume 6 sacos en tres días." },
    { material_id: "MAT-06", nombre: "Cable THHN 2,5 mm²", consumo_diario: 0.21, dias_para_quiebre: 9, fecha_quiebre: "2026-07-19", urgencia: "media", partida: "Canalización eléctrica piso 2", razonamiento: "Consumo estable; la canalización del piso 2 comienza el día 16." },
    { material_id: "MAT-03", nombre: "Plancha OSB 11 mm", consumo_diario: 0.14, dias_para_quiebre: 14, fecha_quiebre: "2026-07-24", urgencia: "media", partida: "Encofrado losa", razonamiento: "Reposición programada alcanza si la losa no se adelanta." },
    { material_id: "MAT-05", nombre: "Tubería PVC 110 mm", consumo_diario: 0.07, dias_para_quiebre: 42, fecha_quiebre: "2026-08-21", urgencia: "baja", partida: "sin partida asociada", razonamiento: "Consumo bajo y sin partida sanitaria en el horizonte." },
  ],
  recomendaciones: [
    { rec_id: "MAT-09-hoy", fecha: "hoy", material_id: "MAT-09", nombre: "Taladro percutor", cantidad_sugerida: 2, unidad: "unidad", proveedor: "Bosch", costo_estimado: 179980, motivo: "Bodega en cero y la partida de tabiquería parte mañana. Detiene la cuadrilla completa.", prioridad: "alta", estado: "pendiente" },
    { rec_id: "MAT-01-hoy", fecha: "hoy", material_id: "MAT-01", nombre: "Cemento 25 kg", cantidad_sugerida: 11, unidad: "saco", proveedor: "Cementos Bío Bío", costo_estimado: 65890, motivo: "Quiebra en 2 días con el consumo del radier norte. Reponer al máximo.", prioridad: "alta", estado: "pendiente" },
    { rec_id: "MAT-06-hoy", fecha: "hoy", material_id: "MAT-06", nombre: "Cable THHN 2,5 mm²", cantidad_sugerida: 4, unidad: "rollo", proveedor: "Cobrex", costo_estimado: 155960, motivo: "Alcanza justo hasta el inicio de la canalización del piso 2.", prioridad: "media", estado: "pendiente" },
  ],
  alertas: [
    { alerta_id: "MAT-09-hoy", fecha: "hoy", nombre: "Taladro percutor", stock: 0, minimo: 1, mensaje: "3 materiales requieren compra inmediata: la tabiquería parte mañana.", correo_enviado: true, del_dia: true },
    { alerta_id: "MAT-01-hoy", fecha: "hoy", nombre: "Cemento 25 kg", stock: 1, minimo: 2, mensaje: "Cemento bajo el mínimo (1/2).", correo_enviado: true, del_dia: true },
  ],
  lectores: [
    { lector_id: "LECTOR-1", obra_id: "OBRA-001", zona: "bodega", activo: true, vinculado: true,
      ultimo_latido: new Date(Date.now() - 3e5).toISOString(), descripcion: "Portal RC522 · entrada de bodega" },
  ],
  agentes: {
    captura: { activo: true, ultimo: new Date(Date.now() - 3e5).toISOString(), lectores: 1 },
    prediccion: { activo: true, ultimo: "hoy", total: 5 },
    accion: { activo: true, ultimo: "hoy", pendientes: 3 },
  },
};

/* ---------- piezas de marca ---------- */
const Marca = ({ tam = 21 }) => (
  <div style={{ ...F.disp, fontSize: tam, display: "flex", alignItems: "flex-end", gap: 7, color: C.navy }}>
    <svg width={tam * 1.1} height={tam * 0.8} viewBox="0 0 34 26" style={{ marginBottom: 3 }} aria-hidden>
      <path d="M4 22 A15 15 0 0 1 30 22" stroke={C.naranja} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="17" cy="22" r="3.4" fill={C.naranja} />
    </svg>
    STOK<span style={{ color: C.naranja }}>.</span>
  </div>
);
const Subtitulo = ({ children, tam = 15 }) => (
  <div style={{ ...F.disp, fontSize: tam, display: "flex", alignItems: "center", gap: 11, color: C.navy }}>
    <span style={{ width: 28, height: 3.5, background: C.naranja, flex: "0 0 auto" }} />
    {children}
  </div>
);
const Boton = ({ children, onClick, tono = "borde", disabled, style, titulo }) => {
  const base = { ...F.mono, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase",
    padding: "9px 14px", cursor: disabled ? "not-allowed" : "pointer", border: "1px solid",
    background: "transparent", color: C.navy, transition: "all .18s", opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap" };
  const tonos = {
    primario: { background: C.naranja, borderColor: C.naranja, color: "#fff", fontWeight: 600 },
    borde: { borderColor: C.linea, background: C.panel },
    sutil: { border: "none", color: C.tenue, padding: "7px 9px" },
  };
  return (
    <button title={titulo} onClick={onClick} disabled={disabled} style={{ ...base, ...tonos[tono], ...style }}
      onMouseEnter={(e) => { if (!disabled && tono === "borde") e.currentTarget.style.borderColor = C.naranja; }}
      onMouseLeave={(e) => { if (tono === "borde") e.currentTarget.style.borderColor = C.linea; }}>{children}</button>
  );
};
const Campo = ({ etiqueta, pista, ...props }) => (
  <label style={{ display: "block", marginBottom: 14 }}>
    <div style={{ ...F.mono, fontSize: 9.5, letterSpacing: ".2em", color: C.tenue, textTransform: "uppercase", marginBottom: 6 }}>{etiqueta}</div>
    <input {...props} style={{ width: "100%", background: C.panel, border: `1px solid ${C.linea}`, color: C.navy,
      padding: "10px 12px", ...F.ui, fontSize: 14, fontWeight: 450, outline: "none", boxSizing: "border-box" }}
      onFocus={(e) => (e.target.style.borderColor = C.naranja)} onBlur={(e) => (e.target.style.borderColor = C.linea)} />
    {pista && <div style={{ ...F.ui, fontSize: 11.5, color: C.apagado, marginTop: 5, lineHeight: 1.5 }}>{pista}</div>}
  </label>
);

/* ============================================================ */
export default function App() {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [cfg, setCfg] = useState(CFG_VACIA);
  const [datos, setDatos] = useState(null);
  const [conexion, setConexion] = useState({ tono: "muestra", txt: "MODO DEMOSTRACIÓN" });
  const [toasts, setToasts] = useState([]);
  const [vistas, setVistas] = useState([]); // alertas ya descartadas en pantalla
  const listo = useRef(false);
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const aviso = useCallback((txt, tono = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, txt, tono }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (u) { setSesion({ id: u.id, email: u.email, nombre: u.user_metadata?.nombre || u.email }); setCfg(await cargarCfg(u.id)); }
      setCargando(false);
      setTimeout(() => (listo.current = true), 300);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      const u = s?.user;
      if (!u) { setSesion(null); setDatos(null); return; }
      setSesion({ id: u.id, email: u.email, nombre: u.user_metadata?.nombre || u.email });
      setCfg(await cargarCfg(u.id));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (listo.current && sesion?.id) guardarCfg(sesion.id, cfg); }, [cfg, sesion]);

  /* ---- el único origen de datos: la API de n8n ---- */
  const url = (ruta) => cfgRef.current.base.replace(/\/+$/, "") + ruta;

  const traer = useCallback(async (avisar = false) => {
    const c = cfgRef.current;
    if (!c.base) { setDatos(MUESTRA); setConexion({ tono: "muestra", txt: "MODO DEMOSTRACIÓN" }); return; }
    try {
      const r = await fetch(url(`/webhook/stok/api/dashboard?obra_id=${encodeURIComponent(c.obraId)}`));
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      setDatos(d);
      setConexion({ tono: "ok", txt: "EN LÍNEA · " + ahora() });
      if (avisar) aviso("Datos actualizados desde la planilla.");
    } catch {
      setConexion({ tono: "error", txt: "SIN CONEXIÓN CON N8N" });
      if (avisar) aviso("No se pudo leer la planilla. Revisa la dirección en Ajustes.", "error");
    }
  }, [aviso]);

  useEffect(() => {
    if (!sesion) return;
    traer();
    const t = setInterval(() => traer(false), 20000);
    return () => clearInterval(t);
  }, [sesion, cfg.base, cfg.obraId, traer]);

  const llamarAgente = async (cual) => {
    const c = cfgRef.current;
    const nombre = cual === "prediccion" ? "predicción" : "acción";
    if (!c.base) return aviso(`En modo demostración el agente de ${nombre} no se ejecuta.`, "error");
    aviso(`Agente de ${nombre} trabajando…`);
    try {
      const r = await fetch(url(`/webhook/stok/agente/${cual}`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obra_id: c.obraId, disparador: "dashboard" }),
      });
      if (!r.ok) throw new Error(r.status);
      aviso(cual === "prediccion" ? "Predicción recalculada contra la programación de obra." : "Revisión de compras lista. Si había alertas, el correo ya salió.");
      setTimeout(() => traer(false), 1500);
    } catch { aviso(`El agente de ${nombre} no respondió.`, "error"); }
  };

  const guardarMinimo = async (material_id, campo, valor) => {
    setDatos((d) => ({ ...d, materiales: d.materiales.map((m) => (m.material_id === material_id ? { ...m, [campo]: num(valor) } : m)) }));
    const c = cfgRef.current;
    if (!c.base) return;
    const m = datos.materiales.find((x) => x.material_id === material_id);
    try {
      await fetch(url("/webhook/stok/inventario"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obra_id: c.obraId, inventario: [{ ...m, [campo]: num(valor) }] }),
      });
      aviso("Guardado en la planilla.");
    } catch { aviso("No se pudo guardar en la planilla.", "error"); }
  };

  const resolverCompra = async (rec, estado) => {
    setDatos((d) => ({ ...d, recomendaciones: d.recomendaciones.map((r) => (r.rec_id === rec.rec_id ? { ...r, estado } : r)).filter((r) => r.estado !== "descartada") }));
    aviso(estado === "aprobada" ? `Compra aprobada: ${rec.cantidad_sugerida} ${rec.unidad} de ${rec.nombre}.` : `Recomendación descartada: ${rec.nombre}.`);
    const c = cfgRef.current;
    if (!c.base) return;
    try {
      await fetch(url("/webhook/stok/recomendacion"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rec_id: rec.rec_id, estado }),
      });
    } catch { aviso("El estado no se guardó en la planilla.", "error"); }
  };

  const salir = async () => { await supabase.auth.signOut(); setSesion(null); setDatos(null); };

  if (cargando) return (
    <Base><div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ ...F.mono, fontSize: 11, letterSpacing: ".3em", color: C.tenue }}>ABRIENDO BODEGA…</div>
    </div></Base>
  );

  return (
    <Base>
      {!sesion
        ? <Acceso aviso={aviso} />
        : <Panel {...{ sesion, salir, datos, cfg, setCfg, conexion, aviso, traer, llamarAgente, guardarMinimo, resolverCompra, vistas, setVistas }} />}
      <div style={{ position: "fixed", right: 18, bottom: 18, display: "flex", flexDirection: "column", gap: 8, zIndex: 90 }}>
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{ ...F.mono, fontSize: 11, letterSpacing: ".05em", padding: "11px 15px",
            background: C.navy, color: "#fff", borderLeft: `3px solid ${t.tono === "error" ? "#FF7A7A" : C.naranja}`,
            maxWidth: 340, boxShadow: "0 6px 24px rgba(15,27,61,.18)" }}>{t.txt}</div>
        ))}
      </div>
    </Base>
  );
}

const Base = ({ children }) => (
  <div style={{ ...F.ui, background: C.fondo, minHeight: "100vh", color: C.texto, fontWeight: 450 }}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:wght@400..800&display=swap');
      *{box-sizing:border-box} ::selection{background:${C.naranja};color:#fff}
      ::-webkit-scrollbar{width:8px;height:8px} ::-webkit-scrollbar-thumb{background:${C.linea};border-radius:4px}
      input,select,button{font:inherit}
      button:focus-visible,input:focus-visible{outline:2px solid ${C.naranja};outline-offset:2px}
      @keyframes escaneo{0%{top:-8%}70%{top:106%}100%{top:106%}}
      @keyframes entra{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes latido{0%,100%{opacity:1}50%{opacity:.35}}
      .toast{animation:entra .3s ease}
      .fila:hover td{background:${C.suave}}
      .late{animation:latido 1.8s ease-in-out infinite}
      @media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
    `}</style>
    {children}
  </div>
);

/* ============================================================ ACCESO (Supabase) */
function Acceso({ aviso }) {
  const [modo, setModo] = useState("entrar");
  const [f, setF] = useState({ nombre: "", email: "", clave: "" });
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    const email = f.email.trim().toLowerCase();
    if (!email || !f.clave) return aviso("Escribe tu correo y tu clave.", "error");
    if (f.clave.length < 6) return aviso("La clave necesita al menos 6 caracteres.", "error");
    setOcupado(true);
    try {
      if (modo === "crear") {
        if (!f.nombre.trim()) return aviso("Falta tu nombre.", "error");
        const { error } = await supabase.auth.signUp({
          email, password: f.clave, options: { data: { nombre: f.nombre.trim() } },
        });
        if (error) throw error;
        aviso("Cuenta creada. Revisa tu correo si te pedimos confirmarla.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.clave });
        if (error) throw error;
      }
    } catch (e) {
      const m = String(e.message || "");
      if (m.includes("already registered")) aviso("Ya existe una cuenta con ese correo.", "error");
      else if (m.includes("Invalid login")) aviso("Correo o clave incorrectos.", "error");
      else aviso(m || "No se pudo completar la operación.", "error");
    } finally { setOcupado(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: `linear-gradient(180deg,#FFFFFF 0%,${C.fondo} 100%)` }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ position: "relative", background: C.panel, border: `1px solid ${C.linea}`, boxShadow: "0 18px 50px rgba(15,27,61,.08)", padding: "38px 34px 30px", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: "9%", top: "-8%", pointerEvents: "none",
            background: `linear-gradient(180deg,transparent,${C.naranja}2E 50%,transparent)`, animation: "escaneo 4.6s ease-in-out infinite" }} />
          <Marca tam={30} />
          <div style={{ ...F.mono, fontSize: 10, letterSpacing: ".28em", color: C.tenue, textTransform: "uppercase", margin: "10px 0 28px" }}>
            Sala de control · Bodega de obra
          </div>
          {modo === "crear" && <Campo etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Tu nombre" />}
          <Campo etiqueta="Correo" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="tu@correo.cl" />
          <Campo etiqueta="Clave" type="password" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && enviar()} />
          <Boton tono="primario" onClick={enviar} disabled={ocupado} style={{ width: "100%", marginTop: 6, padding: "13px" }}>
            {ocupado ? "Verificando…" : modo === "crear" ? "Crear cuenta y entrar" : "Entrar"}
          </Boton>
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button onClick={() => setModo(modo === "crear" ? "entrar" : "crear")}
              style={{ ...F.mono, fontSize: 10.5, letterSpacing: ".14em", background: "none", border: "none", color: C.tenue, cursor: "pointer", textTransform: "uppercase" }}>
              {modo === "crear" ? "Ya tengo cuenta → entrar" : "Primera vez aquí → crear cuenta"}
            </button>
          </div>
        </div>
        <div style={{ ...F.ui, fontSize: 12, color: C.apagado, marginTop: 14, textAlign: "center", lineHeight: 1.6 }}>
          El inventario vive en la planilla de la obra. Aquí solo se mira y se decide.
        </div>
      </div>
    </div>
  );
}

/* ============================================================ PANEL */
function Panel({ sesion, salir, datos, cfg, setCfg, conexion, aviso, traer, llamarAgente, guardarMinimo, resolverCompra, vistas, setVistas }) {
  const [buscar, setBuscar] = useState("");
  const [fEstado, setFEstado] = useState("todos");
  const [verAjustes, setVerAjustes] = useState(false);

  const d = datos || { materiales: [], movimientos: [], predicciones: [], recomendaciones: [], alertas: [], lectores: [], agentes: {} };
  const preds = useMemo(() => Object.fromEntries(d.predicciones.map((p) => [p.material_id, p])), [d.predicciones]);

  const kpi = useMemo(() => {
    const criticos = d.materiales.filter((m) => estadoDe(m).id === "critico").length;
    const quiebre7 = d.predicciones.filter((p) => num(p.dias_para_quiebre) <= 7).length;
    const pendientes = d.recomendaciones.filter((r) => r.estado === "pendiente");
    return { total: d.materiales.length, criticos, quiebre7, compras: pendientes.length,
      monto: pendientes.reduce((s, r) => s + num(r.costo_estimado), 0),
      sinTag: d.materiales.filter((m) => !m.tag_registrado).length };
  }, [d]);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return d.materiales.filter((m) => {
      if (q && !`${m.nombre} ${m.categoria} ${m.proveedor}`.toLowerCase().includes(q)) return false;
      if (fEstado !== "todos" && estadoDe(m).id !== fEstado) return false;
      return true;
    }).sort((a, b) => {
      const oa = estadoDe(a).id === "critico" ? 0 : estadoDe(a).id === "pronto" ? 1 : 2;
      const ob = estadoDe(b).id === "critico" ? 0 : estadoDe(b).id === "pronto" ? 1 : 2;
      return oa - ob || String(a.nombre).localeCompare(String(b.nombre));
    });
  }, [d.materiales, buscar, fEstado]);

  const alertaViva = d.alertas.find((a) => a.del_dia && !vistas.includes(a.alerta_id));

  return (
    <div>
      {/* ── cabecera ── */}
      <header style={{ background: C.panel, borderBottom: `1px solid ${C.linea}`, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1420, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <Marca />
          <Latido conexion={conexion} />
          <div style={{ flex: 1 }} />
          <AgentePastilla nombre="Captura" activo={d.agentes.captura?.activo} detalle={d.agentes.captura?.ultimo ? `${d.agentes.captura?.lectores ?? 1} lector · ${hora(d.agentes.captura.ultimo)}` : "sin lecturas"} />
          <AgentePastilla nombre="Predicción" activo={d.agentes.prediccion?.activo} detalle={`${d.agentes.prediccion?.total ?? 0} proyecciones hoy`} />
          <AgentePastilla nombre="Acción" activo={d.agentes.accion?.activo} detalle={`${d.agentes.accion?.pendientes ?? 0} compras por decidir`} />
          <div style={{ width: 1, height: 26, background: C.linea }} />
          <div style={{ ...F.ui, fontSize: 13, color: C.tenue }}>{sesion.nombre}</div>
          <Boton tono="sutil" onClick={() => setVerAjustes(true)} titulo="Ajustes">⚙</Boton>
          <Boton tono="sutil" onClick={salir}>Salir</Boton>
        </div>
      </header>

      {/* ── alerta en pantalla ── */}
      {alertaViva && (
        <div style={{ background: C.navy, color: "#fff", borderBottom: `3px solid ${C.naranja}` }}>
          <div style={{ maxWidth: 1420, margin: "0 auto", padding: "13px 22px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span className="late" style={{ width: 9, height: 9, borderRadius: "50%", background: C.naranja, flex: "0 0 auto" }} />
            <div style={{ ...F.mono, fontSize: 9.5, letterSpacing: ".22em", color: C.naranja }}>AGENTE DE ACCIÓN</div>
            <div style={{ ...F.ui, fontSize: 14.5, fontWeight: 500, flex: 1, minWidth: 240 }}>{alertaViva.mensaje}</div>
            {alertaViva.correo_enviado && <div style={{ ...F.mono, fontSize: 9.5, letterSpacing: ".16em", color: "#A9B4CE" }}>CORREO ENVIADO</div>}
            <button onClick={() => setVistas((v) => [...v, alertaViva.alerta_id])}
              style={{ ...F.mono, fontSize: 10, letterSpacing: ".14em", background: "transparent", border: "1px solid rgba(255,255,255,.28)", color: "#fff", padding: "7px 12px", cursor: "pointer" }}>
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1420, margin: "0 auto", padding: "24px 22px 60px" }}>
        {/* ── indicadores ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))", gap: 14, marginBottom: 22 }}>
          <Kpi valor={kpi.total} etiqueta="Materiales con tag" nota={kpi.sinTag ? `${kpi.sinTag} sin tag registrado` : "todos registrados"} />
          <Kpi valor={kpi.criticos} etiqueta="Bajo el mínimo" color={kpi.criticos ? C.rojo : C.verde} nota="ahora mismo en bodega" />
          <Kpi valor={kpi.quiebre7} etiqueta="Quiebran en 7 días" color={kpi.quiebre7 ? C.ambar : C.verde} nota="según la programación" />
          <Kpi valor={kpi.compras} etiqueta="Compras por decidir" color={kpi.compras ? C.naranja : C.verde} nota={kpi.monto ? clp(kpi.monto) + " estimado" : "sin pendientes"} />
        </div>

        {/* ── acciones ── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22, alignItems: "center" }}>
          <Boton onClick={() => traer(true)}>Actualizar ahora</Boton>
          <Boton onClick={() => llamarAgente("prediccion")}>Recalcular predicción</Boton>
          <Boton tono="primario" onClick={() => llamarAgente("accion")}>Revisar compras y avisar</Boton>
          <div style={{ flex: 1 }} />
          {cfg.linkPlanilla && <Enlace href={cfg.linkPlanilla}>Abrir planilla</Enlace>}
          {cfg.linkCarpeta && <Enlace href={cfg.linkCarpeta}>Abrir programación</Enlace>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
          {/* ══ columna izquierda ══ */}
          <section style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.linea}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Subtitulo>Bodega</Subtitulo>
                <div style={{ flex: 1 }} />
                <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar material…"
                  style={{ ...F.ui, fontSize: 13, padding: "7px 10px", border: `1px solid ${C.linea}`, background: C.panel, color: C.navy, outline: "none", width: 190 }}
                  onFocus={(e) => (e.target.style.borderColor = C.naranja)} onBlur={(e) => (e.target.style.borderColor = C.linea)} />
                {[["todos", "Todos"], ["critico", "Bajo mínimo"], ["pronto", "Reponer"], ["ok", "OK"]].map(([v, t]) => (
                  <button key={v} onClick={() => setFEstado(v)} style={{ ...F.mono, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase",
                    padding: "7px 9px", cursor: "pointer", background: fEstado === v ? C.navy : "transparent",
                    color: fEstado === v ? "#fff" : C.tenue, border: `1px solid ${fEstado === v ? C.navy : C.linea}` }}>{t}</button>
                ))}
              </div>

              {d.materiales.length === 0 ? (
                <Vacio titulo="La bodega aún no responde"
                  texto="Configura la dirección de n8n en Ajustes. El inventario se lee solo desde la planilla de la obra." />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                    <thead>
                      <tr style={{ background: C.suave }}>
                        {["Material", "Stock", "Mínimo", "Quiebre", "Estado", "Proveedor"].map((h, i) => (
                          <th key={h} style={{ ...F.mono, fontSize: 9, letterSpacing: ".2em", color: C.tenue, textTransform: "uppercase",
                            textAlign: i === 1 || i === 2 ? "right" : "left", padding: "10px 14px", borderBottom: `1px solid ${C.linea}`, fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((m) => {
                        const e = estadoDe(m); const p = preds[m.material_id];
                        return (
                          <tr key={m.material_id} className="fila">
                            <Td>
                              <div style={{ ...F.ui, fontSize: 13.5, fontWeight: 600, color: C.navy, display: "flex", alignItems: "center", gap: 7 }}>
                                {m.nombre}
                                {!m.tag_registrado && <span title="Sin tag NTAG215 registrado en la planilla" style={{ ...F.mono, fontSize: 8.5, letterSpacing: ".12em", color: C.ambar, border: `1px solid ${C.ambar}55`, padding: "1px 5px" }}>SIN TAG</span>}
                              </div>
                              <div style={{ ...F.mono, fontSize: 9.5, color: C.apagado, marginTop: 2 }}>{m.material_id} · {m.categoria}</div>
                            </Td>
                            <Td der>
                              <span style={{ ...F.mono, fontSize: 15, fontWeight: 600, color: e.color }}>{num(m.stock)}</span>
                              <span style={{ ...F.mono, fontSize: 9.5, color: C.apagado, marginLeft: 4 }}>{m.unidad}</span>
                            </Td>
                            <Td der><Editable valor={num(m.minimo)} onCambio={(v) => guardarMinimo(m.material_id, "minimo", v)} /></Td>
                            <Td>
                              {p ? (
                                <div>
                                  <div style={{ ...F.mono, fontSize: 11.5, color: colorUrgencia(p.urgencia), fontWeight: 600 }}>
                                    {num(p.dias_para_quiebre) === 0 ? "hoy" : `${num(p.dias_para_quiebre)} días`}
                                  </div>
                                  <div style={{ ...F.mono, fontSize: 9, color: C.apagado, marginTop: 1, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.partida}</div>
                                </div>
                              ) : <span style={{ ...F.mono, fontSize: 11, color: C.apagado }}>—</span>}
                            </Td>
                            <Td><Chip color={e.color}>{e.txt}</Chip></Td>
                            <Td><span style={{ ...F.ui, fontSize: 12.5, color: C.tenue }}>{m.proveedor || "—"}</span></Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── predicciones ── */}
            <div style={{ background: C.panel, border: `1px solid ${C.linea}`, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <Subtitulo tam={13}>Proyección de quiebres</Subtitulo>
                <div style={{ flex: 1 }} />
                <div style={{ ...F.mono, fontSize: 9, letterSpacing: ".16em", color: C.apagado }}>CONSUMO RFID × PROGRAMACIÓN DE OBRA</div>
              </div>
              {d.predicciones.length === 0 ? (
                <Vacio compacto titulo="Sin proyecciones todavía" texto="Pulsa «Recalcular predicción»: el agente leerá la programación de obra desde Drive." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14 }}>
                  {d.predicciones.map((p) => {
                    const dias = num(p.dias_para_quiebre);
                    const ancho = Math.max(3, Math.min(100, (dias / 30) * 100));
                    return (
                      <div key={p.material_id} style={{ padding: "11px 0", borderTop: `1px solid ${C.linea}` }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                          <div style={{ ...F.ui, fontSize: 13.5, fontWeight: 600, color: C.navy, flex: 1 }}>{p.nombre}</div>
                          <div style={{ ...F.mono, fontSize: 12, fontWeight: 600, color: colorUrgencia(p.urgencia) }}>
                            {dias === 0 ? "quiebra hoy" : `${dias} días`}
                          </div>
                          <Chip color={colorUrgencia(p.urgencia)}>{String(p.urgencia).toUpperCase()}</Chip>
                        </div>
                        <div style={{ height: 4, background: C.suave, marginBottom: 7 }}>
                          <div style={{ width: `${ancho}%`, height: "100%", background: colorUrgencia(p.urgencia), transition: "width .4s" }} />
                        </div>
                        <div style={{ ...F.ui, fontSize: 12, color: C.tenue, lineHeight: 1.5 }}>{p.razonamiento}</div>
                        <div style={{ ...F.mono, fontSize: 9, color: C.apagado, marginTop: 3 }}>
                          {num(p.consumo_diario).toFixed(2)}/día · {p.partida}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ══ columna derecha ══ */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {/* recomendaciones de compra */}
            <div style={{ background: C.panel, border: `1px solid ${C.linea}`, padding: 18 }}>
              <Subtitulo tam={13}>Compras recomendadas</Subtitulo>
              {d.recomendaciones.length === 0 ? (
                <Vacio compacto titulo="Nada que comprar" texto="Cuando un material caiga bajo el mínimo o esté por quebrar, la recomendación aparece aquí." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                  {d.recomendaciones.map((r) => (
                    <div key={r.rec_id} style={{ border: `1px solid ${C.linea}`, borderLeft: `3px solid ${colorUrgencia(r.prioridad)}`, padding: "12px 13px", background: r.estado === "aprobada" ? "#F4FBF8" : C.panel }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ ...F.ui, fontSize: 13.5, fontWeight: 700, color: C.navy, flex: 1 }}>{r.nombre}</div>
                        <Chip color={colorUrgencia(r.prioridad)}>{String(r.prioridad).toUpperCase()}</Chip>
                      </div>
                      <div style={{ ...F.mono, fontSize: 12.5, color: C.navy, margin: "7px 0 6px" }}>
                        <span style={{ color: C.naranja, fontWeight: 600 }}>{num(r.cantidad_sugerida)} {r.unidad}</span>
                        <span style={{ color: C.apagado }}> · {clp(r.costo_estimado)}</span>
                      </div>
                      <div style={{ ...F.ui, fontSize: 12, color: C.tenue, lineHeight: 1.5, marginBottom: 4 }}>{r.motivo}</div>
                      <div style={{ ...F.mono, fontSize: 9, color: C.apagado, marginBottom: 10 }}>{r.proveedor}</div>
                      {r.estado === "aprobada" ? (
                        <div style={{ ...F.mono, fontSize: 9.5, letterSpacing: ".16em", color: C.verde }}>✓ COMPRA APROBADA</div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Boton tono="primario" onClick={() => resolverCompra(r, "aprobada")} style={{ padding: "7px 11px", fontSize: 9.5 }}>Aprobar compra</Boton>
                          <Boton onClick={() => resolverCompra(r, "descartada")} style={{ padding: "7px 11px", fontSize: 9.5 }}>Descartar</Boton>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* movimientos */}
            <div style={{ background: C.panel, border: `1px solid ${C.linea}`, padding: 18 }}>
              <Subtitulo tam={13}>Movimientos capturados</Subtitulo>
              {d.movimientos.length === 0 ? (
                <Vacio compacto titulo="Sin lecturas todavía" texto="Cada pasada de un material frente al lector aparece aquí en segundos." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto", marginTop: 14 }}>
                  {d.movimientos.map((mv, i) => (
                    <div key={i} style={{ borderLeft: `2px solid ${num(mv.delta) >= 0 ? C.verde : C.ambar}`, paddingLeft: 10 }}>
                      <div style={{ ...F.mono, fontSize: 11.5, color: C.navy }}>
                        <span style={{ color: num(mv.delta) >= 0 ? C.verde : C.ambar, fontWeight: 600 }}>{num(mv.delta) >= 0 ? "+" : ""}{num(mv.delta)}</span>{" "}{mv.nombre}
                      </div>
                      <div style={{ ...F.mono, fontSize: 9, color: C.apagado, marginTop: 1 }}>{hora(mv.ts)} · {mv.direccion} · queda {num(mv.stock)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* lectores vinculados */}
            <div style={{ background: C.panel, border: `1px solid ${C.linea}`, padding: 18 }}>
              <Subtitulo tam={13}>Lectores en obra</Subtitulo>
              {(d.lectores || []).length === 0 ? (
                <Vacio compacto titulo="Ningún lector vinculado" texto="Cada lector lleva un token en su firmware. Sin token válido, el sistema no acepta sus lecturas." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 14 }}>
                  {d.lectores.map((l) => {
                    const min = l.ultimo_latido ? (Date.now() - new Date(l.ultimo_latido)) / 60000 : Infinity;
                    const enLinea = l.activo && min < 10;
                    return (
                      <div key={l.lector_id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span className={enLinea ? "late" : ""} style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 5, flex: "0 0 auto",
                          background: !l.activo ? C.apagado : enLinea ? C.verde : C.ambar }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...F.mono, fontSize: 11.5, color: C.navy, fontWeight: 600 }}>{l.lector_id}</div>
                          <div style={{ ...F.ui, fontSize: 11.5, color: C.tenue }}>{l.descripcion || l.zona}</div>
                          <div style={{ ...F.mono, fontSize: 9, color: C.apagado, marginTop: 2 }}>
                            {!l.activo ? "desactivado en la planilla"
                              : !l.vinculado ? "sin credencial"
                              : l.ultimo_latido ? "último latido " + hora(l.ultimo_latido)
                              : "aún no ha leído"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ ...F.ui, fontSize: 11, color: C.apagado, lineHeight: 1.6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.linea}` }}>
                Para revocar un lector, cambia su token en la pestaña Lectores o ponle <b style={{ color: C.navy }}>activo = no</b>. Deja de escribir al instante.
              </div>
            </div>

            {/* historial de alertas */}
            <div style={{ background: C.panel, border: `1px solid ${C.linea}`, padding: 18 }}>
              <Subtitulo tam={13}>Alertas enviadas</Subtitulo>
              {d.alertas.length === 0 ? (
                <Vacio compacto titulo="Ninguna alerta" texto="El agente de acción avisa por correo y en pantalla, una vez por material y por día." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14, maxHeight: 220, overflowY: "auto" }}>
                  {d.alertas.map((a) => (
                    <div key={a.alerta_id} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.del_dia ? C.rojo : C.linea, flex: "0 0 auto", marginTop: 5 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ ...F.ui, fontSize: 12.5, color: C.navy }}>{a.nombre} <span style={{ color: C.apagado }}>({num(a.stock)}/{num(a.minimo)})</span></div>
                        <div style={{ ...F.mono, fontSize: 9, color: C.apagado }}>{a.fecha} · {a.correo_enviado ? "correo enviado" : "sin correo"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...F.ui, fontSize: 11.5, color: C.apagado, lineHeight: 1.7, padding: "0 4px" }}>
              La planilla de la obra manda. STOK la lee cada 20 segundos, proyecta contra la programación y avisa cuando corresponde. Nadie cuenta a mano.
            </div>
          </aside>
        </div>
      </main>

      {/* ── ajustes ── */}
      {verAjustes && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,61,.45)", display: "grid", placeItems: "center", zIndex: 80, padding: 18 }}
          onClick={(e) => e.target === e.currentTarget && setVerAjustes(false)}>
          <div style={{ background: C.panel, border: `1px solid ${C.linea}`, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto",
            padding: "26px 28px", animation: "entra .25s ease", boxShadow: "0 24px 70px rgba(15,27,61,.25)" }}>
            <Subtitulo>Ajustes</Subtitulo>
            <div style={{ ...F.mono, fontSize: 9.5, letterSpacing: ".2em", color: C.apagado, textTransform: "uppercase", margin: "12px 0 18px" }}>
              Configuración técnica · uso interno del equipo
            </div>
            <Campo etiqueta="Dirección de n8n" value={cfg.base} onChange={(e) => setCfg({ ...cfg, base: e.target.value.trim() })}
              placeholder="https://tunombre.app.n8n.cloud"
              pista="Sin la barra final. De aquí cuelgan la lectura de la planilla, los dos agentes y el registro de compras." />
            <Campo etiqueta="Identificador de obra" value={cfg.obraId} onChange={(e) => setCfg({ ...cfg, obraId: e.target.value })} placeholder="OBRA-001" />
            <Campo etiqueta="Enlace de la planilla (Google Sheets)" value={cfg.linkPlanilla} onChange={(e) => setCfg({ ...cfg, linkPlanilla: e.target.value.trim() })}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              pista="Solo para abrirla desde el botón. Quien la lee es n8n." />
            <Campo etiqueta="Carpeta de programación de obra (Drive)" value={cfg.linkCarpeta} onChange={(e) => setCfg({ ...cfg, linkCarpeta: e.target.value.trim() })}
              placeholder="https://drive.google.com/drive/folders/…"
              pista="El agente de predicción lee de aquí la carta Gantt más reciente." />
            <div style={{ background: C.suave, padding: "12px 14px", ...F.ui, fontSize: 12.5, color: C.tenue, lineHeight: 1.6, margin: "4px 0 18px" }}>
              {cfg.base
                ? <>Conectado. El inventario, las predicciones y las compras llegan solos desde la planilla.</>
                : <><b style={{ color: C.navy }}>Modo demostración.</b> Sin dirección de n8n, la pantalla muestra datos de muestra para que puedas recorrerla.</>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Boton tono="primario" onClick={() => { setVerAjustes(false); traer(true); }}>Listo</Boton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- piezas menores ---------- */
const Latido = ({ conexion }) => {
  const col = conexion.tono === "ok" ? C.verde : conexion.tono === "error" ? C.rojo : C.ambar;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, paddingLeft: 16, borderLeft: `1px solid ${C.linea}` }}>
      <span className={conexion.tono === "ok" ? "late" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: col }} />
      <span style={{ ...F.mono, fontSize: 9, letterSpacing: ".16em", color: C.tenue }}>{conexion.txt}</span>
    </div>
  );
};

const AgentePastilla = ({ nombre, activo, detalle }) => (
  <div title={detalle} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", border: `1px solid ${C.linea}`, background: C.panel }}>
    <span className={activo ? "late" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: activo ? C.verde : C.apagado, flex: "0 0 auto" }} />
    <div>
      <div style={{ ...F.mono, fontSize: 9, letterSpacing: ".14em", color: C.navy, textTransform: "uppercase" }}>{nombre}</div>
      <div style={{ ...F.mono, fontSize: 8.5, color: C.apagado, marginTop: 1 }}>{detalle}</div>
    </div>
  </div>
);

const Kpi = ({ valor, etiqueta, nota, color }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.linea}`, padding: "16px 18px" }}>
    <div style={{ ...F.disp, fontSize: 34, color: color || C.navy, lineHeight: 1 }}>{valor}</div>
    <div style={{ ...F.mono, fontSize: 9, letterSpacing: ".18em", color: C.tenue, textTransform: "uppercase", marginTop: 8 }}>{etiqueta}</div>
    <div style={{ ...F.ui, fontSize: 11.5, color: C.apagado, marginTop: 3 }}>{nota}</div>
  </div>
);

const Chip = ({ children, color }) => (
  <span style={{ ...F.mono, fontSize: 8.5, letterSpacing: ".14em", color, border: `1px solid ${color}44`, background: `${color}0F`, padding: "3px 6px", whiteSpace: "nowrap" }}>{children}</span>
);

const Enlace = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" style={{ ...F.mono, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
    color: C.tenue, textDecoration: "none", borderBottom: `1px solid ${C.linea}`, paddingBottom: 2 }}>{children} ↗</a>
);

const Vacio = ({ titulo, texto, compacto }) => (
  <div style={{ padding: compacto ? "18px 0 4px" : "44px 24px", textAlign: compacto ? "left" : "center" }}>
    <div style={{ ...F.ui, fontSize: 14, fontWeight: 600, color: C.navy }}>{titulo}</div>
    <div style={{ ...F.ui, fontSize: 12.5, color: C.apagado, marginTop: 5, lineHeight: 1.6, maxWidth: 380, margin: compacto ? "5px 0 0" : "5px auto 0" }}>{texto}</div>
  </div>
);

const Td = ({ children, der }) => (
  <td style={{ padding: "10px 14px", borderBottom: `1px solid ${C.linea}`, textAlign: der ? "right" : "left", transition: "background .15s", verticalAlign: "middle" }}>{children}</td>
);

function Editable({ valor, onCambio }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  const commit = () => { setEditando(false); if (String(v) !== String(valor)) onCambio(v); };
  if (editando) return (
    <input autoFocus value={v} type="number" onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setV(valor); setEditando(false); } }}
      style={{ ...F.mono, fontSize: 12.5, width: 70, background: "#FFF7F2", border: `1px solid ${C.naranja}`, color: C.navy, padding: "3px 6px", outline: "none", textAlign: "right" }} />
  );
  return (
    <span onClick={() => setEditando(true)} title="Clic para cambiar el mínimo" style={{ ...F.mono, fontSize: 12.5, color: C.tenue, cursor: "text", borderBottom: "1px dashed transparent" }}
      onMouseEnter={(e) => (e.target.style.borderBottomColor = "#B9C1D6")} onMouseLeave={(e) => (e.target.style.borderBottomColor = "transparent")}>
      {valor}
    </span>
  );
}
