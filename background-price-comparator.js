// Background service worker para obtener precios de Booking.com
// Este script se ejecuta en segundo plano y maneja las peticiones de scraping

('Price Comparator Background Worker iniciado');

// Escuchar mensajes desde el content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'fetchBookingPrices') {
		handleFetchBookingPrices(request.data)
			.then(prices => sendResponse({ prices }))
			.catch(error => sendResponse({ error: error.message }));
		
		// Mantener el canal abierto para respuesta asíncrona
		return true;
	}
});

async function handleFetchBookingPrices(data) {
	const { url, checkIn, checkOut } = data;
	
	try {
		// Construir la URL con los parámetros de búsqueda
		const bookingUrl = buildBookingUrl(url, checkIn, checkOut);
		
		// Usar el método de pestaña oculta para evitar problemas con DOMParser y CORS
		const prices = await fetchPricesViaTab(bookingUrl);
		
		return prices;
	} catch (error) {
		console.error('Error en handleFetchBookingPrices:', error);
		throw error;
	}
}

function buildBookingUrl(baseUrl, checkIn, checkOut) {
	// Convertir las fechas al formato de Booking.com
	const checkInDate = new Date(checkIn);
	const checkOutDate = new Date(checkOut);
	
	const year = checkInDate.getFullYear();
	const month = checkInDate.getMonth(); // 0-indexed
	const day = checkInDate.getDate();
	
	const checkoutYear = checkOutDate.getFullYear();
	const checkoutMonth = checkOutDate.getMonth();
	const checkoutDay = checkOutDate.getDate();
	
	// Construir URL con parámetros
	const params = new URLSearchParams({
		checkin_year: year,
		checkin_month: month + 1,
		checkin_monthday: day,
		checkout_year: checkoutYear,
		checkout_month: checkoutMonth + 1,
		checkout_monthday: checkoutDay,
		group_adults: 2,
		group_children: 0,
		no_rooms: 1
	});
	
	// Si la URL base ya tiene parámetros, añadirlos
	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}${params.toString()}`;
}

async function fetchBookingPage(url) {
	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'es-ES,es;q=0.9',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			}
		});
		
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		
		const text = await response.text();
		return text;
	} catch (error) {
		console.error('Error fetching Booking page:', error);
		throw new Error('No se pudo obtener la página de Booking.com');
	}
}

function parseBookingPrices(html) {
	// Crear un parser DOM
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	
	const prices = {
		onePax: null,
		twoPax: null,
		threePax: null
	};
	
	try {
		// Buscar la tabla de habitaciones
		const roomTable = doc.querySelector('#hprt-table, table[data-et-view]');
		
		if (!roomTable) {
			console.warn('No se encontró la tabla de habitaciones');
			return prices;
		}
		
		// Obtener todas las filas de habitaciones
		const roomRows = roomTable.querySelectorAll('tr[data-block-id]');
		
		// Agrupar habitaciones por ocupación
		const pricesByOccupancy = {
			1: [],
			2: [],
			3: []
		};
		
		roomRows.forEach(row => {
			try {
				// Obtener información de ocupación
				const occupancyCell = row.querySelector('.hprt-table-cell-occupancy');
				if (!occupancyCell) return;
				
				const occupancyIcons = occupancyCell.querySelectorAll('.bicon-occupancy');
				const occupancy = occupancyIcons.length;
				
				if (occupancy < 1 || occupancy > 3) return;
				
				// Obtener precio
				const priceCell = row.querySelector('.hprt-table-cell-price');
				if (!priceCell) return;
				
				const priceElement = priceCell.querySelector('.bui-price-display__value, .prco-valign-middle-helper');
				if (!priceElement) return;
				
				const priceText = priceElement.textContent.trim();
				const priceMatch = priceText.match(/€\s*(\d+)/);
				
				if (priceMatch) {
					const price = parseInt(priceMatch[1]);
					pricesByOccupancy[occupancy].push(price);
				}
			} catch (error) {
				console.error('Error parseando fila de habitación:', error);
			}
		});
		
		// Obtener el precio más barato para cada ocupación
		if (pricesByOccupancy[1].length > 0) {
			prices.onePax = `€${Math.min(...pricesByOccupancy[1])}`;
		}
		
		if (pricesByOccupancy[2].length > 0) {
			prices.twoPax = `€${Math.min(...pricesByOccupancy[2])}`;
		}
		
		if (pricesByOccupancy[3].length > 0) {
			prices.threePax = `€${Math.min(...pricesByOccupancy[3])}`;
		}
		
		('Precios parseados:', prices);
		
	} catch (error) {
		console.error('Error parseando precios:', error);
	}
	
	return prices;
}

// Función alternativa para obtener precios cuando CORS bloquea fetch
// Se abre una pestaña oculta y se inyecta un script para extraer los datos
async function fetchPricesViaTab(url) {
	return new Promise((resolve, reject) => {
		chrome.tabs.create({ url, active: false }, (tab) => {
			const targetTabId = tab.id;
			
			// Esperar a que la página cargue
			const listener = (tabId, changeInfo) => {
				if (tabId === targetTabId && changeInfo.status === 'complete') {
					chrome.tabs.onUpdated.removeListener(listener);
					
					// Inyectar script para extraer precios
					chrome.scripting.executeScript({
						target: { tabId: targetTabId },
						func: extractPricesFromPage
					}, (results) => {
						// Cerrar la pestaña
						chrome.tabs.remove(targetTabId);
						
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}
						
						if (results && results[0]) {
							resolve(results[0].result);
						} else {
							reject(new Error('No se pudieron extraer los precios'));
						}
					});
				}
			};
			
			chrome.tabs.onUpdated.addListener(listener);
			
			// Timeout de 30 segundos
			setTimeout(() => {
				chrome.tabs.onUpdated.removeListener(listener);
				chrome.tabs.remove(targetTabId).catch(() => {});
				reject(new Error('Timeout al cargar la página'));
			}, 30000);
		});
	});
}

// Esta función se ejecutará en el contexto de la página de Booking.com
function extractPricesFromPage() {
	const prices = {
		onePax: null,
		twoPax: null,
		threePax: null
	};
	
	try {
		const roomTable = document.querySelector('#hprt-table, table[data-et-view]');
		if (!roomTable) return prices;
		
		const roomRows = roomTable.querySelectorAll('tr[data-block-id]');
		const pricesByOccupancy = { 1: [], 2: [], 3: [] };
		
		roomRows.forEach(row => {
			const occupancyCell = row.querySelector('.hprt-table-cell-occupancy');
			if (!occupancyCell) return;
			
			const occupancyIcons = occupancyCell.querySelectorAll('.bicon-occupancy');
			const occupancy = occupancyIcons.length;
			
			if (occupancy < 1 || occupancy > 3) return;
			
			const priceCell = row.querySelector('.hprt-table-cell-price');
			if (!priceCell) return;
			
			const priceElement = priceCell.querySelector('.bui-price-display__value, .prco-valign-middle-helper');
			if (!priceElement) return;
			
			const priceText = priceElement.textContent.trim();
			const priceMatch = priceText.match(/€\s*(\d+)/);
			
			if (priceMatch) {
				const price = parseInt(priceMatch[1]);
				pricesByOccupancy[occupancy].push(price);
			}
		});
		
		if (pricesByOccupancy[1].length > 0) {
			prices.onePax = `${Math.min(...pricesByOccupancy[1])}€`;
		}
		
		if (pricesByOccupancy[2].length > 0) {
			prices.twoPax = `${Math.min(...pricesByOccupancy[2])}€`;
		}
		
		if (pricesByOccupancy[3].length > 0) {
			prices.threePax = `${Math.min(...pricesByOccupancy[3])}€`;
		}
	} catch (error) {
		console.error('Error extrayendo precios:', error);
	}
	
	return prices;
}
