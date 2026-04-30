# TypeScript 마이그레이션 가이드

cycle 58에 점진 마이그레이션 시작. 한 번에 변환하지 않고 file-by-file.

## 인프라

- `tsconfig.json`: `allowJs: true` + `noEmit: true` (Vite가 emit 담당, tsc는 type-check만)
- `tsx` 로더: `node --import tsx --test` 로 `.ts` 테스트 즉시 실행 (트랜스파일 X)
- `npm run type-check` 으로 전체 타입 검사

## 변환 완료 (2)

- `src/utils/jobOutfitAffinity.ts` (시범)
- `src/utils/equipmentTint.ts` (시범)

## 권장 변환 순서

1. **Leaf 유틸 (의존성 없는 pure 함수)** — 가장 안전
   - `src/utils/avatarSpriteCandidates.js`
   - `src/utils/anchorPoints.js`
   - `src/utils/commandParser.js`
   - `src/utils/exploreUtils.js`
2. **데이터 디렉토리** — 타입 정의 큰 효과
   - `src/data/constants.js` → 자동 보호되는 `BALANCE`/`CONSTANTS` 타입
   - `src/data/messages.js` → `MSG` 객체 자동완성
   - `src/data/actionTypes.js` → `AT` discriminated union
   - `src/data/gameStates.js` → `GS` literal union
3. **유틸 (의존성 있음)** — 위 끝나면
   - `src/utils/equipmentUtils.js`
   - `src/utils/gameUtils.js`
   - `src/utils/statsCalculator.js`
4. **시스템** — pure 함수 위주, 다음 후보
   - `src/systems/CombatEngine.js`
   - `src/systems/SoundManager.js`
5. **훅** — 가장 늦게 (외부 deps 의존)
6. **컴포넌트** — `.jsx` → `.tsx` (컴포넌트 props 타입 우선)

## 변환 패턴

```typescript
// .js → .ts: JSDoc → TypeScript 타입
// 외부 import는 `from '../utils/foo.js'` 그대로 유지 (Vite/tsx 둘 다 .ts 자동 매핑)
import { someFn } from './leaf.js';   // ✓ 작동

// 인터페이스 명시
export interface PlayerLike {
    job?: string;
    equip?: { weapon?: ItemLike | null; ... };
}

// 함수 시그니처
export const myFn = (input: PlayerLike): SomeReturn => { ... };
```

## 일반 함정

- `Object.freeze`로 만든 상수의 인덱스 접근: `as const` 또는 `Readonly<Record<...>>` 사용
- `null | undefined | Item` 케이스: `item?.field` 활용 또는 narrow guard 추가
- `any` 회피: `unknown` 후 type guard

## 빌드/테스트

| 명령 | 효과 |
|------|------|
| `npm run type-check` | 전체 .ts/.tsx 타입 검사 (CI에 추가 권장) |
| `npm run test:unit` | tsx 로더로 .ts 직접 실행 |
| `npm run build` | Vite 자동 처리 |

## 다음 단계 (후속 사이클)

1. `src/data/*` 타입 정의 (한 번에 큰 효과)
2. `src/utils/*` 일괄 변환
3. `src/components/*` `.jsx` → `.tsx`
4. `tsconfig.json`에서 `strict: true`, `noImplicitAny: true` 단계적 활성

전체 완료까지 ~3-5 세션 추정.
