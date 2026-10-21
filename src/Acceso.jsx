import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { supabase } from "./supabase";
import { unirseAObra } from "./obras";
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
  <h1 style={{ margin: 0, font: "800 28px/.95 var(--font-display)", textTransform: "uppercase", letterSpacing: "-.01em", color: "var(--p-ink)" }}>{children}</h1>
);

const ErrorCaja = ({ children }) => (
  <div role="alert" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", background: "var(--p-crit-tint)",
    borderRadius: 6, font: "400 14px/1.45 var(--font-body)", color: "var(--p-crit)" }}>
    <Ico de={TriangleAlert} tam={18} style={{ marginTop: 1 }} />{children}
  </div>
);

const Alternativa = ({ antes, texto, onClick }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap", font: "400 16px var(--font-body)", color: "var(--p-ink2)" }}>
    {antes}
    <button type="button" onClick={onClick} style={{ minHeight: 44, padding: "0 4px", background: "transparent", border: 0, cursor: "pointer",
      font: "600 16px var(--font-body)", color: "var(--p-signal)", textDecoration: "underline", textUnderlineOffset: 3 }}>{texto}</button>
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
          <Campo etiqueta="Código de la obra" placeholder="STOK-XXXXXX" autoCapitalize="characters" {...campo("codigo")}
            pista="Te lo da el jefe de la obra. Si no lo tienes aún, podrás escribirlo después de entrar." />
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
   Primera pantalla de quien todavía no pertenece a la obra.
   STOK trabaja con una sola obra, la conectada al flujo n8n:
   se entra con el código de invitación, no se crean obras nuevas. */
export function Bienvenida({ sesion, salir, alEntrar, aviso }) {
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!codigo.trim()) return setError("Escribe el código de la obra.");
    setOcupado(true);
    try {
      const o = await unirseAObra(codigo);
      aviso("Entraste a la obra", o.nombre);
      await alEntrar(o);
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  };

  return (
    <Tarjeta>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <TituloGrande>Hola, {sesion.nombre}.</TituloGrande>
        <p style={{ margin: 0, font: "400 16px/1.5 var(--font-body)", color: "var(--p-ink2)", textWrap: "pretty" }}>
          Todavía no estás en la obra. Escribe el código de invitación que te dio el jefe de obra.
        </p>
      </div>
      <form onSubmit={enviar} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Campo etiqueta="Código de la obra" placeholder="STOK-XXXXXX" value={codigo} autoCapitalize="characters"
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          pista="Lo encuentra el jefe de obra en Ajustes del dashboard." />
        {error && <ErrorCaja>{error}</ErrorCaja>}
        <Boton type="submit" tam="lg" ancho disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar a la obra"}</Boton>
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
        <p style={{ margin: 0, font: "400 16px/1.5 var(--font-body)", color: "var(--p-ink2)" }}>{texto}</p>
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
