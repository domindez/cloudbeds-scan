// Comparador de Precios para CloudBeds
// Solo se ejecuta en el calendario de CloudBeds

class PriceComparator {
	constructor() {
		this.competitors = [];
		this.priceData = {};
		this.isOpen = false;
		this.init();
	}

	async init() {
		// Solo inicializar si estamos en CloudBeds
		if (!window.location.href.includes('cloudbeds.com')) {
			('Price Comparator: No estamos en CloudBeds');
			return;
		}
		
		// Verificar si la funcionalidad está habilitada
		const enabled = await this.isEnabled();
		if (!enabled) {
			('Price Comparator: Funcionalidad desactivada');
			return;
		}
		
		('Price Comparator: Inicializando...');
		await this.loadCompetitors();
		
		// Crear elementos siempre, pero mostrar/ocultar según la página
		this.createFloatingButton();
		this.createComparatorPanel();
		
		// Mostrar u ocultar según la página actual
		this.handleUrlChange();
		
		// Observar cambios de URL para mostrar/ocultar el botón
		this.observeUrlChanges();
		
		// Escuchar mensajes para activar/desactivar dinámicamente
		this.setupMessageListener();
	}

	isCalendarPage() {
		const url = window.location.href;
		// Verificar que estamos en CloudBeds y en la ruta del calendario
		return url.includes('cloudbeds.com') && url.includes('/calendar');
	}

	observeUrlChanges() {
		// Observar cambios en la URL (para SPAs)
		let lastUrl = window.location.href;
		
		const checkUrlChange = () => {
			const currentUrl = window.location.href;
			if (currentUrl !== lastUrl) {
				lastUrl = currentUrl;
				this.handleUrlChange();
			}
		};
		
		// Observar cambios en el historial
		const originalPushState = history.pushState;
		const originalReplaceState = history.replaceState;
		
		history.pushState = function() {
			originalPushState.apply(this, arguments);
			checkUrlChange();
		};
		
		history.replaceState = function() {
			originalReplaceState.apply(this, arguments);
			checkUrlChange();
		};
		
		// También escuchar eventos popstate (botón atrás/adelante)
		window.addEventListener('popstate', checkUrlChange);
		
		// Verificar cada 500ms por si la navegación no dispara eventos
		setInterval(checkUrlChange, 500);
	}

	handleUrlChange() {
		const button = document.getElementById('price-comparator-btn');
		if (!button) return;
		
		if (this.isCalendarPage()) {
			// Mostrar el botón si estamos en el calendario
			button.style.display = 'flex';
			('Price Comparator: Mostrando botón en calendario');
		} else {
			// Ocultar el botón si no estamos en el calendario
			button.style.display = 'none';
			// Cerrar el panel si está abierto
			if (this.isOpen) {
				this.togglePanel();
			}
			('Price Comparator: Ocultando botón fuera del calendario');
		}
	}

	async isEnabled() {
		return new Promise((resolve) => {
			chrome.storage.local.get(['priceComparisonEnabled'], (result) => {
				// Por defecto está habilitado
				resolve(result.priceComparisonEnabled !== false);
			});
		});
	}

	setupMessageListener() {
		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			if (request.action === 'togglePriceComparison') {
				if (request.enabled) {
					// Recargar la página para reinicializar
					window.location.reload();
				} else {
					// Ocultar y eliminar elementos
					this.destroy();
				}
			}
		});
	}

	destroy() {
		const button = document.getElementById('price-comparator-btn');
		const panel = document.getElementById('price-comparator-panel');
		if (button) button.remove();
		if (panel) panel.remove();
		('Price Comparator: Elementos eliminados');
	}

	async loadCompetitors() {
		return new Promise((resolve) => {
			chrome.storage.sync.get(['competitors'], (result) => {
				if (result.competitors && result.competitors.length > 0) {
					this.competitors = result.competitors;
					('Competidores cargados:', this.competitors);
				} else {
					// Sin competidores por defecto
					this.competitors = [];
					('No hay competidores configurados');
				}
				resolve();
			});
		});
	}

	createFloatingButton() {
		const button = document.createElement('button');
		button.id = 'price-comparator-btn';
		button.className = 'price-comparator-floating-btn';
		button.innerHTML = `
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"/>
				<path d="m21 21-4.35-4.35"/>
			</svg>
			<span>Comparar Precios</span>
		`;
		button.title = 'Abrir comparador de precios';
		
		button.addEventListener('click', () => this.togglePanel());
		
		document.body.appendChild(button);
	}

	createComparatorPanel() {
		const panel = document.createElement('div');
		panel.id = 'price-comparator-panel';
		panel.className = 'price-comparator-panel';
		panel.innerHTML = `
			<div class="price-comparator-header">
				<h3>Comparador de Precios</h3>
				<button class="price-comparator-close" title="Cerrar">&times;</button>
			</div>
			<div class="price-comparator-body">
				<div class="price-comparator-controls">
					<div class="date-range-selector">
						<div class="date-input-group">
							<label for="checkin-date">Check-in:</label>
							<input type="date" id="checkin-date" />
						</div>
						<div class="date-input-group">
							<label for="checkout-date">Check-out:</label>
							<input type="date" id="checkout-date" />
						</div>
					</div>
					<button id="fetch-prices-btn" class="btn-primary">Obtener Precios</button>
				</div>
				<div class="price-comparator-results" id="price-results">
					<p class="info-message">Selecciona las fechas de check-in y check-out, luego haz clic en "Obtener Precios" para comparar.</p>
				</div>
			</div>
		`;

		document.body.appendChild(panel);

		// Event listeners
		panel.querySelector('.price-comparator-close').addEventListener('click', () => this.togglePanel());
		panel.querySelector('#fetch-prices-btn').addEventListener('click', () => this.fetchPrices());

		// Cerrar al hacer clic fuera del panel
		panel.addEventListener('click', (e) => {
			if (e.target === panel) {
				this.togglePanel();
			}
		});

		// Establecer fechas por defecto (hoy check-in, mañana check-out)
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		
		const checkinInput = panel.querySelector('#checkin-date');
		const checkoutInput = panel.querySelector('#checkout-date');
		
		checkinInput.value = today.toISOString().split('T')[0];
		checkoutInput.value = tomorrow.toISOString().split('T')[0];
		
		// Validar que check-out sea posterior a check-in
		checkinInput.addEventListener('change', () => {
			const checkin = new Date(checkinInput.value);
			const checkout = new Date(checkoutInput.value);
			if (checkout <= checkin) {
				const newCheckout = new Date(checkin);
				newCheckout.setDate(newCheckout.getDate() + 1);
				checkoutInput.value = newCheckout.toISOString().split('T')[0];
			}
		});
	}

	togglePanel() {
		const panel = document.getElementById('price-comparator-panel');
		this.isOpen = !this.isOpen;
		
		if (this.isOpen) {
			panel.classList.add('open');
		} else {
			panel.classList.remove('open');
			// Limpiar resultados al cerrar
			this.clearResults();
		}
	}

	clearResults() {
		const resultsDiv = document.getElementById('price-results');
		if (resultsDiv) {
			// Restaurar el mensaje inicial
			resultsDiv.innerHTML = `
				<div class="loading-container" style="display: none;">
					<div class="spinner"></div>
					<p class="loading-message">Obteniendo precios...</p>
				</div>
				<div class="info-container">
					<p class="info-message">Selecciona las fechas de check-in y check-out, luego haz clic en "Obtener Precios" para comparar.</p>
				</div>
			`;
		}
	}

	async fetchPrices() {
		const checkinInput = document.getElementById('checkin-date');
		const checkoutInput = document.getElementById('checkout-date');
		const checkinDate = checkinInput.value;
		const checkoutDate = checkoutInput.value;
		
		if (!checkinDate || !checkoutDate) {
			this.showError('Por favor selecciona las fechas de check-in y check-out');
			return;
		}
		
		// Validar que check-out sea posterior a check-in
		const checkin = new Date(checkinDate);
		const checkout = new Date(checkoutDate);
		
		if (checkout <= checkin) {
			this.showError('La fecha de check-out debe ser posterior a la de check-in');
			return;
		}

		this.showLoading();

		try {
			const results = await this.getPricesForDateRange(checkinDate, checkoutDate);
			
			// Verificar si hay error en "Mi Hotel" por fecha no visible
			const myHotelResult = results.find(r => r.isMyHotel);
			if (myHotelResult?.error?.includes('fuera del calendario')) {
				this.showError(myHotelResult.error);
				return;
			}
			
			this.displayResults(results, checkinDate, checkoutDate);
		} catch (error) {
			console.error('Error fetching prices:', error);
			this.showError('Error al obtener los precios. Por favor intenta de nuevo.');
		}
	}

	async getPricesForDateRange(checkinDate, checkoutDate) {
		// Convertir strings a objetos Date
		const checkIn = new Date(checkinDate);
		const checkOut = new Date(checkoutDate);

		const results = [];

		// Primero verificar si las fechas están visibles en el calendario de CloudBeds
		const areDatesVisible = this.areDateRangeVisibleInCalendar(checkinDate, checkoutDate);
		
		if (!areDatesVisible) {
			// Si las fechas no están visibles, retornar error específico
			results.push({
				name: 'Mi Hotel',
				roomTypes: [],
				error: 'Las fechas seleccionadas están fuera del calendario visible. Por favor, navega en el calendario de CloudBeds hasta mostrar estas fechas.',
				isMyHotel: true
			});
			return results;
		}

		// Obtener precios propios del calendario de CloudBeds (array de habitaciones)
		try {
			const myRoomTypes = this.extractMyHotelPricesForRange(checkinDate, checkoutDate);
			results.push({
				name: 'Mi Hotel',
				roomTypes: myRoomTypes,
				error: null,
				isMyHotel: true
			});
		} catch (error) {
			console.error('Error obteniendo precios propios:', error);
			results.push({
				name: 'Mi Hotel',
				roomTypes: [],
				error: 'Error al extraer los precios del calendario',
				isMyHotel: true
			});
		}

		// Luego obtener precios de competidores en paralelo
		const totalCompetitors = this.competitors.length;
		
		if (totalCompetitors > 0) {
			this.showLoading('Consultando hoteles competidores...', 0, totalCompetitors);
			
			// Ejecutar hasta 5 peticiones en paralelo para no sobrecargar el navegador
			const competitorResults = await this.fetchCompetitorsInBatches(this.competitors, checkIn, checkOut, 5);
			results.push(...competitorResults);
		}

		// Ordenar resultados: "Mi Hotel" primero, luego por precio doble de menor a mayor
		return results.sort((a, b) => {
			// Mi Hotel siempre primero
			if (a.isMyHotel) return -1;
			if (b.isMyHotel) return 1;

			// Para los competidores, ordenar por precio doble
			const priceA = this.extractNumericPrice(a.prices?.twoPax);
			const priceB = this.extractNumericPrice(b.prices?.twoPax);

			// Si ambos tienen precio, ordenar de menor a mayor
			if (priceA !== null && priceB !== null) {
				return priceA - priceB;
			}

			// Los que tienen precio van antes que los que no tienen
			if (priceA !== null) return -1;
			if (priceB !== null) return 1;

			// Si ninguno tiene precio, mantener orden original
			return 0;
		});
	}

	extractNumericPrice(priceStr) {
		// Extraer valor numérico de strings como "€40" o "40€" o "N/A"
		if (!priceStr || priceStr === 'N/A') return null;
		const match = priceStr.match(/([0-9]+(?:[.,][0-9]+)?)/);
		return match ? parseFloat(match[1].replace(',', '.')) : null;
	}

	async fetchCompetitorsInBatches(competitors, checkIn, checkOut, batchSize = 3) {
		// Procesar competidores en lotes para no abrir demasiadas pestañas a la vez
		const results = [];
		const total = competitors.length;
		let completed = 0;
		
		for (let i = 0; i < competitors.length; i += batchSize) {
			const batch = competitors.slice(i, i + batchSize);
			
			// Crear promesas con actualización de progreso solo al completar
			const batchPromises = batch.map((competitor) => {
				return this.fetchCompetitorPrices(competitor, checkIn, checkOut)
					.then(prices => {
						completed++;
						// Actualizar loader después de completar cada hotel
						this.showLoading(`Consultando hoteles (${completed}/${total})`, completed, total);
						return {
							name: competitor.name,
							url: competitor.url,
							prices: prices,
							error: null
						};
					})
					.catch(error => {
						completed++;
						// Actualizar loader después de completar (incluso si falla)
						this.showLoading(`Consultando hoteles (${completed}/${total})`, completed, total);
						console.error(`Error obteniendo precios de ${competitor.name}:`, error);
						return {
							name: competitor.name,
							url: competitor.url,
							prices: null,
							error: 'No se pudieron obtener los precios'
						};
					});
			});
			
			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);
		}
		
		return results;
	}

	isDateVisibleInCalendar(date) {
		// Verificar si la fecha está visible en alguno de los tipos de habitación
		const roomTypeIds = this.getRoomTypeIds();
		const roomIds = Object.values(roomTypeIds);

		for (const roomId of roomIds) {
			const rtArea = document.querySelector(`.c-rt-area[data-rt-id="${roomId}"]`);
			if (!rtArea) continue;

			let rtDays = rtArea.previousElementSibling;
			while (rtDays && !rtDays.classList.contains('c-rt-days')) {
				rtDays = rtDays.previousElementSibling;
			}

			if (!rtDays) continue;

			// Buscar si existe el día específico
			const dayCell = rtDays.querySelector(`.c-rt-day[data-date="${date}"]`);
			if (dayCell) {
				return true; // La fecha está visible
			}
		}

		return false; // La fecha no está visible en ningún tipo de habitación
	}

	areDateRangeVisibleInCalendar(checkinDate, checkoutDate) {
		// Verificar que todas las fechas del rango estén visibles
		const checkin = new Date(checkinDate);
		const checkout = new Date(checkoutDate);
		
		// Verificar cada día del rango
		const currentDate = new Date(checkin);
		while (currentDate < checkout) {
			const dateStr = currentDate.toISOString().split('T')[0];
			if (!this.isDateVisibleInCalendar(dateStr)) {
				return false;
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}
		
		return true;
	}

	extractMyHotelPrices(date) {
		// Extraer precios del calendario de CloudBeds para una fecha específica
		const prices = {
			onePax: 'N/A',
			twoPax: 'N/A',
			threePax: 'N/A'
		};

		// Obtener IDs de tipos de habitación dinámicamente
		const roomTypeIds = this.getRoomTypeIds();

		// Buscar precios para cada tipo de habitación
		for (const [type, roomId] of Object.entries(roomTypeIds)) {
			// Buscar el área de ese tipo de habitación
			const rtArea = document.querySelector(`.c-rt-area[data-rt-id="${roomId}"]`);
			if (!rtArea) {
				(`No se encontró c-rt-area para ${type} (${roomId})`);
				continue;
			}

			// Buscar el hermano anterior que es .c-rt-days
			let rtDays = rtArea.previousElementSibling;
			while (rtDays && !rtDays.classList.contains('c-rt-days')) {
				rtDays = rtDays.previousElementSibling;
			}

			if (!rtDays) {
				(`No se encontró c-rt-days para ${type}`);
				continue;
			}

			// Buscar el día específico
			const dayCell = rtDays.querySelector(`.c-rt-day[data-date="${date}"]`);
			if (!dayCell) {
				(`No se encontró día ${date} para ${type}`);
				continue;
			}

			// Obtener el precio
			const priceElement = dayCell.querySelector('.c-rt-price');
			if (priceElement) {
				let priceText = priceElement.textContent.trim();
				// Eliminar decimales: convertir €38,00 a €38 y cambiar formato a 38€
				priceText = priceText.replace(/,(\d+)/, '').replace(/€\s*(\d+)/, '$1€');
				(`Precio encontrado para ${type}: ${priceText}`);
				
				if (type === 'individual') {
					prices.onePax = priceText;
				} else if (type === 'doble') {
					prices.twoPax = priceText;
				} else if (type === 'triple') {
					prices.threePax = priceText;
				}
			} else {
				(`No se encontró precio para ${type}`);
			}
		}

		('Precios extraídos:', prices);
		return prices;
	}

	getRoomTypeIds() {
		// Extraer dinámicamente los IDs de tipos de habitación del calendario
		const roomTypeIds = {};

		// Buscar todos los elementos de tipos de habitación
		const roomTypeElements = document.querySelectorAll('.c-collaps[data-rt-id]');
		
		roomTypeElements.forEach(element => {
			const rtId = element.getAttribute('data-rt-id');
			const text = element.textContent.trim().toLowerCase();
			
			// Mapear basado en el texto del elemento
			if (text.includes('individual')) {
				roomTypeIds.individual = rtId;
			} else if (text.includes('doble')) {
				roomTypeIds.doble = rtId;
			} else if (text.includes('triple')) {
				roomTypeIds.triple = rtId;
			} else if (text.includes('familiar')) {
				roomTypeIds.familiar = rtId;
			}
		});

		('IDs de tipos de habitación extraídos:', roomTypeIds);
		return roomTypeIds;
	}

	extractMyHotelPricesForRange(checkinDate, checkoutDate) {
		// Extraer todas las habitaciones con sus nombres reales y precios sumados
		const checkin = new Date(checkinDate);
		const checkout = new Date(checkoutDate);
		const nights = Math.ceil((checkout - checkin) / (1000 * 60 * 60 * 24));
		
		// Obtener todos los tipos de habitación
		const roomTypeElements = document.querySelectorAll('.c-collaps[data-rt-id]');
		const roomTypes = [];
		
		roomTypeElements.forEach(element => {
			const rtId = element.getAttribute('data-rt-id');
			const roomName = element.textContent.trim();
			
			// Sumar precios para este tipo de habitación
			let totalPrice = 0;
			let daysFound = 0;
			
			const currentDate = new Date(checkin);
			while (currentDate < checkout) {
				const dateStr = currentDate.toISOString().split('T')[0];
				
				// Buscar el área de ese tipo de habitación
				const rtArea = document.querySelector(`.c-rt-area[data-rt-id="${rtId}"]`);
				if (rtArea) {
					// Buscar el hermano anterior que es .c-rt-days
					let rtDays = rtArea.previousElementSibling;
					while (rtDays && !rtDays.classList.contains('c-rt-days')) {
						rtDays = rtDays.previousElementSibling;
					}
					
					if (rtDays) {
						const dayCell = rtDays.querySelector(`.c-rt-day[data-date="${dateStr}"]`);
						if (dayCell) {
							const priceElement = dayCell.querySelector('.c-rt-price');
							if (priceElement) {
								let priceText = priceElement.textContent.trim();
								// Eliminar decimales y cambiar formato
								priceText = priceText.replace(/,\d+/, '').replace(/€\s*(\d+)/, '$1');
								const price = parseInt(priceText);
								if (!isNaN(price)) {
									totalPrice += price;
									daysFound++;
								}
							}
						}
					}
				}
				
				currentDate.setDate(currentDate.getDate() + 1);
			}
			
			// Solo agregar si encontramos precios para todas las noches
			if (daysFound === nights) {
				roomTypes.push({
					name: roomName,
					price: `${totalPrice}€`
				});
			} else {
				roomTypes.push({
					name: roomName,
					price: 'N/A'
				});
			}
		});
		
		// Ordenar por precio: menor a mayor (N/A al final)
		roomTypes.sort((a, b) => {
			const priceA = a.price === 'N/A' ? Infinity : parseInt(a.price);
			const priceB = b.price === 'N/A' ? Infinity : parseInt(b.price);
			return priceA - priceB;
		});
		
		// Limitar a las 3 habitaciones más baratas
		const limitedRoomTypes = roomTypes.slice(0, 3);
		
		(`Tipos de habitación extraídos para ${nights} noche(s) (ordenados por precio, máximo 3):`, limitedRoomTypes);
		return limitedRoomTypes;
	}

	async fetchCompetitorPrices(competitor, checkIn, checkOut) {
		// Verificar que el contexto de la extensión sea válido
		if (!chrome.runtime?.id) {
			throw new Error('Extensión recargada. Por favor recarga esta página.');
		}

		// Enviar mensaje al background script para obtener los precios
		return new Promise((resolve, reject) => {
			try {
				chrome.runtime.sendMessage({
					action: 'fetchBookingPrices',
					data: {
						url: competitor.url,
						checkIn: this.formatDate(checkIn),
						checkOut: this.formatDate(checkOut)
					}
				}, (response) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
					} else if (response?.error) {
						reject(new Error(response.error));
					} else {
						resolve(response.prices);
					}
				});
			} catch (error) {
				reject(new Error('Extensión recargada. Por favor recarga esta página.'));
			}
		});
	}

	formatDate(date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	showLoading(message = null, current = 0, total = 0) {
		const resultsDiv = document.getElementById('price-results');
		let displayMessage = message || 'Obteniendo precios de competidores...';
		
		if (total > 0) {
			const percentage = Math.round((current / total) * 100);
			const progressBar = `
				<div class="progress-bar-container">
					<div class="progress-bar" style="width: ${percentage}%"></div>
				</div>
			`;
			
			resultsDiv.innerHTML = `
				<div class="loading-spinner">
					<div class="spinner"></div>
					<p>${displayMessage}</p>
					${progressBar}
				</div>
			`;
		} else {
			resultsDiv.innerHTML = `
				<div class="loading-spinner">
					<div class="spinner"></div>
					<p>${displayMessage}</p>
				</div>
			`;
		}
	}

	showError(message) {
		const resultsDiv = document.getElementById('price-results');
		resultsDiv.innerHTML = `
			<div class="error-message">
				<p>⚠️ ${message}</p>
			</div>
		`;
	}

	displayResults(results, checkinDate, checkoutDate) {
		const resultsDiv = document.getElementById('price-results');
		
		// Guardar las fechas para construir enlaces
		this.currentCheckinDate = checkinDate;
		this.currentCheckoutDate = checkoutDate;
		
		// Calcular número de noches
		const checkin = new Date(checkinDate);
		const checkout = new Date(checkoutDate);
		const nights = Math.ceil((checkout - checkin) / (1000 * 60 * 60 * 24));
		const nightsText = nights === 1 ? '1 noche' : `${nights} noches`;
		
		// Separar mi hotel de la competencia
		const myHotelResult = results.find(r => r.isMyHotel);
		const competitorResults = results.filter(r => !r.isMyHotel);
		
		let html = `
			<div class="results-header">
				<h4>Comparación de precios - ${nightsText}</h4>
				<p class="date-range">${this.formatDateDisplay(checkinDate)} - ${this.formatDateDisplay(checkoutDate)}</p>
			</div>
		`;
		
		// Tabla 1: Mi Hotel con nombres reales de habitaciones (formato horizontal)
		if (myHotelResult && Array.isArray(myHotelResult.roomTypes) && myHotelResult.roomTypes.length > 0) {
			html += `
				<div class="my-hotel-section">
					<h5>Mi Hotel</h5>
					<table class="price-comparison-table my-hotel-table">
						<thead>
							<tr>
								<th>Hotel</th>
			`;
			
			// Generar headers dinámicos basados en los tipos de habitación
			myHotelResult.roomTypes.forEach(room => {
				html += `<th title="${room.name}">${room.name}</th>`;
			});
			
			html += `
							</tr>
						</thead>
						<tbody>
							<tr class="my-hotel-row">
								<td class="hotel-name">Mi Hotel</td>
			`;
			
			// Generar celdas de precio
			const formatPrice = (price) => price === 'N/A' ? `<span class="na-price">${price}</span>` : price;
			myHotelResult.roomTypes.forEach(room => {
				html += `<td class="price-cell">${formatPrice(room.price)}</td>`;
			});
			
			html += `
							</tr>
						</tbody>
					</table>
				</div>
			`;
		}
		
		// Tabla 2: Competencia con columnas fijas Individual/Doble/Triple
		if (competitorResults.length > 0) {
			html += `
				<div class="competitors-section">
					<h5>Competencia</h5>
					<table class="price-comparison-table competitors-table">
						<thead>
							<tr>
								<th>Hotel</th>
								<th>Individual</th>
								<th>Doble</th>
								<th>Triple</th>
							</tr>
						</thead>
						<tbody>
			`;
			
			competitorResults.forEach(result => {
				html += `<tr>`;
				html += `<td class="hotel-name">${result.name}</td>`;
				
				if (result.error) {
					html += `<td colspan="3" class="error-cell">${result.error}</td>`;
				} else if (result.prices) {
					const onePax = result.prices.onePax || 'N/A';
					const twoPax = result.prices.twoPax || 'N/A';
					const threePax = result.prices.threePax || 'N/A';
					
					if (onePax === 'N/A' && twoPax === 'N/A' && threePax === 'N/A') {
						html += `<td colspan="3" class="no-availability-cell">Sin disponibilidad</td>`;
					} else {
						// Construir URL de Booking.com con las fechas actuales
						const bookingUrl = this.buildBookingUrl(result.url, this.currentCheckinDate, this.currentCheckoutDate);
						
						const formatPrice = (price) => {
							if (price === 'N/A') {
								return `<span class="na-price">${price}</span>`;
							}
							return `<a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" class="price-link" title="Ver en Booking.com">${price}</a>`;
						};
						
						html += `
							<td class="price-cell">${formatPrice(onePax)}</td>
							<td class="price-cell">${formatPrice(twoPax)}</td>
							<td class="price-cell">${formatPrice(threePax)}</td>
						`;
					}
				} else {
					html += `<td colspan="3" class="no-availability-cell">Sin disponibilidad</td>`;
				}
				
				html += `</tr>`;
			});
			
			html += `
						</tbody>
					</table>
				</div>
			`;
		}

		resultsDiv.innerHTML = html;
	}

	formatDateDisplay(dateStr) {
		const date = new Date(dateStr);
		const options = { year: 'numeric', month: 'long', day: 'numeric' };
		return date.toLocaleDateString('es-ES', options);
	}

	buildBookingUrl(baseUrl, checkinDate, checkoutDate) {
		const checkin = new Date(checkinDate);
		const checkout = new Date(checkoutDate);
		
		const params = new URLSearchParams({
			checkin_year: checkin.getFullYear(),
			checkin_month: checkin.getMonth() + 1,
			checkin_monthday: checkin.getDate(),
			checkout_year: checkout.getFullYear(),
			checkout_month: checkout.getMonth() + 1,
			checkout_monthday: checkout.getDate(),
			group_adults: 2,
			group_children: 0,
			no_rooms: 1
		});
		
		const separator = baseUrl.includes('?') ? '&' : '?';
		return `${baseUrl}${separator}${params.toString()}`;
	}
}

// Inicializar el comparador cuando el DOM esté listo
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		new PriceComparator();
	});
} else {
	new PriceComparator();
}
