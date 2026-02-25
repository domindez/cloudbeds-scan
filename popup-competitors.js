// ========================================
// GESTIÓN DE COMPETIDORES
// ========================================
const competitorsList = document.getElementById('competitorsList');
const addCompetitorBtn = document.getElementById('addCompetitorBtn');

// Cargar y mostrar competidores
async function loadCompetitors() {
  const stored = await chrome.storage.sync.get(['competitors']);
  const competitors = stored.competitors || [];
  
  renderCompetitors(competitors);
}

function renderCompetitors(competitors) {
  if (!competitorsList) return;
  
  if (competitors.length === 0) {
    competitorsList.innerHTML = `
      <div class="competitors-empty">
        No hay competidores configurados.<br>
        Haz clic en "Añadir competidor" para empezar.
      </div>
    `;
    return;
  }
  
  competitorsList.innerHTML = '';
  competitors.forEach((competitor, index) => {
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
      <div class="competitor-actions">
        <button class="btn-remove-competitor" data-index="${index}">🗑️ Eliminar</button>
      </div>
    `;
    competitorsList.appendChild(item);
  });
  
  // Event listeners para guardar cambios
  const nameInputs = competitorsList.querySelectorAll('.competitor-name');
  const urlInputs = competitorsList.querySelectorAll('.competitor-url');
  
  nameInputs.forEach(input => {
    input.addEventListener('blur', saveCompetitors);
  });
  
  urlInputs.forEach(input => {
    input.addEventListener('blur', saveCompetitors);
  });
  
  // Event listeners para eliminar
  const removeButtons = competitorsList.querySelectorAll('.btn-remove-competitor');
  removeButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index);
      await removeCompetitor(index);
    });
  });
}

async function saveCompetitors() {
  const nameInputs = document.querySelectorAll('.competitor-name');
  const urlInputs = document.querySelectorAll('.competitor-url');
  
  const competitors = [];
  nameInputs.forEach((nameInput, index) => {
    const name = nameInput.value.trim();
    const url = urlInputs[index].value.trim();
    
    if (name && url) {
      competitors.push({ name, url });
    }
  });
  
  await chrome.storage.sync.set({ competitors });
  ('Competidores guardados:', competitors);
}

async function removeCompetitor(index) {
  const stored = await chrome.storage.sync.get(['competitors']);
  const competitors = stored.competitors || [];
  
  competitors.splice(index, 1);
  await chrome.storage.sync.set({ competitors });
  
  renderCompetitors(competitors);
}

if (addCompetitorBtn) {
  addCompetitorBtn.addEventListener('click', async () => {
    const stored = await chrome.storage.sync.get(['competitors']);
    const competitors = stored.competitors || [];
    
    competitors.push({
      name: '',
      url: ''
    });
    
    await chrome.storage.sync.set({ competitors });
    renderCompetitors(competitors);
  });
}

// Cargar competidores cuando se abra la pestaña de ajustes
const settingsTab = document.querySelector('[data-tab="settings"]');
if (settingsTab) {
  settingsTab.addEventListener('click', () => {
    loadCompetitors();
  });
}

// Cargar competidores al iniciar si ya estamos en ajustes
if (document.getElementById('tab-settings')?.classList.contains('active')) {
  loadCompetitors();
}
