# Changelog

> Aetheria Roguelike의 사이클별 변경 이력. 최신이 위.
>
> 분류 — `시스템 / 성능 / 콘텐츠 / UX / 인프라 / 보안 / 문서`. 자세한 항목은
> 각 사이클 commit 메시지를 참조.

---

## Cycle 97 — maxKillStreak reflection 마무리 (RunSummaryCard chip + focus advice)

- UX: RunSummaryCard run-summary-extras에 streak chip(red Flame). extras 섹션 트리거 조건에 `OR maxKillStreak > 0` 추가.
- 시스템: getRunSummaryAnalysis focus advice 2종 — `>=10` 공격형 칭찬, `<3 && level >= 10` streak 활용 권장.
- 결과: maxKillStreak feedback chain 8개 surface 완성.

검증: tsc 0 / unit 683 / lint clean.

## Cycle 96 — maxKillStreak feedback chain 표면 통합 (StatsPanel/RunSummary/share)

- UX: StatsPanel MAX STREAK row(Flame red-400) 추가.
- 시스템: buildRunSummary에 maxKillStreak 필드, buildRunShareText에 "🔥 최대 N연속 처치" silence-over-noise 라인.

검증: tsc 0 / unit 677 / lint clean.

## Cycle 95 — maxKillStreak 누적 + 보상 통합 (achievement 3종 + berserker 칭호)

- 콘텐츠: ach_streak_5/10/20 (BALANCE.KILL_STREAK_TIERS 정렬) + 신규 칭호 'berserker'(광전사) cond `maxKillStreak >= 20` ATK+3 · CRIT+2%.
- 시스템: INITIAL_STATE.player.stats.maxKillStreak = 0. combatVictory에서 매 처치 후 max(prev, newStreak) 누적. gameUtils 핸들러 2개 추가.
- 디자인 의도: 휘발성 killStreak를 영구 보상으로 연결.

검증: tsc 0 / unit 671 / lint clean.

## Cycle 94 — 퀘스트 진행도 latch (윈도우 기반 카운터 회귀 방지)

- 시스템: syncQuestProgress의 모든 stat-based 분기에 `Math.max(quest.progress, computed)` latch 헬퍼 적용.
- 영향: survive_low_hp가 stats.recentBattles(50개 윈도우)를 읽어 옛 저-HP 승리가 윈도우 밖으로 밀려날 때 progress 회귀 → 청구 영구 차단되던 회귀 수정. 단조 카운터에는 무해.

검증: tsc 0 / unit 663 / lint clean.

## Cycle 90-93 — 데드코드 정리 4 사이클 (~1649 lines)

- cycle 90: OnboardingGuide 컴포넌트 + 관련 state plumbing(action / handler / Firebase save / migrate) 8개 파일 정리.
- cycle 91: EquipmentSpriteGlyph(941L) + DashboardPanels(332L) — 단일 사이클 최대 cleanup.
- cycle 92: AdminDashboard / analyticsService / animationConfig (~280L).
- cycle 93: utils 단위 dead exports 4종 — IMAGEGEN_OVERLAY_KEYS / getEquipmentOverlayAssetKey / getOutfitAffinityTone / getMaterialShop (~80L).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 89 — 도주 스킬(escape_100) 코드 패스를 escape feedback chain에 합류

- 시스템: combatAttack의 forceEscape 분기가 cycle 74-88에서 쌓아온 stats.escapes 증분 / recentBattles record / escape 사운드 큐를 모두 누락. '공허의 문'(시간술사) / '순간 이동'(차원술사) 사용자가 보상 체인의 1급 시민이 아니던 회귀 수정.

검증: tsc 0 / unit 634 / lint clean.

## Cycle 88 — 도주 성공 사운드 큐 (escape feedback chain 마지막 sensory cue)

- 시스템: SoundManager case 'escape' (1100→600Hz 하강 sine 0.18s). combatAttack 도주 성공 분기에서 직접 호출.
- 디자인 의도: victory 5음 상승의 정반대인 retreat tone — error의 sawtooth와 달리 부드러운 sine으로 안도감.
- 결과: escape feedback chain 9 surface 완성.

검증: tsc 0 / unit 629 / lint clean.

## Cycle 87 — RunSummary focus advice에 escape/discovery 시그널 통합

- 시스템: getRunSummaryAnalysis focus advice 3종(silence-over-noise) — `escapes>=10 && bossKills<=1` 빌드 강화 권장, `discoveries<=4 && level>=12` 탐험 권장, `discoveries>=15` 탐험 칭찬.

검증: tsc 0 / unit 625 / lint clean.

## Cycle 86 — RunSummaryCard에 도주/지도 발견 시각 reflection

- UX: 신규 mini-section run-summary-extras(signatures highlight cycle 18 패턴). 도주 chip(Footprints sky-300) + 지도 발견 chip(Compass emerald-300). 둘 다 0이면 silent.

검증: tsc 0 / unit 620 / lint clean.

## Cycle 85 — 연금술사(alchemist) 칭호 + synths cond.type 핸들러

- 콘텐츠: title `alchemist`(연금술사) cond `synths >= 20` MP+15 · ATK+1. crafter(장인)와 짝을 이루는 제작 계열 보상 라인.
- 시스템: gameUtils.checkTitles에 `type === 'synths'` 분기 추가.

검증: tsc 0 / unit 615 / lint clean.

## Cycle 84 — discoveries dead write 정리 + RunSummary/share 맵 발견 라인

- 정리: cycle 83 시맨틱 통일 후속 — _shared.ts의 stats.discoveries 누적(이제 dead write) 제거, INITIAL_STATE.discoveries 선언 제거.
- UX: buildRunSummary discoveries 필드, buildRunShareText "🗺️ 지도 발견 N곳" silence-over-noise.

검증: tsc 0 / unit 610 / lint clean.

## Cycle 83 — 'discoveries' 시맨틱 통일 (visitedMaps.length 기준)

- 시스템: questProgress / checkTitles / StatsPanel이 stats.discoveries(이벤트 카운터)를 잘못 읽던 회귀 수정. 모두 visitedMaps.length로 통일 — achievement(이미 visitedMaps 사용)와 정합.
- 영향: cartographer("지도 제작자") 칭호가 10번의 이벤트만으로 풀리고 quest 201("15곳 발견")이 의도보다 훨씬 빨리 진행되던 부풀림 fix.

검증: tsc 0 / unit 603 / lint clean.

## Cycle 82 — StatsPanel CRAFTS / SYNTHESES 노출 + syntheses 선언적 일관성

- UX: StatsPanel CRAFTS row(Hammer orange-300) + SYNTHESES row(FlaskConical amber-300).
- 시스템: INITIAL_STATE.player.stats.syntheses = 0 default — crafts는 있었으나 syntheses 누락 갭 정리.

검증: tsc 0 / unit 599 / lint clean.

## Cycle 81 — 모바일 smoke testid 회귀 (archive-tab-* primary tabs)

- 인프라: scripts/smoke-gameplay.mjs verifyMobileArchiveConsole이 primary tabs(equipment/stats)에 dashboard-tab-* 잘못 매칭하던 회귀 수정. cycle 73 verify:full 통합 스크립트로 모바일 모드까지 돌리며 발견.

검증: tsc 0 / unit 595 / lint clean.

## Cycle 80 — StatsPanel ESCAPES 통계 라인 + sky 톤 일관성

- UX: StatsPanel ESCAPES row(Footprints sky-300) — cycle 74-78 도주 카운터를 stats panel에도 노출.

검증: tsc 0 / unit 594 / lint clean.

## Cycle 79 — AchievementPanel THEME_BY_TARGET 14종 시각 톤 추가

- UX: AchievementPanel에 escapes/explores/discoveries/relicCount/crafts/rests/bountiesCompleted/abyssRecord/abyssFloor/demonKingSlain/prestige/signaturesDiscovered/signatureSetsCompleted/synths 14종 테마 추가.

검증: tsc 0 / unit 593 / lint clean.

## Cycle 78 — RunSummary + RunShareText에 도주 카운트 reflection

- UX: buildRunSummary에 escapes 필드, buildRunShareText에 "🏃 도주 N회 — 위험 회피 운영" silence-over-noise.

검증: tsc 0 / unit 593 / lint clean.

## Cycle 77 — 도주/생존 칭호 2종 + escapes cond.type

- 콘텐츠: 신규 칭호 2종 (`cautious_explorer` HP+20·DEF+1 / `survivor_instinct` HP+40·DEF+2·MP+10).
- 시스템: `gameUtils.checkTitles`에 `type === 'escapes'` 분기 추가.
- 디자인 의도: ironman(공격적 무사망)과 짝을 이루는 보수적 위험 회피 운영 축.

검증: tsc 0 / unit 592 / lint clean.

## Cycle 76 — escape_count 퀘스트 2종 + questProgress 핸들러

- 콘텐츠: 신규 퀘스트 2종 (id 203 「신중한 모험」 escapes 5 Lv5+ / id 204 「생존의 기술」 escapes 20 Lv15+ + 엘릭서).
- 시스템: `questProgress`에 `type === 'escape_count' && target === 'escapes'` 분기 추가.
- 결과: 도주 카운터가 ACHIEVEMENTS(74)+QUESTS(76)+TITLES(77) 3 시스템에서 1급 시민이 됨.

검증: tsc 0 / unit 589 / lint clean.

## Cycle 75 — signaturesDiscovered 카운트 정확도 (codex 합 → REGISTRY 교집합)

- 시스템: `checkTitles`의 `signaturesDiscovered` 분기와 `questProgress`의 `signature_collect` 분기가 모두 codex 합집합 크기로 근사하던 것을 `countDiscoveredSignatures(player)` 정확 카운트로 교체.
- 영향: cycle 61의 `legend_seeker` (5종) / `legend_chronicler` (15종) 칭호와 cycle 63의 quest 202가 의도보다 일찍 풀리던 부풀림 회귀 수정.
- 테스트 갱신: 실제 SIGNATURE_REGISTRY 등록 이름(성검 에테르니아 / 마왕의 대낫 / 라그나로크 등)으로 픽스처 교체.

검증: tsc 0 / unit 587 / lint clean.

## Cycle 74 — stats.escapes 카운터 + 도주 성공 achievement 3종

- 시스템: 도주 성공 시 `stats.escapes += 1` 누적 (기존엔 recentBattles 50개 윈도우에만 푸시되어 윈도우 밖에서 사라짐).
- INITIAL_STATE.player.stats.escapes = 0 default 추가.
- 콘텐츠: ACHIEVEMENTS 3종 (`ach_escape_5/20/50` — 신중한 모험가 / 생존의 본능 / 회피의 달인).

검증: tsc 0 / unit 587 / lint clean.

## Cycle 73 — verify:full 통합 + Playwright dynamic baseURL

- 인프라: `npm run verify:full` 신규 (verify 통과 → preview 자동 기동 → smoke desktop+mobile + e2e). `local-playtest.sh` `AETHERIA_RUN_E2E=1` 옵트인 추가.
- 인프라: `playwright.config.ts` baseURL이 `process.env.PLAYWRIGHT_BASE_URL` 우선 (동적 포트 fallback 호환).
- 문서: AGENTS.md "통합 검증" 섹션 추가.

## Cycle 72 — TS/TSX 파일 lint coverage 갭 메우기

- 시스템: cycle 58 TS 마이그레이션 이후 src/는 `.ts/.tsx`만 남았으나 eslint config가 `.js/.jsx`만 매칭하던 인프라 갭 발견. `typescript-eslint` 8.x 도입 + `src/**/*.{ts,tsx}` lint block 신설.
- 코드 위생 자동 수정: `prefer-const` 2건 (exploreUtils / gameUtils).
- 추가 정리 (phase 2): SmartInventory의 `[(player.inv || [])]` 의존성을 `[player.inv]`로 교체 (매 렌더 새 배열 생성 → useMemo 무력화 잠재 회귀 4 사이트 수정). GameRoot retroactive title useEffect는 narrowed deps 의도된 패턴으로 명시.
- react-hooks 7+ 신규 strict 규칙(`refs` / `set-state-in-effect`)은 testing harness 패턴 등 기존 의도된 코드와 충돌해 warning으로 완화.
- 결과: 0 errors / 4 warnings.

## Cycle 71 — hidden boss spawn 트리거 버그 수정

- 시스템: `exploreUtils.spawnEnemy`의 `hiddenBossChecks` 루프가 `mapData.name === loc`로 비교했으나, mapData는 DB.MAPS[player.loc]로 가져와지며 `.name` 필드가 설정된 적이 없어 항상 undefined. 결과: 시간의 파수꾼(시간술사 Lv40+ 공중 신전), 원한의 용사(last_hero 체인 3단계 + 지하 미궁), 공허의 군주(abyssFloor 100+ 금지된 도서관) 3종 hidden boss가 영원히 spawn되지 않던 잠재 회귀.
- 수정: `mapData.name === loc` → `player.loc === loc`. 회귀 가드 +3개 (스폰 / 직업 미달 / 위치 미달).

## Cycle 70 — Bestiary / MonsterCodex / Codex의 boss-only 누락 버그 수정

- 시스템: 3개 컴포넌트가 `map.monsters`만 보고 `map.boss` / `map.bossMonsters`는 무시 → boss-only 몬스터(예: 고대 호수의 수호신, 하수도의 여왕)가 도감 진행 % / 위치 표시에서 사라짐. `collectMapEncounters(map)` inline helper로 합집합. `boss: true/false` legendary 플래그는 string 필터에서 silently 제외.
- 회귀 가드: 모든 MAPS의 boss 타입 + 신성한 호수 boss 인식 +5개.

## Cycle 69 — signature drop 연결 + mapSignatureHints boss 필드 버그 수정

- 콘텐츠: 고대 호수의 수호신 드롭 풀에 `심해의 수호복` rate 0.03 추가 (심연 크라켄 Lv50+ 0.06이 주 경로, mid-game 보조 경로 노출). cycle 11-29 anticipate→drop 체인을 mid-game에서도 재현.
- 시스템: `mapSignatureHints.buildMapIndex`가 `map.monsters`만 보고 `map.boss/bossMonsters`는 무시하던 버그 수정. MapNavigator의 ✦N 칩과 미발견 안내가 정확해짐.

## Cycle 68 — 신규 mid-game 보스 "고대 호수의 수호신" 완전 통합

- 콘텐츠: 신성한 호수(Lv7) mid-game 보스 신규. 5개 데이터 소스 일괄 등록 — MONSTERS(isBoss + phase2 빙결) / BOSS_BRIEFS 7개 키 / BOSS_MONSTERS 자동 derive / MAPS.boss 필드 / DROP_TABLES (5개 드롭).
- 진행 곡선: 기존 mid-game 보스(하수도의 여왕 Lv10, 전초기지 사령관 Lv18) 사이의 Lv7 구간 첫 보스 경험 제공.

검증: tsc 0 / unit 570 / smoke 통과.

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
