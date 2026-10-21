import { useEffect, useState } from "react";
import { Copy, Lock, RefreshCw, X } from "lucide-react";
import { unirseAObra } from "./obras";
import { Boton, Campo, Ceja, Chip, Ico, Punto, Titulo } from "./ui";

/* ============================================================ AJUSTES
   La configuración es de la obra, no de la persona: la comparte todo el
   equipo. Por eso se guarda con un botón y solo la toca un administrador. */
export default function Ajustes({ obra, obras, cambiarObra, aviso, guardarAjustes, nuevoCodigo, dejarObra,
  alEntrarAObra, soloUnaObra, cerrar, movil, conexion }) {
  const [b, setB] = useState(obra);
  const [ocupado, setOcupado] = useState(false);
  const [otroCodigo, setOtroCodigo] = useState("");
  const [copiado, setCopiado] = useState(false);
  const admin = obra.rol === "admin";
  const sucio = ["nombre", "base", "linkPlanilla", "linkCarpeta"].some((k) => b[k] !== obra[k]);

  useEffect(() => { setB(obra); }, [obra]);
  useEffect(() => {
    const f = (e) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [cerrar]);

  const guardar = async () => {
    setOcupado(true);
    try { await guardarAjustes(b); }
    catch (e) { aviso("No se guardaron los ajustes", e.message, "alert"); }
    finally { setOcupado(false); }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(obra.codigo); setCopiado(true); setTimeout(() => setCopiado(false), 1600); }
    catch { aviso(`El código es ${obra.codigo}`, "", "info"); }
  };

  const rotar = async () => {
    if (!window.confirm("Se generará un código nuevo y el actual dejará de servir. ¿Continuar?")) return;
    try { await nuevoCodigo(); } catch (e) { aviso("No se pudo cambiar el código", e.message, "alert"); }
  };

  const salirDeLaObra = async () => {
    if (!window.confirm(`Vas a salir de ${obra.nombre}. Para volver necesitarás el código otra vez. ¿Continuar?`)) return;
    try { await dejarObra(); cerrar(); } catch (e) { aviso("No pudiste salir de la obra", e.message, "alert"); }
  };

  /* Cambiar de obra sin cerrar Ajustes: cuando llega la obra nueva, el
     useEffect de arriba reemplaza el borrador y quedas viendo su configuración.
     Por eso hay que avisar antes si había algo escrito sin guardar. */
  const irA = async (id) => {
    if (id === obra.id) return;
    if (sucio && !window.confirm("Tienes cambios sin guardar en esta obra. Si cambias ahora, se pierden. ¿Continuar?")) return;
    setOcupado(true);
    try { await cambiarObra(id); }
    catch (e) { aviso("No se pudo cambiar de obra", e.message, "alert"); }
    finally { setOcupado(false); }
  };

  const entrarAOtra = async () => {
    if (!otroCodigo.trim()) return aviso("Escribe el código de la otra obra", "Tiene la forma STOK-XXXXXX.", "alert");
    setOcupado(true);
    try {
      const o = await unirseAObra(otroCodigo);
      setOtroCodigo("");
      aviso("Te uniste a otra obra", `Ahora también estás en ${o.nombre}.`);
      await alEntrarAObra(o);
      cerrar();
    } catch (e) { aviso("Código no válido", e.message, "alert"); }
    finally { setOcupado(false); }
  };

  const estadoCx = conexion.estado === "sin_conexion"
    ? ["crit", "Sin respuesta de n8n. Revisa la dirección o que el flujo esté activo."]
    : !obra.base
      ? ["warn", "Sin dirección de n8n: la bodega no se puede leer hasta que la configures."]
      : ["ok", `Conectado. El inventario, las predicciones y las compras de ${obra.obraId} se leen de esta planilla.`];

  const nota = { font: "400 14px/1.45 var(--font-body)", color: "var(--p-ink2)" };

  return (
    <div onClick={(e) => e.target === e.currentTarget && cerrar()}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(7,11,46,.6)", display: "flex", justifyContent: "center",
        alignItems: movil ? "stretch" : "center", padding: movil ? 0 : 32 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ajustes-titulo" className="entra"
        style={{ width: "100%", maxWidth: 640, maxHeight: "100%", display: "flex", flexDirection: "column", background: "var(--p-card)",
          color: "var(--p-ink)", border: "1px solid var(--p-line)", borderRadius: movil ? 0 : 6 }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 24px 16px", borderBottom: "1px solid var(--p-line)" }}>
          <div style={{ flex: 1 }}>
            <Titulo id="ajustes-titulo" tam={28}>Ajustes de la obra</Titulo>
            <div style={{ marginTop: 6, font: "400 14px var(--font-body)", color: "var(--p-ink2)" }}>
              {admin ? "Administras esta obra" : "Eres miembro de esta obra · solo lectura"}
            </div>
          </div>
          <button type="button" className="plano" onClick={cerrar} aria-label="Cerrar ajustes" style={{ width: 44, height: 44, justifyContent: "center" }}>
            <Ico de={X} tam={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          {!admin && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", background: "var(--p-sunk)",
              border: "1px solid var(--p-line)", borderRadius: 6, font: "400 14px/1.45 var(--font-body)" }}>
              <Ico de={Lock} tam={18} color="var(--p-ink2)" />Solo lectura. Estos ajustes los cambia el administrador de la obra.
            </div>
          )}

          {/* ── invitar ── */}
          <div style={{ padding: 16, background: "var(--p-sunk)", border: "1px solid var(--p-line)", borderRadius: 6 }}>
            <div style={{ font: "600 14px var(--font-body)" }}>Código para invitar</div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 8 }}>
              <span style={{ flex: 1, minWidth: 180, font: "600 28px/1 var(--font-mono)", letterSpacing: ".06em", color: "var(--p-signal)" }}>{obra.codigo}</span>
              <Boton variante="borde" tam="sm" onClick={copiar} icono={<Ico de={Copy} />}>{copiado ? "Copiado" : "Copiar"}</Boton>
              {admin && <Boton variante="fantasma" tam="sm" onClick={rotar} icono={<Ico de={RefreshCw} />} title="Invalida el código actual">Cambiar</Boton>}
            </div>
            <div style={{ ...nota, marginTop: 8 }}>Quien lo escriba al registrarse entra a esta obra y ve esta bodega. Nadie más. Cambiarlo invalida el anterior.</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Campo etiqueta="Nombre de la obra" value={b.nombre} disabled={!admin} placeholder="Nombre de la obra"
              onChange={(e) => setB({ ...b, nombre: e.target.value })} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="campo__etiqueta">Identificador de obra</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", background: "var(--p-sunk)",
                border: "1px solid var(--p-line)", borderRadius: 2, font: "600 16px var(--font-mono)" }}>
                <Ico de={Lock} tam={14} color="var(--p-ink2)" />{obra.obraId}
              </div>
              <span style={nota}>Fijo. Es la llave con que n8n encuentra la planilla de esta obra; cambiarlo dejaría huérfano el inventario ya registrado.</span>
            </div>
          </div>

          {/* ── conexiones ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Ceja>Conexiones</Ceja>
            <Campo etiqueta="Dirección de n8n" value={b.base} disabled={!admin} placeholder="https://tu-equipo.app.n8n.cloud"
              onChange={(e) => setB({ ...b, base: e.target.value.trim() })}
              pista="Sin la barra final. De aquí cuelgan la lectura de la planilla, los agentes y el registro de compras." />
            <Campo etiqueta="Planilla de inventario (Google Sheets)" value={b.linkPlanilla} disabled={!admin}
              placeholder="https://docs.google.com/spreadsheets/d/…" onChange={(e) => setB({ ...b, linkPlanilla: e.target.value.trim() })}
              pista="Propia de esta obra: n8n la abre para leer y escribir el inventario. Compártela con la cuenta de Google que usa n8n." />
            <Campo etiqueta="Carpeta de programación de obra (Drive)" value={b.linkCarpeta} disabled={!admin}
              placeholder="https://drive.google.com/drive/folders/…" onChange={(e) => setB({ ...b, linkCarpeta: e.target.value.trim() })}
              pista="El agente de Predicción lee de aquí la carta Gantt más reciente." />
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 6,
              background: `var(--p-${estadoCx[0]}-tint)`, font: "400 14px/1.45 var(--font-body)" }}>
              <Punto color={`var(--p-${estadoCx[0]}-bar)`} style={{ marginTop: 6 }} /><span>{estadoCx[1]}</span>
            </div>
          </div>

          {/* ── las obras a las que ya entraste ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Ceja>Mis obras</Ceja>
            {obras.map((o) => {
              const actual = o.id === obra.id;
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--p-line)" }}>
                  <Punto color={o.base ? "var(--p-ok-bar)" : "var(--p-warn-bar)"} title={o.base ? "Conectada a n8n" : "Sin dirección de n8n"} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nombre}</div>
                    <div style={{ font: "400 12px var(--font-mono)", color: "var(--p-ink2)" }}>{o.obraId} · {o.rol === "admin" ? "administras" : "miembro"}</div>
                  </div>
                  {actual
                    ? <Chip punto={false} alto={24}>Actual</Chip>
                    : <Boton variante="borde" tam="sm" onClick={() => irA(o.id)} disabled={ocupado}>Cambiar</Boton>}
                </div>
              );
            })}
          </div>

          {/* ── sumarse a una obra donde todavía no estás ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Ceja>Unirme a otra obra</Ceja>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Campo aria-label="Código de la otra obra" placeholder="STOK-XXXXXX" value={otroCodigo} autoCapitalize="characters"
                  onChange={(e) => setOtroCodigo(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && entrarAOtra()} />
              </div>
              <Boton variante="secundario" onClick={entrarAOtra} disabled={ocupado}>Unirme</Boton>
            </div>
            <span style={nota}>El código te lo da el jefe de la obra. Después la obra queda en tu lista y en el selector de la cabecera.</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid var(--p-line)" }}>
            <div style={{ ...nota, flex: 1, minWidth: 200 }}>
              {soloUnaObra ? "Es tu única obra: si sales, quedarías sin bodega que mirar." : "Dejarás de ver esta bodega. Para volver necesitarás el código otra vez."}
            </div>
            <Boton variante="peligro" tam="sm" onClick={salirDeLaObra} disabled={soloUnaObra}>Salir de esta obra</Boton>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 24px", borderTop: "1px solid var(--p-line)" }}>
          <Boton variante="borde" onClick={cerrar}>Listo</Boton>
          {admin && <Boton onClick={guardar} disabled={ocupado || !sucio}>{ocupado ? "Guardando…" : "Guardar cambios"}</Boton>}
        </div>
      </div>
    </div>
  );
}
