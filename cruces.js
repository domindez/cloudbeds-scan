/**
 * cruces.js - Lógica para generar el "Papel de las Cruces"
 * 
 * Este archivo maneja la extracción de datos del calendario de Cloudbeds
 * y la generación de un Excel con las habitaciones organizadas por plantas.
 */

// Extraer datos del calendario de Cloudbeds
async function extractCalendarData(selectedDate) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url?.includes('cloudbeds.com')) {
      throw new Error('Debes estar en la página de Cloudbeds');
    }

    // Inyectar script en la página para extraer datos
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDataFromPage,
      args: [selectedDate]
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('No se pudieron extraer los datos del calendario');
    }

    const result = results[0].result;
    if (result.error === 'calendar_not_found') {
      throw new Error('Por favor, abre el calendario de Cloudbeds antes de generar el Excel');
    }

    return result;
  } catch (error) {
    console.error('Error al extraer datos:', error);
    throw error;
  }
}

// Función que se ejecuta en el contexto de la página de Cloudbeds
function extractDataFromPage(selectedDate) {
  try {
    // Verificar que estamos en la página del calendario
    const calendarElement = document.querySelector('.c-rt-and-rooms');
    if (!calendarElement) {
      return { error: 'calendar_not_found' };
    }

    const data = {
      roomTypes: [],
      date: selectedDate
    };

    // Extraer tipos de habitación y habitaciones
    const roomTypeContainers = document.querySelectorAll('.c-rt-and-rooms');
    
    roomTypeContainers.forEach(container => {
      const typeHeader = container.querySelector('.c-collaps');
      if (!typeHeader) return;

      const roomTypeName = typeHeader.textContent.trim();
      const roomTypeId = typeHeader.getAttribute('data-rt-id');
      
      const rooms = [];
      const roomElements = container.querySelectorAll('.c-room');
      
      roomElements.forEach(roomEl => {
        const roomNumber = roomEl.textContent.trim();
        const roomId = roomEl.getAttribute('data-room-id');
        
        rooms.push({
          number: roomNumber,
          id: roomId,
          floor: roomNumber.charAt(0) // Primera cifra es la planta
        });
      });

      data.roomTypes.push({
        name: roomTypeName,
        id: roomTypeId,
        rooms: rooms
      });
    });

    // Extraer reservas para cada habitación
    const roomLines = document.querySelectorAll('.c-room-line');
    
    roomLines.forEach(roomLine => {
      const roomId = roomLine.getAttribute('data-room-id');
      
      // Buscar la habitación correspondiente
      let targetRoom = null;
      for (const roomType of data.roomTypes) {
        targetRoom = roomType.rooms.find(r => r.id === roomId);
        if (targetRoom) break;
      }

      if (!targetRoom) return;

      // Inicializar reservas
      targetRoom.reservations = [];

      // Extraer todos los slots de reserva
      const slots = roomLine.querySelectorAll('.calendar-slot');
      
      slots.forEach(slot => {
        const startDate = slot.getAttribute('data-start-date');
        const endDate = slot.getAttribute('data-end-date');
        const guestName = slot.querySelector('.calendar-slot-text')?.textContent.trim();
        const slotType = slot.className.split(' ').find(c => c.startsWith('calendar-slot-'));
        
        if (startDate && endDate) {
          targetRoom.reservations.push({
            startDate: startDate,
            endDate: endDate,
            guestName: guestName || 'Sin nombre',
            type: slotType ? slotType.replace('calendar-slot-', '') : 'unknown'
          });
        }
      });
    });

    return data;
  } catch (error) {
    console.error('Error en extractDataFromPage:', error);
    return { error: error.message };
  }
}

// Procesar datos para determinar estado de cada habitación en la fecha seleccionada
function processRoomStatus(calendarData, selectedDate) {
  const selectedDateObj = new Date(selectedDate);
  const previousDate = new Date(selectedDate);
  previousDate.setDate(previousDate.getDate() - 1);
  
  const roomsByFloor = {};

  calendarData.roomTypes.forEach(roomType => {
    roomType.rooms.forEach(room => {
      const floor = room.floor;
      
      if (!roomsByFloor[floor]) {
        roomsByFloor[floor] = [];
      }

      const roomStatus = {
        number: room.number,
        roomType: roomType.name,
        entrada: false,
        ocupada: false,
        salida: false,
        guestName: ''
      };

      // Analizar reservas
      if (room.reservations && room.reservations.length > 0) {
        room.reservations.forEach(reservation => {
          const resStartDate = new Date(reservation.startDate);
          const resEndDate = new Date(reservation.endDate);
          
          // Normalizar fechas para comparación (solo fecha, sin hora)
          const selectedDateStr = selectedDate;
          const resStartStr = reservation.startDate;
          const resEndStr = reservation.endDate;
          
          // Entrada: La reserva empieza hoy
          if (resStartStr === selectedDateStr) {
            roomStatus.entrada = true;
            roomStatus.guestName = reservation.guestName;
          }
          
          // Salida: La reserva termina hoy
          if (resEndStr === selectedDateStr) {
            roomStatus.salida = true;
            roomStatus.guestName = reservation.guestName;
          }
          
          // Ocupada: La reserva empezó antes de hoy y termina después de hoy
          if (resStartDate < selectedDateObj && resEndDate > selectedDateObj) {
            roomStatus.ocupada = true;
            roomStatus.guestName = reservation.guestName;
          }
        });
      }

      roomsByFloor[floor].push(roomStatus);
    });
  });

  // Ordenar habitaciones dentro de cada planta
  Object.keys(roomsByFloor).forEach(floor => {
    roomsByFloor[floor].sort((a, b) => {
      return parseInt(a.number) - parseInt(b.number);
    });
  });

  return roomsByFloor;
}

// Generar Excel con la librería ExcelJS
async function generateExcel(roomsByFloor, selectedDate) {
  // Crear un nuevo libro de Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(selectedDate);

  // Obtener plantas ordenadas
  const floors = Object.keys(roomsByFloor).sort();

  // Determinar el número máximo de habitaciones en cualquier planta
  let maxRooms = 0;
  floors.forEach(floor => {
    if (roomsByFloor[floor].length > maxRooms) {
      maxRooms = roomsByFloor[floor].length;
    }
  });

  // Estilo de borde para todas las celdas
  const borderStyle = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // Convertir fecha a formato dd/mm/yyyy
  const dateParts = selectedDate.split('-');
  const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

  // Fila de título con la fecha
  const titleRow = [formattedDate];
  worksheet.addRow(titleRow);

  // Aplicar estilos al título
  const titleRowObj = worksheet.getRow(1);
  titleRowObj.getCell(1).font = { size: 12 };
  titleRowObj.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

  // Combinar celdas para el título (ocupar todo el ancho)
  const totalColumns = floors.length * 4 + (floors.length - 1); // 4 columnas por planta + separadores
  worksheet.mergeCells(1, 1, 1, totalColumns);

  // Fila vacía para separación
  worksheet.addRow([]);

  // Fila de encabezado
  const headerRow = [];
  floors.forEach((floor, index) => {
    headerRow.push(''); // Columna para número de habitación
    headerRow.push('SAL');
    headerRow.push('CONT');
    headerRow.push('ENT');
    
    // Añadir columna de separación entre plantas (excepto después de la última)
    if (index < floors.length - 1) {
      headerRow.push('');
    }
  });
  worksheet.addRow(headerRow);

  // Aplicar estilos a la fila de encabezado
  const headerRowObj = worksheet.getRow(3);
  let headerCellIndex = 1;
  floors.forEach((floor, floorIndex) => {
    // Celdas normales de encabezado (habitación y SAL, CONT, ENT)
    for (let j = 0; j < 4; j++) {
      const cell = headerRowObj.getCell(headerCellIndex++);
      cell.border = borderStyle;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { bold: true };
    }
    
    // Columna de separación (solo bordes laterales, no horizontales)
    if (floorIndex < floors.length - 1) {
      const separatorCell = headerRowObj.getCell(headerCellIndex++);
      separatorCell.border = {
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  });

  // Filas de datos
  for (let i = 0; i < maxRooms; i++) {
    const dataRow = [];
    
    floors.forEach((floor, index) => {
      const rooms = roomsByFloor[floor];
      const room = rooms[i];
      
      if (room) {
        dataRow.push(room.number);
        dataRow.push(room.salida ? 'X' : '');
        dataRow.push(room.ocupada ? 'X' : '');
        dataRow.push(room.entrada ? 'X' : '');
      } else {
        // Celda vacía si esta planta no tiene más habitaciones
        dataRow.push('');
        dataRow.push('');
        dataRow.push('');
        dataRow.push('');
      }
      
      // Añadir columna de separación entre plantas (excepto después de la última)
      if (index < floors.length - 1) {
        dataRow.push('');
      }
    });
    
    const row = worksheet.addRow(dataRow);
    
    // Aplicar bordes y centrado a cada celda
    let cellIndex = 1;
    floors.forEach((floor, floorIndex) => {
      // Celdas normales (habitación y estados)
      for (let j = 0; j < 4; j++) {
        const cell = row.getCell(cellIndex++);
        cell.border = borderStyle;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      
      // Columna de separación (solo bordes laterales, no horizontales)
      if (floorIndex < floors.length - 1) {
        const separatorCell = row.getCell(cellIndex++);
        separatorCell.border = {
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    });
  }

  // Ajustar anchos de columna
  let colIndex = 1;
  floors.forEach((floor, index) => {
    worksheet.getColumn(colIndex++).width = 5;   // Número de habitación
    worksheet.getColumn(colIndex++).width = 5;   // SAL
    worksheet.getColumn(colIndex++).width = 5;   // CONT
    worksheet.getColumn(colIndex++).width = 5;   // ENT
    
    // Columna de separación (estrecha) excepto después de la última planta
    if (index < floors.length - 1) {
      worksheet.getColumn(colIndex++).width = 3;  // Columna separadora
    }
  });
  // Generar y descargar el archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `papel_cruces_${selectedDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Función principal para generar el papel de cruces
async function generatePapelCruces(selectedDate) {
  try {
    // Validar fecha
    if (!selectedDate) {
      throw new Error('Debes seleccionar una fecha');
    }

    // Extraer datos del calendario
    const calendarData = await extractCalendarData(selectedDate);
    
    if (calendarData.error) {
      throw new Error(calendarData.error);
    }

    // Procesar datos
    const roomsByFloor = processRoomStatus(calendarData, selectedDate);

    // Generar Excel
    generateExcel(roomsByFloor, selectedDate);

    return { success: true };
  } catch (error) {
    console.error('Error al generar papel de cruces:', error);
    throw error;
  }
}

// Exportar para uso en popup.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generatePapelCruces };
}
