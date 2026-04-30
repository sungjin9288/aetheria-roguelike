/**
 * controlPanelConfig.js — ControlPanel 정적 설정 데이터
 * 버튼 종류 → 추천 키 매핑, 프레젠테이션 메타
 */

export const ACTION_KIND_TO_BUTTON = {
    explore: 'explore',
    open_move: 'move',
    rest: 'rest',
    open_class: 'class',
    open_quest_board: 'quests',
    open_shop: 'market',
    claim_quest: 'quests',
};

export const ACTION_PRESENTATION = {
    explore: { tag: 'Prime', tone: 'recommended', detail: '새 권역을 스캔하고 전투 또는 보상을 끌어옵니다.' },
    move: { tag: 'Route', tone: 'neutral', detail: '난이도와 보상을 보고 다음 구역으로 재배치합니다.' },
    rest: { tag: 'Recover', tone: 'upgrade', detail: '안전 지대에서 체력과 자원을 정리합니다.' },
    market: { tag: 'Broker', tone: 'upgrade', detail: '장비와 소모품을 정비하고 런 속도를 끌어올립니다.' },
    class: { tag: 'Class', tone: 'resonance', detail: '전직 가능 상태와 성장 분기를 점검합니다.' },
    quests: { tag: 'Mission', tone: 'neutral', detail: '의뢰 진행과 보상 타이밍을 빠르게 확인합니다.' },
    craft: { tag: 'Forge', tone: 'upgrade', detail: '재료를 변환해 장비 효율을 보강합니다.' },
    grave: { tag: 'Recovery', tone: 'warning', detail: '남겨둔 전리품을 회수해 손실을 줄입니다.' },
};
