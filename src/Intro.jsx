import { useEffect, useRef, useState } from "react";

/* ============================================================ INTRO
   Portada del pitch: el logo transmite, aparece la promesa de STOK y la
   sala de control queda a la vista. Dura unos cuatro segundos y se salta
   con un clic o cualquier tecla. Se anima aunque el sistema pida reducir el
   movimiento: es corta, suave, sin destellos, y es el momento de la marca. */

const DURACION = 4200;  // hasta que empieza a desvanecerse
const SALIDA = 600;     // el desvanecido

export default function Intro({ alTerminar }) {
  const [saliendo, setSaliendo] = useState(false);
  const fin = useRef(false);

  const terminar = () => {
    if (fin.current) return;
    fin.current = true;
    setSaliendo(true);
    setTimeout(alTerminar, SALIDA);
  };

  useEffect(() => {
    const t = setTimeout(terminar, DURACION);
    const tecla = () => terminar();
    window.addEventListener("keydown", tecla);
    return () => { clearTimeout(t); window.removeEventListener("keydown", tecla); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`intro${saliendo ? " intro--sale" : ""}`} onClick={terminar} role="presentation">
      <div className="intro__centro">
        <div className="intro__marca">
          {[0, 1, 2].map((i) => <span key={i} className="intro__onda" style={{ "--retraso": `${i * 0.55}s` }} />)}
          <img src="/logo-blanco.png" alt="STOK" className="intro__logo" />
        </div>

        <div className="intro__ceja intro__aparece" style={{ "--retraso": ".5s" }}>Sala de control · Bodega de obra</div>

        <h1 className="intro__frase">
          <span className="intro__aparece" style={{ "--retraso": "1s" }}>No ofrecemos sensores.</span>
          <span className="intro__aparece intro__naranja" style={{ "--retraso": "1.6s" }}>Ofrecemos decisiones.</span>
        </h1>

        <p className="intro__lema intro__aparece" style={{ "--retraso": "2.4s" }}>Controla tu bodega, controla tu stock.</p>
      </div>

      <div className="intro__pie">
        <div className="intro__barra"><span style={{ "--dur": `${DURACION}ms` }} /></div>
        <button type="button" className="intro__saltar" onClick={(e) => { e.stopPropagation(); terminar(); }}>Entrar a la sala de control →</button>
      </div>
    </div>
  );
}
