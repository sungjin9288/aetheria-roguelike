import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 청크 크기 경고 임계값 상향 (Firebase SDK는 어쩔 수 없이 큼)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어
          'vendor-react': ['react', 'react-dom'],
          // 애니메이션 (framer-motion은 별도 청크)
          'vendor-motion': ['framer-motion'],
          // Firebase (필요 모듈만)
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // 차트
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
        }
      }
    }
  }
})
