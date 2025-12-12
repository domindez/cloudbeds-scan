// Content script para interactuar con la página de Cloudbeds
console.log('🔍 Cloudbeds ID Scanner: Content script cargado');

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensaje recibido:', request.action);
  
  if (request.action === 'fillGuestForm') {
    fillGuestForm(request.data)
      .then(result => {
        console.log('✅ Resultado:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('❌ Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantener el canal abierto para respuesta asíncrona
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Content script activo' });
    return true;
  }
  
  return true;
});

// Función principal para rellenar el formulario
async function fillGuestForm(data) {
  console.log('📝 Rellenando formulario con datos:', data);
  
  // Buscar el formulario de huésped en la página
  const formContainers = [
    '.guest-info-fields-folio',
    '.customer-form',
    '#customer-form',
    'form[name="customer"]',
    '.guest-details',
    '.folio-guest-info'
  ];
  
  let guestForm = null;
  for (const selector of formContainers) {
    guestForm = document.querySelector(selector);
    if (guestForm) {
      console.log('📋 Formulario encontrado con selector:', selector);
      break;
    }
  }
  
  // Si no encontramos contenedor, buscar campos directamente
  if (!guestForm) {
    const anyGuestField = document.querySelector(
      '[name="guest_first_name"], ' +
      '[name="firstName"], ' +
      '#guest_first_name, ' +
      'input[id*="first_name"]'
    );
    if (!anyGuestField) {
      showNotification('⚠️ No se encontró formulario de huésped en esta página');
      return { success: false, error: 'Formulario no encontrado' };
    }
    console.log('📋 Campo de huésped encontrado, procediendo...');
  }
  
  // Buscar y hacer clic en el botón de edición si es necesario
  await clickEditButtonIfNeeded();
  
  // Esperar un momento para que se habiliten los campos
  await sleep(300);
  
  // Rellenar los campos
  const filledCount = doFillForm(data);
  
  return { success: true, filledCount };
}

// Buscar y hacer clic en el botón de edición
async function clickEditButtonIfNeeded() {
  // Verificar si ya estamos en modo edición
  const isEditable = document.querySelector('input[name="guest_first_name"]:not([readonly]):not([disabled])');
  if (isEditable && !isEditable.readOnly && !isEditable.disabled) {
    console.log('📝 Ya en modo edición');
    return;
  }
  
  // Selectores comunes para botón de edición
  const editSelectors = [
    '[data-hook="guest-edit-button"]',
    '.edit-guest-details',
    '.btn-edit-guest',
    '[data-action="edit"]',
    '.guest-edit-btn',
    'button.edit-button',
    'a.edit-details',
    '.edit_mode_toggle',
    '[onclick*="editGuest"]',
    '[onclick*="edit_guest"]'
  ];
  
  let editButton = null;
  for (const selector of editSelectors) {
    editButton = document.querySelector(selector);
    if (editButton) {
      console.log('🖱️ Botón de edición encontrado:', selector);
      break;
    }
  }
  
  // Buscar por texto del botón
  if (!editButton) {
    const allButtons = document.querySelectorAll('button, a.btn, .btn, a[role="button"]');
    for (const btn of allButtons) {
      const text = (btn.textContent || '').toLowerCase().trim();
      if (text === 'edit' || text === 'editar' || text.includes('edit details') || text.includes('editar detalles')) {
        editButton = btn;
        console.log('🖱️ Botón de edición encontrado por texto:', text);
        break;
      }
    }
  }
  
  if (editButton) {
    editButton.click();
    console.log('✅ Clic en botón de edición');
    await sleep(800); // Esperar que se habiliten los campos
  }
}

// Rellenar los campos del formulario
function doFillForm(data) {
  let filledCount = 0;
  
  // Preprocesar datos: combinar apellidos en uno solo
  const processedData = { ...data };
  if (processedData.lastName2) {
    processedData.lastName = `${processedData.lastName || ''} ${processedData.lastName2}`.trim();
    delete processedData.lastName2; // No usar el campo lastName2
  }
  
  // Copiar documentNumber al campo fiscal (NIF)
  if (processedData.documentNumber) {
    processedData.taxId = processedData.documentNumber;
  }
  
  console.log('📋 Datos procesados:', processedData);
  
  // Mapeo de campos - múltiples selectores para cada campo
  const fieldMappings = {
    firstName: [
      'input[name="guest_first_name"]',
      'input[name="firstName"]',
      '#guest_first_name',
      'input[id*="first_name"]:not([id*="last"])'
    ],
    lastName: [
      'input[name="guest_last_name"]',
      'input[name="lastName"]',
      '#guest_last_name',
      'input[id*="last_name"]'
    ],
    birthDate: [
      'input[name="guest_birthday"]',
      'input[name="label_birthday"]',
      'input[name="birthDate"]',
      '#guest_birthday',
      'input[id*="birthday"]',
      'input.label_birthday',
      'input.birthday'
    ],
    taxId: [
      'input[name="guest_guest_tax_id_number"]',
      'input[name="guest_tax_id"]',
      'input[name="taxId"]',
      '#guest_tax_id',
      'input[id*="tax_id"]',
      'input.f_guest_tax_id_number'
    ],
    gender: [
      'select[name="guest_gender"]',
      '#guest_gender',
      'select[id*="gender"]'
    ],
    nationality: [
      'input[name="nationality"]',
      '#nationality',
      'input[id*="nationality"]',
      'select[name="nationality"]'
    ],
    documentType: [
      'select[name="guest_document_type"]',
      '#guest_document_type',
      'select[id*="document_type"]'
    ],
    documentNumber: [
      'input[name="guest_document_number"]',
      '#guest_document_number',
      'input[id*="document_number"]'
    ],
    issueDate: [
      'input[name="guest_document_issue_date"]',
      '#guest_document_issue_date',
      'input[id*="issue_date"]'
    ],
    expirationDate: [
      'input[name="guest_document_expiration_date"]',
      '#guest_document_expiration_date',
      'input[id*="expiration"]',
      'input[id*="expiry"]'
    ],
    issuingCountry: [
      'select[name="guest_document_issuing_country"]',
      '#guest_document_issuing_country',
      'select[id*="issuing_country"]'
    ],
    supportNumber: [
      'input[name="documentNumber2"]',
      '#documentNumber2',
      'input[id*="support_number"]'
    ],
    address: [
      'input[name="guest_address1"]',
      '#guest_address1',
      'input[id*="address"]'
    ],
    city: [
      'input[name="guest_city"]',
      '#guest_city',
      'input[id*="city"]'
    ],
    country: [
      'select[name="guest_country"]',
      '#guest_country',
      'select[id*="country"]:not([id*="issuing"])'
    ]
  };
  
  // Rellenar cada campo
  for (const [dataKey, selectors] of Object.entries(fieldMappings)) {
    const value = processedData[dataKey];
    if (!value) continue;
    
    // Manejo especial para fecha de nacimiento (tiene 2 inputs en Cloudbeds)
    if (dataKey === 'birthDate') {
      filledCount += fillBirthdateFields(value);
      continue;
    }
    
    let element = null;
    for (const selector of selectors) {
      element = document.querySelector(selector);
      if (element) break;
    }
    
    if (!element) {
      console.log(`⚠️ Campo no encontrado: ${dataKey}`);
      continue;
    }
    
    // Habilitar el campo si está deshabilitado
    if (element.disabled || element.readOnly) {
      element.disabled = false;
      element.readOnly = false;
      element.classList.remove('disabled', 'readonly');
    }
    
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'select') {
      if (setSelectValue(element, value)) {
        filledCount++;
        console.log(`✅ ${dataKey}: ${value}`);
      }
    } else if (tagName === 'input') {
      // Manejo especial para campos de fecha
      const isDateField = dataKey.toLowerCase().includes('date') || 
                          element.type === 'date' || 
                          element.classList.contains('datepicker') ||
                          element.hasAttribute('data-datepicker');
      
      if (isDateField) {
        setDateValue(element, value, dataKey);
      } else {
        setInputValue(element, value);
      }
      filledCount++;
      console.log(`✅ ${dataKey}: ${value}`);
    }
  }
  
  // Habilitar campos de documento después de seleccionar tipo
  if (processedData.documentType) {
    setTimeout(() => {
      enableDocumentFields();
    }, 300);
  }
  
  console.log(`📊 Total campos rellenados: ${filledCount}`);
  showNotification(`✓ ${filledCount} campos rellenados correctamente`);
  
  return filledCount;
}

// Función especial para rellenar fecha de nacimiento (Cloudbeds tiene 2 inputs)
function fillBirthdateFields(dateValue) {
  console.log('📅 Rellenando campos de fecha de nacimiento:', dateValue);
  let filled = 0;
  
  // Parsear la fecha
  let day, month, year;
  if (dateValue.includes('/')) {
    const parts = dateValue.split('/');
    if (parts.length === 3) {
      day = parts[0].padStart(2, '0');
      month = parts[1].padStart(2, '0');
      year = parts[2];
    }
  } else if (dateValue.includes('-')) {
    const parts = dateValue.split('-');
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1].padStart(2, '0');
      day = parts[2].padStart(2, '0');
    }
  }
  
  if (!day || !month || !year) {
    console.warn('⚠️ No se pudo parsear la fecha:', dateValue);
    return 0;
  }
  
  const formattedDate = `${day}/${month}/${year}`;
  
  // 1. Rellenar el input visible (label_birthday) - el que tiene datepicker
  const labelBirthday = document.querySelector('input[name="label_birthday"], input.label_birthday');
  if (labelBirthday) {
    labelBirthday.value = formattedDate;
    labelBirthday.dispatchEvent(new Event('change', { bubbles: true }));
    labelBirthday.dispatchEvent(new Event('blur', { bubbles: true }));
    console.log('✅ label_birthday:', formattedDate);
    filled++;
    
    // Intentar con jQuery datepicker si existe
    if (typeof jQuery !== 'undefined') {
      try {
        const $input = jQuery(labelBirthday);
        if ($input.datepicker) {
          $input.datepicker('setDate', new Date(year, parseInt(month) - 1, parseInt(day)));
          console.log('✅ Fecha establecida via jQuery datepicker');
        }
      } catch (e) {
        console.log('⚠️ jQuery datepicker no disponible');
      }
    }
  }
  
  // 2. Rellenar el input hidden (guest_birthday) - el que guarda el valor real
  const guestBirthday = document.querySelector('input[name="guest_birthday"], input.birthday');
  if (guestBirthday) {
    guestBirthday.value = formattedDate;
    guestBirthday.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('✅ guest_birthday:', formattedDate);
    filled++;
  }
  
  // 3. Actualizar el div estático si existe
  const staticDiv = document.querySelector('[data-hook="guest-birthday-text-value"]');
  if (staticDiv) {
    staticDiv.textContent = formattedDate;
  }
  
  return filled > 0 ? 1 : 0; // Contar como 1 campo rellenado
}

// Establecer valor en un input
function setInputValue(input, value) {
  // Guardar el valor original
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeInputValueSetter.call(input, value);
  
  // Disparar eventos
  input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
  
  // Método alternativo por si acaso
  input.value = value;
}

// Establecer valor en campos de fecha (múltiples formatos)
function setDateValue(input, value, fieldName) {
  console.log(`📅 Procesando fecha para ${fieldName}: "${value}" (tipo input: ${input.type})`);
  
  // Parsear la fecha de entrada (puede venir en DD/MM/YYYY o YYYY-MM-DD)
  let day, month, year;
  
  if (value.includes('/')) {
    // Formato DD/MM/YYYY
    const parts = value.split('/');
    if (parts.length === 3) {
      day = parts[0].padStart(2, '0');
      month = parts[1].padStart(2, '0');
      year = parts[2];
    }
  } else if (value.includes('-')) {
    // Formato YYYY-MM-DD
    const parts = value.split('-');
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1].padStart(2, '0');
      day = parts[2].padStart(2, '0');
    }
  }
  
  if (!day || !month || !year) {
    console.warn(`⚠️ No se pudo parsear la fecha: ${value}`);
    setInputValue(input, value); // Intentar con el valor original
    return;
  }
  
  // Diferentes formatos según el tipo de input
  const formats = {
    'yyyy-mm-dd': `${year}-${month}-${day}`,
    'dd/mm/yyyy': `${day}/${month}/${year}`,
    'mm/dd/yyyy': `${month}/${day}/${year}`,
    'dd-mm-yyyy': `${day}-${month}-${year}`,
  };
  
  console.log(`📅 Fecha parseada: día=${day}, mes=${month}, año=${year}`);
  
  // Si es un input type="date", usar formato ISO
  if (input.type === 'date') {
    const isoDate = formats['yyyy-mm-dd'];
    console.log(`📅 Usando formato ISO para input[type=date]: ${isoDate}`);
    input.value = isoDate;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  
  // Intentar detectar el formato esperado por el placeholder o pattern
  const placeholder = input.placeholder?.toLowerCase() || '';
  const pattern = input.pattern || '';
  
  let dateValue = formats['dd/mm/yyyy']; // Default para España
  
  if (placeholder.includes('yyyy-mm-dd') || placeholder.includes('aaaa-mm-dd')) {
    dateValue = formats['yyyy-mm-dd'];
  } else if (placeholder.includes('mm/dd') || placeholder.includes('mes/día')) {
    dateValue = formats['mm/dd/yyyy'];
  } else if (placeholder.includes('dd-mm')) {
    dateValue = formats['dd-mm-yyyy'];
  }
  
  console.log(`📅 Formato final para ${fieldName}: ${dateValue}`);
  
  // Establecer el valor
  setInputValue(input, dateValue);
  
  // Si hay un datepicker, intentar disparar eventos específicos
  if (input.classList.contains('datepicker') || input.classList.contains('hasDatepicker')) {
    // jQuery datepicker
    if (typeof jQuery !== 'undefined' && jQuery(input).datepicker) {
      try {
        jQuery(input).datepicker('setDate', new Date(year, month - 1, day));
        console.log(`📅 Fecha establecida via jQuery datepicker`);
      } catch (e) {
        console.log(`⚠️ Error con jQuery datepicker:`, e);
      }
    }
  }
}

// Establecer valor en un select
function setSelectValue(select, value) {
  const valueLower = value.toLowerCase().trim();
  
  // Buscar opción por valor exacto
  for (const option of select.options) {
    if (option.value.toLowerCase() === valueLower) {
      select.value = option.value;
      triggerChange(select);
      return true;
    }
  }
  
  // Buscar opción por texto
  for (const option of select.options) {
    if (option.text.toLowerCase().includes(valueLower)) {
      select.value = option.value;
      triggerChange(select);
      return true;
    }
  }
  
  // Buscar coincidencia parcial en valor
  for (const option of select.options) {
    if (option.value.toLowerCase().includes(valueLower) || valueLower.includes(option.value.toLowerCase())) {
      select.value = option.value;
      triggerChange(select);
      return true;
    }
  }
  
  // Mapeo especial para tipos de documento
  const documentTypeMap = {
    'passport': ['P', 'PASSPORT', 'PASAPORTE'],
    'pasaporte': ['P', 'PASSPORT', 'PASAPORTE'],
    'dni': ['D', 'DNI', 'ID'],
    'id': ['D', 'DNI', 'ID', 'NATIONAL_ID'],
    'nie': ['N', 'NIE', 'FOREIGN_ID'],
    'driver': ['DL', 'DRIVER', 'LICENSE', 'DRIVING'],
    'license': ['DL', 'DRIVER', 'LICENSE', 'DRIVING']
  };
  
  const mappedValues = documentTypeMap[valueLower] || [];
  for (const option of select.options) {
    const optVal = option.value.toUpperCase();
    const optText = option.text.toUpperCase();
    if (mappedValues.some(v => optVal.includes(v) || optText.includes(v))) {
      select.value = option.value;
      triggerChange(select);
      return true;
    }
  }
  
  // Mapeo especial para género
  const genderMap = {
    'male': ['M', 'MALE', 'MASCULINO', 'HOMBRE'],
    'female': ['F', 'FEMALE', 'FEMENINO', 'MUJER'],
    'masculino': ['M', 'MALE', 'MASCULINO', 'HOMBRE'],
    'femenino': ['F', 'FEMALE', 'FEMENINO', 'MUJER'],
    'm': ['M', 'MALE', 'MASCULINO'],
    'f': ['F', 'FEMALE', 'FEMENINO']
  };
  
  const genderMapped = genderMap[valueLower] || [];
  for (const option of select.options) {
    const optVal = option.value.toUpperCase();
    const optText = option.text.toUpperCase();
    if (genderMapped.some(v => optVal === v || optText.includes(v))) {
      select.value = option.value;
      triggerChange(select);
      return true;
    }
  }
  
  console.warn(`⚠️ No se encontró opción para: ${value}`);
  return false;
}

// Disparar evento change
function triggerChange(element) {
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

// Habilitar campos de documento
function enableDocumentFields() {
  const documentFields = document.querySelectorAll(
    '.document_type_relation, ' +
    '[class*="document-field"], ' +
    'input[name*="document"]:disabled, ' +
    'select[name*="document"]:disabled'
  );
  
  documentFields.forEach(field => {
    field.disabled = false;
    field.readOnly = false;
    field.classList.remove('disabled', 'readonly');
  });
  
  console.log(`🔓 ${documentFields.length} campos de documento habilitados`);
}

// Mostrar notificación visual
function showNotification(message) {
  // Eliminar notificación anterior si existe
  const existing = document.getElementById('cloudbeds-scanner-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'cloudbeds-scanner-notification';
  notification.innerHTML = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    opacity: 0;
    transform: translateX(100px);
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(notification);

  // Animar entrada
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 10);

  // Eliminar después de 4 segundos
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100px)';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 4000);
}

// Función auxiliar para esperar
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Marcar que el content script está listo
window.cloudbedsIdScannerReady = true;
console.log('✅ Cloudbeds ID Scanner: Listo para recibir datos');
