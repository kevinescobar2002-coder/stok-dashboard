import { num } from "./ui";

/* ============================================================
   Captura en vivo para la demo y el pitch.
   Cada pocos segundos un material sale (o entra) de bodega y lo registra
   uno de los dos captores de STOK:
   · el portal RFID (AKU AKU 1), que lee las piezas con tag;
   · la cámara de visión IA (V.2), que cuenta consumibles a granel.
   Solo se mueve lo que el programa de obra está consumiendo, y los quiebres
   no se reponen solos: esperan la compra, igual que en una obra real.
   ============================================================ */

export const PORTAL = "PORTAL-BODEGA";
export const CAMARA = "CAMARA-IA-1";

/* Piezas que se cuentan de a una pasan por el portal; lo que va a granel lo ve la cámara. */
const PIEZAS = new Set(["unidad", "plancha", "pieza", "juego", "tira", "rollo", "tineta", "galón", "saco", "pomo", "tambor"]);

export const LECTOR_CAMARA = {
  lector_id: CAMARA, zona: "patio techado", activo: true, vinculado: true,
  descripcion: "Cámara de visión IA · acopio de consumibles",
};

const azar = (n) => Math.floor(Math.random() * n);

export function simularLectura(d) {
  const conDemanda = new Set((d.predicciones || []).map((p) => p.material_id));
  /* Las salidas no cruzan umbrales: nada llega a cero ni baja de su mínimo si
     estaba sobre él. Así los quiebres y los "bajo mínimo" siguen siendo los de
     la planilla y el aviso del día cuadra con los KPIs durante todo el pitch. */
  const piso = (m) => (num(m.stock) >= num(m.minimo) ? Math.max(num(m.minimo), 1) : 1);
  const candidatos = d.materiales.filter((m) => conDemanda.has(m.material_id) && num(m.stock) - piso(m) >= 1);
  if (!candidatos.length) return d;

  /* Se elige primero el captor y después el material, para que la cámara
     aparezca casi tan seguido como el portal aunque vea menos códigos. */
  const esPieza = (m) => PIEZAS.has(m.unidad) && m.categoria !== "Fijaciones";
  const piezas = candidatos.filter(esPieza), granel = candidatos.filter((m) => !esPieza(m));
  const grupo = !granel.length ? piezas : !piezas.length ? granel : Math.random() < 0.55 ? piezas : granel;
  const m = grupo[azar(grupo.length)];
  const pieza = esPieza(m);
  const lector = pieza ? PORTAL : CAMARA;
  const stock = num(m.stock);
  /* Lo que está bajo el mínimo espera su compra: no le llegan reposiciones sueltas. */
  const entra = stock >= num(m.minimo) && Math.random() < 0.12;
  const paso = pieza ? 1 + azar(2) : 2 + azar(6);
  const delta = entra ? paso * 4 : -Math.min(paso, stock - piso(m));
  const nuevo = stock + delta;
  const ts = new Date().toISOString();
  const destino = entra ? "recepción proveedor" : `casa ${1 + azar(53)}`;

  return {
    ...d,
    materiales: d.materiales.map((x) => (x.material_id === m.material_id ? { ...x, stock: nuevo } : x)),
    movimientos: [
      { id: `${ts}-${m.material_id}`, ts, nombre: m.nombre, direccion: entra ? "entrada" : "salida", delta, stock: nuevo,
        lector: `${lector} · ${destino}`, origen: pieza ? "rfid" : "camara" },
      ...d.movimientos,
    ].slice(0, 80),
    lectores: (d.lectores || []).map((l) => (l.lector_id === lector ? { ...l, ultimo_latido: ts } : l)),
    agentes: { ...d.agentes, captura: { ...(d.agentes?.captura || {}), activo: true, ultimo: ts, lectores: (d.lectores || []).length } },
  };
}
