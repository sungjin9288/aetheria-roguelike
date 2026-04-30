# TypeScript 마이그레이션 가이드

cycle 58 — 점진 마이그레이션 phase 1 완료.

## 인프라

- `tsconfig.json`: `allowJs: true`, `noEmit: true`, strict 점진 활성 예정
- `tsx` 로더: `node --import tsx --test` 로 `.ts/.tsx` 테스트 즉시 실행
- `npm run type-check` 으로 전체 타입 검사 (CI에 포함)
- `src/vite-env.d.ts`: Vite env + window 글로벌 타입 정의

## 변환 완료 (~110 파일)

전체 `.js`/`.jsx` → `.ts`/`.tsx` 마이그레이션 완료. 두 카테고리:

### A. 명시적 타입 적용 (8 파일)
순수 leaf 파일은 인터페이스/타입 명시:

- `src/utils/jobOutfitAffinity.ts` — `OutfitAffinity` / `SetCatalog` / `AffinityBonus`
- `src/utils/equipmentTint.ts` — `TintMod` / `TintableItem`
- `src/utils/runtimeMode.ts` — typed flag helpers
- `src/reducers/actionTypes.ts` — `AT as const` + `ActionType` literal union
- `src/reducers/gameStates.ts` — `GS as const` + `GameState` literal union
- `src/data/db.ts` — `DB as const`
- `src/data/constants.ts` — Vite env 타입 안전
- `src/data/messages.ts` (변환만, JSDoc 보존)

### B. `// @ts-nocheck` 적용 (~100 파일)
JSDoc 풍부 → 향후 strict 활성 시 풀어 fix:

- `src/utils/*` (전체)
- `src/data/*` (전체)
- `src/systems/*` (전체)
- `src/hooks/*` (전체)
- `src/services/*` (전체)
- `src/reducers/handlers/*`
- `src/components/**/*.tsx` (67개 — props 타입은 JSDoc 보존)

## 다음 단계 (후속 사이클)

### Phase 2: ts-nocheck 제거
권장 순서:
1. `src/utils/*` — 의존성 적은 leaf부터
2. `src/data/*` — 정적 데이터 (대형 객체 타입)
3. `src/reducers/handlers/*`
4. `src/services/*`
5. `src/hooks/*`
6. `src/systems/*`
7. `src/components/*` — props 타입 명시 (가장 마지막)

### Phase 3: strict 모드 단계적 활성
1. `noImplicitAny: true`
2. `strictNullChecks: true`
3. `strict: true` (전체)

### Phase 4: 타입 정의 통합
- `Player`, `Item`, `Monster`, `Map`, `Skill` 등 도메인 타입을 `src/types/` 로 분리
- DB.ITEMS / DB.MONSTERS 등에 정확한 타입 부여

## 변환 패턴

```typescript
// .js → .ts: 파일명만 변경. JSDoc은 보존.
import { X } from './foo.js';   // ✓ Vite/tsx 둘 다 .ts 자동 매핑

// 인터페이스 명시 (점진)
export interface PlayerLike {
    job?: string;
    equip?: { weapon?: ItemLike | null; ... };
}

// strict 비활성 상황의 임시 회피
// @ts-nocheck — TODO: cycle XX migration
```

## 빌드/테스트

| 명령 | 효과 |
|------|------|
| `npm run type-check` | 전체 .ts/.tsx 타입 검사 |
| `npm run test:unit` | tsx 로더로 .ts/.tsx 테스트 |
| `npm run test:e2e` | Playwright 8개 시나리오 |
| `npm run build` | Vite 자동 처리 |

## 일반 함정 (변환 시 주의)

- `Object.freeze` 후 인덱스 접근: `as const` 권장
- 기본 인자 `(x = {})`: 빈 객체 `{}` narrowing이 막힘 → 명시 타입 또는 ts-nocheck
- `import.meta.env` 접근: `vite-env.d.ts`에 키 등록
- `window.__GLOBAL__` 접근: `Window` interface 확장 (vite-env.d.ts)
- 테스트의 `readSrc('src/...js')`: `.ts`로 sed 일괄 치환

