# PDF Sign - Tanda Tangan Digital

Aplikasi web PWA untuk menandatangani dokumen PDF secara aman, cepat, dan offline-ready.

## Fitur

- 📄 Upload & preview PDF
- ✍️ Tanda tangan dengan gambar (draw) atau ketik (text)
- 📱 Mobile responsive (touch-friendly)
- 🔒 Keamanan: XSS protection, input validation, rate limiting, CSP headers
- 📦 PWA: installable, offline-capable
- ⚡ Performa: code splitting, lazy loading

## Tech Stack

- **Vite** — Build tool & dev server
- **pdf-lib** — Embed tanda tangan ke PDF
- **pdfjs-dist** — Render PDF di browser
- **vite-plugin-pwa** — Service worker & manifest generation

## Cara Menjalankan

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build production
npm run build

# Preview production build
npm run preview
```

## Struktur Project

```
pdf-sign/
├── public/
│   └── icons/          # PWA icons
├── src/
│   ├── css/
│   │   └── styles.css  # Responsive styles
│   └── js/
│       ├── app.js      # Main controller
│       ├── modules/
│       │   ├── pdfRenderer.js   # PDF viewing (pdfjs-dist)
│       │   ├── pdfSigner.js     # PDF signing (pdf-lib)
│       │   ├── signaturePad.js  # Signature drawing/typing
│       │   └── security.js      # Security utilities
│       └── utils/
│           ├── dom.js           # DOM helpers
│           └── fileHandler.js   # File validation & I/O
├── index.html
├── vite.config.js
└── package.json
```

## Keamanan

- Validasi file PDF via magic bytes
- Sanitasi input untuk mencegah XSS
- Rate limiting untuk mencegah abuse
- Security headers (CSP, X-Frame-Options, dll)
- Tidak ada data yang dikirim ke server — semua proses di browser

## License

MIT © Farzani Ryuga B.A.
