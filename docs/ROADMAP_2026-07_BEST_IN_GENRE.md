# Aetheria Roguelike — 리팩토링 + 디밸롭 로드맵 (2026-07)

> 작성일: 2026-07-06 · 근거: 2026-07-05~06 병렬 감사 4종 (타입 부채 / 테스트 구조 / 아키텍처 / 장르 갭)
> 목표: **동일 장르(모바일 텍스트 roguelike RPG) 베스트.** B+ 난이도 개편(PR #1~#11)은 완료 — 이번 트랙은 "메타 훅 + 결정 밀도 + 코드 기반 견고화".
> 기준선: type-check 0err · lint 0err · unit 2993/2993 · 실기기(iPhone 14 Pro Max) 배포/실행 검증 완료.

---

## 감사 요약 (실측, 2026-07-05)

### 해소 확인 (6월 감사 지적 → 현재)
- ~~cycle 테스트 555개 파일~~ → **이미 23개로 통합 완료** (전체 스위트 3.4s)
- ~~gameUtils 730줄~~ → 503줄 (migrateData 분리)
- ~~useInventoryActions 638줄~~ → 74줄 + 4 서브팩토리
- ~~CombatPanel 로직 누수~~ → buildCombatView 순수함수로 위임 완료

### 잔여 리팩토링 부채
| # | 항목 | 실측 | 처방 |
|---|------|------|------|
| R1 | 문서 드리프트 | CLAUDE.md: 유물 53(실측 67)·맵 42(52)·체인 8(13)·EXP 1.38(1.15)·noImplicitAny 156(0)·TS 85%(파일 기준 100%) | 실측 동기화 |
| R2 | 타입 코어 | `: any` 1,535 / `as any` 107. 근본 원인: `MSG: any` 1줄→107건(33 importer), `DB` 6필드 any(36 importer), ITEMS/MONSTERS/RELICS/CLASSES 미타입 | MSG 인터페이스 → DB 필드 타입 → 데이터 export 타입 → constants 잔여 |
| R3 | CombatEngine 1,268줄 | attack(200) + performSkill(410) + enemyAttack(270) = 본체 55% | `CombatEngine.actions.ts` + `CombatEngine.enemyAI.ts` mixin 분리 (기존 4-mixin 패턴) |
| R4 | 검증/점수 누수 | 장비 검증(레벨/직업/양손-방패)이 hook 인라인, 장비 점수식이 ShopPanel:74 + SmartInventory:143 중복 | `equipmentValidation.canEquip()` + `getEquipmentUpgradeScore()` 순수함수 추출 |
| R5 | aiService 테스트 0건 | quota/timeout/fetch실패/스모크 분기 — 실행 기반 테스트 없음(문자열 가드만) | mock fetch + fake timer 단위 테스트 신설 |

### 장르 베스트 갭 (구조적 2개 + 저비용 다수)
- **(a) 통화만 있고 거울이 없다**: 에센스 획득처 3곳·소비처 **0건** (StatsPanel 표시가 전부). Hades 거울 부재.
- **(b) 정보 없는 단일 버튼 탐험**: 사전 결정 지점 0. StS 노드맵/FTL 비콘 부재.
- 프레스티지 rank 4~9 해금 공백(flat 스탯만), 체인 저널 UI 0건(13체인×3스텝 데이터 완비), 맵 exit 위험/보상 데이터 미노출, 시너지 자연 발생률 낮음(name 완전일치 페어).

---

## 실행 계획 (PR 단위)

> 각 PR: feature 브랜치 → TDD(동작 변경 시) → `npm run verify`(type-check+lint+unit+build:guard) → PR → merge.
> 관례: 커밋 컨벤션 `feat|refactor|docs(scope): 한국어 설명`, attribution 없음.

### Wave 1 — 저비용 고효율 (foundation + quick wins)
| PR | 내용 | 트랙 |
|----|------|------|
| #12 | **docs**: CLAUDE.md/문서 실측 동기화 (콘텐츠 수치·EXP·TS 상태) | R1 |
| #13 | **feat(meta)**: 프레스티지 rank4~9 해금 충전 — 기존 파라미터 노드화 (rank4 캠프파이어↑, rank5 시작부트 4선택, rank6 pity 단축, rank7 챌린지 슬롯…) | 갭 |
| #14 | **feat(ui)**: 체인 저널(Quest 탭) + 맵 exit 위험/보상 배지 — 데이터 완비, 순수 UI | 갭 |

### Wave 2 — 구조적 갭 직격 (best-in-genre 코어)
| PR | 내용 | 트랙 |
|----|------|------|
| #15 | **feat(meta)**: 에센스 거울 트리 — 소비 노드 6~10개 (시작부트 +1, 캠프파이어 확률, 런당 부활 1회, 시작 골드, 유물 pity 단축 등 기존 BALANCE 파라미터 노드화). SystemTab/AscensionScreen UI 재활용 | 갭(a) |
| #16 | **feat(explore)**: 탐험 스카우팅 3택 — "전투의 기척/이상 신호/짙은 안개" 카드 선택 → 기존 롤 파이프에 편향 주입. 정예="고위험·유물확정" 카드 노출 | 갭(b) |
| #17 | **feat(relic)**: 시너지 소프트 pity — `pickWeightedRelics`에 보유 유물과 시너지 있는 후보 1개 보장 슬롯 | 갭 |

### Wave 3 — 코드 기반 견고화
| PR | 내용 | 트랙 |
|----|------|------|
| #18 | **refactor(types)**: 타입 코어 — MSG 인터페이스 + DB 6필드 + RELICS/MONSTERS/CLASSES/ITEMS export 타입 + constants 잔여 3건 | R2 |
| #19 | **refactor(combat)**: CombatEngine.actions.ts + CombatEngine.enemyAI.ts mixin 분리 (본체 ≤600줄 목표) | R3 |
| #20 | **refactor(equip)+test(ai)**: equipmentValidation/점수식 추출 + aiService 실행 테스트 신설 | R4+R5 |

### 마무리 — 실기기 최종 검증
- `cap:sync` → 서명 빌드 → iPhone 설치/실행 → 신기능(거울/스카우팅/저널) 실기기 확인 → 스모크 그린.

## 후순위 (이번 트랙 제외, 후보 기록)
- 원정(구역 보스) 세션 패키징 + 보스 접근 게이지 / 복귀 브리핑 카드 / 심연 데일리 다이브
- 7직업 스킬 분기 추가 + 직업-유물 태그 공명 / AI 이벤트 outcome 게임플레이 분기(유물 후보·저주·정예 소환)
- 세계관 정합(사이버펑크 어휘 0건 — "에테르=고대 네트워크" 융합 or 포지셔닝 수정)
- gameUtils 도메인 분리(titleUtils/codexUtils), questOperations 타입화, 스모크 강화-클릭 플로우
