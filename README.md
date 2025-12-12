# 🪪 Cloudbeds ID Scanner

Extensión de Chrome para escanear documentos de identidad (pasaporte, DNI, NIE, etc.) y rellenar automáticamente los datos del huésped en Cloudbeds.

## ✨ Características

- 📷 Escanea imágenes de documentos de identidad
- 🤖 Usa GPT-4o-mini de OpenAI para extraer datos con alta precisión
- 🏨 Rellena automáticamente el formulario de huésped en Cloudbeds
- 🔒 Tu API Key se guarda localmente en tu navegador

## 📋 Datos que extrae

- Nombre y apellidos
- Fecha de nacimiento
- Género
- Nacionalidad
- Tipo de documento (Pasaporte, DNI, NIE, Licencia)
- Número de documento
- Fecha de emisión
- Fecha de caducidad
- País expedidor
- Número de soporte (para DNI español)

## 🚀 Instalación

### 1. Descargar/Clonar el proyecto

Descarga esta carpeta o clona el repositorio.

### 2. Instalar en Chrome

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta `cloudbeds-scan`

### 3. Obtener una API Key de OpenAI

1. Ve a [OpenAI Platform](https://platform.openai.com/api-keys)
2. Crea una nueva API Key
3. Copia la key (empieza con `sk-...`)

## 📖 Uso

1. **Configura tu API Key:**
   - Haz clic en el icono de la extensión
   - Pega tu API Key de OpenAI
   - Haz clic en "Guardar API Key"

2. **Escanea un documento:**
   - Arrastra una imagen de un documento o haz clic para seleccionar
   - Haz clic en "🔍 Escanear documento"
   - Espera unos segundos mientras se procesan los datos

3. **Rellena el formulario en Cloudbeds:**
   - Abre la página de huésped en Cloudbeds
   - Haz clic en "✅ Rellenar formulario en Cloudbeds"
   - ¡Los campos se rellenarán automáticamente!

## 💰 Costos

Esta extensión usa el modelo `gpt-4o-mini` de OpenAI que es muy económico:
- ~$0.00015 por imagen procesada (aproximadamente)
- Puedes procesar miles de documentos por menos de $1

## 🔒 Privacidad

- Tu API Key se guarda **localmente** en tu navegador
- Las imágenes se envían directamente a OpenAI, no a ningún servidor intermedio
- No almacenamos ningún dato personal

## 🛠️ Estructura del proyecto

```
cloudbeds-scan/
├── manifest.json      # Configuración de la extensión
├── popup.html         # Interfaz del popup
├── popup.css          # Estilos del popup
├── popup.js           # Lógica del popup y llamada a OpenAI
├── content.js         # Script que rellena el formulario
├── content.css        # Estilos de notificación
├── icons/             # Iconos de la extensión
└── README.md          # Este archivo
```

## ⚠️ Solución de problemas

### "Error: Asegúrate de estar en la página de huésped de Cloudbeds"
- Verifica que estás en `https://hotels.cloudbeds.com/...`
- Asegúrate de estar en la pestaña de información del huésped

### "Error en la API de OpenAI"
- Verifica que tu API Key sea correcta
- Asegúrate de tener saldo en tu cuenta de OpenAI
- Comprueba que la key no haya expirado

### Los campos no se rellenan
- Intenta recargar la página de Cloudbeds
- Verifica que el formulario de huésped esté visible

## 📝 Notas

- Funciona mejor con imágenes claras y bien iluminadas
- Soporta documentos en múltiples idiomas
- Los datos extraídos se pueden revisar antes de rellenar el formulario

## 📄 Licencia

MIT License - Uso libre
