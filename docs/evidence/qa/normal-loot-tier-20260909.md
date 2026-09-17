# Normal loot tier — 승인된 구현과 검증

상태: **승인된 normal loot tier local checkpoint 완료**. Production 구현·focused/독립 감사·전체 gate·직접 UI·native packaging PASS. 전체 게임 완성 또는 배포 증거가 아니다.

## 구현 계약

- `CombatEngine.loot.ts`의 기존 bonus 성공 branch에서만 실제 적 level 기준 Tier를 선택한다. Known map의 canonical monster membership까지 일치해야 한다.
- Boss/elite/infinite/unknown map/불일치 species/잘못된 level은 기존 fallback. Enriched early return, legacy item roll, eligibility와 확률은 보존한다.
- Ordinary bonus pool에서 signature를 제외한다. 기존 boss signature source/pity는 유지한다. Eager equipment catalog validation이 빈 ordinary Tier를 거부한다.
- EXP-derived eligibility는 남아 있다. 이번 수정은 drop 횟수, 모든 지역 보상, 자연 성장 속도 전체를 재설계하지 않았다.
- 기존 `combat-engine-loot.test.js`의 Tier mirror 8개를 production `processLoot` 검사로 교체했다. 나머지 인라인 검사가 integration인 것처럼 표현하지 않는다.

## TDD와 독립 감사

- 최초 RED: `/tmp/aetheria-normal-loot-red.log` (실제 Tier6, 기대 Tier3 등).
- Eager catalog validator 제거 mutation RED: `/tmp/aetheria-normal-loot-catalog-red.log`.
- Infinite guard 제거 mutation RED: `/tmp/aetheria-normal-loot-infinite-mutation-red.log`, 실제4/기대6. Canonical 무한 지역의 모든 species가 enriched table을 가지므로 test는 해당 fixture의 두 table entry를 잠시 제거하고 `finally`로 복원한다. 단순한 미등록 지역 test로 guard를 증명하지 않는다.
- 최종 focused: `node --import tsx --test tests/normal-loot-tier.test.js tests/combat-engine-loot.test.js tests/loot-cycle.test.js tests/combat-loot-capacity-authority.test.js tests/signature-set-reachability.test.js` — **90/90 PASS**, `/tmp/aetheria-normal-loot-review-focused-final.log`.
- 정상 지역 spawn Lv18/36/55/62, ordinary pool 전체 항목, signature 제외, full/one-slot/roomy receipt와 exact replay no-op을 포함한다.
- 처음 maxInv0 fixture는 production normalization에서 기본값으로 취급됐다. maxInv1+occupied fixture로 full 상태를 검증했고 production을 바꾸지 않았다.
- Sol/xhigh bounded 재감사: **Critical0/Important0**. 두 검증 공백을 보완한 뒤 최종 판정이다. Full/native 완료 판정은 아니다.

## 지역별 전후 진단

`output/normal-loot-regional-qa.mjs`는 production `spawnEnemy → RESOLVE_COMBAT_ACTION → lootSettlement → canEquip → SELL_INVENTORY_ITEM`을 호출한다. Capacity 재계산·로그 parsing·판매 산식 복사 없음.

```sh
node --import tsx output/normal-loot-regional-qa.mjs src
node --import tsx output/normal-loot-regional-qa.mjs output/normal-loot-preimage-20260909/src
```

Baseline은 current source snapshot에서 `CombatEngine.loot.ts`만 보존한 preimage로 대체한 격리 복사본이다. Canonical checkout을 교체하지 않았다. 따라서 이 비교는 **loot selector 한 변경**의 차이를 격리하며 과거 전체 빌드 비교가 아니다.

18 jobs × checkpoints2/5/10/20/45/60/75 +28/62를 열거한다. 직업 미해금·reachable branch 없음78항목을 unavailable로 명시했다. 실행 가능한175cohorts 각각64seeds(start20260824)×32attempts, 전후 각각 **358,400 victory settlements**다. 지역 전체가 아니라 각 level에서 접근 가능한 최고 no-table/legacy 대표 두 branch를 사용했다. Lv2는 두 branch 모두 없으므로 실행0이며 누락을 정상 보상으로 간주하지 않는다.

원래 seeded spawn probe가 elite를 만들었으므로 최초 assertion 실패를 `/tmp/aetheria-normal-loot-regional-after.err`에 보존했다. 최종은 spawn RNG0.5로 일반종을 고정하고 combat/loot seed는64×32 전부 유지한다. HP1·고공격·빈가방·빈장비의 정산 fixture이며 전투 생존성/자연확률·retention/실제 플레이 증거가 아니다.

| Player level | 정산 횟수 | 전후 장비 개수 | level 부족 전→후 | 장착 가능 전→후 | 실제 판매 골드 합 전→후 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 20 | 24,576 | 1,460 | 1,460→0 | 0→338 | 4,988,497→893,704 |
| 28 | 28,672 | 1,735 | 1,735→0 | 0→367 | 30,270,097→1,525,248 |
| 45 | 53,248 | 3,150 | 3,150→0 | 0→544 | 93,491,958→3,256,608 |
| 60 | 73,728 | 4,367 | 4,367→0 | 0→628 | 129,023,377→9,649,628 |
| 62 | 73,728 | 4,474 | 4,474→0 | 0→552 | 144,189,445→60,194,280 |
| 75 | 73,728 | 4,288 | 0→0 | 622→620 | 140,940,389→153,489,300 |

Lv5/10은 장비0·material 보상/판매 불변. 모든175cohort의 rolled/admitted/equipment count는 전후 동일하며 blocked0, pity change0이다. 비교 대상 normal branch의 signature는 제거된다. Lv75에는 signature 판매 거절이 사라져 판매 가능 수입이 오히려 증가한다. DB item price와 실제 판매 gold의 p10/p50/p90 및 합은 raw report에서 분리한다. 미래 장비 제거와 경제 변화는 의도된 범위지만, 모든 직업에 유리하거나 자연 성장 속도가 개선됐다는 주장은 하지 않는다.

Raw local artifacts (보존, 미커밋):

- Runner SHA256 `f62486102abe84ccdc6631f728efb0773a4532ddf5eef8623e3c8ed68d70b86f`.
- `output/normal-loot-preimage-20260909/regional-report.json`: `3b8745f70a08551684aae96a596a773e422214fd94ea5639d3a50f18b929a032`.
- `output/normal-loot-regional-report.json`: `6cff9deb6eb596428f21cfbad46d764ee36d8e08830ec94b17e03c960cb3b23c`.

## Canonical evidence

Writer67021 exit0 → readonly verify PASS 후 full93992 시작. Writer와 reader/full을 겹치지 않았다.

- `relic-drop-rate.json`와 `relic-event-chance.json`: source seals만 갱신, report bytes와 reportHash 전후 동일.
- `progression-diagnostic-v2.json`: SHA256 `6e9422e0d5c9726d18b5e3189f5821b97a592e9e2d5a24a06c315dc8368c4ae1`; canonical64/1000seed 재계산·byte verification PASS. Source manifest에 production loot test 두 경로를 포함한다.
- Report change는 loot jobs8개. Combat/exploration/rewardProgression/signatureBosses/capacityPressure 불변, hardErrors0. v1Baseline 동일, seed20260810 v1 stdout도 byte-identical.
- 기존 v1 fixture의 spawn map과 loot player.loc가 불일치하는 경우가 있어 provenance guard에서 legacy 유지된다. v1 hash 불변을 새 지역 보상 모델의 정확성 증거로 사용하지 않는다.

## 현재 실행 상태 / 남은 gate

- Full93992 exit0: `/tmp/aetheria-normal-loot-full.log`, typecheck/lint/unit4462/build-guard/desktop+mobile smoke/E2E118(59+59) PASS. Desktop smoke의 browser.close timeout 경고는 보존했고 전체 runner는 exit0로 종료됐다.
- 직접390×844 UI PASS: 별도QA origin4434, CLI session `normal-loot`, dev98592. 실제 공격 seed20260841→Tier3대지방패 획득→가방 장착→reload 중복0. Seed20260850→Tier3쌍두마도서 획득→전사 직업 제한/disabled 장착 확인. 실제 경로 용암 지대→화염의 사원→화염의 협곡→서쪽 평원→시작의 마을 이동 후 reload에서 방패 offhand·마도서 inventory 유지. 최종38741 exit0, `/tmp/aetheria-normal-loot-ui-final-corrected.log`, overflowfalse/errors0/warnings0. Active expedition 없는 fixture이므로 원정 debrief 증거로 확대하지 않는다.
- Owner가 `output/playwright/normal-loot-victory-390x844.png`, `normal-loot-job-rejected-390x844.png`, `normal-loot-final-equipped-restored-390x844.png`를 직접 열어 검수했다. 기존 web-game client31259 exit0/capture 확인은 별도 기본 제작 화면 smoke이며 새 loot 증거와 구분한다.
- 최초 return-restored screenshot은 fade 중이라 최종 시각 증거에서 제외한다. 첫 UI 완료 script12609는 disabled button 자체의 의도된 opacity까지1로 기다려 timeout; 제품 변경 없이 parent animation readiness만 검사하도록 교정해38741 PASS. 최초 실패 `/tmp/aetheria-normal-loot-ui-final.log`와 이미지는 보존한다.
- QA의 큰 HP/ATK 및 급속 level-up은 forced fixture이며 자연 플레이/전체 balance 증거가 아니다. 개인 save와 설치앱은 건드리지 않았다.
- Supplemental evidence 독립 Sol/xhigh 감사도 C0/I0. Snapshot source delta exact1, raw175rows/64×32/18jobs/9levels, 표의 합계와 SHA, canonical report diff/v1/replay를 별도로 재검산했다.
- 별도 직접QA 브라우저 종료/own dev98592 SIGINT 종료. 개인 브라우저는 종료하지 않았다. Full93992의 preview/E2E도 최종 종료됐다.
- Native 전 보호 상태 기록: candidate6 files aggregate `7dcbf4b4257c12a53bd7b6eefd6960add664cec9b60ddfe5bd5d676f2b1615d6`, Toss38 files aggregate `d163a994bb201ab89d32c17fed9e96945c70fa5843406980238d9e414f5ee588` (sorted `[relative path, sha256]` rows의 JSON SHA256). 이번에 이 디렉터리를 refresh하지 않았다. Index empty/native tracked drift0.
- Cap74990, Android42785, iOS4748 모두 exit0. 기존 native verifier328선택경로와 dark greatsword 추가1경로를 대조했다. 추가로 **production JS43개 전체**가 dist/APK/iOS에서 byte-identical이다. 총 unique371경로(이미지328+JS43)이며 전체 APK 파일 수가 아니다. 실제 변경은 `assets/game-combat-Bkabfg7J.js`에 포함됐고 SHA `12341b74feafe0c4e638e8df55052edfbcbd9197412a919d551105cd6ffe203b`를 확인했다.
- 최신 미설치 unsigned iOS: `/tmp/aetheria-normal-loot-ios.FviZzN/Build/Products/Release-iphoneos/App.app`.
- 최신 debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 227039347bytes, SHA256 `7ba796bd153d93a7ef4964661005216a2e1dc834653286471e3a05b06a129899`.
- Main `assets/index-BOjJS7i9.js` SHA256 `b1fcc025fa6369ba9427e3826e13dba2b52826979d673bda5c57d94e92fad437`. 기존 selected-path receipt `/tmp/aetheria-normal-loot-native.json`, native logs `/tmp/aetheria-normal-loot-{cap,android,ios}.log`.
- Native 후 candidate6/Toss38 aggregate 재검증 PASS, tracked native drift0, index empty, `git diff --check` PASS. 모든 이번 소유 실행 종료. 물리 Android/설치/서명/기존 archive 변경 없음.
- 원래 image6 설계 승인, 도서관 지역 보상 적합성, 남은 이미지 감사, 기기/lifecycle/S6는 별도 남는다. No commit/push/install/sign/publish.
