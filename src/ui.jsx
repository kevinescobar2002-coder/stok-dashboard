import { useEffect, useState } from "react";
import { CircleCheck, Radio, TriangleAlert, X } from "lucide-react";

/* ============================================================
   Piezas compartidas del sistema de diseño STOK.
   Los colores salen de las variables --p-* de estilos.css, así
   cada pieza sirve igual en tema claro y oscuro.
   ============================================================ */

/* ---------- formato ---------- */
export const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
export const clp = (n) => "$" + Math.round(num(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/* 24 horas: "14:05" se lee más rápido en obra que "02:05 p. m." */
export const hora = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
};
export const ahora = () => hora(new Date().toISOString());
/* Las fechas llegan de la planilla: a veces ISO, a veces texto ("hoy"). */
export const fechaCorta = (f) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(f || ""))) return f || "";
  return new Date(String(f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });
};

const PLURAL = { unidad: "unidades", saco: "sacos", rollo: "rollos", plancha: "planchas", "galón": "galones", barra: "barras", pallet: "pallets", tira: "tiras", par: "pares" };
export const plural = (n, u = "") => `${num(n)} ${num(n) === 1 || !u ? u : PLURAL[u] || u + "s"}`.trim();

/* ---------- estados ---------- */
export const TONO = {
  crit: { bg: "var(--p-crit-tint)", fg: "var(--p-crit)", dot: "var(--p-crit-bar)" },
  warn: { bg: "var(--p-warn-tint)", fg: "var(--p-warn)", dot: "var(--p-warn-bar)" },
  ok: { bg: "var(--p-ok-tint)", fg: "var(--p-ok)", dot: "var(--p-ok-bar)" },
  neutro: { bg: "var(--p-sunk)", fg: "var(--p-ink2)", dot: "var(--p-muted)" },
};

/* La regla no cambia con el diseño: bajo el mínimo es crítico,
   bajo el 125 % del mínimo hay que reponer pronto. */
export function estadoDe(m) {
  const s = num(m.stock), mn = num(m.minimo);
  if (mn > 0 && s < mn) return { id: "critico", txt: "Bajo mínimo", tono: "crit", rango: 0 };
  if (mn > 0 && s < mn * 1.25) return { id: "pronto", txt: "Reponer pronto", tono: "warn", rango: 1 };
  return { id: "ok", txt: "OK", tono: "ok", rango: 2 };
}
export const tonoUrgencia = (u) => (u === "alta" ? "crit" : u === "media" ? "warn" : "ok");

/* ---------- ancho de pantalla ---------- */
export function useAncho() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}

/* ---------- piezas ---------- */
export const Ico = ({ de: Comp, tam = 16, color = "currentColor", style }) => (
  <Comp size={tam} color={color} aria-hidden="true" style={{ flex: "none", ...style }} />
);

/* Las dos versiones van en el HTML y el CSS muestra la del tema activo:
   así ninguna pantalla tiene que saber en qué tema está. */
export const Logo = ({ alto = 26 }) => (
  <span style={{ display: "flex", flex: "none" }}>
    <img className="solo-claro" src="/logo-marino.png" alt="STOK" height={alto} style={{ height: alto, width: "auto", display: "block" }} />
    <img className="solo-oscuro" src="/logo-blanco.png" alt="STOK" height={alto} style={{ height: alto, width: "auto", display: "block" }} />
  </span>
);

export function Boton({ children, variante = "primario", tam = "md", ancho, icono, className = "", ...props }) {
  const clases = ["btn", `btn--${variante}`, tam !== "md" && `btn--${tam}`, ancho && "btn--ancho", className].filter(Boolean).join(" ");
  return <button type="button" className={clases} {...props}>{icono}{children}</button>;
}

export function Campo({ etiqueta, pista, error, ...props }) {
  return (
    <label className="campo">
      {etiqueta && <span className="campo__etiqueta">{etiqueta}</span>}
      <input className={`campo__input${error ? " campo__input--error" : ""}`} aria-invalid={!!error} {...props} />
      {(error || pista) && <span className={`campo__pista${error ? " campo__pista--error" : ""}`}>{error || pista}</span>}
    </label>
  );
}

export const Chip = ({ tono = "neutro", punto = true, alto = 26, children, style }) => {
  const t = TONO[tono] || TONO.neutro;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: alto, padding: "0 9px", background: t.bg, color: t.fg,
      borderRadius: 2, font: `600 ${alto < 26 ? 12 : 13}px var(--font-body)`, whiteSpace: "nowrap", ...style }}>
      {punto && <span style={{ width: 7, height: 7, borderRadius: 9999, background: t.dot, flex: "none" }} />}
      {children}
    </span>
  );
};

export const Punto = ({ color, tam = 8, pulso, title, style }) => (
  <span title={title} className={pulso ? "pulso" : undefined} style={{ width: tam, height: tam, borderRadius: 9999, background: color, flex: "none", ...style }} />
);

export const Ceja = ({ children, color = "var(--p-ink2)", style }) => (
  <span style={{ font: "400 12px/1 var(--font-mono)", letterSpacing: ".14em", textTransform: "uppercase", color, ...style }}>{children}</span>
);

export const Titulo = ({ children, tam = 22, id, style }) => (
  <h2 id={id} style={{ display: "flex", alignItems: "center", gap: 12, margin: 0, font: `800 ${tam}px/1 var(--font-display)`,
    textTransform: "uppercase", letterSpacing: "-.01em", color: "var(--p-ink)", ...style }}>
    <span style={{ width: 24, height: 3, background: "var(--stok-signal)", flex: "none" }} />{children}
  </h2>
);

export const Vacio = ({ titulo, texto, icono, centrado }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: centrado ? "center" : "flex-start", gap: 6,
    padding: centrado ? "48px 24px" : "4px 0", textAlign: centrado ? "center" : "left" }}>
    {icono && <Ico de={icono} tam={28} color="var(--p-ink2)" style={{ marginBottom: 2 }} />}
    <span style={{ font: `600 ${centrado ? 17 : 16}px var(--font-body)`, color: "var(--p-ink)" }}>{titulo}</span>
    <span style={{ maxWidth: 440, font: "400 14px/1.5 var(--font-body)", color: "var(--p-ink2)", textWrap: "pretty" }}>{texto}</span>
  </div>
);

/* Los avisos van sobre marino en los dos temas: se notan sin gritar. */
const TOAST = {
  ok: { icono: CircleCheck, color: "#6FCF97", borde: "var(--stok-signal)" },
  info: { icono: Radio, color: "var(--stok-signal)", borde: "var(--stok-signal)" },
  alert: { icono: TriangleAlert, color: "#FF8A80", borde: "var(--stok-alert-bar)" },
};
export function Toast({ titulo, mensaje, estado = "ok", cerrar }) {
  const t = TOAST[estado] || TOAST.info;
  return (
    <div role={estado === "alert" ? "alert" : "status"} className="entra"
      style={{ display: "flex", gap: 12, alignItems: "flex-start", width: 360, maxWidth: "100%", padding: 16,
        background: "var(--stok-marino)", border: "1px solid var(--stok-border-dark)", borderLeft: `4px solid ${t.borde}`, borderRadius: 6 }}>
      <Ico de={t.icono} tam={20} color={t.color} style={{ marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 15px/1.3 var(--font-body)", color: "var(--stok-niebla)" }}>{titulo}</div>
        {mensaje && <div style={{ font: "400 14px/1.4 var(--font-body)", color: "var(--stok-mist-2)", marginTop: 2 }}>{mensaje}</div>}
      </div>
      <button type="button" aria-label="Cerrar aviso" onClick={cerrar}
        style={{ background: "none", border: 0, cursor: "pointer", padding: 2, display: "flex" }}>
        <Ico de={X} tam={16} color="var(--stok-mist-2)" />
      </button>
    </div>
  );
}
