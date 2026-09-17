# 도서관 특화 전리품 검증 — 2026-09-09

상태: **승인된 도서관 특화 local checkpoint 완료**. 구현·focused/full/UI·독립 감사·native package 대조 완료. 전체 게임 완성·설치·공개 증거가 아니다.

## 구현 범위

승인 계약 `docs/superpowers/plans/2026-09-09-aetheria-library-loot-identity.md`.
Production preimage 대비 exact4: 신규 `src/data/libraryLoot.ts`, 기존 `src/systems/CombatEngine.loot.ts`, `src/utils/equipmentBaseIdentity.ts`, `src/data/maps.ts`.
도서관의 살아있는 마법서·잉크 슬라임, ordinary Tier4에만 ordered8 마법 장비 pool 적용. 기존 eligibility·6% roll·선택 draw·prefix·수량·capacity·pity 유지. Shared3/다른 지역·tier/비정상 provenance/boss/elite/infinite 제외. Eager catalog validation과 사실에 맞는 안내 포함.

## TDD와 독립 감사

- RED `/tmp/aetheria-library-loot-red.log`: 6개 중2PASS/4FAIL. Pool·actual spawn·설명·missing catalog 모듈 실패.
- GREEN `/tmp/aetheria-library-loot-focused.log`: library/normal-tier/combat-loot/capacity/loot-cycle/signature-reachability **97/97**.
- `npx tsc --noEmit` PASS; lint exit0, 기존 unchanged `useGameEngine.ts` react-hooks/refs warning3. 기존 normal-loot full log에도 같은 warning3이며 이번 source delta 밖이다.
- Sol/xhigh read-only reviewer: **Critical0/Important0**. Exact production delta, 범위 선행 guard, RNG, eager validator, import cycle, test masking 확인. Supplemental/full/UI/native는 이 판정에 포함하지 않는다.

## 전후 production 정산 비교

Preimage `output/library-loot-preimage-20260909/`에 기존 source·canonical evidence·baseline 보존.
`output/library-loot-comparison.mjs`는 production spawn→combat reducer→structured receipt→실제 SELL_INVENTORY_ITEM을 사용한다. 빈 가방·HP1 적·고공격 fixture로 정산을 격리하므로 자연 성장/생존/획득률·장기 경제를 증명하지 않는다. 18jobs는 `canEquip` cross-job projection이며 18직업 전투 실행이 아니다.

전후 각각24cohorts×64seeds(20260824부터)×32 = **49,152회**. 대상6cohort만 identity/digest 변화, 비대상18cohort는 전체 row/receipt/item digest exact equality. 모든 cohort의 보상 개수·blocked·signature·pity 변화 동일. Target 각 row에서8종 모두 관측, current replay byte-identical(session8497 exit0).

별도 processLoot excluded21cases×64=1344에서 full output 및 RNG trace 전후 exact equality. 최초 실행은 inline tool output만 있어 독립 감사 I1(재현 artifact 부재)을 받았다. 후속으로 `node --import tsx output/library-loot-excluded.mjs > output/library-loot-excluded-20260909.json`을 실행(exit0)해 보존했다. 21개 case ID마다64건 full result+draws를 deepEqual하고 before/after SHA256·draw count를 남긴다. 보존된 preimage source와 current production 함수를 각각 호출하며 loot 계산 mirror는 없다. 새로 보존한 재현 증거이며 최초 inline 실행의 누락 artifact를 소급 생성한 것이 아니다.

Excluded runner SHA256 `124d80377c8b1e971eae51761cc9a36e217ea79ff2dcf9c6605ecbd43384480d`; report `c60c27bfffbaf615f5cdeca0439219ce445869a754b79dd8b9229773280f0960`.

Owner byte replay 및 Sol/xhigh read-only replay 모두 보존 report와 일치. **추가 감사 I1 해소, 최종 Critical0/Important0.** Full/native 완료 판정은 이 증빙 감사의 범위 밖이다.

| Player level | 대상 | 획득 개수 전후 | 실제 판매 골드 전→후 | 아크메이지 장착 가능 전→후 |
| --- | --- | ---: | ---: | ---: |
| 62 | 살아있는 마법서 | 137 | 410719→415089 | 18→112 |
| 62 | 잉크 슬라임 | 126 | 384000→391050 | 29→114 |
| 74 | 살아있는 마법서 | 142 | 421855→423943 | 29→123 |
| 74 | 잉크 슬라임 | 116 | 347440→351015 | 29→104 |
| 75 | 살아있는 마법서 | 112 | 336225→342135 | 15→99 |
| 75 | 잉크 슬라임 | 134 | 408479→425225 | 22→120 |

판매 가격은 동일하지 않으며 모든 직업 맞춤/upgrade 보장이 아니다. `itemPriceTotal`은 prefix 반영 item price이고 base catalog 평균과 구분한다.

SHA256:

- Runner `5cc64e8ed9962c990cbe1975be5a4da72de57846ac25682762e989ab4b33ac43`.
- Current report `a50d2cdbd967d8e573200825d3478e0a207cdc7b053eca09c859e2be3db6a1d7`.
- Baseline report `f8bde696baff04abcbacd35e42b6edd576101b5745e14d456ca666d260d28903`.

## Canonical evidence와 전체 gate

Writer41449 exit0 후 readonly diagnostic verify PASS. Diagnostic hash `00204ad610b51419c4b2484cca172794f40603b58f9a25bd69bc63e701f16753`.
Progression-v2/relic-drop/relic-event `report` deep equality PASS; v1 seed20260810 stdout은 normal-loot byte동일. Source 변화만 갱신하며 historical candidate/Toss는 미갱신.
Content/pacing/equipment economy/event reward supporting17694 exit0. Art/doctor71981 exit0.
Full **92160 exit0** `/tmp/aetheria-library-loot-full.log`: unit4469/4469, E2E59+59=118, desktop/mobile smoke, type/lint/build PASS. Desktop `browser.close timeout` warning은 runner가 기록하고 정상 종료했으며 원본 log를 보존한다. Lint 기존3warnings도 위에 구분했다.
Cap **90774 exit0**, Android debug **8449 exit0**, unsigned iOS **52034 exit0**. Logs `/tmp/aetheria-library-loot-cap.log`, `-android.log`, `-ios.log`.

`python3 output/verify-library-loot-native.py /tmp/aetheria-library-loot-ios.eHjSHk` session39968 exit0. `output/library-loot-native-20260909.json`에 per-path SHA 보존. 이미지841(몬스터254·지역53·캐릭터18 및 exact/wearable equipment516), production JS43의 **884 selected unique paths**가 dist/APK/iOS에서 byte일치하며 이미지는 public source도 일치한다. 이는 전체 패키지 파일 수가 아니라 명시한 경로 집합이다.

- APK `android/app/build/outputs/apk/debug/app-debug.apk`, 227039346bytes, SHA256 `bac5ff0336dfc41357a9416799187e95af01a0bb5d72357f749d4b64f843173f`.
- 최신 unsigned/uninstalled iOS `/tmp/aetheria-library-loot-ios.eHjSHk/Build/Products/Release-iphoneos/App.app`.
- 변경된 전투 code chunk `assets/game-combat-DqhWx7ht.js`, SHA256 `c245b9a344168d812b7552936ba901560b2b36bc6f2b292fe68680f36828460a`.
- Native tracked drift0, index empty, HEAD38a3584 보존, `git diff --check` PASS. Full/UI/native/evidence 소유 프로세스 모두 종료 확인.
- 물리 Android는 사용자 제외 조건이며 미검증. unsigned iOS build는 실제 설치/lifecycle 증거가 아니다. `mobile:doctor`는 exit0이나 Android release signing input 부재를 보고했으므로 signed release readiness로 해석하지 않는다.

## 실제 UI 검증 진행

별도4435 `deviceQa=item-investment`, 390×844, 개인 save 접근 없음. Production EXP 레벨업·class vitals·합법 세이지 로드/대마법사로브로 Lv62 player 생성. Enemy는 실제spawn, HP1만 승리 fixture로 낮춤. 시작 후 칭호 recalculation으로 effective maxHp가1407→1427인 것은 fixture 로딩에 따른 기존 동작이다.
실제 공격 클릭→살아있는 마법서/잉크 슬라임 각각 처치→아크스태프 획득 확인(seed20261096). Before/victory screenshots owner 직접 검수. 실제 가방 장착으로 주무기 아크스태프/보조null/기존 세이지 로드 가방 반환 확인. 지도 이동 버튼→황금 왕국→flush/reload 후 location/equip/inventory exact equality PASS. 이 fixture는 activeExpedition이 없으므로 마을 이동·복원이지 원정 귀환 debrief 증거는 아니다.

별도 전사/합법 Tier4 용살자의창 fixture로 이미 획득한 아크스태프를 가방에 보존한 뒤 실제 inventory에서 직업 제한·장착 불가·disabled 제한 버튼을 확인했다. 이것은 재전직 gameplay 실행이 아니라 직업 거절 QA fixture다. Current weapon과 가방 유지, overflowfalse. 마지막 사진까지 owner 직접 검수했다.

증거: `output/playwright/library-loot-before-390x844.png`, `library-loot-book-victory-390x844.png`, `library-loot-town-restored-390x844.png`, `library-loot-slime-before-390x844.png`, `library-loot-slime-victory-390x844.png`, `library-loot-job-rejection-390x844.png`.

초기 QA 도구 실패도 보존: CLI VM dynamic-import 불가→host에서 JSON 전달로 조정; 최초 player name 비어 intro 조건이라 공격버튼 wait timeout→QA 이름 설정. 두 번째 fixture를 reload 전에 저장하면 unload flush가 기존 player를 다시 쓰므로 init-script one-shot으로 수정했다. 정상 복원 동작을 앱 결함으로 처리하지 않았으며 게임 코드는 변경하지 않았다. Generic skill client screenshot은 기본 item-investment 장비제작 화면 검증일 뿐 도서관 전리품 증거가 아니다.

Direct QA console errors0/warnings0, CLI library-loot 정상 종료; 소유 dev82477 SIGINT 종료. Native 이후 candidate6 aggregate `7dcbf4b4257c12a53bd7b6eefd6960add664cec9b60ddfe5bd5d676f2b1615d6`, Toss38 `d163a994bb201ab89d32c17fed9e96945c70fa5843406980238d9e414f5ee588` 재확인 일치. Sorted `[repo-relative path,SHA256]` JSON SHA256 비교.

Commit/push/install/sign/publish/유료 API 없음. Elemental6는 별도 승인 범위, 전체Goal과 기기/lifecycle/S6는 미완료다.
