# Changelog

> Aetheria Roguelike의 사이클별 변경 이력. 최신이 위.
>
> 분류 — `시스템 / 성능 / 콘텐츠 / UX / 인프라 / 보안 / 문서`. 자세한 항목은
> 각 사이클 commit 메시지를 참조.

---

## Cycle 67 — 의존성 + 안내 메시지 + 통합 검증 + 문서 동기화

- 콘텐츠: 탐색/유틸 유물 3종 (`방랑자의 부적` uncommon · `상인의 인장` rare · `운명의 결정` rare). 기존 `event_chance / gold_mult / drop_rate` 핸들러 재사용으로 CombatEngine 영향 없음.
- 인프라: `npm run verify` 통합 스크립트 (`type-check && lint && test:unit && build:guard`). 1줄로 4 gate 검증.
- 인프라: PWA `manifest.webmanifest` 한국어 description + `lang/scope/categories` 보강.
- 의존성: `npm update` patch/minor wanted 갱신 (84 deps). Capacitor 8.1→8.3, firebase 12.8→12.12, framer-motion 12.34→12.38, react 19.2.3→19.2.5 등. major(eslint 9→10 / vite 7→8 / tailwind 3→4 / lucide 0→1)는 별도 사이클로 미룸.
- 문서: AGENTS.md verification 섹션에 `tsc --noEmit` + `test:e2e` + smoke 사전조건 추가. README에 cycle 60–67 누적 6행 요약 테이블 추가. tasks/todo.md ✅ Completed에 cycle 60–64 시스템 시계열 한 항목 요약.

검증: tsc 0 / unit 565 / e2e 20 / lint clean / build:guard ok / smoke desktop 통과.

## Cycle 66 — 신규 이벤트 체인 "물의 사도"

- 콘텐츠: 호수의 신전(Lv5) → 사막 오아시스(Lv25) → 피라미드(Lv30) 3단계 체인. 보상 흐름은 `chain_advance / combat_bonus 1.2× ATK 6턴 / 엘릭서 또는 전설 유물`. cycle 62의 `forgotten_commander`(중후반)와 함께 초중반 진행 곡선을 보강.
- 테스트: `tests/water-apostle-chain.test.js` +5개.

검증: tsc 0 / unit 560 / lint clean / build:guard ok.

## Cycle 65 — CombatEngine Player typing + 보안 + ShopPanel + RunShareText + smoke 안내

- 시스템: CombatEngine 잔여 9개 메서드(`applyCritMpRestore / applyFatalProtection / tickCombatState / attack / performSkill / enemyAttack / applyExpGain / handleVictory / handleDefeat`)에 `player: Player` 적용. 내부 `let updatedPlayer: any = ...`로 strict literal inference 회피.
- 시스템: ShopPanel `player: any` → `Player` (cycle 60 batch 6에서 보류했던 nullable 가드 7곳 정리).
- 보안: `npm audit fix` 12 vulns(1 critical / 7 high / 4 moderate) → 0. vite path traversal / xmldom DoS / yaml stack overflow / brace-expansion DoS 등.
- UX: `RunShareText`에 `🎯 빌드 / 📊 난이도` 라인 추가 (`silence over noise`).
- 인프라: `smoke-gameplay.mjs` 연결 실패 시 안내 메시지 + 해결 옵션 3가지.

검증: tsc 0 / unit 555 / lint clean / build:guard ok / smoke 통과.

## Cycle 64 — E2E 회귀 가드 확장 + SW 캐시 v3

- 인프라: E2E 14 → 20개. STATS / CODEX / QUEST / ACHV 탭 lazy-loading + LegendaryCodex 빈 상태 educational hint(보스/전설 키워드) + pity status panel.
- 인프라: PWA `aetheria-rpg-v2` → `aetheria-rpg-v3` 캐시 갱신 (cycle 60–63 대규모 변경 후 stale chunk 방지).

검증: tsc 0 / unit 552 / e2e 20 / lint clean / build:guard ok.

## Cycle 63 — 챌린지 퀘스트 3개 + signature_collect 핸들러

- 콘텐츠: `대륙의 발자취 (explores 50)`, `지도 완성가 (discoveries 15, 칭호 보상)`, `전설 기록자 (signaturesDiscovered 15, 칭호 보상)`.
- 시스템: `signature_collect` quest type 핸들러 (`questProgress.ts`) — codex 합집합 크기로 진행도 산출.
- 테스트: signature_collect 매핑 + goal cap 동작 +2개.

검증: tsc 0 / unit 552 / lint clean / build:guard ok.

## Cycle 62 — forgotten_commander 체인 + UX polish + retroactive titles

- 콘텐츠: 이벤트 체인 "잊혀진 사령관" 3단계 (잊혀진 폐허 → 몰락한 전초기지 → 마왕성). 보상은 `chain_advance / combat_bonus 1.25× ATK 8턴 / 기사의 흉갑 또는 전설 유물`.
- 시스템: eventActions `stat_bonus` reward 핸들러 정상화 (기존 `rift_secret` 체인이 사용 중이었지만 silently 무시되던 보상).
- UX: 5개 풀스크린 모달 safe-area 패딩 + 8개 컴포넌트 `100vh → 100dvh`.
- 시스템: GameRoot bootStage ready 시 retroactive `checkTitles` (기존 save가 신규 칭호 조건 충족 상태로 로드돼도 즉시 부여).

검증: tsc 0 / unit 548 / lint clean / build:guard ok / smoke 통과.

## Cycle 61 — 성능 최적화 + 신규 칭호 5종

- 성능: 메인 index 387 → 265 KB (-32%). Dashboard 174 → 51 KB (-71%). 초기 로드 JS 561 → 316 KB (-44%).
- 성능: vite manualChunks 정리 + `game-equipment` / `game-combat` 청크 분리. Dashboard 비-default 탭 10개 React.lazy + Suspense fallback. Firebase 청크 `firestore / auth / core` 3개 분리.
- 콘텐츠: 신규 칭호 5종(`wanderer / pathfinder / cartographer / legend_seeker / legend_chronicler`) + 신규 cond.type(`explores / discoveries / signaturesDiscovered`).

검증: tsc 0 / unit 542 / lint clean / build:guard ok.

## Cycle 60 — TypeScript 도메인 타입 정착 (12 batch)

- 시스템: `src/types/`에 `Player / Item / Monster / GameMap / GameState / GameAction / Relic / EquipSlots` 도메인 타입 정의. `[key: string]: any` 인덱스 시그니처로 런타임 동적 필드 호환.
- 시스템: gameReducer / handlers/* / utils/* / hooks/* / components/* 전반에 단계적 적용 (12 batch). CombatEngine은 `getCombatFlags / getEffectiveMaxMp / updateQuestProgress` 3개 simple 메서드까지 적용 (heavy 메서드는 cycle 65에서 마무리).
- 시스템: `EquipSlots`를 ItemBase 슬롯 + 인덱스 시그니처로 완화 (런타임 동적 슬롯 호환).
- 시스템: `Relic` 도메인 타입 신규 — effect-기반 다형 데이터를 permissive 인터페이스로.

검증: tsc strict 0 errors / unit 536→542 / lint clean / build:guard ok.

---

## 이전 사이클 (–v4.0 / cycle 1–58)

- README의 `최근 수정 (Hotfixes)` 표를 참조. 주요 마일스톤은 cycle 58 (TS 인프라 + Playwright E2E + ts-nocheck 100% 제거), cycle 59 (strict: true 활성), cycle 56–57 (premium avatar / equipment family).
