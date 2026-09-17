# 저장·귀환 HP 수정 후 회귀 검증

## 최신 전체 unit 재실행 — 2026-09-07

`npm run test:unit` handle94799 exit1, 105.864초: 총4365 / PASS4361 / FAIL4 / skipped0 / cancelled0. 전체 로그 `/tmp/aetheria-current-unit-0907.log`. 이 결과는 아래 과거4364/5FAIL 상태를 대체한다. `npm run type-check && npm run lint` handle41964 exit0. Native tracked drift0. Production 파일은 이 검증 중 수정하지 않았다.

실패는 다음 네 개이며, 새 progression 실패는 없다.

1. `tests/art-asset-contract.test.js:419` — `only a passing stable report can be written as evidence`: 전체 art report가 실패하므로 승인 증빙 쓰기를 거부한다.
2. `tests/equipment-signature-art.test.js:251` — anonymous contact answer-key projection: 대지의 심판의 기존 `2H warhammer` 설명과 현재 registry의 `2H greatsword` 설명 불일치.
3. `tests/equipment-signature-art.test.js:283` — 전체 art verifier: `equipment:Signature registry hash mismatch`.
4. `tests/monster-catalog-art.test.js` — approved full art verification: 같은 전체 verifier의 `equipment:Signature registry hash mismatch`. 몬스터 파일 누락을 뜻하는 실패가 아니다.

이는 알려진 대지의 심판 원화/runtime/provenance 교정이 아직 완결되지 않았다는 증거다. 테스트 삭제, registry를 다시 잘못된 망치로 변경, 이전 그림에 새 승인 hash만 부여하는 방식으로 GREEN을 만들지 않는다. 실제 item/overlay 교정과 결합 증빙을 완료한 뒤 전체 unit 및 verify:full을 다시 실행한다. 이번에는 build/browser/native 전체 gate를 수행했다고 주장하지 않는다. 두 실행 handle은 terminal 상태다.

## 완료된 검증

### 오프라인 귀환 수정 후 source reconciliation

2026-09-07 write→readonly verify70573 exit0, evidence SHA `7401b63d9619a1f2fe8c04c0110b925c6068c9ab8da163b9c396339af09e0042`. 직전 evidence 대비 `src/components/app/GameRoot.tsx` source hash만 변경됐고 report/v1은 동일하다. HardErrors0, focused64/comparison1000 유지. 로그 `/tmp/aetheria-progression-offline-{write,verify}-0907.log`.

content:verify, equipment:economy:verify, event-reward:verify47920 exit0. 이벤트108행/errors0. Native tracked drift0, diff-check PASS. Candidate6 aggregate `ac1956ad67087ddeae0cd1af85e57eee7a6bf94d3afb81b00a823f2ceb5ea0dd`, Toss38 `0f870e56774c46dcbd477ceda6e9c6c1f312a4a7dec3f84ad10b3342934d5b5c` 보존 확인. 이 증빙 갱신은 미완료 art4건을 승인하거나 full/native PASS를 대체하지 않는다.

- 원정/Class Journey/cloud focused integration: 95/95, type-check/lint/diff-check PASS.
- 실제 fresh 생성→출정→자연 전투→귀환→동일 세션 reload: HP113/178 및63%, 재화/전리품/원정 기록 보존. `fresh-combat-owner-20260907.md`와 실제 화면 두 장 참조.
- 전체 unit: 4364개 중4359 PASS/5 FAIL, exit1. `/tmp/aetheria-post-save-hp-unit-0907.log`.
- 실패 중 progression source evidence는 write→readonly verify 완료. SHA `c03ebd7ac25a155adca4baaef7d7de7a8a4e2a02f9190803e62379680624b184`, focused64/comparison1000, report/v1 불변, hardErrors0.
- 나머지 art4건은 signature registry/answer-key/runtime 결합 불일치이며 미해결이다. 전체 unit 재실행 PASS나 전체 release 완료로 표시하지 않는다.

## 브라우저 검증 종료

`AETHERIA_RUN_E2E=1 AETHERIA_PREVIEW_PORT=4381 AETHERIA_PREVIEW_LOG=/tmp/aetheria-post-hp-preview-0907.log bash scripts/local-playtest.sh`

- 실행 handle69777은 exit0으로 종료했다. 로그 `/tmp/aetheria-post-hp-browser-0907.log`.
- Test API가 켜진 별도 검증 build이며 build guard PASS, desktop/mobile smoke 모두 `ok`; desktop 뒤 browser.close timeout이 기록되었다. E2E shard1은59/59 PASS(5.1m), shard2 57개 실행 중이며 전체 종료 증거는 아직 없다. `verify:full` 자체를 통과한 것은 아니다.
- 소유 preview는 스크립트 EXIT trap이 정리한다. 실행 중 재시작하거나 preview를 먼저 종료하지 않는다.
- 최종 로그: shard1 59/59(5.1m), shard2 57/57(5.0m), `[local-playtest] done`. 별도 직접 offline run은 실패했고 `offline-return-20260907.md`에 기록했다. 위 suite PASS가 그 결함을 반증하지 않는다.

## Coverage 경계

- `scripts/smoke-gameplay.mjs`는 재시작 확인창과 취소 버튼의 도달성을 검사하고 취소 후 장비 화면으로 이동한다.
- `tests/e2e/system-settings-design.spec.ts`는 재시작 확정 후 Intro로 전환되는지 검사한다.
- `tests/e2e/restore-feedback.spec.ts`는 저장 HP 복원 시 가짜 피격 연출이 없는지 검사한다.
- 기본 smoke/E2E를 physical background/foreground, offline recovery, full-inventory 직접 검수의 대체 증거로 사용하지 않는다. Toss 전용 smoke의 visibilityState 재정의는 합성 이벤트이며 실제 OS background 증거가 아니다.
- 새 native package/설치 증거는 없다. 기존 v5 package는 이번 저장·HP 수정을 포함하지 않는다.
# UI 검수 후 source reconciliation — 2026-09-07

`progression:diagnostic:write`와 read-only `progression:diagnostic:verify` 순차 PASS(handle57940exit0). 이전 파일은 `/tmp/aetheria-progression-before-ui-review-0907.json`에 복사 보존했다. 현재 evidence SHA256은 `375f0393f1ac8be1eeaf206a6ed1a484d5a14041a1fb4f3141d0b235557bb09d`다. 이전 대비 `src/components/EquipmentPanel.tsx` source hash만 변경됐고 report/v1 JSON은 동일하다. Focused64/comparison1000, hardErrors0. 로그 `/tmp/aetheria-ui-review-diagnostic-{write,verify}-0907.log`.

별도 `npm run art:verify` exit1: `invalidArtwork`의 `equipment:Signature registry hash mismatch` 하나. Classes18/equipment229/families22/signatureOverlays25/monsters254이며 missing/extra/duplicates/invalidPng/invalidAlpha/invalidBounds/invalidStyleVersion은 빈 배열이다. 이는 캐릭터 내부 배경·맵 stray border·그림 의미의 시각 결함이 해결됐다는 뜻이 아니다. 이미 기록한 대지의 심판 artNote와 기존 artwork provenance 불일치가 남아 있으므로 증거를 억지로 승인하지 않는다. 로그 `/tmp/aetheria-ui-review-art-0907.log`.

Historical aggregate 재검사: candidates6 `ac1956ad67087ddeae0cd1af85e57eee7a6bf94d3afb81b00a823f2ceb5ea0dd`, Toss releases38 `0f870e56774c46dcbd477ceda6e9c6c1f312a4a7dec3f84ad10b3342934d5b5c`, 이전과 동일. 이 checkpoint는 full unit/full/native 재실행이 아니다.
