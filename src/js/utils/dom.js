/**
 * DOM Utility Functions
 * Centralized DOM manipulation helpers
 */

/**
 * Safely query a DOM element
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query all matching DOM elements
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {NodeList}
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {'info'|'success'|'error'} type - Toast type
 * @param {number} duration - Duration in ms
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = $('#toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Toggle visibility of an element
 * @param {Element} el - Target element
 * @param {boolean} show - Show or hide
 */
export function toggleVisibility(el, show) {
  if (!el) return;
  el.classList.toggle('hidden', !show);
  el.classList.toggle('active', show);
}

/**
 * Create an element with attributes
 * @param {string} tag - HTML tag
 * @param {Object} attrs - Attributes
 * @param {string} textContent - Text content
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, textContent = '') {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }
  if (textContent) el.textContent = textContent;
  return el;
}
