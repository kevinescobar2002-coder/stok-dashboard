import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { supabase } from "./supabase";
import { crearObra, unirseAObra } from "./obras";
import { Boton, Campo, Ceja, Ico, Logo } from "./ui";

/* ============================================================
   Pantallas de entrada: acceso, bienvenida (sin obra todavía),
   errores y carga. Todas comparten la misma tarjeta centrada.
   ============================================================ */

/* Tarjeta con la barra de "escaneo" arriba: el lector leyendo. */
function Tarjeta({ children, pie }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="tarjeta" style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ height: 3, background: "var(--p-signal-tint)", position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "40%", background: "var(--stok-signal)",
              animation: "escaneo 2.4s cubic-bezier(.2,.7,.2,1) infinite" }} />
          </div>
          <div style={{ padding: "32px 32px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Logo alto={34} />
              <Ceja>Sala de control · Bodega de obra</Ceja>
            </div>
            {children}
          </div>
        </div>
        {pie && <p style={{ margin: 0, textAlign: "center", font: "400 14px/1.5 var(--font-body)", color: "var(--p-ink2)", textWrap: "pretty" }}>{pie}</p>}
      </div>
    </div>
  );
}

const TituloGrande = ({ children }) => (
  <h1 style={{ margin: 0, font: "800 30px/.95 var(--font-display)", textTransform: "uppercase", letterSpacing: "-.01em", color: "var(--p-ink)" }}>{children}</h1>
);

const ErrorCaja = ({ children }) => (
  <div role="alert" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", background: "var(--p-crit-tint)",
    borderRadius: 6, font: "400 14px/1.45 var(--font-body)", color: "var(--p-crit)" }}>
    <Ico de={TriangleAlert} tam={18} style={{ marginTop: 1 }} />{children}
  </div>
);

const Alternativa = ({ antes, texto, onClick }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap", font: "400 15px var(--font-body)", color: "var(--p-ink2)" }}>
    {antes}
    <button type="button" onClick={onClick} style={{ minHeight: 44, padding: "0 4px", background: "transparent", border: 0, cursor: "pointer",
      font: "600 15px var(--font-body)", color: "var(--p-signal)", textDecoration: "underline", textUnderlineOffset: 3 }}>{texto}</button>
  </div>
);

/* ============================================================ ACCESO (Supabase) */
export function Acceso({ aviso }) {
  const [modo, setModo] = useState("entrar");
  const [f, setF] = useState({ nombre: "", email: "", clave: "", codigo: "" });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const crear = modo === "crear";
  const campo = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: k === "codigo" ? e.target.value.toUpperCase() : e.target.value }) });

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    const email = f.email.trim().toLowerCase();
    if (!email || !f.clave) return setError("Escribe tu correo y tu clave.");
    if (f.clave.length < 6) return setError("La clave necesita al menos 6 caracteres.");
    if (crear && !f.nombre.trim()) return setError("Falta tu nombre.");
    setOcupado(true);
    try {
      if (crear) {
        const { data, error } = await supabase.auth.signUp({
          email, password: f.clave, options: { data: { nombre: f.nombre.trim() } },
        });
        if (error) throw error;

        /* Con confirmación de correo activada no hay sesión todavía y el
           código no se puede canjear aún: se pide de nuevo al entrar. */
        if (f.codigo.trim() && data.session) {
          try {
            const o = await unirseAObra(f.codigo);
            aviso("Cuenta creada", `Entraste a ${o.nombre}.`);
          } catch (e) {
            aviso("Cuenta creada, pero el código falló", e.message, "alert");
          }
        } else if (f.codigo.trim()) {
          aviso("Cuenta creada", "Confirma tu correo y vuelve a escribir el código al entrar.", "info");
        } else {
          aviso("Cuenta creada", "Revisa tu correo si te pedimos confirmarla.", "info");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.clave });
        if (error) throw error;
      }
    } catch (e) {
      const m = String(e.message || "");
      if (m.includes("already registered")) setError("Ya existe una cuenta con ese correo.");
      else if (m.includes("Invalid login")) setError("Correo o clave incorrectos. Revisa y vuelve a intentar.");
      else setError(m || "No se pudo completar la operación.");
    } finally { setOcupado(false); }
  };

  const cambiarModo = () => { setModo(crear ? "entrar" : "crear"); setError(""); };

  return (
    <Tarjeta pie="El inventario vive en la planilla de la obra. Aquí solo se mira y se decide.">
      <TituloGrande>{crear ? "Crear cuenta" : "Entrar"}</TituloGrande>
      <form onSubmit={enviar} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {crear && <Campo etiqueta="Nombre" placeholder="Tu nombre" autoComplete="name" {...campo("nombre")} />}
        <Campo etiqueta="Correo" type="email" placeholder="tu@correo.cl" autoComplete="email" {...campo("email")} />
        <Campo etiqueta="Clave" type="password" placeholder={crear ? "Mínimo 6 caracteres" : "••••••••"}
          autoComplete={crear ? "new-password" : "current-password"} {...campo("clave")} />
        {crear && (
          <Campo etiqueta="Código de la obra (opcional)" placeholder="STOK-A7K2M9" autoCapitalize="characters" {...campo("codigo")}
            pista="Te lo da el jefe de la obra. Si vas a crear una obra nueva, déjalo en blanco." />
        )}
        {error && <ErrorCaja>{error}</ErrorCaja>}
        <Boton type="submit" tam="lg" ancho disabled={ocupado}>
          {ocupado ? "Verificando…" : crear ? "Crear cuenta y entrar" : "Entrar"}
        </Boton>
      </form>
      <Alternativa antes={crear ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"} texto={crear ? "Entrar" : "Crear cuenta"} onClick={cambiarModo} />
    </Tarjeta>
  );
}

/* ============================================================ BIENVENIDA
   Primera pantalla de quien todavía no pertenece a ninguna obra.
   Dos caminos: entrar con el código que le pasaron, o abrir una obra
   nueva (y quedar como su administrador). */
export function Bienvenida({ sesion, salir, aviso, alEntrar }) {
  const [via, setVia] = useState("codigo");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState({ nombre: "", obraId: "" });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (via === "codigo" && !codigo.trim()) return setError("Escribe el código de la obra.");
    if (via === "crear" && !nueva.nombre.trim()) return setError("La obra necesita un nombre.");
    setOcupado(true);
    try {
      if (via === "codigo") {
        const o = await unirseAObra(codigo);
        aviso("Entraste a la obra", o.nombre);
        await alEntrar(o);
      } else {
        const o = await crearObra(nueva.nombre, nueva.obraId);
        aviso("Obra creada", `El código para tu equipo es ${o.codigo}.`);
        await alEntrar(o);
      }
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  };

  return (
    <Tarjeta>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <TituloGrande>Hola, {sesion.nombre}.</TituloGrande>
        <p style={{ margin: 0, font: "400 15px/1.5 var(--font-body)", color: "var(--p-ink2)", textWrap: "pretty" }}>
          Todavía no estás en ninguna obra. Cada obra tiene su propia bodega, y solo ves la tuya.
        </p>
      </div>
      <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: 4, gap: 4, background: "var(--p-page)",
        border: "1px solid var(--p-line)", borderRadius: 2 }}>
        {[["codigo", "Tengo un código"], ["crear", "Crear obra nueva"]].map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={via === v} onClick={() => { setVia(v); setError(""); }}
            style={{ height: 44, border: 0, borderRadius: 2, cursor: "pointer", font: "600 14px var(--font-body)",
              background: via === v ? "var(--stok-marino)" : "transparent", color: via === v ? "var(--stok-niebla)" : "var(--p-ink)" }}>{t}</button>
        ))}
      </div>
      <form onSubmit={enviar} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {via === "codigo" ? (
          <Campo etiqueta="Código de la obra" placeholder="STOK-A7K2M9" value={codigo} autoCapitalize="characters"
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            pista="Seis caracteres que te pasa el jefe de la obra o quien la creó." />
        ) : (
          <>
            <Campo etiqueta="Nombre de la obra" placeholder="Edificio Los Aromos" value={nueva.nombre}
              onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
            <Campo etiqueta="Identificador (opcional)" placeholder="OBRA-001" value={nueva.obraId}
              onChange={(e) => setNueva({ ...nueva, obraId: e.target.value.toUpperCase() })}
              pista="Es la llave que separa las filas dentro de la planilla. Si lo dejas en blanco, se asigna uno libre. No se puede cambiar después." />
          </>
        )}
        {error && <ErrorCaja>{error}</ErrorCaja>}
        <Boton type="submit" tam="lg" ancho disabled={ocupado}>
          {via === "codigo" ? (ocupado ? "Entrando…" : "Entrar a la obra") : (ocupado ? "Creando…" : "Crear obra y administrarla")}
        </Boton>
      </form>
      <Alternativa texto="Salir" onClick={salir} />
    </Tarjeta>
  );
}

/* Pantalla de error con salida: se usa cuando no podemos leer las obras. */
export function Aviso({ titulo, texto, accion, onAccion, salir }) {
  return (
    <Tarjeta>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <TituloGrande>{titulo}</TituloGrande>
        <p style={{ margin: 0, font: "400 15px/1.5 var(--font-body)", color: "var(--p-ink2)" }}>{texto}</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Boton onClick={onAccion}>{accion}</Boton>
        <Boton variante="borde" onClick={salir}>Salir</Boton>
      </div>
    </Tarjeta>
  );
}

export const Cargando = ({ texto }) => (
  <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <Logo alto={34} />
      <Ceja>{texto}</Ceja>
    </div>
  </div>
);
