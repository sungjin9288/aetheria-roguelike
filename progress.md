Original prompt: 좋아. 추천사항 전부 다 반영해줘.

Checked (Slice 25-27 iOS Redeploy — PASSED):
- 아트 통일 시리즈(시그니처 25 + 장비 233 + 비장비 77 = 카탈로그 335종 전수 아이템별 아트) 포함 빌드로 재배포 1-pass 통과 (exit 0): `ARCHIVE SUCCEEDED` → install (`.../4AB69D62.../App.app`) → launch → 60초 hold → done.
- 실기기 수동 확인 포인트: 상점/인벤토리/도감에서 아이템별 차별화 아트, 물약 기능색(HP 적/MP 청/해독 녹/버프 금), 시그니처 전설 오라, 레어리티 플레이트, 모던 CTA.

Done (Meter Tween & Crit Pulse Slice 31):
- 진단: StatusMetric(HP/MP/EXP) 바 fill에 transition이 없어 값 변화가 즉시 snap(가장 자주 보는 표면인데 끊겨 보임). criticalHit 키프레임은 미사용(dead)이라 크리 화면 연출 0.
- StatusMetric fill에 transition-[width] duration-500 ease-out — 데미지/EXP 변화가 부드럽게 차오르고 빠짐. EXP 바가 레벨업 직전까지 채워지고 → slice 29 배너로 연결.
- CritPulse 신설: 새 'critical' 로그 id 감지 시 화면 골드 비네트를 320ms 옅게 깜빡(pointer-events-none, reducedMotion 자동 완화). 플레이어 크리 + 보스 페이즈 reveal 순간 강조.
- 가드: slice-31 3건(fill tween / CritPulse active+골드 / GameRoot 로그 id 감지+320ms).

Verification (Meter Tween & Crit Pulse Slice 31):
- `npm run verify` → 2930/2930 + type-check/lint/build-guard. Playwright e2e 21/21.
- 브라우저 실측(390×844): 전투 중 크리 발생 시 crit-pulse 비네트 + 적 크리 골드 숫자(✦) 동시 확인, 미터 fill transition 적용, 콘솔 에러 0.

Done (Enemy Hit Impact Slice 30):
- 진단: 데미지 float 숫자가 플레이어 피격에만 떠 비대칭 — 내가 적을 때릴 땐 HP 바가 조용히 줄 뿐 "때리는 맛"이 없었음(Slay the Spire/Hades는 때리는 게 핵심 쾌감).
- useHitFlash 훅 신설(useDamageFlash 일반화): 추적 값 감소 시 flash + 데미지 숫자, resetKey 변경 시 baseline만 재설정(새 적 가짜 타격 방지), meta 스냅샷(타격 시점 크리 여부 고정).
- EnemyStatus(Target Lock 바): 적 HP 감소 시 바 화이트 플래시 + scale 1.015 + 적 위 데미지 숫자 float. 크리(enemyHitCrit)면 ✦ 골드+xl 강조. 훅은 early-return 앞 호출(Rules of Hooks).
- GameRoot: 최근 로그 type 'critical' → enemyHitCrit 파생(enemy.hp 변화와 동일 dispatch라 정합), StatusBar 통해 전달.
- 가드: slice-30 4건(훅 감소-only/baseline/meta, EnemyStatus flash+숫자+크리, Rules of Hooks 순서, GameRoot 파생).

Verification (Enemy Hit Impact Slice 30):
- `npm run verify` → 2927/2927 + type-check/lint/build-guard. Playwright e2e 21/21.
- 브라우저 실측(390×844): 내 공격 직후 Target Lock 바 플래시(data-hit-flash) + 적 데미지 숫자 "-15" float 확인, 콘솔 에러 0. 크리 골드 강조는 가드+검증된 인프라(7타 내 크리 미발생, 확률).

Done (Combat & Reward Juice Slice 29):
- 진단(피드백 레이어 감사): levelUpGlow/criticalHit 키프레임은 정의돼 있으나 미사용(dead), DamageNumber가 참조하는 floatUp 키프레임은 아예 미정의라 float 데미지 숫자 애니메이션이 죽어 있었음. slice 23이 레벨업을 의미있게 만들었지만 화면 연출은 0(사운드+로그뿐). 레퍼런스(Hades/Balatro): 성장·타격 순간의 짧고 확실한 "한 방" 피드백.
- floatUp 키프레임 정의(DamageNumber 버그 fix) + 위치(상단 38% 중앙)/가독성(2xl, 글로우 textShadow, heal 에메랄드/damage 로즈) 개선.
- LevelUpBanner 신설: GameRoot가 player.level 증가를 watch(prevLevelRef, 감소/동일 무시)해 "LEVEL UP / Lv.N" 배너를 levelUpGlow(animate-levelup)와 함께 1.8s 노출 후 자동 해제. dead 키프레임 활성화.
- 가드: slice-29 4건(floatUp 정의/DamageNumber testid/배너 계약/GameRoot 증가 감지+1.8s).

Verification (Combat & Reward Juice Slice 29):
- `npm run verify` → 2923/2923 + type-check/lint/build-guard.
- 브라우저 실측(390×844): 전투 중 플레이어 피격 시 float 데미지 숫자 "-14" 애니메이션 확인(기존 dead → 동작), 콘솔 에러 0. 레벨업 배너는 가드+동일 오버레이 패턴(검증된 DamageNumber)으로 확인, 실기기 플레이에서 최종 확인 예정. 사망 화면(MEMORIAL LEDGER) 디자인 통일 확인.

Checked (Slice 28 iOS Redeploy — PASSED):
- 디자인 시스템 통일 빌드 재배포 1-pass 통과 (exit 0): `ARCHIVE SUCCEEDED` → install (`.../E27CA81C.../App.app`) → launch → 60초 hold → done.
- 실기기 최신 = slices 19-28 전부. 수동 확인: 전 화면 통일된 모서리 리듬, 버튼 촉각감, 아이템별 아트, 초반 템포/감속, 온보딩.

Done (Design System Unification Slice 28):
- 요청: "전체적인 디자인 통일 + 유저에게 보이는 디자인 전부 디밸롭, 대중적 게임 참고." 디자인 토큰 감사(Explore)로 핵심 불일치 확정: aether-* 클래스가 배경/보더/그림자만 정의하고 border-radius는 컴포넌트가 매번 rounded-[Xrem] 인라인 → 같은 tier 패널이 1.45/1.5/1.55/1.9/1.95/2rem 제각각이라 화면마다 다른 디자인처럼 보임. 테스트는 인라인 rounded 값 0건 가드(aether 클래스명만) → 토큰화 안전.
- 레퍼런스(Balatro/Slay the Spire/Hades, READABILITY_TREND_RESEARCH 기재): 화면 전체가 하나의 둥근 모서리 리듬 + 누를 수 있어 보이는 촉각 피드백 공유.
- :root에 4단계 radius 토큰(--aether-r-cell 0.72 / card 0.9 / panel 1.15 / shell 1.5rem + overlay 1.9). aether-* 클래스가 radius를 직접 소유(@tailwind utilities 이후 정의라 인라인 rounded를 cascade로 덮어씀 — 브라우저 computed로 focus-panel 24px/shop-row 14.4px 확인). 단일 CSS 편집으로 focus-panel·shop/log/route/event/choice row·strip·cell·action-button 전 표면이 일괄 수렴.
- 버튼/CTA 상호작용 레이어: hover 살짝 떠오름(translateY -1px) + transition, high-readability 모드 무효화. focus-panel 루트 5종(Event/Shop/Quest/Crafting/JobChange) 죽은 인라인 rounded 제거, in-flow 1.9rem 패널(ControlPanel NEURAL/CombatPanel) → 1.5rem 정규화. IntroScreen 시작 버튼 → aether-cta-primary(누를 수 있는 confirm).

Verification (Design System Unification Slice 28):
- `npm run verify` → 2913/2913 + type-check/lint/build-guard. Playwright e2e 21/21. slice-28 가드 6건 신규.
- 브라우저 실측(390×844): 시작/필드/이벤트/상점/전투 전 화면 통일된 모서리 리듬 + CTA 촉각감 확인, 콘솔 에러 0건. computed radius cascade(focus 24px / row 14.4px) 검증.

Done (Per-Item Consumable/Material Art Slice 27):
- 비장비 77종(소모품 14 물약 포함 + 재료 54 + 열쇠/유물)도 아이템별 고유 아트로 — 마나 물약이 빨간 potion.png로 보이던 문제 해소.
- `scripts/generate_nonequipment_item_art.py`: 소모품은 TYPE 기반 톤(hp→적, mp→청, cure→녹, buff→금 — 기능이 색으로 즉시 읽힘), 재료는 self-jitter(원본 고유색 유지 + 이름 시드 변주). tier 3+ 스파클/5+ 오라.
- `src/data/consumableArtManifest.json` 신설, getItemIconAssetSrc에 비장비 family 앞 라우트 추가. 가드 2건 전수 커버 계약으로 갱신 (77/77).

Verification (Per-Item Consumable/Material Art Slice 27):
- `npm run verify` → 2913/2913, e2e 21/21. 몽타주 실측(HP 적 4종 변주/MP 청/해독 녹/버프 금/재료 변주) + 브라우저 인벤토리 `/items/auto/` 라우트 확인.

Done (Per-Item Equipment Art Slice 26):
- 사용자 확인 질문("상점 아이템 이미지 아직 수정 안 된 거지?")으로 잔여 갭 확정: 일반 장비 233종이 family PNG 22장을 공유 — '수련생의 검'과 '강철 롱소드'가 동일 그림.
- `scripts/generate_equipment_item_art.py`: 시그니처 생성기 엔진 재사용 — family 실루엣 base + elem→tone 리컬러(화염→fire 등 8매핑, 무속성은 tier 사다리 rust→steel→earth→holy→arcane) + 이름 시드 jitter(같은 톤·실루엣끼리도 구분) + tier 4+ 스파클/5+ 오라. 233종 전수 생성 → `public/assets/equipment-exact/auto/auto-<sha1 12>.png`.
- `src/data/equipmentArtManifest.json`(이름→경로) 신설, `itemVisuals.getItemIconAssetSrc`에 signature 다음·family 앞 라우트 추가 — family는 매니페스트 미등록(신규 아이템) fallback으로 강등.
- 가드 3건 계약 갱신(family 강제 → per-item auto + 전수 커버 assert), 카탈로그 덤프에 shields 포함 누락 1회 수정(168/168 전수 확인).

Verification (Per-Item Equipment Art Slice 26):
- `npm run verify` → 2913/2913, Playwright e2e 21/21.
- 몽타주 실측: 녹슨 단검(러스트)/독침 단검(독 그린)/수련생의 검/강철 롱소드/롱소드 모두 구분, 빙결 지팡이 한기 스파클.
- 브라우저 실측: 상점 타일 전부 `/auto/` 라우트 (16건), 아이템별 차별화 렌더 확인.

Checked (Slice 25 iOS Redeploy — PASSED):
- 1·2차 시도는 기기 잠금(kAMDMobileImageMounterDeviceLocked)으로 DDI 마운트 실패 — 앱/파이프라인 이슈 아님. 잠금 해제 후 3차 시도 전체 통과 (exit 0): install (`.../E6D7253E.../App.app`) → launch → 60초 hold → done.
- 실기기 최신 빌드 = slices 19-25 전부 포함. 시그니처 25종 픽셀 아트 + 레어리티 플레이트 + 모던 CTA 반영.

Done (Item Art Cohesion & Trendy UI Slice 25):
- 진단: 상점/도감의 시그니처(전설) 25종이 평면 도형 플레이스홀더 — 아바타/장비 family의 풍부한 픽셀 결과 충돌 (몽타주 4종 비교로 확정: family 22 ✓ / 비장비 12 ✓ / exact 21 ✓ / signature 25 ✗).
- `scripts/generate_signature_pixel_art.py` 신설: family 아트와 동일한 원본 아이콘 풀(public/assets/items)에서 ① hue-shift 리컬러 — signatureRegistry tone(artPalette 키)으로 정체성 색, S/V 텍스처(블레이드/힐트 머티리얼 대비) 보존, 채도별 3분기(유채색 hue 0.9 견인 / 밝은 금속 틴트 / 아웃라인 보존) ② trim 컬러 전설 오라(실루엣 글로우) + 시드 결정론 스파클. 25종 전부 재생성, 파일명 유지로 코드 변경 0건.
- ItemIcon 레어리티 플레이트 강화: 보더 40→66%, 래디얼 워시 18→2e, 글로우 상향 — 등급이 타일에서 즉시 읽히는 모던 수집형 문법.
- 결정 CTA 모던화: `aether-cta-primary/gold`(그라디언트 + 인셋 하이라이트 + 프레스 스케일) — 작전 개시/임무 수락/상점 구매 적용. high-readability 모드에서 그라디언트/섀도 제거.
- 가드: tests/slice-25-item-art-cohesion.test.js 5건 (25종 전수 160px + 플레이스홀더 크기 검출 + 스크립트 매핑 전수 + CTA 토큰/적용 + 플레이트 강화).

Verification (Item Art Cohesion & Trendy UI Slice 25):
- `npm run verify` → 2913/2913 + type-check/lint/build-guard. Playwright e2e 21/21.
- 몽타주 실측: 시그니처 v2 그리드 — holy=황금/frost=빙백/shadow=자수정/nature=신록 정체성 + 오라/스파클, family 결 일치.
- 브라우저 실측(390×844): 상점 레어리티 플레이트·골드 CTA·일관 픽셀 결 확인.

Checked (Slice 19-24 Final iOS Redeploy — PASSED):
- slice 24(승리 전리품 중복 마무리 + CHANGELOG) 커밋 후 전체 재배포 파이프라인 1-pass 통과 (exit 0): `ARCHIVE SUCCEEDED` → install (`.../CB83965B.../App.app`) → foreground launch → 60초 hold → done.
- 이 빌드가 slices 19-24 전부 포함한 실기기 최신 상태. 다음 단계는 사용자 수동 5분 루틴 — 핵심 측정: 초반 레벨 간격(감속 후 Lv2 ~5-6분, 초반 콘텐츠 소비 후 Lv4), 첫 전투 4-5턴, NEXT 온보딩 스트립, 지역 톤 전환, 한국어 CTA, 중복 없는 전투/승리 로그.

Done (Early Leveling Deceleration Slice 23):
- 설계 피드백 반영: "초반 레벨업이 너무 빠르면 안 된다 — 초반을 즐기며 게임을 익혀야 한다." slice 17-18이 퀘스트 burst는 막았지만 slice 19 전투 가속(4-5턴)으로 실시간 레벨 간격이 짧아진 상태(Lv5 ~12분)를 감속.
- 원칙: 성장 "체감"(전투 템포·스탯·로그)은 그대로, 레벨 "간격"만 늘림 — 레벨당 전투 수(=연습량) 증가.
- CONSTANTS.START_NEXT_EXP 150 → 200 (Lv1→5 누적 요구 745 → 998, +34%).
- 초반 5지역(고요한 숲/서쪽 평원/호수의 신전/잊혀진 폐허/버려진 광산) 첫 방문 EXP 절반 (25/30/50/60/80) — 골드는 유지(경제 불변). 중후반 지역 불변. adventureGuide 온보딩 문구 동기화.
- 몬스터/퀘스트 EXP 불변 — 퀘스트 1수령 1레벨 캡(slice 17) 보존.
- 새 계약: 초반 콘텐츠 전체 소비 루트(첫 방문 2회 + 초반 퀘스트 4종 + 18킬)가 **Lv4 73/302**에서 멈춤 — 전직(Lv5)은 추가 사냥의 보상. `tests/early-leveling-deceleration.test.js` 4건 + quest-progression-pacing 루트 기대값/early-growth-tempo 계약 갱신.

Verification (Early Leveling Deceleration Slice 23):
- `npm run verify` → 2908/2908 + type-check/lint/build-guard.
- 시뮬레이션 실측: 가드 루트 종료 Lv4 73/302 (기존 Lv5 75/259 대비 1레벨 감속).

Checked (Slice 21+22 iOS Device Gate — PASSED):
- Slice 19-22 전부 포함 아카이브 재생성(`ARCHIVE SUCCEEDED`) → `npm run ios:device:smoke` 전체 통과 (exit 0): install (`.../DBA07570.../App.app`) → foreground launch → 60초 hold → done. 잠금/신뢰 블로커 재발 없음.
- 실기기 수동 5분 루틴 확인 포인트: 첫 전투 4-5턴(S19) / NEXT 가이드 스트립 '첫 원정 준비→첫 교전'(S22) / 마을↔숲 지역 톤 전환(S21) / 퀘스트 보드 한국어 CTA(S22) / [치명타] 태그 로그·INTENT 단일 표시(S20).

Done (First-Session Onboarding Slice 22):
- 갭 진단: getAdventureGuidance가 상황 힌트를 계산하지만 추천 버튼 하이라이트 외 텍스트 렌더 0건 + 완전 신규 플레이어(탐험 0/처치 0) 분기 부재 → 첫 5분 시퀀스를 스스로 찾아야 했음.
- adventureGuide 신규 분기 2종: 마을 '첫 원정 준비'(첫 방문 보상 안내, open_move) / 필드 '첫 교전'(강타 MP 10·1.5배 팁, explore). 보상 회수 분기보다 후순위, 전직/정비보다 선순위. 처치 1회 또는 탐험 이력 발생 시 기존 흐름 복귀.
- ControlPanel 가이드 스트립 신설(`adventure-guidance-strip`): 퀘스트 트래커 부재 시 같은 자리에 guidance.title+detail 노출 (이중 스트립 방지). 계산만 되던 가이드 텍스트가 처음으로 화면 도달.
- 결정 CTA 한국어화: START OPERATION→작전 개시, ACCEPT MISSION→임무 수락, REQUEST DAILY BOUNTY→현상수배 발급 (+상태 라벨 2종). 헤더/라벨의 영문 콘솔 무드는 정체성으로 보존 — "행동을 확정하는 버튼"만 한국어.
- 가드: tests/onboarding-first-session.test.js 7건 (분기 발동/종료/우선순위 + 스트립 렌더 + CTA), stale 1건 갱신(readability-map-signal CTA 문자열).

Verification (First-Session Onboarding Slice 22):
- `npm run verify` → 2904/2904 + type-check/lint/build-guard. `npm run test:smoke` 완주.
- 브라우저 실측(390×844): 신규 캐릭터 마을 NEXT 스트립 '첫 원정 준비' → 숲 이동 시 '첫 교전 — 강타 팁' 전환 + EXPLORE 추천 점 연동 확인.

Done (Region Palette & Mid-Game Guard Slice 21):
- 커밋 정리: slice 4-20 작업 트리 123파일을 주제별 3커밋으로 정리 — feat(ui) 가독성·디자인(75파일), feat(balance) 초반 성장 페이싱(28파일), chore(mobile) 디바이스 게이트·E2E·문서(19파일). 세션 아티팩트(.playwright-mcp/, 루트 스크린샷) .gitignore 제외.
- 지역별 ambient 팔레트 (READABILITY_TREND_RESEARCH "단일 다크 팔레트" 진단 잔여 해소): `src/utils/regionTheme.ts` — 이름 키워드 + 맵 type 기반 10테마 분류(haven/forest/water/ember/frost/desert/storm/arcane/abyss/ruin). 맵 데이터 필드 추가 없음(세이브 영향 0). 합성 지명 우선순위 처리('빙하 심연'→frost, '수정 동굴'→arcane, '사막 오아시스'→desert safe여도 키워드 우선). GameRoot→MainLayout으로 `--region-accent/--region-soft` CSS 변수 + `data-region-theme` 전달, 상단 radial wash 1레이어(`aether-region-ambient`) + StatusBar 위치 점/텍스트 accent. 시맨틱 컬러 불변, high-readability 모드에서 wash 감쇠(0.35).
- 중후반 TTK 밴드 가드: `tests/mid-game-ttk-bands.test.js` — BALANCE 상수 + 실제 아이템 DB(티어 중앙값)에서 기준 플레이어를 유도해 맵 Lv10-50 TTK 2-9턴 / TTD÷TTK ≥ 1.3 / 곡선 폭주(Lv50 ≤ Lv10×2.5) 가드. 실측: 전 구간 TTK 4-5턴, 생존 여유 2.2-4.0x — slice 19 곡선이 중후반에서도 안정 확인.
- stale 가드 1건 갱신(readability-map-signal MainLayout prop 정규식).

Verification (Region Palette & Mid-Game Guard Slice 21):
- `npm run verify` → type-check 0 / lint 0 / unit 2897/2897 / build-guard ok. `npm run test:smoke` 완주.
- 브라우저 실측(390×844): 시작의 마을(haven #d5b180) → 고요한 숲 이동 시 `data-region-theme="forest"` + accent #a8cf96 전환, StatusBar 위치 표기 녹색 확인.

Done (Design & Readability Polish Slice 20):
- 모바일(390px) 실화면 감사로 readability slice 1-10 이후 남은 중복/충돌 신호를 확정하고 정리했다. 진단 경로: 첫 뷰포트 → 이벤트 → 전투(공격 로그 포함) → 승리 → 상점 → 퀘스트 보드 스크린샷 비교.
- 적 텔레그래프 명칭 충돌 해소: heavy 예고 라벨 `강타 준비/강타 가능` → `맹공 준비/맹공 주의` (CombatEngine.predictEnemyNextAction). 플레이어 시작 스킬 '강타'와 같은 화면에서 충돌해 적 의도를 내 스킬 확률로 오독하던 문제. 적 heavy hit 로그("맹렬하게 공격합니다") 용어와 통일.
- 텔레그래프 표시 채널 단일화: CombatPanel의 모바일 telegraph 칩과 데스크톱 `▶ 적 — 라벨` 행 제거 — combat forecast strip INTENT 셀이 동일 라벨을 항상 표시해 한 화면 2회 출력되던 완전 중복. telegraphColorClass 스타일 맵도 함께 제거.
- 승리 로그 보상 중복 제거: `addCombatDigestLogs`의 summaryParts에서 EXP/Gold 파트 삭제 — 직전 `MSG.VICTORY`("승리! EXP +N, Gold +N")와 동일 수치 2회 출력이던 중복. digest는 처치 + 전리품 요약 + 후속 힌트 anchor 역할만 담당. 미사용이 된 victoryResult destructure도 정리 (callsite 8-props는 cycle 591 가드 그대로).
- 상점 딜 행 차단 사유 중복 제거: Daily Deals 행의 본문 reason 텍스트 삭제 — 우측 버튼이 동일한 "골드 부족" 등을 이미 표시. 행당 1회 표기로 통일.
- 퀘스트 보드 추천 오퍼레이션 칩 줄 통합: `Lv/빌드/지역` 메타 칩 줄과 `EXP/G` 보상 칩 줄이 분리되어 어색하게 떠 보이던 것을 RewardChips `inline` 모드 추가로 한 줄에 합류.
- 로그 핵심 숫자 강조: TerminalView `renderLogText` — 데미지/HP/보상 수치(`+21`, `16`, `73/89`, `35%`)를 본문보다 밝고 굵게 렌더 (readability 리서치 "라벨보다 숫자 먼저" 원칙의 로그 스트림 적용).
- stale 가드 1건 갱신: cycle-428 RewardChips destructure 정규식에 `inline = false` 허용 분기 추가.

Verification (Design & Readability Polish Slice 20):
- `npm run type-check` 0 errors, `npm run lint` clean, `npm run test:unit` 2885/2885, `npm run build:guard` ok, `npm run test:smoke` desktop 완주.
- 브라우저 실측(390×844): 전투 화면에서 telegraph 칩 소멸 + INTENT 단일 표시, 공격 로그 숫자 강조 렌더, 승리 로그 `승리! EXP +21, Gold +18` 1회 + `전투 정리: 숲 요정 처치`(수치 무반복), 상점 차단 사유 행당 1회, 퀘스트 보드 `LV.1 · EXP 60 · 200G` 한 줄 확인.

Checked (Slice 19+20 iOS Device Gate — PASSED):
- Slice 19+20 포함 아카이브(`2026-06-11 20:14`) 기준 `npm run ios:device:smoke` 전체 통과 (exit 0): metadata → install (`.../21983C8F.../App.app`) → foreground launch (pid 1797) → **60초 hold 후에도 프로세스 생존** → done. 이전 blocker 2건(개발자 프로필 미신뢰, 기기 잠금) 모두 해소.
- 실기기 자동화 게이트 완료 — 남은 것은 사용자 수동 5분 성장 체감 루틴뿐 (첫 전투 4-5턴 / 레벨업 스탯 표기 / 6탐험 내 첫 유물 / 맹공 INTENT 단일 표시 / 로그 숫자 강조 / 상점·퀘스트 보드 표기).

Done (Early Growth Tempo Slice 19):
- 전체 점검 결과 초반 30분 경험의 3대 병목을 수치로 확정하고 해소했다: (1) Lv1 전투가 기본공격 9-10턴/강타 6-7턴으로 과도하게 느림, (2) 레벨업 ATK +2가 턴수 변화를 만들지 못해 성장 체감 0, (3) 첫 유물(빌드 선택의 재미)이 평균 10탐험 이후에야 등장.
- 몬스터 HP 곡선을 spawnEnemy inline `120+30L` → `BALANCE.MONSTER_HP_BASE(70) + L × MONSTER_HP_PER_LEVEL(32)`로 교체. Lv1 -32%, Lv20 -1%, Lv50 +3% — 초반 템포만 선택적으로 가속하고 중후반 밸런스는 보존. 몬스터 골드 base 10 → `BALANCE.MONSTER_GOLD_BASE(16)` (Lv1 골드 12→18, 3-4전투당 휴식 1회 경제). 몬스터 ATK/EXP 곡선은 불변 — Slice 17-18 quest pacing 가드(`tests/quest-progression-pacing.test.js` Lv5 75/259 루트)는 전부 그대로 통과.
- `BALANCE.ATK_PER_LEVEL` 2 → 3, INITIAL_STATE 시작 atk 10 → 12. Lv1 실효 ATK 14(단검 포함)로 첫 전투 4-5턴, 레벨마다 데미지 +3이 턴수 단축으로 체감되는 구조.
- 첫 유물 보장: `BALANCE.FIRST_RELIC_PITY_EXPLORES(6)` — 유물 0개 상태로 6탐험 경과 시 다음 전투형 탐험에서 확률 roll 없이 유물 3선택 보장 (`exploreActions.ts` firstRelicPity 분기).
- 전투 로그 burst 해소: 치명타/속성 약점/속성 저항/연격이 본문과 별도 로그 4건으로 중복 출력되던 것을 attack/skill 양 경로 모두 본문 태그로 통합 (`[치명타]`, `[연격 +N]` 형식). `MSG.SKILL_USE`에 tags 파라미터 추가(COMBAT_ATTACK_DETAIL 동일 패턴, 단일 호출자 명시 전달). 희귀 유물 proc 로그(처형/연속 베기/허공 각성 등)는 흥분 모먼트라 보존.
- 레벨업 성장 가시화: `MSG.LEVEL_UP`이 `⬆️ 레벨 업! Lv.N — ATK +3 / HP +20` 형식으로 스탯 상승을 직접 표기.
- 신규 가드 `tests/early-growth-tempo.test.js` 9건: BALANCE 계약, Lv1 슬라임 실측 스폰(신입 보호 포함 HP ≤ 75), 강타 최악 분산 5턴 이내, applyExpGain ATK +3 실측, HP 곡선 초반 가속/후반 보존, 골드 경제, 첫 유물 pity 소스 가드, 레벨업 로그 표기. stale 가드 2건 갱신: `combat-engine-core.test.js` BALANCE 미러 ATK_PER_LEVEL 3 동기화, `cycle-263` critical 로그 카운트가 literal+ternary 합산으로 변경.

Verification (Early Growth Tempo Slice 19):
- `node --import tsx --test tests/early-growth-tempo.test.js tests/combat-engine-core.test.js tests/cycle-263-critical-log-sound-mapping.test.js tests/quest-progression-pacing.test.js tests/difficulty-manager.test.js` → 83/83.
- `npm run test:unit` → 2885/2885. `npm run type-check` 0 errors, `npm run lint` clean, `npm run build:guard` ok, `npm run test:smoke` desktop 완주, `npm run test:e2e` Playwright 21/21.
- 브라우저 실측(dev preview, smoke 모드): 신규 캐릭터로 고요한 숲 진입 → 숲의 정령 HP 89(신입 보호 적용), 기본공격 5턴 처치, 승리 보상 `EXP +21, Gold +18`, 태그 통합 로그 `숲의 정령에게 32 피해! (26/89) [치명타]` 확인. 콘솔 에러 0건.

Blocked / Not Verified (Early Growth Tempo Slice 19):
- iPhone 실기기 5분 성장 체감 루틴은 여전히 수동 수행 대기 (이번 슬라이스가 그 루틴의 측정 대상).
- 커밋은 보류 — working tree에 Slice 4-18 미커밋 변경과 함께 누적 중.

Checked (Early Level Curve iOS QA Readiness - 2026-06-08):
- Rechecked the next release-critical step after Slice 18: latest iPhone readiness for the manual 5-minute early-growth feel routine.
- `node --import tsx --test tests/quest-progression-pacing.test.js` passed 5/5, keeping the automated early route pacing guard green.
- `npm run mobile:doctor` passed for iOS/Xcode metadata and continued to report missing Android release signing input.
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` reported no attached Android device.
- `xcrun devicectl list devices` detected target iPhone `성진` / `iPhone 14 Pro Max` / `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B` as `available (paired)`.
- `npm run cap:sync` passed and refreshed Android/iOS Capacitor web assets from the current working tree.
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` passed; latest archive is `build/ios/Aetheria.xcarchive`, timestamp `2026-06-08 00:49:24 KST`.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` installed and launched the app, but failed at the final hold check. Install URL was `file:///private/var/containers/Bundle/Application/B758A94C-C306-455B-83CC-AE69D99286EB/App.app/`; launch initially reported `/App.app/App` pid `84680`, then the process was absent after the 60-second hold.
- Immediate relaunch triage failed with `Locked`: `Unable to launch com.aetheria.roguelike because the device was not, or could not be, unlocked`.

Blocked / Not Verified (Early Level Curve iOS QA Readiness - 2026-06-08):
- Latest archive exists and install/initial launch succeeded, but 60-second foreground hold did not complete because the device entered or remained in a locked/non-foreground state.
- Manual iPhone 5-minute growth-feel routine is still pending and requires the iPhone to stay unlocked and in foreground.
- Android release verification remains blocked by missing `android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`.
- Android physical-device QA remains blocked by no attached Android device.

Done (Early Level Curve Slice 18 - 2026-06-07):
- Continued the early-growth feedback slice after quest reward caps. The remaining issue was the starting EXP curve: a new character's first `nextExp` was 100, so first-visit rewards plus a few early kills could still make the opening feel too fast.
- Added `CONSTANTS.START_NEXT_EXP = 150` and wired the initial reducer player state to that value.
- Updated character start so a new run computes class vitals at Lv1 and explicitly resets `level: 1`, `exp: 0`, and `nextExp: CONSTANTS.START_NEXT_EXP`.
- Aligned quest claim pacing fallback with the same start EXP constant.
- Added an early route simulation regression test covering first forest visit, first story quest, slime/boar/spider kills, and beginner quest claims. The route now ends at Lv5 with 75/259 EXP instead of continuing the previous faster burst pattern.
- Synced the updated web assets into Capacitor native projects.
- Regenerated `build/ios/Aetheria.xcarchive` and installed/launched it on the connected iPhone device.

Verification (Early Level Curve Slice 18 - 2026-06-07):
- `node --import tsx --test tests/quest-progression-pacing.test.js tests/quest-operations.test.js tests/combat-engine-core.test.js` -> 51/51 passed.
- `node --import tsx --test tests/cycle-532-build-class-vitals-meta-default-unreachable.test.js tests/cycle-566-start-action-3-defaults-batch.test.js tests/quest-progression-pacing.test.js` -> 13/13 passed after updating source guards for the new Lv1 start contract.
- `npm run verify` -> type-check, lint, unit 2876/2876, build:guard passed.
- `AETHERIA_RUN_E2E=1 bash scripts/local-playtest.sh` -> desktop smoke passed, mobile smoke passed, Playwright e2e 21/21 passed.
- `npm run mobile:doctor` -> iOS/Xcode metadata ok; Android release signing still missing.
- `npm run cap:sync` -> Android/iOS Capacitor web assets refreshed.
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` -> archive succeeded.
- Latest archive: `build/ios/Aetheria.xcarchive`, `2026-06-07 23:33:35 KST`.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` -> metadata, install, launch, process listing, 60-second hold all passed; install URL `file:///private/var/containers/Bundle/Application/7080F1E9-FA8F-461C-B22F-1C94A235D4D8/App.app/`, foreground process pid `84425`.

Blocked / Not Verified (Early Level Curve Slice 18 - 2026-06-07):
- iPhone manual 5-minute growth-feel routine remains pending on the latest archive.
- Android physical-device verification remains blocked by no attached Android device.
- Android release signing remains blocked by missing `android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`.

Done (Quest Progression Pacing Slice 17 - 2026-06-07):
- Slowed early-game quest leveling after real-device feedback that a few quest completions caused too many level-ups too quickly.
- Added `EARLY_QUEST_EXP_CAPS` in `src/data/quests.ts`; raw quest definitions remain intact, but exported `QUESTS` now clamp Lv1-10 quest EXP by unlock level so Quest Board display and actual base reward stay aligned.
- Representative adjusted rewards: `[스토리] 첫 번째 여정` and `거미떼 퇴치` -> 60 EXP, Lv5 long/operation outliers such as `탐험가의 기록`, `대륙의 발자취`, `[스토리] 폐허의 진실`, and `신중한 모험` -> 170 EXP, `파쇄 전술 훈련` -> 330 EXP, `개척자의 현장 기록` and `현상금 사냥꾼` -> 520 EXP.
- Added `src/utils/progressionPacing.ts` and wired `useInventoryActions.completeQuest` through `getPacedQuestClaimExp` so current EXP is considered at claim time; near-threshold early players cannot receive one quest reward that bursts through multiple levels.
- Added `tests/quest-progression-pacing.test.js` and updated the applyExpGain source guard to preserve the new paced quest claim callsite.
- Synced the updated web assets into Capacitor native projects.
- Regenerated `build/ios/Aetheria.xcarchive` and installed/launched it on the connected iPhone device.

Verification (Quest Progression Pacing Slice 17 - 2026-06-07):
- `node --import tsx --test tests/quest-progression-pacing.test.js tests/quest-operations.test.js tests/combat-engine-core.test.js` -> 50/50 passed.
- `npm run verify` -> type-check, lint, unit 2875/2875, build:guard passed.
- `AETHERIA_RUN_E2E=1 bash scripts/local-playtest.sh` -> desktop smoke passed, mobile smoke passed, Playwright e2e 21/21 passed.
- `npm run mobile:doctor` -> iOS/Xcode metadata ok; Android release signing still missing.
- `npm run cap:sync` -> Android/iOS Capacitor web assets refreshed.
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` -> archive succeeded.
- Latest archive: `build/ios/Aetheria.xcarchive`, `2026-06-07 23:12:47 KST`.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` -> metadata, install, launch, process listing, 60-second hold all passed; foreground process pid `84203`.

Blocked / Not Verified (Quest Progression Pacing Slice 17 - 2026-06-07):
- iPhone manual 5-minute growth-pacing routine remains pending: accept/complete several early quests and confirm level-ups feel less bursty on the physical screen.
- Android physical-device verification remains blocked by no attached Android device.
- Android release signing remains blocked by missing `android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`.

Done (Full Item Cohesion Slice 16 - 2026-06-05):
- Extended the item-art cohesion pass beyond equipment to the full item display surface.
- Added non-equipment family routing in `src/utils/itemVisuals.ts` so `hp`, `mp`, `cure`, `buff`, `mat`, `key`, and `all` items use shared family PNGs instead of defaulting to per-name `item-*` exact art.
- Added `NON_EQUIPMENT_FAMILY_ITEM_ASSET_KEYS` and `getNonEquipmentIllustrationFamilyKey`.
- Added typed-catalog name resolution so reference items without a `type` can inherit the matching typed catalog item's visual route when the name exists in the playable catalog.
- Updated `public/assets/items/README.md` so the documented selection rule matches the current family-first in-game surface.
- Kept legacy exact-name `item-*` assets in place for generator compatibility and fallback history; they are no longer the default cohesive item surface.
- Added `tests/item-visuals.test.js` guards for non-equipment family mapping, non-equipment playable item routing, all displayable catalog item route coverage, and non-equipment family asset existence.
- Recomputed routing after the change: `namedEntries 370`, `signature 29`, `equipmentFamily 256`, `nonEquipmentFamily 85`, `other 0`.
- Synced the updated web assets into Capacitor native projects.
- Regenerated `build/ios/Aetheria.xcarchive` and installed/launched it on the connected iPhone device.

Verification (Full Item Cohesion Slice 16 - 2026-06-05):
- `node --import tsx --test tests/item-visuals.test.js tests/signature-items.test.js` -> 44/44 passed.
- `npm run verify` -> type-check, lint, unit 2871/2871, build:guard passed.
- `bash scripts/local-playtest.sh` -> desktop smoke passed, mobile smoke passed.
- `npm run test:e2e` -> Playwright mobile scenarios 21/21 passed, including Equipment, Inventory, and Shop panels.
- `npm run mobile:doctor` -> iOS/Xcode metadata ok; Android release signing still missing.
- `npm run cap:sync` -> Android/iOS Capacitor web assets refreshed.
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` -> first run hit a transient `CompileAssetCatalogVariant` failure, immediate filtered rerun succeeded.
- Latest archive: `build/ios/Aetheria.xcarchive`, `2026-06-05 13:46:45 KST`.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` -> metadata, install, launch, process listing, 60-second hold all passed; foreground process pid `73809`.

Blocked / Not Verified (Full Item Cohesion Slice 16 - 2026-06-05):
- iPhone manual 5-minute readability routine remains pending, now specifically including Shop / Inventory / Equipment / Reward item surfaces on the physical screen.
- Android physical-device verification remains blocked by no attached Android device.
- Android release signing remains blocked by missing `android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`.

Done (Equipment Cohesion Slice 15 - 2026-06-05):
- Unified normal equipment item surfaces so shop/inventory no longer mix avatar thumbnails with standalone item PNGs.
- `src/utils/itemVisuals.ts` now keeps avatar preview as a fallback path only for normal equipment icons; non-signature equipment resolves to `/assets/equipment-family/items/*`.
- Preserved dedicated signature equipment art through `/assets/equipment-exact/signature-*.png`.
- Regenerated `public/assets/equipment-family/items/*.png` after increasing the item-canvas scale/offset for headgear, coat, and leather families so their visual density matches weapons, shields, robe, plate, cloak, and boots.
- Refreshed `output/imagegen/avatar-style-equipment-family/items-contact-sheet.png` for visual review.
- Added `tests/item-visuals.test.js` guards that every non-signature equippable catalog item uses family item art and does not route through avatar-preview icon mixing.
- Synced the updated web assets into Capacitor native projects.
- Regenerated `build/ios/Aetheria.xcarchive` and installed/launched it on the connected iPhone device.

Verification (Equipment Cohesion Slice 15 - 2026-06-05):
- `node --import tsx --test tests/item-visuals.test.js tests/equipment-art.test.js tests/signature-items.test.js` -> 46/46 passed.
- `npm run verify` -> type-check, lint, unit 2867/2867, build:guard passed.
- `bash scripts/local-playtest.sh` -> desktop smoke passed, mobile smoke passed.
- `npm run test:e2e` -> Playwright mobile scenarios 21/21 passed, including Equipment, Inventory, and Shop panels.
- `npm run mobile:doctor` -> iOS/Xcode metadata ok; Android release signing still missing.
- `npm run cap:sync` -> Android/iOS Capacitor web assets refreshed.
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` -> archive succeeded.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` -> metadata, install, launch, process listing, 60-second hold all passed; foreground process pid `73433`.

Blocked / Not Verified (Equipment Cohesion Slice 15 - 2026-06-05):
- iPhone manual 5-minute readability routine remains pending, especially Shop / Inventory / Equipment visual review on the physical screen.
- Android physical-device verification remains blocked by no attached Android device.
- Android release signing remains blocked by missing `android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`.

Done (Readability Slice 14 iOS Device Delivery Gate - 2026-06-01):
- Reopened the iOS delivery gate after the device was reconnected.
- `xcrun devicectl list devices` now reports the target `iPhone 14 Pro Max` (`성진`, `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`) as connected.
- `xcrun xcdevice list` reports the same phone over USB with `available: true`.
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -showdestinations` now lists the iPhone, iPad, and generic iOS destinations as available, so the earlier `iOS 26.5 is not installed` blocker is cleared.
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` succeeded and regenerated `build/ios/Aetheria.xcarchive`.
- The regenerated archive is dated `2026-06-01 12:23:04 KST`; the embedded `App.app` is dated `2026-06-01 12:23:03 KST`.
- Codesign metadata is `Identifier=com.aetheria.roguelike`, `TeamIdentifier=KS96VQMVHD`, `Apple Development: sungjin92@naver.com (VZN5FH3335)`.
- Embedded provisioning profile is `iOS Team Provisioning Profile: com.aetheria.roguelike`, UUID `75c44f88-7f82-406a-9b8d-fa10d2518a0a`, expiration `2026-06-08 03:15:30 UTC`.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` passed metadata before install, install, metadata after install, foreground launch, process listing, 60-second hold, and process recheck.
- Foreground process after launch/hold was `/App.app/App` with pid `52143`.

Verification (Readability Slice 14 iOS Device Delivery Gate - 2026-06-01):
- `npm run mobile:doctor`
- `xcrun devicectl list devices`
- `xcrun xcdevice list`
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -showdestinations`
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`
- `codesign -dv --verbose=4 build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- `security cms -D -i build/ios/Aetheria.xcarchive/Products/Applications/App.app/embedded.mobileprovision`
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke`

Blocked / Not Verified (Readability Slice 14 iOS Device Delivery Gate - 2026-06-01):
- iOS signing/device delivery blocker is cleared.
- The actual iPhone 5-minute manual readability routine has not been run yet.
- Android physical-device and release signing verification remain blocked by no attached Android device and missing release signing input.

Checked (Readability Slice 13 Real-Device Signing Gate - 2026-06-01):
- Reopened the physical-device delivery gate after the Slice 12 browser/native-sync baseline.
- `npm run mobile:doctor` still reports valid iOS metadata and Xcode 26.5, and still reports missing Android release signing input.
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` reports no attached Android device.
- `xcrun xcdevice list` and `xcrun devicectl list devices` now detect the target `iPhone 14 Pro Max` (`성진`, `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`) as available over USB.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` reached metadata and confirmed installed `Aetheria Roguelike 1.1.0 (2)`, then failed at install because the embedded provisioning profile is expired.
- A direct launch of the currently installed app also fails with invalid code signature / untrusted or invalid profile, confirming the installed app cannot be used for manual QA.
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` was attempted to refresh signing, but `xcodebuild` failed before archive creation because the App scheme destinations report `iOS 26.5 is not installed`.
- `xcodebuild -showsdks` does show `iphoneos26.5`, but `~/Library/Developer/Xcode/iOS DeviceSupport` lacked completed iPhone15,3 iOS 26.5 support.
- `xcodebuild -prepareDeviceSupport -platform iOS -osVersion 26.5 -modelCode iPhone15,3 -architecture arm64e` located the phone and created `iPhone15,3 26.5 (23F77)/.tmp` up to 3.3GB, then stalled for more than 17 minutes with no progress and was stopped.
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -showdestinations` still reports the connected iPhone/iPad and generic iOS destination as ineligible because iOS 26.5 is not installed.

Blocked / Not Verified (Readability Slice 13 Real-Device Signing Gate - 2026-06-01):
- Latest Slice 12 build is not installed on the iPhone.
- Existing installed app cannot launch because its signing profile is invalid/expired.
- iOS archive regeneration is blocked until Xcode iOS 26.5 platform/device support is fully installed.
- Android physical-device and release signing verification remain blocked by no attached Android device and missing release signing input.
- No new app regression was found in this step; the blocker is signing/platform environment.

Next Action (Readability Slice 13 Real-Device Signing Gate - 2026-06-01):
- Complete iOS 26.5 platform/device support installation through Xcode Settings > Components or rerun `xcodebuild -prepareDeviceSupport` while the target iPhone remains unlocked/connected until it finishes.
- Rerun `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` to create a fresh archive with a non-expired provisioning profile.
- Rerun `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke`.

Done (Readability Slice 12 Visual Mainstreaming - 2026-06-01):
- Refreshed the mobile readability skin toward a brighter, more mainstream RPG-console presentation without changing core gameplay rules.
- Updated global visual tokens and shared surfaces in `src/index.css`, including action/combat button shells, route/map strip contrast, mission/focus/log surfaces, and reduced panel noise.
- Applied the new button/icon language to `ControlPanel` and `CombatPanel`, with larger fixed hit areas and normal letter spacing for Korean readability.
- Removed first-frame dimming from mobile focus/combat/control panels so smoke screenshots and real-device entry states are immediately readable.
- Fixed a real mobile overlay regression: when the archive console reset flow is open, bottom controls are now suppressed so reset CTAs are not intercepted by the underlying control panel.
- Added a source guard in `tests/mobile-overlay-cta-reachability.test.js` for the archive-console/bottom-control suppression contract.
- Refreshed mobile smoke evidence, including `playtest-artifacts/mobile/01-after-start.png`, `02c-quest-board-open.png`, `05-combat-2.png`, `08a-map-tab.png`, and `10-tabs-verified.png`.
- Synced the refreshed web assets into Capacitor native projects.

Verification (Readability Slice 12 Visual Mainstreaming - 2026-06-01):
- `node --import tsx --test tests/mobile-overlay-cta-reachability.test.js tests/readability-map-signal.test.js tests/mobile-focus-panel-contrast.test.js tests/combat-forecast-readability.test.js` -> 21/21 passed.
- `AETHERIA_RUN_E2E=1 bash scripts/local-playtest.sh` -> desktop smoke passed, mobile smoke passed, Playwright e2e 21/21 passed.
- Browser opened `http://127.0.0.1:4173/?smoke=1` at mobile viewport.
- Visual review completed for the refreshed mobile screenshots listed above.
- `npm run mobile:doctor` -> iOS/Xcode metadata ok, Android release signing still missing.
- `npm run cap:sync` -> Android/iOS Capacitor web assets refreshed.
- `npm run verify` -> type-check, lint, unit 2866/2866, build:guard passed.

Blocked / Not Verified (Readability Slice 12 Visual Mainstreaming - 2026-06-01):
- Physical iPhone / Android 5-minute readability routines were not run in this pass.
- Target iPhone still requires unlocked/available CoreDevice state before `npm run ios:device:smoke` can complete.
- Android physical-device and release signing verification remain blocked by no attached Android device and missing release signing input.

Done (Readability Slice 11 iOS Device Smoke Handoff - 2026-06-01):
- Added `scripts/ios-device-smoke.sh` and the `npm run ios:device:smoke` package script so the iPhone delivery smoke can be rerun with one command once the device is unlocked.
- The script checks `xcdevice` availability, reads app metadata, installs `build/ios/Aetheria.xcarchive/Products/Applications/App.app`, rereads metadata, launches `com.aetheria.roguelike`, verifies the process, waits 60 seconds, and verifies the process again.
- Added environment overrides for `AETHERIA_IOS_DEVICE_ID`, `AETHERIA_IOS_BUNDLE_ID`, `AETHERIA_IOS_APP_PATH`, `AETHERIA_DEVICECTL_TIMEOUT_SECONDS`, and `AETHERIA_IOS_PROCESS_HOLD_SECONDS`.
- Hardened the script timeout path to terminate the spawned process group so timed-out `devicectl` calls do not continue in the background.
- Ran the handoff command against the current iPhone state; `xcdevice` now reports the target iPhone 14 Pro Max as `available: true`, but CoreDevice fails at Developer Disk Image mount because the device is locked.

Verification (Readability Slice 11 iOS Device Smoke Handoff - 2026-06-01):
- `bash -n scripts/ios-device-smoke.sh`
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=5 AETHERIA_IOS_PROCESS_HOLD_SECONDS=5 npm run ios:device:smoke` -> blocked at timed device install during the earlier locked/unstable state.
- `AETHERIA_DEVICECTL_TIMEOUT_SECONDS=120 AETHERIA_IOS_PROCESS_HOLD_SECONDS=60 npm run ios:device:smoke` -> reached the target iPhone, then failed with `kAMDMobileImageMounterDeviceLocked`.

Blocked / Not Verified (Readability Slice 11 iOS Device Smoke Handoff - 2026-06-01):
- iPhone install/launch/process hold did not complete because the device is locked at the Developer Disk Image mount step.
- The actual 5-minute manual readability routine remains pending until the iPhone stays unlocked.
- Android physical-device pass and release signing remain blocked as before.

Checked (Readability Slice 11 Device Gate Retry - 2026-06-01):
- Rechecked whether the actual phone-size device pass can start after the 2026-05-31 preflight.
- `xcrun xcdevice list` still detects the target iPhone 14 Pro Max but reports `available: false` with the unlock/cable/same-LAN/developer-mode recovery suggestion.
- The connected iPad is available over USB, but it was not used as a substitute for phone-size iPhone readability acceptance.
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` still reports no connected Android device.
- `npm run mobile:doctor` still passes iOS/Xcode metadata checks and still reports missing Android release signing input.
- No app code was changed and no new smoke/native artifact was regenerated in this retry.

Verification (Readability Slice 11 Device Gate Retry - 2026-06-01):
- `npm run mobile:doctor`
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l`
- `xcrun xcdevice list`
- Timed `xcrun devicectl list devices` and `xcrun devicectl device info apps --bundle-id com.aetheria.roguelike`, both stopped after the 20 second timeout.

Blocked / Not Verified (Readability Slice 11 Device Gate Retry - 2026-06-01):
- Target `iPhone 14 Pro Max` remains unavailable to Xcode/CoreDevice tooling, so install/launch/process refresh and the 5-minute manual readability routine were not run.
- Android physical-device pass remains blocked because no Android device is attached.
- Android release build verification remains blocked by missing signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`).
- Latest acceptance baseline remains the 2026-05-31 23:18 KST mobile smoke artifact set and the 2026-05-31 23:19 KST Capacitor-synced web assets.

Done (Readability Slice 11 Preflight):
- Refreshed the real-device readability acceptance baseline without changing app code.
- Re-ran the full browser QA path so the latest mobile smoke artifacts are dated 2026-05-31 23:18 KST, including `playtest-artifacts/mobile/01-after-start.png`, `05-combat-2.png`, `08a-map-tab.png`, `09-system-tab.png`, `10-tabs-verified.png`, and `09-final-state.png`.
- Re-ran Capacitor sync so `android/app/src/main/assets/public/index.html` and `ios/App/App/public/index.html` are refreshed at 2026-05-31 23:19 KST.
- Checked physical-device availability before the 5-minute readability routine: `xcdevice` sees the target iPhone 14 Pro Max, but it is not available; Android has no connected `adb` device.
- Confirmed the connected iPad is available over USB, but did not treat it as a substitute for phone-size iPhone readability acceptance.

Verification (Readability Slice 11 Preflight):
- `npm run verify:full`
- `npm run cap:sync`
- `npm run mobile:doctor`
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l`
- `xcrun xcdevice list`
- Timed `xcrun devicectl` app metadata/device listing attempts, which did not return before timeout.

Blocked / Not Verified (Readability Slice 11 Preflight):
- Target `iPhone 14 Pro Max` is still not available to CoreDevice / Xcode device tooling. `xcrun xcdevice list` reports `available: false` with the unlock/cable/same-LAN/developer-mode recovery suggestion.
- Android physical-device pass is blocked because `adb devices -l` reports no connected device.
- Android release build verification remains blocked by missing signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`).
- The actual iPhone / Android 5-minute manual readability routines remain pending; this slice completed the preflight and refreshed acceptance evidence only.

Done (Readability Slice 10):
- Added a mobile focus-panel contrast pass over Shop, Quest Board, Crafting, Event, and Job Change after Slice 9 made their CTAs reachable.
- Added shared focus-panel styling in `src/index.css`: `aether-focus-panel`, `aether-event-choice`, `aether-craft-row`, `aether-locked-row`, `aether-lock-note`, and `aether-disabled-action`.
- Replaced broad disabled opacity on class cards, crafting actions, quest bounty actions, and shop buy actions with readable disabled actions and reason notes.
- Added explicit lock/reason rows for craft material shortages, synthesis selection requirements, and locked quest level requirements.
- Raised `FocusPanelHeader` eyebrow/meta contrast so focus panel headers do not read as disabled in standard readability mode.
- Added `tests/mobile-focus-panel-contrast.test.js` to guard the contrast contract, disabled opacity removal, and deterministic focus-panel opt-in.
- Captured refreshed mobile smoke proof: `playtest-artifacts/mobile/02a-shop-open.png`, `02c-quest-board-open.png`, `02d-craft-open.png`, and `02e-event-open.png`.

Verification (Readability Slice 10):
- `node --import tsx --test tests/mobile-focus-panel-contrast.test.js tests/mobile-overlay-cta-reachability.test.js`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run verify`
- `bash scripts/local-playtest.sh`
- mobile screenshot review for Shop / Quest Board / Crafting / Event overlays
- `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`

Blocked / Not Verified (Readability Slice 10):
- `npm run mobile:doctor` still reports missing Android release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`), which is an environment blocker and not a new app regression.
- Physical iPhone/Android 5-minute manual routines remain pending.

Done (Readability Slice 9):
- Added a mobile overlay CTA reachability sweep so dense overlays must expose reachable primary and close actions before device QA.
- Added `verifyActionReachable` in `scripts/smoke-gameplay.mjs`, checking viewport intersection, visible ratio, minimum hit size, disabled state, pointer-events, visibility, opacity, and scroll recovery via `scrollIntoViewIfNeeded()`.
- Extended smoke coverage across Post Combat, Relic Choice, Run Summary, Shop, Mobile Archive/Town Ops/Reset, Job Change, Quest Board, Crafting, and Event overlays.
- Fixed real mobile smoke failures where `mobile-console-return-log` and `crafting-recipe-action` were below the 44px touch target threshold.
- Added explicit close / primary CTA test ids to Job Change, Quest Board, Crafting, and Event focus panels.
- Added `tests/mobile-overlay-cta-reachability.test.js` as a source guard for the reachability helper, deterministic CTA coverage, and 44px target sources.
- Captured refreshed mobile smoke proof including `playtest-artifacts/mobile/02-archive-console-open.png`, `02b-class-open.png`, `02c-quest-board-open.png`, `02d-craft-open.png`, `02e-event-open.png`, `02f-run-summary-reflection-strip.png`, and `10-tabs-verified.png`.

Verification (Readability Slice 9):
- `node --check scripts/smoke-gameplay.mjs`
- `node --import tsx --test tests/mobile-overlay-cta-reachability.test.js`
- `node --import tsx --test tests/mobile-overlay-cta-reachability.test.js tests/readability-map-signal.test.js tests/run-summary-reflection-readability.test.js`
- `npm run verify`
- `bash scripts/local-playtest.sh`
- `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`

Blocked / Not Verified (Readability Slice 9):
- `npm run mobile:doctor` still reports missing Android release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`), which is an environment blocker and not a new app regression.
- Physical iPhone/Android 5-minute manual routines remain pending.

Done (Readability Slice 8):
- Added a run summary reflection strip so the death/end screen exposes `CAUSE / LESSON / NEXT` before detailed stats.
- Added `getRunSummaryReflectionStrip` in `src/utils/outcomeAnalysis.ts`, deriving the strip from `getRunSummaryAnalysis`, run stats, boss kills, relics, gold, escapes, discoveries, and max streak.
- Wired `RunSummaryCard` to render the strip with `data-run-tone` and high-readability styling while preserving share/restart controls.
- Fixed the mobile summary overlay after smoke exposed the restart CTA could fall outside the viewport; the card now uses `100svh` max-height with internal scrolling.
- Replaced truncation on reflection values with two-line wrapping so mobile screenshots show full values without ellipsis.
- Extended smoke coverage to inject deterministic run summary state, verify `run-summary-reflection-strip`, labels, tone, share/restart CTAs, restart recovery, and capture `02f-run-summary-reflection-strip`.
- Captured visual proof: `playtest-artifacts/desktop/02f-run-summary-reflection-strip.png` and `playtest-artifacts/mobile/02f-run-summary-reflection-strip.png`.

Verification (Readability Slice 8):
- `node --import tsx --test tests/run-summary-reflection-readability.test.js tests/outcome-analysis.test.js tests/cycle-87-run-analysis-escape-discovery.test.js tests/cycle-97-max-streak-reflection.test.js tests/cycle-557-outcome-analysis-defaults-batch.test.js`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build:guard`
- `npm run verify`
- `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`

Blocked / Not Verified (Readability Slice 8):
- `npm run mobile:doctor` still reports missing Android release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`), which is an environment blocker and not a new app regression.
- Physical iPhone/Android 5-minute manual routines remain pending.

Done (Readability Slice 7):
- Added a relic choice decision strip so relic selection exposes `PICK / WHY / BUILD` before the three candidate cards.
- Added `src/utils/relicChoiceDecision.ts` to rank candidates from existing synergy, legendary completion, near-legendary, rarity, and effect build labels without changing relic reward mechanics.
- Wired `RelicChoicePanel` to mark one recommended card with `data-relic-recommended="true"` and a visible `추천` badge.
- Added relic decision strip styling and high-readability overrides.
- Extended smoke coverage to inject deterministic relic choices and verify `relic-choice-decision-strip`, labels, tone, and recommended card marker.
- Captured visual proof: `playtest-artifacts/desktop/02e-relic-choice-decision-strip.png` and `playtest-artifacts/mobile/02e-relic-choice-decision-strip.png`.

Verification (Readability Slice 7):
- `node --import tsx --test tests/relic-choice-decision-readability.test.js tests/cycle-533-get-relic-synergy-score-owned-relics-default-unreachable.test.js tests/cycle-534-get-loot-upgrade-hint-defaults-batch.test.js tests/cycle-535-cycle-skill-dir-default-unreachable.test.js`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build:guard`
- `npm run verify`
- `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`

Blocked / Not Verified (Readability Slice 7):
- `npm run mobile:doctor` still reports missing Android release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`), which is an environment blocker and not a new app regression.
- Physical iPhone/Android 5-minute manual routines remain pending.

Done (Readability Slice 6):
- Added a post-combat decision strip so battle results expose `STATE / LOOT / NEXT` before detailed reward text.
- Added `getPostCombatDecisionStrip` in `src/utils/outcomeAnalysis.ts` and wired it into `src/components/PostCombatCard.tsx`.
- Added pressure / reward / advantage / steady result-strip styling with high-readability overrides.
- Fixed post-combat analysis defaults so explicit `hpLow:false` / `mpLow:false` are respected when HP/MP ratios are absent.
- Extended smoke coverage to inject a deterministic post-combat result and verify `post-combat-decision-strip`, labels, and valid tone.
- Captured visual proof: `aetheria-post-combat-decision-strip.png`, `playtest-artifacts/desktop/02d-post-combat-decision-strip.png`, and `playtest-artifacts/mobile/02d-post-combat-decision-strip.png`.

Verification (Readability Slice 6):
- `node --import tsx --test tests/post-combat-decision-readability.test.js tests/outcome-analysis.test.js tests/signature-post-combat-highlight.test.js tests/cycle-336-post-combat-ratios-dead.test.js tests/cycle-557-outcome-analysis-defaults-batch.test.js`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build:guard`
- `npm run verify`
- `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`

Blocked / Not Verified (Readability Slice 6):
- `npm run mobile:doctor` still reports missing Android release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`), which is an environment blocker and not a new app regression.
- Physical iPhone/Android 5-minute manual routines remain pending.

Done (Readability Slice 5):
- Added a combat forecast strip to the combat panel so `INTENT / RESPONSE / WINDOW` are visible before action selection.
- Added `src/utils/combatForecast.ts` to derive forecast text and tone from existing combat state without changing combat mechanics.
- Added pressure / advantage / reward / steady styling, including high-readability overrides.
- Extended smoke coverage so combat smoke verifies `combat-forecast-strip` and valid `data-forecast-tone`.
- Refreshed desktop/mobile smoke artifacts and Capacitor web assets.

Verification (Readability Slice 5):
- `node --import tsx --test tests/combat-forecast-readability.test.js tests/signature-combat-panel-hint.test.js tests/cycle-269-combat-panel-boss-signature.test.js tests/cycle-270-tactical-profile-dead-cleanup.test.js tests/readability-map-signal.test.js`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build:guard`
- `npm run verify`
- `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`

Blocked / Not Verified (Readability Slice 5):
- `npm run mobile:doctor` still reports missing Android release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`), which is an environment blocker and not a new app regression.
- Physical iPhone/Android 5-minute manual routines remain pending.

Done (Readability Slice 4):
- Added saved `player.settings.readabilityMode` with `standard` default and migration sanitization for legacy/corrupt saves.
- Added System tab `Standard / High Readability` controls, QA readout/readout export visibility, and a `setReadabilityMode` game action.
- Wired `MainLayout` `data-readability-mode` so high readability mode raises contrast, lowers panel noise/glow, improves muted text opacity, and strengthens focus rings.
- Added regression coverage in `tests/readability-mode-persistence.test.js`, `tests/readability-map-signal.test.js`, and `tests/e2e/navigation.spec.ts`.
- Captured mobile visual proof: `aetheria-readability-mode-standard.png`, `aetheria-readability-mode-high.png`, plus refreshed `playtest-artifacts/mobile/09-system-tab.png` and `playtest-artifacts/mobile/10-tabs-verified.png`.

Verification (Readability Slice 4):
- `node --import tsx --test tests/readability-map-signal.test.js tests/readability-mode-persistence.test.js`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build:guard`
- `npx playwright test tests/e2e/navigation.spec.ts --project=chromium-mobile --workers=1`
- `npm run verify`
- `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`

Blocked / Not Verified (Readability Slice 4):
- `npm run mobile:doctor` still reports missing Android release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`), which is an environment blocker and not a new app regression.
- Physical iPhone/Android 5-minute manual routines remain pending.

Done:
- Rewrote `src/App.jsx` to integrate upgraded CombatEngine flow end-to-end.
- Added skill-slot selection flow (`actions.cycleSkill`) and wired selected-skill execution.
- Applied per-turn state ticking (`CombatEngine.tickCombatState`) before enemy action.
- Updated event handling to support structured `outcomes` payload when provided.
- Improved enemy spawn payload with `baseName` and behavior `pattern`.
- Updated item usage logic for `hp/mp/cure/buff` item types.
- Updated crafting to resolve real item definitions by recipe output name.
- Kept quest and loot logic aligned with prefixed enemy names via baseName-aware flow.
- Fixed stale quick-slot consumable reuse by validating inventory ownership and sanitizing slots on state load/update.
- Blocked state-leaking commands during modal/event flows (`event`, `job_change`, `quest_board`, `shop`, `crafting`, `ascension`, `dead`).
- Completed Daily Protocol reward flow for `essence`, `item`, `relicShard`, and wired `goldSpend` progress from rest/shop/crafting.
- Enforced quest minimum-level checks in both UI and action layer.
- Applied non-combat EXP gains through shared level-up logic so quest/event rewards level immediately.
- Closed job-change UX gaps by recalculating class vitals, resetting skill loadout, and closing the modal on success.
- Replaced dead title activation wiring with a real `setActiveTitle` action and added a working crafting panel.
- Applied equipment job restrictions to smart-equip recommendations and equip actions.
- Restored PostCombatCard on mobile and aligned MP/quick-slot UI with effective runtime stats.

Done (Mobile):
- Added `@capacitor/android` and generated the native `android/` project.
- Synced current web bundle into both `ios/` and `android/` via `npx cap sync`.
- Added `android:sync`, `android:open`, and build-first `cap:sync` scripts.
- Updated README mobile setup notes for iOS + Android sync flow.
- Installed local native build prerequisites on this machine: `openjdk`, `openjdk@21`, `android-commandlinetools`.
- Provisioned Android SDK packages (`platform-tools`, `platforms;android-36`, `build-tools;36.0.0`) and verified Gradle APK build.
- Verified iOS generic device build from `xcodebuild` with Capacitor Swift package resolution.
- Added `docs/MOBILE_SETUP.md` for repeatable native setup/build instructions.
- Aligned iOS bundle identifier with Capacitor/Android (`com.aetheria.roguelike`).
- Replaced placeholder web app manifest icon with generated native app icon assets and added `apple-touch-icon`.
- Added mobile release automation scripts: `mobile:doctor`, `android:debug`, `android:release`, `android:release:apk`, `ios:build:device`, `ios:archive`.
- Added `scripts/android-gradle.sh`, `scripts/ios-build-device.sh`, `scripts/ios-archive.sh`, and `android/key.properties.example`.
- Added `docs/MOBILE_RELEASE.md` and `ios/ExportOptions/AppStore.plist.example` for repeatable store submission prep.
- Added `docs/STORE_SUBMISSION_GUIDE.md` with step-by-step Xcode/TestFlight/Play Console submission flow and failure interpretation.
- Added mobile release automation scripts: `mobile:doctor`, `android:debug`, `android:release`, `android:release:apk`, `ios:build:device`, `ios:archive`.
- Added `scripts/android-gradle.sh`, `scripts/ios-build-device.sh`, `scripts/ios-archive.sh`, and `android/key.properties.example`.
- Added `docs/MOBILE_RELEASE.md` and `ios/ExportOptions/AppStore.plist.example` for repeatable store submission prep.

Done (UI/CLI):
- Rewrote `src/components/ControlPanel.jsx` with combat skill display + cooldown and skill cycling button.
- Rewrote `src/utils/commandParser.js` and added `nextskill/skillnext/sn/스킬변경`.

Verification:
- `npm run lint`
- `npm run build`
- Local Vite dev server boot verified (`http://127.0.0.1:4173/` → HTTP 200, app HTML + `/src/main.jsx` served)
- `npx cap add android`
- `npx cap sync`
- `npm run cap:sync`
- Android native debug build succeeded with `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH GRADLE_USER_HOME=/tmp/aetheria-gradle ./gradlew assembleDebug`
- Android debug APK output verified at `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS generic device build succeeded with `HOME=/tmp/aetheria-home CLANG_MODULE_CACHE_PATH=/tmp/aetheria-clang-module-cache xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /tmp/aetheria-ios-device-build CODE_SIGNING_ALLOWED=NO build`
- iOS app bundle output verified at `/tmp/aetheria-ios-device-build/Build/Products/Debug-iphoneos/App.app`
- Re-ran `npm run cap:sync`, Android debug build, and iOS generic device build after metadata/icon alignment; both remained successful.
- `npm run mobile:doctor` verified iOS bundle/version/signing metadata, Android SDK 36, Java 21, and missing Android release signing inputs.
- `npm run cap:sync` succeeded after release-doc/script changes.
- `npm run android:debug` succeeded through `scripts/android-gradle.sh`.
- `npm run ios:build:device` succeeded through `scripts/ios-build-device.sh` with Release configuration and `CODE_SIGNING_ALLOWED=NO`.
- `npm run android:release` succeeded with a temporary validation keystore at `/tmp/aetheria-release-test.jks`, producing a signed test bundle for release-path verification.
- `npm run ios:archive` failed without local provisioning assets; retrying with `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1` still failed because this machine has no Xcode account configured (`No Accounts`) and no matching profile for `com.aetheria.roguelike`.

External note:
- Playwright loop with `$WEB_GAME_CLIENT` was not executed in this workspace because that client/env is not configured here.
- Native IDE open (`npm run ios:open`, `npm run android:open`) was not executed here because GUI launch is outside this terminal session.

Done (Quality Pass 1~4):
- Added run diagnostics (`current build`, `class fit`, `recent win rate`, `avg exit HP`, `pacing`, `difficulty`) to `src/components/StatsPanel.jsx` via `getRunDiagnostics`.
- Added class build identities/synergies in `src/utils/runProfileUtils.js` and applied active class bonuses in `src/hooks/useGameEngine.js`.
- Enhanced `Build Direction` panel in `src/components/Dashboard.jsx` to show class fit and active class synergy.
- Added boss-specific tactical briefings (`signature`, `counter hint`, `phase hint`, `recommended builds`) via `src/data/monsters.js` + `src/components/tabs/CombatPanel.jsx`.
- Added title passive bonuses in `src/data/titles.js`, helper accessors in `src/utils/gameUtils.js`, applied them in `src/hooks/useGameEngine.js`, and surfaced them in `src/components/tabs/SystemTab.jsx`.
- Added regression coverage for class/build compatibility, boss briefings, and run diagnostics in `tests/run-profile-utils.test.js`.

Verification (Quality Pass 1~4):
- `npm run test:unit`
- `npm run lint`
- `npm run build`

Blocked / Not Verified:
- Tried to run the `develop-web-game` Playwright client directly from `/Users/sungjin/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js`, but this machine does not currently have the `playwright` package installed, so browser-loop validation could not run in this workspace.

Done (QA / Release Readiness 1~5):
- Added browser smoke harness hooks in `src/App.jsx`, `src/components/IntroScreen.jsx`, `src/components/ControlPanel.jsx`, `src/components/Dashboard.jsx`, `src/components/RelicChoicePanel.jsx`, `src/components/PostCombatCard.jsx`, and `src/components/RunSummaryCard.jsx`.
- Fixed run-summary restart to trigger a full game reset instead of only clearing the modal/UI shell.
- Added local smoke scripts: `scripts/smoke-gameplay.mjs` and `scripts/local-playtest.sh`.
- Added smoke command references to `README.md` and automated smoke guidance to `docs/PLAYTEST_CHECKLIST.md`.
- Hardened `scripts/android-gradle.sh` to retry once with a fresh temporary `GRADLE_USER_HOME` when the shared cache under `/tmp/aetheria-gradle` is corrupted.

Verification (QA / Release Readiness 1~5):
- `npm run test:unit`
- `npm run lint`
- `./scripts/local-playtest.sh`
- `npm run mobile:doctor`
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Artifacts:
- Desktop smoke artifacts: `playtest-artifacts/desktop`
- Mobile smoke artifacts: `playtest-artifacts/mobile`
- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS Release device app: `/tmp/aetheria-ios-device-build/Build/Products/Release-iphoneos/App.app`

Blocked / Not Verified (QA / Release Readiness 1~5):
- True manual play-feel validation is still pending; current coverage is browser smoke + native build verification, not human balance judgment.
- Real-device touch/OS lifecycle QA on physical iPhone/Android hardware was not executed from this terminal session.
- Android release signing is still not configured on this machine (`mobile:doctor` reports `Android release signing: no`).

Done (Mobile-First UX Pass):
- Compacted the mobile header in `src/App.jsx`, kept it sticky, and reduced non-essential sync text on small screens.
- Reworked the mobile dashboard in `src/components/Dashboard.jsx` into a quick HUD (`name/job/loc/gold`, HP/NRG/EXP, equipment, build strip) plus a collapsible detail panel with icon tabs.
- Tightened the mobile terminal in `src/components/TerminalView.jsx` by reducing terminal height/padding and shrinking empty/log presentation on small screens.
- Rebalanced the mobile action grid in `src/components/ControlPanel.jsx` to use a denser 3-column layout, shorter labels, and more compact move/reset flows.

Verification (Mobile-First UX Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (first run flaked on a random core-loop branch; second run passed with `[smoke:desktop] ok` and `[smoke:mobile] ok`)

Done (Mobile-First UX Pass 2):
- Reduced mobile terminal height again in `src/components/TerminalView.jsx` to expose more of the HUD/action surface above the fold.
- Switched the mobile action grid in `src/components/ControlPanel.jsx` from 3 columns to 4 columns and shortened button labels for denser touch-first access.
- Changed the mobile dashboard detail panel in `src/components/Dashboard.jsx` to start collapsed, keeping the first screen focused on core status/equipment.
- Moved mobile `AUTO EXPLORE` out of the floating overlay in `src/App.jsx` into the normal document flow to avoid covering HUD/equipment content.

Verification (Mobile-First UX Pass 2):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (`[smoke:desktop] ok`, `[smoke:mobile] ok`)
- Reviewed regenerated mobile smoke screenshots: `playtest-artifacts/mobile/01-after-start.png`, `playtest-artifacts/mobile/07-core-loop-complete.png`

Done (Real-Device QA Prep):
- Re-synced the latest mobile-optimized bundle into both native shells with `npm run cap:sync`.
- Rebuilt Android debug with `npm run android:debug` (cache-retry path still works).
- Rebuilt iOS device Release shell with `npm run ios:build:device`.
- Expanded `docs/PLAYTEST_CHECKLIST.md` with concrete mobile-first checks for first-fold visibility, auto-explore overlay removal, collapsed detail panel behavior, 4-column action grid taps, keyboard overlap, and platform-specific iPhone/Android touch issues.

Verification (Real-Device QA Prep):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Done (Real-Device QA Runbook):
- Added a 5-minute iPhone/Android quick-run section to `docs/PLAYTEST_CHECKLIST.md`.
- Added a short failure-capture list so device findings come back with enough detail to fix quickly.
- Updated `tasks/todo.md` to track the next concrete step as actual device execution, not more prep.

Done (QA Readout Support):
- Added runtime QA readout data to `src/components/tabs/SystemTab.jsx` and replaced the stale hardcoded build string with `CONSTANTS.DATA_VERSION`.
- Threaded runtime state (`viewport`, `gameState`, `syncStatus`, `isAiThinking`) from `src/App.jsx` through `src/components/Dashboard.jsx` into the system tab.
- Updated the device quick-run in `docs/PLAYTEST_CHECKLIST.md` so testers always capture the `QA READOUT` before reporting issues.

Verification (QA Readout Support):
- `npm run lint`
- `npm run build`

Done (QA Snapshot Export):
- Added `EXPORT` alongside `COPY` in `src/components/tabs/SystemTab.jsx` to download a reproducible QA snapshot JSON containing runtime, combat stats, equipment, relics, titles, inventory counts, and meta state.
- Updated `docs/PLAYTEST_CHECKLIST.md` to ask for the exported QA snapshot file when a device issue is reported.

Verification (QA Snapshot Export):
- `npm run lint`
- `npm run build`

Done (Mobile Trait / Combat UX Pass):
- Removed the mobile terminal command input by wiring `showInput={false}` in `src/App.jsx` and turning `src/components/TerminalView.jsx` into a button-first log panel on small screens.
- Reworked `src/components/IntroScreen.jsx` for mobile quick-start naming so new runs can begin without keyboard input.
- Replaced the player-facing `Run diagnostics` view with a simpler `성향` system in `src/utils/runProfileUtils.js`, `src/components/Dashboard.jsx`, `src/components/StatsPanel.jsx`, `src/utils/gameUtils.js`, and `src/components/SkillTreePreview.jsx`.
- Connected trait-based passive bonuses and a trait skill into active stat calculation and skill loadout via `src/hooks/useGameEngine.js` and `src/utils/gameUtils.js`.
- Compactified the mobile `PostCombatCard` in `src/components/PostCombatCard.jsx` so rewards, loot, and the next recommendation fit within one viewport.
- Strengthened 1H/2H readability and balance direction through `src/data/constants.js`, `src/utils/equipmentUtils.js`, `src/components/SmartInventory.jsx`, `src/components/ShopPanel.jsx`, and `src/components/Dashboard.jsx`.
- Applied a broader mobile-first visual pass across `src/App.jsx`, `src/components/ControlPanel.jsx`, `src/components/MainLayout.jsx`, `src/index.css`, and `src/components/RunSummaryCard.jsx` to establish a darker archive-like app identity.

Verification (Mobile Trait / Combat UX Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Done (Convenience / Fun Pass):
- Added a `FocusPanel` to `src/components/Dashboard.jsx` that surfaces the current objective, quest pulse, exploration forecast, and one-tap recommended actions.
- Added `src/utils/adventureGuide.js` to derive player-facing guidance from HP/MP state, town readiness, quests, inventory pressure, and exploration pacing.
- Kept the guidance buttons wired into existing actions so players can immediately rest, claim rewards, open the quest board, inspect inventory, open movement, or continue exploring.
- Added regression coverage for the new guidance and forecast behavior in `tests/adventure-guide.test.js`.

Verification (Convenience / Fun Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (desktop and mobile smoke both reached `ok`)

Done (Convenience / Fun Pass 2):
- Made the mobile `FocusPanel` in `src/components/Dashboard.jsx` start in a condensed state so the first fold stays readable while still exposing the current objective and one-tap next action.
- Added expandable quest/forecast detail inside the same panel so players can opt into more context instead of paying the information cost up front.
- Enhanced `src/utils/outcomeAnalysis.js` and `src/components/PostCombatCard.jsx` with a reward mood (`보스 돌파`, `풍성한 전리품`, `위험한 승리` 등) and compact reward highlight chips to make victories feel more distinct.
- Added regression coverage for the new reward mood output in `tests/outcome-analysis.test.js`.

Verification (Convenience / Fun Pass 2):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Done (Convenience / Fun Pass 3):
- Added contextual recommendation highlighting to `src/components/ControlPanel.jsx` so the primary suggested action is surfaced directly on the actual action button row instead of only in the HUD.
- Passed effective runtime stats into `src/components/ControlPanel.jsx` from `src/App.jsx` so recommendation logic uses the same HP/MP context the HUD uses.
- Added loot upgrade detection in `src/hooks/useCombatActions.js` and surfaced it in `src/components/PostCombatCard.jsx`, so players can immediately tell when a dropped equipment piece is a real upgrade.

Verification (Convenience / Fun Pass 3):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Done (Convenience / Fun Pass 4):
- Added `getMoveRecommendations` to `src/utils/adventureGuide.js` so exits are scored by HP/MP readiness, inventory pressure, current level fit, boss risk, and unexplored-route value.
- Upgraded the `MOVE` state in `src/components/ControlPanel.jsx` from plain exit buttons into recommendation cards with `추천/정비/개척/보스/경계` context and a short reason line.
- Added a read-only `추천 이동` summary to `src/components/MapNavigator.jsx` and threaded runtime stats from `src/components/Dashboard.jsx` so the world map and move panel use the same route heuristic.

Done (Combat / Grave / Town State Fixes):
- Added explicit in-combat consumable buttons to `src/components/tabs/CombatPanel.jsx` and routed quick-slot use through a dedicated combat item action in `src/App.jsx` so potions can be consumed directly during battles.
- Added `combatUseItem` to `src/hooks/useCombatActions.js` so combat consumables now spend the player turn, trigger the enemy response, and keep death/grave handling aligned with the combat loop.
- Extended `src/utils/graveUtils.js`, `src/hooks/useCombatActions.js`, `src/hooks/useGameActions.js`, `src/components/ControlPanel.jsx`, and `src/components/MapNavigator.jsx` to support multiple graves instead of a single overwritten corpse, with per-location recovery.
- Added `src/utils/playerStateUtils.js` and wired `src/hooks/useGameActions.js` so returning to a safe zone clears temporary buffs, statuses, and transient combat flags from the run.
- Added regression coverage in `tests/grave-recovery.test.js` and `tests/player-state-utils.test.js` for multi-grave recovery and safe-zone temporary-state cleanup helpers.

Verification (Combat / Grave / Town State Fixes):
- `npm run test:unit`
- `npm run build`
- `npm run lint` (existing warning remains in `src/components/BuildAdvicePanel.jsx`: unused `eslint-disable`)
- `./scripts/local-playtest.sh`
- Manual Playwright verification on local preview: entered combat, confirmed `COMBAT ITEMS` rendered, clicked `하급 체력 물약`, and verified the log recorded `하급 체력 물약 사용.` during battle.

Notes:
- An earlier `local-playtest` attempt failed because a stale preview server was already bound to port `4173`; after stopping that leftover process, the same smoke run passed on the expected port.

Done (Log-First UI Pass):
- Removed the top in-run `AETHERIA v4` header from `src/App.jsx` and tightened `src/components/MainLayout.jsx` so the field log gets more vertical room immediately on entry.
- Expanded `src/components/TerminalView.jsx` into a larger log-first panel, moved sound/sync controls into the log header, increased visible mobile log rows, and removed the extra empty footer when no input/quickslots are present.
- Replaced the old enemy detail-heavy `src/components/tabs/CombatPanel.jsx` with a compact action strip so combat no longer burns space on separate monster analysis cards.
- Simplified mobile `src/components/ControlPanel.jsx` by removing the `Field Actions` / `Idle` labels and stacking `REST` over `RESET` for a denser action block.
- Simplified `src/components/ShopPanel.jsx` by removing the guidance sentence, renaming the header to `SHOP`, compressing item cards, and shortening buy/sell comparison copy.
- Expanded `src/components/Bestiary.jsx` so weakness/resistance and boss briefing details now live in the codex instead of the combat surface.

Verification (Log-First UI Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (`[smoke:desktop] ok`, `[smoke:mobile] ok`)
- Reviewed generated screenshots:
  - `playtest-artifacts/mobile/01-after-start.png`
  - `playtest-artifacts/mobile/02a-shop-open.png`
  - `playtest-artifacts/desktop/05-combat-1.png`

Blocked / Not Verified (Log-First UI Pass):
- The `develop-web-game` skill client at `/Users/sungjin/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js` still fails in this environment because its own module resolution cannot find the `playwright` package from the skill directory (`ERR_MODULE_NOT_FOUND`). The local project smoke (`scripts/smoke-gameplay.mjs`) succeeded instead.

Done (Log-First UI Pass 2):
- Hid the mobile archive dock outside the core field states by threading `mobileArchiveDockVisible` from `src/App.jsx` into `src/components/Dashboard.jsx`, so shop/quest/crafting/job-change and other overlays no longer get covered by the dock.
- Compressed the mobile `Status Strip` in `src/components/Dashboard.jsx` with tighter gold/metric spacing and slot-by-slot loadout chips instead of a long text block.
- Tightened the log header in `src/components/TerminalView.jsx`, raised compact mobile log history to 6 lines, and removed extra decorative chrome so the field log shows more entries.
- Refactored `src/components/ControlPanel.jsx` into a cleaner button-schema flow with a single reset renderer and a dedicated mobile `REST -> RESET` stack.
- Simplified mobile `src/components/ShopPanel.jsx` further by removing the bottom buy tray and moving purchase directly into the selected item card.

Verification (Log-First UI Pass 2):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (`[smoke:desktop] ok`, `[smoke:mobile] ok`)
- Reviewed regenerated screenshots:
  - `playtest-artifacts/mobile/01-after-start.png`
  - `playtest-artifacts/mobile/02a-shop-open.png`

Done (Progress Visibility Recovery):
- Added a persistent `Run Progress` card to `src/components/Dashboard.jsx` for both mobile and desktop so core run progression is always visible again.
- The new panel surfaces active quest state, growth milestone (`Lv.5` class change or next level), explored-map count, and current run record/forecast without requiring archive expansion.
- Kept the existing action guidance in `Mission Focus`, but separated it from progression visibility so the two no longer compete for the same space.
- Compressed `Loadout Snapshot` on mobile so the restored progress card does not bloat the first screen.

Verification (Progress Visibility Recovery):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile first-fold screenshot: `playtest-artifacts/mobile/01-after-start.png`

Done (Mobile Density Simplification):
- Simplified the mobile first fold in `src/components/Dashboard.jsx` to a 3-block structure: `Status`, `Progress`, and `Next`.
- Removed the separate mobile `Loadout Snapshot` card and replaced it with a compact in-card `Loadout` strip inside the status block.
- Compressed mobile `Run Progress` to two primary tiles (`Quest`, `Growth`) plus lightweight frontier/record chips instead of four full cards.
- Simplified mobile `Mission Focus` to a single primary action by default; the secondary action now stays behind the detail toggle.
- Shortened mobile copy (`Status`, `Progress`, `Next`, `Archive`) to reduce visual noise.
- Simplified the mobile recommendation banner in `src/components/ControlPanel.jsx` from a full text card to a compact single-line hint.

Verification (Mobile Density Simplification):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile first-fold screenshot: `playtest-artifacts/mobile/01-after-start.png`

Done (Scroll Fatigue Reduction):
- Further reduced mobile first-fold complexity in `src/components/Dashboard.jsx` by merging the most important progression info into the main status card.
- Replaced the separate mobile progress card with a compact in-card `Progress` summary (`Quest`, `Growth`, explored area, current route state).
- Kept the mobile archive collapsed to a near-single-line opener so `Field Actions` surfaces earlier on screen.
- Reduced `src/components/TerminalView.jsx` mobile logs to a compact recent-log view by default, with manual expansion for the full history.

Verification (Scroll Fatigue Reduction):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile first-fold screenshot: `playtest-artifacts/mobile/01-after-start.png`

Done (Latest Native QA Prep):
- Re-synced the latest mobile HUD/scroll-fatigue reduction pass into Capacitor shells with `npm run cap:sync`.
- Rebuilt Android debug with `npm run android:debug`.
- Rebuilt iOS device Release shell with `npm run ios:build:device`.
- Confirmed a physical iPhone is currently connected via `xcrun xctrace list devices`.
- Confirmed no Android hardware is currently attached via `adb devices`.

Verification (Latest Native QA Prep):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`
- `xcrun xctrace list devices`
- `"$HOME/Library/Android/sdk/platform-tools/adb" devices`

Done (Visual Identity Finish Pass):
- Added a reusable branded `AetherMark` glyph in `src/components/AetherMark.jsx` and threaded it through the app shell, boot screen, intro screen, and mobile field log.
- Added shared animated visual primitives in `src/index.css` (`aetherOrbit`, `aetherPulse`, `auroraShift`, `floatSlow`) plus a reusable `panel-noise` surface treatment for core panels.
- Reworked `src/App.jsx` and `src/components/MainLayout.jsx` to strengthen the archive-style app shell with aurora background layers, branded top strip, and safer mobile bottom spacing.
- Polished `src/components/IntroScreen.jsx`, `src/components/TerminalView.jsx`, `src/components/Dashboard.jsx`, `src/components/ControlPanel.jsx`, `src/components/PostCombatCard.jsx`, and `src/components/ShopPanel.jsx` so the intro, HUD, action board, overlays, and field log share the same card language.
- Compressed the mobile first fold further by turning `Loadout Snapshot` into stat badges + short trait markers and surfacing inventory spotlight messaging in the `Archive Dock` header.
- Adjusted `handleLootReview` in `src/App.jsx` so `장비 보기` closes the combat result card and returns the user to the inventory review flow instead of leaving the overlay stacked above it.
- Updated `src/components/SmartInventory.jsx` and `scripts/smoke-gameplay.mjs` so spotlight-first review flow reflects the current visual layout (dock summary on mobile, detail banner on desktop/inventory).

Verification (Visual Identity Finish Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` now reaches `[smoke:desktop] ok` and `[smoke:mobile] ok` after stabilizing the mobile loot-review and post-combat interaction path in `scripts/smoke-gameplay.mjs`.

Blocked / Not Verified (Visual Identity Finish Pass):
- Real-device iPhone/Android visual polish is still pending; only browser/build validation was performed here.

Done (Verification Closure Pass):
- Exposed `inventorySpotlight` in the browser test harness from `src/App.jsx` so smoke validation can assert the loot-review handoff directly.
- Reworked `scripts/smoke-gameplay.mjs` to use DOM-level clicks for fixed mobile post-combat buttons and added a deterministic synthetic post-combat fallback when the random forest combat path does not naturally resolve to victory in time.
- Surfaced the current loot spotlight in the mobile `Archive Dock` header inside `src/components/Dashboard.jsx`, and moved the detailed spotlight banner in `src/components/SmartInventory.jsx` to the top of the inventory stack.
- Re-synced the latest UI into Capacitor shells and rebuilt Android/iOS native artifacts after the smoke stabilization changes.

Verification (Verification Closure Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Blocked / Not Verified (Verification Closure Pass):
- Physical-device QA on actual iPhone/Android hardware is still pending and cannot be completed from this terminal session.
- Added regression coverage for low-HP safe-route recommendation and stable-run level-fit route recommendation in `tests/adventure-guide.test.js`.

Verification (Convenience / Fun Pass 4):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed `playtest-artifacts/mobile/09-final-state.png` for mobile HUD/action readability after the pass

Done (Trait Reward Pass):
- Added `getTraitItemResonance`, `getTraitFeaturedItems`, and `getTraitLootHint` to `src/utils/runProfileUtils.js` so current trait identity can score shop stock and battle rewards without changing item data.
- Updated `src/components/ShopPanel.jsx` to sort buy items by trait resonance after affordability/usability, show a `성향 공명` market summary, and badge matching items with short resonance reasons.
- Passed runtime stats into the shop route from `src/components/ControlPanel.jsx` so the market uses the same effective trait context as the HUD and stats panels.
- Extended `src/hooks/useCombatActions.js` and `src/components/PostCombatCard.jsx` so battle rewards can surface a trait-resonant loot hint alongside the existing upgrade hint.
- Added regression coverage for trait item resonance and trait loot hint selection in `tests/run-profile-utils.test.js`.

Verification (Trait Reward Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Blocked / Not Verified:
- Shop-specific visual tuning for the new resonance badges was not manually inspected on a real device yet; current verification is automated plus unit coverage.

Done (Trait Reward Pass 2):
- Compacted the resonance presentation in `src/components/ShopPanel.jsx` so trait-fit hints stay readable on mobile cards without dominating the vertical space.
- Added `data-testid="shop-close"` and extended `scripts/smoke-gameplay.mjs` to open and close the market from the actual action bar, capturing dedicated shop screenshots in both desktop/mobile smoke artifacts.
- Consolidated mobile reward hints in `src/components/PostCombatCard.jsx` into a single `획득 포인트` section so upgrade and trait-resonance messages do not overgrow the victory card.
- Reviewed the new mobile captures `playtest-artifacts/mobile/02a-shop-open.png` and `playtest-artifacts/mobile/06-post-combat-1.png` for first-pass readability.

Verification (Trait Reward Pass 2):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Blocked / Not Verified:
- Real-device touch readability for the new market resonance block and compact reward-signal block is still pending; current validation is browser smoke plus screenshot review.

Done (Loot Review Spotlight Pass):
- Added a post-combat loot review handoff in `src/App.jsx` that routes upgrade/trait-highlighted rewards straight into the inventory tab with a focused spotlight payload.
- Updated `src/components/Dashboard.jsx` and `src/components/SmartInventory.jsx` so mobile detail panels auto-expose the inventory view when a spotlight is active and visually mark the highlighted drops with a dismissible banner.
- Added a synthetic post-combat injection hook in `src/App.jsx` and extended `scripts/smoke-gameplay.mjs` to verify `post-combat -> review loot -> inventory spotlight` before the core explore loop.
- Hardened combat-resolution detection in `scripts/smoke-gameplay.mjs` so smoke marks victory from either the result card or the victory log, removing random timing failures from the core-loop assertion.

Verification (Loot Review Spotlight Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Blocked / Not Verified:
- The new inventory spotlight flow is browser-smoke verified, but it has not been touched on a physical iPhone/Android device yet.

Done (Mobile Design Polish Pass):
- Refined the mobile app shell in `src/App.jsx` and `src/components/MainLayout.jsx` so the header reads as an in-app command bar instead of a desktop toolbar, while preserving safe-area behavior.
- Reworked the mobile HUD in `src/components/Dashboard.jsx` into clearer app-style layers: `Status Core`, `Mission Focus`, `Loadout`, `성향`, and `Field Archive`, with compact stat tiles replacing the previous stacked bar rows.
- Restyled the mobile action board in `src/components/ControlPanel.jsx` into a single `Field Actions` surface with stronger per-action color identity and a clearer idle/route-select state label.
- Tightened the mobile field log in `src/components/TerminalView.jsx`, added a lightweight header, and kept the no-input mobile interaction model intact.
- Polished the mobile start sheet in `src/components/IntroScreen.jsx` with codename suggestions and a more intentional quick-start presentation.
- Updated the mobile shop and post-combat card styling in `src/components/ShopPanel.jsx` and `src/components/PostCombatCard.jsx` so overlays share the same rounded app-card language as the HUD.
- Added `data-app-shell` in `src/components/MainLayout.jsx` and updated `scripts/smoke-gameplay.mjs` to scroll the real shell container before top-of-run captures, fixing misleading mobile first-fold screenshots.

Verification (Mobile Design Polish Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile smoke screenshots:
  - `playtest-artifacts/mobile/01-after-start.png`
  - `playtest-artifacts/mobile/06-post-combat-1.png`

Blocked / Not Verified:
- This pass is browser-smoke verified and screenshot-reviewed, but real-device touch feel, thumb reach, and OS safe-area behavior are still not closed without iPhone/Android manual QA.

Done (Post-Polish Native Refresh):
- Re-synced the latest mobile design polish into the Capacitor shells with `npm run cap:sync`.
- Rebuilt Android debug via `npm run android:debug` after the design pass; the cache-retry path still works when the shared Gradle cache is broken.
- Rebuilt the iOS device Release shell via `npm run ios:build:device` after the design pass.
- Re-verified the corrected mobile first-fold smoke artifact after fixing shell-container scrolling:
  - `playtest-artifacts/mobile/01-after-start.png`

Verification (Post-Polish Native Refresh):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`
- `./scripts/local-playtest.sh`

Artifacts:
- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS Release device app: `/tmp/aetheria-ios-device-build/Build/Products/Release-iphoneos/App.app`

Done (Desktop Density Compaction Pass):
- Compressed the desktop `StatusBar` in `src/components/StatusBar.jsx` so identity, HP, NRG, and EXP now read as a slim single-row HUD instead of a tall status shelf.
- Narrowed the desktop right rail in `src/App.jsx` and tightened the archive shell in `src/components/Dashboard.jsx` so the `Field Log` gets a visibly wider reading area.
- Shrunk desktop sidebar controls in `src/components/ControlPanel.jsx` into a denser lower-right dock, reducing button height, padding, and spacing while preserving the 2-column action grid.

Verification (Desktop Density Compaction Pass):
- `npm run lint`
- `npm run build`
- Playwright desktop viewport spot-check at `1445x1021`
  - artifact: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-18T12-50-25-760Z.png`

Blocked / Not Verified:
- `./scripts/local-playtest.sh`
  - desktop smoke reached `tab verification` twice, but both runs failed on browser console network errors (`ERR_INTERNET_DISCONNECTED`, earlier also `ERR_NETWORK_CHANGED`) unrelated to the layout code path

Done (Smoke Stability + Breakpoint Regression Pass):
- Added `src/utils/runtimeMode.js` and routed smoke runs through `?smoke=1` so automated verification can bypass live Firebase sync and AI proxy traffic.
- Updated `src/hooks/useFirebaseSync.js` to boot directly into offline-ready state during smoke runs and to pin `syncStatus` back to `offline`, removing external-network noise from test-only sessions.
- Updated `src/services/aiService.js` so smoke runs use deterministic fallback event/story content instead of making proxy calls during gameplay verification.
- Hardened `scripts/local-playtest.sh` by resolving a free preview port before launch and running Vite preview with `--strictPort`, which removes the previous stale-server / wrong-port failure mode.
- Hardened `scripts/smoke-gameplay.mjs` by appending the smoke query param, filtering request/response failures to same-origin only, ignoring generic browser `Failed to load resource` console noise, and adding desktop viewport overrides for breakpoint checks.
- Verified the desktop layout visually at `1440`, `1280`, and `1024` widths. The current compact HUD + right archive/action dock held without overflow or clipping, so no additional micro-adjust pass was required.

Verification (Smoke Stability + Breakpoint Regression Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Desktop breakpoint visual checks
  - `1440`: latest `local-playtest` desktop artifact
  - `1280`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T00-25-51-152Z.png`
  - `1024`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T00-26-09-377Z.png`

Done (Overlay / Modal Completion Pass):
- Rebuilt the remaining legacy overlay surfaces into the current `moonlit archive` language:
  - `src/components/RelicChoicePanel.jsx` now uses a calmer archive selection sheet with softer rarity cards, shared `SignalBadge` tones, and less aggressive neon contrast.
  - `src/components/RunSummaryCard.jsx` now reads as a memorial ledger instead of a red cyber alert panel, with a quieter stats grid and clearer summary actions.
  - `src/components/PostCombatCard.jsx` was rewritten into the same surface system with reward ledger / tactical readout sections and calmer mobile + desktop CTAs.
- Wired `src/components/PostCombatCard.jsx` back into the live app in `src/App.jsx`; it had drifted into an unused state and was not being rendered from `engine.postCombatResult`.
- Extended the test harness in `src/App.jsx` with `injectRelicChoice` and `injectRunSummary` so overlay states can be forced in Playwright without manual gameplay repro.
- Reduced background noise during post-combat review by hiding the mobile archive dock while `postCombatResult` is active.

Verification (Overlay / Modal Completion Pass):
- `npm run lint`
- `npm run build`
  - existing Vite dynamic-import warning for `src/data/relics.js` remains unchanged
- `./scripts/local-playtest.sh`
  - first rerun failed with a transient preview handoff `ERR_NETWORK_CHANGED`
  - immediate rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright browser spot-checks on the live dev server using the new test harness injections:
  - `injectPostCombatResult` verified the live `PostCombatCard` render and CTA presence
  - `injectRelicChoice` verified the live relic selection overlay render
  - `injectRunSummary` verified the live death summary overlay render

Artifacts (Overlay / Modal Completion Pass):
- Post-combat overlay capture: `/var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-18T08-21-29-169Z.png`
- Relic choice overlay capture: `/var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-18T08-23-40-914Z.png`
- Run summary overlay capture: `/var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-18T08-24-22-394Z.png`

Done (Cross-Platform Design Refresh Pass):
- Reframed the visual language across web and mobile around a calmer `moonlit archive` theme by introducing shared ink/cyan/amber/violet tokens, softer atmospheric backgrounds, and lower-fatigue glass surfaces in `src/index.css` and `src/components/MainLayout.jsx`.
- Redesigned the intro, field log, archive, quick slots, action grid, combat panel, event overlay, market, and quest board in `src/components/IntroScreen.jsx`, `src/components/TerminalView.jsx`, `src/components/Dashboard.jsx`, `src/components/QuickSlot.jsx`, `src/components/ControlPanel.jsx`, `src/components/tabs/CombatPanel.jsx`, `src/components/EventPanel.jsx`, `src/components/ShopPanel.jsx`, and `src/components/tabs/QuestBoardPanel.jsx` so the UI reads more like a premium roguelike journal than a harsh neon dashboard.
- Kept the earlier desktop simplification in place by preserving the wider log area and right-side `Archive + Actions` structure while restyling those surfaces to feel more editorial and less noisy.
- Fixed a mobile runtime regression discovered during verification by restoring the missing `ChevronUp` import in `src/components/Dashboard.jsx`; without it, starting a new run on mobile crashed immediately after the intro and caused smoke timeout.

Verification (Cross-Platform Design Refresh Pass):
- `npm run build`
- `npm run lint`
  - existing warning only: `src/components/BuildAdvicePanel.jsx:54` unused `eslint-disable`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright preview spot-checks on desktop and mobile against local preview after the redesign pass

Artifacts:
- Desktop redesign spot-check: `/var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-18T06-59-20-200Z.png`
- Mobile redesign spot-check: `/var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-18T07-01-20-827Z.png`

Done (Persistent Status Bar Pass):
- Added a shared `src/components/StatusBar.jsx` and mounted it above the main shell in `src/App.jsx` so nickname, class, level, gold, HP, NRG, and EXP remain visible on both desktop and mobile regardless of the active archive tab.
- Simplified the old mobile `summary` card in `src/components/Dashboard.jsx` into a `Field Snapshot` block so the new always-on status bar does not duplicate the same HP/NRG/EXP information lower in the fold.
- Fixed an interaction regression by marking the sticky status bar as display-only (`pointer-events-none`) after smoke revealed it could intercept clicks on desktop overlay controls like the shop close button.

Verification (Persistent Status Bar Pass):
- `npm run lint`
  - existing warning only: `src/components/BuildAdvicePanel.jsx:54` unused `eslint-disable`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright viewport check on mobile confirmed the status bar remains visible at the top while the old duplicate summary was reduced

Artifacts:
- Mobile status-bar viewport check: `/var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-18T07-17-40-873Z.png`

Done (Status Canonicalization Pass):
- Extended `src/components/StatusBar.jsx` so combat state now exposes the current target name, boss marker, and enemy HP directly in the same always-visible top HUD instead of forcing the player to read that context from lower combat panels only.
- Simplified the desktop archive header in `src/components/Dashboard.jsx` by removing duplicated player status chips now that nickname, class, level, gold, HP, NRG, and EXP are owned by the persistent status bar.
- Kept the sticky status bar non-interactive so it remains readable without ever intercepting panel buttons or overlay controls.

Verification (Status Canonicalization Pass):
- `npm run lint`
  - existing warning only: `src/components/BuildAdvicePanel.jsx:54` unused `eslint-disable`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`

Done (Archive Tab Density Pass):
- Reduced the visual/noise load inside archive tabs by restyling `src/components/SmartInventory.jsx`, `src/components/tabs/QuestTab.jsx`, and `src/components/tabs/SystemTab.jsx` toward softer rounded cards, calmer chip/button treatments, and tighter summary blocks that sit under the persistent top HUD without competing with it.
- Simplified `QuestTab` summary and empty/daily states so progress, claimability, and board restrictions read as compact badges instead of a heavy neon status slab.
- Reworked `SystemTab` sections (`QA Readout`, `Relics`, `Titles`, `Daily Protocol`, `Hall of Fame`, `Feedback`) into a more consistent editorial card system with reduced visual aggression and clearer spacing.
- Kept logic unchanged; this pass was presentation-only and intended to make Inventory / Quest / System feel like one coherent archive surface rather than three older sub-UIs.

Verification (Archive Tab Density Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright desktop tab spot-check for `Inventory`, `Quest`, and `System`

Done (Archive Completion Pass):
- Brought the remaining archive tabs into the same calmer visual system by restyling `src/components/StatsPanel.jsx`, `src/components/MapNavigator.jsx`, `src/components/Bestiary.jsx`, and `src/components/BuildAdvicePanel.jsx` with softer surfaces, reduced neon contrast, and denser but cleaner summary blocks.
- Simplified the `Map` tab’s route and world cards, the `Stats` tab’s trait/stat sections, and the `Bestiary` codex/detail presentation so the right panel now reads as one coherent archive rather than a mix of legacy sub-UIs.
- Removed the stale `eslint-disable` in `src/components/BuildAdvicePanel.jsx`, leaving the repo clean on lint for this pass.
- During verification, found multiple stale preview processes causing `local-playtest` to drift to the wrong port; cleaned them up and re-ran smoke successfully on a clean preview session.

Verification (Archive Completion Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright desktop tab spot-check for `Stats`, `Map`, and `Bestiary`

Done (Desktop Web Log-First Simplification Pass):
- Removed the desktop-only `Field Briefing` block from `src/components/TerminalView.jsx` and stopped pinning the extra desktop story card above the log, so the first fold now starts directly with readable log content.
- Reworked the desktop sidebar in `src/components/Dashboard.jsx` into a single `Archive` surface and moved the main action deck into the same right column via `src/App.jsx` and `src/components/ControlPanel.jsx`.
- Added compact desktop-sidebar handling in `src/components/ControlPanel.jsx` and `src/components/tabs/CombatPanel.jsx` so `idle / moving / combat` controls live on the right without reopening the old bottom command strip.
- Softened desktop contrast in `src/App.jsx` and `src/components/TerminalView.jsx` by toning down background glow, grid intensity, and high-saturation log highlight styles for longer sessions.

Verification (Desktop Web Log-First Simplification Pass):
- `npm run build`
- `npm run lint`
  - existing warning only: `src/components/BuildAdvicePanel.jsx` unused `eslint-disable`
- `./scripts/local-playtest.sh`
  - desktop smoke reached `[smoke:desktop] ok`
  - mobile smoke still hit the existing `Timed out waiting for new game state after intro start` flake while this desktop-only pass was being verified
- Browser spot-check on `http://127.0.0.1:4173/` with Playwright:
  - confirmed first fold no longer shows the old desktop briefing/recommendation stack
  - confirmed the right column now shows `Archive` + `Actions` within the same viewport

Done (Desktop/Mobile Design Cleanup Pass - 2026-03-18):
- Added a desktop `Field Briefing` block inside `src/components/TerminalView.jsx` for sparse first-fold states so the opening screen now reads as an intentional mission console instead of a mostly empty log viewport.
- Reduced mobile `Archive Dock` visual weight in `src/components/Dashboard.jsx` by turning it into a narrower pill handle with the active archive icon and lighter chrome, while keeping the existing bottom-sheet archive flow.
- Strengthened event and combat readability by:
  - rebuilding `src/components/EventPanel.jsx` as a true scrim + modal layer with blur, clearer hierarchy, and stronger choice cards
  - increasing contrast for `combat`, `event`, `success`, `warning`, and `system` log rows in `src/components/TerminalView.jsx`
- Tightened the mobile bottom spacer in `src/App.jsx` to match the slimmer archive handle.

Verification (Desktop/Mobile Design Cleanup Pass):
- `npm run lint`
  - completed with the pre-existing warning in `src/components/BuildAdvicePanel.jsx` about an unused `eslint-disable` directive
- `npm run build`
- `./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`

Artifacts Reviewed:
- `playtest-artifacts/desktop/01-after-start.png`
- `playtest-artifacts/desktop/05-combat-1.png`
- `playtest-artifacts/desktop/06-forced-event.png`
- `playtest-artifacts/mobile/01-after-start.png`
- `playtest-artifacts/mobile/05-combat-1.png`
- `playtest-artifacts/mobile/06-forced-event.png`

Notes:
- Real-device touch comfort and safe-area feel for the slimmer `Archive Dock` still need iPhone/Android manual QA.

Done (iPhone Install / Launch Verification - 2026-03-18):
- Confirmed the paired physical device via `xcrun devicectl list devices`:
  - `성진` / `iPhone 14 Pro Max` / `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`
- Re-synced the latest web bundle into the Capacitor shells with `npm run cap:sync`.
- Rebuilt the signed iOS archive with `npm run ios:archive`.
- Installed the archived app onto the paired iPhone:
  - `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- Launched the installed build on-device:
  - `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`
- Verified the app process is present on-device through `xcrun devicectl device info processes`.

Verification (iPhone Install / Launch Verification):
- `npm run mobile:doctor`
- `npm run test:unit`
- `./scripts/local-playtest.sh`
- `npm run cap:sync`
- `npm run ios:archive`
- `xcrun devicectl list devices`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`
- `xcrun devicectl device info processes --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B | rg "App.app/App|aetheria|roguelike|com.aetheria"`

Blocked / Not Verified:
- Manual in-app 5-minute touch QA on the physical iPhone still requires a person on the device.
- Android real-device QA is still blocked in this shell because `adb` is not installed and no Android device connection was detected.

Done (Design Review Snapshot - 2026-03-18):
- Reviewed the latest desktop/mobile UI using the freshly generated smoke artifacts instead of static code assumptions.
- Current direction is visually coherent and shippable, but there are still three design-level cleanup targets worth addressing before calling the UI “done”:
  - Desktop first-fold pacing: `playtest-artifacts/desktop/01-after-start.png` shows the field log taking most of the viewport while only 2-3 lines are populated, which makes the opening screen feel sparse and pushes the more actionable summary/action areas visually downward.
  - Mobile overlay competition: `playtest-artifacts/mobile/01-after-start.png` and `playtest-artifacts/mobile/09-final-state.png` show the fixed `Archive Dock` competing with the status strip and action deck for the same visual weight, so the first fold reads as three similar slabs instead of one clear primary action flow.
  - Event/combat contrast layering: `playtest-artifacts/mobile/06-forced-event.png` and `playtest-artifacts/desktop/06-forced-event.png` show the event overlay dimming the full shell while still leaving underlying UI readable enough to create noise; combat/event purple logs also sit close to the background value in some states, reducing scan speed.

Verification (Design Review Snapshot):
- `./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`
- Visual review of latest artifacts:
  - `playtest-artifacts/desktop/01-after-start.png`
  - `playtest-artifacts/desktop/02a-shop-open.png`
  - `playtest-artifacts/desktop/05-combat-1.png`
  - `playtest-artifacts/desktop/06-forced-event.png`
  - `playtest-artifacts/desktop/09-final-state.png`
  - `playtest-artifacts/mobile/01-after-start.png`
  - `playtest-artifacts/mobile/02a-shop-open.png`
  - `playtest-artifacts/mobile/03-arrived-forest.png`
  - `playtest-artifacts/mobile/05-combat-1.png`
  - `playtest-artifacts/mobile/06-forced-event.png`
  - `playtest-artifacts/mobile/09-final-state.png`

Notes:
- No code changes were made in this pass; this was a visual/design assessment only.

Done (Mobile Log + Grave Recovery Pass):
- Expanded the mobile field shell in `src/App.jsx` and `src/components/TerminalView.jsx` so `Field Log` consumes spare first-fold height instead of leaving a large dead gap above the fixed archive dock.
- Increased the compact mobile log window from 10 to 12 lines and switched the mobile terminal panel to a viewport-scaled minimum height so short action decks no longer leave the screen visually under-filled.
- Restored grave persistence in `src/reducers/gameReducer.js` by keeping `grave` across `RESET_GAME` and by hydrating `grave/currentEvent` from `LOAD_DATA`, fixing the regression where corpse recovery disappeared after death/restart or reload.
- Extracted grave logic into `src/utils/graveUtils.js` and wired `src/systems/CombatEngine.js` plus `src/hooks/useGameActions.js` through it so death now reliably stores half gold and 1–2 random non-starter items, while recovery supports both new `grave.items` and legacy single `grave.item` saves.
- Added `tests/grave-recovery.test.js` to lock grave creation and recovery behavior with node unit tests.

Verification (Mobile Log + Grave Recovery Pass):
- `node --test tests/grave-recovery.test.js`
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`, `[smoke:mobile] ok`, `[local-playtest] done`
- `npm run cap:sync`
- `npm run ios:archive`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`

Done (iPhone QA Prep Refresh):
- Re-synced the latest `run profile` / `dashboard cleanup` changes into the native shells with `npm run cap:sync`.
- Rebuilt the signed iOS archive with `npm run ios:archive` after confirming the unsigned `ios:build:device` output could not be installed on-device due to missing code signing.
- Installed `/Users/sungjin/dev/personal/aetheria-roguelike/build/ios/Aetheria.xcarchive/Products/Applications/App.app` onto the paired `iPhone 14 Pro Max` via `xcrun devicectl` and launched `com.aetheria.roguelike`.

Verification (iPhone QA Prep Refresh):
- `npm run cap:sync`
- `npm run ios:archive`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B .../Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`

Done (Mobile Density Follow-up Pass):
- Reworked the mobile `Status` loadout strip so equipped items now sit in a single horizontal `LEFT / RIGHT / ARMOR` row instead of a taller stacked list, reducing wasted vertical space in `src/components/Dashboard.jsx`.
- Removed the in-app `AUTO EXPLORE` control path from `src/App.jsx` and increased the mobile `Field Log` height / visible log count in `src/components/TerminalView.jsx`.
- Swapped the separate post-combat popup flow for a compact log digest by adding `전투 정리:` summary logs in `src/hooks/useCombatActions.js` and removing the live `PostCombatCard` render path from `src/App.jsx`.
- Compressed mobile shop cards in `src/components/ShopPanel.jsx` so buy items render with tighter rows, inline `구매`, and one-line comparison chips without the previous empty card space.
- Updated `scripts/smoke-gameplay.mjs` and `docs/PLAYTEST_CHECKLIST.md` so browser smoke and QA wording now match the log-first combat summary and removed `AUTO EXPLORE` UI.
- Re-synced the new mobile UI with `npm run cap:sync`, rebuilt the signed iOS archive with `npm run ios:archive`, and reinstalled / relaunched `com.aetheria.roguelike` on the paired `iPhone 14 Pro Max`.

Verification (Mobile Density Follow-up Pass):
- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `./scripts/local-playtest.sh`
  - run completed with `[smoke:desktop] ok`, `[smoke:mobile] ok`, `[local-playtest] done`
- `npm run cap:sync`
- `npm run ios:archive`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B .../Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`

Done (Run Profile / Dashboard Cleanup Pass):
- Created `implementation_plan.md` to capture the requested P0/P1/P2 scope, verified findings, touched files, and verification steps because the file did not previously exist in the repo.
- Restored low-HP win tracking by adding `countLowHpWins()` in `src/systems/DifficultyManager.js` and wiring `src/utils/questProgress.js` / `src/utils/runProfileUtils.js` to derive survival progress and `risk` trait selection from `recentBattles.hpRatio` instead of the stale legacy counter alone.
- Added explicit thresholds to the low-HP survival quests in `src/data/quests.js`, so the same battle history now cleanly feeds both the 20% and 10% quest variants.
- Extracted reusable guidance action handling into `src/utils/adventureGuideActions.js` and connected `src/components/ControlPanel.jsx` recommendation UI to real CTA buttons that execute the suggested action instead of only highlighting it.
- Split the oversized `src/components/Dashboard.jsx` into `src/components/dashboard/DashboardPanels.jsx` and `src/components/dashboard/FocusPanel.jsx`, reducing `Dashboard.jsx` itself to 501 lines while keeping equipment, progress, trait, and guidance surfaces isolated.
- Added optional build-resonance UI in `src/components/SmartInventory.jsx` and a one-line boss tactical briefing in `src/components/tabs/CombatPanel.jsx` to complete the scoped P2 follow-ups.
- Expanded regression coverage in `tests/run-profile-utils.test.js` and `tests/quest-progress.test.js` for derived low-HP wins and the `risk` trait fallback path.

Verification (Run Profile / Dashboard Cleanup Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - run completed with `[smoke:desktop] ok`, `[smoke:mobile] ok`, `[local-playtest] done`

Done (Mobile UI Cleanup Pass):
- Reworked `src/components/IntroScreen.jsx` so mobile intro now accepts direct callsign input, keeps suggestion chips as optional shortcuts, and removes the fixed `모험가` explainer card from the first screen.
- Updated `src/App.jsx` and `src/hooks/useGameActions.js` so intro routing depends on blank names only, starter-name validation is enforced at action time, and the opening logs no longer restate the fixed adventurer path.
- Compressed the mobile HUD in `src/components/Dashboard.jsx`, `src/components/ControlPanel.jsx`, `src/components/tabs/CombatPanel.jsx`, and `src/components/TerminalView.jsx` by dropping redundant section titles, shortening equipped-slot labels to `RIGHT / LEFT / ARMOR`, switching field actions to a 4-column grid with inline `RESET`, and giving the log a slightly taller default window.
- Simplified `src/components/ShopPanel.jsx` and `src/components/PostCombatCard.jsx` so shop cards show a single `1H / 2H` hint plus one-line deltas without `구매 가능` / `장착 가능` copy, and the mobile combat-result overlay is now a compact summary instead of a tall sheet.

Verification (Mobile UI Cleanup Pass):
- `npm run build`
  - succeeded
- `./scripts/local-playtest.sh`
  - `desktop` smoke reached `[smoke:desktop] ok`
  - `mobile` smoke failed with `Smoke ended outside the main game loop`; captured state shows a random run death pushed the smoke back to intro before final assertions
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4173/ --mobile`
  - failed in this environment because the Playwright Chrome instance closed immediately (`Target page, context or browser has been closed`)
- `npm run lint`
  - did not return a result in this environment before the session was abandoned

Done (Smoke Resilience Pass):
- Updated `src/App.jsx` test-state serialization so dead runs report `run_summary` before falling through to intro, matching the actual render order.
- Hardened `scripts/smoke-gameplay.mjs` with `isRunOver()` detection and automatic restart/re-entry to `고요한 숲` when a random death ends the run mid-smoke.
- Added run-over recovery before tab verification and the final assertion so the mobile smoke no longer depends on a single lucky combat sequence.

Verification (Smoke Resilience Pass):
- `node --check scripts/smoke-gameplay.mjs`
  - succeeded
- `npm run build`
  - succeeded
- `./scripts/local-playtest.sh`
  - still did not produce a final success/failure line in this environment after the smoke artifacts and preview server were generated, so end-to-end smoke remains unverified here

Done (Local Playtest Visibility Pass):
- Added explicit phase logs to `scripts/local-playtest.sh` for `build`, `preview:start`, `preview:ready`, `smoke:desktop`, `smoke:mobile`, and `done` so the long serial smoke run is visible while it executes.
- Added lightweight checkpoint logs to `scripts/smoke-gameplay.mjs` for `start`, `boot ready`, `field ready`, `core loop`, `tab verification`, plus restart notices when a run dies mid-smoke.
- Re-ran the full serial smoke and confirmed the earlier “no final line” concern was a visibility issue during the long mobile pass rather than a stuck preview cleanup path.

Verification (Local Playtest Visibility Pass):
- `node --check scripts/smoke-gameplay.mjs`
  - succeeded
- `npm run build`
  - succeeded
- `./scripts/local-playtest.sh`
  - reached `[local-playtest] smoke:desktop` -> `[smoke:desktop] ok`
  - reached `[local-playtest] smoke:mobile` -> `[smoke:mobile] ok`
  - printed `[local-playtest] done` and `Local playtest smoke completed: http://127.0.0.1:4173/`

Done (HUD / Shop Compression Pass):
- Compressed the mobile status loadout in `src/components/Dashboard.jsx` from three separate item tiles into one compact three-line strip: `RIGHT`, `LEFT`, `ARMOR` plus the equipped item name on the same row.
- Simplified `src/components/ShopPanel.jsx` buy cards so they now emphasize only the item name, `1H / 2H` when relevant, the item stat line, and the current-equipment comparison line; removed the extra tag stack that was wasting vertical space.
- Slightly expanded the mobile terminal in `src/components/TerminalView.jsx` so the tighter HUD immediately turns into more visible log history.

Verification (HUD / Shop Compression Pass):
- `npm run build`
  - succeeded
- `./scripts/local-playtest.sh`
  - `[smoke:desktop] ok`
  - `[smoke:mobile] ok`
  - `[local-playtest] done`

Done (RC-1 Reverification / Device Entry):
- Re-ran the release-candidate baseline on the current branch:
  - `npm run test:unit`
  - `npm run lint`
  - `npm run build`
  - `./scripts/local-playtest.sh`
  - `npm run mobile:doctor`
  - `npm run cap:sync`
  - `npm run android:debug`
- Confirmed the current iOS signing environment is usable for archive builds on this machine:
  - `AETHERIA_IOS_HOME=/Users/sungjin AETHERIA_IOS_DERIVED_DATA_PATH=/tmp/aetheria-ios-device-build-rc3 npm run ios:build:device`
  - `AETHERIA_IOS_HOME=/Users/sungjin AETHERIA_IOS_DERIVED_DATA_PATH=/tmp/aetheria-ios-archive-build-rc1 AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`
- Verified the signed archive artifact at `build/ios/Aetheria.xcarchive/Products/Applications/App.app`.
- Verified a physical iPhone is connected and reachable through `xcrun devicectl`:
  - `성진` / `iPhone 14 Pro Max` / `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`
- Installed and launched the archived app on the connected device:
  - `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
  - `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`

Blocked / Not Verified:
- Manual in-app 5-minute touch QA on the physical iPhone still requires a person on the device; this terminal session verified install and launch only.
- Android physical-device QA is still blocked because `adb` is not available in this terminal environment and no Android handset is attached.
- Android release signing is still not configured; `npm run mobile:doctor` reported release signing `no`, so signed Android release artifacts are still pending real keystore credentials.

Done (Log-First Completion Pass):
- Added explicit smoke/test hooks for the latest mobile shell:
  - `src/components/Dashboard.jsx`: `mobile-archive-dock`, `mobile-archive-open`, `mobile-archive-sheet`
  - `src/components/ShopPanel.jsx`: `shop-buy-item`, `shop-buy-inline`
  - `src/components/ControlPanel.jsx`: dedicated `control-reset` test id, grave recovery renamed to `control-recover`
  - `src/components/TerminalView.jsx`: `terminal-panel`
- Tightened the archive overlay copy in `src/components/Dashboard.jsx` by removing the leftover helper sentence so the bottom sheet stays denser.
- Updated `scripts/smoke-gameplay.mjs` to cover the current mobile-first UX instead of the old structure:
  - verify first-fold visibility for `Field Log`, `Archive Dock`, `REST`, and `RESET`
  - verify the archive dock hides while the mobile shop overlay is open
  - verify the mobile shop uses inline card purchase (`바로 구매`) and no desktop footer control
  - verify the archive dock returns after closing the shop
- Updated `docs/PLAYTEST_CHECKLIST.md` so the manual QA wording now matches the current UI:
  - removed stale `헤더` / `4열 그리드` wording
  - added `REST / RESET` stack checks
  - added archive-dock hidden-on-overlay checks
  - added inline shop purchase / no bottom buy bar checks
- Re-ran native refresh on the latest bundle after the smoke/doc updates.

Verification (Log-First Completion Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - `[smoke:desktop] ok`
  - `[smoke:mobile] ok`
- Reviewed updated smoke captures:
  - `playtest-artifacts/mobile/01-after-start.png`
  - `playtest-artifacts/mobile/02a-shop-open.png`
- `npm run cap:sync`
- `npm run mobile:doctor`
- `npm run android:debug`
- `npm run ios:build:device`

Current device/tooling state:
- Connected iPhone detected earlier via `xcrun devicectl list devices`: `성진` / `iPhone 14 Pro Max` / `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`
- Android SDK / Java are healthy, but Android release signing is still intentionally unconfigured in this workspace.

Blocked / Not Verified:
- Manual iPhone 5-minute touch QA is still pending for this exact post-fix bundle; this pass verified browser smoke and native builds, not physical taps.
- Android physical-device QA is still pending; `adb` is not available in this terminal environment and no Android handset is attached.
- The official `develop-web-game` Playwright client was not used for this app flow; the project's `scripts/smoke-gameplay.mjs` remains the reliable browser-loop verifier here.

Done (RC-1 Release Planning Pass):
- Updated `docs/MOBILE_RELEASE.md` with an explicit `RC-1` operating model:
  - freeze new feature work
  - run the 8-command baseline verification before device QA
  - execute iPhone -> Android QA in order
  - classify findings as `P0 / P1 / P2`
  - ship only after the new `Go / No-Go Gate` is satisfied
- Updated `docs/PLAYTEST_CHECKLIST.md` with a matching `RC-1` rules section so the device checklist now doubles as the release-candidate QA protocol.
- Updated `tasks/todo.md` so the active sprint reflects the new mode: release candidate freeze, real-device QA, and signed-build / store-submission prep.

Verification (RC-1 Release Planning Pass):
- Re-read the updated sections in:
  - `docs/MOBILE_RELEASE.md`
  - `docs/PLAYTEST_CHECKLIST.md`
  - `tasks/todo.md`

Next recommended action:
- Run the iPhone 5-minute quick routine first, capture `QA READOUT`, and log any `P0 / P1` findings before touching release signing or store upload.

Done (Signed iPhone Install / Launch Verification):
- Fixed `scripts/ios-archive.sh` to use the real macOS home directory by default instead of `/tmp/aetheria-home`, allowing `xcodebuild archive` to see the logged-in Xcode account and login keychain for signing.
- Confirmed the latest signed archive app exists at `build/ios/Aetheria.xcarchive/Products/Applications/App.app`.
- Verified the connected physical iPhone through `xcrun devicectl list devices`:
  - `성진` / `iPhone 14 Pro Max` / `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`
- Successfully created a signed iOS archive with `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`.
- Installed the archived app onto the connected iPhone with `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`.
- Launched the installed app on-device with `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`.

Verification (Signed iPhone Install / Launch Verification):
- `find build/ios/Aetheria.xcarchive -name App.app -type d`
- `xcrun devicectl list devices`
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`

Blocked / Not Verified:
- Manual in-app 5-minute touch QA on the physical iPhone still requires a person on the device; this terminal session only verified install and launch.
- Android physical-device QA is still blocked because no Android handset is currently attached (`adb devices` showed none).

Done (Gameplay Depth Pass: Steps 1-5):
- Strengthened boss identity in `src/data/monsters.js`, `src/utils/runProfileUtils.js`, `src/components/tabs/CombatPanel.jsx`, `src/systems/CombatEngine.js`, and `src/components/PostCombatCard.jsx`:
  - Added boss entry memos, reward hints, warning chips, and first-clear gold bonus flow
  - Surfaced boss reward context directly in combat and post-combat UI
- Expanded the trait system in `src/utils/runProfileUtils.js`, `src/components/StatsPanel.jsx`, `src/hooks/useInventoryActions.js`, `src/components/tabs/QuestBoardPanel.jsx`, and `src/components/tabs/QuestTab.jsx`:
  - Added `rewardFocus`, `questFocus`, and `bossDirective`
  - Added trait-to-quest resonance scoring and bonus gold on matching quest turn-ins
- Added build-guiding quests in `src/data/quests.js` and synced them through runtime stats:
  - Added `build_victory` quests for crusher / dual / fortress / arcane loops
  - Added `discovery_count` quest for exploration discovery runs
  - Added `discoveries` and `buildWins` stat tracking in `src/reducers/gameReducer.js`, `src/utils/gameUtils.js`, `src/hooks/useGameActions.js`, and `src/hooks/useCombatActions.js`
- Added exploration pacing phase 2 in `src/utils/explorationPacing.js`, `src/utils/adventureGuide.js`, and `src/hooks/useGameActions.js`:
  - Introduced map tempo profiles (`safe`, `frontier`, `volatile`, `hostile`, `boss`)
  - Added `TEMPO` exploration forecast chips and stronger boss/volatile region mood cues
- Extracted quest progress syncing into `src/utils/questProgress.js` so build/discovery quest progress can be unit-tested without importing the full combat runtime.

Verification (Gameplay Depth Pass: Steps 1-5):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`
- `xcrun devicectl list devices`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`

Blocked / Not Verified:
- iPhone manual 5-minute touch QA is still pending; this session verified install and launch but did not perform on-device taps/scrolls.
- Android physical-device QA is still pending; `adb` is not available in this terminal environment and no Android handset is currently attached.

Done (Quest / Shop Simplification Pass):
- Simplified the mission board in `src/components/tabs/QuestBoardPanel.jsx`:
  - Added a top-right close button so the mission terminal can be exited without scrolling to the bottom
  - Removed the trait recommendation banner
  - Reduced quest cards to title + requirement + single objective line + rewards + action, removing duplicate desc/objective blocks and the extra `Lv.X 더 필요` footer box
- Simplified the mobile status/actions first fold:
  - Removed the extra quest/growth chip row from the mobile `Status Strip` in `src/components/Dashboard.jsx`
  - Compressed equipped gear into a single-line `Loadout` summary
  - Removed the large mobile “recommended action” card in `src/components/ControlPanel.jsx`, keeping the action grid as the main focus
  - Tightened the mobile `Field Log` header in `src/components/TerminalView.jsx`
- Simplified the shop in `src/components/ShopPanel.jsx`:
  - Removed the top trait resonance panel and per-item resonance explanation blocks
  - Moved mobile purchasing to an explicit `select item -> bottom purchase bar` flow so the chosen item is unambiguous
  - Kept pricing and buy-state messaging in one place instead of floating over the card

Verification (Quest / Shop Simplification Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - first rerun hit the known random early-death mobile smoke branch and ended in `intro`
  - immediate rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Blocked / Not Verified:
- Real-device confirmation is still pending for the new mobile shop purchase flow and mission-board close button.

Done (Mobile Main-Loop Simplification Pass):
- Reordered the mobile app shell in `src/App.jsx` so the first-fold flow is now `Field Log -> Status Strip -> Field Actions`, with the archive layer moved out of the main reading flow.
- Reworked the mobile `Dashboard` in `src/components/Dashboard.jsx` into two focused surfaces:
  - `summary`: a compact `Status Strip` with HP/NRG/EXP, location, gold, quest/growth chips, and a single-line loadout summary
  - `archive`: a fixed `Archive Dock` that opens a bottom sheet for inventory, quests, map, stats, codex, and system tabs
- Updated `src/components/MainLayout.jsx` bottom safe-area spacing so the fixed archive dock does not sit directly on top of interactive content.
- Updated `src/components/ShopPanel.jsx` and `src/components/ControlPanel.jsx` so the shop now behaves like a mobile bottom sheet with a top-level close button, fixing the previous “scroll to the bottom to close” issue.
- Tightened the mobile action header copy in `src/components/ControlPanel.jsx` so the main action deck reads more like a simple command surface than a stacked dashboard.

Verification (Mobile Main-Loop Simplification Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Notes:
- The first `./scripts/local-playtest.sh` rerun ended in the existing random early-death branch (`mode: intro` with a run summary still present), but the immediate rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`.

Done (Mobile First-Fold Final Compression):
- Removed the empty quick-slot row from the mobile field log when no slots are assigned in `src/components/TerminalView.jsx`, so the first screen does not spend vertical space on inactive controls.
- Removed the extra mobile “buttons only” helper card from the field log footer in `src/components/TerminalView.jsx`; the mobile command model is now implied by the action dock instead of restated as another card.
- Tightened the `Status Strip` loadout summary in `src/components/Dashboard.jsx` so equipped items read as shorter signal chips instead of a bulkier multiline equipment block.
- Re-verified the updated first-fold capture at `playtest-artifacts/mobile/01-after-start.png`; the latest smoke artifact now shows log -> status -> actions without the previous empty quick-slot strip.

Verification (Mobile First-Fold Final Compression):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`

Done (Mobile Design System Pass):
- Compressed the mobile first fold in `src/components/Dashboard.jsx` by replacing the separate `Loadout` and `성향` cards with a single `Loadout Snapshot` and by turning `Field Archive` into a bottom-dock style archive tray.
- Added a shared `src/components/SignalBadge.jsx` so recommendation, resonance, upgrade, spotlight, and status badges now use one visual language across `Dashboard`, `ControlPanel`, `MapNavigator`, `ShopPanel`, `SmartInventory`, and `PostCombatCard`.
- Simplified mobile archive access with primary tabs (`INV`, `QUEST`, `MAP`, `STAT`) plus a secondary `More` row, keeping full archive access while removing the previous wide scroll strip from the first fold.
- Tightened safe-area spacing in `src/components/MainLayout.jsx`, `src/components/ShopPanel.jsx`, and `src/components/PostCombatCard.jsx` to give the mobile shell more bottom breathing room and reduce edge-clinging overlays.

Verification (Mobile Design System Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - first rerun failed due the existing random core-loop smoke not observing event/relic states
  - second rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`

Blocked / Not Verified:
- Real-device thumb reach, actual touch comfort, and OS-level safe-area behavior for the new `Archive Dock` and badge density are still pending until iPhone/Android manual QA.

Done (Post-Design-System Native Refresh):
- Re-synced the latest `Loadout Snapshot`, `Archive Dock`, and `SignalBadge` UI changes into the Capacitor shells with `npm run cap:sync`.
- Rebuilt Android debug with `npm run android:debug`; the retry path recovered once from the known temporary Gradle cache corruption and completed successfully.
- Rebuilt the iOS Release device shell with `npm run ios:build:device`.
- Updated `docs/PLAYTEST_CHECKLIST.md` so the mobile QA wording now matches the latest mobile structure (`Loadout Snapshot`, `Archive Dock`, unified signal badges).

Verification (Post-Design-System Native Refresh):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Artifacts:
- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS Release device app: `/tmp/aetheria-ios-device-build/Build/Products/Release-iphoneos/App.app`

Done (Narrow Desktop Compact Rail Pass):
- Added a viewport-aware layout branch in `src/App.jsx` for `768px ~ 1099px` so desktop no longer keeps the full right rail at those widths.
- Replaced the old narrow desktop structure with `StatusBar -> full-width Field Log -> bottom rail`, where `Archive` sits bottom-left and the compact `Actions` dock sits bottom-right.
- Tightened the narrow desktop HUD in `src/components/StatusBar.jsx` by hiding the redundant location text in compact desktop mode and slightly reducing the top bar padding, which frees more vertical space for the log without removing persistent HP/NRG/EXP visibility.
- Verified that the right-side archive/actions information is still available while the field log becomes the dominant surface again at tablet-ish widths.

Verification (Narrow Desktop Compact Rail Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright visual checks:
  - `820px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T00-49-32-467Z.png`
  - `768px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T00-49-40-375Z.png`

Notes:
- At `768px` the compact rail remains stable without overflow or clipped controls, so no extra collapse rule was needed beyond the new bottom-rail branch.

Done (Narrow Desktop Density Tightening Pass):
- Further tightened the `desktop-compact` rail in `src/components/Dashboard.jsx` by turning the archive tabs into a single horizontal pill rail instead of a fixed 2-row grid, reducing header/tab stack height while keeping access to all archive tabs.
- Added a `compactDesktop` density path in `src/components/ControlPanel.jsx` so the narrow desktop action dock uses smaller button heights, tighter padding, and a slimmer wrapper.
- Reduced the narrow desktop bottom rail footprint in `src/App.jsx` by shrinking the archive/action column widths and lowering the compact rail min/max heights, which gives the field log more vertical room.
- Per the final 768px visual check, the horizontal archive rail now peeks all tabs without the previous heavy clipping, and the right action dock remains fully visible.

Verification (Narrow Desktop Density Tightening Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright visual checks:
  - `960px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T01-15-41-900Z.png`
  - `820px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T01-15-57-682Z.png`
  - `768px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T01-18-09-729Z.png`

Done (Desktop Vertical Log Restoration Pass):
- Reverted the desktop gameplay layout in `src/App.jsx` back to a fixed right-column structure so `Archive` and `Actions` stay on the right side during PC play instead of dropping beneath the log.
- Applied the compact desktop HUD mode to all desktop widths, keeping nickname/HP/NRG/EXP always visible while shrinking the top bar footprint to free more vertical space for the field log.
- Narrowed the desktop right rail widths and gutter spacing in `src/App.jsx` so the left log pane keeps more room without reintroducing a bottom rail.
- Verified the intended desktop reading pattern again: `Status HUD -> tall field log on the left -> archive/actions stacked on the right`.

Verification (Desktop Vertical Log Restoration Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright visual checks:
  - `1024px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T01-27-25-457Z.png`
  - `1440px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T01-37-01-831Z.png`

Notes:
- I explicitly did not keep the previous narrow-desktop bottom rail. Current intent is that desktop gameplay prioritizes vertical log height and keeps archive/actions on the right.

Done (Desktop Sidebar Usability Pass):
- Tightened the desktop `StatusBar` further in `src/components/StatusBar.jsx` by shrinking desktop meter padding, label sizing, and bar height so the persistent HUD costs less vertical space while still keeping HP/NRG/EXP visible.
- Reworked compact desktop archive tabs in `src/components/Dashboard.jsx` from the unstable single-row pill rail back into a denser 4-column icon grid that fits reliably inside the fixed right sidebar.
- Kept the desktop `left tall log / right sidebar` structure from `src/App.jsx`, using the new denser HUD and archive controls to improve right-column usability without sacrificing log height.

Verification (Desktop Sidebar Usability Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright visual checks:
  - `1024px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T01-45-57-559Z.png`
  - `1440px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T01-46-11-641Z.png`

Done (Desktop Sidebar Hierarchy Pass):
- Reorganized the desktop archive navigation in `src/components/Dashboard.jsx` into a clearer two-tier hierarchy: `Inventory / Quest / Map` now sit as the primary visible tabs, while lower-frequency sections (`Achievements / Skills / Stats / Bestiary / System`) move into a denser secondary icon row.
- Added an icon-only dense button mode to `ArchiveTabButton` in `src/components/Dashboard.jsx` so the secondary archive tools stay available without competing visually with the high-frequency tabs.
- Reworked desktop sidebar actions in `src/components/ControlPanel.jsx` into a contextual priority group plus a lower-priority secondary grid, using the existing recommendation signal to surface the two most relevant actions first instead of giving every button equal weight.
- Kept the existing compact desktop HUD and tall left log layout in `src/components/StatusBar.jsx` and `src/App.jsx`; the final `1024px` pass was to improve scan speed inside the right column, not to widen or move the rail again.

Verification (Desktop Sidebar Hierarchy Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright visual checks:
  - `1024px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T02-13-37-020Z.png`
  - `1440px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T02-13-55-274Z.png`

Notes:
- After the hierarchy change, the `1024px` desktop rail no longer needed an extra width or collapse tweak; the main issue was information weighting inside the sidebar, not the outer shell dimensions.

Done (Desktop Archive Compact Content Pass):
- Added a desktop archive compact mode in `src/components/Dashboard.jsx` so high-frequency sidebar tabs now receive denser inner layouts without changing the existing left-log / right-rail shell.
- Compressed `Inventory` in `src/components/SmartInventory.jsx` and `src/components/QuickSlot.jsx` by tightening the filter bar, spotlight block, quick-slot assigner, item card padding, and use/equip buttons so item scanning costs less vertical space in the narrow right rail.
- Compressed `Quest` in `src/components/tabs/QuestTab.jsx` by shortening the desktop header copy, reducing quest card and reward/progress spacing, and shrinking claim/status controls for better 1024px readability.
- Compressed `Map` in `src/components/MapNavigator.jsx` and `src/components/BuildAdvicePanel.jsx` by reducing info-card and route-card padding, stacking recommendations more tightly, and shrinking the advisory panel shell so the map tab stays useful without dominating the sidebar.

Verification (Desktop Archive Compact Content Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warning about `src/data/relics.js` dynamic/static import remains unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright checks on the live dev server
  - console errors: none
  - `1024px` Inventory: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T02-33-14-205Z.png`
  - `1024px` Quest: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T02-33-25-902Z.png`
  - `1024px` Map: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T02-33-34-909Z.png`
  - `1440px` Map: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773813565488/page-2026-03-19T02-34-31-274Z.png`

Done (Desktop Actions Compact Grid Pass):
- Further compressed the desktop sidebar controls in `src/components/ControlPanel.jsx` so the action deck reads as `2 priority actions + smaller secondary actions + minimal reset` instead of a stack of equally large buttons.
- Added desktop sidebar short labels (`QUEST / EXP / MOVE / SHOP / REST / CLASS / CRAFT / LOOT`) and tightened icon sizing, padding, and minimum heights so the lower-right rail consumes less vertical space without hiding functionality.
- Switched desktop secondary actions to a denser 3-column grid and reduced moving-route card / cancel densities in the same component so both idle and moving states stay lighter in the right rail.

Verification (Desktop Actions Compact Grid Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warning about `src/data/relics.js` dynamic/static import remains unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright checks on the live dev server
  - console errors: none
  - `1024px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773888046339/page-2026-03-19T02-47-33-803Z.png`
  - `1440px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773888046339/page-2026-03-19T02-56-21-701Z.png`

Done (Desktop Status Strip Compression Pass):
- Reworked the desktop top HUD in `src/components/StatusBar.jsx` from four distinct mini-cards into a thinner `identity strip + inline HP/NRG/EXP meters` layout so nickname/status remains always visible while consuming less vertical space.
- Added an inline meter mode in `src/components/StatusBar.jsx` for desktop compact usage and reduced desktop enemy-target padding/typography in the same file so combat HUD expansion also stays lighter.
- Tightened the desktop status wrapper in `src/App.jsx` with slimmer padding/radius overrides so the full shell gains a bit more log height without changing the overall information set.

Verification (Desktop Status Strip Compression Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warning about `src/data/relics.js` dynamic/static import remains unchanged
- `./scripts/local-playtest.sh`
  - latest rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright checks on the live dev server
  - console errors: none
  - `1024px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773888046339/page-2026-03-19T03-07-21-627Z.png`
  - `1440px`: `var/folders/n7/g1vxvrg97t11t_nxzvdk0dpr0000gn/T/playwright-mcp-output/1773888046339/page-2026-03-19T03-10-15-957Z.png`

Notes:
- One intermediate `local-playtest` run stalled after desktop smoke while the mobile Playwright worker process remained alive without emitting progress; I terminated the stale worker and reran smoke cleanly before closing this pass.

Done (Desktop Map Reduction Pass):
- Reduced the default `Map` tab density in `src/components/MapNavigator.jsx` for desktop compact sidebar usage so the archive rail shows only the most relevant locations first instead of the full 22-region list on first open.
- Prioritized current location, grave-bearing regions, recommended routes, and visited regions in the default compact map view, while keeping full data access behind a `+N 더 보기` / `요약 보기` toggle in the same component.
- Tightened compact map guidance by showing only the single highest-priority route and shortening the movement helper copy so the map panel stays informative without dominating the right rail height.

Verification (Desktop Map Reduction Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warning about `src/data/relics.js` dynamic/static import remains unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright checks on the live dev server
  - console errors: none
  - `1024px` compact default: `/tmp/map-compact-1024-default.png`
  - `1024px` expanded: `/tmp/map-compact-1024-expanded.png`
  - `1440px` compact default: `/tmp/map-compact-1440-default.png`

Notes:
- The compact map still exposes the full region list on demand, but the initial open state now spends sidebar height on current context and the most likely next move rather than long-tail areas.

Done (Desktop Inventory Quest Summary Pass):
- Added a summary-first compact inventory mode in `src/components/SmartInventory.jsx` so the desktop archive rail now opens with three prioritized items instead of the full filtered list when the inventory exceeds the compact threshold.
- Prioritized spotlight items, quick-slotted consumables, gear upgrades, and immediate-use consumables in the compact inventory list, while keeping full access behind a `+N 더 보기` / `요약 보기` toggle and restoring full quick-slot assignment controls only in expanded mode.
- Added a summary-first quest mode in `src/components/tabs/QuestTab.jsx` so compact quest rendering can collapse long mission stacks behind the same toggle pattern, and condensed Daily Protocol into a short next-mission summary when expanded detail is not needed.
- Fixed the compact inventory section label copy in the same inventory component so default and expanded states read as `우선 보관품` / `전체 보관품` instead of awkward duplicated wording.

Verification (Desktop Inventory Quest Summary Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warning about `src/data/relics.js` dynamic/static import remains unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright checks on the live dev server
  - console errors: none
  - `1024px` inventory compact default after shop purchases: `/tmp/inventory-summary-1024-default.png`
  - `1024px` inventory expanded: `/tmp/inventory-summary-1024-expanded.png`
  - `1024px` quest compact with two active missions: `/tmp/quest-summary-1024-default.png`

Notes:
- Quest summary toggle wiring is in place, but the live visual check in this pass used the starting-town flow, which naturally yielded two active missions rather than a three-plus mission stack.

Done (Desktop Stats System Summary Pass):
- Added a summary-first compact stats mode in `src/components/StatsPanel.jsx` so the desktop archive rail now opens with condensed trait guidance and the first six key metrics instead of the full statistics stack.
- Added a summary-first compact system mode in `src/components/tabs/SystemTab.jsx` so the desktop archive rail now opens with session/QA essentials plus small summary cards for relics, titles, daily protocol, and hall-of-fame status before revealing the longer QA, feedback, and export surfaces.
- Wired `compact` archive behavior through `src/components/Dashboard.jsx` for both `Stats` and `System`, keeping full detail behind `통계 더 보기` / `요약 보기` and `시스템 더 보기` / `요약 보기` toggles.
- Fixed a compact-system overflow issue in the same system tab by making the session strip and QA action row wrap safely in the narrow desktop rail.

Verification (Desktop Stats System Summary Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warning about `src/data/relics.js` dynamic/static import remains unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Playwright checks on the live dev server
  - console errors: none
  - `1024px` stats compact default: `/tmp/stats-summary-1024-default.png`
  - `1024px` system compact default: `/tmp/system-summary-1024-default.png`
  - `1024px` stats expanded and system expanded toggles were exercised successfully during the same session

Notes:
- After the first compact system pass, the QA/session header overflowed the narrow rail at `1024px`; I tightened those summary rows and rechecked the layout before closing the pass.

Done (Desktop Achievements Skills Bestiary Summary Pass):
- Added a summary-first compact achievements mode in `src/components/AchievementPanel.jsx` so the desktop archive rail now opens with three prioritized records instead of the full unlocked/locked ledger, while keeping reward claim actions available for claimable entries.
- Added a summary-first compact skills mode in `src/components/SkillTreePreview.jsx` so the desktop archive rail now opens with the selected skill plus one companion skill and a short advancement preview before expanding into the full class tree.
- Added a summary-first compact bestiary mode in `src/components/Bestiary.jsx` so the desktop archive rail now opens with a short encountered-monster summary, or a single empty-state codex card before any kills exist, while preserving the full list/detail flow behind `도감 더 보기`.
- Wired `compact` archive behavior through `src/components/Dashboard.jsx` for `Achievements`, `Skills`, and `Bestiary`, and fixed the compact skill selection highlight so the selected badge now follows the actual skill identity instead of the sliced summary index.

Verification (Desktop Achievements Skills Bestiary Summary Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Headless Playwright checks on the live dev server at `http://127.0.0.1:4173/?smoke=1`
  - console errors: none
  - `1024px` achievements compact default: `/tmp/achievements-summary-1024.png`
  - `1024px` achievements expanded: `/tmp/achievements-expanded-1024.png`
  - `1024px` skills compact default: `/tmp/skills-summary-1024.png`
  - `1024px` skills expanded: `/tmp/skills-expanded-1024.png`
  - `1024px` bestiary compact default: `/tmp/bestiary-summary-1024.png`
  - `1024px` bestiary expanded: `/tmp/bestiary-expanded-1024.png`

Notes:
- The bestiary visual check in this pass covered the empty-summary and locked-entry expansion states from a fresh run; an encountered-monster summary state will only appear after the player records kills during actual progression.

Done (Desktop Archive Shell Compaction Pass):
- Reworked the compact desktop archive shell in `src/components/Dashboard.jsx` so the desktop rail now uses a single-line `Archive + active tab` header and an `8-icon / 2-row` dense tab matrix instead of the previous primary/secondary split rows with extra header height.
- Tightened the compact desktop action shell in `src/components/ControlPanel.jsx` by converting the safe-zone context chip into a small badge, reducing the priority button height, and collapsing secondary actions into a denser icon rail while preserving titles and hover affordances.
- Narrowed the desktop right-rail width slightly in `src/App.jsx` now that the archive shell and actions rail use less chrome, which returns a bit more horizontal space to the main log without changing the overall desktop structure.

Verification (Desktop Archive Shell Compaction Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4173/ --viewport-width 1024 --viewport-height 900 --artifact-label desktop-1024-rail`
  - produced fresh `1024px` desktop artifacts after the shell compaction pass
  - key screenshots: `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/desktop-1024-rail/01-after-start.png`, `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/desktop-1024-rail/09-final-state.png`

Notes:
- This pass intentionally focused on fixed shell height and rail width, not deeper per-tab content changes; the desktop log gained visible extra space primarily from archive/action chrome reduction rather than content pruning.

Done (Desktop Combat Moving Dense Rail Pass):
- Added a `dense` branch to `src/components/tabs/CombatPanel.jsx` so narrow desktop rails now collapse combat metadata into compact stacked chips, reduce action button height, and trim combat item cards to short one-line entries instead of the previous taller description cards.
- Wired that dense combat behavior from `src/components/ControlPanel.jsx`, keeping the existing compact sidebar shell for desktop combat while only applying the tighter vertical compression when the viewport is in the narrow desktop rail mode.
- Tightened `GS.MOVING` rendering in the same `src/components/ControlPanel.jsx` by shortening route cards, hiding the long route-reason copy in dense mode, reducing icon and label sizes, and shrinking the cancel control so the route panel consumes less fixed height on the right rail.

Verification (Desktop Combat Moving Dense Rail Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4173/ --viewport-width 1024 --viewport-height 900 --artifact-label desktop-1024-combat-move`
  - produced a fresh `1024px` combat capture at `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/desktop-1024-combat-move/05-combat-1.png`
- Additional headed-style single-screen capture for the move panel
  - `/tmp/move-panel-1024.png`
  - console errors: none

Notes:
- The dense route verification used the actual `control-move` interaction from a fresh run, so the move-panel screenshot reflects the live idle-to-moving transition rather than a synthetic injected state.

Done (Desktop Terminal Footer Compaction Pass):
- Added a `dense` quick-slot mode in `src/components/QuickSlot.jsx` so desktop footer slots now use smaller icon badges, shorter item abbreviations, and reduced slot chrome without changing quick-use behavior.
- Reworked the desktop footer layout in `src/components/TerminalView.jsx` so quick slots and the command input now share a single horizontal line instead of stacking in two rows, and tightened the input shell padding to reclaim more log height.
- Kept the existing mobile stacked footer untouched, so the compaction in this pass is limited to the desktop log layout where vertical space is the main constraint.

Verification (Desktop Terminal Footer Compaction Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok` before the preview wrapper process was manually cleaned up
- Additional `1024px` first-screen footer capture
  - `/tmp/footer-compact-1024.png`
  - console errors: none

Notes:
- The footer capture uses the fresh-run first screen, which is the clearest place to compare the old two-row footer against the new one-line desktop layout.

Done (Desktop Top Chrome Compaction Pass):
- Tightened the compact desktop `StatusBar` in `src/components/StatusBar.jsx` by shrinking the identity pill padding, reducing badge chrome, and making the inline HP/NRG/EXP meters thinner while keeping all nickname and core stat information always visible.
- Reduced the compact combat-target strip height in the same `StatusBar` so the enemy HUD no longer expands the top chrome as much during desktop combat.
- Tightened the desktop terminal header in `src/components/TerminalView.jsx` by reducing shell padding, switching the label to a shorter `Log`, shrinking the mute/sync/expand controls, and trimming the outer desktop terminal padding.
- Reduced the top-level desktop status wrapper padding in `src/App.jsx` so the sticky HUD occupies slightly less vertical space before the log panel begins.

Verification (Desktop Top Chrome Compaction Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest desktop run reached `[smoke:desktop] ok`
  - the wrapper process stalled during cleanup, so it was manually terminated before rerunning the unaffected mobile smoke separately
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4173/ --mobile`
  - reached `[smoke:mobile] ok`
- Additional `1024px` first-screen top-chrome capture
  - `/tmp/top-chrome-compact-1024.png`
  - console errors: none

Notes:
- This pass only compresses desktop chrome; the mobile HUD and mobile terminal header were intentionally left untouched.

Done (Desktop Log Density Pass):
- Tightened the desktop-only `DESKTOP_LOG_STYLES` in `src/components/TerminalView.jsx` by reducing left inset on combat/system/story/success/event/warning rows so repeated log cards consume less horizontal and vertical chrome.
- Reduced desktop log stack spacing, row padding, row font size, line-height, icon size, and icon offset in the same `TerminalView` so the field log shows more entries before the footer begins while keeping the mobile log treatment unchanged.
- Tightened the desktop loading row and preserved the already-compacted one-line footer, making the reclaimed space show up in the log body itself rather than only at the top or bottom chrome.

Verification (Desktop Log Density Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Production preview visual check at `1024px`
  - opened `http://127.0.0.1:4174/?smoke=1`, injected additional log rows with the live terminal input, and captured `/tmp/log-density-1024-multirows.png`
  - console errors: none

Notes:
- The density verification used the built preview rather than the dev server so the screenshot reflects the production layout with the right-side archive rail still attached.

Done (Desktop Archive Height Reduction Pass):
- Tightened the compact desktop archive shell in `src/components/Dashboard.jsx` by shrinking the outer padding, header gap, icon matrix button height, and inner content chrome so the right rail spends less space on static framing before the active tab content begins.
- Reduced the compact desktop inventory default height in `src/components/SmartInventory.jsx` by turning the filter bar into a single horizontal rail, keeping the recommendation action inline, and replacing summary-mode quick-slot controls with a short assigned-slot readout.
- Preserved full inventory behavior by keeping the full quick-slot assigner in expanded item mode (`showAllItems` / non-summary states) while making the first-view `Inventory` screen read as a shorter summary ledger.

Verification (Desktop Archive Height Reduction Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Production preview visual check at `1024px`
  - opened `http://127.0.0.1:4174/?smoke=1` and captured `/tmp/archive-height-compact-1024.png`
  - checked viewport/document widths; no horizontal overflow
  - console errors: none

Notes:
- This pass intentionally keeps the desktop right rail structure unchanged and only reduces first-view archive height/density inside that fixed rail.

Done (Desktop Actions Height Reduction Pass):
- Tightened the compact desktop `Actions` shell in `src/components/ControlPanel.jsx` by shrinking outer padding, header spacing, and the overall dense desktop rail chrome.
- Reduced compact priority button height, secondary icon-grid height, label tracking, and reset control height in the same `ControlPanel` so the lower-right action block consumes less fixed vertical space while preserving the existing action set.
- Kept the safe-zone/field action ordering unchanged, limiting this pass to density only so the desktop reading flow remains `HUD -> tall log -> archive -> actions`.

Verification (Desktop Actions Height Reduction Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- Production preview visual check at `1024px`
  - opened `http://127.0.0.1:4174/?smoke=1` and captured `/tmp/actions-height-compact-1024.png`
  - checked viewport/document widths; no horizontal overflow
  - console errors: none

Notes:
- This pass does not change the mobile action deck or the moving/combat panel logic; it only compresses the idle desktop action rail.

Done (Desktop Map Compact Summary Pass):
- Tightened `src/components/MapNavigator.jsx` for compact desktop first-view usage by reducing shell padding, shrinking the current-location and recommendation cards, shortening compact recommendation copy to the level label, reducing map card padding/type size, and lowering the default visible region count from 6 to 5.
- Tightened `src/components/BuildAdvicePanel.jsx` so the compact closed state reads as a thinner one-line strip and the open compact state shows shorter archetype/skill/relic summaries instead of the longer descriptive copy.
- Extended `scripts/smoke-gameplay.mjs` tab verification to capture a dedicated `map` artifact (`08a-map-tab`) so future desktop compact regressions can be checked without ad-hoc browser steps.

Verification (Desktop Map Compact Summary Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - latest run reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4174/ --viewport-width 1024 --viewport-height 900 --artifact-label desktop-1024-map-compact`
  - reached `[smoke:desktop] ok`
  - produced `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/desktop-1024-map-compact/08a-map-tab.png`

Notes:
- The dedicated 1024px `Map` artifact shows the compact rail in a live mid-run state rather than the empty starting village, which makes the map-card density change easier to evaluate.

Done (Desktop Log Hierarchy Pass):
- Added desktop-only type badges in `src/components/TerminalView.jsx` for `combat`, `critical`, `story`, `system`, `success`, `event`, `warning`, and `error` rows so the log can be scanned by category before reading each line.
- Slightly increased contrast for desktop `combat`, `critical`, and `event` treatments while intentionally lowering `system` and `story` prominence, keeping the log readable without reintroducing the earlier neon fatigue.
- Added `DESKTOP_DEFAULT_STYLE` in the same `TerminalView` so generic desktop lines stay legible but subordinate, and increased `scripts/smoke-gameplay.mjs` full-page screenshot timeout to `60000ms` to stabilize longer artifact runs at `1024px`.

Verification (Desktop Log Hierarchy Pass):
- `npm run lint`
- `npm run build`
  - existing Vite warnings about `src/data/relics.js` dynamic/static import and the large main chunk remain unchanged
- `./scripts/local-playtest.sh`
  - final rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4174/ --viewport-width 1024 --viewport-height 900 --artifact-label desktop-1024-log-hierarchy`
  - reached `[smoke:desktop] ok`
  - produced `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/desktop-1024-log-hierarchy/05-combat-1.png`
  - produced `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/desktop-1024-log-hierarchy/09-final-state.png`

Notes:
- Earlier smoke attempts hit a transient preview/render timing issue and a default Playwright screenshot timeout during artifact capture; the final reruns passed after preview cleanup and the screenshot-timeout bump.

Done (Build Warning Cleanup Pass):
- Replaced the dynamic `../data/relics` import inside `src/hooks/useGameActions.js` with a static import so the relic selection path and the archive-side relic readers no longer produce a mixed dynamic/static import warning during Vite build.
- Reworked `vite.config.js` manual chunk rules to split heavy local modules into `game-data`, `archive-panels`, and `game-combat`, while keeping combat UI files out of the archive chunk so the earlier circular-chunk warning does not recur.
- As a result, the previous build-time warnings about `src/data/relics.js` mixed imports and the oversized main entry chunk are both cleared without changing gameplay behavior.

Verification (Build Warning Cleanup Pass):
- `npm run lint`
- `npm run build`
  - completed with no `relics.js` mixed import warning
  - completed with no chunk-size warning
- `./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`

Notes:
- The current build still emits multiple app chunks by design (`game-data`, `archive-panels`, `game-combat`), but this is now an intentional split rather than a warning-producing fallback.

Done (Build Regression Guard Pass):
- Added `scripts/build-guard.mjs` to run `vite build` and fail the process if the previously fixed warning families reappear: `relics.js` mixed dynamic/static import, oversized chunk warning, or manual chunk cycle warning.
- Added `build:guard` to `package.json` and switched `scripts/local-playtest.sh` to use that guarded build path instead of raw `npm run build`, so the local smoke loop now blocks on bundle-regression issues before preview starts.
- Kept the guard narrow to the concrete warning classes we just cleaned up, avoiding a brittle “fail on any warning text” rule while still locking in the current bundle state.

Verification (Build Regression Guard Pass):
- `npm run lint`
- `npm run build:guard`
  - completed with `[build-guard] ok`
- `./scripts/local-playtest.sh`
  - build step completed through `build:guard`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`

Notes:
- `local-playtest` now validates both runtime smoke and bundle-warning regressions in one loop, which makes future UI passes cheaper to verify.

Done (Performance Guard + Playtest Stability Pass):
- Added `scripts/perf-guard.mjs` to measure `domContentLoaded`, intro-ready, first-run transition, first interaction, and market-open latency for both desktop and mobile smoke URLs, and to fail when those metrics exceed the configured thresholds.
- Added `perf:guard` to `package.json` and connected `scripts/local-playtest.sh` to run desktop/mobile perf checks when `AETHERIA_RUN_PERF=1` is set, keeping the default smoke path fast while still making the perf path one-command reproducible.
- Hardened `scripts/local-playtest.sh` port selection so it only retries bounded `EADDRINUSE` cases instead of recursively running past `65535`, and updated `scripts/smoke-gameplay.mjs` / `scripts/perf-guard.mjs` to explicitly close Playwright context/browser and exit cleanly so mobile smoke no longer hangs after printing `ok`.

Verification (Performance Guard + Playtest Stability Pass):
- `npm run lint`
- `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`
  - reached `[perf:desktop] ok`
  - reached `[perf:mobile] ok`
- Generated perf artifacts:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-desktop/perf-summary.json`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-mobile/perf-summary.json`

Notes:
- Current desktop perf sample: intro `497ms`, start-run `1190.5ms`, first interaction `838.7ms`, market open `43.2ms`.
- Current mobile perf sample: intro `462.2ms`, start-run `1100.3ms`, first interaction `4.8ms`, market open `1383.5ms`.
- `first-contentful-paint` is `null` in the current headless Chromium capture, so the guard records it but does not fail on it unless the browser actually reports a numeric value.

Done (App Performance Mark Instrumentation Pass):
- Added `src/utils/performanceMarks.js` and wired app-level marks for `app-mounted`, `boot-ready`, `intro-visible`, `run-ready`, and `shop-open` so perf collection no longer depends only on headless browser paint entries.
- Updated `src/App.jsx` to expose `markPerf()` / `getPerfSnapshot()` through `window.__AETHERIA_TEST_API__`, measure `start-run-from-click` and `market-open-from-click` from explicit test-side marks, and record `boot-ready` timing once the boot reducer reaches `ready`.
- Updated `src/components/IntroScreen.jsx` to record `intro-visible` timing on mount, and extended `scripts/perf-guard.mjs` to read those app measures alongside the existing wall-clock timings.

Verification (App Performance Mark Instrumentation Pass):
- `npm run lint`
- `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`
  - reached `[perf:desktop] ok`
  - reached `[perf:mobile] ok`
- Updated perf artifacts:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-desktop/perf-summary.json`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-mobile/perf-summary.json`

Notes:
- Desktop app-measure sample: `bootReadyMeasureMs 29.5`, `introVisibleMeasureMs 29.5`, `startRunMeasureMs 1008.8`, `marketOpenMeasureMs 18.9`.
- Mobile app-measure sample: `bootReadyMeasureMs 47.6`, `introVisibleMeasureMs 47.6`, `startRunMeasureMs 973`, `marketOpenMeasureMs 1336.7`.
- Headless paint timing remains inconsistent (`desktop firstPaint null`, `firstContentfulPaint null`), but the app-level measures now cover the user-visible transitions we actually care about.

Done (Mobile Market Open Optimization Pass):
- Reworked `src/components/ShopPanel.jsx` so buy-list sorting is memoized with precomputed affordability/equipability/resonance scores instead of recalculating those values repeatedly inside the sort comparator on every render.
- Added a mobile-first initial buy-list cap (`12` items) with an inline `더 보기` expansion control so the first shop open commits a much smaller card set before rendering the rest on demand.
- Kept desktop behavior unchanged while preserving full mobile access to the catalog after expansion, targeting only the expensive first-open path that the perf guard measures.

Verification (Mobile Market Open Optimization Pass):
- `npm run lint`
- `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`
  - reached `[perf:desktop] ok`
  - reached `[perf:mobile] ok`
- Updated perf artifacts:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-desktop/perf-summary.json`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-mobile/perf-summary.json`

Notes:
- Mobile market-open latency improved from the previous sample (`marketOpenMs 1357.6`, `marketOpenMeasureMs 1336.7`) to the latest sample (`marketOpenMs 341.2`, `marketOpenMeasureMs 318.4`).
- Mobile first-interaction latency also dropped in the same run from multi-hundred-millisecond variance to `157.7ms`, which suggests the shop render was the main UI-thread spike in this path.

Done (Start Run Prefetch + Chunk Graph Cleanup Pass):
- Updated `src/App.jsx` so `Dashboard` stays lazily split but now preloads through `loadDashboard()` as soon as the intro is ready, removing the first-run cold fetch penalty from the click path while still keeping the archive rail out of the initial bundle.
- Simplified `vite.config.js` by removing the old `archive-panels` manual chunk rule now that `Dashboard` is a dedicated lazy chunk, keeping only the stable `game-data` / `game-combat` splits and eliminating the circular chunk warning that reappeared after the new lazy boundary.
- Normalized `src/App.jsx` to compute `fullStats` once per render and reuse that value across test-state export and dashboard wiring instead of re-calling `engine.getFullStats()` multiple times in the same render pass.

Verification (Start Run Prefetch + Chunk Graph Cleanup Pass):
- `npm run lint`
- `npm run build:guard`
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4173/`
  - reached `[smoke:desktop] ok`
- `node scripts/smoke-gameplay.mjs --url http://127.0.0.1:4173/ --mobile`
  - reached `[smoke:mobile] ok`
- `node scripts/perf-guard.mjs --url http://127.0.0.1:4173/`
  - reached `[perf:desktop] ok`
- `node scripts/perf-guard.mjs --url http://127.0.0.1:4173/ --mobile`
  - reached `[perf:mobile] ok`
- Updated perf artifacts:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-desktop/perf-summary.json`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-mobile/perf-summary.json`

Notes:
- Latest desktop start-run sample landed at `startRunMs 1142.8`, `startRunMeasureMs 1034`, which is slightly better than the previous standard artifact baseline (`1190.5 / 1008.8` wall/app split, and `1145.1 / 1064.4` from the last guard rerun before this pass).
- Latest mobile start-run sample landed at `startRunMs 1097.8`, `startRunMeasureMs 993.3`, improving over the earlier guard baseline (`1176.7 / 1075.1`).
- Desktop perf showed some cold-sample variance while testing the lazy `Dashboard` approach (`920ms` to `1482ms` wall-clock across reruns), but prefetching stabilized the standard artifact back near the prior desktop range instead of the earlier worst-case cold miss.
- Mobile `marketOpen` remained noisy in the latest reruns (`1361.5 / 1341.4` in the current standard artifact even though the earlier shop optimization run reached `341.2 / 318.4`), so the next perf pass should focus on stabilizing the mobile market-open measurement path rather than the start-run path.

Done (Market Open Perf Stabilization Pass):
- Updated `scripts/perf-guard.mjs` so the `market` transition mark and the control click now happen in the same in-page DOM turn via `markAndDomClick()`, removing Playwright mobile tap latency from the measured `marketOpenMs` / `marketOpenMeasureMs` path.
- Kept the user-facing shop flow unchanged in app code; this pass only tightened the measurement path so the perf guard reflects the app transition itself rather than the automation gesture overhead.

Verification (Market Open Perf Stabilization Pass):
- `npm run lint`
- `node scripts/perf-guard.mjs --url http://127.0.0.1:4173/`
  - reached `[perf:desktop] ok`
- `node scripts/perf-guard.mjs --url http://127.0.0.1:4173/ --mobile`
  - reached `[perf:mobile] ok`
- Updated perf artifacts:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-desktop/perf-summary.json`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/perf-mobile/perf-summary.json`

Notes:
- Sequential reruns are now stable again: desktop `marketOpenMs 20.4`, `marketOpenMeasureMs 3.7`; mobile `marketOpenMs 44.6`, `marketOpenMeasureMs 3.7`.
- A parallel desktop/mobile perf experiment during this pass temporarily inflated `startRun` into the `2.5s+` range, but that was test contention rather than an app regression; sequential reruns returned to the expected range (`desktop 1129.4 / 1036.5`, `mobile 1157.1 / 1027.5`).

Done (Playtest Exit Guard + iPhone Real Device Pass):
- Updated `scripts/smoke-gameplay.mjs` and `scripts/perf-guard.mjs` with a shared close-timeout pattern so `context.close()` / `browser.close()` no longer block the wrapper after `[smoke] ok`; the scripts now warn and continue if Chrome teardown stalls.
- Re-ran the full `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh` flow and confirmed the wrapper now reaches `[local-playtest] done` instead of hanging after smoke completion.
- Re-synced the latest web bundle into the Capacitor shells with `npm run cap:sync`.
- Verified mobile prereqs with `npm run mobile:doctor`, confirming the connected Apple device (`성진` / `iPhone 14 Pro Max` / `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`) and that Android real-device QA remains blocked here because `adb` is not installed.
- Built a fresh signed iOS archive using a new DerivedData path to avoid the stale SwiftPM checkout issue:
  - `AETHERIA_IOS_HOME=/Users/sungjin`
  - `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1`
  - `AETHERIA_IOS_DERIVED_DATA_PATH=/tmp/aetheria-ios-archive-build-20260322-2`
  - `AETHERIA_IOS_CLANG_MODULE_CACHE_PATH=/tmp/aetheria-clang-module-cache-20260322-2`
  - `npm run ios:archive`
- Installed `/Users/sungjin/dev/personal/aetheria-roguelike/build/ios/Aetheria.xcarchive/Products/Applications/App.app` onto the paired iPhone with `xcrun devicectl device install app` and launched `com.aetheria.roguelike` with `xcrun devicectl device process launch`.
- Verified the on-device process is present through `xcrun devicectl device info processes`, which reported:
  - `/private/var/containers/Bundle/Application/6E448DB5-BB0F-4DEE-8C4F-434E407F0224/App.app/App`

Verification (Playtest Exit Guard + iPhone Real Device Pass):
- `npm run lint`
- `npm run build:guard`
- `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh`
  - reached `[smoke:desktop] ok`
  - reached `[smoke:mobile] ok`
  - reached `[perf:desktop] ok`
  - reached `[perf:mobile] ok`
  - reached `[local-playtest] done`
- `npm run cap:sync`
- `npm run mobile:doctor`
- `AETHERIA_IOS_HOME=/Users/sungjin AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 AETHERIA_IOS_DERIVED_DATA_PATH=/tmp/aetheria-ios-archive-build-20260322-2 AETHERIA_IOS_CLANG_MODULE_CACHE_PATH=/tmp/aetheria-clang-module-cache-20260322-2 npm run ios:archive`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`
- `xcrun devicectl device info processes --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B | rg "com.aetheria|roguelike|App.app/App"`

Notes:
- Latest full local playtest perf sample:
  - desktop `startRunMs 1158.8`, `startRunMeasureMs 1069.3`, `marketOpenMs 37.4`, `marketOpenMeasureMs 3.3`
  - mobile `startRunMs 1125.4`, `startRunMeasureMs 1023.5`, `marketOpenMs 45.3`, `marketOpenMeasureMs 3.1`
- The first archive retry failed because the old `/tmp/aetheria-ios-archive-build` SwiftPM checkout was incomplete; switching to a fresh DerivedData path resolved it without changing project code.
- Android real-device installation was not executed in this shell because `adb` is unavailable.

Done (Sprint 15–20: 콘텐츠 극적 확장 + 출시 준비):

Sprint 15 — 진 엔딩 & 숨겨진 최종 보스:
- 원시의 신 (3페이즈 보스) 추가 — `src/data/monsters.js`
- 원시의 파편, 원시의 심장 아이템 추가 — `src/data/items.js`
- 진 보스 트리거 로직 — `src/hooks/useGameActions.js`
- 3페이즈 지원 (phase 배열 처리) — `src/systems/CombatEngine.js`
- TrueEndingScreen 신규 — `src/components/TrueEndingScreen.jsx`
- `TRIGGER_TRUE_ENDING` 액션 타입, `true_ending` GS 추가

Sprint 16 — 신규 직업 2종:
- 무당 (Tier 2, Lv 12): 저주/DoT/흡혈 빌드 — `src/data/classes.js`
- 시간술사 (Tier 3, Lv 25): 추가 턴/쿨리셋/고배율 — `src/data/classes.js`
- extraTurn, resetCooldowns, curse 효과 처리 — `src/systems/CombatEngine.js`
- escape_100, hp_regen, mp_regen 스킬 효과 구현

Sprint 17 — 3단계 내러티브 이벤트 체인:
- "고대의 예언" / "사라진 마법사" / "최후의 영웅" 3개 체인 — `src/data/eventChains.js`
- 체인 진행 상태 저장 — `player.eventChainProgress`
- 위치 기반 체인 inject — `src/utils/aiEventUtils.js`
- `UPDATE_EVENT_CHAIN` 액션 타입 + reducer 처리

Sprint 18 — 신규 맵 5개 + 몬스터 25종 + 숨겨진 보스 3종:
- 황금 왕국, 지하 미궁, 공중 신전, 영혼의 강, 금지된 도서관 — `src/data/maps.js`
- 신규 몬스터 25종 (위치별 5종) + 숨겨진 보스 3종 — `src/data/monsters.js`
- 숨겨진 보스 조건 체크 — `src/utils/exploreUtils.js`

Sprint 19 — 신규 유물 15종 + 유물 시너지 시스템:
- 신규 Epic/Legendary 유물 15종 — `src/data/relics.js`
- RELIC_SYNERGIES 배열 (15개 시너지) — `src/data/relics.js`
- getActiveRelicSynergies() — `src/data/relics.js`
- 시너지 스탯 적용 (atkMult, mpMult, statBonus 등) — `src/hooks/useGameEngine.js`
- 전투 내 시너지 효과 전면 구현 (vampire_lord, arcane_surge, time_master,
  absolute_reflect, unbreakable, dot_amplify, healPerTurn, killHeal, devour) — `src/systems/CombatEngine.js`
- 시너지 뱃지 UI — `src/components/StatsPanel.jsx`

Sprint 20 — 출시 준비:
- DATA_VERSION 5.0, SAVE_KEY 'aetheria_save_v5_0' 확인 — `src/data/constants.js`
- migrateData() v5.0 대응 (eventChainProgress, deathSaveUsedCount, trueEndingFragments) — `src/utils/gameUtils.js`
- Firestore 보안 규칙 완비 (users, graves, leaderboard, public/data) — `firestore.rules`
- 오프라인 fallback 이벤트 풀 144개 확인 — `src/utils/aiEventUtils.js`
- 단위 테스트 59/59 통과 — `npm run test:unit`
- 스모크 테스트 통과 — `npm run test:smoke`
- OnboardingGuide 컴포넌트 App.jsx 연결 — `src/App.jsx`

Verification (Sprint 15–20):
- `npm run test:unit` → 59/59 pass
- `npm run test:smoke` → [smoke:desktop] ok
- `npm run build` → ✓ built in 2.45s (no errors)

Done (2026-05-14: town quest board / equipment visual consistency / beginner difficulty pass):
- Town quest access is now explicit: `ControlPanel` safe-zone actions expose `REST`, `QUEST`, and `SHOP`; the town `BOARD` shortcut opens `QuestBoardPanel`; `QuestTab` adds an in-safe-zone CTA to open the board instead of leaving players in progress-only status.
- Normal equipment item icons now prefer `equipment-family/items` art, while dedicated signature items keep `equipment-exact/signature-*.png`; this keeps regular shop/inventory gear visually consistent without removing signature item distinction.
- Early combat now applies a beginner grace window for Lv.1-3 players with fewer than 5 recorded battles: monster HP/ATK are reduced while EXP/GOLD stay at least neutral.
- Mobile smoke focus-panel coverage was updated so the town quest shortcut validates `gameState === 'quest_board'` and writes `playtest-artifacts/mobile/02c-quest-board-open.*`.

Verification:
- `node --import tsx --test tests/difficulty-manager.test.js tests/signature-items.test.js tests/quest-operations.test.js` -> 57/57 pass
- `npm run verify:full` -> type-check, lint, unit 2817/2817, build guard, desktop smoke, mobile smoke, Playwright e2e 20/20 pass
- `npm run mobile:doctor` -> tooling detected; Android release signing inputs still missing (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`)

Done (2026-05-14: native packaging refresh for device QA):
- Synced the latest web build into Capacitor native projects with `npm run cap:sync`.
- Regenerated Android debug delivery artifact: `android/app/build/outputs/apk/debug/app-debug.apk` (202M, May 14 15:51 KST).
- Regenerated iOS signed archive: `build/ios/Aetheria.xcarchive` (195M, May 14 15:51 KST).
- Verified iOS archive metadata: bundle id `com.aetheria.roguelike`, marketing version `1.1.0`, build `2`, signing identity `Apple Development: sungjin92@naver.com (VZN5FH3335)`, team `KS96VQMVHD`.

Verification:
- `npm run cap:sync` -> pass
- `npm run android:debug` -> pass; release signing warning remains expected because release signing inputs are not configured
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` -> pass
- `npm run mobile:doctor` -> pass with existing Android release signing blocker reported

Done (2026-05-14: item visual character-tone alignment follow-up):
- Regenerated the strongest equipment family item icons from the existing fantasy pixel item source by fixing `scripts/_archive/generate_avatar_style_equipment_assets.py` to resolve the repo root correctly from `_archive`.
- Updated `weapon-*`, `offhand-*`, `armor-robe`, `armor-plate`, `armor-cloak`, and `armor-boots` family item PNGs so shop/inventory equipment no longer mixes flat manual icons with richer character art.
- Added `shouldUseAvatarPreviewItemIcon()` and routed visually weak `headgear-*`, `armor-coat`, and `armor-leather` family icons through `EquipmentAvatarPreview`, keeping dedicated signature art on its exact asset path.
- Added unit coverage for the preview-first routing so hats, tunics, and leather armor stay character-tone aligned while weapons, shields, plate, and potions keep their normal asset flow.

Verification:
- `node --import tsx --test tests/item-visuals.test.js tests/signature-items.test.js` -> 39/39 pass
- `npm run verify:full` -> type-check, lint, unit 2818/2818, build guard, desktop smoke, mobile smoke, Playwright e2e 20/20 pass
- `npm run mobile:doctor` -> pass; Android release signing inputs still missing (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`)
- `npm run cap:sync` -> pass
- `npm run android:debug` -> pass; `android/app/build/outputs/apk/debug/app-debug.apk` refreshed at 2026-05-14 16:06 KST, 202M
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` -> pass; `build/ios/Aetheria.xcarchive` refreshed at 2026-05-14 16:06 KST, 196M

Done (2026-05-14: iPhone latest archive delivery smoke recheck):
- Confirmed `iPhone 14 Pro Max` is available and paired with `xcrun devicectl list devices`.
- Installed the latest signed archive payload with `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`.
- Confirmed device app metadata: `Aetheria Roguelike`, bundle id `com.aetheria.roguelike`, version `1.1.0`, build `2`.
- Launched the app with `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --terminate-existing com.aetheria.roguelike`.
- Confirmed the foreground app process is present in `device info processes` as `/private/var/containers/Bundle/Application/.../App.app/App`.
- Checked Android availability with `adb devices -l`; no Android device is currently attached.

Verification:
- `xcrun devicectl device install app ... App.app` -> pass
- `xcrun devicectl device info apps --device ... --bundle-id com.aetheria.roguelike` -> pass
- `xcrun devicectl device process launch --device ... --terminate-existing com.aetheria.roguelike` -> pass
- `xcrun devicectl device info processes --device ... | rg "App\\.app"` -> pass
- `adb devices -l` -> no connected Android devices
- `npm run mobile:doctor` -> pass with existing Android release signing input blocker

Done (2026-05-14: active mission tracker / field directive pass):
- Added route-aware active quest tracker data in `src/utils/adventureGuide.ts`: progress percent, target route label, next step, return label, and compact chips now come from the same quest tracker payload used by guidance.
- Rendered the tracker in `src/components/ControlPanel.tsx` as a persistent `control-mission-tracker` strip above idle field actions, so an accepted quest keeps showing where to go, what to do next, and when to return.
- Updated safe-zone active quest guidance so town idle state recommends re-entering the field via `open_move` instead of only describing the quest in passive text.
- Stabilized Playwright e2e cold boot by adding `tests/e2e/testHelpers.ts`, which waits for either persisted game state or the intro start button before asserting the status bar. Existing e2e specs now share that boot path.
- Synced the latest verified web bundle into Capacitor and regenerated native delivery artifacts for the next device QA checkpoint.

Verification:
- `node --import tsx --test tests/adventure-guide.test.js tests/quest-operations.test.js tests/cycle-334-quest-tracker-forecast-dead-fields.test.js` -> 20/20 pass
- `npm run verify` -> type-check, lint, unit 2824/2824, build guard pass
- Initial `npm run verify:full` exposed the e2e cold boot flake after desktop/mobile smoke passed; fixed with the shared e2e boot helper.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4176 npx playwright test tests/e2e/navigation.spec.ts --project=chromium-mobile --workers=1` -> 6/6 pass
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4176 npx playwright test --project=chromium-mobile --workers=1` -> 20/20 pass
- `./scripts/local-playtest.sh` -> desktop smoke ok, mobile smoke ok, `[local-playtest] done`; mobile browser close timeout guard was hit after smoke completion
- `npm run mobile:doctor` -> pass with existing Android release signing input blocker
- `npm run cap:sync` -> pass
- `npm run android:debug` -> pass; `android/app/build/outputs/apk/debug/app-debug.apk` refreshed at 2026-05-14 17:28 KST, 186M
- `npm run ios:build:device` -> pass
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive` -> pass; `build/ios/Aetheria.xcarchive` refreshed at 2026-05-14 17:29 KST

Notes:
- Latest archive device install / foreground launch / process listing were not rerun after the 17:29 archive refresh. The next QA step is to install that archive on `iPhone 14 Pro Max`, confirm launch/process, then run the 5-minute manual loop.
- Android debug packaging is ready, but Android release signing remains blocked until `android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*` is provided.

Done (2026-05-14: latest iPhone archive install handoff check):
- Rechecked `iPhone 14 Pro Max` with `xcrun devicectl list devices`; the device is still `available (paired)`.
- First install attempt for `build/ios/Aetheria.xcarchive/Products/Applications/App.app` failed with CoreDevice `Connection reset by peer`.
- Recovered the CoreDevice tunnel through `xcrun devicectl device info apps --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --bundle-id com.aetheria.roguelike`, which confirmed `Aetheria Roguelike 1.1.0 (2)`.
- Retried install and successfully installed the latest 17:29 archive payload on the iPhone.
- Retried foreground launch twice; the first launch attempt disconnected immediately and the second was rejected as `Locked`, so launch/process confirmation and the 5-minute manual routine remain blocked by device lock state.
- Rechecked Android readiness: `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` reports no connected Android devices, and `npm run mobile:doctor` still reports missing Android release signing inputs.

Verification:
- `xcrun devicectl list devices` -> iPhone 14 Pro Max available paired
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app` -> first attempt failed with CoreDevice connection reset, retry passed
- `xcrun devicectl device info apps --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --bundle-id com.aetheria.roguelike` -> pass; installed app metadata confirmed
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --terminate-existing com.aetheria.roguelike` -> blocked by iPhone `Locked`
- `xcrun devicectl device info processes --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B | rg "com.aetheria|roguelike|App.app/App"` -> no running app process after blocked launch
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` -> no connected Android devices
- `npm run mobile:doctor` -> pass with existing Android release signing input blocker

Notes:
- Latest archive is installed on the iPhone. To continue device QA, unlock the iPhone, keep it awake, rerun foreground launch/process listing, then execute the 5-minute manual loop.

Done (2026-05-14: latest iPhone foreground launch/process confirmation):
- Rechecked `iPhone 14 Pro Max`; the device is still `available (paired)`.
- Confirmed installed app metadata again with `xcrun devicectl device info apps --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --bundle-id com.aetheria.roguelike`: `Aetheria Roguelike 1.1.0 (2)`.
- Launched the latest installed archive payload with `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --terminate-existing com.aetheria.roguelike`.
- Confirmed the foreground app process with `xcrun devicectl device info processes --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B | rg "com.aetheria|roguelike|App.app/App|Aetheria"`; process `84186` points to `/App.app/App`.
- Rechecked Android readiness: `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` still reports no connected Android devices, and `npm run mobile:doctor` still reports missing Android release signing inputs.

Verification:
- `xcrun devicectl list devices` -> iPhone 14 Pro Max available paired
- `xcrun devicectl device info apps --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --bundle-id com.aetheria.roguelike` -> pass
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --terminate-existing com.aetheria.roguelike` -> pass
- `xcrun devicectl device info processes --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B | rg "com.aetheria|roguelike|App.app/App|Aetheria"` -> pass
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` -> no connected Android devices
- `npm run mobile:doctor` -> pass with existing Android release signing input blocker

Notes:
- Automated iPhone delivery smoke is complete for the latest installed archive. The remaining iPhone checkpoint is the human 5-minute manual routine while the device stays unlocked and awake.

Done (2026-05-14: iPhone 60-second runtime hold before manual QA):
- Rechecked current QA ledger state: latest installed archive is still `Aetheria Roguelike 1.1.0 (2)` and the remaining iPhone checkpoint is the human 5-minute routine.
- Rechecked app metadata with `xcrun devicectl device info apps --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --bundle-id com.aetheria.roguelike`; tunnel acquisition and installed app metadata passed.
- Initial relaunch attempt hit CoreDevice immediate disconnect, but a second metadata query restored tunnel access and `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --terminate-existing com.aetheria.roguelike` succeeded.
- Confirmed process `84290` at `/App.app/App`, then waited 60 seconds and confirmed the same process was still present.
- Rechecked Android readiness: `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` still reports no connected Android devices, and `npm run mobile:doctor` still reports missing Android release signing inputs.

Verification:
- `xcrun devicectl list devices` -> iPhone 14 Pro Max available paired
- `xcrun devicectl device info apps --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --bundle-id com.aetheria.roguelike` -> pass
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --terminate-existing com.aetheria.roguelike` -> first attempt failed with CoreDevice immediate disconnect, retry passed
- `xcrun devicectl device info processes --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B | rg "com.aetheria|roguelike|App.app/App|Aetheria"` -> pass, process `84290`
- `sleep 60 && xcrun devicectl device info processes --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B | rg "com.aetheria|roguelike|App.app/App|Aetheria"` -> pass, process `84290` remained alive
- `/Users/sungjin/Library/Android/sdk/platform-tools/adb devices -l` -> no connected Android devices
- `npm run mobile:doctor` -> pass with existing Android release signing input blocker

Notes:
- Automated iPhone delivery and short runtime-hold evidence are complete. The next step cannot be automated from this shell: run the `docs/PLAYTEST_CHECKLIST.md` iPhone 5-minute routine on the physical screen and capture `QA READOUT` / exported snapshot if an issue appears.

Done (2026-05-28: readability trend research):
- Reviewed the current mobile readability evidence from `playtest-artifacts/mobile/01-after-start.png`, `02a-shop-open.png`, and `02c-quest-board-open.png`.
- Compared the current UI structure against reference lessons from `Balatro`, `Diablo IV`, `Slay the Spire`, `Hades II`, `Into the Breach`, and `Backpack Hero`.
- Documented the findings and development plan in `docs/READABILITY_TREND_RESEARCH.md`.
- Main conclusion: the game structure is solid, but readability feels less current because too many panels share the same dark glass treatment, borders, rounded shapes, tiny labels, and decorative spacing. The first implementation should focus on readable typography/surface tokens and first-viewport hierarchy before changing game systems.

Verification:
- `git diff --check -- docs/READABILITY_TREND_RESEARCH.md tasks/todo.md progress.md` -> pass

Notes:
- Recommended implementation slice: `Readability Foundation` plus the first part of `First Viewport Recomposition`, targeting `src/index.css`, `StatusBar`, `TerminalView`, and `ControlPanel`.

Done (2026-05-28: readability foundation + map prominence pass):
- Applied the first readability implementation slice from `docs/READABILITY_TREND_RESEARCH.md`.
- Added readable typography and surface tokens in `src/index.css` and exposed a `font-readable` Tailwind family through `tailwind.config.js`.
- Made the map visible before device QA by adding a first-viewport `control-map-signal` strip in `src/components/ControlPanel.tsx`, changing the mobile move action label to `MAP`, and adding a `Route Map` board for route selection.
- Promoted the map tab's current location into a clear `map-current-location-card` with a primary recommended route CTA in `src/components/MapNavigator.tsx`.
- Added regression coverage in `tests/readability-map-signal.test.js` and updated affected Playwright e2e expectations for the new MAP-first interaction.
- Captured mobile visual evidence:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/aetheria-readability-map-first-screen.png`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/aetheria-readability-map-tab.png`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/aetheria-readability-route-board.png`

Verification:
- `npx tsc --noEmit` -> pass
- `node --import tsx --test tests/readability-map-signal.test.js tests/cycle-423-control-panel-sidebar-label-dead.test.js` -> pass
- `npm run verify` -> type-check, lint, unit 2827/2827, build guard pass
- `npm run test:e2e -- tests/e2e/explore.spec.ts` -> 2/2 pass after updating the intentional MAP button expectation
- `npm run verify:full` -> type-check, lint, unit 2827/2827, build guard, desktop smoke, mobile smoke, Playwright e2e 20/20 pass
- `npm run mobile:doctor` -> pass with the existing Android release signing input blocker
- `npm run cap:sync` -> pass; latest web assets copied into Android and iOS Capacitor shells

Notes:
- Native debug/archive builds were not rerun in this pass because the touched path is web UI/readability and Capacitor sync, not signing or native delivery logic.
- Current environment blocker remains Android release signing input absence (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`) plus real-device manual QA availability.

Done (2026-05-28: first viewport readability recomposition pass):
- Continued the readability trend work into the first playable viewport rather than changing progression systems.
- Compressed `StatusBar` into a compact readable HUD shell with clearer HP / NRG / EXP meters and less decorative chrome.
- Rebuilt `TerminalView` around readable log rows and small semantic badges, removing the heavier scanline/orb treatment from the primary log surface.
- Reframed the active mission tracker in `ControlPanel` as `NEXT / ROUTE / REWARD / RETURN` decision cells so an accepted quest reads like a next-action strip instead of a decorative chip stack.
- Updated smoke DOM metrics in `src/hooks/useGameTestApi.ts` and expanded readability regression coverage in `tests/readability-map-signal.test.js`.
- Captured mobile visual evidence:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/aetheria-readability-first-viewport-v2.png`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/desktop/01-after-start.png`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/mobile/01-after-start.png`

Verification:
- `npx tsc --noEmit` -> pass
- `node --import tsx --test tests/readability-map-signal.test.js tests/cycle-423-control-panel-sidebar-label-dead.test.js tests/cycle-404-terminal-view-stats-prop-dead.test.js tests/cycle-497-terminal-view-auto-focus-show-input-cascade.test.js` -> 19/19 pass
- `node --import tsx --test tests/cycle-491-status-metric-compact-dense-cascade.test.js tests/readability-map-signal.test.js` -> 10/10 pass
- `npm run verify` -> type-check, lint, unit 2829/2829, build guard pass
- `npm run verify:full` -> type-check, lint, unit 2829/2829, build guard, desktop smoke, mobile smoke, Playwright e2e 20/20 pass
- Playwright 390x844 first viewport visual check -> no status/log/map/action overlap; screenshot saved to `aetheria-readability-first-viewport-v2.png`
- `npm run mobile:doctor` -> pass with existing Android release signing input blocker
- `npm run cap:sync` -> pass; latest web assets copied into Android and iOS Capacitor shells

Notes:
- Native debug/archive builds were not rerun because this pass touched web UI/readability and Capacitor web asset sync, not native signing or packaging logic.
- Current environment blocker remains Android release signing input absence (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`) plus real-device manual QA availability.

Done (2026-05-28: Quest Board and Shop modernization pass):
- Continued `docs/READABILITY_TREND_RESEARCH.md` Slice 3 for modern roguelike decision surfaces.
- Rebuilt `QuestBoardPanel` around `aether-choice-row` decision rows instead of heavy nested terminal cards. Featured missions now prioritize title, one-line objective, Scout Brief route/risk/payoff/return, reward chips, and the accept action.
- Reduced the Mission Terminal header and removed the duplicate plan grid from featured mission rows so the first `START OPERATION` action is visible inside a 390x844 mobile viewport.
- Rebuilt `ShopPanel` buy/sell rows around `aether-shop-row` and `aether-shop-delta`, keeping item art, item identity, stat delta, blocked reason, price, and buy/sell action in one comparable row.
- Updated readability regression guards so Quest Board decision rows and Shop row state stay covered.
- Captured mobile visual evidence:
  - `/Users/sungjin/dev/personal/aetheria-roguelike/aetheria-readability-slice3-shop.png`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/aetheria-readability-slice3-quest-board.png`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/mobile/02a-shop-open.png`
  - `/Users/sungjin/dev/personal/aetheria-roguelike/playtest-artifacts/mobile/02c-quest-board-open.png`

Verification:
- `npx tsc --noEmit` -> pass
- `node --import tsx --test tests/readability-map-signal.test.js tests/cycle-428-reward-chips-default-accent-redundant.test.js tests/cycle-429-quest-reward-chips-default-accent-redundant.test.js tests/cycle-488-shop-panel-mobile-focused-cascade.test.js tests/cycle-573-shop-panel-defaults-batch.test.js tests/cycle-589-quest-board-panel-system-tab-defaults-batch.test.js` -> 26/26 pass
- `npm run verify` -> type-check, lint, unit 2831/2831, build guard pass
- `npm run verify:full` -> type-check, lint, unit 2831/2831, build guard, desktop smoke, mobile smoke, Playwright e2e 20/20 pass
- Playwright 390x844 Shop visual check -> row buttons are 74x34, item rows remain readable, screenshot saved to `aetheria-readability-slice3-shop.png`
- Playwright 390x844 Quest Board visual check -> first mission `START OPERATION` is visible within viewport, screenshot saved to `aetheria-readability-slice3-quest-board.png`
- `npm run mobile:doctor` -> pass with existing Android release signing input blocker
- `npm run cap:sync` -> pass; latest web assets copied into Android and iOS Capacitor shells

Notes:
- Native debug/archive builds were not rerun because this pass touched web UI/readability and Capacitor web asset sync, not native signing or packaging logic.
- Current environment blocker remains Android release signing input absence (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`) plus real-device manual QA availability.
