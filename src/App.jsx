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
   ============================================================ */

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
    { material_id: "MAT-09", nombre: "Taladro percutor", consumo_diario: 0.07, dias_para_quiebre: 0, urgencia: "alta", partida: "Instalación de tabiquería", razonamiento: "Sin unidades en bodega y la partida de tabiquería parte mañana." },
    { material_id: "MAT-01", nombre: "Cemento 25 kg", consumo_diario: 0.5, dias_para_quiebre: 2, urgencia: "alta", partida: "Radier sector norte", razonamiento: "El radier del sector norte consume 6 sacos en tres días." },
    { material_id: "MAT-06", nombre: "Cable THHN 2,5 mm²", consumo_diario: 0.21, dias_para_quiebre: 9, urgencia: "media", partida: "Canalización eléctrica piso 2", razonamiento: "Consumo estable; la canalización del piso 2 comienza en nueve días." },
    { material_id: "MAT-03", nombre: "Plancha OSB 11 mm", consumo_diario: 0.14, dias_para_quiebre: 14, urgencia: "media", partida: "Encofrado losa", razonamiento: "Reposición programada alcanza si la losa no se adelanta." },
    { material_id: "MAT-05", nombre: "Tubería PVC 110 mm", consumo_diario: 0.07, dias_para_quiebre: 42, urgencia: "baja", partida: "sin partida asociada", razonamiento: "Consumo bajo y sin partida sanitaria en el horizonte." },
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
    if (!o.base) {
      setDatos(MUESTRA); setConexion({ estado: "demo" });
      if (avisar) aviso("Modo demostración", "Ves datos de ejemplo hasta que configures n8n en Ajustes.", "info");
      return;
    }
    const pedida = o.id;
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

  const llamarAgente = async (cual) => {
    const o = obraRef.current;
    const nombre = cual === "prediccion" ? "Predicción" : "Acción";
    if (!o?.base) return aviso(`El agente de ${nombre} no corre en modo demostración`, "Configura la dirección de n8n en Ajustes.", "info");
    aviso(`Agente de ${nombre} trabajando…`, "", "info");
    try {
      const r = await fetch(url(`/webhook/stok/agente/${cual}`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obra_id: o.obraId, disparador: "dashboard" }),
      });
      if (!r.ok) throw new Error(r.status);
      aviso(cual === "prediccion" ? "Predicción recalculada" : "Revisión de compras lista",
        cual === "prediccion" ? "Proyectada contra la programación de obra." : "Si había alertas, el correo ya salió.");
      setTimeout(() => traer(false), 1500);
    } catch { aviso(`El agente de ${nombre} no respondió`, "Revisa que el flujo de n8n esté activo.", "alert"); }
  };

  const guardarMinimo = async (material_id, campo, valor) => {
    const previo = (datos?.materiales || []).find((x) => x.material_id === material_id);
    setDatos((d) => ({ ...d, materiales: d.materiales.map((m) => (m.material_id === material_id ? { ...m, [campo]: num(valor) } : m)) }));
    const o = obraRef.current;
    if (!previo) return;
    if (!o?.base) return aviso("Mínimo actualizado", "Modo demostración: el cambio no se guarda.", "info");
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
    const fijar = (e) => setDatos((d) => ({ ...d, recomendaciones: d.recomendaciones.map((r) => (r.rec_id === rec.rec_id ? { ...r, estado: e } : r)) }));
    fijar(estado);
    aviso(estado === "aprobada" ? "Compra aprobada" : "Recomendación descartada",
      estado === "aprobada" ? `${rec.nombre} · ${plural(rec.cantidad_sugerida, rec.unidad)}` : rec.nombre, estado === "aprobada" ? "ok" : "info");
    const o = obraRef.current;
    if (!o?.base) return;
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
