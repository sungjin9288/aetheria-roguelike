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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
            if (id.includes('framer-motion')) return 'vendor-motion'
            if (id.includes('/firebase/')) return 'vendor-firebase'
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-charts'
          }

          // 큰 게임 데이터는 별도 청크로 분리한다.
          // Dashboard는 App.jsx에서 lazy import 되므로 archive 계열은
          // 기본 청크 분할에 맡겨 cycle 없는 chunk graph를 유지한다.
          if (id.includes('/src/data/')) return 'game-data'

          if (
            id.includes('/src/systems/CombatEngine.js')
            || id.includes('/src/hooks/useCombatActions.js')
          ) {
            return 'game-combat'
          }
        }
      }
    }
  }
})
