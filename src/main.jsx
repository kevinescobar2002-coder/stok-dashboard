import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import Suspendido from "./Suspendido.jsx";

/* Modo suspensión: true muestra "Bodega apagada" y el dashboard ni se descarga.
   Para volver a encenderlo, false. */
const SUSPENDIDO = true;

const App = lazy(() => import("./App.jsx"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {SUSPENDIDO ? <Suspendido /> : <Suspense fallback={null}><App /></Suspense>}
  </React.StrictMode>
);
