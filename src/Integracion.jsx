import { Download, FileJson } from "lucide-react";
import { FUENTES, aEvento, descargar, eventosCSV, fuenteDe } from "./metodologia";
import { Bloque, Boton, Chip, Ico, Metrica, Vacio, fechaHora, hora } from "./ui";

/* ============================================================ INTEGRACIÓN
   Sección 6: STOK habla con cualquier ERP con un solo formato de evento.
   Esta pestaña muestra el estado del conector, quién es dueño de cada
   dato y los eventos tal como los recibe el ERP, listos para descargar
   cuando el conector es por archivo. */

const DUENOS = [
  ["Proveedores, artículos, cuentas de costo", "ERP", "ERP → STOK"],
  ["Órdenes de compra", "ERP", "ERP → STOK"],
  ["Guías de despacho", "SII (DTE)", "SII o proveedor → STOK"],
  ["Lotes, tags y zonas", "STOK", "Solo en STOK"],
  ["Movimientos físicos", "STOK", "STOK → ERP"],
  ["Stock en obra y consumo por partida", "STOK", "STOK → ERP"],
];

export default function Integracion({ d, obra, cargando, movil, aviso }) {
  const eventos = d.movimientos.map((m) => aEvento(m, obra.obraId));
  const i = d.integracion;
  const porFuente = d.movimientos.reduce((acc, m) => { const f = fuenteDe(m); acc[f] = (acc[f] || 0) + 1; return acc; }, {});
  const sello = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

  const bajar = (formato) => {
    if (!eventos.length) return aviso("No hay eventos para descargar", "Aparecen en cuanto el pórtico o el Punto Cero registren movimientos.", "info");
    if (formato === "json") descargar(`stok-eventos-${obra.obraId}-${sello}.json`, JSON.stringify(eventos, null, 2), "application/json");
    else descargar(`stok-eventos-${obra.obraId}-${sello}.csv`, "﻿" + eventosCSV(eventos), "text/csv;charset=utf-8");
    aviso("Eventos descargados", `${eventos.length} eventos en formato ${formato.toUpperCase()}.`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: movil ? 16 : 20 }}>
      <Bloque titulo="Conector ERP" movil={movil}
        bajada={i ? `${i.erp} · ${i.modo === "api" ? "API REST + webhooks" : "archivo programado (CSV)"}` : "Sin conector configurado: los eventos se pueden descargar a mano"}>
        <div style={{ display: "grid", gridTemplateColumns: movil ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12 }}>
          <Metrica etiqueta="ERP" valor={i?.erp || "—"} nota={i ? (i.modo === "api" ? "conexión por API" : "conexión por archivo") : "por configurar"} tono={i ? "ok" : "neutro"} />
          <Metrica etiqueta="Último envío" valor={i?.ultimo_envio ? hora(i.ultimo_envio) : "—"} nota={i?.ultimo_envio ? fechaHora(i.ultimo_envio) : "sin envíos"} />
          <Metrica etiqueta="Eventos por enviar" valor={i ? String(i.pendientes ?? 0) : "—"} tono={i && i.pendientes > 0 ? "warn" : "neutro"}
            nota="se guardan en STOK aunque el ERP esté caído" />
          <Metrica etiqueta="Errores" valor={i ? String(i.errores ?? 0) : "—"} tono={i && i.errores > 0 ? "crit" : "neutro"} nota="cada evento tiene ID único: reenviar no duplica" />
        </div>
      </Bloque>

      <Bloque titulo="Evento estándar" movil={movil} sinRelleno
        bajada="Todas las fuentes producen el mismo registro. Integrar otro ERP es escribir un conector, no cambiar la operación."
        accion={(
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Boton variante="borde" tam="sm" onClick={() => bajar("csv")} icono={<Ico de={Download} />}>CSV</Boton>
            <Boton variante="borde" tam="sm" onClick={() => bajar("json")} icono={<Ico de={FileJson} />}>JSON</Boton>
          </div>
        )}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: movil ? "0 16px 12px" : "0 20px 14px" }}>
          {Object.entries(porFuente).map(([f, n]) => (
            <Chip key={f} tono={f === "MANUAL" ? "warn" : "neutro"} alto={24}>{FUENTES[f] || f} · {n}</Chip>
          ))}
        </div>
        {cargando ? <div className="esqueleto" style={{ height: 120, margin: 20 }} />
          : eventos.length === 0 ? <div style={{ padding: "0 20px 20px" }}><Vacio titulo="Sin eventos todavía" texto="Cada movimiento capturado se convierte aquí en un evento estándar." /></div>
          : (
            <div style={{ overflowX: "auto", borderTop: "1px solid var(--p-line)", maxHeight: 420 }}>
              <table className="tabla" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th scope="col">Fecha y hora</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Artículo</th>
                    <th scope="col" style={{ textAlign: "right" }}>Cantidad</th>
                    <th scope="col">Origen → destino</th>
                    <th scope="col">OC / guía</th>
                    <th scope="col">Fuente</th>
                    <th scope="col">Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((e) => (
                    <tr key={e.event_id}>
                      <td style={{ font: "400 12px var(--font-mono)", whiteSpace: "nowrap" }}>{fechaHora(e.fecha_hora)}</td>
                      <td style={{ font: "600 12px var(--font-mono)" }}>{e.tipo}</td>
                      <td>
                        <div style={{ font: "400 14px/1.3 var(--font-body)" }}>{e.nombre}</div>
                        <div style={{ font: "400 12px var(--font-mono)", color: "var(--p-ink2)" }}>{e.articulo_erp}{e.lote_id ? ` · ${e.lote_id}` : ""}</div>
                      </td>
                      <td style={{ textAlign: "right", font: "600 14px var(--font-mono)", whiteSpace: "nowrap" }}>{e.cantidad} {e.unidad}</td>
                      <td style={{ font: "400 12px/1.35 var(--font-body)", color: "var(--p-ink2)" }}>{e.origen || "—"} → {e.destino || "—"}</td>
                      <td style={{ font: "400 12px var(--font-mono)", color: "var(--p-ink2)" }}>{[e.oc, e.guia].filter(Boolean).join(" · ") || "—"}</td>
                      <td style={{ font: "400 12px var(--font-body)" }}>{FUENTES[e.fuente] || e.fuente}</td>
                      <td>
                        <Chip tono={e.confianza === "CONFIRMADO" ? "ok" : e.confianza === "PARCIAL" ? "warn" : "crit"} alto={22} punto={false}>
                          {e.confianza === "CONFIRMADO" ? "Confirmado" : e.confianza === "PARCIAL" ? "Parcial" : "Sin identificar"}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Bloque>

      <Bloque titulo="Quién es dueño de cada dato" movil={movil} sinRelleno bajada="STOK nunca modifica una OC: solo informa las recepciones.">
        <div style={{ overflowX: "auto", borderTop: "1px solid var(--p-line)" }}>
          <table className="tabla" style={{ minWidth: 520 }}>
            <thead><tr><th scope="col">Dato</th><th scope="col">Sistema maestro</th><th scope="col">Dirección</th></tr></thead>
            <tbody>
              {DUENOS.map(([dato, maestro, dir]) => (
                <tr key={dato}>
                  <td style={{ font: "400 14px/1.3 var(--font-body)" }}>{dato}</td>
                  <td style={{ font: "600 14px var(--font-body)" }}>{maestro}</td>
                  <td style={{ font: "400 14px var(--font-mono)", color: "var(--p-ink2)" }}>{dir}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloque>
    </div>
  );
}
