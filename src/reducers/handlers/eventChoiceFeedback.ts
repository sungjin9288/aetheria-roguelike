import { BALANCE } from '../../data/constants';
import type { GameState } from '../gameReducer';

/**
 * 이벤트가 열린 채 남는 선택 거부를 플레이어에게 보이게 한다 (2026-09 Wave 27 N1).
 *
 * 이벤트 화면(GS.EVENT)은 FOCUS_PANEL_STATES라 TerminalView가 마운트되지 않는다 — 오류 로그만
 * 남기는 거부는 그 순간 어디에도 그려지지 않아 "눌렀는데 아무 일도 없다"였다. 그래서 같은
 * 문장을 두 곳에 싣는다:
 *  - `currentEvent.choiceFeedback` — `getEventChoicePreview`가 누른 선택지의 미리보기 줄로 그린다.
 *  - 오류 로그 — 이벤트를 떠난 뒤 기록으로 남는다.
 *
 * 판정은 호출한 핸들러가 소유한다(이 함수는 문장을 싣기만 한다). 같은 거부가 이미 실려 있으면
 * 동일 참조를 돌려준다 — 연타는 멱등이다.
 */
export interface EventChoiceRejection {
    logId: string;
    choiceIndex: number;
    text: string;
}

export const rejectEventChoice = (state: GameState, rejection: EventChoiceRejection): GameState => {
    const event = state.currentEvent;
    if (!event) return state;
    const { logId, choiceIndex, text } = rejection;
    const logged = state.logs.some((log) => log?.id === logId);
    const shown = event.choiceFeedback?.choiceIndex === choiceIndex && event.choiceFeedback.text === text;
    if (logged && shown) return state;
    return {
        ...state,
        currentEvent: shown ? event : { ...event, choiceFeedback: { choiceIndex, text } },
        logs: logged
            ? state.logs
            : [...state.logs, { id: logId, type: 'error', text }].slice(-BALANCE.LOG_MAX_SIZE),
    };
};
