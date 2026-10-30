/* ============================================================
   Modo demostración: abre el dashboard con ?demo en la URL.

   No toca Supabase ni n8n. Sirve para mostrar la metodología en una
   reunión o para probar pantallas sin una obra conectada. Todos los
   nombres son ficticios; las horas se calculan contra el reloj actual
   para que "hoy", "vencida" y "llega mañana" siempre tengan sentido.
   ============================================================ */

const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const dia = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

export const SESION_DEMO = { id: "demo", email: "demo@stok.cl", nombre: "Usuario demo" };

export const OBRA_DEMO = {
  id: "demo-obra", nombre: "Edificio Demo", obraId: "OBRA-DEMO", codigo: "STOK-DEMO00",
  base: "", linkPlanilla: "", linkCarpeta: "", rol: "admin",
};

const materiales = [
  { material_id: "MAT-001", nombre: "Cemento especial 25 kg", categoria: "Obra gruesa", proveedor: "Cementos Sur", unidad: "saco", stock: 18, minimo: 40, precio_ref: 5200, tag_registrado: true, nivel: "N2", zona: "Bodega-B1", clase: "A" },
  { material_id: "MAT-002", nombre: "Perfil montante 90 mm", categoria: "Tabiquería", proveedor: "Perfiles Andes", unidad: "unidad", stock: 260, minimo: 200, precio_ref: 3900, tag_registrado: true, nivel: "N2", zona: "Acopio-A2", clase: "A" },
  { material_id: "MAT-003", nombre: "Tornillo cabeza lenteja caja 1000", categoria: "Fijaciones", proveedor: "Fijaciones Norte", unidad: "caja", stock: 7, minimo: 8, precio_ref: 14500, tag_registrado: true, nivel: "N3", zona: "Bodega-B3", clase: "B" },
  { material_id: "MAT-004", nombre: "Cable THHN 2,5 mm² rollo 100 m", categoria: "Eléctrico", proveedor: "Eléctrica Central", unidad: "rollo", stock: 12, minimo: 6, precio_ref: 48000, tag_registrado: true, nivel: "N1", zona: "Bodega-B2", clase: "A" },
  { material_id: "MAT-005", nombre: "Plancha yeso-cartón 15 mm", categoria: "Tabiquería", proveedor: "Perfiles Andes", unidad: "plancha", stock: 140, minimo: 120, precio_ref: 8900, tag_registrado: true, nivel: "N2", zona: "Bodega-B1", clase: "A" },
  { material_id: "MAT-006", nombre: "Rotomartillo SDS Plus", categoria: "Herramientas", proveedor: "Herramientas Pro", unidad: "unidad", stock: 4, minimo: 3, precio_ref: 189000, tag_registrado: true, nivel: "N1", zona: "Bodega-B4", clase: "A" },
  { material_id: "MAT-007", nombre: "Arena gruesa", categoria: "Áridos", proveedor: "Áridos del Valle", unidad: "m3", stock: 9, minimo: 6, precio_ref: 23000, tag_registrado: false, nivel: "N4", zona: "Acopio-A1", clase: "C" },
  { material_id: "MAT-008", nombre: "Adhesivo cerámico 25 kg", categoria: "Terminaciones", proveedor: "Cementos Sur", unidad: "saco", stock: 0, minimo: 20, precio_ref: 7400, tag_registrado: true, nivel: "N2", zona: "Bodega-B1", clase: "B" },
];

const movimientos = [
  { ts: hace(4), nombre: "Kit tabiquería piso 5", material_id: "MAT-002", delta: -40, stock: 260, direccion: "salida", lector: "Pórtico bodega", fuente: "PORTICO", tipo: "SALIDA", partida: "C07 Tabiquería", responsable: "Capataz J. Rojas", lote_id: "KIT-0512", unidad: "unidad", confianza: "CONFIRMADO" },
  { ts: hace(11), nombre: "Rotomartillo SDS Plus", material_id: "MAT-006", delta: -1, stock: 4, direccion: "salida", lector: "Pórtico bodega", fuente: "PORTICO", tipo: "SALIDA", partida: "C03 Instalaciones", responsable: "Capataz M. Soto", lote_id: "GIAI-00031", unidad: "unidad", confianza: "CONFIRMADO" },
  { ts: hace(26), nombre: "Cemento especial 25 kg", material_id: "MAT-001", delta: -12, stock: 18, direccion: "salida", lector: "Cámara pórtico", fuente: "CAMARA", tipo: "SALIDA", partida: "C02 Radieres", responsable: "Capataz J. Rojas", lote_id: "SSCC-0001042", unidad: "saco", confianza: "CONFIRMADO" },
  { ts: hace(48), nombre: "Tag sin salida autorizada", material_id: "MAT-004", delta: -1, stock: 12, direccion: "salida", lector: "Pórtico bodega", fuente: "PORTICO", tipo: "SALIDA", lote_id: "GIAI-00077", unidad: "rollo", autorizada: false, confianza: "SIN_IDENTIFICAR", evidencia: "foto-pórtico-0948.jpg" },
  { ts: hace(95), nombre: "Plancha yeso-cartón 15 mm", material_id: "MAT-005", delta: 60, stock: 140, direccion: "entrada", lector: "Punto Cero", fuente: "TABLET", tipo: "ENTRADA", oc: "OC-2026-118", guia: "52-88412", lote_id: "SSCC-0001051", unidad: "plancha", zona: "Bodega-B1", confianza: "CONFIRMADO" },
  { ts: hace(130), nombre: "Perfil montante 90 mm", material_id: "MAT-002", delta: 300, stock: 300, direccion: "entrada", lector: "Punto Cero", fuente: "PORTICO", tipo: "ENTRADA", oc: "OC-2026-121", guia: "52-30291", lote_id: "SSCC-0001049", unidad: "unidad", zona: "Acopio-A2", confianza: "CONFIRMADO" },
  { ts: hace(210), nombre: "Tornillo cabeza lenteja caja 1000", material_id: "MAT-003", delta: -1, stock: 7, direccion: "salida", lector: "Pórtico bodega", fuente: "PORTICO", tipo: "SALIDA", partida: "C07 Tabiquería", responsable: "Capataz J. Rojas", lote_id: "BIN-014", unidad: "caja", confianza: "CONFIRMADO" },
  { ts: hace(300), nombre: "Arena gruesa", material_id: "MAT-007", delta: -3, stock: 9, direccion: "salida", lector: "Ronda acopio", fuente: "MANUAL", tipo: "SALIDA", partida: "C02 Radieres", unidad: "m3", confianza: "PARCIAL" },
  { ts: hace(380), nombre: "Kit tabiquería piso 4 · sobrante", material_id: "MAT-002", delta: 6, stock: 66, direccion: "entrada", lector: "Pórtico bodega", fuente: "PORTICO", tipo: "DEVOLUCION", partida: "C07 Tabiquería", lote_id: "KIT-0511", unidad: "unidad", confianza: "CONFIRMADO" },
];

const ordenes_compra = [
  { oc: "OC-2026-118", proveedor: "Perfiles Andes", fecha_emision: dia(-9), fecha_entrega: dia(0), estado: "parcial", monto: 2136000,
    lineas: [{ articulo: "MAT-005", nombre: "Plancha yeso-cartón 15 mm", cuenta_costo: "C07", unidad: "plancha", cantidad: 240, recibida: 60 }] },
  { oc: "OC-2026-121", proveedor: "Perfiles Andes", fecha_emision: dia(-6), fecha_entrega: dia(-1), estado: "recibida", monto: 1170000,
    lineas: [{ articulo: "MAT-002", nombre: "Perfil montante 90 mm", cuenta_costo: "C07", unidad: "unidad", cantidad: 300, recibida: 300 }] },
  { oc: "OC-2026-124", proveedor: "Cementos Sur", fecha_emision: dia(-5), fecha_entrega: dia(1), estado: "agendada", monto: 1036000,
    lineas: [{ articulo: "MAT-001", nombre: "Cemento especial 25 kg", cuenta_costo: "C02", unidad: "saco", cantidad: 120, recibida: 0 },
      { articulo: "MAT-008", nombre: "Adhesivo cerámico 25 kg", cuenta_costo: "C09", unidad: "saco", cantidad: 56, recibida: 0 }] },
  { oc: "OC-2026-109", proveedor: "Fijaciones Norte", fecha_emision: dia(-15), fecha_entrega: dia(-3), estado: "emitida", monto: 290000,
    lineas: [{ articulo: "MAT-003", nombre: "Tornillo cabeza lenteja caja 1000", cuenta_costo: "C07", unidad: "caja", cantidad: 20, recibida: 0 }] },
  { oc: "OC-2026-127", proveedor: "Eléctrica Central", fecha_emision: dia(-2), fecha_entrega: dia(6), fecha_necesidad: dia(3), estado: "agendada", monto: 576000,
    lineas: [{ articulo: "MAT-004", nombre: "Cable THHN 2,5 mm² rollo 100 m", cuenta_costo: "C03", unidad: "rollo", cantidad: 12, recibida: 0 }] },
  { oc: "OC-2026-130", proveedor: "Estructuras Modulares", fecha_emision: dia(-1), fecha_entrega: "", estado: "emitida", monto: 8640000,
    lineas: [{ articulo: "PAN-219", nombre: "Panel elevación eje A", cuenta_costo: "C07", unidad: "unidad", cantidad: 39, recibida: 0 }] },
];

const recepciones = [
  { recepcion_id: "REC-0311", ts: hace(98), cerrada_ts: hace(92), duracion_min: 6, oc: "OC-2026-118", guia_folio: "52-88412", proveedor: "Perfiles Andes",
    recibido_por: "Ayudante P. Díaz", zona: "Bodega-B1", tags_origen: 0, resultado: "diferencia",
    lineas: [{ articulo: "MAT-005", nombre: "Plancha yeso-cartón 15 mm", unidad: "plancha", esperado: 80, declarado: 80, contado: 60 }] },
  { recepcion_id: "REC-0310", ts: hace(134), cerrada_ts: hace(131), duracion_min: 3, oc: "OC-2026-121", guia_folio: "52-30291", proveedor: "Perfiles Andes",
    recibido_por: "Ayudante P. Díaz", zona: "Acopio-A2", tags_origen: 10, resultado: "conforme",
    lineas: [{ articulo: "MAT-002", nombre: "Perfil montante 90 mm", unidad: "unidad", esperado: 300, declarado: 300, contado: 300 }] },
  { recepcion_id: "REC-0309", ts: hace(1500), cerrada_ts: hace(1490), duracion_min: 4, oc: "", guia_folio: "52-77120", proveedor: "Áridos del Valle",
    recibido_por: "Guardia", zona: "Acopio-A1", tags_origen: 0, resultado: "diferencia",
    lineas: [{ articulo: "MAT-007", nombre: "Arena gruesa", unidad: "m3", esperado: 0, declarado: 12, contado: 12 }] },
];

const excepciones = [
  { exc_id: "EXC-041", tipo: "faltante", detalle: "OC-2026-118 · guía 52-88412: llegaron 60 de 80 planchas", oc: "OC-2026-118", responsable: "Adquisiciones", creada: hace(92), estado: "abierta" },
  { exc_id: "EXC-040", tipo: "sin_oc", detalle: "Guía 52-77120 de Áridos del Valle sin OC asociada (12 m3 arena)", oc: "", responsable: "Adquisiciones", creada: hace(1490), estado: "abierta" },
  { exc_id: "EXC-038", tipo: "danado", detalle: "3 planchas quebradas en la entrega anterior", oc: "OC-2026-112", responsable: "Adquisiciones", creada: hace(4300), estado: "resuelta" },
];

const lotes = [
  { lote_id: "SSCC-0001042", material_id: "MAT-001", nombre: "Cemento especial 25 kg", nivel: "N2", zona: "Bodega-B1", cantidad_inicial: 60, saldo: 18, unidad: "saco", fracciona: true, origen: "punto_cero", oc: "OC-2026-101" },
  { lote_id: "SSCC-0001051", material_id: "MAT-005", nombre: "Plancha yeso-cartón 15 mm", nivel: "N2", zona: "Bodega-B1", cantidad_inicial: 60, saldo: 60, unidad: "plancha", fracciona: true, origen: "punto_cero", oc: "OC-2026-118" },
  { lote_id: "SSCC-0001049", material_id: "MAT-002", nombre: "Perfil montante 90 mm", nivel: "N0", zona: "Acopio-A2", cantidad_inicial: 300, saldo: 260, unidad: "unidad", fracciona: true, origen: "proveedor", oc: "OC-2026-121" },
  { lote_id: "BIN-014", material_id: "MAT-003", nombre: "Tornillo cabeza lenteja caja 1000", nivel: "N3", zona: "Bodega-B3", cantidad_inicial: 8, saldo: 7, unidad: "caja", fracciona: false, origen: "punto_cero", oc: "OC-2026-097" },
  { lote_id: "GIAI-00031", material_id: "MAT-006", nombre: "Rotomartillo SDS Plus #1", nivel: "N1", zona: "Bodega-B4", cantidad_inicial: 1, saldo: 1, unidad: "unidad", fracciona: false, origen: "punto_cero", oc: "" },
  { lote_id: "GIAI-00077", material_id: "MAT-004", nombre: "Cable THHN 2,5 mm² rollo #7", nivel: "N1", zona: "Bodega-B2", cantidad_inicial: 1, saldo: 1, unidad: "rollo", fracciona: false, origen: "punto_cero", oc: "OC-2026-090" },
];

const kits = [
  { kit_id: "KIT-0512", nombre: "Kit tabiquería piso 5", tipo: "actividad", partida: "C07 Tabiquería", estado: "retirado", fecha: dia(0), responsable: "Capataz J. Rojas",
    items: [{ nombre: "Perfil montante 90 mm", cantidad: 40, unidad: "unidad" }, { nombre: "Tornillo cabeza lenteja caja 1000", cantidad: 2, unidad: "caja" }, { nombre: "Plancha yeso-cartón 15 mm", cantidad: 10, unidad: "plancha" }] },
  { kit_id: "KIT-0513", nombre: "Kit tabiquería piso 6", tipo: "actividad", partida: "C07 Tabiquería", estado: "armado", fecha: dia(1), responsable: "Capataz J. Rojas",
    items: [{ nombre: "Perfil montante 90 mm", cantidad: 40, unidad: "unidad" }, { nombre: "Plancha yeso-cartón 15 mm", cantidad: 10, unidad: "plancha" }] },
  { kit_id: "KIT-V17", nombre: "Kit estructura vivienda 17", tipo: "vivienda", partida: "C07 Estructura", estado: "programado", fecha: dia(2), responsable: "Capataz M. Soto",
    items: [{ nombre: "Panel elevación eje A", cantidad: 1, unidad: "unidad" }, { nombre: "Frontón F1", cantidad: 1, unidad: "unidad" }, { nombre: "Cercha C1", cantidad: 3, unidad: "unidad" }] },
  { kit_id: "KIT-0511", nombre: "Kit tabiquería piso 4", tipo: "actividad", partida: "C07 Tabiquería", estado: "devuelto", fecha: dia(-1), responsable: "Capataz J. Rojas",
    items: [{ nombre: "Perfil montante 90 mm", cantidad: 40, unidad: "unidad", devuelto: 6 }, { nombre: "Plancha yeso-cartón 15 mm", cantidad: 10, unidad: "plancha", devuelto: 0 }] },
];

const prestamos = [
  { lote_id: "GIAI-00031", nombre: "Rotomartillo SDS Plus #1", responsable: "Capataz M. Soto", salida: hace(11), devolver_antes: dia(0) + "T19:00:00", devuelto: null },
  { lote_id: "GIAI-00019", nombre: "Esmeril angular 7\"", responsable: "Maestro L. Vera", salida: hace(1900), devolver_antes: dia(-1) + "T19:00:00", devuelto: null },
  { lote_id: "GIAI-00022", nombre: "Taladro percutor", responsable: "Maestro R. Pino", salida: hace(2900), devolver_antes: dia(-2) + "T19:00:00", devuelto: hace(1600) },
];

const conteos = [
  { material_id: "MAT-001", nombre: "Cemento especial 25 kg", clase: "A", ultimo_conteo: hace(2 * 1440), sistema: 30, fisico: 30 },
  { material_id: "MAT-002", nombre: "Perfil montante 90 mm", clase: "A", ultimo_conteo: hace(3 * 1440), sistema: 300, fisico: 296 },
  { material_id: "MAT-004", nombre: "Cable THHN 2,5 mm² rollo 100 m", clase: "A", ultimo_conteo: hace(9 * 1440), sistema: 13, fisico: 12 },
  { material_id: "MAT-005", nombre: "Plancha yeso-cartón 15 mm", clase: "A", ultimo_conteo: hace(1 * 1440), sistema: 80, fisico: 80 },
  { material_id: "MAT-006", nombre: "Rotomartillo SDS Plus", clase: "A", ultimo_conteo: hace(5 * 1440), sistema: 5, fisico: 5 },
  { material_id: "MAT-003", nombre: "Tornillo cabeza lenteja caja 1000", clase: "B", ultimo_conteo: hace(20 * 1440), sistema: 9, fisico: 8 },
  { material_id: "MAT-007", nombre: "Arena gruesa", clase: "C", ultimo_conteo: hace(100 * 1440), sistema: 12, fisico: 9 },
];

const consumo_partidas = [
  { partida: "C02 Radieres", presupuestado: 3200000, real: 3390000 },
  { partida: "C03 Instalaciones", presupuestado: 1800000, real: 1710000 },
  { partida: "C07 Tabiquería", presupuestado: 5400000, real: 5560000 },
];

export const DATOS_DEMO = {
  materiales,
  movimientos,
  resumen_movimientos: { total: 1284, hoy: 5, entradas_hoy: 2, salidas_hoy: 3, ultimo: hace(4) },
  predicciones: [
    { material_id: "MAT-008", nombre: "Adhesivo cerámico 25 kg", dias_para_quiebre: 0, urgencia: "alta", consumo_diario: 4, partida: "C09 Cerámicos", razonamiento: "Sin stock y la partida de cerámicos parte el lunes." },
    { material_id: "MAT-001", nombre: "Cemento especial 25 kg", dias_para_quiebre: 2, urgencia: "alta", consumo_diario: 8.5, partida: "C02 Radieres", razonamiento: "Consumo de 8,5 sacos/día; la OC-2026-124 llega mañana." },
    { material_id: "MAT-004", nombre: "Cable THHN 2,5 mm² rollo 100 m", dias_para_quiebre: 5, urgencia: "media", consumo_diario: 2.4, partida: "C03 Instalaciones", razonamiento: "La OC-2026-127 llega después de la fecha de necesidad." },
  ],
  recomendaciones: [
    { rec_id: "REC-A1", nombre: "Adhesivo cerámico 25 kg", cantidad_sugerida: 60, unidad: "saco", costo_estimado: 444000, prioridad: "alta", estado: "pendiente", proveedor: "Cementos Sur", motivo: "Stock en cero y partida C09 programada para el lunes." },
  ],
  alertas: [
    { alerta_id: "AL-1", del_dia: true, nombre: "Adhesivo cerámico 25 kg", stock: 0, minimo: 20, fecha: dia(0), correo_enviado: true,
      mensaje: "El adhesivo cerámico está en cero y la partida de cerámicos parte el lunes. Hay una compra por aprobar." },
  ],
  lectores: [
    { lector_id: "PORTICO-01", descripcion: "Pórtico puerta bodega", activo: true, ultimo_latido: hace(1) },
    { lector_id: "PUNTO-CERO", descripcion: "Estación de recepción", activo: true, ultimo_latido: hace(3) },
    { lector_id: "MANO-01", descripcion: "Lector de mano · rondas de acopio", activo: true, ultimo_latido: hace(300) },
  ],
  agentes: {
    captura: { activo: true, ultimo: hace(4), lectores: 3 },
    prediccion: { activo: true, total: 3 },
    accion: { activo: true, pendientes: 1 },
  },
  metodologia: { escalon: 2, tipologia: "B", inicio_piloto: dia(-24) },
  ordenes_compra,
  recepciones,
  excepciones,
  lotes,
  kits,
  prestamos,
  conteos,
  consumo_partidas,
  integracion: { erp: "iConstruye", modo: "archivo", ultimo_envio: hace(35), pendientes: 2, errores: 0 },
};
