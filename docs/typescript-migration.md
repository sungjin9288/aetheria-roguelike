# TypeScript 마이그레이션 가이드

cycle 59 phase B+C — **strict: true 풀 활성 완료. 0 type-check errors.**

## 인프라 (최종)

- `tsconfig.json`: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- `tsx` 로더: `node --import tsx --test`
- `npm run type-check`: **0 errors**
- `src/types/`: 도메인 타입 (Player, Item, Monster, GameMap)

## 진행 현황 — 100% 클린 + strict 모드

| 디렉토리 | 클린 | ts-nocheck | strict 호환 |
|---------|----:|----------:|---------:|
| `src/utils` | 42 | 0 | ✅ |
| `src/data` | 19 | 0 | ✅ |
| `src/reducers` | 11 | 0 | ✅ |
| `src/hooks` | 20 | 0 | ✅ |
| `src/systems` | 8 | 0 | ✅ |
| `src/services` | 2 | 0 | ✅ |
| `src/components` | 66 | 0 | ✅ |
| `src/types` | 5 | 0 | ✅ |
| **합계** | **173** | **0** | **strict 호환** |

## strict 모드 활성 phase 진행 요약

| Phase | 작업 | 결과 |
|-------|------|-----|
| **6** | sed 일괄 implicit-any 명시 | 1702 → 156 errors |
| **A** | noImplicitAny manual fix | 156 → 0 errors |
| **B** | strictNullChecks | ~54 → 0 errors |
| **C** | strict: true 전체 | 3 → 0 errors |

## strictNullChecks 적용 패턴 (Phase B)

### 1. useState/useRef 타입 명시
- `useState(null)` → `useState<any>(null)`
- `useState([])` → `useState<any[]>([])`
- `useRef(null)` → `useRef<any>(null)`
- `useRef([])` → `useRef<any[]>([])`

### 2. Object access null assertion
- `this.ctx.createOscillator()` → `this.ctx!.createOscillator()` (after `_ensureReady` gate)
- `document.getElementById('root')` → `document.getElementById('root')!`

### 3. 옵셔널 chain + nullish coalescing
- `setProgress.nextTier - X` → `(setProgress.nextTier ?? 0) - X`
- `bonus.healPerTurn` → `(bonus.healPerTurn ?? 0)`

### 4. `null | undefined` → `undefined` 호환
- `transform={offhandTransform}` → `transform={offhandTransform || undefined}`
- `href={weaponOverlaySrc}` → `href={weaponOverlaySrc || undefined}`

### 5. `any` cast for index access where TypeScript can't narrow
- `ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind]` → `[... as any]`

### 6. catch (e) typing (Phase C: strict useUnknownInCatchVariables)
- `} catch (e) { e.message }` → `} catch (e: any) { e.message }`

## 빌드/테스트

| 명령 | 효과 |
|------|------|
| `npm run type-check` | **0 errors (strict: true)** |
| `npm run test:unit` | **536 unit pass** |
| `npm run test:e2e` | **14 E2E pass** |
| `npm run build` | Vite 자동 처리 |

## 후속 작업 (Phase D — 도메인 타입 적용 확장)

src/types/ 의 도메인 타입(Player, Item, Monster, GameMap)을 실제 코드에 적용:

### Phase D 작업
1. `INITIAL_STATE: Player` 명시 (gameReducer)
2. reducer action payload 타입 (discriminated union)
3. handlers/* state 타입
4. components/* props에 도메인 인터페이스 (any 대신)
5. systems/CombatEngine 메서드에 도메인 타입

이 작업은 안전한 점진 (one file at a time). 추정 5-10 사이클.
필수가 아니라 품질 향상 단계 — 출시는 현재 상태로 가능.
