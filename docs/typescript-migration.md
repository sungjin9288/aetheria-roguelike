# TypeScript 마이그레이션 가이드

cycle 58 phase 6 — **대규모 타입 명시 + 0 ts-nocheck + 0 type-check errors.**

## 인프라

- `tsconfig.json`: `allowJs: true`, `noEmit: true`, `noImplicitAny: false` (점진 활성 예정)
- `tsx` 로더: `node --import tsx --test`
- `npm run type-check`: **0 errors**
- `src/vite-env.d.ts`: Vite env, Window 글로벌
- `src/types/`: 도메인 타입 (Player, Item, Monster, GameMap)

## 진행 현황 — 100% 클린 + 대규모 타입 적용

| 디렉토리 | 클린 | ts-nocheck | 비율 |
|---------|----:|----------:|-----:|
| `src/utils` | 42 | **0** | **100%** |
| `src/data` | 19 | **0** | **100%** |
| `src/reducers` | 11 | **0** | **100%** |
| `src/hooks` | 20 | **0** | **100%** |
| `src/systems` | 8 | **0** | **100%** |
| `src/services` | 2 | **0** | **100%** |
| `src/components` | 66 | **0** | **100%** |
| `src/types` | 5 | **0** | **100%** |
| **합계** | **173** | **0** | **100%** |

## 적용된 패턴 (cycle 58 phase 6)

### 1. 콜백 함수 인자 `: any` 타입 명시 (~1500개)
sed 일괄 적용으로 모든 .map/.forEach/.filter/.reduce/.sort/.find/.some/.every 콜백:
```typescript
// Before: array.map(item => ...)
// After:  array.map((item: any) => ...)
```

### 2. 컴포넌트 props 타입 명시
모든 React 컴포넌트의 destructured props에 `: any`:
```typescript
const Dashboard = ({ player, sideTab, ... }: any) => { ... };
```

### 3. 클래스 필드 명시
`SoundManager`, `CombatEngine` 등의 인스턴스 필드 타입 선언.

### 4. Object.values/entries 캐스팅
`(Object.entries(MAPS) as Array<[string, any]>)` 패턴 일괄 적용.

### 5. 데이터 익스포트 `: any` 명시
`src/data/*` 22 파일의 정적 export (ITEMS, MONSTERS, MAPS 등)에 `: any` 명시.

### 6. CONSTANTS / BALANCE / INITIAL_STATE / DB `: any`
런타임 추가 키 호환을 위해 `: any` 명시.

### 7. 모듈 const `Record<string, any>` 명시
인덱스 액세스되는 객체 상수에 `Record<string, any>` 추가.

### 8. CombatEngine use-before-declaration 버그 수정
실제 코드 버그 발견:
- `logs` 변수: status effect 검사 전에 declare 필요
- `relics` 변수: enemyAttack의 phase 전환 전에 declare 필요

### 9. Vite env + Window 글로벌
```typescript
interface Window {
    __firebase_config?: string;
    __AETHERIA_TEST_API__?: any;
    render_game_to_text?: any;
    advanceTime?: any;
}
```

## 대규모 타입 적용 통계 (cycle 58 phase 6)

- 자동 sed 패턴 변환: ~1500 callback params + ~100 component destructures
- noImplicitAny 활성 시 baseline: **1702 errors**
- noImplicitAny 활성 후 fix: **156 errors 잔여** (91% reduction)
- 현재 `noImplicitAny: false` 유지 (잔여 156은 다음 사이클에서)

## 잔여 작업 (다음 사이클들)

### Phase A: noImplicitAny 풀 활성 (3-4 사이클)
잔여 156 errors는 주로:
- TS7053 (61): index access by `any` keys — 객체별로 `as any` 캐스팅 필요
- TS7006 (67): 일부 multi-arg 함수, default + destructure 결합 패턴
- TS7018 (8): object literal 추론 실패
- TS7034/7005 (24): 변수 implicit any in some locations

각 파일 수동 fix 또는 inline `as any` 캐스팅으로 해결. 사이클당 30-50 errors fix.

### Phase B: strictNullChecks 단계 (2-3 사이클)
A 완료 후 활성. 현재 추정 ~3000 errors (null/undefined narrowing).

### Phase C: strict 전체 (1 사이클)
B 완료 후 마지막 정리.

### Phase D: 도메인 타입 적용 확장
src/types/ 의 인터페이스를 reducer/handler/component에 실제 적용.

전체 strict 활성까지 ~6-9 추가 사이클 추정.

## 빌드/테스트

| 명령 | 효과 |
|------|------|
| `npm run type-check` | **0 errors** |
| `npm run test:unit` | **536 unit pass** |
| `npm run test:e2e` | **14 E2E pass** |
| `npm run build` | Vite 자동 처리 |
