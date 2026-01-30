// Gestión de opciones del comparador de precios

// ============ INDEXEDDB PARA GUARDAR EL HANDLE DE LA CARPETA ============
const DB_NAME = 'CloudbedsIDScanner';
const DB_VERSION = 1;
const STORE_NAME = 'folderHandles';

function openDatabase() {
  return new Promise((resolve, reject) => {
    console.log('[DEBUG] Abriendo IndexedDB...');
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('[ERROR] Error al abrir IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      console.log('[DEBUG] IndexedDB abierta correctamente');
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('[DEBUG] Creando object store...');
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        console.log('[DEBUG] Object store creado');
      }
    };
  });
}

async function saveFolderHandle(handle) {
  console.log('[DEBUG] Guardando folder handle:', handle.name);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, 'scanFolder');
    
    request.onerror = () => {
      console.error('[ERROR] Error al guardar en IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      console.log('[DEBUG] Handle guardado correctamente en IndexedDB');
      resolve();
    };
    
    transaction.oncomplete = () => {
      db.close();
      console.log('[DEBUG] Transacción completada');
    };
    
    transaction.onerror = () => {
      console.error('[ERROR] Error en transacción:', transaction.error);
    };
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

// ============ CLASE PARA GESTIÓN DE OPCIONES ============

class OptionsManager {
    constructor() {
        this.competitors = [];
        this.scanFolderHandle = null;
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadFolderSettings();
        this.renderCompetitors();
        this.attachEventListeners();
    }

    async loadFolderSettings() {
        // Cargar handle de IndexedDB
        const savedHandle = await loadFolderHandle();
        const scanFolderPath = document.getElementById('scanFolderPath');
        
        if (savedHandle) {
            this.scanFolderHandle = savedHandle;
            scanFolderPath.textContent = savedHandle.name;
            console.log('[DEBUG] Carpeta cargada:', savedHandle.name);
        } else {
            console.log('[DEBUG] No hay carpeta guardada');
        }
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['competitors'], (result) => {
                if (result.competitors && result.competitors.length > 0) {
                    this.competitors = result.competitors;
                } else {
                    // Sin competidores por defecto
                    this.competitors = [];
                }
                resolve();
            });
        });
    }

    renderCompetitors() {
        const listContainer = document.getElementById('competitor-list');
        
        if (this.competitors.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <p>No hay competidores configurados</p>
                    <p style="font-size: 12px; margin-top: 5px;">Haz clic en "Añadir Hotel Competidor" para empezar</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';
        this.competitors.forEach((competitor, index) => {
            const item = document.createElement('div');
            item.className = 'competitor-item';
            item.innerHTML = `
                <input type="text" 
                       class="competitor-name" 
                       placeholder="Nombre del hotel" 
                       value="${competitor.name}"
                       data-index="${index}">
                <input type="url" 
                       class="competitor-url" 
                       placeholder="URL de Booking.com" 
                       value="${competitor.url}"
                       data-index="${index}">
                <button class="btn-remove" data-index="${index}">🗑️ Eliminar</button>
            `;
            listContainer.appendChild(item);
        });
    }

    attachEventListeners() {
        // Botón seleccionar carpeta
        document.getElementById('selectFolderBtn').addEventListener('click', async () => {
            await this.selectFolder();
        });

        // Botón añadir competidor
        document.getElementById('add-competitor').addEventListener('click', () => {
            this.addCompetitor();
        });

        // Botón guardar
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Delegación de eventos para botones de eliminar
        document.getElementById('competitor-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove') || e.target.closest('.btn-remove')) {
                const button = e.target.classList.contains('btn-remove') ? e.target : e.target.closest('.btn-remove');
                const index = parseInt(button.dataset.index);
                this.removeCompetitor(index);
            }
        });
    }

    async selectFolder() {
        console.log('[DEBUG] Seleccionando carpeta desde options.html...');
        
        try {
            // En una página completa (no popup), esto debería funcionar
            this.scanFolderHandle = await window.showDirectoryPicker({
                mode: 'read'
            });
            
            console.log('[DEBUG] Carpeta seleccionada:', this.scanFolderHandle.name);
            
            // Guardar en IndexedDB
            await saveFolderHandle(this.scanFolderHandle);
            
            // Guardar nombre en chrome.storage
            await chrome.storage.local.set({ scanFolderName: this.scanFolderHandle.name });
            
            // Actualizar UI
            document.getElementById('scanFolderPath').textContent = this.scanFolderHandle.name;
            
            this.showFolderMessage('✅ Carpeta configurada correctamente', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('[ERROR] Error al seleccionar carpeta:', error);
                this.showFolderMessage(`❌ Error: ${error.message}`, 'error');
            }
        }
    }

    showFolderMessage(text, type) {
        const messageDiv = document.getElementById('folderMessage');
        messageDiv.textContent = text;
        messageDiv.className = `message ${type} show`;

        setTimeout(() => {
            messageDiv.classList.remove('show');
        }, 3000);
    }

    addCompetitor() {
        this.competitors.push({
            name: '',
            url: ''
        });
        this.renderCompetitors();
        this.showMessage('Añade el nombre y URL del hotel competidor', 'success');
    }

    removeCompetitor(index) {
        this.competitors.splice(index, 1);
        this.renderCompetitors();
        this.showMessage('Competidor eliminado', 'success');
    }

    async saveSettings() {
        // Recoger valores actuales de los inputs
        const nameInputs = document.querySelectorAll('.competitor-name');
        const urlInputs = document.querySelectorAll('.competitor-url');

        this.competitors = [];
        nameInputs.forEach((nameInput, index) => {
            const name = nameInput.value.trim();
            const url = urlInputs[index].value.trim();

            if (name && url) {
                // Validar que la URL sea de Booking.com
                if (!url.includes('booking.com')) {
                    this.showMessage('⚠️ Todas las URLs deben ser de Booking.com', 'error');
                    return;
                }

                this.competitors.push({ name, url });
            }
        });

        // Guardar en chrome.storage
        return new Promise((resolve) => {
            chrome.storage.sync.set({ competitors: this.competitors }, () => {
                this.showMessage('✅ Configuración guardada correctamente', 'success');
                setTimeout(() => {
                    this.renderCompetitors();
                }, 500);
                resolve();
            });
        });
    }

    showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = text;
        messageDiv.className = `message ${type} show`;

        setTimeout(() => {
            messageDiv.classList.remove('show');
        }, 3000);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});
