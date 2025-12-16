// Configuración
const OPENAI_MODEL = 'gpt-5-mini'; // Modelo de OpenAI para visión

// Estado de la aplicación
let selectedImage = null;
let selectedImages = []; // Para DNI español (2 imágenes)
let imageToUpload = null; // Imagen que se subirá a Cloudbeds
let extractedData = null;
let isDniMode = false; // Modo DNI español (2 caras)

// Elementos del DOM
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const saveKeyBtn = document.getElementById('saveKey');
const keyStatus = document.getElementById('keyStatus');
const dropZone = document.getElementById('dropZone');
const selectFileBtn = document.getElementById('selectFileBtn');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const previewImage = document.getElementById('previewImage');
const clearImageBtn = document.getElementById('clearImage');
const loadScanBtn = document.getElementById('loadScanBtn');
const loadDniBtn = document.getElementById('loadDniBtn');
const previewDni = document.getElementById('previewDni');
const previewImage1 = document.getElementById('previewImage1');
const previewImage2 = document.getElementById('previewImage2');
const clearDniImages = document.getElementById('clearDniImages');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const scanFolderPath = document.getElementById('scanFolderPath');
const folderStatus = document.getElementById('folderStatus');
const scanBtn = document.getElementById('scanBtn');
const scanText = document.getElementById('scanText');
const scanLoader = document.getElementById('scanLoader');
const results = document.getElementById('results');
const extractedDataDiv = document.getElementById('extractedData');
const tokenUsageDiv = document.getElementById('tokenUsage');
const statusMessage = document.getElementById('statusMessage');

// Elementos adicionales
const uploadPhotoCheckbox = document.getElementById('uploadPhotoCheckbox');

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración guardada
  const stored = await chrome.storage.local.get(['openaiApiKey', 'scanFolderName', 'uploadPhoto']);
  if (stored.openaiApiKey) {
    apiKeyInput.value = stored.openaiApiKey;
  }
  if (stored.scanFolderName) {
    scanFolderPath.textContent = stored.scanFolderName;
  }
  // Por defecto está desactivado
  uploadPhotoCheckbox.checked = stored.uploadPhoto === true;
  
  // Inicializar tabs
  initTabs();
});

// Guardar preferencia de subir foto
uploadPhotoCheckbox.addEventListener('change', async () => {
  await chrome.storage.local.set({ uploadPhoto: uploadPhotoCheckbox.checked });
});

// Manejo de pestañas
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Quitar active de todas las tabs
      tabs.forEach(t => t.classList.remove('active'));
      // Añadir active a la tab clickeada
      tab.classList.add('active');
      
      // Mostrar contenido correspondiente
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
}

// Toggle visibilidad de API Key
toggleKeyBtn.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  toggleKeyBtn.textContent = apiKeyInput.type === 'password' ? '👁️' : '🙈';
});

// Guardar API Key
saveKeyBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showKeyStatus('Por favor ingresa una API Key', 'error');
    return;
  }
  if (!apiKey.startsWith('sk-')) {
    showKeyStatus('La API Key debe comenzar con "sk-"', 'error');
    return;
  }
  
  await chrome.storage.local.set({ openaiApiKey: apiKey });
  showKeyStatus('API Key guardada ✓', 'success');
});

function showKeyStatus(message, type) {
  keyStatus.textContent = message;
  keyStatus.className = `status ${type}`;
  setTimeout(() => {
    keyStatus.textContent = '';
    keyStatus.className = 'status';
  }, 3000);
}

// Drag and Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleImageFile(file);
  }
});

// Click en botón de seleccionar archivo (no en el dropZone completo)
selectFileBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Verificar que estamos en modo edición
  const editCheck = await checkEditMode();
  if (!editCheck.isEditMode) {
    const errorMsg = editCheck.error || 'Primero haz clic en "Editar detalles" en Cloudbeds';
    showStatusMessage(`⚠️ ${errorMsg}`, 'error');
    return;
  }
  
  fileInput.click();
});

// Selección de archivo
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleImageFile(file);
  }
});

// Procesar imagen seleccionada
function handleImageFile(file) {
  isDniMode = false;
  selectedImages = [];
  previewDni.classList.add('hidden');
  
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedImage = e.target.result;
    imageToUpload = e.target.result; // Guardar para subir
    previewImage.src = selectedImage;
    preview.classList.remove('hidden');
    dropZone.classList.add('hidden');
    scanBtn.disabled = false;
    scanText.textContent = 'Escanear y rellenar';
    results.classList.add('hidden');
    hideStatusMessage();
  };
  reader.readAsDataURL(file);
}

// Procesar 2 imágenes para DNI español
function handleDniImages(file1, file2) {
  isDniMode = true;
  selectedImage = null;
  preview.classList.add('hidden');
  
  const promises = [
    readFileAsDataURL(file1),
    readFileAsDataURL(file2)
  ];
  
  Promise.all(promises).then(([img1, img2]) => {
    selectedImages = [img1, img2];
    // Para DNI: la penúltima imagen (img2) es probablemente el anverso (se escanea primero)
    // que es la que tiene la foto y es más útil para identificar al huésped
    imageToUpload = img2;
    previewImage1.src = img1;
    previewImage2.src = img2;
    previewDni.classList.remove('hidden');
    dropZone.classList.add('hidden');
    scanBtn.disabled = false;
    scanText.textContent = 'Escanear DNI y rellenar';
    results.classList.add('hidden');
    hideStatusMessage();
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// Limpiar imagen
clearImageBtn.addEventListener('click', () => {
  clearAllImages();
});

// Limpiar imágenes DNI
clearDniImages.addEventListener('click', () => {
  clearAllImages();
});

function clearAllImages() {
  selectedImage = null;
  selectedImages = [];
  imageToUpload = null;
  isDniMode = false;
  extractedData = null;
  preview.classList.add('hidden');
  previewDni.classList.add('hidden');
  dropZone.classList.remove('hidden');
  scanBtn.disabled = true;
  scanText.textContent = 'Escanear y rellenar';
  results.classList.add('hidden');
  fileInput.value = '';
  hideStatusMessage();
}

// Verificar si el formulario está en modo edición
async function checkEditMode() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url || !tab.url.includes('cloudbeds.com')) {
      return { isEditMode: false, error: 'Esta página no es de Cloudbeds' };
    }
    
    // Intentar enviar mensaje al content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkEditMode' });
      return response;
    } catch (sendError) {
      // Si falla, intentar inyectar el content script primero
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['countries.js', 'municipios.js', 'content.js']
      });
      
      // Esperar un momento y reintentar
      await new Promise(resolve => setTimeout(resolve, 100));
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkEditMode' });
      return response;
    }
  } catch (error) {
    return { isEditMode: false, error: 'Primero haz clic en "Editar detalles" en Cloudbeds' };
  }
}

// Escanear Y Rellenar (todo en uno)
scanBtn.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['openaiApiKey']);
  if (!stored.openaiApiKey) {
    showStatusMessage('Configura tu API Key de OpenAI en ⚙️', 'error');
    return;
  }

  // Validar que tenemos imagen(es)
  if (isDniMode) {
    if (selectedImages.length !== 2) {
      showStatusMessage('Por favor carga las 2 caras del DNI', 'error');
      return;
    }
  } else {
    if (!selectedImage) {
      showStatusMessage('Por favor selecciona una imagen', 'error');
      return;
    }
  }

  setLoading(true);
  hideStatusMessage();

  try {
    // Paso 1: Extraer datos con OpenAI
    showStatusMessage('Escaneando documento...', 'success');
    
    if (isDniMode) {
      // Modo DNI español: enviar las 2 imágenes
      extractedData = await extractDataFromDniImages(stored.openaiApiKey, selectedImages);
    } else {
      // Modo normal: una sola imagen
      extractedData = await extractDataFromImage(stored.openaiApiKey, selectedImage);
    }
    
    displayExtractedData(extractedData);
    results.classList.remove('hidden');
    
    // Paso 2: Rellenar formulario en Cloudbeds
    showStatusMessage('Rellenando formulario...', 'success');
    await fillCloudbedsForm(extractedData);
    
  } catch (error) {
    showStatusMessage(`Error: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
});

// Rellenar formulario en Cloudbeds
async function fillCloudbedsForm(data) {
  try {
    // Obtener la pestaña activa
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('cloudbeds.com')) {
      throw new Error('Abre la página de Cloudbeds primero');
    }

    // Verificar si el content script está cargado
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    } catch (pingError) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['countries.js', 'municipios.js', 'content.js']
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (injectError) {
        throw new Error('Recarga la página de Cloudbeds y vuelve a intentar');
      }
    }

    // Verificar si debe subir la imagen
    const settings = await chrome.storage.local.get(['uploadPhoto']);
    const shouldUploadImage = settings.uploadPhoto === true ? imageToUpload : null;

    // Enviar datos al content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillGuestForm',
      data: data,
      imageToUpload: shouldUploadImage // Solo enviar si está activado
    });

    if (response && response.success) {
      let message = `✅ ¡Listo! ${response.filledCount || ''} campos rellenados`;
      if (response.photoUploaded) {
        message += ' + foto subida';
      }
      showStatusMessage(message, 'success');
    } else {
      throw new Error(response?.error || 'Error al rellenar el formulario');
    }
  } catch (error) {
    throw error;
  }
}

// Llamada a OpenAI Vision API
async function extractDataFromImage(apiKey, imageBase64) {
  const prompt = `Analiza esta imagen de un documento de identidad (pasaporte, DNI, NIE, carnet de conducir, etc.) y extrae los siguientes datos en formato JSON. Si algún dato no está visible o no aplica, usa null.

Devuelve SOLO un JSON válido con esta estructura exacta (sin markdown ni texto adicional):
{
  "firstName": "nombre(s) de pila",
  "lastName": "primer apellido",
  "lastName2": "segundo apellido (si aplica)",
  "birthDate": "fecha de nacimiento en formato DD/MM/YYYY",
  "gender": "M para masculino, F para femenino, o null si no está claro",
  "nationality": "nacionalidad (nombre del país en INGLÉS, ej: Spain, Germany, France)",
  "documentType": "passport, dni, nie, o driver_licence",
  "documentNumber": "número del documento",
  "issueDate": "fecha de emisión en formato DD/MM/YYYY",
  "expirationDate": "fecha de caducidad en formato DD/MM/YYYY",
  "issuingCountry": "país que expidió el documento (código ISO de 2 letras, ej: ES para España)",
  "address": "dirección si aparece",
  "city": "ciudad si aparece",
  "country": "país de residencia (código ISO de 2 letras)",
  "supportNumber": "número de soporte (solo para DNI español, está en la parte inferior derecha)"
}

IMPORTANTE: 
- Para documentos españoles, el DNI tiene 8 números y una letra
- El NIE tiene una letra inicial (X, Y, Z), 7 números y una letra final
- Extrae los datos exactamente como aparecen en el documento
- La nacionalidad SIEMPRE debe estar en inglés (ej: Spain, Germany, France, Italy)`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_completion_tokens: 2000,
      reasoning_effort: 'minimal'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la API de OpenAI');
  }

  const data = await response.json();
  
  // Guardar uso de tokens
  const tokenUsage = data.usage || null;
  
  const content = data.choices[0].message.content.trim();
  
  // Limpiar el JSON si viene con markdown
  let jsonStr = content;
  if (content.includes('```json')) {
    jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (content.includes('```')) {
    jsonStr = content.replace(/```\n?/g, '');
  }
  
  try {
    const result = JSON.parse(jsonStr);
    result._tokenUsage = tokenUsage; // Añadir info de tokens
    return result;
  } catch (e) {
    throw new Error('No se pudo parsear la respuesta de OpenAI');
  }
}

// Llamada a OpenAI Vision API para DNI español (2 imágenes: anverso y reverso)
async function extractDataFromDniImages(apiKey, images) {
  const prompt = `Analiza estas 2 imágenes y determina si son el anverso y reverso de un DNI español.

PRIMERO verifica:
1. ¿Es la primera imagen parte de un DNI español (anverso o reverso)?
2. ¿Es la segunda imagen parte de un DNI español (anverso o reverso)?
3. ¿Tienes AMBAS caras (anverso Y reverso)?

El ANVERSO del DNI español contiene:
- Foto del titular
- Nombre y apellidos
- Fecha de nacimiento
- Sexo (M/F)
- Nacionalidad
- Número del DNI (8 números + 1 letra)
- Fecha de validez/caducidad
- Número de soporte (código alfanumérico debajo de la fecha de validez)

El REVERSO del DNI español contiene:
- Dirección completa (calle, número, piso, puerta)
- Código postal
- Localidad/Ciudad
- Provincia
- Lugar de nacimiento
- Nombre de los padres
- Código MRZ (zona de lectura mecánica)

Devuelve SOLO un JSON válido con esta estructura exacta (sin markdown ni texto adicional):
{
  "validation": {
    "isValidDni": true/false,
    "hasAnverso": true/false,
    "hasReverso": true/false,
    "errorMessage": "mensaje de error si no es válido, null si es válido"
  },
  "firstName": "nombre(s) de pila",
  "lastName": "primer apellido",
  "lastName2": "segundo apellido",
  "birthDate": "fecha de nacimiento en formato DD/MM/YYYY",
  "gender": "M para masculino, F para femenino",
  "nationality": "Spain",
  "documentType": "dni",
  "documentNumber": "número del DNI (8 números + letra)",
  "issueDate": "fecha de expedición en formato DD/MM/YYYY (si visible)",
  "expirationDate": "fecha de caducidad/validez en formato DD/MM/YYYY",
  "issuingCountry": "ES",
  "address": "dirección completa (calle, número, piso, puerta)",
  "zipCode": "código postal de 5 dígitos",
  "city": "localidad/ciudad",
  "province": "provincia",
  "country": "ES",
  "supportNumber": "número de soporte (código alfanumérico, ej: ABC123456)"
}

IMPORTANTE:
- Si las imágenes NO son un DNI español válido con ambas caras, pon isValidDni=false y describe el problema en errorMessage
- Ejemplos de errores: "Solo se detectó el anverso, falta el reverso", "La imagen 1 no es un DNI español", "Ambas imágenes son el mismo lado del DNI"
- Solo extrae los datos si isValidDni=true
- La dirección está en el REVERSO del DNI
- El número de soporte está en el ANVERSO, debajo de la fecha de validez
- Si algún dato no es legible, usa null`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: images[0],
                detail: 'high'
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: images[1],
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_completion_tokens: 2500,
      reasoning_effort: 'minimal'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la API de OpenAI');
  }

  const data = await response.json();
  
  // Guardar uso de tokens
  const tokenUsage = data.usage || null;
  
  const content = data.choices[0].message.content.trim();
  
  // Limpiar el JSON si viene con markdown
  let jsonStr = content;
  if (content.includes('```json')) {
    jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (content.includes('```')) {
    jsonStr = content.replace(/```\n?/g, '');
  }
  
  try {
    const result = JSON.parse(jsonStr);
    
    // Validar que sea un DNI español válido con ambas caras
    if (result.validation) {
      if (!result.validation.isValidDni) {
        const errorMsg = result.validation.errorMessage || 'Las imágenes no corresponden a un DNI español válido';
        throw new Error(`⚠️ ${errorMsg}`);
      }
      if (!result.validation.hasAnverso) {
        throw new Error('⚠️ No se detectó el anverso del DNI (cara con la foto)');
      }
      if (!result.validation.hasReverso) {
        throw new Error('⚠️ No se detectó el reverso del DNI (cara con la dirección)');
      }
      
      // Eliminar el objeto validation del resultado final
      delete result.validation;
    }
    
    result._tokenUsage = tokenUsage; // Añadir info de tokens
    return result;
  } catch (e) {
    if (e.message.startsWith('⚠️')) {
      throw e; // Re-lanzar errores de validación
    }
    throw new Error('No se pudo parsear la respuesta de OpenAI');
  }
}

// Mostrar datos extraídos
function displayExtractedData(data) {
  const labels = {
    firstName: 'Nombre',
    lastName: 'Apellido',
    lastName2: 'Segundo Apellido',
    birthDate: 'Fecha Nacimiento',
    gender: 'Género',
    nationality: 'Nacionalidad',
    documentType: 'Tipo Documento',
    documentNumber: 'Nº Documento',
    issueDate: 'Fecha Emisión',
    expirationDate: 'Fecha Caducidad',
    issuingCountry: 'País Expedidor',
    address: 'Dirección',
    zipCode: 'Código Postal',
    city: 'Ciudad',
    province: 'Provincia',
    country: 'País',
    supportNumber: 'Nº Soporte'
  };

  const genderLabels = { M: 'Masculino', F: 'Femenino' };
  const docTypeLabels = {
    passport: 'Pasaporte',
    dni: 'DNI',
    nie: 'NIE',
    driver_licence: 'Licencia'
  };

  extractedDataDiv.innerHTML = '';
  
  for (const [key, value] of Object.entries(data)) {
    if (key === '_tokenUsage') continue; // Saltar campo interno de tokens
    if (value !== null && value !== '') {
      const row = document.createElement('div');
      row.className = 'data-row';
      
      let displayValue = value;
      if (key === 'gender') displayValue = genderLabels[value] || value;
      if (key === 'documentType') displayValue = docTypeLabels[value] || value;
      
      row.innerHTML = `
        <span class="data-label">${labels[key] || key}</span>
        <span class="data-value">${displayValue}</span>
      `;
      extractedDataDiv.appendChild(row);
    }
  }
  
  // Mostrar uso de tokens
  if (data._tokenUsage) {
    const usage = data._tokenUsage;
    tokenUsageDiv.innerHTML = `
      <div class="data-row"><span class="data-label">Tokens enviados</span><span class="data-value">${usage.prompt_tokens.toLocaleString()}</span></div>
      <div class="data-row"><span class="data-label">Tokens recibidos</span><span class="data-value">${usage.completion_tokens.toLocaleString()}</span></div>
      <div class="data-row"><span class="data-label">Total tokens</span><span class="data-value">${usage.total_tokens.toLocaleString()}</span></div>
    `;
  }
}

// Funciones auxiliares
function setLoading(loading) {
  scanBtn.disabled = loading;
  if (loading) {
    scanText.textContent = 'Procesando...';
  } else {
    scanText.textContent = isDniMode ? 'Escanear DNI y rellenar' : 'Escanear y rellenar';
  }
  scanLoader.classList.toggle('hidden', !loading);
}

function showStatusMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
}

function hideStatusMessage() {
  statusMessage.classList.add('hidden');
}

// ============ INDEXEDDB PARA GUARDAR EL HANDLE DE LA CARPETA ============

const DB_NAME = 'CloudbedsIDScanner';
const DB_VERSION = 1;
const STORE_NAME = 'folderHandles';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveFolderHandle(handle) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, 'scanFolder');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

async function loadFolderHandle() {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('scanFolder');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    return null;
  }
}

async function verifyPermission(handle) {
  if (!handle) return false;
  
  // Verificar si tenemos permiso
  const options = { mode: 'read' };
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  // Solicitar permiso si no lo tenemos
  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
}

// Variable para guardar el handle de la carpeta
let scanFolderHandle = null;

// Cargar el handle guardado al iniciar
async function initializeFolderHandle() {
  const savedHandle = await loadFolderHandle();
  if (savedHandle) {
    scanFolderHandle = savedHandle;
    scanFolderPath.textContent = savedHandle.name;
  }
}

// Inicializar al cargar
initializeFolderHandle();

// Seleccionar carpeta de escaneos
selectFolderBtn.addEventListener('click', async () => {
  try {
    // Pedir permiso para acceder a una carpeta
    scanFolderHandle = await window.showDirectoryPicker({
      mode: 'read'
    });
    
    // Guardar el handle en IndexedDB
    await saveFolderHandle(scanFolderHandle);
    
    // Guardar el nombre en chrome.storage para mostrarlo
    const folderName = scanFolderHandle.name;
    scanFolderPath.textContent = folderName;
    await chrome.storage.local.set({ scanFolderName: folderName });
    
    showFolderStatus('Carpeta configurada ✓', 'success');
  } catch (error) {
    if (error.name !== 'AbortError') {
      showFolderStatus('Error al seleccionar carpeta', 'error');
    }
  }
});

function showFolderStatus(message, type) {
  folderStatus.textContent = message;
  folderStatus.className = `status ${type}`;
  setTimeout(() => {
    folderStatus.textContent = '';
    folderStatus.className = 'status';
  }, 3000);
}

// Cargar último escaneo de la carpeta
loadScanBtn.addEventListener('click', async () => {
  try {
    // Intentar cargar el handle si no lo tenemos
    if (!scanFolderHandle) {
      scanFolderHandle = await loadFolderHandle();
    }
    
    // Verificar si hay una carpeta configurada
    if (!scanFolderHandle) {
      showStatusMessage('Configura la carpeta de escaneos en ⚙️', 'error');
      optionsPanel.classList.remove('hidden');
      return;
    }
    
    // Verificar/solicitar permiso
    const hasPermission = await verifyPermission(scanFolderHandle);
    if (!hasPermission) {
      showStatusMessage('Permiso denegado. Configura la carpeta en ⚙️', 'error');
      optionsPanel.classList.remove('hidden');
      return;
    }
    
    // Verificar que estamos en modo edición
    const editCheck = await checkEditMode();
    if (!editCheck.isEditMode) {
      const errorMsg = editCheck.error || 'Primero haz clic en "Editar detalles" en Cloudbeds';
      showStatusMessage(`⚠️ ${errorMsg}`, 'error');
      return;
    }
    
    showStatusMessage('Buscando último escaneo...', 'success');
    
    // Buscar el archivo más reciente en la carpeta
    let latestFile = null;
    let latestTime = 0;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp'];
    
    for await (const entry of scanFolderHandle.values()) {
      if (entry.kind === 'file') {
        const name = entry.name.toLowerCase();
        const isImage = imageExtensions.some(ext => name.endsWith(ext));
        
        if (isImage) {
          const file = await entry.getFile();
          if (file.lastModified > latestTime) {
            latestTime = file.lastModified;
            latestFile = file;
          }
        }
      }
    }
    
    if (!latestFile) {
      showStatusMessage('No se encontraron imágenes en la carpeta', 'error');
      return;
    }
    
    // Cargar la imagen
    handleImageFile(latestFile);
    hideStatusMessage();
    
  } catch (error) {
    showStatusMessage(`Error: ${error.message}`, 'error');
  }
});

// Cargar los 2 últimos escaneos para DNI español
loadDniBtn.addEventListener('click', async () => {
  try {
    // Intentar cargar el handle si no lo tenemos
    if (!scanFolderHandle) {
      scanFolderHandle = await loadFolderHandle();
    }
    
    // Verificar si hay una carpeta configurada
    if (!scanFolderHandle) {
      showStatusMessage('Configura la carpeta de escaneos en ⚙️', 'error');
      optionsPanel.classList.remove('hidden');
      return;
    }
    
    // Verificar/solicitar permiso
    const hasPermission = await verifyPermission(scanFolderHandle);
    if (!hasPermission) {
      showStatusMessage('Permiso denegado. Configura la carpeta en ⚙️', 'error');
      optionsPanel.classList.remove('hidden');
      return;
    }
    
    // Verificar que estamos en modo edición
    const editCheck = await checkEditMode();
    if (!editCheck.isEditMode) {
      const errorMsg = editCheck.error || 'Primero haz clic en "Editar detalles" en Cloudbeds';
      showStatusMessage(`⚠️ ${errorMsg}`, 'error');
      return;
    }
    
    showStatusMessage('Buscando últimos 2 escaneos...', 'success');
    
    // Buscar los 2 archivos más recientes en la carpeta
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp'];
    const files = [];
    
    for await (const entry of scanFolderHandle.values()) {
      if (entry.kind === 'file') {
        const name = entry.name.toLowerCase();
        const isImage = imageExtensions.some(ext => name.endsWith(ext));
        
        if (isImage) {
          const file = await entry.getFile();
          files.push(file);
        }
      }
    }
    
    if (files.length < 2) {
      showStatusMessage('Se necesitan al menos 2 imágenes en la carpeta', 'error');
      return;
    }
    
    // Ordenar por fecha (más recientes primero)
    files.sort((a, b) => b.lastModified - a.lastModified);
    
    // Coger los 2 más recientes
    const file1 = files[0];
    const file2 = files[1];
    
    handleDniImages(file1, file2);
    hideStatusMessage();
    
  } catch (error) {
    showStatusMessage(`Error: ${error.message}`, 'error');
  }
});
