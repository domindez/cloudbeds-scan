// Estado de la aplicación
let selectedImage = null;
let selectedImages = []; // Para DNI español (2 imágenes)
let extractedData = null;
let isDniMode = false; // Modo DNI español (2 caras)

// Elementos del DOM
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const saveKeyBtn = document.getElementById('saveKey');
const keyStatus = document.getElementById('keyStatus');
const toggleOptionsBtn = document.getElementById('toggleOptions');
const optionsPanel = document.getElementById('optionsPanel');
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
const statusMessage = document.getElementById('statusMessage');

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar API Key guardada
  const stored = await chrome.storage.local.get(['openaiApiKey', 'scanFolderName']);
  if (stored.openaiApiKey) {
    apiKeyInput.value = stored.openaiApiKey;
  }
  if (stored.scanFolderName) {
    scanFolderPath.textContent = stored.scanFolderName;
  }
});

// Toggle panel de opciones
toggleOptionsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  optionsPanel.classList.toggle('hidden');
});

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
  
  // Cerrar panel después de guardar
  setTimeout(() => {
    optionsPanel.classList.add('hidden');
  }, 1000);
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
selectFileBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
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
    previewImage.src = selectedImage;
    preview.classList.remove('hidden');
    dropZone.classList.add('hidden');
    scanBtn.disabled = false;
    scanText.textContent = '🔍 Escanear y Rellenar';
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
    previewImage1.src = img1;
    previewImage2.src = img2;
    previewDni.classList.remove('hidden');
    dropZone.classList.add('hidden');
    scanBtn.disabled = false;
    scanText.textContent = '🔍 Escanear DNI y Rellenar';
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
  isDniMode = false;
  extractedData = null;
  preview.classList.add('hidden');
  previewDni.classList.add('hidden');
  dropZone.classList.remove('hidden');
  scanBtn.disabled = true;
  scanText.textContent = '🔍 Escanear y Rellenar';
  results.classList.add('hidden');
  fileInput.value = '';
  hideStatusMessage();
}

// Escanear Y Rellenar (todo en uno)
scanBtn.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['openaiApiKey']);
  if (!stored.openaiApiKey) {
    showStatusMessage('Configura tu API Key de OpenAI en ⚙️', 'error');
    optionsPanel.classList.remove('hidden');
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
    console.error('Error:', error);
    showStatusMessage(`Error: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
});

// Rellenar formulario en Cloudbeds
async function fillCloudbedsForm(data) {
  console.log('🔵 [POPUP] Iniciando relleno de formulario');
  
  try {
    // Obtener la pestaña activa
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('🔵 [POPUP] Tab activa:', tab.id, tab.url);
    
    if (!tab.url.includes('cloudbeds.com')) {
      throw new Error('Abre la página de Cloudbeds primero');
    }

    // Verificar si el content script está cargado
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    } catch (pingError) {
      console.log('🔵 [POPUP] Inyectando content script...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (injectError) {
        throw new Error('Recarga la página de Cloudbeds y vuelve a intentar');
      }
    }

    // Enviar datos al content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillGuestForm',
      data: data
    });

    if (response && response.success) {
      showStatusMessage(`✅ ¡Listo! ${response.filledCount || ''} campos rellenados`, 'success');
    } else {
      throw new Error(response?.error || 'Error al rellenar el formulario');
    }
  } catch (error) {
    console.error('🔴 [POPUP] Error:', error);
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
  "nationality": "nacionalidad (nombre del país en español)",
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
- Si el documento está en otro idioma, traduce la nacionalidad al español`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
      max_tokens: 1000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la API de OpenAI');
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  // Limpiar el JSON si viene con markdown
  let jsonStr = content;
  if (content.includes('```json')) {
    jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (content.includes('```')) {
    jsonStr = content.replace(/```\n?/g, '');
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON parse error:', jsonStr);
    throw new Error('No se pudo parsear la respuesta de OpenAI');
  }
}

// Llamada a OpenAI Vision API para DNI español (2 imágenes: anverso y reverso)
async function extractDataFromDniImages(apiKey, images) {
  const prompt = `Analiza estas 2 imágenes de un DNI español (anverso y reverso, en cualquier orden) y extrae TODOS los datos visibles en formato JSON.

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

Devuelve SOLO un JSON válido con esta estructura exacta (sin markdown ni texto adicional):
{
  "firstName": "nombre(s) de pila",
  "lastName": "primer apellido",
  "lastName2": "segundo apellido",
  "birthDate": "fecha de nacimiento en formato DD/MM/YYYY",
  "gender": "M para masculino, F para femenino",
  "nationality": "España",
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
- Extrae TODOS los datos de AMBAS imágenes y combínalos
- La dirección está en el REVERSO del DNI
- El número de soporte está en el ANVERSO, debajo de la fecha de validez
- Asegúrate de extraer el código postal correctamente (5 dígitos)
- Si algún dato no es legible, usa null`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
      max_tokens: 1200,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error en la API de OpenAI');
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  // Limpiar el JSON si viene con markdown
  let jsonStr = content;
  if (content.includes('```json')) {
    jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (content.includes('```')) {
    jsonStr = content.replace(/```\n?/g, '');
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON parse error:', jsonStr);
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
}

// Funciones auxiliares
function setLoading(loading) {
  scanBtn.disabled = loading;
  scanText.textContent = loading ? 'Procesando...' : '🔍 Escanear y Rellenar';
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
    console.error('Error loading folder handle:', error);
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
    console.log('Handle de carpeta recuperado:', savedHandle.name);
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
      console.error('Error seleccionando carpeta:', error);
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
    console.log('Cargando archivo:', latestFile.name, 'Fecha:', new Date(latestFile.lastModified));
    handleImageFile(latestFile);
    hideStatusMessage();
    
  } catch (error) {
    console.error('Error cargando escaneo:', error);
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
    
    console.log('Cargando DNI - Imagen 1:', file1.name, 'Fecha:', new Date(file1.lastModified));
    console.log('Cargando DNI - Imagen 2:', file2.name, 'Fecha:', new Date(file2.lastModified));
    
    handleDniImages(file1, file2);
    hideStatusMessage();
    
  } catch (error) {
    console.error('Error cargando escaneos DNI:', error);
    showStatusMessage(`Error: ${error.message}`, 'error');
  }
});
