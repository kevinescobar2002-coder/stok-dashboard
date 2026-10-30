import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, ChartLine, Check, ChevronsUpDown, CircleCheck, CircleX, LogOut, MailCheck, MailX,
  ChevronDown, ChevronUp, Unplug,
  Moon, PackageOpen, Pencil, Plus, Radio, RefreshCw, Search, Send, Settings, Sun, WifiOff,
} from "lucide-react";
import Ajustes from "./Ajustes";
import Graficos from "./Graficos";
import Recepcion from "./Recepcion";
import Integracion from "./Integracion";
import { Lotes, Niveles } from "./Inventario";
import { Kits, NoAutorizadas, Prestamos } from "./Salidas";
import { ConteoCiclico, Escalera, KPIs, Merma, Reglas } from "./Control";
import { FUENTES, esNoAutorizada, estadoOC, fuenteDe, mananaIso, hoyIso, venceExcepcion } from "./metodologia";
import {
  Bloque, Boton, Captura, Ceja, Chip, Ico, Logo, Metrica, Punto, TONO, Vacio,
  cant, clp, estadoDe, fechaCorta, hora, num, plural, tonoUrgencia, useAncho,
} from "./ui";

/* ============================================================ PANEL
   Las pestañas siguen el circuito de la Metodología STOK: lo que llega
   (Recepción), lo que hay (Bodega), lo que sale (Salidas), lo que falta
   (Compras), cómo vamos (Control) y lo que se entrega al ERP (Integración).
   El Resumen junta, en un número por etapa, lo que pide atención hoy. */

const VACIO = { materiales: [], movimientos: [], predicciones: [], recomendaciones: [], alertas: [], lectores: [], agentes: {} };

const PESTANAS = [
  ["resumen", "Resumen"], ["recepcion", "Recepción"], ["bodega", "Bodega"], ["salidas", "Salidas"],
  ["compras", "Compras"], ["control", "Control"], ["integracion", "Integración"],
];
const pestanaInicial = () => {
  try { const p = localStorage.getItem("stok-pestana"); if (PESTANAS.some(([k]) => k === p)) return p; } catch { /* sin storage */ }
  return "resumen";
};
const diasTxt = (d) => (d === 0 ? "Quiebra hoy" : d === 1 ? "1 día" : `${d} días`);

const CONEXION = {
  en_linea: { tono: "ok", txt: (c) => `En línea · ${c.hora}`, corto: "En línea", pulso: true },
  sin_n8n: { tono: "warn", txt: () => "Sin n8n configurado", corto: "Sin n8n" },
  sin_conexion: { tono: "crit", txt: () => "Sin conexión con n8n", corto: "Sin conexión" },
  cargando: { tono: "neutro", txt: () => "Cargando bodega…", corto: "Cargando…" },
  cambiando: { tono: "neutro", txt: () => "Cambiando de obra…", corto: "Cambiando…" },
};

export default function Panel(props) {
  const { sesion, salir, datos, obra, obras, cambiarObra, conexion, traer, llamarAgente, guardarMinimo, resolverCompra,
    vistas, setVistas, aviso, tema, cambiarTema, demo } = props;
  const w = useAncho();
  const movil = w < 760, tablet = w < 1200;
  /* La cabecera completa necesita ~1000 px; bajo eso va la compacta de dos filas. */
  const cabeceraCompacta = w < 1024;
  const oscuro = tema === "oscuro";
  const [buscar, setBuscar] = useState("");
  const [fEstado, setFEstado] = useState("todos");
  const [verAjustes, setVerAjustes] = useState(false);
  const [selector, setSelector] = useState(false);
  const [pestana, setPestana] = useState(pestanaInicial);
  const irA = (p) => {
    setPestana(p);
    try { localStorage.setItem("stok-pestana", p); } catch { /* sin storage */ }
    window.scrollTo({ top: 0 });
  };

  const cargando = !datos && (conexion.estado === "cargando" || conexion.estado === "cambiando");
  const offline = conexion.estado === "sin_conexion";
  /* Sin datos no hay números que mostrar: un 0 verde diría "todo bien". */
  const sinCifras = cargando || !datos;
  const d = { ...VACIO, ...(datos || {}) };
  const admin = obra.rol === "admin";

  const preds = useMemo(() => Object.fromEntries(d.predicciones.map((p) => [p.material_id, p])), [d.predicciones]);
  const conteo = useMemo(() => {
    const c = { todos: d.materiales.length, critico: 0, pronto: 0, ok: 0 };
    d.materiales.forEach((m) => c[estadoDe(m).id]++);
    return c;
  }, [d.materiales]);

  const pendientes = d.recomendaciones.filter((r) => r.estado === "pendiente");
  const monto = pendientes.reduce((s, r) => s + num(r.costo_estimado), 0);
  const quiebre7 = d.predicciones.filter((p) => num(p.dias_para_quiebre) <= 7).length;
  const sinTag = d.materiales.filter((m) => !m.tag_registrado).length;
  const lectoresEnLinea = (d.lectores || []).filter((l) => l.activo && l.ultimo_latido && Date.now() - new Date(l.ultimo_latido) < 10 * 60000).length;
  const sinLectura = "sin lectura";

  /* Hoy en la obra: un número por etapa. null = n8n aún no manda esa lista. */
  const hoy = useMemo(() => {
    const ocs = d.ordenes_compra, exc = d.excepciones, pres = d.prestamos, kits = d.kits;
    const llegan = ocs ? ocs.filter((o) => ["agendada", "parcial", "emitida"].includes(o.estado)
      && [hoyIso(), mananaIso()].includes(String(o.fecha_entrega).slice(0, 10))).length : null;
    const vencidas = ocs ? ocs.filter((o) => estadoOC(o).id === "vencida").length : null;
    const abiertas = exc ? exc.filter((e) => e.estado !== "resuelta") : null;
    const fuera = abiertas ? abiertas.filter((e) => venceExcepcion(e) < Date.now()).length : 0;
    const noAut = d.movimientos.filter(esNoAutorizada).length;
    const atrasados = pres ? pres.filter((p) => !p.devuelto && p.devolver_antes && new Date(p.devolver_antes) < Date.now()).length : null;
    const listos = kits ? kits.filter((k) => k.estado === "armado").length : null;
    return [
      { id: "llegan", etiqueta: "Entregas hoy y mañana", valor: llegan, nota: vencidas ? `${vencidas} OC ${vencidas === 1 ? "vencida" : "vencidas"}` : "según las OC del ERP",
        tono: vencidas ? "crit" : "neutro", pestana: "recepcion" },
      { id: "excepciones", etiqueta: "Excepciones abiertas", valor: abiertas ? abiertas.length : null,
        nota: fuera ? `${fuera} fuera de plazo` : "cada una con dueño y plazo", tono: fuera ? "crit" : abiertas?.length ? "warn" : "ok", pestana: "recepcion" },
      { id: "no_aut", etiqueta: "Salidas no autorizadas", valor: noAut, nota: "cruzaron sin retiro", tono: noAut ? "crit" : "ok", pestana: "salidas" },
      { id: "prestamos", etiqueta: "Herramientas atrasadas", valor: atrasados, nota: "préstamos sin devolver", tono: atrasados ? "warn" : "ok", pestana: "salidas" },
      { id: "kits", etiqueta: "Kits listos", valor: listos, nota: "para retirar por el pórtico", tono: "neutro", pestana: "salidas" },
    ];
  }, [d]);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const dias = (m) => (preds[m.material_id] ? num(preds[m.material_id].dias_para_quiebre) : 99);
    return d.materiales
      .filter((m) => (fEstado === "todos" || estadoDe(m).id === fEstado)
        && (!q || `${m.nombre} ${m.material_id} ${m.categoria} ${m.proveedor}`.toLowerCase().includes(q)))
      .sort((a, b) => estadoDe(a).rango - estadoDe(b).rango || dias(a) - dias(b) || String(a.nombre).localeCompare(String(b.nombre)));
  }, [d.materiales, preds, buscar, fEstado]);

  const alertaViva = !cargando && d.alertas.find((a) => a.del_dia && !vistas.includes(a.alerta_id));
  const cx = CONEXION[conexion.estado] || CONEXION.cargando;
  const cxTono = TONO[cx.tono];

  const agentes = [
    { nombre: "Captura", a: d.agentes.captura,
      meta: d.agentes.captura?.ultimo ? `${num(d.agentes.captura.lectores ?? 1)} ${num(d.agentes.captura.lectores ?? 1) === 1 ? "lector" : "lectores"} · ${hora(d.agentes.captura.ultimo)}` : "sin lecturas" },
    { nombre: "Predicción", a: d.agentes.prediccion, meta: `${num(d.agentes.prediccion?.total)} proyecciones hoy` },
    { nombre: "Acción", a: d.agentes.accion, meta: `${num(d.agentes.accion?.pendientes)} compras por decidir` },
  ].map((x) => ({ ...x, meta: offline ? "sin respuesta" : x.meta,
    dot: offline ? "var(--p-crit-bar)" : x.a?.activo ? "var(--p-ok-bar)" : "var(--p-muted)" }));

  const abrirAjustes = () => { setSelector(false); setVerAjustes(true); };
  const PillConexion = ({ corto }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 10px", borderRadius: 2, background: cxTono.bg,
      color: cxTono.fg, font: `600 ${corto ? 12 : 14}px var(--font-body)`, whiteSpace: "nowrap" }}>
      <Punto color={cxTono.dot} pulso={cx.pulso} />{corto ? cx.corto : cx.txt(conexion)}
    </div>
  );
  const BotonTema = () => (
    <button type="button" className="plano" onClick={cambiarTema} aria-label={oscuro ? "Usar tema claro" : "Usar tema oscuro"}
      title={oscuro ? "Tema claro" : "Tema oscuro"} style={{ width: 44, height: 44, justifyContent: "center" }}>
      <Ico de={oscuro ? Sun : Moon} tam={18} />
    </button>
  );

  return (
    <div>
      {/* ── cabecera ── */}
      {/* En pantallas chicas la cabecera es alta (obra + agentes): se va con el
          scroll y queda fija solo la barra de pestañas. */}
      <header style={{ position: cabeceraCompacta ? "static" : "sticky", top: 0, zIndex: 30, background: "var(--p-card)" }}>
        {!cabeceraCompacta ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, height: 64, padding: "0 24px", maxWidth: 1440, margin: "0 auto" }}>
            <Logo alto={26} />
            <div style={{ width: 1, height: 28, background: "var(--p-line)" }} />
            <SelectorObra {...{ obra, obras, abierto: selector, setAbierto: setSelector, cambiarObra, abrirAjustes }} />
            <PillConexion />
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }} aria-label="Estado de los agentes">
              {agentes.map((a) => (
                <div key={a.nombre} title={`Agente de ${a.nombre}: ${a.meta}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" }}>
                  <Punto color={a.dot} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ font: "600 14px/1.2 var(--font-body)" }}>{a.nombre}</span>
                    {w >= 1360 && <span style={{ font: "400 12px/1.2 var(--font-body)", color: "var(--p-ink2)", whiteSpace: "nowrap" }}>{a.meta}</span>}
                  </span>
                </div>
              ))}
            </div>
            {/* Bajo 1200 px (proyector, notebook chico) la cabecera no cabe entera:
                el nombre se va y "Salir" queda en su ícono. */}
            {!tablet && <div style={{ width: 1, height: 28, background: "var(--p-line)" }} />}
            {!tablet && (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "right" }}>
                <span style={{ font: "600 14px/1.2 var(--font-body)", whiteSpace: "nowrap" }}>{sesion.nombre}</span>
                <span style={{ font: "400 12px/1.2 var(--font-body)", color: "var(--p-ink2)" }}>{admin ? "Administrador" : "Bodeguero"}</span>
              </div>
            )}
            <BotonTema />
            <button type="button" className="plano" onClick={abrirAjustes} aria-label="Ajustes de la obra" title="Ajustes de la obra"
              style={{ width: 44, height: 44, justifyContent: "center", border: "1px solid var(--p-line)" }}>
              <Ico de={Settings} tam={18} />
            </button>
            <button type="button" className="plano" onClick={salir} aria-label="Salir" title="Salir"
              style={{ height: 44, padding: tablet ? 0 : "0 12px", width: tablet ? 44 : undefined, justifyContent: "center", font: "600 14px var(--font-body)", gap: 6 }}>
              <Ico de={LogOut} color="var(--p-ink2)" />{!tablet && "Salir"}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4, height: 56, padding: "0 8px 0 16px" }}>
              <Logo alto={22} />
              <div style={{ flex: 1 }} />
              <PillConexion corto />
              <BotonTema />
              <button type="button" className="plano" onClick={abrirAjustes} aria-label="Ajustes de la obra" style={{ width: 44, height: 44, justifyContent: "center" }}>
                <Ico de={Settings} tam={20} />
              </button>
              <button type="button" className="plano" onClick={salir} aria-label="Salir" style={{ width: 44, height: 44, justifyContent: "center" }}>
                <Ico de={LogOut} tam={20} />
              </button>
            </div>
            <div style={{ padding: "0 16px 10px" }}>
              <SelectorObra movil {...{ obra, obras, abierto: selector, setAbierto: setSelector, cambiarObra, abrirAjustes }}
                detalle={`${obra.obraId} · ${sesion.nombre} · ${admin ? "Administrador" : "Bodeguero"}`} />
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 10px" }} aria-label="Estado de los agentes">
              {agentes.map((a) => (
                <div key={a.nombre} style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid var(--p-line)", borderRadius: 2 }}>
                  <Punto color={a.dot} />
                  <span style={{ font: "600 14px/1.2 var(--font-body)", whiteSpace: "nowrap" }}>{a.nombre}</span>
                  <span style={{ font: "400 12px/1.2 var(--font-body)", color: "var(--p-ink2)", whiteSpace: "nowrap" }}>{a.meta}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </header>
      {/* Pestañas: el circuito de la metodología, de izquierda a derecha. */}
      <nav aria-label="Secciones" style={{ position: "sticky", top: cabeceraCompacta ? 0 : 64, zIndex: 29, background: "var(--p-card)",
        borderTop: "1px solid var(--p-line)", borderBottom: "1px solid var(--p-line)" }}>
          <div role="tablist" style={{ display: "flex", gap: 4, overflowX: "auto", padding: cabeceraCompacta ? "0 8px" : "0 16px", maxWidth: 1440, margin: "0 auto" }}>
            {PESTANAS.map(([k, txt]) => {
              const on = pestana === k;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} className="plano" onClick={() => irA(k)}
                  style={{ flex: "none", height: 44, padding: "0 12px", borderRadius: 0, font: `600 ${movil ? 14 : 15}px var(--font-body)`,
                    color: on ? "var(--p-ink)" : "var(--p-ink2)", borderBottom: `3px solid ${on ? "var(--stok-signal)" : "transparent"}` }}>
                  {txt}
                </button>
              );
            })}
          </div>
      </nav>

      <main style={{ display: "flex", flexDirection: "column", gap: movil ? 16 : 20, padding: movil ? "16px 12px 96px" : "24px 24px 48px", maxWidth: 1440, margin: "0 auto" }}>
        {/* ── aviso de estado: sin n8n o sin conexión ── */}
        {offline && (
          <Aviso tono="crit" icono={WifiOff}
            titulo={`Sin conexión con n8n${conexion.desde ? " desde las " + conexion.desde : ""}`}
            texto={datos ? "Ves la última lectura guardada. Las compras no se pueden aprobar hasta que vuelva la conexión."
              : "No pudimos leer la planilla de la obra. Revisa la dirección en Ajustes y que el flujo de n8n esté activo."}
            accion="Reintentar" onAccion={() => traer(true)} />
        )}
        {conexion.estado === "sin_n8n" && (
          <Aviso tono="warn" icono={Unplug} titulo="Esta obra aún no tiene n8n"
            texto={admin ? "Pega la dirección de n8n en Ajustes y la bodega se lee sola desde la planilla de la obra."
              : "El administrador de la obra debe configurar la dirección de n8n en Ajustes."}
            accion={admin ? "Configurar n8n" : null} onAccion={abrirAjustes} />
        )}

        {pestana === "resumen" && (<>
        {/* ── portada: movimientos capturados ── */}
        <Captura d={d} cargando={cargando} movil={movil} />

        {/* ── alerta del día ── */}
        {alertaViva && (
          <section aria-label="Alerta del día" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 20px",
            padding: movil ? 16 : "16px 24px", background: "var(--p-banner)", borderRadius: 6, borderBottom: "6px solid var(--stok-signal)", color: "#F3F4F9" }}>
            <img src="/mascota-transparente.png" alt="" style={{ width: movil ? 44 : 56, height: "auto", flex: "none" }} />
            <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 6 }}>
              <Ceja color="var(--stok-signal)">Agente de Acción · hoy</Ceja>
              <span style={{ font: `600 ${movil ? 18 : 22}px/1.3 var(--font-body)`, color: "#fff", textWrap: "pretty" }}>{alertaViva.mensaje}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {alertaViva.correo_enviado && (
                <span style={{ display: "flex", alignItems: "center", gap: 8, font: "400 14px var(--font-body)", color: "var(--stok-mist-2)" }}>
                  <Ico de={MailCheck} tam={18} />Correo enviado
                </span>
              )}
              <Boton variante="sobre-marino" onClick={() => setVistas((v) => [...v, alertaViva.alerta_id])}>Entendido</Boton>
            </div>
          </section>
        )}

        {/* ── acciones ── */}
        <section aria-label="Acciones" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px" }}>
          <div style={movil ? { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, width: "100%" } : { display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Boton tam={movil ? "lg" : "md"} ancho={movil} style={movil ? { gridColumn: "1 / -1" } : undefined}
              onClick={() => llamarAgente("accion")} icono={<Ico de={Send} />}>Revisar compras y avisar</Boton>
            <Boton variante="borde" ancho={movil} onClick={() => traer(true)} icono={movil ? null : <Ico de={RefreshCw} />}>{movil ? "Actualizar" : "Actualizar ahora"}</Boton>
            <Boton variante="borde" ancho={movil} onClick={() => llamarAgente("prediccion")} icono={movil ? null : <Ico de={ChartLine} />}>{movil ? "Recalcular" : "Recalcular predicción"}</Boton>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 20, font: "600 14px var(--font-body)" }}>
            {obra.linkPlanilla && <Enlace href={obra.linkPlanilla}>Abrir planilla</Enlace>}
            {obra.linkCarpeta && <Enlace href={obra.linkCarpeta}>Abrir programación</Enlace>}
          </div>
        </section>

        {/* ── hoy en la obra: un número por etapa del circuito, cada uno lleva a su pestaña ── */}
        <section aria-label="Hoy en la obra" style={{ display: "grid", gridTemplateColumns: movil ? "repeat(2,minmax(0,1fr))" : "repeat(5,minmax(0,1fr))", gap: 12 }}>
          {hoy.map((h) => (
            <Metrica key={h.id} etiqueta={h.etiqueta} valor={sinCifras || h.valor === null ? "—" : h.valor} tono={sinCifras || h.valor === null ? "neutro" : h.tono}
              nota={h.valor === null && !sinCifras ? "sin datos de n8n" : h.nota} onClick={() => irA(h.pestana)} />
          ))}
        </section>

        <NoAutorizadas movimientos={d.movimientos} cargando={cargando} movil={movil} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Ceja>KPIs de la metodología</Ceja>
          <KPIs d={d} cargando={cargando} movil={movil} compacto />
        </div>
        </>)}

        {pestana === "recepcion" && <Recepcion d={d} cargando={cargando} movil={movil} />}

        {pestana === "bodega" && (<>
          <Niveles materiales={d.materiales} lotes={d.lotes} movil={movil} />
          <Bloque titulo="Bodega" movil={movil} sinRelleno
            bajada={sinCifras ? sinLectura : `${d.materiales.length} materiales · ${conteo.critico} bajo el mínimo${sinTag ? ` · ${sinTag} sin tag` : ""} · se controla por zona, no por estante`}>
            <Bodega {...{ d, lista, preds, conteo, buscar, setBuscar, fEstado, setFEstado, cargando, movil, tablet, guardarMinimo, aviso }} />
          </Bloque>
          <Lotes lotes={d.lotes} cargando={cargando} movil={movil} />
        </>)}

        {pestana === "salidas" && (<>
          <NoAutorizadas movimientos={d.movimientos} cargando={cargando} movil={movil} />
          <Kits kits={d.kits} cargando={cargando} movil={movil} />
          <Prestamos prestamos={d.prestamos} cargando={cargando} movil={movil} />
          <Bloque titulo="Movimientos" movil={movil}
            bajada={sinCifras ? sinLectura : `${d.movimientos.length} lecturas recientes · cada una con su fuente, su partida y su responsable`}>
            <Movimientos movimientos={d.movimientos} cargando={cargando} />
          </Bloque>
        </>)}

        {pestana === "compras" && (<>
          <Bloque titulo="Compras por decidir" movil={movil}
            bajada={sinCifras ? sinLectura : pendientes.length ? `${pendientes.length} ${pendientes.length === 1 ? "pendiente" : "pendientes"} · ${clp(monto)}` : "sin pendientes"}>
            <Compras recomendaciones={d.recomendaciones} cargando={cargando} movil={movil} resolverCompra={resolverCompra} />
          </Bloque>
          <Bloque titulo="Proyección de quiebres" movil={movil}
            bajada={sinCifras ? sinLectura : `${quiebre7} quiebran en 7 días · ${d.predicciones.length} proyecciones`}>
            <Proyeccion predicciones={d.predicciones} cargando={cargando} />
          </Bloque>
          {cargando ? <div className="esqueleto" style={{ height: 320 }} /> : <Graficos d={d} movil={movil} />}
        </>)}

        {pestana === "control" && (<>
          <KPIs d={d} cargando={cargando} movil={movil} />
          <Escalera d={d} movil={movil} />
          <ConteoCiclico conteos={d.conteos} cargando={cargando} movil={movil} />
          <Merma partidas={d.consumo_partidas} movil={movil} />
          <Bloque titulo="Lectores en obra" movil={movil}
            bajada={sinCifras ? sinLectura : `${lectoresEnLinea} de ${(d.lectores || []).length} en línea`}>
            <Lectores lectores={d.lectores || []} cargando={cargando} />
          </Bloque>
          <Bloque titulo="Alertas enviadas" movil={movil}
            bajada={sinCifras ? sinLectura : `${d.alertas.filter((a) => a.del_dia).length} hoy · ${d.alertas.length} recientes`}>
            <Alertas alertas={d.alertas} cargando={cargando} />
          </Bloque>
          <Reglas movil={movil} />
        </>)}

        {pestana === "integracion" && <Integracion d={d} obra={obra} cargando={cargando} movil={movil} aviso={aviso} />}

        <p style={{ margin: 0, font: "400 14px/1.55 var(--font-body)", color: "var(--p-ink2)", textWrap: "pretty" }}>
          {demo ? "Modo demostración: datos ficticios, nada se guarda. " : ""}El dato nace digital: la persona confirma, no registra. STOK lee la obra cada 60 segundos, proyecta contra la programación y avisa cuando corresponde.
        </p>
      </main>

      {verAjustes && (
        <Ajustes obra={obra} obras={obras || []} cambiarObra={cambiarObra} aviso={aviso} movil={movil} conexion={conexion}
          guardarAjustes={props.guardarAjustes} nuevoCodigo={props.nuevoCodigo}
          dejarObra={props.dejarObra} alEntrarAObra={props.alEntrarAObra} soloUnaObra={(obras || []).length <= 1}
          cerrar={() => { setVerAjustes(false); traer(); }} />
      )}
    </div>
  );
}

/* ============================================================ piezas */

function SelectorObra({ obra, obras, abierto, setAbierto, cambiarObra, abrirAjustes, movil, detalle }) {
  useEffect(() => {
    if (!abierto) return;
    const f = (e) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [abierto, setAbierto]);

  return (
    <div style={{ position: "relative", width: movil ? "100%" : undefined }}>
      <button type="button" className="plano" onClick={() => setAbierto(!abierto)} aria-haspopup="listbox" aria-expanded={abierto}
        title="Cambiar de obra" style={{ gap: 10, width: movil ? "100%" : undefined, minHeight: movil ? 48 : 44, padding: movil ? "6px 12px" : "0 12px",
          border: `1px solid ${abierto ? "var(--stok-signal)" : "var(--p-line)"}`, background: movil ? "var(--p-sunk)" : "transparent", maxWidth: movil ? "none" : 300 }}>
        <span style={{ flex: movil ? 1 : undefined, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ font: `600 ${movil ? 16 : 14}px/1.2 var(--font-body)`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{obra.nombre}</span>
          <span style={{ font: "400 12px/1.2 var(--font-mono)", color: "var(--p-ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {detalle || `${obra.obraId} · ${obra.rol === "admin" ? "administras" : "miembro"}`}
          </span>
        </span>
        <Ico de={ChevronsUpDown} tam={movil ? 18 : 16} color="var(--p-ink2)" />
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div role="listbox" aria-label="Tus obras" className="entra" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: movil ? 0 : undefined,
            width: movil ? undefined : 300, zIndex: 40, background: "var(--p-card)", border: "1px solid var(--p-line)", borderRadius: 6, padding: 6 }}>
            <div style={{ padding: "8px 10px 6px" }}><Ceja style={{ fontSize: 12 }}>Tus obras</Ceja></div>
            {obras.map((o) => (
              <button key={o.id} type="button" role="option" aria-selected={o.id === obra.id} className="plano"
                onClick={() => { setAbierto(false); cambiarObra(o.id); }}
                style={{ width: "100%", gap: 10, minHeight: movil ? 52 : 48, padding: "8px 10px", background: o.id === obra.id ? "var(--p-hover)" : "transparent" }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ font: `600 ${movil ? 16 : 14}px/1.25 var(--font-body)` }}>{o.nombre}</span>
                  <span style={{ font: "400 12px/1.2 var(--font-mono)", color: "var(--p-ink2)" }}>{o.obraId} · {o.rol === "admin" ? "administras" : "miembro"}</span>
                </span>
                {o.id === obra.id && <Ico de={Check} color="var(--p-signal)" />}
              </button>
            ))}
            <div style={{ height: 1, background: "var(--p-line)", margin: "6px 0" }} />
            <button type="button" className="plano" onClick={abrirAjustes} style={{ width: "100%", gap: 10, minHeight: 44, padding: "0 10px", font: "600 14px var(--font-body)" }}>
              <Ico de={Plus} color="var(--p-ink2)" />Unirme a otra obra
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Aviso({ tono, icono, titulo, texto, accion, onAccion, accion2, onAccion2 }) {
  const t = TONO[tono];
  return (
    <div role="status" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "12px 16px", background: t.bg,
      border: `1px solid ${t.dot}`, borderRadius: 6 }}>
      <Ico de={icono} tam={20} color={t.fg} />
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ font: "600 16px/1.3 var(--font-body)" }}>{titulo}</span>
        <span style={{ font: "400 14px/1.45 var(--font-body)", color: "var(--p-ink2)" }}>{texto}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {accion2 && <Boton variante="fantasma" tam="sm" onClick={onAccion2}>{accion2}</Boton>}
        {accion && <Boton variante="borde" tam="sm" onClick={onAccion}>{accion}</Boton>}
      </div>
    </div>
  );
}


const Enlace = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
    {children}<Ico de={ArrowUpRight} tam={14} />
  </a>
);

/* Una obra real trae decenas de proyecciones y compras: se muestran las más
   urgentes (ya vienen ordenadas) y el resto queda a un clic. */
const LIMITE = { proyeccion: 8, compras: 6, bodegaMovil: 3 };
const VerMas = ({ total, visibles, todas, setTodas, que }) => (total <= visibles && !todas ? null : (
  <Boton variante="borde" tam="sm" ancho onClick={() => setTodas(!todas)} style={{ marginTop: 12 }}>
    {todas ? "Ver menos" : `Ver las ${total} ${que}`}
  </Boton>
));

/* ---------- mínimo editable: clic, escribir, Enter guarda, Esc cancela ---------- */
function Minimo({ valor, nombre, onGuardar, aviso, movil }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(String(valor));
  useEffect(() => setV(String(valor)), [valor]);
  const alto = movil ? 44 : 36;

  const guardar = () => {
    setEditando(false);
    if (v === String(valor)) return;
    /* Decimales permitidos: hay mínimos en m2, kg o m3. Vacío no es cero. */
    const n = Number(String(v).replace(",", "."));
    if (!String(v).trim() || !Number.isFinite(n) || n < 0) { setV(String(valor)); return aviso("Mínimo no válido", "Usa un número de 0 o más.", "alert"); }
    onGuardar(n);
  };

  if (editando) return (
    <div>
      <input autoFocus type="number" min="0" step="any" inputMode="decimal" className="minimo__input" aria-label={`Nuevo mínimo de ${nombre}`}
        value={v} onChange={(e) => setV(e.target.value)} onBlur={guardar} style={{ height: alto }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(String(valor)); setEditando(false); } }} />
      {!movil && <div style={{ font: "400 12px var(--font-body)", color: "var(--p-ink2)", marginTop: 4, whiteSpace: "nowrap" }}>Enter guarda · Esc</div>}
    </div>
  );
  return (
    <button type="button" className="minimo" onClick={() => setEditando(true)} title="Editar mínimo"
      aria-label={`Editar mínimo de ${nombre}: ${cant(valor)}`} style={{ height: alto, padding: movil ? "0 12px" : "0 8px" }}>
      {cant(valor)}<Ico de={Pencil} tam={movil ? 14 : 12} color="var(--p-ink2)" />
    </button>
  );
}

const SinTag = () => (
  <span title="Sin tag NTAG215 registrado en la planilla" style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 6px",
    border: "1px dashed var(--p-warn-bar)", color: "var(--p-warn)", borderRadius: 2, font: "500 12px var(--font-mono)", letterSpacing: ".1em", whiteSpace: "nowrap" }}>SIN TAG</span>
);

/* ---------- bodega ---------- */
function Bodega({ d, lista, preds, conteo, buscar, setBuscar, fEstado, setFEstado, cargando, movil, tablet, guardarMinimo, aviso }) {
  const padX = movil ? 16 : 20;
  /* En el celular la lista parte plegada: los más urgentes y el resto a un toque. */
  const [abierta, setAbierta] = useState(false);
  const visibles = movil && !abierta ? lista.slice(0, LIMITE.bodegaMovil) : lista;
  const filtros = [["todos", "Todos", null], ["critico", "Bajo mínimo", "var(--p-crit-bar)"], ["pronto", "Reponer", "var(--p-warn-bar)"], ["ok", "OK", "var(--p-ok-bar)"]];

  const fila = (m) => {
    const e = estadoDe(m), t = TONO[e.tono], p = preds[m.material_id];
    const dias = p ? num(p.dias_para_quiebre) : null;
    return {
      m, e, t, p,
      stockColor: e.id === "ok" ? "var(--p-ink)" : t.fg,
      quiebre: p ? diasTxt(dias) : "—",
      qColor: !p ? "var(--p-ink2)" : dias <= 7 ? "var(--p-crit)" : p.urgencia === "media" ? "var(--p-warn)" : "var(--p-ink)",
      partida: p ? p.partida : "Sin proyección",
      fondo: e.id === "critico" ? "var(--p-crit-row)" : "transparent",
    };
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 16px", padding: padX }}>
        {!cargando && d.materiales.length > 0 && <span style={{ font: "400 14px var(--font-body)", color: "var(--p-ink2)" }}>{lista.length} de {d.materiales.length} materiales</span>}
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 12px", width: movil ? "100%" : 320,
          background: "var(--p-sunk)", border: "1px solid var(--p-line)", borderRadius: 2 }}>
          <Ico de={Search} color="var(--p-ink2)" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar material, ID o proveedor" aria-label="Buscar material"
            style={{ flex: 1, minWidth: 0, height: 40, border: 0, outline: "none", background: "transparent", font: "400 16px var(--font-body)", color: "var(--p-ink)" }} />
        </label>
      </div>
      <div role="tablist" aria-label="Filtrar por estado" style={{ display: "flex", gap: 8, overflowX: "auto", padding: `0 ${padX}px 16px` }}>
        {filtros.map(([k, txt, dot]) => {
          const on = fEstado === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setFEstado(k)}
              style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 14px", borderRadius: 2, cursor: "pointer",
                font: "600 14px var(--font-body)", background: on ? "var(--p-ink)" : "transparent", color: on ? "var(--p-page)" : "var(--p-ink)",
                border: `1px solid ${on ? "transparent" : "var(--p-line)"}` }}>
              {dot && <Punto color={dot} />}{txt}<span style={{ font: "400 12px var(--font-mono)", opacity: .8 }}>{conteo[k]}</span>
            </button>
          );
        })}
      </div>

      {cargando ? (
        <div aria-busy="true" style={{ borderTop: "1px solid var(--p-line)" }}>
          {[180, 140, 200, 160, 120, 190].map((ancho, i) => (
            <div key={i} style={{ display: "flex", gap: 24, alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--p-line)" }}>
              <span className="esqueleto" style={{ width: ancho, height: 12 }} /><span style={{ flex: 1 }} />
              <span className="esqueleto" style={{ width: 60, height: 12 }} /><span className="esqueleto" style={{ width: 90, height: 20 }} />
            </div>
          ))}
        </div>
      ) : d.materiales.length === 0 ? (
        <div style={{ borderTop: "1px solid var(--p-line)" }}>
          <Vacio centrado icono={PackageOpen} titulo="La bodega aún no responde"
            texto="Configura la dirección de n8n en Ajustes. El inventario se lee solo desde la planilla de la obra." />
        </div>
      ) : lista.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 24px", borderTop: "1px solid var(--p-line)", textAlign: "center" }}>
          <span style={{ font: "600 16px var(--font-body)" }}>{buscar.trim() ? `Ningún material coincide con «${buscar.trim()}»` : "Ningún material en este estado"}</span>
          <Boton variante="borde" tam="sm" onClick={() => { setBuscar(""); setFEstado("todos"); }}>Ver todos</Boton>
        </div>
      ) : movil ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--p-line)" }}>
          {visibles.map(fila).map(({ m, e, stockColor, quiebre, qColor, partida, fondo }) => (
            <li key={m.material_id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--p-line)", background: fondo }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ font: "600 16px/1.25 var(--font-body)" }}>{m.nombre}</span>{!m.tag_registrado && <SinTag />}
                  </div>
                  <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)" }}>{m.material_id} · {m.proveedor || m.categoria}{m.nivel ? ` · ${m.nivel}` : ""}{m.zona ? ` · ${m.zona}` : ""}</div>
                </div>
                <Chip tono={e.tono}>{e.txt}</Chip>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto minmax(0,1fr)", gap: 16, alignItems: "end", marginTop: 10 }}>
                <div>
                  <div style={{ font: "400 12px var(--font-body)", color: "var(--p-ink2)" }}>Stock</div>
                  <span style={{ font: "800 28px/1 var(--font-display)", color: stockColor }}>{cant(m.stock)}</span>
                  <span style={{ font: "400 14px var(--font-body)", color: "var(--p-ink2)", marginLeft: 4 }}>{m.unidad}</span>
                </div>
                <div>
                  <div style={{ font: "400 12px var(--font-body)", color: "var(--p-ink2)" }}>Mínimo</div>
                  <Minimo movil valor={num(m.minimo)} nombre={m.nombre} aviso={aviso} onGuardar={(v) => guardarMinimo(m.material_id, "minimo", v)} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "400 12px var(--font-body)", color: "var(--p-ink2)" }}>Quiebre</div>
                  <div style={{ font: "600 16px/1.25 var(--font-body)", color: qColor }}>{quiebre}</div>
                  <div style={{ font: "400 12px/1.3 var(--font-body)", color: "var(--p-ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{partida}</div>
                </div>
              </div>
            </li>
          ))}
          {lista.length > LIMITE.bodegaMovil && (
            <li style={{ padding: 12 }}>
              <Boton variante="borde" ancho onClick={() => setAbierta(!abierta)} icono={<Ico de={abierta ? ChevronUp : ChevronDown} />}>
                {abierta ? "Contraer lista" : `Ver los ${lista.length} materiales`}
              </Boton>
            </li>
          )}
        </ul>
      ) : (
        <>
          <div style={{ maxHeight: 620, overflow: "auto", borderTop: "1px solid var(--p-line)" }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col" style={{ textAlign: "right" }}>Stock</th>
                  <th scope="col" style={{ textAlign: "right" }}>Mínimo</th>
                  <th scope="col">Quiebre</th>
                  <th scope="col">Estado</th>
                  {!tablet && <th scope="col">Proveedor</th>}
                </tr>
              </thead>
              <tbody>
                {lista.map(fila).map(({ m, e, stockColor, quiebre, qColor, partida, fondo }) => (
                  <tr key={m.material_id} style={{ background: fondo }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ font: "600 16px/1.25 var(--font-body)" }}>{m.nombre}</span>{!m.tag_registrado && <SinTag />}
                      </div>
                      <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)", marginTop: 2 }}>{m.material_id} · {m.categoria}{m.nivel ? ` · ${m.nivel}` : ""}{m.zona ? ` · ${m.zona}` : ""}</div>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ font: "800 22px/1 var(--font-display)", color: stockColor }}>{cant(m.stock)}</span>
                      <span style={{ font: "400 14px var(--font-body)", color: "var(--p-ink2)", marginLeft: 4 }}>{m.unidad}</span>
                    </td>
                    <td style={{ textAlign: "right", width: 96, paddingTop: 8, paddingBottom: 8 }}>
                      <Minimo valor={num(m.minimo)} nombre={m.nombre} aviso={aviso} onGuardar={(v) => guardarMinimo(m.material_id, "minimo", v)} />
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ font: "600 14px/1.2 var(--font-body)", color: qColor }}>{quiebre}</div>
                      <div style={{ font: "400 12px/1.35 var(--font-body)", color: "var(--p-ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{partida}</div>
                    </td>
                    <td><Chip tono={e.tono}>{e.txt}</Chip></td>
                    {!tablet && <td style={{ font: "400 14px/1.3 var(--font-body)", color: "var(--p-ink2)" }}>{m.proveedor || "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 20px", font: "400 14px var(--font-body)", color: "var(--p-ink2)", borderTop: "1px solid var(--p-line)" }}>
            Ordenado por urgencia · clic en el mínimo para editarlo
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- proyección de quiebres ---------- */
function Proyeccion({ predicciones, cargando }) {
  const [todas, setTodas] = useState(false);
  const orden = [...predicciones].sort((a, b) => num(a.dias_para_quiebre) - num(b.dias_para_quiebre));
  const visibles = todas ? orden : orden.slice(0, LIMITE.proyeccion);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 16px", marginBottom: 8 }}>
        <span style={{ font: "400 14px var(--font-body)", color: "var(--p-ink2)" }}>Consumo RFID × programación de obra · escala 0–30 días</span>
      </div>
      {cargando ? <div className="esqueleto" style={{ height: 120, marginTop: 12 }} />
        : orden.length === 0 ? (
          <div style={{ paddingTop: 12 }}>
            <Vacio titulo="Sin proyecciones todavía" texto="Pulsa «Recalcular predicción»: el agente leerá la programación de obra desde Drive." />
          </div>
        ) : (<>{visibles.map((p) => {
          const dias = num(p.dias_para_quiebre), t = TONO[tonoUrgencia(p.urgencia)];
          return (
            <div key={p.material_id} style={{ padding: "14px 0", borderTop: "1px solid var(--p-line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 140, font: "600 16px var(--font-body)" }}>{p.nombre}</span>
                <span style={{ font: "800 18px/1 var(--font-display)", color: t.fg, textTransform: "uppercase" }}>{diasTxt(dias)}</span>
                <Chip tono={tonoUrgencia(p.urgencia)} punto={false} alto={22}>Urgencia {p.urgencia}</Chip>
              </div>
              <div style={{ position: "relative", height: 8, margin: "10px 0 8px", background: "var(--p-track)", borderRadius: 1 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${dias === 0 ? 3 : Math.min(100, (dias / 30) * 100)}%`, background: t.dot, borderRadius: 1 }} />
                <div title="7 días" style={{ position: "absolute", left: "23.33%", top: -3, bottom: -3, width: 1, background: "var(--p-ink2)", opacity: .4 }} />
              </div>
              <div style={{ font: "400 14px/1.45 var(--font-body)", textWrap: "pretty" }}>{p.razonamiento}</div>
              <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--p-ink2)", marginTop: 2 }}>
                {num(p.consumo_diario).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/día · {p.partida}
              </div>
            </div>
          );
        })}
        <VerMas total={orden.length} visibles={visibles.length} todas={todas} setTodas={setTodas} que="proyecciones" /></>)}
    </div>
  );
}

/* ---------- compras recomendadas ---------- */
function Compras({ recomendaciones, cargando, movil, resolverCompra }) {
  const [todas, setTodas] = useState(false);
  const PR = { alta: 0, media: 1, baja: 2 };
  const orden = [...recomendaciones].sort((a, b) =>
    (a.estado === "pendiente" ? 0 : 1) - (b.estado === "pendiente" ? 0 : 1) || (PR[a.prioridad] ?? 3) - (PR[b.prioridad] ?? 3));
  const visibles = todas ? orden : orden.slice(0, LIMITE.compras);
  return (
    <div>
      {cargando ? <div className="esqueleto" style={{ height: 150 }} />
        : orden.length === 0 ? <Vacio titulo="Nada que comprar" texto="Cuando un material caiga bajo el mínimo o esté por quebrar, la recomendación aparece aquí." />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibles.map((r) => {
              const t = TONO[tonoUrgencia(r.prioridad)], pendiente = r.estado === "pendiente", aprobada = r.estado === "aprobada";
              return (
                <article key={r.rec_id} style={{ display: "flex", background: pendiente ? "var(--p-card)" : "var(--p-sunk)", border: "1px solid var(--p-line)",
                  opacity: r.estado === "descartada" ? .75 : 1 }}>
                  <div style={{ width: 4, flex: "none", background: pendiente ? t.dot : "var(--p-line)" }} />
                  <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ flex: 1, font: "600 16px/1.25 var(--font-body)" }}>{r.nombre}</span>
                      <Chip tono={tonoUrgencia(r.prioridad)} punto={false} alto={22}>Prioridad {r.prioridad}</Chip>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ font: "800 22px/1 var(--font-display)" }}>{clp(r.costo_estimado)}</span>
                      <span style={{ font: "600 14px var(--font-body)", color: "var(--p-ink2)" }}>{plural(r.cantidad_sugerida, r.unidad)}{r.proveedor ? ` · ${r.proveedor}` : ""}</span>
                    </div>
                    <div style={{ font: "400 14px/1.45 var(--font-body)", textWrap: "pretty" }}>{r.motivo}</div>
                    {pendiente ? (
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        <Boton tam={movil ? "md" : "sm"} onClick={() => resolverCompra(r, "aprobada")}>Aprobar compra</Boton>
                        <Boton variante="fantasma" tam={movil ? "md" : "sm"} onClick={() => resolverCompra(r, "descartada")}>Descartar</Boton>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, font: "600 14px var(--font-body)", color: aprobada ? "var(--p-ok)" : "var(--p-ink2)" }}>
                        <Ico de={aprobada ? CircleCheck : CircleX} />{aprobada ? "Compra aprobada" : "Descartada"}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            <VerMas total={orden.length} visibles={visibles.length} todas={todas} setTodas={setTodas} que="compras" />
          </div>
        )}
    </div>
  );
}

/* ---------- movimientos ----------
   Cada lectura viene de la pestaña Movimientos: la escribe el Agente 1
   cuando un lector RFID autenticado ve pasar un material. */
function Movimientos({ movimientos, cargando }) {
  return (
    <div>
      {cargando ? <div className="esqueleto" style={{ height: 120 }} />
        : movimientos.length === 0 ? <Vacio titulo="Sin lecturas todavía" texto="Cada pasada de un material frente al lector aparece aquí en segundos." />
        : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 340, overflow: "auto" }}>
            {movimientos.map((mv) => {
              const delta = num(mv.delta), entra = delta >= 0;
              return (
                <li key={`${mv.ts}|${mv.nombre}|${mv.delta}`}
                  style={{ display: "grid", gridTemplateColumns: "20px 44px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "9px 4px", borderTop: "1px solid var(--p-line)" }}>
                  <span title="Lector RFID" style={{ display: "flex" }}><Ico de={Radio} tam={16} color="var(--p-ink2)" /></span>
                  <span style={{ font: "600 16px var(--font-mono)", color: entra ? "var(--p-ok)" : "var(--p-ink)", textAlign: "right" }}>{entra ? "+" : "−"}{cant(Math.abs(delta))}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", font: "600 14px/1.3 var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mv.nombre}</span>
                    <span style={{ display: "block", font: "400 12px/1.35 var(--font-body)", color: esNoAutorizada(mv) ? "var(--p-crit)" : "var(--p-ink2)" }}>
                      {[
                        mv.fuente ? FUENTES[fuenteDe(mv)] || mv.fuente : mv.lector || "Lector RFID",
                        String(mv.tipo || "").toUpperCase() === "DEVOLUCION" ? "devolución" : mv.direccion === "entrada" ? "entrada" : "salida",
                        mv.partida, mv.responsable,
                        esNoAutorizada(mv) ? "sin autorización" : `queda ${cant(mv.stock)}`,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span style={{ font: "400 12px var(--font-mono)", color: "var(--p-ink2)" }}>{hora(mv.ts)}</span>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

/* ---------- lectores ---------- */
function Lectores({ lectores, cargando }) {
  return (
    <div>
      {cargando ? <div className="esqueleto" style={{ height: 80 }} />
        : lectores.length === 0 ? <Vacio titulo="Ningún lector vinculado" texto="Cada lector lleva un token en su firmware. Sin token válido, el sistema no acepta sus lecturas." />
        : lectores.map((l) => {
          const min = l.ultimo_latido ? (Date.now() - new Date(l.ultimo_latido)) / 60000 : Infinity;
          const [txt, tono] = !l.activo ? ["Desactivado", "neutro"]
            : l.vinculado === false ? ["Sin credencial", "warn"]
            : min < 10 ? ["En línea", "ok"]
            : ["Sin señal", "warn"];
          const detalle = !l.activo ? "desactivado en la planilla" : l.ultimo_latido ? `latido ${hora(l.ultimo_latido)}` : "aún no ha leído";
          return (
            <div key={l.lector_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--p-line)" }}>
              <Ico de={Radio} tam={18} color="var(--p-ink2)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 14px/1.3 var(--font-mono)" }}>{l.lector_id}</div>
                <div style={{ font: "400 14px/1.35 var(--font-body)", color: "var(--p-ink2)" }}>{l.descripcion || l.zona}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Chip tono={tono} alto={24}>{txt}</Chip>
                <div style={{ font: "400 12px var(--font-mono)", color: "var(--p-ink2)", marginTop: 3 }}>{detalle}</div>
              </div>
            </div>
          );
        })}
      <p style={{ margin: "10px 0 0", paddingTop: 10, borderTop: "1px solid var(--p-line)", font: "400 14px/1.5 var(--font-body)", color: "var(--p-ink2)" }}>
        Para revocar un lector, cambia su token en la pestaña Lectores o ponle <strong style={{ color: "var(--p-ink)" }}>activo = no</strong>. Deja de escribir al instante.
      </p>
    </div>
  );
}

/* ---------- alertas ---------- */
function Alertas({ alertas, cargando }) {
  return (
    <div>
      {cargando ? <div className="esqueleto" style={{ height: 80 }} />
        : alertas.length === 0 ? <Vacio titulo="Ninguna alerta" texto="El agente de Acción avisa por correo y en pantalla, una vez por material y por día." />
        : (
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            {alertas.map((a) => (
              <div key={a.alerta_id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: "1px solid var(--p-line)" }}>
                <Punto color={a.del_dia ? "var(--p-crit-bar)" : "var(--p-muted)"} style={{ marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 14px/1.3 var(--font-body)" }}>
                    {a.nombre} <span style={{ font: "400 14px var(--font-mono)", color: "var(--p-ink2)" }}>({cant(a.stock)}/{cant(a.minimo)})</span>
                  </div>
                  <div style={{ font: "400 12px/1.35 var(--font-body)", color: "var(--p-ink2)" }}>{fechaCorta(a.fecha)} · {a.correo_enviado ? "correo enviado" : "sin correo"}</div>
                </div>
                <span title={a.correo_enviado ? "Correo enviado" : "Sin correo"} style={{ display: "flex" }}>
                  <Ico de={a.correo_enviado ? MailCheck : MailX} color="var(--p-ink2)" />
                </span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
