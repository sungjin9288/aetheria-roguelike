/**
 * controlPanelConfig.js — ControlPanel 정적 설정 데이터
 * 버튼 종류 → 추천 키 매핑, 프레젠테이션 메타
 */

// cycle 392: open_shop 매핑 제거 — adventureGuide.getAdventureGuidance가
//   producer 0건이라 절대 lookup hit 안 됨. unreachable lookup entry
//   (cycle 359/361 unreachable lens 회귀).
export const ACTION_KIND_TO_BUTTON: Record<string, any> = {
    explore: 'explore',
    open_move: 'move',
    rest: 'rest',
    open_class: 'class',
    open_quest_board: 'quests',
    claim_quest: 'quests',
};

// cycle 302: ACTION_PRESENTATION 제거 — 정의되어 있지만 src/ 어디에서도 read 0건.
//   tag/tone/detail 메타정보가 dispatch 파이프 어디로도 흐르지 않던 dead config.
