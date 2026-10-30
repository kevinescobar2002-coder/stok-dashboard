import { useState } from "react";
import { CircleCheck, Clock, FileWarning, TriangleAlert } from "lucide-react";
import { EXCEPCIONES, avanceOC, cruceLinea, estadoOC, venceExcepcion } from "./metodologia";
import { Avance, Bloque, Boton, Chip, Ico, TONO, Vacio, cant, clp, fechaCorta, fechaHora, plural } from "./ui";

/* ============================================================ RECEPCIÓN
   Etapas 1 y 2 del circuito: pre-recepción (lo que va a llegar, leído de
   las OC del ERP) y recepción en el Punto Cero (cruce OC · guía · conteo).
   Las excepciones van aparte porque cada una tiene dueño y plazo. */

const ORDEN_OC = { vencida: 0, riesgo: 1, sin_fecha: 2, agendada: 3, parcial: 3, recibida: 5, cerrada: 6 };

export default function Recepcion({ d, cargando, movil }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: movil ? 16 : 20 }}>
      <AgendaOC ordenes={d.ordenes_compra} cargando={cargando} movil={movil} />
      <Excepciones excepciones={d.excepciones} cargando={cargando} movil={movil} />
      <Recepciones recepciones={d.recepciones} cargando={cargando} movil={movil} />
    </div>
  );
}

/* ---------- pre-recepción: agenda de entregas ---------- */
function AgendaOC({ ordenes, cargando, movil }) {
  const [todas, setTodas] = useState(false);
  if (ordenes === undefined) return (
    <Bloque titulo="Agenda de entregas" movil={movil} bajada="Lo que va a llegar, leído de las órdenes de compra del ERP">
      <Vacio titulo="n8n todavía no envía órdenes de compra" texto="Cuando el flujo agregue «ordenes_compra» a la respuesta, aquí aparece la agenda con las OC vencidas y las que llegan tarde para la programación." />
    </Bloque>
  );
  const lista = [...ordenes].map((o) => ({ o, e: estadoOC(o), a: avanceOC(o) }))
    .sort((x, y) => (ORDEN_OC[x.e.id] ?? 4) - (ORDEN_OC[y.e.id] ?? 4) || String(x.o.fecha_entrega).localeCompare(String(y.o.fecha_entrega)));
  const abiertas = lista.filter((x) => !["recibida", "cerrada"].includes(x.e.id));
  const visibles = todas ? lista : abiertas;
  const vencidas = lista.filter((x) => x.e.id === "vencida").length;
  const riesgo = lista.filter((x) => x.e.id === "riesgo").length;
  const sinFecha = lista.filter((x) => x.e.id === "sin_fecha").length;

  return (
    <Bloque titulo="Agenda de entregas" movil={movil} sinRelleno
      bajada={`${abiertas.length} OC ${abiertas.length === 1 ? "abierta" : "abiertas"} · ${vencidas} ${vencidas === 1 ? "vencida" : "vencidas"} · ${riesgo} con riesgo de quiebre${sinFecha ? ` · ${sinFecha} sin fecha de entrega` : ""}`}
      accion={<Boton variante="borde" tam="sm" onClick={() => setTodas(!todas)}>{todas ? "Solo abiertas" : "Ver también recibidas"}</Boton>}>
      {cargando ? <div className="esqueleto" style={{ height: 140, margin: 20 }} />
        : visibles.length === 0 ? <div style={{ padding: "0 20px 20px" }}><Vacio titulo="Sin OC abiertas" texto="Todo lo pedido ya llegó." /></div>
        : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--p-line)" }}>
            {visibles.map(({ o, e, a }) => (
              <li key={o.oc} style={{ padding: movil ? "14px 16px" : "14px 20px", borderBottom: "1px solid var(--p-line)",
                background: e.id === "vencida" ? "var(--p-crit-row)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ font: "600 16px/1.25 var(--font-body)" }}>{o.proveedor}</div>
                    <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)" }}>
                      {o.oc} · entrega {o.fecha_entrega ? fechaCorta(o.fecha_entrega) : "sin fecha"}{o.fecha_necesidad ? ` · se necesita ${fechaCorta(o.fecha_necesidad)}` : ""}
                    </div>
                  </div>
                  {o.monto !== undefined && <span style={{ font: "600 14px var(--font-body)", color: "var(--p-ink2)" }}>{clp(o.monto)}</span>}
                  <Chip tono={e.tono}>{e.txt}</Chip>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {(o.lineas || []).map((l) => (
                    <div key={`${o.oc}-${l.articulo}`} style={{ display: "grid", gridTemplateColumns: movil ? "minmax(0,1fr) auto" : "minmax(0,1fr) 160px 120px", gap: "4px 12px", alignItems: "center" }}>
                      <span style={{ font: "400 14px/1.3 var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.nombre} <span style={{ font: "400 12px var(--font-mono)", color: "var(--p-ink2)" }}>{l.cuenta_costo}</span>
                      </span>
                      {!movil && <Avance pct={l.cantidad ? l.recibida / l.cantidad : 0} color={l.recibida >= l.cantidad ? "var(--p-ok-bar)" : "var(--p-chart)"} etiqueta={`Recibido de ${l.nombre}`} />}
                      <span style={{ font: "600 12px var(--font-mono)", color: "var(--p-ink2)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {cant(l.recibida)} de {plural(l.cantidad, l.unidad)}
                      </span>
                    </div>
                  ))}
                </div>
                {a.pedido > 0 && a.pct > 0 && a.pct < 1 && (
                  <div style={{ font: "400 12px var(--font-body)", color: "var(--p-ink2)", marginTop: 6 }}>Recepción parcial: {Math.round(a.pct * 100)} % de la OC</div>
                )}
              </li>
            ))}
          </ul>
        )}
      <p style={{ margin: 0, padding: movil ? "12px 16px" : "12px 20px", font: "400 14px/1.5 var(--font-body)", color: "var(--p-ink2)" }}>
        Regla de oro 5: toda OC trae su fecha de entrega comprometida. Sin esa fecha, STOK no puede avisar del atraso.
      </p>
    </Bloque>
  );
}

/* ---------- excepciones: toda diferencia tiene dueño y plazo ---------- */
function Excepciones({ excepciones, cargando, movil }) {
  const [resueltas, setResueltas] = useState(false);
  if (excepciones === undefined) return (
    <Bloque titulo="Excepciones" movil={movil} bajada="Diferencias de la recepción, cada una con responsable y plazo">
      <Vacio titulo="n8n todavía no envía excepciones" texto="Cuando el Punto Cero registre diferencias (guía sin OC, faltantes, dañados…), aparecen aquí con su dueño y su plazo." />
    </Bloque>
  );
  const ahora = Date.now();
  const lista = excepciones.map((e) => ({ e, vence: venceExcepcion(e) }))
    .filter(({ e }) => resueltas || e.estado !== "resuelta")
    .sort((a, b) => (a.e.estado === "resuelta") - (b.e.estado === "resuelta") || a.vence - b.vence);
  const abiertas = excepciones.filter((e) => e.estado !== "resuelta");
  const atrasadas = abiertas.filter((e) => venceExcepcion(e) < ahora).length;

  return (
    <Bloque titulo="Excepciones" movil={movil} sinRelleno
      bajada={`${abiertas.length} ${abiertas.length === 1 ? "abierta" : "abiertas"}${atrasadas ? ` · ${atrasadas} fuera de plazo` : ""} · regla de oro 3: toda diferencia tiene un dueño y un plazo`}
      accion={<Boton variante="borde" tam="sm" onClick={() => setResueltas(!resueltas)}>{resueltas ? "Ocultar resueltas" : "Ver resueltas"}</Boton>}>
      {cargando ? <div className="esqueleto" style={{ height: 100, margin: 20 }} />
        : lista.length === 0 ? <div style={{ padding: "0 20px 20px" }}><Vacio titulo="Sin excepciones abiertas" texto="Todas las recepciones calzaron con su OC y su guía." /></div>
        : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--p-line)" }}>
            {lista.map(({ e, vence }) => {
              const tipo = EXCEPCIONES[e.tipo] || { txt: e.tipo, responsable: e.responsable };
              const resuelta = e.estado === "resuelta", fuera = !resuelta && vence < ahora;
              const horas = Math.round((vence - ahora) / 3600e3);
              return (
                <li key={e.exc_id} style={{ display: "flex", flexWrap: movil ? "wrap" : "nowrap", gap: movil ? "8px 12px" : 12, alignItems: "flex-start", padding: movil ? "12px 16px" : "12px 20px",
                  borderBottom: "1px solid var(--p-line)", opacity: resuelta ? .7 : 1 }}>
                  <Ico de={resuelta ? CircleCheck : fuera ? TriangleAlert : FileWarning} tam={20}
                    color={resuelta ? "var(--p-ok)" : fuera ? "var(--p-crit)" : "var(--p-warn)"} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 16px/1.3 var(--font-body)" }}>{tipo.txt}</div>
                    <div style={{ font: "400 14px/1.45 var(--font-body)", textWrap: "pretty" }}>{e.detalle}</div>
                    <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)", marginTop: 2 }}>
                      {e.exc_id} · {e.responsable || tipo.responsable} · {tipo.accion || ""}
                    </div>
                  </div>
                  <div style={{ textAlign: movil ? "left" : "right", flex: movil ? "1 1 100%" : "none", paddingLeft: movil ? 32 : 0 }}>
                    <Chip tono={resuelta ? "ok" : fuera ? "crit" : "warn"} alto={24}>
                      {resuelta ? "Resuelta" : fuera ? "Fuera de plazo" : horas <= 0 ? "Vence ahora" : `Vence en ${horas} h`}
                    </Chip>
                    <div style={{ font: "400 12px var(--font-mono)", color: "var(--p-ink2)", marginTop: 3 }}>creada {fechaHora(e.creada)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </Bloque>
  );
}

/* ---------- recepciones en el Punto Cero ---------- */
function Recepciones({ recepciones, cargando, movil }) {
  if (recepciones === undefined) return (
    <Bloque titulo="Recepciones en el Punto Cero" movil={movil} bajada="Cruce de tres vías: OC · guía de despacho · conteo">
      <Vacio titulo="n8n todavía no envía recepciones" texto="Cada camión recibido en el Punto Cero aparece aquí con su cruce OC · guía · conteo y el tiempo que tomó." />
    </Bloque>
  );
  return (
    <Bloque titulo="Recepciones en el Punto Cero" movil={movil} sinRelleno
      bajada="Cruce de tres vías: lo que pide la OC, lo que dice la guía y lo que se contó · meta: menos de 5 minutos por camión">
      {cargando ? <div className="esqueleto" style={{ height: 120, margin: 20 }} />
        : recepciones.length === 0 ? <div style={{ padding: "0 20px 20px" }}><Vacio titulo="Sin recepciones todavía" texto="El primer camión que pase por el Punto Cero aparece aquí." /></div>
        : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--p-line)" }}>
            {recepciones.map((r) => {
              const conforme = r.resultado === "conforme";
              const lento = Number(r.duracion_min) >= 5;
              return (
                <li key={r.recepcion_id} style={{ padding: movil ? "14px 16px" : "14px 20px", borderBottom: "1px solid var(--p-line)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ font: "600 16px/1.25 var(--font-body)" }}>{r.proveedor}</div>
                      <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)" }}>
                        {r.recepcion_id} · {r.oc || "sin OC"} · guía {r.guia_folio} · {fechaHora(r.ts)}
                      </div>
                    </div>
                    {r.duracion_min !== undefined && (
                      <span title="Tiempo de recepción" style={{ display: "flex", alignItems: "center", gap: 6, font: "600 14px var(--font-body)", color: lento ? "var(--p-warn)" : "var(--p-ink2)" }}>
                        <Ico de={Clock} tam={14} />{r.duracion_min} min
                      </span>
                    )}
                    <Chip tono={conforme ? "ok" : "warn"}>{conforme ? "Conforme" : "Con diferencia"}</Chip>
                  </div>
                  <div style={{ overflowX: "auto", marginTop: 10 }}>
                    <table className="tabla" style={{ minWidth: 460 }}>
                      <thead>
                        <tr>
                          <th scope="col">Material</th>
                          <th scope="col" style={{ textAlign: "right" }}>OC</th>
                          <th scope="col" style={{ textAlign: "right" }}>Guía</th>
                          <th scope="col" style={{ textAlign: "right" }}>Contado</th>
                          <th scope="col">Cruce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(r.lineas || []).map((l) => {
                          const c = cruceLinea(l, !!r.oc);
                          return (
                            <tr key={`${r.recepcion_id}-${l.articulo}`}>
                              <td style={{ font: "400 14px/1.3 var(--font-body)" }}>{l.nombre}</td>
                              <td style={{ textAlign: "right", font: "400 14px var(--font-mono)" }}>{r.oc ? cant(l.esperado) : "—"}</td>
                              <td style={{ textAlign: "right", font: "400 14px var(--font-mono)" }}>{cant(l.declarado)}</td>
                              <td style={{ textAlign: "right", font: "600 14px var(--font-mono)" }}>{cant(l.contado)} <span style={{ fontWeight: 400, color: "var(--p-ink2)" }}>{l.unidad}</span></td>
                              <td><span style={{ font: "600 14px var(--font-body)", color: c.ok ? "var(--p-ok)" : TONO.warn.fg }}>{c.txt}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ font: "400 12px/1.4 var(--font-body)", color: "var(--p-ink2)", marginTop: 8 }}>
                    Recibió {r.recibido_por || "—"} · zona {r.zona || "—"}{r.tags_origen ? ` · ${r.tags_origen} tags venían del proveedor (N0)` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </Bloque>
  );
}
