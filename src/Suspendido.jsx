import { useEffect } from "react";
import "./estilos.css";

/* ============================================================ SUSPENDIDO
   Lo que se ve mientras la sala de control está en modo suspensión:
   la bodega apagada y el agente triste, sin señal. Para volver a
   encender el dashboard, poner SUSPENDIDO en false en main.jsx. */
export default function Suspendido() {
  useEffect(() => { document.title = "STOK · Bodega apagada"; }, []);

  return (
    <main className="suspendido">
      <div className="suspendido__centro">
        <img src="/mascota-triste.png" alt="El agente de STOK, triste y sin señal" className="suspendido__agente" />
        <span className="suspendido__ceja">Sala de control · Modo suspensión</span>
        <h1 className="suspendido__titulo">
          Bodega apagada<span className="suspendido__puntos" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
        </h1>
        <p className="suspendido__texto">La sala de control de STOK está en modo suspensión. Volvemos pronto.</p>
      </div>
      <footer className="suspendido__pie">
        <img src="/logo-blanco.png" alt="STOK" height="26" />
        <span>Controla tu bodega, controla tu stock.</span>
      </footer>
    </main>
  );
}
