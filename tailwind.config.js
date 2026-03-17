/**
 * @file tailwind.config.js
 * @description Tailwind CSS 설정 (Valor Style 브랜드 컬러 정의)
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0b",
        surface: "#111113",
        "valor-accent": "#00ffd0", // Valor 특유의 민트/아쿠아 컬러
        primary: "#3b82f6",
        secondary: "#6366f1",
        accent: "#a855f7",
        text: {
          DEFAULT: "#e2e8f0",
          muted: "#94a3b8",
        },
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'accent-glow': '0 0 15px rgba(0, 255, 208, 0.3)',
      }
    },
  },
  plugins: [],
}
