# Fresh v19 play — in progress

## Latest: natural quest completion, town claim and reload

네 번째 원정을 정상 귀환했다. 실제 debrief는 LV1→2, 전투6/탐험13/EXP+99/gold+153/최저HP67(36%)로 진행 기록과 일치했다. `output/playwright/s5-fresh-levelup-return-390x844.png` owner 검수 완료. 표시된35분은 도구·디버깅 대기를 포함하므로 실제 active-play 소요 시간으로 사용하지 않는다.

귀환 정리의 휴식66gold를 사용해 HP209/MP69로 회복하고 gold494가 됐다. 다섯 번째 원정의 첫 탐험에서 자연 슬라임을 만나 기술/공격으로 처치했다. 임무가2/3→3/3, 전투 보상으로 EXP13→29/gold494→519가 됐다. 숲에서는 `마을에서 수령` 버튼이 disabled였고 퀘스트 보상은 지급되지 않았다.

실제 이동으로 마을에 돌아온 뒤 debrief의 `임무 보상 받기`를 한 번 눌렀다. EXP29→69(+40), gold519→619(+100), 퀘스트 완료 이야기와 수령 버튼 제거를 확인했다. Reload의 boot ready 후 claimedQuestIds에1 포함, questCount0, EXP69/gold619를 assert했고 보상 받기 버튼이 없었다. 현재 시작의 마을 Lv2 EXP69/229 HP199/209 MP49/69 gold619, active expedition 없음.

Owner가 `output/playwright/s5-fresh-quest-earned-390x844.png`, `s5-fresh-quest-claimed-390x844.png`, `s5-fresh-quest-claimed-restored-390x844.png`를 각각 열었다. 이는 자연 임무 수락→대상 처치→안전 귀환→명시적 보상→복원 경로의 증거다. 모든143개 임무·장기 성장·실기기 검증을 대체하지 않는다. 새 console 항목은 reload의 React DevTools INFO이며 이전 key/HMR 오류 이력은 삭제하지 않았다.

## Latest: first natural level-up and preserved restoration

네 번째 원정의 모닥불에서 단련 선택→다음 독버섯 전투에서 저장 tempBuff atk0.3/turn5 확인→독버섯·슬라임·정예 늑대·늑대·거미떼 승리로 최초 Lv2에 도달했다. 정예 늑대 광폭화에 하급/중급 체력 물약을 사용했고 거미떼 전투 전에 하급 물약을 사용했다. 중급 물약 시도1회는 열린 패널을 다시 닫은 automation 실수로 timeout; aria-expanded 확인 후 실제 사용 성공했다. 그 사이 HP guard가 추가 공격을 막았으며 저장 주입/치트는 없었다.

현재 숲 Lv2 EXP13/229 HP89/209 MP17/69 gold560, 슬라임 소탕2/3, 네 번째 원정 진행 중. 레벨업 순간 로그 key collision을 발견해 별도 TDD 수정했다. `story-log-identity-20260908.md`에 원인·실패·fixed fixture 및 HMR/reload 경계를 기록했다. 최초 레벨업 캡처와 reload 복원 캡처를 owner 검수했다. 첫 자연 레벨업은 이제 관측됐지만 이 시간 분할 run으로 첫 세션 소요 시간이나 balance 목표를 입증하지 않는다. 임무 완료/보상 수령은 아직 남아 있다.

## Latest: fourth expedition, natural relic and quest progress

같은 캐릭터에서 `휴식하고 준비`를 눌러 gold470→407(-63), HP59→187, MP2→57을 확인했다. `고요한 숲으로 출발`은 수락 임무1을 active focus로 유지했다. 이후 실제 탐험5회는 조용함→조용함→유물→조용함→슬라임 전투였다. 세 번째 탐험의 선택창에서 행운의 동전/그림자 망토/암석 피부를 비교하고 그림자 망토를 선택했다. RNG·save·EXP를 주입하지 않았다.

슬라임 HP77과 실제 공격 버튼으로 교전했고 네 번의 공격 이내에 승리했다. EXP114→126, gold407→425, HP187→150, MP57 유지. 임무 패널/저장 snapshot 모두 quest1 progress1, relics에 `shadow_cloak`을 확인했다. 탐험10회 오늘의 임무 보상 중급 체력 물약과 전투 전리품 하급 체력 물약의 로그를 관측했으며 두 보상 경로를 혼동하지 않는다.

Owner가 `output/playwright/s5-fresh-natural-relic-390x844.png`와 `s5-fresh-slime-progress-390x844.png`를 각각 열었다. 최종 HUD는 슬라임 소탕1/3과 고요한 숲, HP150/187, EXP126/200, gold425를 표시한다. 현재 네 번째 원정이 진행 중이며 첫 레벨업과 임무3/3 완료는 아직 미관측이다. 이5회 분포만으로 전체 이벤트 확률이나 성장 속도를 판정하지 않는다.

## Latest: natural quest acceptance and restoration

같은 fresh profile `s5-fresh-v19`에서 임무→마을 임무 게시판을 열고 추천 `슬라임 소탕`을 실제 버튼으로 수락했다. 게시판은 HP59/187 상태에 `정비 필요`, 목적지 고요한 숲, 보상 경험40/골드100을 표시했다. 수락 뒤 진행1/슬라임0/3이 표시됐으며 즉시 보상이나 EXP가 지급되지 않았다.

Reload 후 `bootStage === ready`를 기다리고 questCount1/EXP114/gold470을 assert했다. 실제 임무 패널에서도 슬라임 소탕0/3과 보상이 보존됐다. Owner가 `output/playwright/s5-fresh-quest-accepted-390x844.png`와 `s5-fresh-quest-restored-390x844.png`를 각각 열어 확인했다. 최종 console 추가 항목은 React DevTools INFO다. Save 주입, seed 변경, 처치 수 조작은 하지 않았다.

현재 임무 패널 열림, 마을 Lv1 EXP114/200 HP59/187 MP2/57 gold470. 임무 수락·저장 복원 증거이며, 임무 달성/보상 수령/첫 레벨업을 증명하지 않는다. 다음 자연 플레이는 휴식 후 고요한 숲의 수락 임무를 진행한다.

## Latest: natural shop choice, one-hand pair and full set

같은 save에서 실제 마을 시설→상점→가방→장착 UI를 사용했다. 농부의 포크40gold/공격력+2와 녹슨 단검50gold/+1 표시를 비교해 포크를1개 구매했다. Gold510→470, 가방3→4를 관측했다. 장착 뒤 포크는 canonical `getNextEquipmentState`의 `pickBestOneHandPair` 결과로 보조 슬롯에 들어갔으며, 기존 주무기 녹슨 단검/여행자 튜닉을 유지하고 모험가 세트 **방랑자의 별자리3/3**가 표시됐다. Item type을 방패로 바꾸거나 수동 슬롯 주입하지 않았다.

저장된 snapshot의 weapon/offhand/armor 이름, gold470, inventory 자연의 결정3개를 읽고 reload의 bootStage ready 후 실제 장비 콘솔에서도 같은 조합을 확인했다. Owner가 다음390×844 캡처를 각각 열었다: `output/playwright/s5-fresh-shop-choice-390x844.png`, `s5-fresh-fork-before-equip-390x844.png`, `s5-fresh-fork-equipped-390x844.png`, `s5-fresh-fork-restored-390x844.png`. 이름·가격·비교/장착 가능·세트 완료가 읽힌다. 원래 직업 초상은 고정 그림이며 포크의 착용 합성은 주장하지 않는다.

Current: town, Lv1 EXP114/200, HP59/187, MP2/57, gold470, 장비 콘솔 열림. 아래의 "새 장비 판단 미관측"은 이 관찰로 해소됐지만 **첫 레벨업은 여전히 미관측**이다. Raw `/tmp/aetheria-fresh-{purchased-state,bag-state,fork-save,fork-restore}.log`. Seed/EXP/item 주입·production save 수정·외부 결제 없음. 정상 게임 내 gold만 사용했다.

## Latest continuation: restored debrief and natural Scout return

Same preserved character/save on dev4430. The previous expedition's debrief was now actually rendered after reload: lowestHP127/71%, screenshot `output/playwright/s5-vitals-restored-debrief-390x844.png` personally inspected. This supplements the earlier persisted-bytes-only proof below.

Used the normal `휴식하고 회복` action (63gold), moved to 고요한 숲, naturally encountered 숲의 정령 and won with skills. The next Explore naturally offered Scout; chose `전투의 기척` and fought 숲 요정 using attacks and one available skill. No seeds, inventory, level or state were injected. Low HP guidance recommended retreat; returned via the actual route UI.

Third expedition debrief: **combat2 / explore2 / +25EXP / +37gold / lowestHP59 (33%) / 자연의 결정 x2**. Scout battle is not duplicated in the displayed combat count. Owner viewed `output/playwright/s5-fresh-third-return-390x844.png`; Scout choice and outcome captures are `s5-fresh-scout-choice-390x844.png` and `s5-fresh-scout-outcome-390x844.png`. Current state is town Lv1, EXP114/200, HP59/178, MP2/52, gold510, debrief open. First level-up and new equipment decision are still not observed. The displayed four-minute duration includes inspection/tool time; do not use it as an active-play pacing measurement.

Raw logs: `/tmp/aetheria-fresh-{current,rest,third-combat-state,scout-combat,scout-mid,scout-final-state,third-return-state}.log`. This is isolated offline QA, not production AI/cloud/Toss verification. Latest completed native vitals is documented in `game-completion-vitals-native-20260908.md`; older native pending wording below is historical. The newer dark-greatsword full gate is still running and its native package has not yet been built.

## Follow-up: minimum HP correction verified in natural play

The initial discrepancy below is historical. Two regression tests reproduced missing tracking (100 instead of 77/78), then passed after the two non-victory combat reducer paths reused `trackExpeditionVitals`. Focused combat-item/expedition-ledger/return-flow: 36/36. Independent Sol/xhigh review: Critical 0, Important 0; independent focused 28/28. No combat numeric, RNG or save-schema change.

The same isolated fresh save was reloaded on dev4430 with the corrected source, without reseeding or injecting items/levels. The second expedition naturally met 숲 요정. Actual attack/skill/item actions produced HP160→149→138→167→156→145→127, then another potion and victory. Returned HP160; debrief and persisted summary correctly retained lowestHP127/71%, ID `expedition-1788845337713-2`. After reload, the saved summary retained the same ID and lowestHP127. This last read proves persisted bytes after reload, not a second rendered debrief.

Owner viewed `output/playwright/s5-vitals-fixed-return-390x844.png`: readable full debrief and correct lowestHP127. Raw observations: `/tmp/aetheria-vitals-damage2.log`, `/tmp/aetheria-vitals-after-next.log`, `/tmp/aetheria-vitals-saved-proof.log`, `/tmp/aetheria-vitals-restore-proof.log`. No horizontal overflow was observed in the saved-state proof. Current character: Lv1, EXP89/200, HP160/178; second expedition +12EXP/+18gold, material 자연의 결정, two potions consumed. First level-up and new equipment choice remain unobserved. Inspection time is not active-play pacing evidence.

Full verification session89080 completed exit0 (`/tmp/aetheria-expedition-vitals-full.log`): unit4409, E2E59+58, desktop/mobile smoke passed. Desktop browser-close timed out under the existing close guard; the wrapper still completed. Canonical progression/DOT evidence writers updated only source bindings with identical reports. Cap/doctor9051 completed exit0. Android debug30755 and iOS unsigned31060 are running with new iOS DerivedData; package comparison remains pending. The previous v19 packages predate this correction. No install/commit/publication.

Fresh browser profile `s5-fresh-v19`,390×844, local QA dev4430/session99422, `?deviceQa=toss-first-five`. No avatar/level/item injection or seeded combat inputs. QA mode provides offline story fallback and isolated storage, so this is not a production AI/server session or a Toss device observation.

## First expedition

UI start selected generated name 제라드. Lv1,200gold,HP178/MP52. Departed for forest; first-visit reward gave100gold/25EXP. First explore offered Magic Traces; chose investigate. Next explore naturally encountered giant stag beetle HP104. Used skill, attack, skill, healing potion, final attack. Recorded player HP167→156→138→160 after healing/enemy response. Victory gave18gold and a prefixed lower healing potion. No equipment dropped.

Returned through map UI, inspected debrief and claimed first-story reward. Current town state: Lv1,EXP77/200,gold518,HP160/178,MP32/52. First level-up and meaningful equipment choice remain unobserved; continue this same run rather than seeding them. Debrief duration includes automation inspection delay, not a gameplay speed metric.

## Confirmed discrepancy requiring regression test

Debrief says lowestHP160/90%, while actual stable combat snapshot `/tmp/aetheria-s5-fresh-battle3.log` recordsHP138/178 before potion use. Saved summary also sayslowestHp160, as read after explicit flush in `/tmp/aetheria-s5-fresh-v19-checkpoint.log`. Owner viewed `output/playwright/s5-fresh-v19-first-return-390x844.png`.

Source: `trackExpeditionVitals` exists, but non-victory `RESOLVE_COMBAT_ACTION` and `USE_COMBAT_ITEM` return result.player without that tracking. Victory settlement tracks later HP, losing an earlier low point followed by healing. Next minimal correction must add a regression for damage→healing→victory→safe return and preserve RNG, rewards, replay and save compatibility. No production fix yet.

## Harness limit

One two-click automation attempt waited on `getTrueEndingJourneySnapshot().combatTurn` and timed out after only one actual attack. `useGameEngine` consumes combatTurn internally but does not expose it in its returned public object, so that getter's fallback0 is not a usable turn-progress signal. The subsequent actions used observed UI and HP. This is not evidence of a failed gameplay attack or two attacks. Log `/tmp/aetheria-s5-fresh-attacks.log` retained; no compensating state/seed injection.

Browser and dev server remain available for continuation. Isolated local save contains the current town checkpoint; no normal save, native artifact, commit or publication changes.
