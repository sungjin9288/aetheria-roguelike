# Aetheria 장기 플레이 경험과 아트 통합 설계

Date: 2026-08-06

Status: Approved for implementation on 2026-08-09

Scope: 직업 판타지, 장기 반복 플레이, 캐릭터 아트, 장비 일러스트, 검증과 증빙

## 결론

Aetheria는 접속 보상으로 플레이를 붙잡는 게임이 아니라, 다른 직업과 장비 조합을 다시 시험하고 싶어서 돌아오는 `premium/offline-first` 싱글플레이 roguelike로 발전시킨다.

현재 원정, 전투, 장비 비교, 귀환 정산, 영구 성장 흐름은 이미 반복 플레이의 뼈대를 갖췄다. 다음 단계는 새 화폐나 메뉴를 늘리는 일이 아니다. 18개 직업이 서로 다른 판단을 요구하고, 233개 장비가 같은 세계의 물건으로 보이며, 한 번의 원정에서 발견한 선택이 다음 원정의 의도로 이어지게 만드는 일이다.

우선순위는 다음과 같다.

1. 18개 직업의 플레이 약속과 시각 정체성을 일치시킨다.
2. 233개 장비와 22개 illustration family를 하나의 Art Bible로 통일한다.
3. 기존 원정 ledger와 귀환 흐름에 직업별 발견 기록을 연결한다.
4. 광고, 가챠, streak loss, 소멸 보상 없이 반복 플레이 동기를 만든다.
5. 모든 자산과 기록은 manifest, verifier, tracked provenance, screenshot evidence로 추적한다.

## 현재 상태 감사

### 유지할 기반

- 첫 출발과 원정 집중 임무
- 공간형 Map과 적 의도를 먼저 보여 주는 전투
- 장비 summary와 상세 비교, 투자 전 preview
- 정상 귀환 debrief와 다음 행동 연결
- 첫 사망, 첫 보스, 첫 전직 같은 milestone 기록
- browser smoke, mobile E2E, Capacitor sync, native build의 단계 구분

이 기반은 `docs/COMPETITOR_FLOW_DESIGN_PLAN_2026-07-22.md`와 `docs/COMPETITOR_EXPEDITION_RETENTION_PLAN_2026-07-23.md`에서 설계됐고 현재 코드에 반영돼 있다. 이번 범위는 그 흐름을 대체하지 않고 직업과 장비의 정체성을 연결한다.

### 확인된 격차

1. `src/data/classes.ts`에는 18개 직업이 있지만 `src/utils/avatarSpriteCandidates.ts`의 전용 sprite mapping은 14개뿐이다.
2. 성직자, 드래곤 나이트, 무당, 사냥의 군주는 모험가 이미지로 fallback한다.
3. 기존 avatar는 `572x871`, `824x960`, `916x971`처럼 canvas와 인물 비율이 다르다.
4. 장비 233종은 exact asset 경로를 갖지만 일반 장비는 비슷한 silhouette의 색상 변형이 많다.
5. signature 장비는 일반 장비보다 광원, 외곽선, 크기, 장식 밀도가 달라 별도 art set처럼 보인다.
6. 일반 장비 overlay는 합성 느낌이 부자연스럽다는 기존 피드백에 따라 runtime에서 사용하지 않는다. 장비 icon과 일부 loadout sprite가 같은 결정 순서를 설명하지 못하는 지점을 다시 확인해야 한다.
7. `public/assets/avatars/README.md`의 설명과 실제 job-only status avatar 선택 규칙이 맞지 않는다.

파일 수와 테스트 통과는 시각적 완성도를 증명하지 않는다. 이번 작업은 누락 파일만 채우지 않고, 작은 모바일 화면에서 실제로 구분되고 기억되는지를 완료 기준으로 삼는다.

## 제품 원칙

### 유지한다

- 접속하지 않았다는 이유로 보상을 잃지 않는다.
- 정상 플레이가 직업 숙련과 발견 기록의 유일한 입력이다.
- 직업 정체성은 장착 장비 때문에 사라지지 않는다.
- 장비 선택은 얻는 것과 잃는 것을 착용 전에 보여 준다.
- 기존 save, 아이템 이름, 아이템 identity, quest와 expedition 기록을 보존한다.
- browser 검증과 native/device 증빙을 같은 완료 상태로 표현하지 않는다.

### 추가한다

- 모든 직업에 고유한 canonical sprite와 한 문장의 플레이 약속
- 직업별 핵심 skill branch, 대표 장비 조합, 보스와 지역 발견 기록
- 22개 장비 illustration family와 8개 속성에 대한 공통 시각 문법
- 자산 규격, manifest, 자동 verifier, provenance ledger
- desktop/mobile contact sheet와 실제 화면 screenshot evidence

### 추가하지 않는다

- 새 화폐와 camp economy
- 강제 일일 과제, 연속 출석 손실, 소멸 보상
- 광고 시청에 묶인 보상
- 수치만 계속 커지는 무한 직업 성장
- 검증 근거 없는 전투 수치 재조정
- 모든 귀환에 강제되는 modal과 긴 서사

## 플레이 경험

반복 흐름은 다음 순서를 유지한다.

`직업 선택 -> 이번 원정 목표 -> 전투와 장비 선택 -> 귀환 평가 -> 직업별 발견 기록 -> 다음 원정 의도`

### 신규 플레이어

- 직업 선택 화면에서 10초 안에 전투 방식과 강점을 이해한다.
- 첫 원정은 기존 이야기 임무와 자동 focus를 그대로 사용한다.
- 선택 결과는 숫자보다 현재 상황, 기대 효과, trade-off 순서로 읽힌다.

### 반복 플레이어

- 귀환 화면에서 이번 원정의 대표 build와 기억할 결과를 확인한다.
- 직업별로 사용한 핵심 branch, 발견한 장비 조합, 상대한 보스와 지역이 남는다.
- 다음 원정에서 시험할 선택을 바로 찾을 수 있다.

### 복귀 플레이어

- 마지막 원정과 현재 직업 상태를 10초 안에 파악한다.
- 쉬었던 기간 때문에 잃은 보상이나 회복해야 할 streak가 없다.
- 새 시스템 설명보다 마지막 플레이의 맥락과 다음 행동을 먼저 본다.

## 18개 직업 Character Bible

모든 직업은 얼굴, 주무기, 어깨 형태 중 최소 두 가지가 고유해야 한다. 대표 색만 바꿔 다른 직업으로 표현하지 않는다.

| 직업 | 플레이 약속 | 핵심 실루엣 | 대표 색 |
|---|---|---|---|
| 모험가 | 상황에 맞춰 배우고 적응한다 | 한손검, 작은 방패, 여행 망토 | 가죽색, 청색 |
| 전사 | 맞으면서 전선을 밀어낸다 | 넓은 검, 두꺼운 견갑, 전투 흉터 | 철색, 적색 |
| 마법사 | 원소와 상태이상을 조합한다 | 수련 지팡이, 세 원소 결정 | 남색, 주황색, 하늘색 |
| 도적 | 빠른 치명타와 독으로 빈틈을 공략한다 | 쌍단검, 낮은 후드, 독병 | 먹색, 독녹색 |
| 나이트 | 방패로 적의 공격 흐름을 통제한다 | 거대한 방패, 장검, 성채형 갑옷 | 강철색, 왕청색 |
| 버서커 | 방어를 버리고 폭발적인 피해를 선택한다 | 대형 도끼, 드러난 팔, 찢어진 망토 | 혈적색, 흑색 |
| 아크메이지 | 강한 원소 주문의 순서를 설계한다 | 대형 지팡이, 회전하는 원소 결정 | 백색, 남색, 다색광 |
| 흑마법사 | 저주와 흡수로 전투를 잠식한다 | 굽은 지팡이, 금서, 어둠의 손 | 자주색, 흑색, 병든 녹색 |
| 어쌔신 | 은신 뒤 한 번의 처형을 완성한다 | 가는 쌍검, 얼굴 가리개, 그림자 잔상 | 흑색, 은색, 자홍색 |
| 레인저 | 거리와 화살 종류를 선택한다 | 장궁, 여러 형태의 화살통 | 숲색, 황갈색 |
| 성직자 | 정화와 빛으로 위험을 되돌린다 | 성물 지팡이, 긴 예복, 빛 문양 | 상아색, 금색, 하늘색 |
| 팔라딘 | 방어와 치유를 공격으로 연결한다 | 성전 망치, 탑 방패, 빛의 후광 | 백색, 금색, 청색 |
| 드래곤 나이트 | 용의 힘으로 위험을 감수하고 돌파한다 | 용린 갑옷, 용날 창, 불꽃 숨결 | 흑요석색, 용암색 |
| 대마법사 | 모든 원소와 시간의 경계를 지배한다 | 의식 지팡이, 다중 마법진, 별의 외투 | 심야색, 백색, 분광색 |
| 그림자 주군 | 어둠을 쌓아 확정적인 처형을 완성한다 | 긴 그림자 칼날, 왕관형 뿔, 검은 잔영 | 흑색, 보라색, 핏빛 |
| 무당 | 저주, 독, 소환을 겹쳐 위기를 힘으로 바꾼다 | 방울 지팡이, 부적, 떠도는 혼 | 청록색, 갈색, 보라색 |
| 시간술사 | 행동 순서와 턴 자체를 바꾼다 | 시계 구체, 시간검, 분리된 망토 | 청색, 금색, 백색 |
| 사냥의 군주 | 자연과 사격을 결합해 사냥을 완성한다 | 거대 장궁, 뿔 장식, 짐승 가죽 망토 | 진녹색, 금색, 상아색 |

### 캐릭터 자산 규격

- 정면 3/4 자세와 동일한 발 위치를 사용한다.
- master는 정사각형 투명 배경으로 보존한다.
- runtime export는 동일한 canvas, 여백, 인물 높이를 사용한다.
- 광원은 왼쪽 위, 그림자는 오른쪽 아래로 고정한다.
- 머리 비율과 외곽선 두께를 통일한다.
- Tier가 높아질수록 장식과 효과는 늘지만 몸의 비율은 바뀌지 않는다.
- 원소 효과는 얼굴과 무기 실루엣을 가리지 않는다.
- 검은 실루엣과 40px 축소본에서도 직업을 구분할 수 있어야 한다.

성직자, 드래곤 나이트, 무당, 사냥의 군주는 완전히 새로 만든다. 기존 14개는 같은 기준으로 canvas와 인물 비율을 다시 맞춘다.

## Equipment Art Bible

장비는 `family -> 제작 수준 -> 속성 -> signature identity` 순서로 읽혀야 한다.

### 22개 family

- 무기: 검, 단검, 중량 무기, 활, 지팡이, 창, 채찍
- 보조 장비: 방패, 마도서
- 머리 장비: 밀짚모자, 모자, 마법모자, 서클릿, 투구, 후드, 복면
- 방어구: 코트, 가죽, 로브, 판금, 망토, 장화

같은 family의 두 장비는 날이나 몸체 형태, 손잡이, 중심 장식, 재질 중 최소 두 가지가 달라야 한다. 색상만 바꾼 자산은 exact illustration으로 인정하지 않는다.

### Tier 문법

| Tier | 시각적 의미 |
|---|---|
| T1 | 닳은 목재, 철, 천으로 만든 단순하고 실용적인 장비 |
| T2 | 정돈된 제작, 두 가지 재질, 작은 기능 장식 |
| T3 | 지역과 제작 집단의 특징이 형태에 드러나는 장비 |
| T4 | 속성 핵과 마법 가공이 구조에 개입한 장비 |
| T5 | 이름과 전설을 실루엣으로 기억할 수 있는 signature 장비 |
| T6 | 에테르, 공허, 차원 기술이 구조 자체를 바꾼 mythic 장비 |

Tier는 glow의 세기로만 표현하지 않는다. 형태, 재질, 장식 밀도가 함께 발전해야 한다.

### 속성 문법

| 속성 | 재질과 형태 | 효과 |
|---|---|---|
| 화염 | 검붉은 금속, 갈라진 표면 | 주황 균열, 작은 불씨 |
| 냉기 | 청백색 결정, 날카로운 모서리 | 서리, 차가운 반사광 |
| 빛 | 상아색 금속, 금빛 각인 | 하늘색 광점, 깨끗한 광선 |
| 어둠 | 흑색 재질, 안으로 꺼지는 면 | 보라색 내부광, 흐르는 연무 |
| 대지 | 암석, 황동, 각진 결정 | 무거운 파편, 낮은 광택 |
| 자연 | 목재, 가죽, 생체 재질 | 덩굴, 청록색 생명광 |
| 바람 | 얇은 곡선, 열린 구조 | 옅은 청록색 흐름 |
| 에테르 | 분리된 조각, 격자 구조 | 자주색과 청록색 공간 틈 |

색각에 의존하지 않도록 색뿐 아니라 표면과 silhouette를 함께 바꾼다.

### 공통 export 규격

- runtime item icon은 투명 배경 `160x160`으로 통일한다.
- 광원, 외곽선 단계, 그림자, pixel density, 여백을 고정한다.
- UI rarity frame과 중복되는 전체 배경 glow를 넣지 않는다.
- signature 장비도 같은 규격을 사용하고 고유 silhouette와 문양으로 특별함을 만든다.
- 32px, 40px, 160px에서 family와 주된 속성을 읽을 수 있어야 한다.

### 캐릭터와 장비의 관계

- 상태와 전투 화면은 job canonical sprite로 직업 정체성을 유지한다.
- 장비 비교 화면은 exact item icon, 현재 캐릭터, 수치와 trade-off를 함께 보여 준다.
- 일반 장비는 기존 결정대로 overlay를 합성하지 않는다. 직업 identity가 살아 있는 loadout sprite swap과 icon 비교를 사용한다.
- signature 장비만 기존 dedicated wearable overlay를 유지한다.
- 일반 장비를 실제 착용한 전신 표현은 별도 prototype이 자연스러움과 모바일 가독성 검토를 통과한 뒤에만 다시 승인한다.
- canonical asset, exact item icon, signature overlay가 빠지면 테스트와 build guard가 실패한다.

## 데이터와 권한 경계

### Source of truth

- 직업 정의: `src/data/classes.ts`
- 장비 정의: `src/data/items.ts`
- 직업 asset mapping: `src/utils/avatarSpriteCandidates.ts`
- 장비 visual mapping: `src/utils/itemVisuals.ts`
- runtime asset: `public/assets/avatars/`, `public/assets/items/`, `public/assets/equipment-family/`
- 생성 작업 파일: Git에서 제외되는 `output/imagegen/`
- tracked provenance와 검토 기록: `docs/evidence/art/`
- 현재 실행 상태와 blocker: `tasks/todo.md`

### 저장 데이터

직업별 발견 기록은 기존 player save에 optional additive field로만 추가한다. 이전 save는 새 필드가 없어도 정상 동작해야 한다.

기록 후보는 다음과 같다.

- 직업별 사용한 핵심 skill branch
- 직업별 발견한 signature 장비
- 직업별 상대한 보스와 방문 지역
- 직업별 대표 expedition summary identity

동일 사건의 replay는 먼저 저장된 identity를 확인하고 중복 저장하지 않는다. 기록을 다시 계산할 때 기존 expedition 결과를 변형하거나 sequence를 증가시키지 않는다.

### 실패 처리

- canonical 18개 직업에 fallback asset을 허용하지 않는다.
- 손상된 구세이브만 명시적인 safe placeholder 경로로 복구한다.
- manifest에 없는 새 아이템은 조용히 family 이미지로 숨기지 않고 검증 단계에서 실패한다.
- 생성 실패, 후처리 실패, 배포 실패는 서로 다른 상태로 기록한다.
- browser screenshot은 native/device 완료 증빙으로 사용하지 않는다.
- 작업용 `output/imagegen/`만으로 provenance 완료를 주장하지 않는다. 승인 prompt, source identity, export hash, reviewer 결정은 tracked evidence에 남긴다.

## 구현 순서

### Phase 0 — 기존 combat transaction 정리

- 현재 dirty worktree의 이전 combat 변경을 범위별로 재검토한다.
- 공격, 기술, 아이템, 도주가 각각 한 턴만 소비하는지 다시 검증한다.
- 구현, 테스트, `progress.md`, `tasks/todo.md`를 한 commit으로 묶어 push한다.

### Phase 1 — 설계와 asset contract

- 이 문서를 구현 source of truth로 확정한다.
- character와 equipment manifest schema를 고정한다.
- 크기, 투명 배경, 여백, exact coverage를 검사하는 verifier를 만든다.
- 기존 자산 감사 결과를 machine-readable report로 남긴다.
- 직업, 장비, family, 속성 catalog의 정렬된 identity hash를 기록해 이후 추가·삭제를 명시적인 변경으로 만든다.

### Phase 2 — 18개 직업 identity

- 누락된 4개 직업의 canonical art를 제작한다.
- 기존 14개를 같은 canvas와 인물 비율로 정규화한다.
- 18개 exact mapping과 fallback 방지 테스트를 추가한다.
- 직업 선택, 상태, 전투 화면을 desktop/mobile에서 검증한다.

### Phase 3 — 229개 player 장비 art

- 22개 illustration family의 대표 silhouette를 확정한다.
- 일반 장비를 family와 Tier cohort로 나눠 통일한다.
- signature와 mythic 장비를 같은 광원과 export 규격으로 맞춘다.
- `ITEMS.weapons + ITEMS.armors`의 229개 exact manifest, contact sheet, 축소 가독성 검사를 통과한다. Modifier prefix template은 player 장비로 세지 않는다.
- signature overlay와 일반 장비의 job/loadout preview가 기존 runtime 결정과 일치하는지 확인한다.

### Phase 4 — 직업 발견 기록과 귀환 연결

- 정상 플레이에서만 직업별 발견 기록을 만든다.
- 기존 expedition debrief에 대표 build와 다음 선택을 연결한다.
- 구세이브, offline reload, exact replay, 중복 저장 방지를 검증한다.
- 새 화폐나 강제 modal을 추가하지 않는다.

### Phase 5 — RC 검증과 evidence

- type-check, lint, unit, build guard를 실행한다.
- preview server를 포함한 smoke와 user-facing E2E를 실행한다.
- `mobile:doctor`, `cap:sync`와 필요한 native build를 실행한다.
- contact sheet, desktop/mobile screenshot, QA summary를 갱신한다.
- 서명, keystore, 물리 기기 blocker는 앱 회귀와 분리한다.

## Commit과 push 경계

1. 기존 combat transaction 완결
2. 장기 플레이와 art contract
3. 18개 직업 identity와 character asset
4. 검, 단검, 중량 무기 cohort
5. 활, 지팡이, 창, 채찍 cohort
6. 방패, 마도서, 머리 장비 cohort
7. 방어구 cohort
8. signature, mythic, 229-item exact manifest 전수 정합
9. 직업 발견 기록과 귀환 연결
10. RC 검증과 release evidence

각 commit은 관련 구현, 테스트, 문서, 증빙이 서로 일치할 때만 만든다. 이미지 생성 횟수나 중간 시도마다 commit하지 않는다. 장비는 검토와 rollback이 가능한 위 cohort로 묶되 최종 exact manifest commit에서 233개 전수 일치를 다시 확인한다.

## 검증 기준

### 자동 검증

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build:guard`
- `npm run test:unit`
- `npm run test:smoke`
- user-facing flow 변경 시 `npm run test:e2e`
- 최종 `npm run verify:full`
- `npm run mobile:doctor`
- `npm run cap:sync`
- native packaging 영향이 있으면 해당 Android/iOS build

### Character acceptance

- 18개 직업과 18개 canonical asset이 정확히 대응한다.
- 성직자, 드래곤 나이트, 무당, 사냥의 군주가 모험가로 fallback하지 않는다.
- 모든 runtime sprite의 canvas와 anchor가 일치한다.
- 40px 실루엣 비교에서 직업을 구분할 수 있다.
- mobile 직업 선택, 상태, 전투 화면에 잘림과 겹침이 없다.
- 이름을 숨긴 18개 contact sheet를 사용자 또는 지정 reviewer가 확인하고 최소 16개 직업의 계열이나 역할을 한 번에 맞힌다.
- 검토자는 직업별 화면을 10초만 본 뒤 플레이 약속을 한 문장으로 기록하고, 설계 의도와 일치한 항목이 16개 이상이어야 한다.
- reviewer, 날짜, 결과, 수정 판단을 `docs/evidence/art/`에 기록한다.

### Equipment acceptance

- 현재 catalog snapshot의 장비 233개가 exact asset manifest에 하나씩 존재한다.
- 정렬된 장비 identity catalog hash를 manifest에 기록하고, catalog와 manifest의 양방향 차집합이 모두 비어 있어야 한다.
- 중복 장비 이름과 중복 runtime asset 경로를 별도로 검사한다.
- 같은 family의 다른 장비가 색상만 다른 자산으로 남지 않는다.
- 22개 illustration family가 같은 canvas와 여백 규칙을 따른다.
- signature overlay는 등록된 signature 장비와 양방향 exact coverage를 이룬다.
- 일반, signature, mythic 장비가 같은 광원과 pixel density를 사용한다.
- 32px에서 family, 40px에서 주된 속성, 160px에서 고유 장식을 읽을 수 있다.

### Player acceptance

- 신규 플레이어가 각 직업의 플레이 방식을 10초 안에 구분한다.
- 직업을 바꾸면 전투 판단과 선호 장비가 달라진다.
- 복귀 플레이어가 마지막 원정과 다음 목표를 10초 안에 찾는다.
- 접속하지 않았다는 이유로 잃는 보상이 없다.
- 직업별 기록이 같은 사건을 두 번 저장하지 않는다.
- fixture 기반 구세이브를 열었을 때 inventory와 reward identity가 migration 전후로 일치한다.
- 같은 expedition 결과를 replay해도 저장 sequence와 직업 기록 수가 증가하지 않는다.
- 직업별 대표 combat scenario에서 선택한 첫 행동과 선호 장비 family를 기록해 플레이 약속과 일치하는지 확인한다.

## 증빙

- 18개 직업 contact sheet
- 22개 장비 family와 Tier별 contact sheet
- character와 equipment asset audit report
- `docs/evidence/art/`에 추적되는 생성 prompt, source identity, export hash, reviewer 결정 ledger
- desktop/mobile 직업 선택, 전투, 장비 비교, 귀환 screenshot
- canonical verification command 결과
- 최신 native build 또는 실행 불가 환경 blocker

## 완료 정의

이 범위는 다음 조건을 모두 만족할 때만 완료다.

1. 18개 직업의 플레이 약속과 canonical character art가 실제 화면에서 일치한다.
2. 현재 catalog snapshot의 장비 233개가 동일한 Art Bible과 exact manifest를 따르며 catalog hash가 일치한다.
3. 직업별 발견 기록이 기존 원정과 귀환 흐름에 연결된다.
4. 기존 save와 gameplay reward가 보존된다.
5. 자동 검증, browser/mobile 증빙, native 경계가 실제 결과와 일치한다.
6. `tasks/todo.md`, 관련 문서, manifest, provenance가 현재 구현을 정확히 설명한다.

검증이 불가능한 native/device 항목은 완료로 표현하지 않는다. 앱 회귀가 없는 것과 배포 준비가 끝난 것은 별도의 상태로 남긴다.
