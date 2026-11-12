import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import {
    canStartAutoExplore,
    getAutoExploreHpStopRatio,
    getAutoExploreStep,
    isAutoExploreUnlocked,
    type AutoExploreState,
    type AutoExploreStopReason,
} from '../utils/autoExplore';
import type { AddLog } from './actionDeps';

/**
 * 연속 탐험 토글(2026-11 H1, docs/EXECUTION_SKETCH_H1_2026-11.md §3.3) — 화면 상태다(세이브 봉투 밖, 리로드하면 꺼져 있다).
 *
 * 걸음마다 `BALANCE.AUTO_EXPLORE_STEP_MS`(전투 속도 ×2면 절반) 뒤 판정(`getAutoExploreStep`)을 다시 읽고, 수동 탭과 같은 액션을
 * 부른다 — 탐험은 결과 카드의 '계속 탐험'처럼 카드를 닫고 `actions.explore()`, 전투는 `actions.combat('attack')`. 게이트 · 전이는
 * 그 액션이 소유한다. 판단할 거리가 생기면 멈추고 이유 한 줄을 기록에 남긴다(행동을 권하지 않는다 — Wave 88).
 */

/** 훅이 부르는 액션 — 수동 탭과 같은 함수다. */
export interface AutoExploreActions {
    explore: () => unknown;
    combat: (kind: string) => unknown;
    clearPostCombat?: () => void;
}

export interface UseAutoExploreInput {
    state: AutoExploreState;
    actions: AutoExploreActions;
    addLog?: AddLog;
    /** 판단을 기다리는 화면이 덮고 있다(기록 · 거울 · 교환소 · 원정 정리 · 이야기 카드 · 장 선택) — 켜져 있으면 멈춘다. */
    blocked: boolean;
    /** 처치 박자(결과 카드를 띄우기 전 연출) — 끝날 때까지 다음 걸음을 미룬다. */
    paused: boolean;
    /** 전투 연출 시간 배율(`getCombatTimeScale`). */
    timeScale: number;
}

export interface AutoExploreControl {
    /** 첫 전직 뒤라 토글을 그릴 수 있다. */
    unlocked: boolean;
    /** 지금 켤 수 있다(첫 걸음이 탐험). */
    canStart: boolean;
    running: boolean;
    steps: number;
    start: () => void;
    stop: () => void;
}

export const getAutoExploreStopText = (reason: AutoExploreStopReason | 'manual' | 'hidden', state: Pick<AutoExploreState, 'player'>): string => (
    reason === 'hp_low'
        ? MSG.AUTO_EXPLORE_STOP_HP_LOW(Math.round(getAutoExploreHpStopRatio(state.player) * 100))
        : MSG.AUTO_EXPLORE_STOP[reason]
);

export function useAutoExplore({ state, actions, addLog, blocked, paused, timeScale }: UseAutoExploreInput): AutoExploreControl {
    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState(0);
    const [tick, setTick] = useState(0);
    const busyRef = useRef(false);
    const stateRef = useRef(state);
    const actionsRef = useRef(actions);
    useEffect(() => {
        stateRef.current = state;
        actionsRef.current = actions;
    });

    const halt = useCallback((text: string | null) => {
        setRunning(false);
        if (text) addLog?.('system', text);
    }, [addLog]);

    const { gameState, player, enemy, currentEvent, pendingRelics, postCombatResult, isAiThinking } = state;
    const step = useMemo(
        () => getAutoExploreStep({ gameState, player, enemy, currentEvent, pendingRelics, postCombatResult, isAiThinking }),
        [gameState, player, enemy, currentEvent, pendingRelics, postCombatResult, isAiThinking],
    );

    useEffect(() => {
        if (!running || paused || busyRef.current) return undefined;
        // 멈춤은 곧바로(0ms), 걸음은 박자 뒤에 — 둘 다 타이머 콜백에서 상태를 바꾼다.
        const stopping = blocked || step.kind === 'stop';
        const timer = window.setTimeout(() => {
            if (blocked) {
                halt(MSG.AUTO_EXPLORE_STOP.mode);
                return;
            }
            // 박자 사이에 상태가 바뀌었을 수 있다 — 최신 상태로 다시 판정한다.
            const latest = getAutoExploreStep(stateRef.current);
            if (latest.kind === 'stop') {
                halt(getAutoExploreStopText(latest.reason, stateRef.current));
                return;
            }
            if (latest.kind !== step.kind) {
                setTick((value) => value + 1);
                return;
            }
            busyRef.current = true;
            const run = async () => {
                try {
                    if (latest.kind === 'explore') {
                        if (stateRef.current.postCombatResult) actionsRef.current.clearPostCombat?.();
                        await actionsRef.current.explore();
                    } else {
                        actionsRef.current.combat('attack');
                    }
                    setSteps((value) => value + 1);
                } catch {
                    halt(MSG.AUTO_EXPLORE_STOP.mode);
                } finally {
                    busyRef.current = false;
                    setTick((value) => value + 1);
                }
            };
            void run();
        }, stopping ? 0 : BALANCE.AUTO_EXPLORE_STEP_MS * timeScale);
        return () => window.clearTimeout(timer);
    }, [running, paused, blocked, step, tick, timeScale, halt]);

    // 앱이 뒤로 가면 멈춘다 — 보지 않는 동안 진행하지 않는다.
    useEffect(() => {
        if (!running || typeof document === 'undefined') return undefined;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') halt(MSG.AUTO_EXPLORE_STOP.hidden);
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [running, halt]);

    const canStart = !running && !blocked && canStartAutoExplore(state);
    const start = useCallback(() => {
        if (!canStartAutoExplore(stateRef.current)) return;
        setSteps(0);
        setRunning(true);
    }, []);
    const stop = useCallback(() => {
        if (running) halt(MSG.AUTO_EXPLORE_STOP.manual);
    }, [running, halt]);

    return { unlocked: isAutoExploreUnlocked(player), canStart, running, steps, start, stop };
}
