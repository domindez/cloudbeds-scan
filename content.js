// Content script para interactuar con la página de Cloudbeds

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'fillGuestForm') {
    fillGuestForm(request.data, request.imageToUpload)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantener el canal abierto para respuesta asíncrona
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Content script activo' });
    return true;
  }
  
  if (request.action === 'checkEditMode') {
    const isEditMode = checkIfEditMode();
    sendResponse({ success: true, isEditMode });
    return true;
  }
  
  return true;
});

// Verificar si el formulario está en modo edición
function checkIfEditMode() {
  // Buscar la barra de guardado - solo aparece cuando se está editando
  const savePanel = document.getElementById('panelSave');
  
  if (savePanel) {
    const style = window.getComputedStyle(savePanel);
    if (style.display !== 'none') {
      return true;
    }
  }
  
  return false;
}

// Función principal para rellenar el formulario
async function fillGuestForm(data, imageToUpload) {
  
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
      // showNotification('⚠️ No se encontró formulario de huésped en esta página');
      return { success: false, error: 'Formulario no encontrado' };
    }
  }
  
  // Buscar y hacer clic en el botón de edición si es necesario
  await clickEditButtonIfNeeded();
  
  // Esperar un momento para que se habiliten los campos
  await sleep(300);
  
  // Rellenar los campos
  const filledCount = await doFillForm(data);
  
  // Subir la imagen del documento si está disponible
  let photoUploaded = false;
  if (imageToUpload) {
    try {
      photoUploaded = await uploadGuestPhoto(imageToUpload);
    } catch (uploadError) {
      // No fallar el proceso completo si la foto no se sube
    }
  }
  
  return { success: true, filledCount, photoUploaded };
}

// Buscar y hacer clic en el botón de edición
async function clickEditButtonIfNeeded() {
  // Verificar si ya estamos en modo edición
  const isEditable = document.querySelector('input[name="guest_first_name"]:not([readonly]):not([disabled])');
  if (isEditable && !isEditable.readOnly && !isEditable.disabled) {
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
        break;
      }
    }
  }
  
  if (editButton) {
    editButton.click();
    await sleep(800); // Esperar que se habiliten los campos
  }
}

// Rellenar los campos del formulario
async function doFillForm(data) {
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
  
  // Detectar si es español
  const isSpanish = isSpanishPerson(processedData);
  
  // Para NO españoles: dirección = nombre del país, código postal = "SN", country = código ISO
  // Para españoles: usar la dirección y código postal extraídos del DNI (si existen)
  if (!isSpanish) {
    // Obtener el código ISO y nombre del país
    const countrySource = processedData.nationality || processedData.issuingCountry || processedData.country;
    const countryInfo = getCountryInfo(countrySource);
    
    if (countryInfo) {
      // Dirección = nombre del país
      processedData.address = countryInfo.name;
      // Ciudad = nombre del país
      processedData.city = countryInfo.name;
      // País = código ISO (para el select)
      processedData.country = countryInfo.code;
    }
    processedData.zipCode = 'SN';
  } else {
    // Para españoles: verificar que tenemos dirección y código postal del DNI
    if (processedData.address) {
    }
    if (processedData.zipCode) {
    }
    // Para españoles: usar city como municipality
    if (processedData.city) {
      processedData.municipality = processedData.city;
    }
  }
  
  
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
    zipCode: [
      'input[name="guest_zip"]',
      '#guest_zip',
      'input[id*="zip"]',
      'input[name*="postal"]'
    ],
    city: [
      'input[name="guest_city"]',
      '#guest_city',
      'input[id*="city"]'
    ],
    // IMPORTANTE: country debe ir ANTES de province porque Cloudbeds carga las provincias según el país
    country: [
      'select[name="guest_country"]',
      '#guest_country',
      'select[id*="country"]:not([id*="issuing"])'
    ],
    province: [
      'select[name="guest_state"]',
      '#guest_state',
      'select.country-states',
      'select[id*="state"]'
    ],
    // Municipality se maneja de forma especial (typeahead)
    municipality: [
      'input[name="municipality"]',
      'input[data-field-type="dataset"]'
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
    
    // Manejo especial para municipio (typeahead)
    if (dataKey === 'municipality') {
      const municipalityFilled = await fillMunicipalityField(value, processedData.province);
      if (municipalityFilled) filledCount++;
      continue;
    }
    
    // Manejo especial para nacionalidad (typeahead con lista de países)
    if (dataKey === 'nationality') {
      const nationalityFilled = await fillNationalityField(value);
      if (nationalityFilled) filledCount++;
      continue;
    }
    
    let element = null;
    for (const selector of selectors) {
      element = document.querySelector(selector);
      if (element) {
        break;
      }
    }
    
    if (!element) {
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
        
        // Si es el país, esperar a que se carguen las provincias
        if (dataKey === 'country') {
          await sleep(500);
        }
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
    }
  }
  
  // Habilitar campos de documento después de seleccionar tipo
  if (processedData.documentType) {
    setTimeout(() => {
      enableDocumentFields();
    }, 300);
  }
  
  // showNotification(`✓ ${filledCount} campos rellenados correctamente`);
  
  return filledCount;
}

// Función especial para rellenar fecha de nacimiento (Cloudbeds tiene 2 inputs)
function fillBirthdateFields(dateValue) {
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
    return 0;
  }
  
  const formattedDate = `${day}/${month}/${year}`;
  
  // 1. Rellenar el input visible (label_birthday) - el que tiene datepicker
  const labelBirthday = document.querySelector('input[name="label_birthday"], input.label_birthday');
  if (labelBirthday) {
    labelBirthday.value = formattedDate;
    labelBirthday.dispatchEvent(new Event('change', { bubbles: true }));
    labelBirthday.dispatchEvent(new Event('blur', { bubbles: true }));
    filled++;
    
    // Intentar con jQuery datepicker si existe
    if (typeof jQuery !== 'undefined') {
      try {
        const $input = jQuery(labelBirthday);
        if ($input.datepicker) {
          $input.datepicker('setDate', new Date(year, parseInt(month) - 1, parseInt(day)));
        }
      } catch (e) {
      }
    }
  }
  
  // 2. Rellenar el input hidden (guest_birthday) - el que guarda el valor real
  const guestBirthday = document.querySelector('input[name="guest_birthday"], input.birthday');
  if (guestBirthday) {
    guestBirthday.value = formattedDate;
    guestBirthday.dispatchEvent(new Event('change', { bubbles: true }));
    filled++;
  }
  
  // 3. Actualizar el div estático si existe
  const staticDiv = document.querySelector('[data-hook="guest-birthday-text-value"]');
  if (staticDiv) {
    staticDiv.textContent = formattedDate;
  }
  
  return filled > 0 ? 1 : 0; // Contar como 1 campo rellenado
}

// Función especial para rellenar el campo municipio
// Busca en el array de municipios.js el que más se parezca
async function fillMunicipalityField(city, province) {
  
  // Verificar que tenemos el array de municipios
  if (typeof municipios === 'undefined' || !Array.isArray(municipios)) {
    return false;
  }
  
  // Buscar el input de municipio
  const municipalityInput = document.querySelector(
    'input[name="municipality"], ' +
    'input[data-field-type="dataset"][data-requirement-dataset-id="1003"]'
  );
  
  if (!municipalityInput) {
    return false;
  }
  
  // Normalizar texto (quitar acentos, minúsculas)
  const normalizeText = (text) => {
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };
  
  const cityNormalized = normalizeText(city);
  const provinceNormalized = province ? normalizeText(province) : '';
  
  
  // Buscar el mejor municipio coincidente
  let bestMatch = null;
  let bestScore = 0;
  
  for (const muni of municipios) {
    // Extraer nombre del municipio (antes del paréntesis)
    const match = muni.match(/^(.+?)\s*\((.+)\)$/);
    if (!match) continue;
    
    const muniName = match[1];
    const muniProvince = match[2];
    const muniNameNormalized = normalizeText(muniName);
    const muniProvinceNormalized = normalizeText(muniProvince);
    
    let score = 0;
    
    // Coincidencia exacta del nombre de ciudad
    if (muniNameNormalized === cityNormalized) {
      score = 100;
    }
    // El nombre del municipio contiene la ciudad
    else if (muniNameNormalized.includes(cityNormalized)) {
      score = 80;
    }
    // La ciudad contiene el nombre del municipio
    else if (cityNormalized.includes(muniNameNormalized)) {
      score = 70;
    }
    // Similitud parcial (primeras letras)
    else if (muniNameNormalized.startsWith(cityNormalized.substring(0, 4))) {
      score = 40;
    }
    
    // Bonus si la provincia también coincide
    if (score > 0 && provinceNormalized) {
      if (muniProvinceNormalized.includes(provinceNormalized) || 
          provinceNormalized.includes(muniProvinceNormalized)) {
        score += 50;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = muni;
    }
  }
  
  if (bestMatch && bestScore >= 70) {
    
    // Habilitar el campo si está deshabilitado
    municipalityInput.disabled = false;
    municipalityInput.readOnly = false;
    
    // Establecer el valor directamente
    municipalityInput.value = bestMatch;
    municipalityInput.dispatchEvent(new Event('input', { bubbles: true }));
    municipalityInput.dispatchEvent(new Event('change', { bubbles: true }));
    municipalityInput.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Actualizar el div estático si existe
    const formGroup = municipalityInput.closest('.form-group');
    if (formGroup) {
      const staticDiv = formGroup.querySelector('.form-control-static');
      if (staticDiv) {
        staticDiv.textContent = bestMatch;
      }
    }
    
    return true;
  }
  
  return false;
}

// Busca en el array de countries.js el país que más se parezca
async function fillNationalityField(nationality) {
  
  // Verificar que tenemos el array de países
  if (typeof countries === 'undefined' || !Array.isArray(countries)) {
    return false;
  }
  
  // Buscar el input de nacionalidad
  const nationalityInput = document.querySelector(
    'input[name="nationality"], ' +
    'input[data-field-type="dataset"][data-requirement-dataset-id="1"]'
  );
  
  if (!nationalityInput) {
    return false;
  }
  
  // Normalizar texto (quitar acentos, minúsculas)
  const normalizeText = (text) => {
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };
  
  const nationalityNormalized = normalizeText(nationality);
  
  // Primero buscar en los alias (traducciones español -> inglés, gentilicios, etc.)
  if (typeof countryAliases !== 'undefined') {
    const aliasMatch = countryAliases[nationalityNormalized];
    if (aliasMatch) {
      return setNationalityValue(nationalityInput, aliasMatch);
    }
  }
  
  // Buscar coincidencia directa o parcial en la lista de países
  let bestMatch = null;
  let bestScore = 0;
  
  for (const country of countries) {
    const countryNormalized = normalizeText(country);
    
    let score = 0;
    
    // Coincidencia exacta
    if (countryNormalized === nationalityNormalized) {
      score = 100;
    }
    // El país contiene la nacionalidad buscada
    else if (countryNormalized.includes(nationalityNormalized)) {
      score = 80;
    }
    // La nacionalidad contiene el nombre del país
    else if (nationalityNormalized.includes(countryNormalized)) {
      score = 70;
    }
    // Similitud parcial (primeras letras)
    else if (countryNormalized.startsWith(nationalityNormalized.substring(0, 4))) {
      score = 50;
    }
    // Coincidencia de primeras 3 letras
    else if (countryNormalized.substring(0, 3) === nationalityNormalized.substring(0, 3)) {
      score = 30;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = country;
    }
  }
  
  if (bestMatch && bestScore >= 50) {
    return setNationalityValue(nationalityInput, bestMatch);
  }
  
  return false;
}

// Establecer el valor en el campo de nacionalidad
function setNationalityValue(input, value) {
  // Habilitar el campo si está deshabilitado
  input.disabled = false;
  input.readOnly = false;
  
  // Establecer el valor directamente
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // Actualizar el div estático si existe
  const formGroup = input.closest('.form-group');
  if (formGroup) {
    const staticDiv = formGroup.querySelector('.form-control-static');
    if (staticDiv) {
      staticDiv.textContent = value;
    }
  }
  
  return true;
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
  
  
  // Si es un input type="date", usar formato ISO
  if (input.type === 'date') {
    const isoDate = formats['yyyy-mm-dd'];
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
  
  
  // Establecer el valor
  setInputValue(input, dateValue);
  
  // Si hay un datepicker, intentar disparar eventos específicos
  if (input.classList.contains('datepicker') || input.classList.contains('hasDatepicker')) {
    // jQuery datepicker
    if (typeof jQuery !== 'undefined' && jQuery(input).datepicker) {
      try {
        jQuery(input).datepicker('setDate', new Date(year, month - 1, day));
      } catch (e) {
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
  
  // Mapeo especial para provincias españolas (normalizar nombres)
  const provinceMap = {
    'alava': 'Álava',
    'araba': 'Álava',
    'vitoria': 'Álava',
    'albacete': 'Albacete',
    'alicante': 'Alicante',
    'alacant': 'Alicante',
    'almeria': 'Almería',
    'almería': 'Almería',
    'asturias': 'Asturias',
    'oviedo': 'Asturias',
    'avila': 'Ávila',
    'ávila': 'Ávila',
    'badajoz': 'Badajoz',
    'barcelona': 'Barcelona',
    'burgos': 'Burgos',
    'cantabria': 'Cantabria',
    'santander': 'Cantabria',
    'castellon': 'Castellón',
    'castellón': 'Castellón',
    'castello': 'Castellón',
    'ceuta': 'Ceuta',
    'ciudad real': 'Ciudad Real',
    'cuenca': 'Cuenca',
    'caceres': 'Cáceres',
    'cáceres': 'Cáceres',
    'cadiz': 'Cádiz',
    'cádiz': 'Cádiz',
    'cordoba': 'Córdoba',
    'córdoba': 'Córdoba',
    'gerona': 'Gerona',
    'girona': 'Gerona',
    'granada': 'Granada',
    'guadalajara': 'Guadalajara',
    'guipuzcoa': 'Guipúzcoa',
    'guipúzcoa': 'Guipúzcoa',
    'gipuzkoa': 'Guipúzcoa',
    'san sebastian': 'Guipúzcoa',
    'donostia': 'Guipúzcoa',
    'huelva': 'Huelva',
    'huesca': 'Huesca',
    'baleares': 'Islas Baleares',
    'islas baleares': 'Islas Baleares',
    'illes balears': 'Islas Baleares',
    'mallorca': 'Islas Baleares',
    'palma': 'Islas Baleares',
    'jaen': 'Jaén',
    'jaén': 'Jaén',
    'coruña': 'La Coruña',
    'la coruña': 'La Coruña',
    'a coruña': 'La Coruña',
    'rioja': 'La Rioja',
    'la rioja': 'La Rioja',
    'logroño': 'La Rioja',
    'las palmas': 'Las Palmas',
    'gran canaria': 'Las Palmas',
    'leon': 'León',
    'león': 'León',
    'lugo': 'Lugo',
    'lerida': 'Lérida',
    'lérida': 'Lérida',
    'lleida': 'Lérida',
    'madrid': 'Madrid',
    'melilla': 'Melilla',
    'murcia': 'Murcia',
    'malaga': 'Málaga',
    'málaga': 'Málaga',
    'navarra': 'Navarra',
    'pamplona': 'Navarra',
    'orense': 'Orense',
    'ourense': 'Orense',
    'palencia': 'Palencia',
    'pontevedra': 'Pontevedra',
    'vigo': 'Pontevedra',
    'salamanca': 'Salamanca',
    'santa cruz': 'Santa Cruz',
    'tenerife': 'Santa Cruz',
    'santa cruz de tenerife': 'Santa Cruz',
    'segovia': 'Segovia',
    'sevilla': 'Sevilla',
    'soria': 'Soria',
    'tarragona': 'Tarragona',
    'teruel': 'Teruel',
    'toledo': 'Toledo',
    'valencia': 'Valencia',
    'valència': 'Valencia',
    'valladolid': 'Valladolid',
    'vizcaya': 'Vizcaya',
    'bizkaia': 'Vizcaya',
    'bilbao': 'Vizcaya',
    'zamora': 'Zamora',
    'zaragoza': 'Zaragoza'
  };
  
  // Intentar mapear provincia
  const normalizedProvince = provinceMap[valueLower];
  if (normalizedProvince) {
    for (const option of select.options) {
      if (option.value === normalizedProvince || option.text === normalizedProvince) {
        select.value = option.value;
        triggerChange(select);
        return true;
      }
    }
  }
  
  return false;
}

// Disparar evento change y actualizar displays estáticos de Cloudbeds
function triggerChange(element) {
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  
  // Cloudbeds usa divs estáticos para mostrar valores de selects
  // Buscar y actualizar el div de display asociado
  if (element.tagName.toLowerCase() === 'select') {
    const selectedText = element.options[element.selectedIndex]?.text || '';
    const fieldName = element.name || element.id;
    
    // Buscar div de display por data-hook (patrón común en Cloudbeds)
    const hookName = fieldName.replace('guest_', '') + '-text-value';
    let displayDiv = document.querySelector(`[data-hook="guest-${hookName}"]`);
    
    // Si no encuentra, buscar por patrones alternativos
    if (!displayDiv) {
      displayDiv = document.querySelector(`[data-hook="${fieldName}-text-value"]`);
    }
    
    // Buscar en el mismo contenedor form-group
    if (!displayDiv) {
      const formGroup = element.closest('.form-group');
      if (formGroup) {
        displayDiv = formGroup.querySelector('.form-control-static');
      }
    }
    
    if (displayDiv && selectedText) {
      displayDiv.textContent = selectedText;
    }
  }
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
  
}

// Mostrar notificación visual (DESACTIVADA)
/*
function showNotification(message) {
  // Eliminar notificación anterior si existe
  const existing = document.getElementById('cloudbeds-scanner-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'cloudbeds-scanner-notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);

  // Forzar clase show para animar
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Eliminar después de 3 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}
*/

// Función auxiliar para esperar
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Detectar si el documento es español (expedido en España)
// Esto incluye: DNI español, NIE, pasaporte español, permiso de residencia español
function isSpanishPerson(data) {
  // Comprobar país expedidor del documento (lo más fiable)
  const issuingCountry = (data.issuingCountry || '').toLowerCase().trim();
  if (issuingCountry === 'es' || issuingCountry === 'esp' || issuingCountry === 'spain' || issuingCountry === 'españa') {
    return true;
  }
  
  // Comprobar tipo de documento español
  const docType = (data.documentType || '').toLowerCase().trim();
  if (docType === 'dni' || docType === 'nie') {
    // DNI y NIE son exclusivamente españoles
    return true;
  }
  
  return false;
}

// Obtener información del país (código ISO y nombre) para el select de Cloudbeds
function getCountryInfo(value) {
  if (!value) return null;
  
  const valueLower = value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Mapeo completo de países con código ISO y nombre en español (como aparece en Cloudbeds)
  const countries = [
    { code: 'AF', name: 'Afganistán', aliases: ['afganistan', 'afghanistan'] },
    { code: 'AL', name: 'Albania', aliases: ['albania'] },
    { code: 'DZ', name: 'Argelia', aliases: ['argelia', 'algeria'] },
    { code: 'AD', name: 'Andorra', aliases: ['andorra'] },
    { code: 'AO', name: 'Angola', aliases: ['angola'] },
    { code: 'AG', name: 'Antigua y Barbuda', aliases: ['antigua', 'antigua y barbuda', 'antigua and barbuda'] },
    { code: 'AR', name: 'Argentina', aliases: ['argentina', 'argentino', 'argentinian'] },
    { code: 'AM', name: 'Armenia', aliases: ['armenia'] },
    { code: 'AU', name: 'Australia', aliases: ['australia', 'australian'] },
    { code: 'AT', name: 'Austria', aliases: ['austria', 'austrian', 'osterreich'] },
    { code: 'AZ', name: 'Azerbaiyán', aliases: ['azerbaiyan', 'azerbaijan'] },
    { code: 'BS', name: 'Bahamas', aliases: ['bahamas'] },
    { code: 'BH', name: 'Baréin', aliases: ['barein', 'bahrain'] },
    { code: 'BD', name: 'Bangladés', aliases: ['banglades', 'bangladesh'] },
    { code: 'BB', name: 'Barbados', aliases: ['barbados'] },
    { code: 'BY', name: 'Bielorrusia', aliases: ['bielorrusia', 'belarus', 'belarussian'] },
    { code: 'BE', name: 'Bélgica', aliases: ['belgica', 'belgium', 'belgian', 'belge'] },
    { code: 'BZ', name: 'Belice', aliases: ['belice', 'belize'] },
    { code: 'BJ', name: 'Benín', aliases: ['benin'] },
    { code: 'BT', name: 'Bután', aliases: ['butan', 'bhutan'] },
    { code: 'BO', name: 'Bolivia', aliases: ['bolivia', 'bolivian'] },
    { code: 'BA', name: 'Bosnia y Herzegovina', aliases: ['bosnia', 'bosnia y herzegovina', 'bosnia and herzegovina'] },
    { code: 'BW', name: 'Botsuana', aliases: ['botsuana', 'botswana'] },
    { code: 'BR', name: 'Brasil', aliases: ['brasil', 'brazil', 'brazilian', 'brasileiro'] },
    { code: 'BN', name: 'Brunéi', aliases: ['brunei'] },
    { code: 'BG', name: 'Bulgaria', aliases: ['bulgaria', 'bulgarian'] },
    { code: 'BF', name: 'Burkina Faso', aliases: ['burkina faso', 'burkina'] },
    { code: 'BI', name: 'Burundi', aliases: ['burundi'] },
    { code: 'KH', name: 'Camboya', aliases: ['camboya', 'cambodia'] },
    { code: 'CM', name: 'Camerún', aliases: ['camerun', 'cameroon'] },
    { code: 'CA', name: 'Canadá', aliases: ['canada', 'canadian', 'canadien'] },
    { code: 'CV', name: 'Cabo Verde', aliases: ['cabo verde', 'cape verde'] },
    { code: 'CF', name: 'República Centroafricana', aliases: ['republica centroafricana', 'central african republic'] },
    { code: 'TD', name: 'Chad', aliases: ['chad'] },
    { code: 'CL', name: 'Chile', aliases: ['chile', 'chilean', 'chileno'] },
    { code: 'CN', name: 'China', aliases: ['china', 'chinese', 'chino'] },
    { code: 'CO', name: 'Colombia', aliases: ['colombia', 'colombian', 'colombiano'] },
    { code: 'KM', name: 'Comoras', aliases: ['comoras', 'comoros'] },
    { code: 'CR', name: 'Costa Rica', aliases: ['costa rica', 'costarricense'] },
    { code: 'CI', name: 'Costa de Marfil', aliases: ['costa de marfil', 'ivory coast', 'cote d\'ivoire'] },
    { code: 'HR', name: 'Croacia', aliases: ['croacia', 'croatia', 'croatian'] },
    { code: 'CU', name: 'Cuba', aliases: ['cuba', 'cuban', 'cubano'] },
    { code: 'CY', name: 'Chipre', aliases: ['chipre', 'cyprus'] },
    { code: 'CZ', name: 'República Checa', aliases: ['republica checa', 'czech republic', 'czechia', 'czech'] },
    { code: 'CD', name: 'República Democrática del Congo', aliases: ['republica democratica del congo', 'democratic republic of congo', 'drc'] },
    { code: 'DK', name: 'Dinamarca', aliases: ['dinamarca', 'denmark', 'danish', 'danes'] },
    { code: 'DJ', name: 'Yibuti', aliases: ['yibuti', 'djibouti'] },
    { code: 'DM', name: 'Dominica', aliases: ['dominica'] },
    { code: 'DO', name: 'República Dominicana', aliases: ['republica dominicana', 'dominican republic', 'dominicano'] },
    { code: 'EC', name: 'Ecuador', aliases: ['ecuador', 'ecuadorian', 'ecuatoriano'] },
    { code: 'EG', name: 'Egipto', aliases: ['egipto', 'egypt', 'egyptian'] },
    { code: 'SV', name: 'El Salvador', aliases: ['el salvador', 'salvadoreno'] },
    { code: 'GQ', name: 'Guinea Ecuatorial', aliases: ['guinea ecuatorial', 'equatorial guinea'] },
    { code: 'ER', name: 'Eritrea', aliases: ['eritrea'] },
    { code: 'EE', name: 'Estonia', aliases: ['estonia', 'estonian'] },
    { code: 'ET', name: 'Etiopía', aliases: ['etiopia', 'ethiopia'] },
    { code: 'FJ', name: 'Fiyi', aliases: ['fiyi', 'fiji'] },
    { code: 'FI', name: 'Finlandia', aliases: ['finlandia', 'finland', 'finnish', 'suomi'] },
    { code: 'FR', name: 'Francia', aliases: ['francia', 'france', 'french', 'francais', 'francaise'] },
    { code: 'GA', name: 'Gabón', aliases: ['gabon'] },
    { code: 'GM', name: 'Gambia', aliases: ['gambia'] },
    { code: 'GE', name: 'Georgia', aliases: ['georgia', 'georgian'] },
    { code: 'DE', name: 'Alemania', aliases: ['alemania', 'germany', 'german', 'deutsch', 'deutsche'] },
    { code: 'GH', name: 'Ghana', aliases: ['ghana'] },
    { code: 'GR', name: 'Grecia', aliases: ['grecia', 'greece', 'greek', 'hellas'] },
    { code: 'GD', name: 'Granada', aliases: ['granada', 'grenada'] },
    { code: 'GT', name: 'Guatemala', aliases: ['guatemala', 'guatemalteco'] },
    { code: 'GN', name: 'Guinea', aliases: ['guinea'] },
    { code: 'GW', name: 'Guinea-Bisáu', aliases: ['guinea-bisau', 'guinea bissau'] },
    { code: 'GY', name: 'Guyana', aliases: ['guyana'] },
    { code: 'HT', name: 'Haití', aliases: ['haiti'] },
    { code: 'HN', name: 'Honduras', aliases: ['honduras', 'hondureno'] },
    { code: 'HK', name: 'Hong Kong', aliases: ['hong kong'] },
    { code: 'HU', name: 'Hungría', aliases: ['hungria', 'hungary', 'hungarian', 'magyar'] },
    { code: 'IS', name: 'Islandia', aliases: ['islandia', 'iceland', 'icelandic'] },
    { code: 'IN', name: 'India', aliases: ['india', 'indian'] },
    { code: 'ID', name: 'Indonesia', aliases: ['indonesia', 'indonesian'] },
    { code: 'IR', name: 'Irán', aliases: ['iran', 'iranian', 'persia'] },
    { code: 'IQ', name: 'Irak', aliases: ['irak', 'iraq', 'iraqi'] },
    { code: 'IE', name: 'Irlanda', aliases: ['irlanda', 'ireland', 'irish', 'eire'] },
    { code: 'IL', name: 'Israel', aliases: ['israel', 'israeli'] },
    { code: 'IT', name: 'Italia', aliases: ['italia', 'italy', 'italian', 'italiano'] },
    { code: 'JM', name: 'Jamaica', aliases: ['jamaica', 'jamaican'] },
    { code: 'JP', name: 'Japón', aliases: ['japon', 'japan', 'japanese', 'nippon'] },
    { code: 'JO', name: 'Jordania', aliases: ['jordania', 'jordan', 'jordanian'] },
    { code: 'KZ', name: 'Kazajistán', aliases: ['kazajistan', 'kazakhstan'] },
    { code: 'KE', name: 'Kenia', aliases: ['kenia', 'kenya'] },
    { code: 'KI', name: 'Kiribati', aliases: ['kiribati'] },
    { code: 'XK', name: 'Kosovo', aliases: ['kosovo'] },
    { code: 'KW', name: 'Kuwait', aliases: ['kuwait'] },
    { code: 'KG', name: 'Kirguistán', aliases: ['kirguistan', 'kyrgyzstan'] },
    { code: 'LA', name: 'Laos', aliases: ['laos'] },
    { code: 'LV', name: 'Letonia', aliases: ['letonia', 'latvia', 'latvian'] },
    { code: 'LB', name: 'Líbano', aliases: ['libano', 'lebanon', 'lebanese'] },
    { code: 'LS', name: 'Lesoto', aliases: ['lesoto', 'lesotho'] },
    { code: 'LR', name: 'Liberia', aliases: ['liberia'] },
    { code: 'LY', name: 'Libia', aliases: ['libia', 'libya'] },
    { code: 'LI', name: 'Liechtenstein', aliases: ['liechtenstein'] },
    { code: 'LT', name: 'Lituania', aliases: ['lituania', 'lithuania', 'lithuanian'] },
    { code: 'LU', name: 'Luxemburgo', aliases: ['luxemburgo', 'luxembourg'] },
    { code: 'MK', name: 'Macedonia del Norte', aliases: ['macedonia', 'macedonia del norte', 'north macedonia'] },
    { code: 'MG', name: 'Madagascar', aliases: ['madagascar'] },
    { code: 'MW', name: 'Malaui', aliases: ['malaui', 'malawi'] },
    { code: 'MY', name: 'Malasia', aliases: ['malasia', 'malaysia', 'malaysian'] },
    { code: 'MV', name: 'Maldivas', aliases: ['maldivas', 'maldives'] },
    { code: 'ML', name: 'Malí', aliases: ['mali'] },
    { code: 'MT', name: 'Malta', aliases: ['malta', 'maltese'] },
    { code: 'MH', name: 'Islas Marshall', aliases: ['islas marshall', 'marshall islands'] },
    { code: 'MR', name: 'Mauritania', aliases: ['mauritania'] },
    { code: 'MU', name: 'Mauricio', aliases: ['mauricio', 'mauritius'] },
    { code: 'MX', name: 'México', aliases: ['mexico', 'mexican', 'mexicano'] },
    { code: 'FM', name: 'Micronesia', aliases: ['micronesia'] },
    { code: 'MD', name: 'Moldavia', aliases: ['moldavia', 'moldova'] },
    { code: 'MC', name: 'Mónaco', aliases: ['monaco'] },
    { code: 'MN', name: 'Mongolia', aliases: ['mongolia'] },
    { code: 'ME', name: 'Montenegro', aliases: ['montenegro'] },
    { code: 'MA', name: 'Marruecos', aliases: ['marruecos', 'morocco', 'moroccan', 'marroqui', 'maroc'] },
    { code: 'MZ', name: 'Mozambique', aliases: ['mozambique'] },
    { code: 'MM', name: 'Birmania', aliases: ['birmania', 'myanmar', 'burma'] },
    { code: 'NA', name: 'Namibia', aliases: ['namibia'] },
    { code: 'NR', name: 'Nauru', aliases: ['nauru'] },
    { code: 'NP', name: 'Nepal', aliases: ['nepal'] },
    { code: 'NL', name: 'Países Bajos', aliases: ['paises bajos', 'netherlands', 'holland', 'dutch', 'holandes', 'neerlandes'] },
    { code: 'NZ', name: 'Nueva Zelanda', aliases: ['nueva zelanda', 'new zealand'] },
    { code: 'NI', name: 'Nicaragua', aliases: ['nicaragua', 'nicaraguense'] },
    { code: 'NE', name: 'Níger', aliases: ['niger'] },
    { code: 'NG', name: 'Nigeria', aliases: ['nigeria', 'nigerian'] },
    { code: 'KP', name: 'Corea del Norte', aliases: ['corea del norte', 'north korea'] },
    { code: 'NO', name: 'Noruega', aliases: ['noruega', 'norway', 'norwegian', 'norsk'] },
    { code: 'OM', name: 'Omán', aliases: ['oman'] },
    { code: 'PK', name: 'Pakistán', aliases: ['pakistan', 'pakistani'] },
    { code: 'PW', name: 'Palaos', aliases: ['palaos', 'palau'] },
    { code: 'PA', name: 'Panamá', aliases: ['panama', 'panameno'] },
    { code: 'PG', name: 'Papúa Nueva Guinea', aliases: ['papua nueva guinea', 'papua new guinea'] },
    { code: 'PY', name: 'Paraguay', aliases: ['paraguay', 'paraguayo'] },
    { code: 'PE', name: 'Perú', aliases: ['peru', 'peruvian', 'peruano'] },
    { code: 'PH', name: 'Filipinas', aliases: ['filipinas', 'philippines', 'filipino'] },
    { code: 'PL', name: 'Polonia', aliases: ['polonia', 'poland', 'polish', 'polska', 'polaco'] },
    { code: 'PT', name: 'Portugal', aliases: ['portugal', 'portuguese', 'portugues'] },
    { code: 'PR', name: 'Puerto Rico', aliases: ['puerto rico', 'puertorriqueno'] },
    { code: 'QA', name: 'Catar', aliases: ['catar', 'qatar'] },
    { code: 'CG', name: 'República del Congo', aliases: ['republica del congo', 'republic of congo', 'congo'] },
    { code: 'RO', name: 'Rumania', aliases: ['rumania', 'romania', 'romanian'] },
    { code: 'RU', name: 'Rusia', aliases: ['rusia', 'russia', 'russian', 'ruso'] },
    { code: 'RW', name: 'Ruanda', aliases: ['ruanda', 'rwanda'] },
    { code: 'KN', name: 'San Cristóbal y Nieves', aliases: ['san cristobal y nieves', 'saint kitts and nevis'] },
    { code: 'LC', name: 'Santa Lucía', aliases: ['santa lucia', 'saint lucia'] },
    { code: 'VC', name: 'San Vicente y las Granadinas', aliases: ['san vicente', 'saint vincent'] },
    { code: 'WS', name: 'Samoa', aliases: ['samoa'] },
    { code: 'SM', name: 'San Marino', aliases: ['san marino'] },
    { code: 'ST', name: 'Santo Tomé y Príncipe', aliases: ['santo tome y principe', 'sao tome and principe'] },
    { code: 'SA', name: 'Arabia Saudita', aliases: ['arabia saudita', 'saudi arabia', 'saudi'] },
    { code: 'SN', name: 'Senegal', aliases: ['senegal'] },
    { code: 'RS', name: 'Serbia', aliases: ['serbia', 'serbian'] },
    { code: 'SC', name: 'Seychelles', aliases: ['seychelles'] },
    { code: 'SL', name: 'Sierra Leona', aliases: ['sierra leona', 'sierra leone'] },
    { code: 'SG', name: 'Singapur', aliases: ['singapur', 'singapore'] },
    { code: 'SK', name: 'Eslovaquia', aliases: ['eslovaquia', 'slovakia', 'slovak'] },
    { code: 'SI', name: 'Eslovenia', aliases: ['eslovenia', 'slovenia', 'slovenian'] },
    { code: 'SB', name: 'Islas Salomón', aliases: ['islas salomon', 'solomon islands'] },
    { code: 'SO', name: 'Somalia', aliases: ['somalia'] },
    { code: 'ZA', name: 'Sudáfrica', aliases: ['sudafrica', 'south africa', 'south african'] },
    { code: 'KR', name: 'Corea del Sur', aliases: ['corea del sur', 'south korea', 'korea'] },
    { code: 'SS', name: 'Sudán del Sur', aliases: ['sudan del sur', 'south sudan'] },
    { code: 'ES', name: 'España', aliases: ['espana', 'spain', 'spanish', 'espanol', 'espanola'] },
    { code: 'LK', name: 'Sri Lanka', aliases: ['sri lanka'] },
    { code: 'SD', name: 'Sudán', aliases: ['sudan'] },
    { code: 'SR', name: 'Surinam', aliases: ['surinam', 'suriname'] },
    { code: 'SZ', name: 'Suazilandia', aliases: ['suazilandia', 'eswatini', 'swaziland'] },
    { code: 'SE', name: 'Suecia', aliases: ['suecia', 'sweden', 'swedish', 'svensk'] },
    { code: 'CH', name: 'Suiza', aliases: ['suiza', 'switzerland', 'swiss', 'suisse', 'schweiz'] },
    { code: 'SY', name: 'Siria', aliases: ['siria', 'syria', 'syrian'] },
    { code: 'TW', name: 'Taiwan', aliases: ['taiwan'] },
    { code: 'TJ', name: 'Tayikistán', aliases: ['tayikistan', 'tajikistan'] },
    { code: 'TZ', name: 'Tanzania', aliases: ['tanzania'] },
    { code: 'TH', name: 'Tailandia', aliases: ['tailandia', 'thailand', 'thai'] },
    { code: 'TL', name: 'Timor Oriental', aliases: ['timor oriental', 'east timor', 'timor leste'] },
    { code: 'TG', name: 'Togo', aliases: ['togo'] },
    { code: 'TO', name: 'Tonga', aliases: ['tonga'] },
    { code: 'TT', name: 'Trinidad y Tobago', aliases: ['trinidad y tobago', 'trinidad and tobago'] },
    { code: 'TN', name: 'Túnez', aliases: ['tunez', 'tunisia'] },
    { code: 'TR', name: 'Turquía', aliases: ['turquia', 'turkey', 'turkish', 'turk'] },
    { code: 'TM', name: 'Turkmenistán', aliases: ['turkmenistan'] },
    { code: 'TV', name: 'Tuvalu', aliases: ['tuvalu'] },
    { code: 'UG', name: 'Uganda', aliases: ['uganda'] },
    { code: 'UA', name: 'Ucrania', aliases: ['ucrania', 'ukraine', 'ukrainian', 'ucraniano'] },
    { code: 'AE', name: 'Emiratos Árabes Unidos', aliases: ['emiratos arabes unidos', 'uae', 'united arab emirates'] },
    { code: 'GB', name: 'Reino Unido', aliases: ['reino unido', 'uk', 'united kingdom', 'great britain', 'british', 'britanico', 'ingles', 'england'] },
    { code: 'US', name: 'Estados Unidos', aliases: ['estados unidos', 'usa', 'united states', 'american', 'estadounidense', 'americano'] },
    { code: 'UY', name: 'Uruguay', aliases: ['uruguay', 'uruguayo'] },
    { code: 'UZ', name: 'Uzbekistán', aliases: ['uzbekistan'] },
    { code: 'VU', name: 'Vanuatu', aliases: ['vanuatu'] },
    { code: 'VA', name: 'Vatican City', aliases: ['vaticano', 'vatican'] },
    { code: 'VE', name: 'Venezuela', aliases: ['venezuela', 'venezuelan', 'venezolano'] },
    { code: 'VN', name: 'Vietnam', aliases: ['vietnam', 'vietnamese'] },
    { code: 'YE', name: 'Yemen', aliases: ['yemen'] },
    { code: 'ZM', name: 'Zambia', aliases: ['zambia'] },
    { code: 'ZW', name: 'Zimbabue', aliases: ['zimbabue', 'zimbabwe'] }
  ];
  
  // Si es un código ISO de 2 letras, buscar directamente
  if (valueLower.length === 2) {
    const byCode = countries.find(c => c.code.toLowerCase() === valueLower);
    if (byCode) return byCode;
  }
  
  // Buscar en aliases
  for (const country of countries) {
    if (country.aliases.some(alias => alias === valueLower || valueLower.includes(alias) || alias.includes(valueLower))) {
      return country;
    }
  }
  
  // Si no encontramos, devolver null
  return null;
}

// Obtener nombre del país a partir de la nacionalidad o código (función legacy para compatibilidad)
function getCountryName(value) {
  const info = getCountryInfo(value);
  return info ? info.name : value;
}

// Función para subir la foto del documento del huésped
async function uploadGuestPhoto(imageBase64) {
  
  // Convertir base64 a File
  const file = base64ToFile(imageBase64, 'documento.jpg');
  if (!file) {
    return false;
  }
  
  // Usar siempre el modal - la subida directa no asocia la imagen al huésped
  return await tryModalUpload(file);
}

// Subir usando el modal
async function tryModalUpload(file) {
  // Primero, cerrar cualquier modal abierto
  const existingModal = document.querySelector('.modal.in, .modal.show');
  if (existingModal) {
    const closeBtn = existingModal.querySelector('button.close[data-dismiss="modal"]');
    if (closeBtn) {
      closeBtn.click();
      await sleep(500);
    }
  }
  
  // Buscar el botón de subir foto
  const uploadBtn = document.querySelector('button[data-hook="guest-photo-upload"]');
  if (!uploadBtn) {
    return false;
  }
  
  // Hacer clic en el botón para abrir el modal
  uploadBtn.click();
  
  // Esperar a que aparezca el modal con el dropzone
  await sleep(1000);
  
  // Buscar el dropzone de Dropzone.js
  const dropzoneForm = document.querySelector('form.dropzone[id^="my-dropzone-photoupload"]');
  if (!dropzoneForm) {
    const closeBtn = document.querySelector('.modal-content button.close[data-dismiss="modal"]');
    if (closeBtn) closeBtn.click();
    return false;
  }
  
  
  // Crear DataTransfer con el archivo
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  
  // Simular la secuencia completa de drag & drop
  const rect = dropzoneForm.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Dragenter
  dropzoneForm.dispatchEvent(new DragEvent('dragenter', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer,
    clientX: centerX,
    clientY: centerY
  }));
  
  await sleep(50);
  
  // Dragover (necesario para que acepte el drop)
  dropzoneForm.dispatchEvent(new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer,
    clientX: centerX,
    clientY: centerY
  }));
  
  await sleep(50);
  
  // Drop
  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer,
    clientX: centerX,
    clientY: centerY
  });
  
  dropzoneForm.dispatchEvent(dropEvent);
  
  // Si el drop nativo no funciona, intentar inyección
  await sleep(500);
  
  // Verificar si el drop funcionó (debería aparecer preview o cambiar de step)
  const dzPreview = dropzoneForm.querySelector('.dz-preview');
  const step1Hidden = document.querySelector('#step_1.hide');
  
  if (!dzPreview && !step1Hidden) {
    await injectDropzoneUpload(file, dropzoneForm.id);
  }
  
  // Esperar a que se procese y suba
  await sleep(4000);
  
  // Intentar hacer clic en los diferentes botones según el paso
  // Step 2: botón "Listo"
  let doneBtn = document.querySelector('.control-steps.step_2:not(.hide) .btn.blue.done');
  if (doneBtn) {
    doneBtn.click();
    await sleep(1000);
  }
  
  // Step 3: botón "Guardar y continuar"
  let saveBtn = document.querySelector('.control-steps.step_3:not(.hide) .btn.blue.save-uploader');
  if (saveBtn) {
    saveBtn.click();
    await sleep(500);
    return true;
  }
  
  // Verificar si ya terminó (step_resImportOk)
  const okBtn = document.querySelector('.control-steps.step_resImportOk:not(.hide) .btn.blue');
  if (okBtn) {
    okBtn.click();
    await sleep(300);
    return true;
  }
  
  const closeBtn = document.querySelector('.modal-content button.close[data-dismiss="modal"]');
  if (closeBtn) closeBtn.click();
  return false;
}

// Inyectar script para acceder a Dropzone desde el contexto de la página
function injectDropzoneUpload(file, dropzoneId) {
  return new Promise((resolve) => {
    // Convertir el archivo a base64 en chunks para evitar límite de argumentos
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Full = e.target.result; // ya viene como data:...;base64,...
      
      // Crear script que se ejecutará en el contexto de la página
      const script = document.createElement('script');
      script.id = '__cloudbeds_upload_script';
      script.textContent = `
        (function() {
          try {
            const base64Full = "${base64Full.replace(/"/g, '\\"')}";
            
            // Convertir base64 a blob
            const parts = base64Full.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while(n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], {type: mime});
            const file = new File([blob], "documento.jpg", {type: mime, lastModified: Date.now()});
            
            // Buscar Dropzone
            let dz = null;
            const form = document.getElementById("${dropzoneId}");
            if (form && form.dropzone) {
              dz = form.dropzone;
            } else if (typeof Dropzone !== 'undefined' && Dropzone.instances) {
              for (const instance of Dropzone.instances) {
                if (instance.element && instance.element.id === "${dropzoneId}") {
                  dz = instance;
                  break;
                }
              }
            }
            
            if (dz) {
              dz.addFile(file);
              window.__dzUploadResult = true;
            } else {
              window.__dzUploadResult = false;
            }
          } catch (err) {
            window.__dzUploadResult = false;
          }
        })();
      `;
      
      document.head.appendChild(script);
      script.remove();
      
      setTimeout(() => {
        resolve(window.__dzUploadResult === true);
      }, 500);
    };
    
    reader.onerror = () => {
      resolve(false);
    };
    reader.readAsDataURL(file);
  });
}

// Convertir base64 a File
function base64ToFile(base64String, filename) {
  try {
    // Eliminar el prefijo data:image/xxx;base64, si existe
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;
    
    // Detectar el tipo MIME
    let mimeType = 'image/jpeg';
    if (base64String.includes('data:image/png')) {
      mimeType = 'image/png';
    } else if (base64String.includes('data:image/gif')) {
      mimeType = 'image/gif';
    } else if (base64String.includes('data:image/webp')) {
      mimeType = 'image/webp';
    }
    
    // Decodificar base64
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Crear Blob y File
    const blob = new Blob([byteArray], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType, lastModified: Date.now() });
    
    return file;
  } catch (error) {
    return null;
  }
}

// Marcar que el content script está listo
window.cloudbedsIdScannerReady = true;
