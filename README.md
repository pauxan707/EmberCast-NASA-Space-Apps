# NASA-Space-Apps-Challenge---Harmonization-of-MODIS-and-VIIRS-Hot-Spots

Front en React + Vite con backend **simulado**. Sirve para mostrar el flujo: zonas, mapa de calor y pronóstico por fechas con la predicción del modelo.

## Correr
    npm install
    npm run dev          
    npm run build       

## Dónde está cada cosa
- `src/api/index.js`conecta con el back, usa datos de ejemplo
- `src/App.jsx`: las tres secciones (zonas, mapa de calor, pronóstico).

## Para el back real
Definir VITE_API_URL

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/zones` | `[{ id, name, reasons, level (0-3), confidence }]` |
| GET | `/heatmap?date=YYYY-MM-DD` | `{ cols, rows, cells: [nivel 0-3, ...] }` (por filas) |
| POST | `/forecast` con `{ zoneId, from, to }` | `{ level, peakDate, days: [{ date, level, tramo }], alternative: { name, level } \| null, model: { headline, reasons: [texto], advice: { personas, instituciones }, confidence } }` |

Niveles: 0 bajo, 1 moderado, 2 alto, 3 muy alto. `tramo`: `modelo` (hasta 7 días), `pronostico` (hasta 16) o `climatologia`. El objeto `model` es la predicción ya interpretada que se muestra en pantalla (titular, razones, qué hacer y confianza), para que nadie tenga que analizar los datos.

