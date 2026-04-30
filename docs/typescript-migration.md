# TypeScript 마이그레이션 가이드

cycle 58 phase 3 — ts-nocheck 절반 이상 제거.

## 인프라

- `tsconfig.json`: `allowJs: true`, `noEmit: true`, strict 점진 활성 예정
- `tsx` 로더: `node --import tsx --test` 로 `.ts/.tsx` 테스트 즉시 실행
- `npm run type-check` 으로 전체 타입 검사 (CI에 포함)
- `src/vite-env.d.ts`: Vite env + window 글로벌 타입 정의
- `src/types/`: 도메인 타입 통합 (Player, Item, Monster, GameMap)

## 진행 현황

| 디렉토리 | Clean | ts-nocheck 잔여 | 비율 |
|---------|------:|---------------:|-----:|
| `src/utils` | 34 | 9 | 79% clean |
| `src/data` | 18 | 1 | 95% clean |
| `src/reducers` | 10 | 1 | 91% clean |
| `src/hooks` | 15 | 5 | 75% clean |
| `src/systems` | 6 | 2 | 75% clean |
| `src/services` | 2 | 0 | 100% clean |
| `src/components` | 45 | 21 (.tsx) | 68% clean |
| `src/types` | 5 | 0 | 100% clean |
| **합계** | **135** | **39** | **78% clean** |

## 도메인 타입 (`src/types/`)

- `item.ts`: WeaponItem / ArmorItem / ShieldItem / ConsumableItem / EquipSlots
- `monster.ts`: MonsterBase / BossPhase / BossMonster
- `map.ts`: MapType / GameMap
- `player.ts`: Player / PlayerStats / PlayerCodex / SkillLoadout 등
- `index.ts`: 통합 re-export

## 변환 패턴

```typescript
// .js → .ts: 파일명만 변경. JSDoc은 보존.
import { X } from './foo.js';   // ✓ Vite/tsx 둘 다 .ts 자동 매핑

// 인터페이스 명시 (점진)
import type { Player, EquipSlots } from '../types';

// default-{} narrowing 우회
const fn = (opts: any = {}) => opts.foo;   // ts-nocheck 없이 동작

// 복잡 케이스는 ts-nocheck 유지
// @ts-nocheck — TODO: cycle 59+ migration
```

## 잔여 작업 (후속 사이클)

### Phase A: ts-nocheck 9 utils 정리
- `exploreUtils` / `aiEventUtils` / `synthesisUtils` / `itemVisuals`
- `statsCalculator` / `questOperations` / `signatureSetBonus` / `gameUtils` / `shopRotation`
- 패턴: 각 함수 시그니처에 typed object literal 명시 또는 부분 인터페이스 적용

### Phase B: ts-nocheck 21 .tsx 정리
- props에 `interface XxxProps` 명시
- React.FC<Props> 또는 명시적 destructure 타입
- 큰 컴포넌트 (Bestiary, CombatPanel, MonsterCodex 등)에 더 많은 작업

### Phase C: ts-nocheck 잔여 9 비-component
- `data/monsters.ts`: literal union narrowing
- `systems/CombatEngine.ts` / `SoundManager.ts`: 클래스 필드 명시
- `hooks/useGameTestApi.ts` 등: 콜백 시그니처 명시
- `firebase.ts`: SDK 타입 활용

### Phase D: strict 모드 단계적 활성
- 모든 ts-nocheck 제거 후
- `noImplicitAny: true` → 점진 활성
- `strictNullChecks: true`
- `strict: true` 전체

### Phase E: 도메인 타입 적용 확장
- `INITIAL_STATE: Player` 명시
- `gameReducer` action payload typed
- `useGameEngine` 반환 타입 명시
- 컴포넌트 props에 도메인 타입 적용

## 빌드/테스트

| 명령 | 효과 |
|------|------|
| `npm run type-check` | 전체 .ts/.tsx 타입 검사 (현재 0 errors) |
| `npm run test:unit` | 536 unit pass |
| `npm run test:e2e` | 14 E2E 시나리오 |
| `npm run build` | Vite 자동 처리 |
