/**
 * Signature Pad Module
 * Handles drawing and text-based signature creation
 */

export class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.penColor = '#000000';
    this.penSize = 2;
    this.paths = [];
    this.currentPath = [];

    this._setupCanvas();
    this._bindEvents();
  }

  /**
   * Setup canvas dimensions
   */
  _setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /**
   * Bind touch and mouse events
   */
  _bindEvents() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this._startDraw(e));
    this.canvas.addEventListener('mousemove', (e) => this._draw(e));
    this.canvas.addEventListener('mouseup', () => this._endDraw());
    this.canvas.addEventListener('mouseleave', () => this._endDraw());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._startDraw(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this._draw(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._endDraw();
    });

    // Resize handler
    this._resizeObserver = new ResizeObserver(() => {
      this._redraw();
    });
    this._resizeObserver.observe(this.canvas);
  }

  /**
   * Get coordinates relative to canvas
   */
  _getCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * Start drawing
   */
  _startDraw(e) {
    this.isDrawing = true;
    const coords = this._getCoords(e);
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.currentPath = [{ x: coords.x, y: coords.y, color: this.penColor, size: this.penSize }];
  }

  /**
   * Draw stroke
   */
  _draw(e) {
    if (!this.isDrawing) return;

    const coords = this._getCoords(e);

    this.ctx.beginPath();
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.penSize;
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();

    this.currentPath.push({ x: coords.x, y: coords.y, color: this.penColor, size: this.penSize });
    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  /**
   * End drawing
   */
  _endDraw() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.currentPath.length > 1) {
      this.paths.push([...this.currentPath]);
    }
    this.currentPath = [];
  }

  /**
   * Redraw all paths (after resize)
   */
  _redraw() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (const path of this.paths) {
      for (let i = 1; i < path.length; i++) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = path[i].color;
        this.ctx.lineWidth = path[i].size;
        this.ctx.moveTo(path[i - 1].x, path[i - 1].y);
        this.ctx.lineTo(path[i].x, path[i].y);
        this.ctx.stroke();
      }
    }
  }

  /**
   * Set pen color
   * @param {string} color - Hex color
   */
  setColor(color) {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      this.penColor = color;
    }
  }

  /**
   * Set pen size
   * @param {number} size - Pen size (1-8)
   */
  setSize(size) {
    const s = parseInt(size, 10);
    if (s >= 1 && s <= 8) {
      this.penSize = s;
    }
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.paths = [];
    this.currentPath = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Check if canvas has content
   * @returns {boolean}
   */
  isEmpty() {
    return this.paths.length === 0;
  }

  /**
   * Export signature as PNG data URL
   * @returns {string|null}
   */
  toDataURL() {
    if (this.isEmpty()) return null;

    // Find bounding box of signature
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let maxStrokeWidth = 1;
    for (const path of this.paths) {
      for (const point of path) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
        maxStrokeWidth = Math.max(maxStrokeWidth, point.size);
      }
    }

    // Minimal padding: just enough for stroke width to not get clipped
    const padding = Math.ceil(maxStrokeWidth / 2) + 1;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = maxX + padding;
    maxY = maxY + padding;

    // Create cropped canvas at high resolution for sharp output
    const width = maxX - minX;
    const height = maxY - minY;
    const scale = 4; // High-res export for sharp signatures
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width * scale;
    tempCanvas.height = height * scale;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.setTransform(scale, 0, 0, scale, 0, 0);
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';

    for (const path of this.paths) {
      for (let i = 1; i < path.length; i++) {
        tempCtx.beginPath();
        tempCtx.strokeStyle = path[i].color;
        tempCtx.lineWidth = path[i].size;
        tempCtx.moveTo(path[i - 1].x - minX, path[i - 1].y - minY);
        tempCtx.lineTo(path[i].x - minX, path[i].y - minY);
        tempCtx.stroke();
      }
    }

    return tempCanvas.toDataURL('image/png');
  }

  /**
   * Generate signature from text
   * @param {string} text - Signature text
   * @param {string} fontFamily - Font family
   * @param {string} color - Text color
   * @returns {string|null} - Data URL
   */
  static textToImage(text, fontFamily = 'cursive', color = '#000000') {
    if (!text || text.trim().length === 0) return null;

    const sanitizedText = text.replace(/[<>"'&]/g, '').slice(0, 50);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Measure text
    const fontSize = 48;
    let font;
    switch (fontFamily) {
      case 'cursive':
        font = `${fontSize}px 'Brush Script MT', cursive`;
        break;
      case 'serif':
        font = `italic ${fontSize}px Georgia, serif`;
        break;
      case 'sans':
        font = `${fontSize}px Arial, sans-serif`;
        break;
      default:
        font = `${fontSize}px cursive`;
    }

    ctx.font = font;
    const metrics = ctx.measureText(sanitizedText);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.2;

    // Minimal padding around text
    const padding = 4;
    const scale = 4;
    canvas.width = (textWidth + padding * 2) * scale;
    canvas.height = (textHeight + padding * 2) * scale;

    // Draw text
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(sanitizedText, padding, (textHeight + padding * 2) / 2);

    return canvas.toDataURL('image/png');
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }
}
