// face-detector.js
// Detecta y recorta la foto de una persona desde un documento de identidad

class FaceDetector {
  constructor() {
    this.modelsLoaded = false;
    // Detectar si estamos en contexto de extensión o página standalone
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      // Para extensiones de Chrome, usar la ruta relativa directamente
      // chrome.runtime.getURL() se encargará de convertirla a la URL absoluta
      this.modelsPath = './lib/models';
    } else {
      // Para página standalone, usar ruta relativa
      this.modelsPath = 'lib/models';
    }
  }

  /**
   * Carga los modelos de face-api.js necesarios para la detección
   */
  async loadModels() {
    if (this.modelsLoaded) return;

    try {
      // Cargar solo el modelo TinyFaceDetector (es más rápido y suficiente para documentos)
      await faceapi.nets.tinyFaceDetector.loadFromUri(this.modelsPath);
      this.modelsLoaded = true;
      console.log('✓ Modelos de detección facial cargados');
    } catch (error) {
      console.error('Error cargando modelos:', error);
      throw new Error('No se pudieron cargar los modelos de detección facial');
    }
  }

  /**
   * Detecta y extrae la cara desde una imagen (base64 o URL)
   * @param {string} imageSource - Imagen en base64 o URL
   * @param {object} options - Opciones de configuración
   * @returns {Promise<object>} - Objeto con imagen recortada y metadatos
   */
  async extractFaceFromDocument(imageSource, options = {}) {
    const {
      padding = 0.3,        // Margen adicional alrededor de la cara (30% por defecto)
      minConfidence = 0.6,  // Confianza mínima aumentada a 60%
      targetSize = 400,     // Tamaño objetivo del lado más largo (mantiene proporción)
      returnAllFaces = false // Si es true, retorna todas las caras detectadas
    } = options;

    console.log('[FACE-DETECTOR] extractFaceFromDocument - Iniciando');
    console.log('[FACE-DETECTOR] Opciones:', { padding, minConfidence, targetSize, returnAllFaces });

    // Asegurar que los modelos estén cargados
    await this.loadModels();

    // Crear elemento de imagen para procesar
    const img = await this._loadImage(imageSource);
    console.log('[FACE-DETECTOR] Imagen cargada:', img.width, 'x', img.height);

    // Detectar caras en la imagen con configuración mejorada
    const detections = await faceapi.detectAllFaces(
      img,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.3  // Umbral bajo para detectar todas las posibles caras
      })
    );

    console.log('[FACE-DETECTOR] Detecciones brutas:', detections?.length || 0);

    if (!detections || detections.length === 0) {
      console.error('[FACE-DETECTOR] No se detectó ninguna cara');
      throw new Error('No se detectó ninguna cara en el documento');
    }

    // Filtrar caras por tamaño mínimo (evitar detecciones muy pequeñas)
    const validDetections = detections.filter(d => {
      const area = d.box.width * d.box.height;
      const imageArea = img.width * img.height;
      const relativeArea = area / imageArea;
      // La cara debe ocupar al menos 2% de la imagen (ajustable)
      return relativeArea > 0.02 && d.score >= 0.3;
    });

    console.log('[FACE-DETECTOR] Detecciones válidas (>2% área):', validDetections.length);
    validDetections.forEach((d, i) => {
      const area = d.box.width * d.box.height;
      const imageArea = img.width * img.height;
      const relativeArea = (area / imageArea * 100).toFixed(2);
      console.log(`[FACE-DETECTOR]   Cara ${i + 1}: ${(d.score * 100).toFixed(1)}% confianza, ${relativeArea}% del área`);
    });

    // Flag para indicar si usamos umbral relajado
    let usedRelaxedThreshold = false;

    // Si no hay caras con el filtro estricto, intentar con umbral más bajo
    if (validDetections.length === 0) {
      console.warn('[FACE-DETECTOR] No hay caras con tamaño >2%, intentando con umbral más bajo...');
      
      // Usar umbral más permisivo: 0.5% del área (para DNIs de alta resolución)
      const relaxedDetections = detections.filter(d => {
        const area = d.box.width * d.box.height;
        const imageArea = img.width * img.height;
        const relativeArea = area / imageArea;
        return relativeArea > 0.005 && d.score >= 0.2; // 0.5% área, 20% confianza mínima
      });
      
      console.log('[FACE-DETECTOR] Detecciones con umbral relajado (>0.5% área):', relaxedDetections.length);
      relaxedDetections.forEach((d, i) => {
        const area = d.box.width * d.box.height;
        const imageArea = img.width * img.height;
        const relativeArea = (area / imageArea * 100).toFixed(2);
        console.log(`[FACE-DETECTOR]   Cara ${i + 1}: ${(d.score * 100).toFixed(1)}% confianza, ${relativeArea}% del área`);
      });
      
      if (relaxedDetections.length === 0) {
        console.error('[FACE-DETECTOR] No hay caras incluso con umbral relajado');
        throw new Error('No se detectaron caras con tamaño suficiente');
      }
      
      // Usar las detecciones relajadas
      validDetections.length = 0;
      validDetections.push(...relaxedDetections);
      usedRelaxedThreshold = true;
      console.log('[FACE-DETECTOR] ✓ Usando detecciones con umbral relajado - FORZANDO selección manual');
    }

    // Si se solicitan todas las caras, retornar array completo
    if (returnAllFaces) {
      console.log('[FACE-DETECTOR] Modo returnAllFaces activado');
      
      // Ordenar por confianza (más alta primero) para mejor selección por defecto
      const sortedDetections = [...validDetections].sort((a, b) => {
        return b.score - a.score;
      });
      
      const allFaces = sortedDetections.map((face, index) => {
        const croppedCanvas = this._cropFaceWithPadding(img, face.box, padding);
        const resizedCanvas = this._resizeCanvas(croppedCanvas, targetSize);
        return {
          index,
          confidence: face.score,
          box: face.box,
          imageBase64: resizedCanvas.toDataURL('image/jpeg', 0.92)
        };
      });
      
      // Solo necesita selección manual si NO hay ninguna cara con >60% de confianza
      const hasHighConfidenceFace = sortedDetections.some(d => d.score >= minConfidence);
      const needsManualSelection = !hasHighConfidenceFace;
      
      console.log('[FACE-DETECTOR] needsManualSelection:', needsManualSelection);
      console.log('[FACE-DETECTOR] Razón:', {
        hasHighConfidenceFace: hasHighConfidenceFace,
        highestScore: sortedDetections[0].score,
        minRequired: minConfidence,
        totalFaces: sortedDetections.length
      });
      
      return {
        needsManualSelection,
        faces: allFaces,
        bestFaceIndex: 0, // Por defecto la más grande
        highestConfidence: sortedDetections[0].score
      };
    }

    // Comportamiento original: seleccionar la mejor cara automáticamente
    // Ordenar por confianza (más alta primero)
    const sortedDetections = [...validDetections].sort((a, b) => {
      return b.score - a.score;
    });
    
    const face = sortedDetections[0];
    
    console.log('[FACE-DETECTOR] Mejor cara seleccionada:');
    console.log('[FACE-DETECTOR]   Confianza:', (face.score * 100).toFixed(1) + '%');
    console.log('[FACE-DETECTOR]   Posición:', face.box);

    // Recortar la cara con el padding especificado
    const croppedCanvas = this._cropFaceWithPadding(img, face.box, padding);

    // Redimensionar si es necesario
    const resizedCanvas = this._resizeCanvas(croppedCanvas, targetSize);

    // Convertir a base64
    const imageBase64 = resizedCanvas.toDataURL('image/jpeg', 0.92);
    
    // Solo necesita selección manual si NO hay ninguna cara con >60% de confianza
    const hasHighConfidenceFace = sortedDetections.some(d => d.score >= minConfidence);
    const needsManualSelection = !hasHighConfidenceFace;
    
    console.log('[FACE-DETECTOR] Resultado final:');
    console.log('[FACE-DETECTOR]   needsManualSelection:', needsManualSelection);
    console.log('[FACE-DETECTOR]   hasHighConfidenceFace:', hasHighConfidenceFace);
    console.log('[FACE-DETECTOR]   totalFaces:', sortedDetections.length);
    console.log('[FACE-DETECTOR]   confidence:', face.score);
    
    return {
      needsManualSelection,
      imageBase64,
      confidence: face.score,
      totalFaces: sortedDetections.length
    };
  }

  /**
   * Detecta todas las caras en una imagen y retorna información detallada
   * @param {string} imageSource - Imagen en base64 o URL
   * @param {object} options - Opciones de configuración
   * @returns {Promise<object>} - Objeto con todas las caras detectadas
   */
  async getAllFacesFromDocument(imageSource, options = {}) {
    const result = await this.extractFaceFromDocument(imageSource, {
      ...options,
      returnAllFaces: true
    });
    return result;
  }

  /**
   * Extrae una cara específica por índice
   * @param {string} imageSource - Imagen en base64 o URL
   * @param {number} faceIndex - Índice de la cara a extraer
   * @param {object} options - Opciones de configuración
   * @returns {Promise<string>} - Imagen recortada en base64
   */
  async extractSpecificFace(imageSource, faceIndex, options = {}) {
    const allFaces = await this.getAllFacesFromDocument(imageSource, options);
    
    if (!allFaces.faces || faceIndex >= allFaces.faces.length) {
      throw new Error('Índice de cara inválido');
    }
    
    return allFaces.faces[faceIndex].imageBase64;
  }

  /**
   * Carga una imagen desde base64 o URL
   * @private
   */
  _loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Error cargando la imagen'));
      
      img.src = source;
    });
  }

  /**
   * Selecciona la mejor cara de las detectadas
   * (la más grande, que suele ser la foto del documento)
   * @private
   */
  _selectBestFace(detections) {
    if (detections.length === 1) {
      return detections[0];
    }

    // Ordenar por área (ancho * alto) de mayor a menor
    return detections.sort((a, b) => {
      const areaA = a.box.width * a.box.height;
      const areaB = b.box.width * b.box.height;
      return areaB - areaA;
    })[0];
  }

  /**
   * Recorta la cara con padding adicional
   * @private
   */
  _cropFaceWithPadding(img, box, paddingPercent) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calcular dimensiones con padding
    const paddingX = box.width * paddingPercent;
    const paddingY = box.height * paddingPercent;

    let x = Math.max(0, box.x - paddingX);
    let y = Math.max(0, box.y - paddingY);
    let width = Math.min(img.width - x, box.width + 2 * paddingX);
    let height = Math.min(img.height - y, box.height + 2 * paddingY);

    // Asegurar que el recorte no exceda los límites de la imagen
    if (x + width > img.width) width = img.width - x;
    if (y + height > img.height) height = img.height - y;

    canvas.width = width;
    canvas.height = height;

    // Dibujar la región recortada
    ctx.drawImage(
      img,
      x, y, width, height,  // Región de origen
      0, 0, width, height   // Destino en canvas
    );

    return canvas;
  }

  /**
   * Redimensiona un canvas manteniendo la proporción
   * @private
   */
  _resizeCanvas(sourceCanvas, targetSize) {
    const { width, height } = sourceCanvas;
    
    // Si ya es más pequeño, no redimensionar
    if (width <= targetSize && height <= targetSize) {
      return sourceCanvas;
    }

    // Calcular nuevas dimensiones manteniendo proporción
    let newWidth, newHeight;
    if (width > height) {
      newWidth = targetSize;
      newHeight = Math.round((height / width) * targetSize);
    } else {
      newHeight = targetSize;
      newWidth = Math.round((width / height) * targetSize);
    }

    // Crear nuevo canvas redimensionado
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);

    return canvas;
  }
}

// Exportar instancia global
window.faceDetector = new FaceDetector();
