/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        faud: {
          // 02 PALETA DE COLORES — Colores primarios (Figma pág. 21)
          amber: '#FFB606', // Ámbar FAUD · Primary (botones, acentos, links)
          'gold-dark': '#E6A303', // Oro oscuro · Secondary (hover, bordes activos)
          'gold-hover': '#FFCA28', // Oro hover · Botones hover, interacciones
          dark: '#2D2D2D', // Navy profundo · Fondos oscuros, sidebar, top bars
          hero: '#232323', // Fondo del hero de la portada (Figma pág. 4)
          'navy-mid': '#16213E', // Navy medio · Títulos de formularios de acceso
          'blue-arch': '#0F3460', // Azul arquitectónico · Acentos
          ink: '#1A1A2E', // Títulos de página y texto sobre ámbar
          // Fondos y neutros
          cream: '#FFF9EC', // Crema cálido · Fondo principal
          'amber-light': '#FFF3D0', // Ámbar claro · Tags, chips, headers de tabla
          'border-warm': '#E8DCC8', // Borde cálido · Bordes, divisores
          'text-cream': '#F5F0E1', // Crema texto · Texto sobre fondo oscuro
          // Texto
          text: '#2D2D2D', // Principal · Body
          muted: '#6B7280', // Secundario · Subtítulos, meta, labels
        },
        status: {
          // Semánticos (estados) — Figma págs. 21 y 23
          success: '#2D6A4F',
          'success-bg': '#F0F5F2',
          warning: '#9A5B00',
          'warning-bg': '#FFF3D0',
          'alert-bg': '#FFF7E5',
          danger: '#B3261E',
          'danger-bg': '#F7E8E8',
          inactive: '#6B7280',
          'inactive-bg': '#F3F4F6',
          disabled: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        // 03 ESCALA TIPOGRÁFICA (Figma pág. 22)
        hero: ['48px', { lineHeight: '1.2', fontWeight: '800' }],
        h2: ['28px', { lineHeight: '1.25', fontWeight: '700' }],
        h3: ['20px', { lineHeight: '1.3', fontWeight: '700' }],
        h4: ['16px', { lineHeight: '1.4', fontWeight: '700' }],
        body: ['14px', { lineHeight: '1.55' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '700' }],
        caption: ['12px', { lineHeight: '1.45' }],
        overline: ['11px', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '3px' }],
      },
      spacing: {
        // Layouts (Figma págs. 3, 15 y 24)
        sidebar: '240px',
        navbar: '64px',
        topbar: '56px',
      },
      maxWidth: {
        content: '1280px',
      },
      boxShadow: {
        card: '0 2px 12px 0 rgba(45, 45, 45, 0.05)',
        auth: '4px 6px 14px rgba(45, 45, 45, 0.22)',
      },
      borderRadius: {
        // 05 BORDER RADIUS (Figma pág. 24)
        checkbox: '4px',
        input: '8px',
        btn: '10px',
        card: '12px',
        badge: '15px',
        tag: '16px',
        pill: '20px',
      },
    },
  },
  plugins: [],
};
