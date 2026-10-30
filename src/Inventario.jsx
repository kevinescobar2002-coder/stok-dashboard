import { useState } from "react";
import { NIVELES, ORDEN_NIVELES } from "./metodologia";
import { Avance, Bloque, Vacio, cant, plural } from "./ui";

/* ============================================================ INVENTARIO
   No se etiqueta cada material: cada uno tiene su nivel de control
   (sección 4). Acá se ve cuánto de la bodega está en cada nivel y los
   lotes abiertos, con el saldo que va bajando en cada salida parcial. */

/* Materiales por nivel, más los lotes N0: un material se clasifica N1–N4
   en bodega, pero parte de su stock puede haber llegado etiquetado de origen. */
export function Niveles({ materiales, lotes, movil }) {
  const porNivel = Object.fromEntries(ORDEN_NIVELES.map((n) => [n, 0]));
  let sinNivel = 0;
  materiales.forEach((m) => { if (porNivel[m.nivel] !== undefined) porNivel[m.nivel]++; else sinNivel++; });
  porNivel.N0 += (lotes || []).filter((l) => l.nivel === "N0").length;

  return (
    <Bloque titulo="Niveles de control" movil={movil}
      bajada={sinNivel === materiales.length
        ? "La planilla todavía no indica el nivel de cada material: agrega la columna «nivel» (N0 a N4)."
        : `Cada material se controla al nivel que justifica su valor y su riesgo${sinNivel ? ` · ${sinNivel} sin nivel asignado` : ""}`}>
      <div style={{ display: "grid", gridTemplateColumns: movil ? "repeat(2,minmax(0,1fr))" : "repeat(5,minmax(0,1fr))", gap: 12 }}>
        {ORDEN_NIVELES.map((n) => (
          <div key={n} className="tarjeta" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, background: "var(--p-sunk)" }}>
            <span style={{ font: "600 12px var(--font-mono)", letterSpacing: ".1em", color: "var(--p-signal)" }}>{n}</span>
            <span style={{ font: "600 16px/1.2 var(--font-body)" }}>{NIVELES[n].nombre}</span>
            <span style={{ font: "800 28px/1 var(--font-display)" }}>{porNivel[n]}</span>
            <span style={{ font: "400 12px/1.35 var(--font-body)", color: "var(--p-ink2)" }}>{NIVELES[n].unidad}</span>
            <span style={{ font: "400 12px/1.35 var(--font-body)", color: "var(--p-ink2)" }}>Descuenta: {NIVELES[n].descuento.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </Bloque>
  );
}

export function Lotes({ lotes, cargando, movil }) {
  const [nivel, setNivel] = useState("todos");
  if (lotes === undefined) return (
    <Bloque titulo="Lotes abiertos" movil={movil} bajada="Unidades de control con tag y su saldo">
      <Vacio titulo="n8n todavía no envía lotes" texto="Cuando el Punto Cero cree lotes al recibir (pallets, cajas, contenedores, herramientas), aquí se ve el saldo de cada uno." />
    </Bloque>
  );
  const abiertos = lotes.filter((l) => Number(l.saldo) > 0);
  const lista = abiertos.filter((l) => nivel === "todos" || l.nivel === nivel)
    .sort((a, b) => (a.saldo / (a.cantidad_inicial || 1)) - (b.saldo / (b.cantidad_inicial || 1)));
  const fraccionados = abiertos.filter((l) => l.fracciona && Number(l.saldo) < Number(l.cantidad_inicial)).length;

  return (
    <Bloque titulo="Lotes abiertos" movil={movil} sinRelleno
      bajada={`${abiertos.length} lotes con saldo · ${fraccionados} fraccionados · cuando el saldo llega a cero, el tag se recupera`}>
      <div role="tablist" aria-label="Filtrar por nivel" style={{ display: "flex", gap: 8, overflowX: "auto", padding: movil ? "0 16px 12px" : "0 20px 14px" }}>
        {["todos", ...ORDEN_NIVELES].map((k) => {
          const on = nivel === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setNivel(k)}
              style={{ flex: "none", height: 36, padding: "0 12px", borderRadius: 2, cursor: "pointer", font: "600 14px var(--font-body)",
                background: on ? "var(--p-ink)" : "transparent", color: on ? "var(--p-page)" : "var(--p-ink)", border: `1px solid ${on ? "transparent" : "var(--p-line)"}` }}>
              {k === "todos" ? "Todos" : `${k} · ${NIVELES[k].nombre}`}
            </button>
          );
        })}
      </div>
      {cargando ? <div className="esqueleto" style={{ height: 120, margin: 20 }} />
        : lista.length === 0 ? <div style={{ padding: "0 20px 20px" }}><Vacio titulo="Sin lotes en este nivel" texto="Prueba con otro filtro." /></div>
        : (
          <div style={{ overflowX: "auto", borderTop: "1px solid var(--p-line)" }}>
            <table className="tabla" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col">Nivel</th>
                  <th scope="col">Zona</th>
                  <th scope="col" style={{ width: "28%" }}>Saldo</th>
                  <th scope="col">Origen del tag</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => {
                  const pct = Number(l.cantidad_inicial) ? l.saldo / l.cantidad_inicial : 1;
                  return (
                    <tr key={l.lote_id}>
                      <td>
                        <div style={{ font: "600 14px/1.3 var(--font-body)" }}>{l.nombre}</div>
                        <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)" }}>{l.lote_id}{l.oc ? ` · ${l.oc}` : ""}</div>
                      </td>
                      <td style={{ font: "600 14px var(--font-mono)" }}>{l.nivel}</td>
                      <td style={{ font: "400 14px var(--font-mono)" }}>{l.zona || "—"}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, font: "400 12px var(--font-mono)", color: "var(--p-ink2)", marginBottom: 4 }}>
                          <span style={{ color: "var(--p-ink)", fontWeight: 600 }}>{plural(l.saldo, l.unidad)}</span>
                          <span>de {cant(l.cantidad_inicial)}{l.fracciona ? " · fracciona" : ""}</span>
                        </div>
                        <Avance pct={pct} color={pct < 0.25 ? "var(--p-warn-bar)" : "var(--p-chart)"} etiqueta={`Saldo de ${l.nombre}`} />
                      </td>
                      <td style={{ font: "400 14px var(--font-body)", color: "var(--p-ink2)" }}>{l.origen === "proveedor" ? "Proveedor (N0)" : "Punto Cero"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </Bloque>
  );
}
