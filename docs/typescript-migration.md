# TypeScript 마이그레이션 가이드

cycle 58 phase 4 — **모든 비-component 파일 클린, components 71% 클린.**

## 인프라

- `tsconfig.json`: `allowJs: true`, `noEmit: true`
- `tsx` 로더로 `.ts/.tsx` 테스트 직접 실행
- `npm run type-check`: 0 errors
- `src/vite-env.d.ts`: Vite env, Window 글로벌 (`__firebase_config`, `render_game_to_text` 등)
- `src/types/`: 도메인 타입 (Player, Item, Monster, GameMap)

## 진행 현황

| 디렉토리 | Clean | ts-nocheck 잔여 | 비율 |
|---------|------:|---------------:|-----:|
| `src/utils` | **42** | 0 | **100%** |
| `src/data` | **19** | 0 | **100%** |
| `src/reducers` | **11** | 0 | **100%** |
| `src/hooks` | **20** | 0 | **100%** |
| `src/systems` | **8** | 0 | **100%** |
| `src/services` | **2** | 0 | **100%** |
| `src/components` | 47 | 19 (.tsx) | 71% |
| `src/types` | 5 | 0 | **100%** |
| **합계** | **154** | **19** | **89%** |

비교: cycle 58 시작 시 ~100 ts-nocheck → 현재 19 (**81% 감소**).

## 주요 패턴 (cycle 58 phase 4 적용)

### 1. data exports를 `any`로 명시
```typescript
// src/data/items.ts, monsters.ts, maps.ts 등
export const ITEMS: any = { weapons: [...], armors: [...] };
```
22개 정적 데이터 객체. 정확한 union narrowing은 비실용적이라 `any`로.

### 2. `Object.values/entries` 캐스팅
```typescript
(Object.entries(MAPS) as Array<[string, any]>).filter(...);
(Object.values(DB.MAPS) as any[]).forEach(...);
```

### 3. 클래스 필드 명시
```typescript
class SoundManager {
    ctx: AudioContext | null;
    muted: boolean;
    initialized: boolean;
    constructor() { ... }
}
```

### 4. CombatEngine use-before-declaration 버그 수정
실제 코드 버그 발견 — `logs`, `relics`가 선언 전에 사용됨 (조건부 분기에서). 선언 위치 이동으로 fix.

### 5. Window 글로벌 선언
```typescript
// vite-env.d.ts
interface Window {
    __firebase_config?: string;
    render_game_to_text?: any;
    __AETHERIA_TEST_API__?: any;
}
```

### 6. CONSTANTS / BALANCE를 `any`
런타임 추가 키 (DAILY_INVADE_LIMIT 등)가 정적 타입에 누락되어 있어 `any`로 단일화.

## 잔여 19 components

| 파일 | 주요 이슈 |
|------|---------|
| `App.tsx`, `app/GameRoot.tsx`, `app/MobileGameLayout.tsx` | 자식 컴포넌트 props에 `mobile`, `stats` 등 추가 prop 미선언 |
| `Dashboard.tsx`, `MainLayout.tsx`, `MapNavigator.tsx`, `EquipmentPanel.tsx`, `ShopPanel.tsx`, `StatsPanel.tsx`, `ControlPanel.tsx`, `SkillTreePreview.tsx`, `DashboardMobileSummary.tsx` | DB.MAPS / DB.MONSTERS 등 narrowing + child props |
| `tabs/CombatPanel.tsx`, `tabs/CraftingPanel.tsx`, `tabs/JobChangePanel.tsx`, `tabs/SystemTab.tsx` | 동일 패턴 |
| `codex/LegendaryCodex.tsx`, `codex/MonsterCodex.tsx`, `codex/WeaponCodex.tsx`, `ClassTree.tsx` | Object.values unknown narrowing |

각 컴포넌트당 평균 3-10 errors. 후속 사이클에서 props interface 명시 + `as any` 캐스팅으로 정리 가능. 1 사이클당 5-7 컴포넌트 페이스로 3 사이클이면 완전 클린.

## 후속 작업

### Phase A: 19 components 정리 (~3 사이클)
- 각 컴포넌트의 props에 `interface XxxProps`
- 또는 `Object.values(...) as any[]` 캐스팅
- 자식 컴포넌트에 `[key: string]: any` 인덱스 시그니처 추가

### Phase B: strict 모드 단계적 활성 (1-2 사이클)
- 모든 ts-nocheck 제거 후
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strict: true`

### Phase C: 도메인 타입 적용 확장 (1-2 사이클)
- INITIAL_STATE에 Player 타입
- reducer action payload typed
- 컴포넌트 props에 도메인 타입

### Phase D: E2E 시나리오 추가
- 전투 / 사망 / Ascension / Codex / Pass 등

전체 완료까지 6-9 사이클 추정.

## 빌드/테스트

| 명령 | 효과 |
|------|------|
| `npm run type-check` | 전체 .ts/.tsx 타입 검사 (현재 **0 errors**) |
| `npm run test:unit` | **536 unit pass** |
| `npm run test:e2e` | **14 E2E pass** |
| `npm run build` | Vite 자동 처리 |
