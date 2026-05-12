/**
 * PDF Sign - Main Application Controller
 * Orchestrates all modules and handles UI interactions
 */

import { PdfRenderer } from './modules/pdfRenderer.js';
import { PdfSigner } from './modules/pdfSigner.js';
import { SignaturePad } from './modules/signaturePad.js';
import { RateLimiter, isValidImageDataUrl, generateSecureId } from './modules/security.js';
import { validatePdfFile, readFileAsArrayBuffer, formatFileSize, sanitizeFilename, downloadFile } from './utils/fileHandler.js';
import { $, $$, showToast } from './utils/dom.js';

class App {
  constructor() {
    this.pdfRenderer = new PdfRenderer();
    this.pdfSigner = new PdfSigner();
    this.signaturePad = null;
    this.rateLimiter = new RateLimiter(20, 60000);

    // State
    this.currentFile = null;
    this.placedSignatures = [];
    this.activeSignatureEl = null;
    this.isDragging = false;
    this.selectedFont = 'cursive';
    this.selectedTab = 'draw';

    this._init();
  }

  _init() {
    this._cacheElements();
    this._bindEvents();
    this._registerServiceWorker();
  }

  _cacheElements() {
    this.els = {
      stepUpload: $('#step-upload'),
      stepViewer: $('#step-viewer'),
      dropZone: $('#dropZone'),
      fileInput: $('#fileInput'),
      fileInfo: $('#fileInfo'),
      pdfCanvas: $('#pdfCanvas'),
      pdfContainer: $('#pdfContainer'),
      pdfCanvasWrapper: $('#pdfCanvasWrapper'),
      signatureOverlay: $('#signatureOverlay'),
      pageInfo: $('#pageInfo'),
      btnPrevPage: $('#btnPrevPage'),
      btnNextPage: $('#btnNextPage'),
      btnZoomIn: $('#btnZoomIn'),
      btnZoomOut: $('#btnZoomOut'),
      btnAddSignature: $('#btnAddSignature'),
      btnAddDate: $('#btnAddDate'),
      btnDownload: $('#btnDownload'),
      btnBack: $('#btnBack'),
      btnClearAll: $('#btnClearAll'),
      signatureModal: $('#signatureModal'),
      btnCloseModal: $('#btnCloseModal'),
      btnCancelSignature: $('#btnCancelSignature'),
      btnApplySignature: $('#btnApplySignature'),
      signatureCanvas: $('#signatureCanvas'),
      btnClearSignature: $('#btnClearSignature'),
      penColor: $('#penColor'),
      penSize: $('#penSize'),
      signatureText: $('#signatureText'),
      signaturePreview: $('#signaturePreview'),
      tabDraw: $('#tabDraw'),
      tabType: $('#tabType'),
    };
  }

  _bindEvents() {
    // Upload
    this.els.dropZone.addEventListener('click', () => this.els.fileInput.click());
    this.els.dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.els.fileInput.click();
      }
    });
    this.els.fileInput.addEventListener('change', (e) => this._handleFileSelect(e));

    // Drag and drop
    this.els.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.els.dropZone.classList.add('dragover');
    });
    this.els.dropZone.addEventListener('dragleave', () => {
      this.els.dropZone.classList.remove('dragover');
    });
    this.els.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.els.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this._processFile(e.dataTransfer.files[0]);
      }
    });

    // PDF navigation
    this.els.btnPrevPage.addEventListener('click', () => this._prevPage());
    this.els.btnNextPage.addEventListener('click', () => this._nextPage());
    this.els.btnZoomIn.addEventListener('click', () => this._zoomIn());
    this.els.btnZoomOut.addEventListener('click', () => this._zoomOut());

    // Actions
    this.els.btnAddSignature.addEventListener('click', () => this._openSignatureModal());
    this.els.btnAddDate.addEventListener('click', () => this._addDateStamp());
    this.els.btnDownload.addEventListener('click', () => this._downloadSignedPdf());
    this.els.btnBack.addEventListener('click', () => this._goBackToUpload());
    this.els.btnClearAll.addEventListener('click', () => this._clearAllSignatures());

    // Modal
    this.els.btnCloseModal.addEventListener('click', () => this._closeSignatureModal());
    this.els.btnCancelSignature.addEventListener('click', () => this._closeSignatureModal());
    this.els.btnApplySignature.addEventListener('click', () => this._applySignature());
    $('#signatureModal .modal-backdrop').addEventListener('click', () => this._closeSignatureModal());

    // Tabs
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this._switchTab(e.currentTarget.dataset.tab));
    });

    // Drawing tools
    this.els.penColor.addEventListener('input', (e) => {
      if (this.signaturePad) this.signaturePad.setColor(e.target.value);
    });
    this.els.penSize.addEventListener('input', (e) => {
      if (this.signaturePad) this.signaturePad.setSize(e.target.value);
    });
    this.els.btnClearSignature.addEventListener('click', () => {
      if (this.signaturePad) this.signaturePad.clear();
    });

    // Text signature
    this.els.signatureText.addEventListener('input', () => this._updateTextPreview());
    $$('.font-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        $$('.font-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedFont = e.currentTarget.dataset.font;
        this._updateTextPreview();
      });
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeSignatureModal();
    });
  }

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }
  }

  // ==================== FILE HANDLING ====================

  _handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) this._processFile(file);
  }

  async _processFile(file) {
    if (!this.rateLimiter.canProceed()) {
      showToast('Terlalu banyak aksi. Tunggu sebentar.', 'error');
      return;
    }

    const validation = await validatePdfFile(file);
    if (!validation.valid) {
      showToast(validation.error, 'error');
      return;
    }

    this.currentFile = file;
    this._showFileInfo(file);
    this._showProgress(0);

    try {
      this._showProgress(20);
      const arrayBuffer = await readFileAsArrayBuffer(file);
      this._showProgress(50);

      // Separate copies to avoid detached ArrayBuffer
      const rendererBuffer = arrayBuffer.slice(0);
      const signerBuffer = arrayBuffer.slice(0);

      this.pdfRenderer.init(this.els.pdfCanvas);
      this._showProgress(70);
      await this.pdfRenderer.loadDocument(rendererBuffer);

      this.pdfSigner.loadPdf(signerBuffer);
      this._showProgress(100);

      this._updatePageInfo();
      this._showStep('viewer');
      showToast('PDF berhasil dimuat', 'success');
    } catch (error) {
      showToast('Gagal memuat PDF: ' + error.message, 'error');
    } finally {
      this._hideProgress();
    }
  }

  _showProgress(percent) {
    let bar = this.els.progressBar;
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'progress-bar';
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      bar.appendChild(fill);
      this.els.stepUpload.appendChild(bar);
      this.els.progressBar = bar;
    }
    bar.classList.remove('hidden');
    bar.firstChild.style.width = `${percent}%`;
  }

  _hideProgress() {
    if (this.els.progressBar) {
      setTimeout(() => this.els.progressBar.classList.add('hidden'), 500);
    }
  }

  _showFileInfo(file) {
    const info = this.els.fileInfo;
    info.textContent = '';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-info-name';
    nameSpan.textContent = sanitizeFilename(file.name);
    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'file-info-size';
    sizeSpan.textContent = formatFileSize(file.size);
    info.appendChild(nameSpan);
    info.appendChild(sizeSpan);
    info.classList.remove('hidden');
  }

  // ==================== PDF NAVIGATION ====================

  async _prevPage() {
    await this.pdfRenderer.prevPage();
    this._updatePageInfo();
    this._updateSignatureOverlay();
  }

  async _nextPage() {
    await this.pdfRenderer.nextPage();
    this._updatePageInfo();
    this._updateSignatureOverlay();
  }

  async _zoomIn() {
    const oldWidth = parseInt(this.els.pdfCanvas.style.width) || this.els.pdfCanvas.offsetWidth;
    await this.pdfRenderer.zoomIn();
    this._rescaleSignatures(oldWidth);
  }

  async _zoomOut() {
    const oldWidth = parseInt(this.els.pdfCanvas.style.width) || this.els.pdfCanvas.offsetWidth;
    await this.pdfRenderer.zoomOut();
    this._rescaleSignatures(oldWidth);
  }

  _rescaleSignatures(oldCanvasWidth) {
    const newCanvasWidth = parseInt(this.els.pdfCanvas.style.width) || this.els.pdfCanvas.offsetWidth;
    const newCanvasHeight = parseInt(this.els.pdfCanvas.style.height) || this.els.pdfCanvas.offsetHeight;
    if (oldCanvasWidth === newCanvasWidth) return;

    const ratio = newCanvasWidth / oldCanvasWidth;

    this.placedSignatures.forEach(sig => {
      if (!sig.element) return;
      const el = sig.element;
      const left = parseFloat(el.style.left) * ratio;
      const top = parseFloat(el.style.top) * ratio;
      const width = el.offsetWidth * ratio;
      const height = el.offsetHeight * ratio;

      el.style.left = `${left}px`;
      el.style.top = `${Math.min(top, newCanvasHeight - height)}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    });

    this._updateSignatureOverlay();
  }

  _updatePageInfo() {
    const { currentPage, totalPages } = this.pdfRenderer;
    this.els.pageInfo.textContent = `${currentPage} / ${totalPages}`;
    this.els.btnPrevPage.disabled = currentPage <= 1;
    this.els.btnNextPage.disabled = currentPage >= totalPages;
  }

  // ==================== STEP MANAGEMENT ====================

  _showStep(step) {
    if (step === 'viewer') {
      this.els.stepUpload.classList.remove('active');
      this.els.stepUpload.classList.add('hidden');
      this.els.stepViewer.classList.remove('hidden');
      this.els.stepViewer.classList.add('active');
      this.els.signatureOverlay.classList.remove('hidden');
    }
  }

  // ==================== SIGNATURE MODAL ====================

  _openSignatureModal() {
    this.els.signatureModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (!this.signaturePad) {
      this.signaturePad = new SignaturePad(this.els.signatureCanvas);
    } else {
      this.signaturePad.clear();
      this.signaturePad._setupCanvas();
    }
    // Reset text input
    this.els.signatureText.value = '';
    this.els.signaturePreview.textContent = '';
  }

  _closeSignatureModal() {
    this.els.signatureModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  _switchTab(tab) {
    if (!tab) return;
    this.selectedTab = tab;
    $$('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));

    const showDraw = tab === 'draw';
    this.els.tabDraw.classList.toggle('active', showDraw);
    this.els.tabDraw.classList.toggle('hidden', !showDraw);
    this.els.tabType.classList.toggle('active', !showDraw);
    this.els.tabType.classList.toggle('hidden', showDraw);
  }

  _updateTextPreview() {
    const text = this.els.signatureText.value;
    if (!text.trim()) {
      this.els.signaturePreview.textContent = '';
      return;
    }

    const fonts = {
      cursive: "'Brush Script MT', cursive",
      serif: "Georgia, serif",
      sans: "Arial, sans-serif"
    };

    this.els.signaturePreview.style.fontFamily = fonts[this.selectedFont] || 'cursive';
    this.els.signaturePreview.style.fontStyle = this.selectedFont === 'serif' ? 'italic' : 'normal';
    this.els.signaturePreview.textContent = text;
  }

  // ==================== SIGNATURE PLACEMENT ====================

  _applySignature() {
    let dataUrl = null;

    if (this.selectedTab === 'draw') {
      if (!this.signaturePad || this.signaturePad.isEmpty()) {
        showToast('Silakan gambar tanda tangan terlebih dahulu', 'error');
        return;
      }
      dataUrl = this.signaturePad.toDataURL();
    } else {
      const text = this.els.signatureText.value.trim();
      if (!text) {
        showToast('Silakan ketik nama Anda', 'error');
        return;
      }
      dataUrl = SignaturePad.textToImage(text, this.selectedFont, this.els.penColor.value);
    }

    if (!dataUrl || !isValidImageDataUrl(dataUrl)) {
      showToast('Gagal membuat tanda tangan', 'error');
      return;
    }

    this._closeSignatureModal();
    this._placeSignatureOnPage(dataUrl);
  }

  _placeSignatureOnPage(dataUrl) {
    const overlay = this.els.signatureOverlay;
    const canvas = this.els.pdfCanvas;
    const canvasWidth = parseInt(canvas.style.width) || canvas.offsetWidth;
    const canvasHeight = parseInt(canvas.style.height) || canvas.offsetHeight;

    const sigId = generateSecureId();
    const sigEl = document.createElement('div');
    sigEl.className = 'placed-signature';
    sigEl.dataset.id = sigId;

    // Load image to get natural aspect ratio
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Tanda tangan';
    img.draggable = false;

    // Wait for image to load to get natural dimensions
    const onImageReady = () => {
      const imgWidth = img.naturalWidth || 200;
      const imgHeight = img.naturalHeight || 80;
      const aspectRatio = imgHeight / imgWidth;

      // Size: 30% of canvas width, height based on actual aspect ratio
      const defaultWidth = canvasWidth * 0.3;
      const defaultHeight = defaultWidth * aspectRatio;

      // Clamp height to max 40% of canvas height
      const maxHeight = canvasHeight * 0.4;
      let finalWidth = defaultWidth;
      let finalHeight = defaultHeight;
      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = finalHeight / aspectRatio;
      }

      // Position: center of visible area
      const container = this.els.pdfContainer;
      const scrollTop = container.scrollTop;
      const visibleHeight = container.clientHeight;
      const defaultX = Math.max(0, (canvasWidth - finalWidth) / 2);
      const defaultY = Math.max(0, Math.min(
        scrollTop + (visibleHeight - finalHeight) / 2,
        canvasHeight - finalHeight
      ));

      sigEl.style.left = `${defaultX}px`;
      sigEl.style.top = `${defaultY}px`;
      sigEl.style.width = `${finalWidth}px`;
      sigEl.style.height = `${finalHeight}px`;

      sigEl.appendChild(img);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'sig-delete';
      deleteBtn.textContent = '\u00D7';
      deleteBtn.setAttribute('aria-label', 'Hapus tanda tangan');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this._removeSignature(sigId);
      });
      sigEl.appendChild(deleteBtn);

      // Resize handle
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'sig-resize';
      sigEl.appendChild(resizeHandle);

      // Bind interactions
      const dragCleanup = this._bindDragEvents(sigEl);
      const resizeCleanup = this._bindResizeEvents(sigEl, resizeHandle);

      overlay.appendChild(sigEl);

      // Store signature data
      const sigData = {
        id: sigId,
        page: this.pdfRenderer.currentPage,
        x: (defaultX / canvasWidth) * 100,
        y: (defaultY / canvasHeight) * 100,
        width: (finalWidth / canvasWidth) * 100,
        height: (finalHeight / canvasHeight) * 100,
        imageDataUrl: dataUrl,
        element: sigEl,
        cleanup: () => { dragCleanup(); resizeCleanup(); }
      };

      this.placedSignatures.push(sigData);
      this.pdfSigner.addSignature({
        page: sigData.page,
        x: sigData.x,
        y: sigData.y,
        width: sigData.width,
        height: sigData.height,
        imageDataUrl: sigData.imageDataUrl
      });

      this.els.btnDownload.classList.remove('hidden');
      showToast('Tanda tangan ditambahkan. Geser untuk mengatur posisi.', 'success');
    };

    // If image is already cached/loaded
    if (img.complete && img.naturalWidth > 0) {
      onImageReady();
    } else {
      img.onload = onImageReady;
      // Fallback if image fails to report dimensions
      img.onerror = () => {
        showToast('Gagal memuat gambar tanda tangan', 'error');
      };
    }
  }

  _bindDragEvents(sigEl) {
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;

    const onStart = (e) => {
      if (e.target.closest('.sig-delete') || e.target.closest('.sig-resize')) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      sigEl.classList.add('selected');

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const wrapperRect = this.els.pdfCanvasWrapper.getBoundingClientRect();

      offsetX = (clientX - wrapperRect.left) - sigEl.offsetLeft;
      offsetY = (clientY - wrapperRect.top) - sigEl.offsetTop;
    };

    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const wrapperRect = this.els.pdfCanvasWrapper.getBoundingClientRect();

      let newX = (clientX - wrapperRect.left) - offsetX;
      let newY = (clientY - wrapperRect.top) - offsetY;

      const canvas = this.els.pdfCanvas;
      const maxX = (parseInt(canvas.style.width) || canvas.offsetWidth) - sigEl.offsetWidth;
      const maxY = (parseInt(canvas.style.height) || canvas.offsetHeight) - sigEl.offsetHeight;

      sigEl.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
      sigEl.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      sigEl.classList.remove('selected');
      this._updateSignatureData(sigEl);
    };

    sigEl.addEventListener('mousedown', onStart);
    sigEl.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    // Return cleanup function
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchend', onEnd);
    };
  }

  _bindResizeEvents(sigEl, handle) {
    let startWidth, startHeight, startX, resizing = false;

    const onStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      startWidth = sigEl.offsetWidth;
      startHeight = sigEl.offsetHeight;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
    };

    const onMove = (e) => {
      if (!resizing) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = clientX - startX;

      const newWidth = Math.max(50, startWidth + dx);
      const aspectRatio = startHeight / startWidth;
      const newHeight = Math.max(25, newWidth * aspectRatio);

      sigEl.style.width = `${newWidth}px`;
      sigEl.style.height = `${newHeight}px`;
    };

    const onEnd = () => {
      if (!resizing) return;
      resizing = false;
      this._updateSignatureData(sigEl);
    };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchend', onEnd);
    };
  }

  _updateSignatureData(sigEl) {
    const sigId = sigEl.dataset.id;
    const canvas = this.els.pdfCanvas;
    const canvasWidth = parseInt(canvas.style.width) || canvas.offsetWidth;
    const canvasHeight = parseInt(canvas.style.height) || canvas.offsetHeight;

    const x = (parseFloat(sigEl.style.left) / canvasWidth) * 100;
    const y = (parseFloat(sigEl.style.top) / canvasHeight) * 100;
    const width = (sigEl.offsetWidth / canvasWidth) * 100;
    const height = (sigEl.offsetHeight / canvasHeight) * 100;

    const sigData = this.placedSignatures.find(s => s.id === sigId);
    if (sigData) {
      const index = this.placedSignatures.indexOf(sigData);
      sigData.x = x;
      sigData.y = y;
      sigData.width = width;
      sigData.height = height;
      this.pdfSigner.updateSignature(index, { x, y, width, height });
    }
  }

  _removeSignature(sigId) {
    const index = this.placedSignatures.findIndex(s => s.id === sigId);
    if (index === -1) return;

    const sig = this.placedSignatures[index];
    if (sig.cleanup) sig.cleanup(); // Remove document listeners
    if (sig.element) sig.element.remove();

    this.placedSignatures.splice(index, 1);
    this.pdfSigner.removeSignature(index);

    if (this.placedSignatures.length === 0) {
      this.els.btnDownload.classList.add('hidden');
    }
    showToast('Tanda tangan dihapus', 'info');
  }

  _updateSignatureOverlay() {
    const currentPage = this.pdfRenderer.currentPage;
    this.placedSignatures.forEach(sig => {
      if (sig.element) {
        sig.element.style.display = sig.page === currentPage ? 'block' : 'none';
      }
    });
  }

  // ==================== FEATURES ====================

  _goBackToUpload() {
    if (this.placedSignatures.length > 0) {
      if (!confirm('Anda memiliki tanda tangan yang belum disimpan. Yakin ingin kembali?')) {
        return;
      }
    }

    this._clearAllSignatures(true);
    this.pdfRenderer.destroy();
    this.pdfSigner.destroy();
    this.currentFile = null;

    this.els.stepViewer.classList.remove('active');
    this.els.stepViewer.classList.add('hidden');
    this.els.stepUpload.classList.remove('hidden');
    this.els.stepUpload.classList.add('active');
    this.els.fileInfo.classList.add('hidden');
    this.els.fileInput.value = '';
  }

  _clearAllSignatures(silent = false) {
    if (this.placedSignatures.length === 0) {
      if (!silent) showToast('Tidak ada tanda tangan untuk dihapus', 'info');
      return;
    }

    this.placedSignatures.forEach(sig => {
      if (sig.cleanup) sig.cleanup();
      if (sig.element) sig.element.remove();
    });
    this.placedSignatures = [];
    this.pdfSigner.clearSignatures();
    this.els.btnDownload.classList.add('hidden');
    if (!silent) showToast('Semua tanda tangan dihapus', 'info');
  }

  _addDateStamp() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 28;
    const font = `${fontSize}px Arial, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(dateStr);
    const padding = 4;
    const scale = 4;

    canvas.width = (metrics.width + padding * 2) * scale;
    canvas.height = (fontSize * 1.2 + padding * 2) * scale;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.font = font;
    ctx.fillStyle = '#222222';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, padding, (fontSize * 1.2 + padding * 2) / 2);

    const dataUrl = canvas.toDataURL('image/png');
    if (isValidImageDataUrl(dataUrl)) {
      this._placeSignatureOnPage(dataUrl);
    }
  }

  // ==================== DOWNLOAD ====================

  async _downloadSignedPdf() {
    if (!this.rateLimiter.canProceed()) {
      showToast('Terlalu banyak aksi. Tunggu sebentar.', 'error');
      return;
    }

    if (this.pdfSigner.getSignatureCount() === 0) {
      showToast('Tambahkan tanda tangan terlebih dahulu', 'error');
      return;
    }

    try {
      showToast('Memproses PDF...', 'info');
      const signedPdfBytes = await this.pdfSigner.generateSignedPdf();

      // Safe filename: remove .pdf extension properly
      const originalName = this.currentFile.name;
      const baseName = originalName.toLowerCase().endsWith('.pdf')
        ? originalName.slice(0, -4)
        : originalName;
      const filename = `${baseName}_signed.pdf`;

      downloadFile(signedPdfBytes, filename);
      showToast('PDF berhasil diunduh!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
