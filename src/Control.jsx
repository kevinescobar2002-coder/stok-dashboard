import { Check } from "lucide-react";
import {
  ESCALONES, FRECUENCIA_ABC, REGLAS, TIPOLOGIAS, calcularKPIs, conteoExacto, conteoVencido, escalonDe, textoKPI, tonoKPI,
} from "./metodologia";
import { Bloque, Chip, Ico, Metrica, TONO, Vacio, cant, clp, fechaCorta } from "./ui";

/* ============================================================ CONTROL
   Etapa 6 del circuito y sección 8 de la metodología: los KPIs contra
   su meta, en qué escalón está la obra, el conteo cíclico por ABC y el
   consumo real contra el presupuesto de cada partida. */

export function KPIs({ d, cargando, movil, compacto }) {
  const kpis = calcularKPIs(d);
  const lista = compacto ? kpis.filter((k) => ["captura", "exactitud", "no_autorizadas", "oc_vencidas"].includes(k.id)) : kpis;
  const grilla = (
    <div style={{ display: "grid", gridTemplateColumns: movil ? "repeat(2,minmax(0,1fr))" : `repeat(${compacto ? 4 : 4},minmax(0,1fr))`, gap: 12 }}>
      {lista.map((k) => (
        <Metrica key={k.id} etiqueta={k.nombre} valor={cargando ? "—" : textoKPI(k)} tono={cargando ? "neutro" : tonoKPI(k)}
          nota={compacto ? `meta ${k.meta}` : `${k.como} · meta ${k.meta}`} />
      ))}
    </div>
  );
  if (compacto) return grilla;
  return (
    <Bloque titulo="KPIs de la metodología" movil={movil}
      bajada="Metas iniciales: se ajustan con la línea base de la Fase 0 · «sin datos» significa que n8n aún no envía esa información">
      {grilla}
    </Bloque>
  );
}

export function Escalera({ d, movil }) {
  const { n, declarado } = escalonDe(d);
  const tipologia = d.metodologia?.tipologia;
  return (
    <Bloque titulo="Escalera STOK" movil={movil}
      bajada={`${declarado ? "Escalón declarado en la planilla" : "Escalón deducido de lo que la obra ya usa"} · se sube cuando el anterior cumple sus KPIs 4 semanas seguidas`}
      accion={tipologia ? <Chip tono="neutro" punto={false}>Bodega tipo {tipologia} · {TIPOLOGIAS[tipologia] || ""}</Chip> : null}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: movil ? "minmax(0,1fr)" : "repeat(5,minmax(0,1fr))", gap: 8, alignItems: "end" }}>
        {ESCALONES.map((e) => {
          const hecho = e.n < n, actual = e.n === n;
          return (
            <li key={e.n} aria-current={actual ? "step" : undefined} className="tarjeta"
              style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, minHeight: movil ? 0 : 110 + e.n * 22,
                borderTop: `4px solid ${actual ? "var(--stok-signal)" : hecho ? "var(--p-ok-bar)" : "var(--p-line)"}`,
                background: actual ? "var(--p-signal-tint)" : "var(--p-card)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, font: "600 12px var(--font-mono)", letterSpacing: ".1em", color: "var(--p-ink2)" }}>
                ESCALÓN {e.n}{hecho && <Ico de={Check} tam={14} color="var(--p-ok)" />}{actual && <span style={{ color: "var(--p-signal)" }}>· AQUÍ</span>}
              </span>
              <span style={{ font: "600 16px/1.2 var(--font-body)" }}>{e.nombre}</span>
              <span style={{ font: "400 12px/1.4 var(--font-body)", color: "var(--p-ink2)" }}>{e.que}</span>
              <span style={{ font: "400 12px/1.4 var(--font-body)", color: "var(--p-ink2)", marginTop: "auto" }}>Intervención humana: {e.intervencion.toLowerCase()}</span>
            </li>
          );
        })}
      </ol>
      {d.metodologia?.inicio_piloto && (
        <p style={{ margin: "12px 0 0", font: "400 14px var(--font-body)", color: "var(--p-ink2)" }}>Piloto iniciado el {fechaCorta(d.metodologia.inicio_piloto)}.</p>
      )}
    </Bloque>
  );
}

export function ConteoCiclico({ conteos, cargando, movil }) {
  if (conteos === undefined) return (
    <Bloque titulo="Conteo cíclico" movil={movil} bajada="A cada semana, B cada mes, C cada trimestre">
      <Vacio titulo="n8n todavía no envía conteos" texto="Cuando bodega registre sus conteos físicos, aquí se compara cada uno con el stock de STOK y se marca lo que toca contar." />
    </Bloque>
  );
  const orden = [...conteos].sort((a, b) => conteoVencido(b) - conteoVencido(a) || String(a.clase).localeCompare(String(b.clase)));
  const vencidos = conteos.filter(conteoVencido).length;
  return (
    <Bloque titulo="Conteo cíclico" movil={movil} sinRelleno
      bajada={`A cada ${FRECUENCIA_ABC.A} días, B cada ${FRECUENCIA_ABC.B}, C cada ${FRECUENCIA_ABC.C} · ${vencidos} por contar · un ajuste requiere aprobación del jefe de bodega`}>
      {cargando ? <div className="esqueleto" style={{ height: 100, margin: 20 }} /> : (
        <div style={{ overflowX: "auto", borderTop: "1px solid var(--p-line)" }}>
          <table className="tabla" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Clase</th>
                <th scope="col" style={{ textAlign: "right" }}>STOK</th>
                <th scope="col" style={{ textAlign: "right" }}>Físico</th>
                <th scope="col">Último conteo</th>
              </tr>
            </thead>
            <tbody>
              {orden.map((c) => {
                const exacto = conteoExacto(c), vencido = conteoVencido(c);
                return (
                  <tr key={c.material_id}>
                    <td style={{ font: "600 14px/1.3 var(--font-body)" }}>{c.nombre}</td>
                    <td style={{ font: "600 14px var(--font-mono)" }}>{c.clase}</td>
                    <td style={{ textAlign: "right", font: "400 14px var(--font-mono)" }}>{cant(c.sistema)}</td>
                    <td style={{ textAlign: "right", font: "600 14px var(--font-mono)", color: exacto ? "var(--p-ink)" : TONO.warn.fg }}>{cant(c.fisico)}</td>
                    <td>
                      <Chip tono={vencido ? "warn" : "neutro"} alto={22} punto={vencido}>{vencido ? "Toca contar" : fechaCorta(String(c.ultimo_conteo).slice(0, 10))}</Chip>
                    </td>
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

export function Merma({ partidas, movil }) {
  if (!partidas || !partidas.length) return null;
  const max = Math.max(...partidas.map((p) => Math.max(p.presupuestado, p.real)));
  return (
    <Bloque titulo="Consumo por partida" movil={movil}
      bajada="Consumo real (salidas − devoluciones) contra lo presupuestado · la barra clara es el presupuesto">
      <div role="list" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {partidas.map((p) => {
          const desvio = p.presupuestado ? (p.real - p.presupuestado) / p.presupuestado : 0;
          const tono = desvio <= 0.03 ? "ok" : desvio <= 0.08 ? "warn" : "crit";
          return (
            <div key={p.partida} role="listitem" style={{ display: "grid", gridTemplateColumns: movil ? "minmax(0,1fr)" : "minmax(140px,24%) minmax(0,1fr) 120px", gap: "6px 12px", alignItems: "center" }}>
              <span style={{ font: "600 14px/1.25 var(--font-body)" }}>{p.partida}</span>
              <div style={{ position: "relative", height: 20 }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(p.presupuestado / max) * 100}%`, background: "var(--p-track)", borderRadius: "0 4px 4px 0" }} />
                <span style={{ position: "absolute", left: 0, top: 5, bottom: 5, width: `${(p.real / max) * 100}%`, background: TONO[tono].dot, borderRadius: "0 3px 3px 0" }} />
              </div>
              <span style={{ font: "600 14px var(--font-body)", color: tono === "ok" ? "var(--p-ink)" : TONO[tono].fg, textAlign: movil ? "left" : "right" }}>
                {desvio > 0 ? "+" : desvio < 0 ? "−" : ""}{(Math.abs(desvio) * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })} % · {clp(p.real)}
              </span>
            </div>
          );
        })}
      </div>
    </Bloque>
  );
}

export function Reglas({ movil }) {
  return (
    <Bloque titulo="Reglas de oro" movil={movil}>
      <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gridTemplateColumns: movil ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))", gap: "8px 32px",
        font: "400 16px/1.45 var(--font-body)" }}>
        {REGLAS.map((r) => <li key={r}>{r}</li>)}
      </ol>
    </Bloque>
  );
}
