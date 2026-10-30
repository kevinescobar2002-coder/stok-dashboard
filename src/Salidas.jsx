import { useState } from "react";
import { Camera, ShieldAlert, Wrench } from "lucide-react";
import { esNoAutorizada } from "./metodologia";
import { Bloque, Boton, Chip, Ico, Vacio, fechaCorta, fechaHora, plural } from "./ui";

/* ============================================================ SALIDAS
   Etapas 4 y 5 del circuito. Nada sale sin un responsable y una partida,
   por tres caminos: kit programado (el preferido), retiro por solicitud o
   préstamo de herramienta. Lo que cruza el pórtico sin autorización se
   muestra primero, porque es lo único que pide una acción ya. */

const KIT = {
  programado: { txt: "Programado", tono: "neutro", paso: 0 },
  armado: { txt: "Listo para retirar", tono: "warn", paso: 1 },
  retirado: { txt: "Retirado", tono: "ok", paso: 2 },
  devuelto: { txt: "Cerrado con devolución", tono: "ok", paso: 3 },
};
const PASOS = ["Programado", "Armado", "Retirado", "Devolución"];
/* Primero lo que bodega tiene listo para entregar; después lo que viene. */
const ORDEN_KIT = { armado: 0, programado: 1, retirado: 2, devuelto: 3 };

export function NoAutorizadas({ movimientos, cargando, movil }) {
  const lista = movimientos.filter(esNoAutorizada);
  if (!cargando && lista.length === 0) return null;
  return (
    <Bloque titulo="Salidas no autorizadas" movil={movil} sinRelleno
      bajada="Tags que cruzaron el pórtico sin un retiro que los respalde · regla de oro 2: nada sale sin responsable y partida">
      {cargando ? <div className="esqueleto" style={{ height: 80, margin: 20 }} /> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--p-line)" }}>
          {lista.map((m) => (
            <li key={`${m.ts}|${m.lote_id}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: movil ? "12px 16px" : "12px 20px",
              borderBottom: "1px solid var(--p-line)", background: "var(--p-crit-row)" }}>
              <Ico de={ShieldAlert} tam={20} color="var(--p-crit)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 16px/1.3 var(--font-body)" }}>{m.nombre}</div>
                <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)" }}>
                  {m.lote_id || "sin tag"} · {m.lector || "Pórtico"} · {fechaHora(m.ts)}
                </div>
              </div>
              {m.evidencia && (
                <span title={m.evidencia} style={{ display: "flex", alignItems: "center", gap: 6, font: "600 14px var(--font-body)", color: "var(--p-ink2)" }}>
                  <Ico de={Camera} tam={16} />{movil ? "" : "Con foto"}
                </span>
              )}
              <Chip tono="crit" alto={24}>Revisar</Chip>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}

export function Kits({ kits, cargando, movil }) {
  const [cerrados, setCerrados] = useState(false);
  if (kits === undefined) return (
    <Bloque titulo="Kits" movil={movil} bajada="Material armado según la programación, que sale en un carro o bolsa con tag">
      <Vacio titulo="n8n todavía no envía kits" texto="Cuando bodega arme kits desde la programación semanal (por actividad o por vivienda), aquí se sigue cada uno hasta su devolución." />
    </Bloque>
  );
  const orden = [...kits].sort((a, b) => (ORDEN_KIT[a.estado] ?? 9) - (ORDEN_KIT[b.estado] ?? 9) || String(a.fecha).localeCompare(String(b.fecha)));
  const visibles = cerrados ? orden : orden.filter((k) => k.estado !== "devuelto");
  const listos = kits.filter((k) => k.estado === "armado").length;

  return (
    <Bloque titulo="Kits" movil={movil}
      bajada={`${listos} ${listos === 1 ? "listo" : "listos"} para retirar · el pórtico descuenta la lista completa del kit y lo asigna a su partida`}
      accion={<Boton variante="borde" tam="sm" onClick={() => setCerrados(!cerrados)}>{cerrados ? "Ocultar cerrados" : "Ver cerrados"}</Boton>}>
      {cargando ? <div className="esqueleto" style={{ height: 120 }} />
        : visibles.length === 0 ? <Vacio titulo="Sin kits abiertos" texto="Los kits se generan desde la programación semanal." />
        : (
          <div style={{ display: "grid", gridTemplateColumns: movil ? "minmax(0,1fr)" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {visibles.map((k) => {
              const e = KIT[k.estado] || { txt: k.estado, tono: "neutro", paso: 0 };
              return (
                <article key={k.kit_id} className="tarjeta" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "600 16px/1.25 var(--font-body)" }}>{k.nombre}</div>
                      <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)" }}>
                        {k.kit_id} · {k.tipo === "vivienda" ? "por vivienda" : "por actividad"} · {fechaCorta(k.fecha)}
                      </div>
                    </div>
                    <Chip tono={e.tono} alto={22}>{e.txt}</Chip>
                  </div>
                  <ol aria-label="Avance del kit" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 4, listStyle: "none", margin: 0, padding: 0 }}>
                    {PASOS.map((p, i) => (
                      <li key={p} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ height: 4, borderRadius: 1, background: i <= e.paso ? "var(--stok-signal)" : "var(--p-track)" }} />
                        <span style={{ font: "400 12px var(--font-body)", color: i <= e.paso ? "var(--p-ink)" : "var(--p-ink2)" }}>{p}</span>
                      </li>
                    ))}
                  </ol>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {(k.items || []).map((it) => (
                      <li key={it.nombre} style={{ display: "flex", gap: 8, font: "400 14px/1.35 var(--font-body)" }}>
                        <span style={{ flex: 1, minWidth: 0 }}>{it.nombre}</span>
                        <span style={{ font: "600 14px var(--font-mono)", whiteSpace: "nowrap" }}>{plural(it.cantidad, it.unidad)}</span>
                        {it.devuelto ? <span style={{ font: "400 12px var(--font-mono)", color: "var(--p-ok)", whiteSpace: "nowrap" }}>↩ {it.devuelto}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <div style={{ font: "400 12px/1.4 var(--font-body)", color: "var(--p-ink2)", borderTop: "1px solid var(--p-line)", paddingTop: 8 }}>
                    {k.partida} · {k.responsable}
                  </div>
                </article>
              );
            })}
          </div>
        )}
    </Bloque>
  );
}

export function Prestamos({ prestamos, cargando, movil }) {
  if (prestamos === undefined) return (
    <Bloque titulo="Herramientas prestadas" movil={movil} bajada="Nivel N1: sale a nombre de un responsable y con fecha de devolución">
      <Vacio titulo="n8n todavía no envía préstamos" texto="Cada herramienta con tag N1 que sale por el pórtico queda aquí hasta que vuelve." />
    </Bloque>
  );
  const ahora = Date.now();
  const fuera = prestamos.filter((p) => !p.devuelto);
  const atrasados = fuera.filter((p) => p.devolver_antes && new Date(p.devolver_antes) < ahora);
  const orden = [...fuera].sort((a, b) => new Date(a.devolver_antes) - new Date(b.devolver_antes));

  return (
    <Bloque titulo="Herramientas prestadas" movil={movil} sinRelleno
      bajada={`${fuera.length} fuera de bodega · ${atrasados.length} sin devolver a tiempo · el préstamo se cierra solo al volver por el pórtico`}>
      {cargando ? <div className="esqueleto" style={{ height: 80, margin: 20 }} />
        : orden.length === 0 ? <div style={{ padding: "0 20px 20px" }}><Vacio titulo="Todas las herramientas están en bodega" texto="Nada prestado en este momento." /></div>
        : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--p-line)" }}>
            {orden.map((p) => {
              const tarde = p.devolver_antes && new Date(p.devolver_antes) < ahora;
              return (
                <li key={p.lote_id} style={{ display: "flex", gap: 12, alignItems: "center", padding: movil ? "12px 16px" : "12px 20px", borderBottom: "1px solid var(--p-line)" }}>
                  <Ico de={Wrench} tam={18} color={tarde ? "var(--p-crit)" : "var(--p-ink2)"} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 16px/1.3 var(--font-body)" }}>{p.nombre}</div>
                    <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)" }}>{p.lote_id} · {p.responsable} · salió {fechaHora(p.salida)}</div>
                  </div>
                  <Chip tono={tarde ? "crit" : "neutro"} alto={24}>{tarde ? "Atrasada" : `Vuelve ${fechaHora(p.devolver_antes)}`}</Chip>
                </li>
              );
            })}
          </ul>
        )}
    </Bloque>
  );
}
