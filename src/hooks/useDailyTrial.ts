import { useCallback, useEffect, useMemo, useRef, type Dispatch } from 'react';

import { BALANCE } from '../data/constants';
import { clearDailyTrialSave, loadDailyTrialSave, saveDailyTrial } from '../platform/dailyTrialStorage';
import { AT, type GameAction } from '../reducers/actionTypes';
import { buildDailyTrialSave, type DailyTrialSave } from '../reducers/dailyTrial';
import type { GameState } from '../reducers/gameReducer';
import { getProtocolDayKey } from '../utils/protocolCycle';

export interface DailyTrialControls {
    /** 시작(오늘의 멈춘 판이 있으면 그 판을 잇는다) */
    begin: () => void;
    /** 포기 — 결과 화면으로 간다 */
    abandon: () => void;
    /** 결과 화면 뒤 본편으로 */
    end: () => void;
    /** 오늘의 날짜 키 */
    dayKey: () => string;
    /** 오늘의 멈춘 판 */
    peek: () => DailyTrialSave | null;
}

/**
 * 오늘의 시련의 입출력 — 시련 칸 자동 저장과 시작 · 포기 · 끝. 상태 전이는 리듀서(`reducers/dailyTrial.ts`)가 소유한다.
 * 시작 직전에 본편을 한 번 저장한다(디바운스 중이던 저장이 시련 동안 미뤄지지 않게). 그 뒤로 시련이 끝날 때까지 본편 칸은 쓰지 않는다.
 */
export const useDailyTrial = (
    state: GameState,
    dispatch: Dispatch<GameAction>,
    flushMainSave: () => Promise<unknown>,
): { controls: DailyTrialControls; flushTrialSave: () => void } => {
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const flushTrialSave = useCallback(() => {
        const save = buildDailyTrialSave(stateRef.current);
        if (save) saveDailyTrial(save);
    }, []);

    const { dailyTrial, player, gameState, enemy, currentEvent, quickSlots, pendingRelics } = state;
    const wasActiveRef = useRef(false);
    useEffect(() => {
        if (!dailyTrial) {
            // 부트 때(한 번도 걷지 않음)는 칸을 그대로 둔다 — 끝난 판만 지운다.
            if (wasActiveRef.current) clearDailyTrialSave();
            wasActiveRef.current = false;
            return undefined;
        }
        wasActiveRef.current = true;
        if (dailyTrial.result) {
            flushTrialSave();
            return undefined;
        }
        const timer = setTimeout(flushTrialSave, BALANCE.DEBOUNCE_SAVE_MS);
        return () => clearTimeout(timer);
    }, [dailyTrial, player, gameState, enemy, currentEvent, quickSlots, pendingRelics, flushTrialSave]);

    const controls = useMemo<DailyTrialControls>(() => {
        const dayKey = () => getProtocolDayKey(new Date());
        return {
            begin: () => {
                void flushMainSave();
                const now = Date.now();
                dispatch({ type: AT.BEGIN_DAILY_TRIAL, payload: { now, saved: loadDailyTrialSave(getProtocolDayKey(new Date(now))) } });
            },
            abandon: () => dispatch({ type: AT.ABANDON_DAILY_TRIAL }),
            end: () => dispatch({ type: AT.END_DAILY_TRIAL, payload: { now: Date.now() } }),
            dayKey,
            peek: () => loadDailyTrialSave(dayKey()),
        };
    }, [dispatch, flushMainSave]);

    return { controls, flushTrialSave };
};
