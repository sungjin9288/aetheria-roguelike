# TypeScript 마이그레이션 가이드

cycle 58 phase 5 — **모든 ts-nocheck 제거 완료. 100% type-check pass.**

## 인프라

- `tsconfig.json`: `allowJs: true`, `noEmit: true`, strict 점진 활성 예정
- `tsx` 로더: `node --import tsx --test` 로 `.ts/.tsx` 테스트 즉시 실행
- `npm run type-check`: **0 errors**
- `src/vite-env.d.ts`: Vite env, Window 글로벌 (`__firebase_config`, `render_game_to_text` 등)
- `src/types/`: 도메인 타입 (Player, Item, Monster, GameMap)

## 진행 현황 — 전체 클린

| 디렉토리 | Clean | ts-nocheck | 비율 |
|---------|------:|----------:|-----:|
| `src/utils` | 42 | **0** | **100%** |
| `src/data` | 19 | **0** | **100%** |
| `src/reducers` | 11 | **0** | **100%** |
| `src/hooks` | 20 | **0** | **100%** |
| `src/systems` | 8 | **0** | **100%** |
| `src/services` | 2 | **0** | **100%** |
| `src/components` | 66 | **0** | **100%** |
| `src/types` | 5 | **0** | **100%** |
| **합계** | **173** | **0** | **100%** |

## 도메인 타입 (`src/types/`)

- `item.ts`: WeaponItem / ArmorItem / ShieldItem / ConsumableItem / EquipSlots
- `monster.ts`: MonsterBase / BossPhase / BossMonster
- `map.ts`: MapType / GameMap
- `player.ts`: Player / PlayerStats / PlayerCodex / SkillLoadout 등
- `index.ts`: 통합 re-export

## 적용된 패턴

### 1. data exports를 `any` 명시
```typescript
// items.ts, monsters.ts, maps.ts 등 22개
export const ITEMS: any = { weapons: [...] };
```
DB 데이터는 너무 복잡한 union이라 `any` 명시. 도메인 타입은 src/types/에서 별도 사용.

### 2. Object.values/entries 캐스팅
```typescript
(Object.entries(MAPS) as Array<[string, any]>).filter(...);
(Object.values(DB.MAPS) as any[]).forEach(...);
```

### 3. 클래스 필드 명시
```typescript
class SoundManager {
    ctx: AudioContext | null;
    muted: boolean;
    constructor() { ... }
}
```

### 4. 컴포넌트 props `: any` 캐스팅
자식 컴포넌트가 추가 prop을 받을 수 있도록:
```typescript
const Dashboard = ({ player, ... }: any) => { ... };
```

### 5. CombatEngine use-before-declaration 버그 수정 (실제 버그)
- `logs` 변수: status effect 검사 전에 declare 필요
- `relics` 변수: enemyAttack의 phase 전환 전에 declare 필요
- 두 변수 선언 위치를 함수 상단으로 이동

### 6. Vite env + Window 글로벌
```typescript
// vite-env.d.ts
interface ImportMetaEnv { VITE_FIREBASE_API_KEY?: string; ... }
interface Window {
    __firebase_config?: string;
    __AETHERIA_TEST_API__?: any;
    render_game_to_text?: any;
}
```

### 7. CONSTANTS / BALANCE 를 `any`
런타임 추가 키 (`DAILY_INVADE_LIMIT`, `PRIMAL_SHARD_DROP_CHANCE` 등) 호환.

## 후속 작업

### Phase A: strict 모드 단계적 활성 (다음 사이클)
현재 검증: `noImplicitAny: true` 활성 시 ~1702 errors
→ 사이클당 100-200 errors 페이스로 점진 fix
→ 도메인 타입 실제 적용 (Player, Item) 필요

### Phase B: 도메인 타입 실제 적용 (Phase A와 병행)
- `INITIAL_STATE: Player` 명시
- `gameReducer` action payload typed
- 컴포넌트 props에 `interface XxxProps` (any 대신)
- `useGameEngine` 반환 타입 명시

### Phase C: strict 모드 완전 활성
- `strictNullChecks: true`
- `strict: true` (전체)

### Phase D: E2E 시나리오 추가
- 전투 / 사망 / Ascension / Codex / Pass

전체 strict 모드 활성까지 6-10 사이클 추정.

## 빌드/테스트

| 명령 | 효과 |
|------|------|
| `npm run type-check` | 전체 타입 검사 (현재 **0 errors**) |
| `npm run test:unit` | **536 unit pass** |
| `npm run test:e2e` | **14 E2E pass** |
| `npm run build` | Vite 자동 처리 |
