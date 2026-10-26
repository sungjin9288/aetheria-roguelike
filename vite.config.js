import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { tossSdkTargetPlugin } from './scripts/tossSdkTarget.mjs'
import { webPublicAssetsPlugin } from './scripts/webPublicAssets.mjs'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

// 그림 매니페스트 · 팔레트와 그림 경로 · 착용 미리보기 유틸은 게임 화면만 쓴다 — 부팅 때 받는 청크(game-data ·
// game-equipment)에 묶지 않고 그리는 화면(지연 청크)과 함께 받는다(CH-03).
const PRESENTATION_ONLY_DATA = /\/src\/data\/(?:characterArtManifest\.json|consumableArtManifest\.json|monsterArtManifest\.json|artPalette\.(?:json|ts))$/

// https://vite.dev/config/
export default defineConfig({
  // 토스 SDK는 토스 빌드에만, public/assets는 런타임 그림 목록만 담는다 (scripts/tossSdkTarget.mjs · webPublicAssets.mjs).
  plugins: [react(), tossSdkTargetPlugin({ repoRoot }), webPublicAssetsPlugin({ repoRoot })],
  build: {
    // 청크 크기 경고 임계값 상향 (Firebase SDK는 어쩔 수 없이 큼)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
            if (id.includes('framer-motion')) return 'vendor-motion'
            // Firebase 모듈을 기능별로 분리 — 각각 독립 로드/캐시 가능 (cycle 61).
            if (id.includes('/firebase/firestore') || id.includes('/@firebase/firestore')) return 'vendor-firebase-firestore'
            if (id.includes('/firebase/auth') || id.includes('/@firebase/auth')) return 'vendor-firebase-auth'
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase-core'
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-charts'
          }

          // 큰 게임 데이터는 별도 청크로 분리한다.
          // Dashboard는 App.tsx에서 lazy import 되므로 archive 계열은
          // 기본 청크 분할에 맡겨 cycle 없는 chunk graph를 유지한다.
          if (id.includes('/src/data/') && !PRESENTATION_ONLY_DATA.test(id)) return 'game-data'

          // CombatEngine + 전투 액션 훅 (cycle 60에서 .ts 확장).
          if (
            id.includes('/src/systems/CombatEngine')
            || id.includes('/src/hooks/useCombatActions')
            || id.includes('/src/hooks/combatActions/')
          ) {
            return 'game-combat'
          }

          // 장비/아바타 도메인 유틸 (cycle 61 perf 분리). 그림 경로 · 착용 미리보기 유틸(itemVisuals · equipmentArt ·
          // avatarEquipmentPreview …)은 여기 묶지 않는다 — 이 청크는 첫 화면 전에 받는다(CH-03, tests/boot-chunk-contract).
          if (
            id.includes('/src/utils/runProfile')
            || id.includes('/src/utils/equipmentUtils')
            || id.includes('/src/utils/jobOutfitAffinity')
          ) {
            return 'game-equipment'
          }
        }
      }
    }
  }
})
