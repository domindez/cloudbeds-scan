# Papel de las Cruces - Documentación

## 📊 ¿Qué es el Papel de las Cruces?

El **Papel de las Cruces** es una herramienta que genera automáticamente un archivo Excel con el estado de todas las habitaciones del hotel para una fecha específica, organizado por plantas.

## 🎯 Funcionalidad

Para cada habitación, el sistema marca automáticamente:

- **Entrada (X)**: Si un huésped llega ese día
- **Ocupada (X)**: Si un huésped ya estaba alojado el día anterior y continúa
- **Salida (X)**: Si un huésped sale ese día

## 📝 Cómo usar

1. **Navega al calendario de Cloudbeds**

   - Asegúrate de estar en la página del calendario (https://hotels.cloudbeds.com/connect/...)

2. **Abre la extensión**

   - Haz clic en el icono de la extensión en Chrome

3. **Selecciona la pestaña "Papel de Cruces"**

   - Verás la nueva pestaña entre "Escanear" y "Ajustes"

4. **Selecciona la fecha**

   - Por defecto se carga la fecha actual
   - Puedes cambiarla usando el selector de fecha

5. **Genera el Excel**
   - Haz clic en "📊 Generar Excel"
   - El archivo se descargará automáticamente con el nombre `papel_cruces_YYYY-MM-DD.xlsx`

## 📋 Estructura del Excel

El Excel generado contiene:

- **Una hoja por planta**: Cada planta del hotel tiene su propia pestaña
- **Columnas**:
  - Habitación: Número de habitación
  - Tipo: Tipo de habitación (Individual, Doble, Triple, Familiar)
  - Entrada: X si hay entrada ese día
  - Ocupada: X si está ocupada (huésped continúa)
  - Salida: X si hay salida ese día
  - Huésped: Nombre del huésped

## 🔍 Ejemplos

### Ejemplo 1: Habitación con entrada

```
Habitación: 101
Tipo: HABITACION DOBLE
Entrada: X
Ocupada:
Salida:
Huésped: Juan García
```

### Ejemplo 2: Habitación ocupada (continuación)

```
Habitación: 202
Tipo: HABITACION INDIVIDUAL
Entrada:
Ocupada: X
Salida:
Huésped: María López
```

### Ejemplo 3: Habitación con salida

```
Habitación: 303
Tipo: HABITACION TRIPLE
Entrada:
Ocupada:
Salida: X
Huésped: Pedro Martínez
```

## ⚠️ Notas importantes

- **Debes estar en la página del calendario**: La extensión extrae los datos directamente del calendario visible
- **Asegúrate de que el calendario esté cargado**: Espera a que el calendario muestre todas las habitaciones
- **Fecha visible en el calendario**: Aunque no es estrictamente necesario que la fecha seleccionada esté visible, es recomendable tenerla a la vista

## 🐛 Solución de problemas

### "Debes estar en la página de Cloudbeds"

- Asegúrate de estar en `hotels.cloudbeds.com`
- Navega al calendario antes de usar la función

### "No se pudieron extraer los datos del calendario"

- Recarga la página del calendario
- Espera a que el calendario se cargue completamente
- Verifica que estás en la vista del calendario (no en otra sección)

### El Excel está vacío o faltan datos

- Verifica que la fecha seleccionada tenga reservas
- Asegúrate de que el calendario muestra las habitaciones
- Intenta con otra fecha para confirmar que funciona

## 🔧 Tecnología

La funcionalidad utiliza:

- **Extracción de datos**: Analiza el DOM del calendario de Cloudbeds
- **Procesamiento**: Determina el estado de cada habitación según las reservas
- **Generación de Excel**: Utiliza la librería SheetJS (xlsx) para crear el archivo Excel
- **Descarga automática**: El archivo se descarga directamente al navegador

## 📚 Mantenimiento

Si Cloudbeds cambia la estructura de su calendario, puede ser necesario actualizar los selectores CSS en `cruces.js`:

- `.c-rt-and-rooms`: Contenedor de tipos de habitación
- `.c-collaps`: Nombre del tipo de habitación
- `.c-room`: Habitaciones individuales
- `.c-room-line`: Líneas de reservas
- `.calendar-slot`: Bloques de reserva

## 💡 Mejoras futuras

Posibles mejoras a implementar:

- Exportar también a PDF
- Añadir estadísticas (% ocupación, entradas/salidas totales)
- Filtrar por tipo de habitación
- Generar para múltiples fechas (rango)
- Enviar por email automáticamente
