import { Punto, TONO, Titulo, clp, estadoDe, hora, num, tonoUrgencia } from "./ui";

/* ============================================================ GRÁFICOS
   Cuatro lecturas rápidas de la bodega, hechas a mano en HTML para no
   sumar una librería. Reglas: barras delgadas que nacen de una línea base,
   colores de estado solo donde el color significa estado, un solo color
   (marino, con la hora actual en naranja) para la serie simple, el valor
   escrito en la punta y el detalle al pasar el mouse. */

const MILLON = 1e6;
const compacto = (v) => (v >= MILLON ? `$${(v / MILLON).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M` : clp(v));

function Tarjeta({ titulo, bajada, children }) {
  return (
    <section className="tarjeta" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Titulo tam={18}>{titulo}</Titulo>
        <span style={{ font: "400 14px/1.4 var(--font-body)", color: "var(--p-ink2)" }}>{bajada}</span>
      </div>
      {children}
    </section>
  );
}

/* Barra horizontal: etiqueta, riel y valor en la punta. El color es del estado. */
function Barras({ filas, escala }) {
  const max = escala || Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div role="list" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {filas.map((f) => (
        <div key={f.clave} role="listitem" title={f.detalle} aria-label={`${f.etiqueta}: ${f.texto}`}
          style={{ display: "grid", gridTemplateColumns: "minmax(96px, 30%) minmax(0,1fr)", gap: 12, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, font: "600 14px/1.25 var(--font-body)", minWidth: 0 }}>
            <Punto color={f.color} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.etiqueta}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ flex: "0 1 auto", width: `${Math.max(f.valor ? 3 : 0, (f.valor / max) * 72)}%`, height: 20, background: f.color,
              borderRadius: "0 4px 4px 0", transition: "width 400ms var(--ease)" }} />
            <span style={{ flex: "none", font: "600 14px/1.2 var(--font-body)", color: "var(--p-ink)", whiteSpace: "nowrap" }}>{f.texto}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 1 · materiales por estado ---------- */
function PorEstado({ materiales }) {
  const grupos = { critico: { n: 0, v: 0 }, pronto: { n: 0, v: 0 }, ok: { n: 0, v: 0 } };
  materiales.forEach((m) => { const g = grupos[estadoDe(m).id]; g.n++; g.v += num(m.stock) * num(m.precio_ref); });
  const filas = [["critico", "Bajo mínimo", "crit"], ["pronto", "Reponer pronto", "warn"], ["ok", "OK", "ok"]].map(([k, etiqueta, tono]) => ({
    clave: k, etiqueta, color: TONO[tono].dot, valor: grupos[k].n,
    texto: `${grupos[k].n} · ${compacto(grupos[k].v)}`,
    detalle: `${etiqueta}: ${grupos[k].n} materiales, ${clp(grupos[k].v)} en bodega`,
  }));
  return (
    <Tarjeta titulo="Materiales por estado" bajada="Cantidad de materiales y valor de su stock en bodega">
      <Barras filas={filas} />
    </Tarjeta>
  );
}

/* ---------- 2 · compras por decidir según prioridad ---------- */
function PorPrioridad({ recomendaciones }) {
  const pend = recomendaciones.filter((r) => r.estado === "pendiente");
  const filas = ["alta", "media", "baja"].map((p) => {
    const de = pend.filter((r) => r.prioridad === p);
    const monto = de.reduce((s, r) => s + num(r.costo_estimado), 0);
    return {
      clave: p, etiqueta: `Prioridad ${p}`, color: TONO[tonoUrgencia(p)].dot, valor: monto,
      texto: `${compacto(monto)} · ${de.length}`, detalle: `Prioridad ${p}: ${de.length} compras por ${clp(monto)}`,
    };
  });
  return (
    <Tarjeta titulo="Compras por decidir" bajada={`${pend.length} pendientes · monto estimado según prioridad`}>
      <Barras filas={filas} />
    </Tarjeta>
  );
}

/* ---------- 3 · lecturas por hora ---------- */
function PorHora({ movimientos }) {
  const conteo = new Map();
  movimientos.forEach((m) => {
    const h = Number(hora(m.ts).slice(0, 2));
    if (!Number.isNaN(h)) conteo.set(h, (conteo.get(h) || 0) + 1);
  });
  const horas = [...conteo.keys()];
  if (!horas.length) return (
    <Tarjeta titulo="Lecturas por hora" bajada="Portal RFID y cámara de visión IA">
      <span style={{ font: "400 14px var(--font-body)", color: "var(--p-ink2)" }}>Sin lecturas todavía.</span>
    </Tarjeta>
  );
  const desde = Math.min(...horas), hasta = Math.max(...horas);
  const actual = Number(hora(movimientos[0].ts).slice(0, 2));
  const serie = Array.from({ length: hasta - desde + 1 }, (_, i) => ({ h: desde + i, n: conteo.get(desde + i) || 0 }));
  const max = Math.max(...serie.map((s) => s.n));
  const pico = serie.find((s) => s.n === max).h;
  const ALTO = 150;

  return (
    <Tarjeta titulo="Lecturas por hora" bajada="Portal RFID y cámara de visión IA · la hora en curso va en naranja">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: ALTO + 22, borderBottom: "1px solid var(--p-line)", paddingTop: 22 }}>
        {serie.map((s) => {
          const ahora = s.h === actual;
          const rotulo = ahora || s.h === pico;
          return (
            <div key={s.h} title={`${String(s.h).padStart(2, "0")}:00 · ${s.n} lecturas`} aria-label={`${s.h} horas: ${s.n} lecturas`}
              style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", position: "relative" }}>
              {rotulo && s.n > 0 && (
                <span style={{ position: "absolute", bottom: `${(s.n / max) * ALTO + 4}px`, font: "600 12px var(--font-body)", color: "var(--p-ink)" }}>{s.n}</span>
              )}
              <span style={{ width: "100%", maxWidth: 24, height: `${(s.n / max) * ALTO}px`, minHeight: s.n ? 2 : 0,
                background: ahora ? "var(--stok-signal)" : "var(--p-chart)", borderRadius: "4px 4px 0 0", transition: "height 400ms var(--ease)" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: -8 }}>
        {serie.map((s) => (
          <span key={s.h} style={{ flex: 1, minWidth: 0, textAlign: "center", font: "400 12px var(--font-mono)", color: "var(--p-ink2)" }}>
            {serie.length > 12 && s.h % 2 ? "" : String(s.h).padStart(2, "0")}
          </span>
        ))}
      </div>
    </Tarjeta>
  );
}

/* ---------- 4 · próximos quiebres ---------- */
function Quiebres({ predicciones }) {
  const proximos = [...predicciones].sort((a, b) => num(a.dias_para_quiebre) - num(b.dias_para_quiebre)).slice(0, 6);
  const filas = proximos.map((p) => {
    const dias = num(p.dias_para_quiebre);
    return {
      clave: p.material_id, etiqueta: p.nombre, color: TONO[tonoUrgencia(p.urgencia)].dot,
      valor: Math.min(30, Math.max(dias, 0.4)), texto: dias === 0 ? "hoy" : `${dias} d`,
      detalle: `${p.nombre}: ${dias === 0 ? "quiebra hoy" : `quiebra en ${dias} días`} · ${p.partida}`,
    };
  });
  return (
    <Tarjeta titulo="Próximos quiebres" bajada="Días hasta quedarse sin stock, según la programación (escala hasta 30 días)">
      {filas.length ? <Barras filas={filas} escala={30} /> : <span style={{ font: "400 14px var(--font-body)", color: "var(--p-ink2)" }}>Sin proyecciones todavía.</span>}
    </Tarjeta>
  );
}

export default function Graficos({ d, movil }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: movil ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: movil ? 16 : 20 }}>
      <PorEstado materiales={d.materiales} />
      <PorPrioridad recomendaciones={d.recomendaciones} />
      <PorHora movimientos={d.movimientos} />
      <Quiebres predicciones={d.predicciones} />
    </div>
  );
}
