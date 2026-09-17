# 두 번째 fresh run: 첫 전투와 귀환

## 계산 수정 후 focused 검증

### 수정 후 실제 화면과 동일 세션 reload

별도 fresh `hp-restore-sep7`에서 실제 UI 생성→첫 출정→이야기 조사→자연 발생 단단한 슬라임→기본 공격 승리→귀환을 수행했다. Test API/state injection/seed override는 사용하지 않았다. 시작178/178, 종료113/178, 전투EXP14·골드21·젤리2개; 원정은1전투/2탐험/EXP39/골드121이다.

귀환 카드 `HP 113 · 63%`는113/178 반올림과 일치한다. 같은 브라우저에서 reload 후 저장 복원 안내, 이름·마을·HP113/178·기력52/52·골드321·EXP39/200과 동일 원정 카드/젤리2개를 확인했다. 이는 동일 세션 reload 증거이며 앱 삭제·다른 기기 복구 증거는 아니다.

Owner가 두390×844 캡처를 직접 열어 확인했다: `output/playwright/completion-20260907/hp-fixed-return-390x844.png`, `hp-fixed-restored-390x844.png`. width/scrollWidth390/390, 카드와 CTA가 화면 안에 있다. Console에는 local `/api/ai-proxy`404 두 건과 quota permission warning 한 건; Save Failed는 없었다. AI provider 성공이나 quota 문제 해결로 주장하지 않는다.

브라우저 close 완료, 검증 종료 후에만 owned dev60691을 Ctrl-C 종료했다. 이전 reload timeout 증거는 아래 보존한다. 새 full/native 검증은 아직 수행하지 않았다.

`expeditionLedger` 신규 start/return 최대 HP를 production `calculateFullStats`로 변경했다. 회귀 fixture는 기본150 + 모험가 패시브20 + 장비8 =178, HP134에서75%를 검증한다. 장비를 벗으면 귀환 최대HP170이지만 시작 분모178은 유지한다. 기존 저장 snapshot의150은 재해석하지 않아89%를 보존한다.

- RED: snapshot150 !==178. 초기 fixture 조정 실패는 패시브 보너스 누락이며 결함 재현으로 세지 않는다.
- Focused27/27, 원정 전체/Class Journey/cloud integration95/95, tsc/lint/diff-check PASS.
- 아래 캡처는 **수정 전** 증거다. 수정 후 실제 화면·reload·전체 gate·native packaging은 미완료다.

## 직접 실행

390×844의 새 브라우저 프로필에서 실제 UI로 생성→고요한 숲→첫 이야기 조사→두 번째 탐험→거대 사슴벌레 전투→귀환→임무 보상 수령을 진행했다. 이전 cloud-save 검수 세션의 복원이 아니라 별도 fresh run이다. Test API/state injection/seed override 없이 수행했다.

- 시작HP178/178, 기력52/52. 적HP104.
- 공격: 적104→89, 자신178→167.
- 강타: 적89→69, 기력52→42, 적은 방어 자세.
- 하급 체력 물약:2개→1개. 최대HP까지 회복 후 적의11피해로167/178. 동일HP라는 이유만으로 회복 실패로 판단하지 않는다.
- 추가 공격4회로 적69→41→25→11→0, 마지막 자신HP134.
- 승리: 경험12·골드18·벌레 껍질, 첫 사냥 칭호와 계승 정수2 로그 확인.
- 귀환: 전투1/탐험2, 원정EXP37/골드118, 사용·소모1. 이어서 임무 보상 받기 클릭 후 완료 로그 확인.
- Owner 직접 검수: `output/playwright/completion-20260907/fresh-combat-{item,victory,return}-390x844.png`. 전투 조작부가로그 아래, viewport/scrollWidth390/390.

## 발견한 결함: EXPEDITION-HP-01 / Important

귀환 카드는 HP134를89%로 표시한다. 실제 전투 최대HP178 기준이면75%다. `src/utils/expeditionLedger.ts`의 startExpedition이 maxHpAtStart에 장비/직업 보너스를 계산하지 않은 player.maxHp(150)를 저장하고, summary가그값으로나눈다. maxHpAtReturn도 rawplayer.maxHp를사용한다. 시작과귀환의표시최대HP에production stats계산을사용하는TDD수정이필요하다. 기존저장된snapshot의분모를현재장비로추측해소급변경하지않는다.

## 미확인·환경 경계

- Console error3개는 로컬 `/api/ai-proxy`404다. Narrative fallback으로전투/보상은계속진행했으며이번세션에Save Failed는없었다. AI provider 성공/무오류 세션으로주장하지않는다.
- 마지막reload 후정확한복원문구를기다리는보조검수는30초timeout. 대기중owneddev를먼저종료한실행순서문제도있다. 복원성공·실패를확정할증거가없으며복원screenshot은생성되지않았다. 해당문구만으로복원을판정하지말고다음에는서버를유지한채실제상태를확인한다.
- Browser는닫혔고owneddev33821은CtrlCexit130. 마지막복합shell64652는후속close가성공해exit0이지만내부Playwright복원대기는실패했다. 전체명령exit0으로복원PASS를주장하지않는다.
- 이기록은첫전투한경로이며레벨업/장비선택/midlate/offline/device전체완료아님. 새게임저장·기존master·candidateevidence는삭제하지않았다.
