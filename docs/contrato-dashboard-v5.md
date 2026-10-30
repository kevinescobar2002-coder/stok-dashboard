# Contrato del dashboard v5 · Metodología STOK

`GET /webhook/stok/api/dashboard?obra_id=…` sigue devolviendo lo mismo que el flujo v3/v4:
`materiales`, `movimientos`, `resumen_movimientos`, `predicciones`, `recomendaciones`, `alertas`,
`lectores` y `agentes`. La v5 **solo agrega campos y listas opcionales**. Si una lista no llega,
su pestaña muestra «n8n todavía no envía…». Nada se rompe.

Para ver todas las pantallas con datos ficticios, abre el dashboard con `?demo`. Los datos de
ejemplo están en `src/demo.js`.

## Campos nuevos en listas que ya existen

| Lista | Campo | Valores | Para qué |
| --- | --- | --- | --- |
| `materiales` | `nivel` | `N0`–`N4` | Nivel de control (sección 4) |
| `materiales` | `zona` | `Bodega-B1`, `Acopio-A3`… | Control por zona, no por estante |
| `materiales` | `clase` | `A` `B` `C` | Frecuencia del conteo cíclico |
| `movimientos` | `tipo` | `ENTRADA` `SALIDA` `DEVOLUCION` `TRASPASO` `AJUSTE` | Evento estándar |
| `movimientos` | `fuente` | `PORTICO` `CAMARA` `TABLET` `LECTOR_MANO` `ERP` `DTE` `MANUAL` | KPI de captura automática (`MANUAL` = digitado) |
| `movimientos` | `confianza` | `CONFIRMADO` `PARCIAL` `SIN_IDENTIFICAR` | Calidad del evento |
| `movimientos` | `autorizada` | `false` | Tag que cruzó el pórtico sin un retiro que lo respalde |
| `movimientos` | `lote_id`, `partida`, `responsable`, `oc`, `guia`, `unidad`, `origen`, `destino`, `evidencia`, `event_id` | texto | Trazabilidad y evento estándar |

## Listas nuevas

```json
{
  "metodologia": { "escalon": 2, "tipologia": "B", "inicio_piloto": "2026-10-06" },
  "ordenes_compra": [{
    "oc": "OC-2026-118", "proveedor": "…", "fecha_emision": "2026-10-20",
    "fecha_entrega": "2026-10-30", "fecha_necesidad": "2026-11-02",
    "estado": "emitida | agendada | parcial | recibida | cerrada", "monto": 2136000,
    "lineas": [{ "articulo": "MAT-005", "nombre": "…", "cuenta_costo": "C07", "unidad": "plancha", "cantidad": 240, "recibida": 60 }]
  }],
  "recepciones": [{
    "recepcion_id": "REC-0311", "ts": "ISO", "cerrada_ts": "ISO", "duracion_min": 6,
    "oc": "OC-2026-118", "guia_folio": "52-88412", "proveedor": "…", "recibido_por": "…",
    "zona": "Bodega-B1", "tags_origen": 0, "resultado": "conforme | diferencia",
    "lineas": [{ "articulo": "MAT-005", "nombre": "…", "unidad": "plancha", "esperado": 80, "declarado": 80, "contado": 60 }]
  }],
  "excepciones": [{
    "exc_id": "EXC-041", "tipo": "sin_oc | faltante | exceso | sustituto | danado | entrega_directa | fuera_horario",
    "detalle": "…", "oc": "…", "responsable": "Adquisiciones", "creada": "ISO", "plazo": "ISO (opcional)",
    "estado": "abierta | resuelta"
  }],
  "lotes": [{
    "lote_id": "SSCC-0001042", "material_id": "MAT-001", "nombre": "…", "nivel": "N2", "zona": "Bodega-B1",
    "cantidad_inicial": 60, "saldo": 18, "unidad": "saco", "fracciona": true,
    "origen": "punto_cero | proveedor", "oc": "…"
  }],
  "kits": [{
    "kit_id": "KIT-0512", "nombre": "…", "tipo": "actividad | vivienda", "partida": "C07 Tabiquería",
    "estado": "programado | armado | retirado | devuelto", "fecha": "2026-10-30", "responsable": "…",
    "items": [{ "nombre": "…", "cantidad": 40, "unidad": "unidad", "devuelto": 6 }]
  }],
  "prestamos": [{ "lote_id": "GIAI-00031", "nombre": "…", "responsable": "…", "salida": "ISO", "devolver_antes": "ISO", "devuelto": null }],
  "conteos": [{ "material_id": "MAT-001", "nombre": "…", "clase": "A", "ultimo_conteo": "ISO", "sistema": 30, "fisico": 30 }],
  "consumo_partidas": [{ "partida": "C02 Radieres", "presupuestado": 3200000, "real": 3390000 }],
  "integracion": { "erp": "iConstruye", "modo": "api | archivo", "ultimo_envio": "ISO", "pendientes": 2, "errores": 0 }
}
```

## Reglas que aplica el dashboard

- **OC vencida:** la `fecha_entrega` ya pasó y el estado no es `recibida` ni `cerrada`.
- **Riesgo de quiebre:** la `fecha_entrega` es posterior a la `fecha_necesidad`.
- **Plazo de una excepción:** si no viene `plazo`, se usa el plazo por tipo: 48 h (sin OC, faltante, dañado) o 24 h (exceso, sustituto, fuera de horario).
- **Exactitud de inventario:** % de conteos de clase A con una diferencia de ±2 % o menos.
- **Conteo vencido:** A cada 7 días, B cada 30, C cada 90.
- **Escalón:** si no viene `metodologia.escalon`, se deduce de lo que la obra ya usa (recepciones o lotes → 1, pórtico → 2, cámara → 3, kits + lotes N0 → 4).

La pestaña Integración descarga los movimientos como evento estándar, en CSV (separado por `;`) o en JSON.
