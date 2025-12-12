// Estado de la aplicación
let selectedImage = null;
let extractedData = null;

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
const scanBtn = document.getElementById('scanBtn');
const scanText = document.getElementById('scanText');
const scanLoader = document.getElementById('scanLoader');
const results = document.getElementById('results');
const extractedDataDiv = document.getElementById('extractedData');
const statusMessage = document.getElementById('statusMessage');

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar API Key guardada
  const stored = await chrome.storage.local.get(['openaiApiKey']);
  if (stored.openaiApiKey) {
    apiKeyInput.value = stored.openaiApiKey;
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
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedImage = e.target.result;
    previewImage.src = selectedImage;
    preview.classList.remove('hidden');
    dropZone.classList.add('hidden');
    scanBtn.disabled = false;
    results.classList.add('hidden');
    hideStatusMessage();
  };
  reader.readAsDataURL(file);
}

// Limpiar imagen
clearImageBtn.addEventListener('click', () => {
  selectedImage = null;
  extractedData = null;
  preview.classList.add('hidden');
  dropZone.classList.remove('hidden');
  scanBtn.disabled = true;
  results.classList.add('hidden');
  fileInput.value = '';
  hideStatusMessage();
});

// Escanear Y Rellenar (todo en uno)
scanBtn.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['openaiApiKey']);
  if (!stored.openaiApiKey) {
    showStatusMessage('Configura tu API Key de OpenAI en ⚙️', 'error');
    optionsPanel.classList.remove('hidden');
    return;
  }

  if (!selectedImage) {
    showStatusMessage('Por favor selecciona una imagen', 'error');
    return;
  }

  setLoading(true);
  hideStatusMessage();

  try {
    // Paso 1: Extraer datos con OpenAI
    showStatusMessage('Escaneando documento...', 'success');
    extractedData = await extractDataFromImage(stored.openaiApiKey, selectedImage);
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
    city: 'Ciudad',
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
