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
const selectDniFilesBtn = document.getElementById('selectDniFilesBtn');
const fileInput = document.getElementById('fileInput');
const fileInputMultiple = document.getElementById('fileInputMultiple');
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

// Elementos de la vista de progreso
const progressView = document.getElementById('progressView');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const progressActions = document.getElementById('progressActions');
const scanAnotherBtn = document.getElementById('scanAnotherBtn');
const errorActions = document.getElementById('errorActions');
const retryBtn = document.getElementById('retryBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressData = document.getElementById('progressData');
const progressExtractedData = document.getElementById('progressExtractedData');
const progressTokenUsage = document.getElementById('progressTokenUsage');

// Elementos adicionales
const uploadPhotoCheckbox = document.getElementById('uploadPhotoCheckbox');
const faceDetectionError = document.getElementById('faceDetectionError');
const faceSelector = document.getElementById('faceSelector');
const faceSelectorGrid = document.getElementById('faceSelectorGrid');
const faceSelectorDni = document.getElementById('faceSelectorDni');
const faceSelectorGridDni = document.getElementById('faceSelectorGridDni');
const noPhotoBtn = document.getElementById('noPhotoBtn');
const noPhotoBtnDni = document.getElementById('noPhotoBtnDni');

// Variables para almacenar resultados de detección
let detectedFaces = null;
let selectedFaceIndex = 0;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración guardada
  const stored = await chrome.storage.local.get(['openaiApiKey', 'scanFolderName', 'uploadPhoto', 'priceComparisonEnabled']);
  if (stored.openaiApiKey) {
    apiKeyInput.value = stored.openaiApiKey;
  }
  if (stored.scanFolderName) {
    scanFolderPath.textContent = stored.scanFolderName;
  }
  // Por defecto está desactivado
  uploadPhotoCheckbox.checked = stored.uploadPhoto === true;
  
  // Por defecto la comparación de precios está activada
  const priceComparisonCheckbox = document.getElementById('priceComparisonCheckbox');
  if (priceComparisonCheckbox) {
    priceComparisonCheckbox.checked = stored.priceComparisonEnabled !== false;
  }
  
  // Inicializar tabs
  initTabs();
});

// Guardar preferencia de subir foto
uploadPhotoCheckbox.addEventListener('change', async () => {
  await chrome.storage.local.set({ uploadPhoto: uploadPhotoCheckbox.checked });
});

// Guardar preferencia de comparación de precios
const priceComparisonCheckbox = document.getElementById('priceComparisonCheckbox');
if (priceComparisonCheckbox) {
  priceComparisonCheckbox.addEventListener('change', async () => {
    await chrome.storage.local.set({ priceComparisonEnabled: priceComparisonCheckbox.checked });
    // Notificar a todos los tabs de CloudBeds del cambio
    chrome.tabs.query({ url: '*://*.cloudbeds.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'togglePriceComparison', 
          enabled: priceComparisonCheckbox.checked 
        }).catch(() => {});
      });
    });
  });
}

// Escanear otro documento
scanAnotherBtn.addEventListener('click', () => {
  hideProgressView();
  clearAllImages();
});

// Reintentar tras error
retryBtn.addEventListener('click', async () => {
  // Resetear y volver a intentar
  resetProgressSteps();
  progressActions.classList.add('hidden');
  errorActions.classList.add('hidden');
  progressData.classList.add('hidden');
  
  // Simular click en el botón de escanear
  scanBtn.click();
});

// Cancelar y volver
cancelBtn.addEventListener('click', () => {
  hideProgressView();
});

// Botones "Sin foto"
noPhotoBtn.addEventListener('click', () => {
  console.log('[DEBUG] Usuario eligió continuar sin foto');
  imageToUpload = null;
  faceSelector.classList.add('hidden');
  faceDetectionError.classList.remove('hidden');
});

noPhotoBtnDni.addEventListener('click', () => {
  console.log('[DEBUG] Usuario eligió continuar sin foto (DNI)');
  imageToUpload = null;
  faceSelectorDni.classList.add('hidden');
  faceDetectionError.classList.remove('hidden');
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

// Click en botón de seleccionar 2 archivos para DNI/NIE
selectDniFilesBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Verificar que estamos en modo edición
  const editCheck = await checkEditMode();
  if (!editCheck.isEditMode) {
    const errorMsg = editCheck.error || 'Primero haz clic en "Editar detalles" en Cloudbeds';
    showStatusMessage(`⚠️ ${errorMsg}`, 'error');
    return;
  }
  
  fileInputMultiple.click();
});

// Selección de archivo único
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleImageFile(file);
  }
});

// Selección de múltiples archivos para DNI/NIE
fileInputMultiple.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length >= 2) {
    // Ordenar por fecha de modificación (más reciente primero)
    files.sort((a, b) => b.lastModified - a.lastModified);
    handleDniImages(files[0], files[1]);
  } else if (files.length === 1) {
    showStatusMessage('⚠️ Selecciona 2 imágenes (anverso y reverso)', 'error');
  }
  // Limpiar input para permitir seleccionar los mismos archivos de nuevo
  fileInputMultiple.value = '';
});

// Función para intentar extraer la cara del documento
async function attemptFaceExtraction() {
  console.log('[DEBUG] attemptFaceExtraction - Iniciando...');
  console.log('[DEBUG] uploadPhotoCheckbox.checked:', uploadPhotoCheckbox.checked);
  console.log('[DEBUG] isDniMode:', isDniMode);
  
  // Ocultar mensajes previos
  faceDetectionError.classList.add('hidden');
  faceSelector.classList.add('hidden');
  faceSelectorDni.classList.add('hidden');
  detectedFaces = null;
  selectedFaceIndex = 0;
  
  // Si la opción de subir foto no está activada, usar imagen completa o DNI según corresponda
  if (!uploadPhotoCheckbox.checked) {
    console.log('[DEBUG] Subida de foto desactivada, usando imagen completa');
    if (isDniMode) {
      imageToUpload = selectedImages[1]; // Imagen 2 del DNI (anverso)
    } else {
      imageToUpload = selectedImage; // Documento completo
    }
    return;
  }
  
  // Si no hay face detector disponible, no intentar
  if (!window.faceDetector) {
    console.error('[DEBUG] Face detector NO disponible');
    imageToUpload = null;
    return;
  }
  
  console.log('[DEBUG] Face detector disponible, procediendo con extracción...');
  
  // Intentar extraer la cara
  if (isDniMode) {
    // Para DNI: intentar con ambas imágenes
    await attemptDniFaceExtraction();
  } else {
    // Para imagen única
    await attemptSingleImageFaceExtraction();
  }
}

// Extraer cara de DNI (intentar con ambas imágenes)
async function attemptDniFaceExtraction() {
  const [img1, img2] = selectedImages;
  console.log('[DEBUG] attemptDniFaceExtraction - Intentando con DNI (2 imágenes)');
  
  let lastError = null;
  
  // Intentar con imagen 1
  try {
    console.log('[DEBUG] Procesando imagen 1 del DNI...');
    const result = await window.faceDetector.extractFaceFromDocument(img1, {
      padding: 0.3,
      minConfidence: 0.6,
      targetSize: 500
    });
    
    console.log('[DEBUG] Resultado imagen 1:', {
      needsManualSelection: result.needsManualSelection,
      confidence: result.confidence,
      totalFaces: result.totalFaces
    });
    
    if (result.needsManualSelection) {
      console.log('[DEBUG] Necesita selección manual, obteniendo todas las caras...');
      // Obtener todas las caras para selección manual
      const allFaces = await window.faceDetector.getAllFacesFromDocument(img1, {
        padding: 0.3,
        targetSize: 500
      });
      console.log('[DEBUG] Caras detectadas:', allFaces.faces?.length || 0);
      await showFaceSelector(allFaces);
      return;
    } else {
      imageToUpload = result.imageBase64;
      console.log(`[DEBUG] ✓ Foto automática de imagen 1 (${(result.confidence * 100).toFixed(1)}%)`);
      faceDetectionError.classList.add('hidden');
      return;
    }
  } catch (error1) {
    console.log('[DEBUG] Error en imagen 1:', error1.message);
    lastError = error1;
  }
  
  // Intentar con imagen 2
  try {
    console.log('[DEBUG] Procesando imagen 2 del DNI...');
    const result = await window.faceDetector.extractFaceFromDocument(img2, {
      padding: 0.3,
      minConfidence: 0.6,
      targetSize: 500
    });
    
    console.log('[DEBUG] Resultado imagen 2:', {
      needsManualSelection: result.needsManualSelection,
      confidence: result.confidence,
      totalFaces: result.totalFaces
    });
    
    if (result.needsManualSelection) {
      console.log('[DEBUG] Necesita selección manual, obteniendo todas las caras...');
      // Obtener todas las caras para selección manual
      const allFaces = await window.faceDetector.getAllFacesFromDocument(img2, {
        padding: 0.3,
        targetSize: 500
      });
      console.log('[DEBUG] Caras detectadas:', allFaces.faces?.length || 0);
      await showFaceSelector(allFaces);
      return;
    } else {
      imageToUpload = result.imageBase64;
      console.log(`[DEBUG] ✓ Foto automática de imagen 2 (${(result.confidence * 100).toFixed(1)}%)`);
      faceDetectionError.classList.add('hidden');
      return;
    }
  } catch (error2) {
    console.log('[DEBUG] Error en imagen 2:', error2.message);
    lastError = error2;
  }
  
  // Si llegamos aquí, no se detectó ninguna cara
  console.error('[DEBUG] ⚠️ No se detectó cara en ninguna imagen del DNI');
  console.error('[DEBUG] Último error:', lastError?.message);
  imageToUpload = null;
  if (uploadPhotoCheckbox.checked) {
    faceDetectionError.classList.remove('hidden');
  }
}

// Extraer cara de imagen única
async function attemptSingleImageFaceExtraction() {
  console.log('[DEBUG] attemptSingleImageFaceExtraction - Procesando imagen única...');
  
  try {
    const result = await window.faceDetector.extractFaceFromDocument(selectedImage, {
      padding: 0.3,
      minConfidence: 0.6,
      targetSize: 500
    });
    
    console.log('[DEBUG] Resultado detección:', {
      needsManualSelection: result.needsManualSelection,
      confidence: result.confidence,
      totalFaces: result.totalFaces,
      hasImageBase64: !!result.imageBase64
    });
    
    if (result.needsManualSelection) {
      console.log('[DEBUG] Necesita selección manual, obteniendo todas las caras...');
      // Obtener todas las caras para selección manual
      const allFaces = await window.faceDetector.getAllFacesFromDocument(selectedImage, {
        padding: 0.3,
        targetSize: 500
      });
      console.log('[DEBUG] Caras detectadas para selección:', allFaces.faces?.length || 0);
      await showFaceSelector(allFaces);
    } else {
      imageToUpload = result.imageBase64;
      console.log(`[DEBUG] ✓ Foto automática extraída (${(result.confidence * 100).toFixed(1)}%)`);
      faceDetectionError.classList.add('hidden');
    }
  } catch (error) {
    console.error('[DEBUG] ⚠️ Error extrayendo foto:', error.message);
    console.error('[DEBUG] Stack:', error.stack);
    imageToUpload = null;
    if (uploadPhotoCheckbox.checked) {
      faceDetectionError.classList.remove('hidden');
    }
  }
}

// Mostrar selector de caras
async function showFaceSelector(allFaces) {
  console.log('[DEBUG] showFaceSelector - Recibido:', allFaces);
  console.log('[DEBUG] isDniMode:', isDniMode);
  
  if (!allFaces || !allFaces.faces || allFaces.faces.length === 0) {
    console.error('[DEBUG] No hay caras para mostrar en el selector');
    imageToUpload = null;
    faceDetectionError.classList.remove('hidden');
    return;
  }
  
  console.log('[DEBUG] Mostrando selector con', allFaces.faces.length, 'caras');
  console.log('[DEBUG] Mejor cara (índice):', allFaces.bestFaceIndex);
  console.log('[DEBUG] Confianza más alta:', allFaces.highestConfidence);
  
  detectedFaces = allFaces;
  selectedFaceIndex = allFaces.bestFaceIndex || 0;
  
  // Seleccionar el grid correcto según el modo
  const currentGrid = isDniMode ? faceSelectorGridDni : faceSelectorGrid;
  const currentSelector = isDniMode ? faceSelectorDni : faceSelector;
  
  console.log('[DEBUG] Usando grid:', isDniMode ? 'faceSelectorGridDni' : 'faceSelectorGrid');
  
  // Limpiar grid anterior
  currentGrid.innerHTML = '';
  
  // Crear opciones para cada cara detectada
  allFaces.faces.forEach((face, index) => {
    const option = document.createElement('div');
    option.className = 'face-option';
    if (index === selectedFaceIndex) {
      option.classList.add('selected');
    }
    
    const img = document.createElement('img');
    img.src = face.imageBase64;
    img.alt = `Opción ${index + 1}`;
    
    const label = document.createElement('div');
    label.className = 'face-option-label';
    
    // Resaltar la mejor opción (más confianza)
    const isBest = index === selectedFaceIndex;
    label.innerHTML = `
      <span class="face-number">Opción ${index + 1}${isBest ? ' ⭐' : ''}</span>
      <span class="face-confidence">${(face.confidence * 100).toFixed(0)}% confianza</span>
    `;
    
    option.appendChild(img);
    option.appendChild(label);
    
    option.addEventListener('click', () => {
      console.log('[DEBUG] Click en cara', index + 1);
      // Remover selección anterior
      document.querySelectorAll('.face-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      
      // Seleccionar esta opción
      option.classList.add('selected');
      selectedFaceIndex = index;
      imageToUpload = face.imageBase64;
      
      console.log(`[DEBUG] ✓ Cara ${index + 1} seleccionada manualmente (confianza: ${(face.confidence * 100).toFixed(1)}%)`);
    });
    
    currentGrid.appendChild(option);
  });
  
  // Establecer la mejor cara por defecto
  imageToUpload = allFaces.faces[selectedFaceIndex].imageBase64;
  console.log('[DEBUG] Imagen por defecto establecida (índice:', selectedFaceIndex, ')');
  
  // Mostrar el selector correcto
  currentSelector.classList.remove('hidden');
  faceDetectionError.classList.add('hidden');
  
  console.log(`[DEBUG] ✓ Selector mostrado con ${allFaces.faces.length} caras`);
  console.log(`[DEBUG] ⚠️ Selección manual habilitada`);
}

// Procesar imagen seleccionada
// Procesar imagen seleccionada
function handleImageFile(file) {
  isDniMode = false;
  selectedImages = [];
  previewDni.classList.add('hidden');
  faceDetectionError.classList.add('hidden');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    selectedImage = e.target.result;
    await attemptFaceExtraction();
    
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
  faceDetectionError.classList.add('hidden');
  
  const promises = [
    readFileAsDataURL(file1),
    readFileAsDataURL(file2)
  ];
  
  Promise.all(promises).then(async ([img1, img2]) => {
    selectedImages = [img1, img2];
    await attemptFaceExtraction();
    
    previewImage1.src = img1;
    previewImage2.src = img2;
    previewDni.classList.remove('hidden');
    dropZone.classList.add('hidden');
    scanBtn.disabled = false;
    scanText.textContent = 'Escanear y rellenar';
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
  detectedFaces = null;
  selectedFaceIndex = 0;
  preview.classList.add('hidden');
  previewDni.classList.add('hidden');
  dropZone.classList.remove('hidden');
  scanBtn.disabled = true;
  scanText.textContent = 'Escanear y rellenar';
  results.classList.add('hidden');
  fileInput.value = '';
  hideStatusMessage();
  faceDetectionError.classList.add('hidden');
  faceSelector.classList.add('hidden');
  faceSelectorDni.classList.add('hidden');
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

  // Mostrar vista de progreso
  showProgressView();
  
  try {
    // Paso 1: Verificar modo edición
    updateStep(1, 'active', 'Verificando formulario', 'Comprobando modo edición...');
    
    const editCheck = await checkEditMode();
    if (!editCheck.isEditMode) {
      const errorMsg = editCheck.error || 'Primero haz clic en "Editar detalles" en Cloudbeds';
      updateStep(1, 'error', 'Verificando formulario', errorMsg);
      showProgressResult('error', '⚠️ Error', errorMsg);
      return;
    }
    
    updateStep(1, 'completed', 'Verificando formulario', 'Formulario listo ✓');
    
    // Paso 2: Extraer datos con OpenAI
    updateStep(2, 'active', 'Analizando documento', 'Extrayendo datos...');
    
    if (isDniMode) {
      extractedData = await extractDataFromDniImages(stored.openaiApiKey, selectedImages);
    } else {
      extractedData = await extractDataFromImage(stored.openaiApiKey, selectedImage);
    }
    
    updateStep(2, 'completed', 'Analizando documento', 'Datos extraídos ✓');
    displayProgressData(extractedData);
    
    // Paso 3: Rellenar formulario + Subida de foto en PARALELO
    updateStep(3, 'active', 'Rellenando formulario', 'Completando campos en Cloudbeds...');
    
    // 🚀 OPTIMIZACIÓN: Ejecutar subida de foto en paralelo con relleno de formulario
    const fillFormPromise = fillCloudbedsForm(extractedData, true); // true = no esperar foto
    const photoUploadPromise = startPhotoUploadAsync(); // Iniciar subida en paralelo
    
    // Esperar ambas tareas en paralelo
    const [fillResult, photoUploadResult] = await Promise.all([
      fillFormPromise,
      photoUploadPromise
    ]);
    
    updateStep(3, 'completed', 'Rellenando formulario', `${fillResult.filledCount || ''} campos completados${photoUploadResult?.photoUploaded ? ' + foto' : ''} ✓`);
    
    // Mostrar botones finales
    showProgressResult('success');
    
  } catch (error) {
    // Determinar qué paso falló
    const step1State = step1.classList.contains('completed') ? 'completed' : 
                       step1.classList.contains('error') ? 'error' : 'active';
    const step2State = step2.classList.contains('completed') ? 'completed' : 
                       step2.classList.contains('error') ? 'error' : 
                       step2.classList.contains('pending') ? 'pending' : 'active';
    
    if (step1State !== 'completed') {
      updateStep(1, 'error', 'Verificando formulario', error.message);
    } else if (step2State !== 'completed') {
      updateStep(2, 'error', 'Analizando documento', error.message);
    } else {
      updateStep(3, 'error', 'Rellenando formulario', error.message);
    }
    
    showProgressResult('error');
  }
});

// Rellenar formulario en Cloudbeds
async function fillCloudbedsForm(data, skipPhotoWait = false) {
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

    // Si skipPhotoWait es true, no incluir imagen en este mensaje
    // La subida se hará en paralelo desde startPhotoUploadAsync()
    let shouldUploadImage = null;
    if (!skipPhotoWait) {
      const settings = await chrome.storage.local.get(['uploadPhoto']);
      shouldUploadImage = settings.uploadPhoto === true ? imageToUpload : null;
    }

    // Enviar datos al content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillGuestForm',
      data: data,
      imageToUpload: shouldUploadImage // Solo enviar si está activado y no estamos en modo paralelo
    });

    if (response && response.success) {
      return {
        success: true,
        filledCount: response.filledCount || 0,
        photoUploaded: response.photoUploaded || false
      };
    } else {
      throw new Error(response?.error || 'Error al rellenar el formulario');
    }
  } catch (error) {
    throw error;
  }
}

// 🚀 OPTIMIZACIÓN: Iniciar subida de foto en paralelo (sin esperar relleno)
async function startPhotoUploadAsync() {
  try {
    // Verificar si debe subir la imagen
    const settings = await chrome.storage.local.get(['uploadPhoto']);
    if (settings.uploadPhoto !== true || !imageToUpload) {
      return { photoUploaded: false };
    }

    // Obtener la pestaña activa
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('cloudbeds.com')) {
      return { photoUploaded: false };
    }

    // Iniciar subida en segundo plano sin esperar
    // Usar setTimeout para que se ejecute de forma completamente asíncrona
    const uploadPromise = (async () => {
      try {
        // Pequeña pausa para que el relleno del formulario tenga prioridad
        await new Promise(r => setTimeout(r, 500));
        
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
            return { photoUploaded: false };
          }
        }

        // Enviar solo para subir foto (sin datos de formulario)
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'fillGuestForm',
          data: {}, // Datos vacíos, solo para subir foto
          imageToUpload: imageToUpload // Enviar imagen para subida
        });

        return {
          photoUploaded: response?.photoUploaded === true
        };
      } catch (error) {
        // No fallar el proceso principal si falla la foto
        console.error('Error en subida paralela de foto:', error);
        return { photoUploaded: false };
      }
    })();

    // Esperar la subida de foto con timeout de 15 segundos
    return await Promise.race([
      uploadPromise,
      new Promise(r => setTimeout(() => r({ photoUploaded: false }), 15000))
    ]);
  } catch (error) {
    // No fallar el proceso principal si algo va mal
    console.error('Error al iniciar subida paralela:', error);
    return { photoUploaded: false };
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
  "zipCode": "código postal si aparece (5 dígitos para España)",
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
  const prompt = `Analiza estas 2 imágenes y determina si son el anverso y reverso de un DNI o NIE español.

PRIMERO verifica:
1. ¿Es la primera imagen parte de un DNI o NIE español (anverso o reverso)?
2. ¿Es la segunda imagen parte de un DNI o NIE español (anverso o reverso)?
3. ¿Tienes AMBAS caras (anverso Y reverso)?

El ANVERSO del DNI/NIE español contiene:
- Foto del titular
- Nombre y apellidos
- Fecha de nacimiento
- Sexo (M/F)
- Nacionalidad
- Número del documento:
  * DNI: 8 números + 1 letra (ejemplo: 12345678A)
  * NIE: 1 letra inicial (X, Y o Z) + 7 números + 1 letra final (ejemplo: X1234567A)
- Fecha de validez/caducidad
- Número de soporte (código alfanumérico debajo de la fecha de validez)

El REVERSO del DNI/NIE español contiene:
- Dirección completa (calle, número, piso, puerta)
- Código postal
- Localidad/Ciudad
- Provincia
- Lugar de nacimiento
- Nombre de los padres (en DNI) o país de nacimiento (en NIE)
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
  "nationality": "nacionalidad en INGLÉS (Spain para españoles, nombre del país de origen para NIE)",
  "documentType": "dni o nie",
  "documentNumber": "número del documento (DNI: 8 números + letra, NIE: letra + 7 números + letra)",
  "issueDate": "fecha de expedición en formato DD/MM/YYYY (si visible)",
  "expirationDate": "fecha de caducidad/validez en formato DD/MM/YYYY",
  "issuingCountry": "ES",
  "address": "dirección completa (calle, número, piso, puerta)",
  "zipCode": "código postal de 5 dígitos (inferir de la dirección/ciudad si no aparece explícito)",
  "city": "localidad/ciudad",
  "province": "provincia",
  "country": "ES",
  "supportNumber": "número de soporte (código alfanumérico, ej: ABC123456)"
}

IMPORTANTE:
- Si las imágenes NO son un DNI o NIE español válido con ambas caras, pon isValidDni=false y describe el problema en errorMessage
- Ejemplos de errores: "Solo se detectó el anverso, falta el reverso", "La imagen 1 no es un DNI/NIE español", "Ambas imágenes son el mismo lado del documento"
- Solo extrae los datos si isValidDni=true
- La dirección está en el REVERSO del documento
- El número de soporte está en el ANVERSO, debajo de la fecha de validez
- El código postal NO aparece en el documento, pero DEBES inferirlo usando tu conocimiento de los códigos postales españoles. Usa la dirección completa (nombre de calle, número, ciudad y provincia) para determinar el código postal más preciso posible. En España cada calle tiene asignado un código postal específico.
- Para NIE: la nacionalidad debe ser el país de origen de la persona (en inglés), NO "Spain"
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
    scanText.textContent = isDniMode ? 'Escanear y rellenar' : 'Escanear y rellenar';
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

// ============ VISTA DE PROGRESO ============

function showProgressView() {
  // Ocultar el tab content actual
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('.tabs').classList.add('hidden');
  
  // Resetear estados
  resetProgressSteps();
  progressActions.classList.add('hidden');
  errorActions.classList.add('hidden');
  progressData.classList.add('hidden');
  
  // Mostrar vista de progreso
  progressView.classList.remove('hidden');
}

function hideProgressView() {
  // Ocultar vista de progreso
  progressView.classList.add('hidden');
  
  // Mostrar tabs y contenido
  document.querySelector('.tabs').classList.remove('hidden');
  document.getElementById('tab-scan').classList.add('active');
  
  // Resetear para el próximo escaneo
  hideStatusMessage();
  results.classList.add('hidden');
}

function resetProgressSteps() {
  [step1, step2, step3].forEach((step, index) => {
    step.className = index === 0 ? 'step' : 'step pending';
    step.querySelector('.step-icon').textContent = '⏳';
  });
  
  step1.querySelector('.step-title').textContent = 'Verificando formulario';
  step1.querySelector('.step-description').textContent = 'Comprobando modo edición...';
  step2.querySelector('.step-title').textContent = 'Analizando documento';
  step2.querySelector('.step-description').textContent = 'Extrayendo datos...';
  step3.querySelector('.step-title').textContent = 'Rellenando formulario';
  step3.querySelector('.step-description').textContent = 'Completando campos en Cloudbeds...';
}

function updateStep(stepNum, state, title, description) {
  const stepEl = document.getElementById(`step${stepNum}`);
  if (!stepEl) return;
  
  // Actualizar clase
  stepEl.className = `step ${state}`;
  
  // Actualizar icono
  const iconEl = stepEl.querySelector('.step-icon');
  switch (state) {
    case 'active':
      iconEl.textContent = '⏳';
      break;
    case 'completed':
      iconEl.textContent = '✅';
      break;
    case 'error':
      iconEl.textContent = '❌';
      break;
    default:
      iconEl.textContent = '⏳';
  }
  
  // Actualizar textos
  if (title) stepEl.querySelector('.step-title').textContent = title;
  if (description) stepEl.querySelector('.step-description').textContent = description;
  
  // Si el paso se completó, activar el siguiente (quitar pending)
  if (state === 'completed' && stepNum < 3) {
    const nextStep = document.getElementById(`step${stepNum + 1}`);
    if (nextStep) nextStep.classList.remove('pending');
  }
}

function showProgressResult(type) {
  // Mostrar botones según el resultado
  if (type === 'success') {
    progressActions.classList.remove('hidden');
  } else {
    errorActions.classList.remove('hidden');
  }
}

function displayProgressData(data) {
  const labels = {
    firstName: 'Nombre',
    lastName: 'Apellido',
    lastName2: '2º Apellido',
    birthDate: 'F. Nacimiento',
    gender: 'Género',
    nationality: 'Nacionalidad',
    documentType: 'Tipo Doc.',
    documentNumber: 'Nº Doc.',
    issueDate: 'F. Emisión',
    expirationDate: 'F. Caducidad',
    issuingCountry: 'País Emisor',
    address: 'Dirección',
    zipCode: 'C. Postal',
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
  
  // Campos que ocupan todo el ancho
  const fullWidthFields = ['address'];

  progressExtractedData.innerHTML = '';
  
  for (const [key, value] of Object.entries(data)) {
    if (key === '_tokenUsage') continue;
    if (value !== null && value !== '') {
      const item = document.createElement('div');
      item.className = 'data-item' + (fullWidthFields.includes(key) ? ' full-width' : '');
      
      let displayValue = value;
      if (key === 'gender') displayValue = genderLabels[value] || value;
      if (key === 'documentType') displayValue = docTypeLabels[value] || value;
      
      item.innerHTML = `
        <div class="data-item-label">${labels[key] || key}</div>
        <div class="data-item-value">${displayValue}</div>
      `;
      progressExtractedData.appendChild(item);
    }
  }
  
  // Mostrar uso de tokens
  if (data._tokenUsage) {
    const usage = data._tokenUsage;
    progressTokenUsage.innerHTML = `
      <div class="data-row"><span class="data-label">Tokens enviados</span><span class="data-value">${usage.prompt_tokens.toLocaleString()}</span></div>
      <div class="data-row"><span class="data-label">Tokens recibidos</span><span class="data-value">${usage.completion_tokens.toLocaleString()}</span></div>
      <div class="data-row"><span class="data-label">Total tokens</span><span class="data-value">${usage.total_tokens.toLocaleString()}</span></div>
    `;
  }
  
  progressData.classList.remove('hidden');
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
// ========================================
// PAPEL DE CRUCES
// ========================================

// Inicializar fecha con la fecha de hoy
document.addEventListener('DOMContentLoaded', () => {
  const crucesDateInput = document.getElementById('crucesDate');
  if (crucesDateInput) {
    const today = new Date().toISOString().split('T')[0];
    crucesDateInput.value = today;
  }
});

// Botón para generar el papel de cruces
const generateCrucesBtn = document.getElementById('generateCrucesBtn');
const crucesStatus = document.getElementById('crucesStatus');

if (generateCrucesBtn) {
  generateCrucesBtn.addEventListener('click', async () => {
    try {
      // Obtener fecha seleccionada
      const crucesDateInput = document.getElementById('crucesDate');
      const selectedDate = crucesDateInput.value;

      if (!selectedDate) {
        showCrucesStatus('Por favor selecciona una fecha', 'error');
        return;
      }

      // Deshabilitar botón y mostrar loading
      generateCrucesBtn.disabled = true;
      generateCrucesBtn.innerHTML = '⏳ Generando...';
      showCrucesStatus('Extrayendo datos del calendario...', 'info');

      // Generar el papel de cruces
      await generatePapelCruces(selectedDate);

      // Éxito
      showCrucesStatus('✅ Excel generado correctamente', 'success');
      generateCrucesBtn.innerHTML = '📊 Generar Excel';
      generateCrucesBtn.disabled = false;

      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        hideCrucesStatus();
      }, 3000);

    } catch (error) {
      console.error('Error al generar papel de cruces:', error);
      showCrucesStatus(`❌ Error: ${error.message}`, 'error');
      generateCrucesBtn.innerHTML = '📊 Generar Excel';
      generateCrucesBtn.disabled = false;
    }
  });
}

function showCrucesStatus(message, type) {
  if (!crucesStatus) return;
  
  crucesStatus.textContent = message;
  crucesStatus.className = 'status-message';
  
  if (type === 'success') {
    crucesStatus.style.color = 'var(--success)';
    crucesStatus.style.background = '#d1fae5';
  } else if (type === 'error') {
    crucesStatus.style.color = 'var(--error)';
    crucesStatus.style.background = '#fee2e2';
  } else if (type === 'info') {
    crucesStatus.style.color = 'var(--primary)';
    crucesStatus.style.background = 'var(--primary-light)';
  }
  
  crucesStatus.classList.remove('hidden');
}

function hideCrucesStatus() {
  if (crucesStatus) {
    crucesStatus.classList.add('hidden');
  }
}