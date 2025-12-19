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
   * @returns {Promise<string>} - Imagen recortada en base64
   */
  async extractFaceFromDocument(imageSource, options = {}) {
    const {
      padding = 0.3,        // Margen adicional alrededor de la cara (30% por defecto)
      minConfidence = 0.5,  // Confianza mínima para considerar una detección válida
      targetSize = 400      // Tamaño objetivo del lado más largo (mantiene proporción)
    } = options;

    // Asegurar que los modelos estén cargados
    await this.loadModels();

    // Crear elemento de imagen para procesar
    const img = await this._loadImage(imageSource);

    // Detectar caras en la imagen
    const detections = await faceapi.detectAllFaces(
      img,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: minConfidence
      })
    );

    if (!detections || detections.length === 0) {
      throw new Error('No se detectó ninguna cara en el documento');
    }

    // Si hay múltiples caras, tomar la más grande (probablemente la foto del documento)
    const face = this._selectBestFace(detections);
    
    console.log(`✓ Cara detectada con confianza: ${(face.score * 100).toFixed(1)}%`);

    // Recortar la cara con el padding especificado
    const croppedCanvas = this._cropFaceWithPadding(img, face.box, padding);

    // Redimensionar si es necesario
    const resizedCanvas = this._resizeCanvas(croppedCanvas, targetSize);

    // Convertir a base64
    return resizedCanvas.toDataURL('image/jpeg', 0.92);
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
