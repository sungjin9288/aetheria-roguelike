# CLAUDE.md — Aetheria Roguelike

## 1. 프로젝트 개요

사이버펑크 판타지 배경의 텍스트 기반 roguelike RPG. Prestige 시스템, AI 생성 이벤트, Firebase 클라우드 세이브, Capacitor 기반 iOS/Android 지원, 완전 한국어 UI를 포함한다.

---

## 2. Tech Stack

| 분류 | 기술 | 버전 |
|------|------|------|
| UI Framework | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| Styling | TailwindCSS | 3.4.17 |
| Animation | Framer Motion | 12.34.2 |
| Icons | Lucide React | 0.563.0 |
| Charts | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| Backend | Firebase (Auth + Firestore) | 12.8.0 |
| Mobile | Capacitor | 8.1.0 |
| Language | **TypeScript** (`.ts`/`.tsx`, `strict: true`) | 5.x |
| Test | Node.js built-in `test` (실행은 `tsx` 로더) | — |
| Linter | ESLint | 9.39.1 |
| Node.js | — | >=18.0.0 |

> **TypeScript 사용** — 전 소스 `.ts`/`.tsx` (파일 확장자 기준 마이그레이션 **100% 완료**, `.js`/`.jsx` 0개).
> `tsconfig` `strict: true` + `tsc --noEmit` 0 에러. 단 **타입 안전성은 진행형** — 명시적 `: any` ~1,535건,
> `as any` ~107곳 잔존 (2026-07 실측). `BALANCE`/`CONSTANTS`는 1차 인터페이스 적용(인덱스 시그니처 절충),
> `MSG`/`DB`/데이터 export(`ITEMS`/`MONSTERS`/`RELICS`/`CLASSES`)는 타입화 예정.

---

## 3. 디렉토리 구조

```
src/
├── components/       # React UI 컴포넌트
│   ├── Dashboard.tsx         # 중앙 HUD (통계/인벤/탭)
│   ├── TerminalView.tsx      # 로그 출력 + 명령 입력
│   ├── ControlPanel.tsx      # 전투/이벤트/상점 버튼
│   ├── PostCombatCard.tsx    # 전투 결과 카드
│   ├── RelicChoicePanel.tsx  # 유물 3선택 UI (시너지 힌트 포함)
│   ├── tabs/CombatPanel.tsx  # 전투 UI (로직은 utils/combatView.ts)
│   └── ...
├── hooks/            # 게임 로직 + 상태 관리
│   ├── useGameEngine.ts       # 중앙 orchestrator (useReducer)
│   ├── useGameActions.ts      # 이동/탐험/휴식/명령 처리 (gameActions/ 하위 분할)
│   ├── useCombatActions.ts    # 전투 액션 (attack/skill/escape)
│   ├── useInventoryActions.ts # 오케스트레이터 (.rewards/.equipment/.economy/.premium 서브팩토리)
│   ├── useFirebaseSync.ts     # 클라우드 세이브 (debounce 500ms)
│   └── useDamageFlash.ts      # 데미지 플래시 효과
├── systems/          # 핵심 게임 시스템 (pure functions)
│   ├── CombatEngine.ts        # 전투 수식 본체 (부수효과 없음)
│   │                          #  + mixin: .status / .loot / .relics / .outcome
│   ├── prestigeUnlocks.ts     # 프레스티지 rank 해금 정의
│   ├── SoundManager.ts        # Web Audio API 신시사이저
│   ├── DifficultyManager.ts   # 동적 난이도 조정 (비대칭 고무줄)
│   └── TokenQuotaManager.ts   # AI API 일일 할당량 (50회)
├── services/
│   └── aiService.ts           # AI 이벤트 생성 + 오프라인 fallback
├── reducers/
│   ├── gameReducer.ts         # INITIAL_STATE + 타입 정의
│   ├── handlers/              # action 처리 (bootstrap/feature/progression/reward/ui 등 8분할)
│   ├── actionTypes.ts         # AT 객체 (Object.freeze)
│   └── gameStates.ts          # GS 객체 (IDLE/COMBAT/EVENT/DEAD/...)
├── data/             # 불변 게임 데이터베이스
│   ├── constants.ts           # CONSTANTS, BALANCE (모든 magic number)
│   ├── db.ts                  # DB 통합 export (DB.ITEMS, DB.MONSTERS, ...)
│   ├── items.ts               # 장비 정의 (~1,500 LOC)
│   ├── monsters.ts            # 몬스터 + 보스 패턴
│   ├── classes.ts             # 18개 직업 + 스킬 트리 (Tier 0-3)
│   ├── maps.ts                # 52개 지역 + 레벨 락 (Lv1-55 + 무한 심연)
│   ├── messages.ts            # 한국어 로그 메시지 (MSG 객체)
│   ├── relics.ts              # 67개 유물 + 20 시너지 정의
│   ├── eventChains.ts         # 13개 내러티브 이벤트 체인 (×3스텝)
│   ├── dropTables.ts          # 강화 드롭 테이블 (몬스터별 확률/수량)
│   ├── codexRewards.ts        # 도감 보상 정의 (26 마일스톤)
│   ├── seasonPass.ts          # 시즌 패스 보상 정의 (30티어)
│   └── quests.ts              # 143개 퀘스트 + 73개 업적 (ACHIEVEMENTS 포함)
└── utils/            # 공유 유틸리티 (~20개)
    ├── gameUtils.ts           # makeItem 등 공유 헬퍼 (migrateData는 dataMigration.ts로 분리)
    ├── dataMigration.ts       # 세이브 마이그레이션 (migrateData)
    ├── equipmentUtils.ts      # 장비 프로파일 계산
    ├── exploreUtils.ts        # 적 스폰, 이벤트 결정
    ├── combatView.ts          # 전투 뷰모델 (CombatPanel용 순수함수)
    ├── graveUtils.ts          # 묘비 생성/복구
    ├── runProfileUtils.ts     # 플레이스타일 분석
    └── commandParser.ts       # 명령어 파싱
tests/                # 단위 테스트 (Node.js built-in test, 117 파일 / ~3,000 케이스)
scripts/              # 빌드 가드, 스모크 테스트, 모바일 빌드 스크립트
android/ ios/         # Capacitor 네이티브 프로젝트
```

---

## 4. 빌드 & 실행 명령어

```bash
# 개발
npm run dev               # Vite dev server → http://localhost:5173
npm run build             # 프로덕션 빌드 → dist/
npm run build:guard       # 빌드 전 유효성 검증
npm run preview           # 빌드 결과 프리뷰

# 검증
npm run lint              # ESLint 검사
npm run test:unit         # 단위 테스트 (tests/*.test.js)
npm run test:smoke        # 스모크 게임플레이 테스트

# 모바일
npm run cap:sync          # Capacitor sync (iOS + Android 동시)
npm run android:sync      # Android sync
npm run android:debug     # Debug APK
npm run android:release   # Release APK
npm run ios:sync          # iOS sync
npm run ios:build:device  # iOS 기기 빌드
npm run ios:archive       # App Store 아카이브
npm run mobile:doctor     # Capacitor 환경 점검
```

---

## 5. 코딩 규칙

### DO

- **`BALANCE` 상수 사용**: 모든 수치(확률, 배율, 비용 등)는 반드시 `src/data/constants.ts`의 `BALANCE` 객체에서 참조. inline magic number 절대 금지.
- **`MSG` 객체 사용**: 한국어 로그 메시지는 반드시 `src/data/messages.ts`의 `MSG` 객체에서 가져올 것. 컴포넌트/훅에 한국어 문자열 직접 작성 금지.
- **`AT` 객체 사용**: reducer dispatch 시 action type은 반드시 `actionTypes.ts`의 `AT` 상수 사용. 문자열 리터럴 사용 금지.
- **`GS` 객체 사용**: game state 비교는 반드시 `gameStates.ts`의 `GS` 상수 사용.
- **Immutable 업데이트**: reducer에서 state 변경 시 반드시 spread operator로 새 객체 반환. 직접 변이 금지.
- **Pure function 유지 (CombatEngine)**: `CombatEngine.ts` 함수는 입력 → 새 객체 반환. side effect 절대 금지.
- **`SET_PLAYER` 함수형 payload 활용**: 현재 player 상태에 의존하는 업데이트는 함수형 payload 사용:
  ```javascript
  dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, hp: p.hp - damage }) });
  ```
- **DB 통합 export 사용**: 게임 데이터 참조 시 `db.ts`의 `DB` 객체를 통해 접근 (`DB.ITEMS`, `DB.MONSTERS` 등).
- **`addLog(type, text)` 로그 패턴**: 게임 이벤트는 반드시 이 함수로 로그 출력.

### DON'T

- **직접 state 변이 금지**: `player.hp = newHp` 같은 직접 변이는 dev tools 및 시간여행 디버깅을 破壊한다.
- **CombatEngine에 side effect 추가 금지**: `dispatch`, `console.log`, 외부 상태 변경 등 넣으면 테스트 불가능해짐.
- **컴포넌트에 게임 로직 작성 금지**: 비즈니스 로직은 `hooks/`, `systems/`, `utils/`에. 컴포넌트는 렌더링만 담당.
- **한국어 문자열 하드코딩 금지**: `MSG.BATTLE_START` 처럼 `MSG` 객체 사용. 컴포넌트 JSX 안에 한국어 직접 입력 금지.
- **`data/` 파일 직접 수정 시 주의**: `items.ts`, `monsters.ts`, `constants.ts` 변경 시 밸런스 전체에 영향. 반드시 테스트 후 반영.
- **`CONSTANTS.DATA_VERSION` 무단 변경 금지**: save 구조 변경 시 반드시 버전 bump + `migrateData()` 업데이트 병행.
- **enemy turn timeout 누수 금지**: `useCombatActions.ts`의 `pendingEnemyTurn` ref는 전투 중단 시 반드시 cleanup. 누락 시 stale dispatch 발생.

---

## 6. 핵심 설계 원칙

### 상태 관리 아키텍처
```
useGameEngine (useReducer)
    ├── useGameActions       → 이동/탐험/휴식/이벤트
    ├── useCombatActions     → 전투 resolve
    ├── useInventoryActions  → 인벤토리
    ├── useFirebaseSync      → 클라우드 저장
    └── useDamageFlash       → 데미지 플래시
```
- **단일 진실 원천**: 모든 게임 상태는 `gameReducer.ts`의 `INITIAL_STATE`에서 정의
- **Hooks 조합**: 각 역할별 hook으로 분리 → `useGameEngine`이 조합해서 컴포넌트에 전달

### CombatEngine 설계 패턴
- **완전한 pure function**: `calculateDamage()`, `attack()`, `performSkill()`, `enemyAttack()` 등 모두 `(state, params) → newState` 시그니처
- **결정론적**: 동일 입력 → 동일 출력 (Math.random 제외)
- **독립 테스트 가능**: 게임 환경 없이 단독 테스트 가능

### 밸런스 상수 관리
모든 수치는 `src/data/constants.ts`에 집중 관리:

| 상수 | 값 | 의미 |
|------|----|------|
| `CRIT_CHANCE` | 0.1 | 크리티컬 확률 10% |
| `ESCAPE_CHANCE` | 0.5 | 도망 성공률 50% |
| `EXP_SCALE_RATE` | 1.15 | 레벨업 EXP 증가 배율 (Lv50 ~45전투/레벨 목표) |
| `RELIC_FIND_CHANCE` | 0.08 | 유물 발견 확률 8% |
| `BOSS_PHASE2_THRESHOLD` | 0.5 | 보스 2페이즈 전환 HP 비율 |
| `TWO_HAND_ATK_BONUS` | 1.55 | 양손무기 ATK 배율 |
| `EVENT_CHANCE_NOTHING` | 0.2 | 탐험 시 아무 일도 안 일어날 확률 |
| `STATUS_DOT_RATIO` | 0.04 | DoT 데미지 = maxHp × 4% |

### Roguelike 루프 구조
1. **탐험** → 적/이벤트/유물 랜덤 발생 (pity counter로 드랍 보장)
2. **유물 선택** → 3개 중 선택(프레스티지 rank≥2: 4개), 최대 5개 보유(rank≥2: 6개)
3. **마왕 격파** → Ascension 옵션 제공
4. **프레스티지** → 레벨/장비/유물 초기화, 영구 보너스 적립
5. **묘비 시스템** → 사망 지점에 골드/아이템 보관, 재방문 시 회수

### AI 이벤트 생성
- **온라인**: 위치/최근 전투 이력/플레이어 상태를 컨텍스트로 AI 호출 (9.5s timeout)
- **오프라인/할당량 초과**: 사전 제작된 큐레이션 fallback 이벤트 풀에서 랜덤 선택
- **일일 한도**: 50회 (TokenQuotaManager)

### 저장 데이터 버전 관리
- `CONSTANTS.DATA_VERSION = 5.0`
- save 구조 변경 시: 버전 bump → `gameUtils.migrateData()` 업데이트 필수

---

## 7. 테스트

```bash
npm run test:unit    # 단위 테스트 전체 실행
npm run test:smoke   # 게임플레이 스모크 테스트
```

**테스트 파일 위치**: `tests/*.test.js`
- `grave-recovery.test.js` — 묘비 생성/복구
- `run-profile-utils.test.js` — 빌드 분석 로직
- `player-state-utils.test.js` — 상태 전환
- `quest-progress.test.js` — 퀘스트 마일스톤
- `adventure-guide.test.js` — 가이드 힌트
- `ai-event-utils.test.js` — AI 이벤트 패키지 빌드
- `outcome-analysis.test.js` — 전투 후 분석

**테스트 방침**: 외부 mock 프레임워크 없이 Node.js built-in `test` 사용. Pure function이므로 별도 DI 없이 직접 import 후 assert.

---

## 8. 주의사항

### 절대 건드리지 말 것
- **`CombatEngine.ts` 함수 시그니처**: 수많은 훅이 의존. 변경 시 전투 전체 영향.
- **`INITIAL_STATE` 필드 제거**: 기존 Firebase 저장 데이터와 호환성 깨짐. 추가는 가능, 제거/이름변경은 `migrateData()` 없이 불가.
- **`AT`/`GS`/`DB`/`BALANCE`/`MSG` 객체 구조 변경**: 프로젝트 전체에서 참조 중.

### 특별히 조심할 것

**1. enemy turn cleanup**
`useCombatActions.ts`의 `pendingEnemyTurn` ref를 전투 중단(도망/사망/이벤트 전환) 시 반드시 `clearTimeout`. 누락 시 전투 종료 후 적이 계속 공격하는 버그 발생.

**2. grave 호환성**
구형 save에는 `grave.item` (단수), 신형에는 `grave.items[]` (복수). `graveUtils.ts` 수정 시 양쪽 포맷 모두 처리 필요.

**3. Quick Slot 검증**
앱 부팅 시 quick slot이 더 이상 인벤에 없는 아이템을 참조할 수 있음. 로드 시 sanitize 로직 유지.

**4. Daily Protocol 타이밍**
탐험마다 reset하면 안 됨. 날짜(timestamp) 기반으로만 reset. `getDailyProtocolCompletions()` 로직 수정 시 주의.

**5. Firebase 익명 인증**
앱 부팅 시 자동 초기화. `bootStage`가 완료되기 전에 게임 렌더링 금지 (저장 데이터 로드 전 기본값으로 덮어씌워지는 race condition 주의).

**6. 청크 분리 설정**
`vite.config.js`의 `manualChunks` 설정이 성능에 직결. vendor-react / vendor-motion / vendor-firebase / game-data 등으로 분리되어 있으며, 대형 라이브러리 추가 시 청크에 포함 여부 검토 필요.

**7. 모바일 viewport**
`100dvh` 사용 (100vh 아님). iOS Safari 하단 주소창 때문. `env(safe-area-inset-*)` CSS 변수도 MainLayout에서 이미 처리 중 — 중복 적용 주의.
