import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "./supabase";
import {
  cargarObras, leerObraActiva, fijarObraActiva, guardarObra, rotarCodigo, salirDeObra,
} from "./obras";
import { Acceso, Bienvenida, Aviso, Cargando } from "./Acceso";
import Panel from "./Panel";
import { Toast, ahora, num, plural } from "./ui";
import "./estilos.css";

/* ============================================================
   STOK · SALA DE CONTROL — Bodega de obra
   Cuentas y obras en Supabase · inventario en Google Sheets vía n8n.
   Tres agentes: captura, predicción y acción.

   Cada obra es un espacio cerrado. Se entra con un código de
   invitación y solo se ven los datos de la obra activa.

   Este archivo guarda el estado y habla con Supabase y n8n.
   Lo que se ve está en Acceso.jsx, Panel.jsx y Ajustes.jsx.

   Endpoints del flujo n8n (STOK · Suite automatizada v3):
     GET  /webhook/stok/api/dashboard?obra_id=…   todo lo que pinta la pantalla
     POST /webhook/stok/agente/prediccion         Agente 2
     POST /webhook/stok/agente/accion             Agente 3 (correo + push)
     POST /webhook/stok/inventario                guarda mínimos
     POST /webhook/stok/recomendacion             aprueba / descarta compras
   ============================================================ */

/* El tema se recuerda por navegador; la primera vez sigue al sistema. */
const temaInicial = () => {
  try { const t = localStorage.getItem("stok-tema"); if (t === "claro" || t === "oscuro") return t; } catch { /* sin storage */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
};

/* ============================================================ */
export default function App() {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [obras, setObras] = useState(null);        // null = todavía no se sabe
  const [obraId, setObraId] = useState(null);      // uuid de la obra activa
  const [fallaObras, setFallaObras] = useState(null);
  const [datos, setDatos] = useState(null);
  const [conexion, setConexion] = useState({ estado: "cargando" });
  const [toasts, setToasts] = useState([]);
  const [vistas, setVistas] = useState([]); // alertas ya descartadas en pantalla
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    try { localStorage.setItem("stok-tema", tema); } catch { /* sin storage */ }
    document.body.style.background = tema === "oscuro" ? "#070B2E" : "#F3F4F9";
  }, [tema]);

  /* La obra activa manda: de ella salen la dirección de n8n y el obra_id
     con que se piden los datos. Cambiar de obra cambia todo lo que se ve. */
  const obra = useMemo(() => (obras || []).find((o) => o.id === obraId) || null, [obras, obraId]);
  const obraRef = useRef(null);
  useEffect(() => { obraRef.current = obra; }, [obra]);
  const conexionRef = useRef(conexion);
  useEffect(() => { conexionRef.current = conexion; }, [conexion]);

  /* Avisos: título corto y, si hace falta, una línea de detalle.
     Máximo tres en pantalla para que no tapen la bodega. */
  const aviso = useCallback((titulo, mensaje = "", estado = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, titulo, mensaje, estado }].slice(-3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  /* Trae las obras de la persona y decide cuál queda activa.
     Si la consulta falla guardamos el error en vez de dejar la lista
     vacía: mandar a crear obra a alguien que ya tiene una sería peor. */
  const refrescarObras = useCallback(async (userId, preferida = null) => {
    const { obras: lista, error } = await cargarObras(userId);
    if (error) { setFallaObras(error); return null; }
    setFallaObras(null);
    setObras(lista);

    let elegida = preferida;
    if (!elegida) {
      const { id } = await leerObraActiva(userId);
      elegida = id;
    }
    if (!lista.some((o) => o.id === elegida)) elegida = lista[0]?.id || null;
    setObraId(elegida);
    return lista;
  }, []);

  useEffect(() => {
    const entrar = async (u) => {
      setSesion({ id: u.id, email: u.email, nombre: u.user_metadata?.nombre || u.email });
      await refrescarObras(u.id);
    };
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (u) await entrar(u);
      setCargando(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      const u = s?.user;
      if (!u) { setSesion(null); setObras(null); setObraId(null); setDatos(null); return; }
      await entrar(u);
    });
    return () => sub.subscription.unsubscribe();
  }, [refrescarObras]);

  const cambiarObra = useCallback(async (id) => {
    if (!sesion || id === obraId) return;
    setObraId(id);
    setDatos(null);                 // nunca mostrar datos de la obra anterior
    setVistas([]);
    setConexion({ estado: "cambiando" });
    try { await fijarObraActiva(sesion.id, id); } catch { /* se reintenta al próximo cambio */ }
  }, [sesion, obraId]);

  /* ---- el único origen de datos: la API de n8n ---- */
  const url = (ruta) => (obraRef.current?.base || "").replace(/\/+$/, "") + ruta;

  const traer = useCallback(async (avisar = false) => {
    const o = obraRef.current;
    if (!o) return;
    const pedida = o.id;
    if (!o.base) {
      setDatos(null);
      setConexion({ estado: "sin_n8n" });
      if (avisar) aviso("Falta la dirección de n8n", "Configúrala en Ajustes para leer la planilla de la obra.", "info");
      return;
    }
    try {
      const r = await fetch(url(`/webhook/stok/api/dashboard?obra_id=${encodeURIComponent(o.obraId)}`));
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      /* Si el usuario cambió de obra mientras la respuesta viajaba,
         se descarta: son datos de la obra equivocada. */
      if (obraRef.current?.id !== pedida) return;
      setDatos(d);
      setConexion({ estado: "en_linea", hora: ahora() });
      if (avisar) aviso("Bodega actualizada", `Planilla leída a las ${ahora()} · ${(d.materiales || []).length} materiales.`);
    } catch {
      if (obraRef.current?.id !== pedida) return;
      /* Se conservan los últimos datos: mejor una lectura de hace un rato
         que una pantalla vacía. El aviso del panel dice desde cuándo. */
      setConexion((c) => ({ estado: "sin_conexion", desde: c.estado === "sin_conexion" ? c.desde : ahora() }));
      if (avisar) aviso("No pudimos conectar con n8n", "Revisa la dirección en Ajustes y vuelve a intentar.", "alert");
    }
  }, [aviso]);

  useEffect(() => {
    if (!sesion || !obra) return;
    traer();
    const t = setInterval(() => traer(false), 60000);
    return () => clearInterval(t);
  }, [sesion, obra, traer]);

  /* Sin dirección de n8n no hay a quién llamar: se avisa en vez de fallar. */
  const sinN8n = () => {
    if (obraRef.current?.base) return false;
    aviso("Falta la dirección de n8n", "Configúrala en Ajustes.", "info");
    return true;
  };

  const llamarAgente = async (cual) => {
    const o = obraRef.current;
    const nombre = cual === "prediccion" ? "Predicción" : "Acción";
    if (sinN8n()) return;
    aviso(`Agente de ${nombre} trabajando…`, "", "info");
    try {
      const r = await fetch(url(`/webhook/stok/agente/${cual}`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obra_id: o.obraId, disparador: "dashboard" }),
      });
      if (!r.ok) throw new Error(r.status);
      /* El Agente 3 responde { hay_accion, mensaje }: se muestra tal cual. */
      const j = await r.json().catch(() => ({}));
      aviso(cual === "prediccion" ? "Predicción recalculada" : "Revisión de compras lista",
        cual === "prediccion" ? "Proyectada contra la programación de obra." : j.mensaje || "Si había alertas, el correo ya salió.");
      setTimeout(() => traer(false), 1500);
    } catch { aviso(`El agente de ${nombre} no respondió`, "Revisa que el flujo de n8n esté activo.", "alert"); }
  };

  const guardarMinimo = async (material_id, campo, valor) => {
    const previo = (datos?.materiales || []).find((x) => x.material_id === material_id);
    if (!previo || sinN8n()) return;
    setDatos((d) => ({ ...d, materiales: d.materiales.map((m) => (m.material_id === material_id ? { ...m, [campo]: num(valor) } : m)) }));
    const o = obraRef.current;
    try {
      const r = await fetch(url("/webhook/stok/inventario"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obra_id: o.obraId, inventario: [{ ...previo, [campo]: num(valor) }] }),
      });
      if (!r.ok) throw new Error(r.status);
      aviso("Mínimo actualizado", `${previo.nombre} · mínimo ${num(valor)}. Guardado en la planilla.`);
    } catch {
      /* Volver al valor anterior: dejarlo en pantalla haría creer que se guardó. */
      setDatos((d) => ({ ...d, materiales: d.materiales.map((m) => (m.material_id === material_id ? { ...m, [campo]: num(previo[campo]) } : m)) }));
      aviso("No se pudo guardar en la planilla", `El mínimo de ${previo.nombre} sigue en ${num(previo[campo])}.`, "alert");
    }
  };

  const resolverCompra = async (rec, estado) => {
    /* Sin conexión no se aprueba: la compra quedaría solo en esta pantalla. */
    if (estado === "aprobada" && conexionRef.current.estado === "sin_conexion")
      return aviso("No se puede aprobar sin conexión", "Espera a que vuelva la conexión con n8n.", "alert");
    if (sinN8n()) return;
    const fijar = (e) => setDatos((d) => ({ ...d, recomendaciones: d.recomendaciones.map((r) => (r.rec_id === rec.rec_id ? { ...r, estado: e } : r)) }));
    fijar(estado);
    aviso(estado === "aprobada" ? "Compra aprobada" : "Recomendación descartada",
      estado === "aprobada" ? `${rec.nombre} · ${plural(rec.cantidad_sugerida, rec.unidad)}` : rec.nombre, estado === "aprobada" ? "ok" : "info");
    const o = obraRef.current;
    try {
      const r = await fetch(url("/webhook/stok/recomendacion"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rec_id: rec.rec_id, estado, obra_id: o.obraId }),
      });
      if (!r.ok) throw new Error(r.status);
    } catch {
      /* Igual que con el mínimo: si no se guardó, la tarjeta vuelve a pendiente. */
      fijar(rec.estado);
      aviso("La decisión no se guardó en la planilla", `${rec.nombre} vuelve a quedar pendiente.`, "alert");
    }
  };

  /* Ajustes de la obra: los guarda un botón, no cada tecla. La configuración
     es compartida por todo el equipo, así que no conviene ir escribiéndola sola. */
  const guardarAjustes = async (borrador) => {
    await guardarObra(borrador);
    setObras((lista) => (lista || []).map((o) => (o.id === borrador.id ? { ...o, ...borrador } : o)));
    aviso("Ajustes guardados", `${borrador.nombre} · ${borrador.obraId}`);
  };

  const nuevoCodigo = async () => {
    const c = await rotarCodigo(obraRef.current.id);
    setObras((lista) => (lista || []).map((o) => (o.id === obraRef.current.id ? { ...o, codigo: c } : o)));
    aviso(`Código nuevo: ${c}`, "El anterior ya no sirve para entrar.", "info");
    return c;
  };

  const dejarObra = async () => {
    const { id, nombre } = obraRef.current;
    await salirDeObra(id, sesion.id);
    setDatos(null);
    const lista = (obras || []).filter((o) => o.id !== id);
    setObras(lista);
    setObraId(lista[0]?.id || null);
    if (lista[0]) { try { await fijarObraActiva(sesion.id, lista[0].id); } catch { /* no crítico */ } }
    aviso("Saliste de la obra", nombre, "info");
  };

  const salir = async () => {
    await supabase.auth.signOut();
    setSesion(null); setObras(null); setObraId(null); setDatos(null);
  };

  const contenido = () => {
    if (cargando) return <Cargando texto="Abriendo bodega…" />;
    if (!sesion) return <Acceso aviso={aviso} />;
    if (fallaObras) return (
      <Aviso titulo="No pudimos leer tus obras"
        texto={`${fallaObras} Revisa tu conexión y vuelve a intentar; nada se ha perdido.`}
        accion="Reintentar" onAccion={() => refrescarObras(sesion.id)} salir={salir} />
    );
    if (obras === null) return <Cargando texto="Buscando tus obras…" />;
    if (obras.length === 0 || !obra) return (
      <Bienvenida sesion={sesion} salir={salir} aviso={aviso}
        alEntrar={(nueva) => refrescarObras(sesion.id, nueva.id)} />
    );
    return (
      <Panel {...{ sesion, salir, datos, obra, obras, cambiarObra, conexion, aviso, traer,
        llamarAgente, guardarMinimo, resolverCompra, vistas, setVistas,
        guardarAjustes, nuevoCodigo, dejarObra, tema,
        cambiarTema: () => setTema((t) => (t === "oscuro" ? "claro" : "oscuro")),
        alEntrarAObra: (nueva) => refrescarObras(sesion.id, nueva.id) }} />
    );
  };

  return (
    <div className={`stok tema-${tema}`}>
      {contenido()}
      <div className="avisos" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} titulo={t.titulo} mensaje={t.mensaje} estado={t.estado}
            cerrar={() => setToasts((l) => l.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </div>
  );
}
