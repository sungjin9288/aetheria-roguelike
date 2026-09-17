# 황금 왕국 조우 접근성 — 읽기 전용 중간 감사

## 실제 모바일 확인 — Important UI 접근성 공백

격리 localhost4420/VITE_ENABLE_TEST_API=1의 Lv58 황금 왕국 idle fixture로 390×844 화면을 열었다. 적은 주입하지 않았다. 설정은 `output/kingdom-access-setup.js`, owner가 확인한 화면은 `output/playwright/kingdom-access-idle-390x844.png`다. 실제 버튼 목록은 장비 콘솔·모험 기록·전직·원정 임무·휴식·이동·임무·상점·제작이며 탐험은 없다. 모험 기록을 직접 열고 닫은 후에도 input 수0, 탐험 버튼0이었다.

`TerminalView.tsx`는 command 입력창을 렌더하지 않고 전투 중1/2/3과 quick-slot Q/W/E만 처리한다. 따라서 parser에 explore case가 남아 있다는 사실은 모바일 플레이어 경로 증거가 아니다. 현재 확인된 Important는 **catalog reachability가 승인된 일반 몬스터5종에 대해 실제 모바일 조우 시작 경로가 없다**는 점이다. 전직되지 않은 Lv58 fixture는 성장 타당성 증거가 아니지만, safe action 분기는 직업과 무관하게 탐험을 제외한다. 다른 직업에서 별도 경로가 존재한다는 근거는 찾지 못했다.

직접 actions.explore/QA sendCommand를 실행해서 이 결함을 PASS 처리하지 않았다. 기존 safe→원정 경계, 귀환 집계와 안전 지역 의미를 보존하는 최소 설계가 필요하다. 안전 지역을 dungeon으로 변경하거나 임의의 옆 지역에5종을 섞는 수정은 아직 하지 않았다. Full gate 입력은 유지했고, 소유한 QA browser/server는 닫았다. 이 결과는 아래 초기 미확정 상태를 대체한다.

## 확인된 범위

Production MAPS를 tsx로 읽어 황금 왕국 수호자·탐욕의 상인·용병 전사·왕국 기사·사기꾼 마법사의 일반 조우 목록을 조사했다. 다섯 이름 모두 `황금 왕국` 한 곳에만 등록되어 있고 해당 map type은 `safe`다. `contentReachability.ts`의 mapMonsterRoutes는 safe 여부와 관계없이 등록을 경로로 세므로 현재 content verifier PASS만으로 이들의 모바일 접근성을 증명할 수 없다.

`ControlPanel.tsx`는 safe 지역에서 일반 coreButtons 대신 town quick/facility actions를 표시한다. `townActionPresentation.ts`의 quick keys는 맥락 행동 하나와 move이며, facility keys는 rest/quests/market/class/craft다. `adventureGuide.ts`도 safe 지역의 기본 행동으로 이동·게시판·정비를 안내한다. 따라서 일반 탐험 버튼 경로가 확인되지 않았다.

반면 `commandParser.ts`는 explore/look/탐색을 actions.explore로 전달하며, `exploreActions.ts`는 START_LOCATION만 명시적으로 탐험에서 제외한다. 따라서 이들을 무조건 도달 불가능하다고 단정하면 안 된다. Command surface의 실제 접근성과 safe-region 탐험 결과를 직접 검증해야 한다. v18 강제 combat fixture는 이미지 렌더링만 증명하며 이 질문의 답이 아니다.

## 다음 검증

1. 격리된 Lv58+ fixture로 실제 황금 왕국 idle 모바일 화면을 열어 사용자가 도달할 수 있는 행동을 확인한다.
2. command surface가 실제 UI로 열리는지 확인하고 production explore 경로로 전투가 가능한지 검사한다. fixture 자체로 적을 주입한 결과와 구분한다.
3. 발견성이 부족하거나 경로가 없는 것으로 확인되면 별도 TDD slice로 설계한다. 안전 지역을 임의로 dungeon으로 바꾸거나 전투 확률·보상을 바꾸지 않는다.
4. content verifier의 catalog registration과 actionable encounter route 증거를 구분한다. 현재 통과 결과를 전체254종 실제 조우 완료로 확대하지 않는다.

이 감사에서 gameplay code, map data, save, runtime assets, evidence baseline은 변경하지 않았다. v18 full25564가 진행 중이므로 해당 입력을 유지한다.
