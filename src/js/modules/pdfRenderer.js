/**
 * PDF Renderer Module
 * Handles PDF loading and rendering using pdf.js
 */

import * as pdfjsLib from 'pdfjs-dist';

// Use worker from public folder for reliable production serving
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

export class PdfRenderer {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.canvas = null;
    this.ctx = null;
    this.rendering = false;
    this.pendingPage = null;
  }

  /**
   * Initialize renderer with canvas element
   * @param {HTMLCanvasElement} canvas - Target canvas
   */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Load a PDF from ArrayBuffer
   * @param {ArrayBuffer} data - PDF file data
   * @returns {Promise<{totalPages: number}>}
   */
  async loadDocument(data) {
    try {
      // Use typed array copy to prevent detached buffer issues
      const typedArray = new Uint8Array(data);

      this.pdfDoc = await pdfjsLib.getDocument({
        data: typedArray,
        disableAutoFetch: true,
        disableStream: true
      }).promise;

      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;

      await this.renderPage(this.currentPage);

      return { totalPages: this.totalPages };
    } catch (error) {
      throw new Error('Gagal memuat PDF: ' + error.message);
    }
  }

  /**
   * Render a specific page
   * @param {number} pageNum - Page number (1-indexed)
   */
  async renderPage(pageNum) {
    if (!this.pdfDoc) return;

    if (this.rendering) {
      this.pendingPage = pageNum;
      return;
    }

    this.rendering = true;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      // Set canvas dimensions
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = viewport.width * dpr;
      this.canvas.height = viewport.height * dpr;
      this.canvas.style.width = `${viewport.width}px`;
      this.canvas.style.height = `${viewport.height}px`;

      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({
        canvasContext: this.ctx,
        viewport: viewport
      }).promise;

      this.currentPage = pageNum;
    } catch (error) {
      console.error('Render error:', error);
    } finally {
      this.rendering = false;

      if (this.pendingPage !== null) {
        const next = this.pendingPage;
        this.pendingPage = null;
        await this.renderPage(next);
      }
    }
  }

  /**
   * Go to next page
   */
  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.renderPage(this.currentPage + 1);
    }
  }

  /**
   * Go to previous page
   */
  async prevPage() {
    if (this.currentPage > 1) {
      await this.renderPage(this.currentPage - 1);
    }
  }

  /**
   * Zoom in
   */
  async zoomIn() {
    if (this.scale < 3.0) {
      this.scale = Math.min(3.0, this.scale + 0.25);
      await this.renderPage(this.currentPage);
    }
  }

  /**
   * Zoom out
   */
  async zoomOut() {
    if (this.scale > 0.5) {
      this.scale = Math.max(0.5, this.scale - 0.25);
      await this.renderPage(this.currentPage);
    }
  }

  /**
   * Get current canvas dimensions
   * @returns {{width: number, height: number}}
   */
  getCanvasDimensions() {
    return {
      width: parseInt(this.canvas.style.width),
      height: parseInt(this.canvas.style.height)
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
  }
}
