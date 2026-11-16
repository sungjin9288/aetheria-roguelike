import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { GS } from '../reducers/gameStates';
import { getFieldDoor } from '../systems/fieldDoor';
import { getFieldMapLayout, isFieldMapRegion, planFieldAutoStep } from '../systems/fieldMapWalk';
import { getAutoExploreStep, type AutoExploreState } from '../utils/autoExplore';
import {
    getFieldAutoAvailability, getFieldAutoStopText, getFieldWalkStopText, isFieldAutoWalkUnlocked, planPlayerFieldAutoWalk,
    type FieldAutoAvailability,
} from '../utils/fieldAuto';
import type { FieldDirection, FieldMapLayout, FieldMapState } from '../types/fieldMap';
import type { AddLog } from './actionDeps';

/**
 * 지역 지도 걷기의 화면 쪽 배선(설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §1 · §7 · §8). 걷기 · 상자 · 클리어는 리듀서가 소유하고
 * 이 훅은 (1) 지도 지역에 지도가 없으면 만들고 (2) 리듀서가 남긴 처리할 일(조우 · 출구 · 미믹)을 기존 액션으로 넘기며
 * (3) 자동 탐험 · 자동 걷기 걸음을 박자마다 부른다. 켜짐은 화면 상태다(세이브 봉투 밖 — 리로드하면 멈춰 있다, 이어 가기는 횟수를 쓰지 않는다).
 * 오버월드 3단계: 자동 걷기(하루 횟수 없음 · 첫 전직 뒤)는 같은 박자 고리를 쓰되 걸음은 `planPlayerFieldAutoWalk`(상자를 열지
 * 않고 그 옆에서 멈춘다), 조우는 연속 탐험(H1) 판정 그대로다. 보스 문 칸을 지도 화면이 그리도록 넘긴다.
 */

type AutoMode = 'run' | 'walk';

export interface FieldMapActions {
    fieldEnter: () => unknown;
    fieldStep: (direction: FieldDirection, auto?: boolean) => unknown;
    fieldStartAuto: () => unknown;
    processFieldPending: () => unknown;
    combat: (kind: string) => unknown;
    clearPostCombat?: () => void;
}

export interface UseFieldMapInput {
    state: AutoExploreState;
    actions: FieldMapActions;
    addLog?: AddLog;
    /** 판단을 기다리는 화면이 덮고 있다 — 자동 탐험이 멈추고 처리할 일을 미룬다. */
    blocked: boolean;
    /** 처치 박자 — 끝날 때까지 다음 걸음을 미룬다. */
    paused: boolean;
    timeScale: number;
}

export interface FieldMapControl {
    /** 지금 지역이 지도 지역이고 그 지도가 있다 */
    active: boolean;
    field: FieldMapState | null;
    layout: FieldMapLayout | null;
    /** 지금 손으로 걸을 수 있다(대기 상태 · 처리할 일 없음 · 자동 탐험 꺼짐) */
    canWalk: boolean;
    walk: (direction: FieldDirection) => void;
    auto: FieldAutoAvailability & { running: boolean; canStart: boolean };
    startAuto: () => void;
    stopAuto: () => void;
    /** 지금 보이는 보스 문의 칸 — 닫혀 있으면 null */
    door: number | null;
    /** 자동 걷기(오버월드 3단계) — 첫 전직 뒤 · 하루 횟수 없음 */
    autoWalk: { unlocked: boolean; running: boolean; canStart: boolean };
    startAutoWalk: () => void;
    stopAutoWalk: () => void;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

const KEY_DIRECTIONS: Record<string, FieldDirection> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

export function useFieldMap({ state, actions, addLog, blocked, paused, timeScale }: UseFieldMapInput): FieldMapControl {
    const { gameState, player, postCombatResult, pendingRelics, currentEvent } = state;
    const loc = player?.loc || '';
    const mapData = loc ? DB.MAPS[loc] : null;
    const inRegion = isFieldMapRegion(loc, mapData);
    const field = inRegion && player?.fieldMap?.loc === loc ? player.fieldMap : null;
    const layout = useMemo(
        () => (field && mapData ? getFieldMapLayout(field, mapData) : null),
        [field, mapData],
    );

    const stateRef = useRef(state);
    const actionsRef = useRef(actions);
    useEffect(() => {
        stateRef.current = state;
        actionsRef.current = actions;
    });

    // (1) 지도 지역인데 지도가 없다(이전 세이브 · 새 여정의 시작 지역) — 대기 상태에서 만든다.
    useEffect(() => {
        if (inRegion && !field && gameState === GS.IDLE) actionsRef.current.fieldEnter();
    }, [inRegion, field, gameState]);

    // (2) 처리할 일 — 같은 일을 두 번 넘기지 않게 지도 순번 · 위치 · 종류로 표시한다(StrictMode의 두 번째 이펙트).
    const pending = field?.pending ?? null;
    const pendingKey = pending && field ? `${field.seq}:${field.pos}:${pending.kind}` : null;
    const handledRef = useRef<string | null>(null);
    useEffect(() => {
        if (!pendingKey || blocked || paused || gameState !== GS.IDLE) return;
        if (handledRef.current === pendingKey) return;
        handledRef.current = pendingKey;
        void actionsRef.current.processFieldPending();
    }, [pendingKey, blocked, paused, gameState]);
    useEffect(() => {
        if (!pendingKey) handledRef.current = null;
    }, [pendingKey]);

    // (3) 자동 탐험 · 자동 걷기 — 지역을 떠나거나 지도가 바뀌면(사망 · 새 지도) 켜짐이 풀린다. 자동 탐험은 그 지도의 `autoRun`과
    // 함께일 때만, 자동 걷기는 켠 지도(순번)에서만 켜져 있다.
    const [mode, setMode] = useState<AutoMode | null>(null);
    const [walkSeq, setWalkSeq] = useState<number | null>(null);
    const running = mode === 'run' && inRegion && Boolean(field?.autoRun);
    const walking = mode === 'walk' && inRegion && Boolean(field) && field?.seq === walkSeq;
    const looping = running || walking;
    // 자동 걷기가 한 번 멈춘 상자 — 다시 켜면 그 상자 옆에서는 멈추지 않는다(지도 순번마다 새로 시작).
    const acknowledgedRef = useRef<{ seq: number; chests: number[] }>({ seq: -1, chests: [] });
    const [tick, setTick] = useState(0);
    const busyRef = useRef(false);
    const halt = useCallback((text: string | null) => {
        setMode(null);
        if (text) addLog?.('system', text);
    }, [addLog]);
    const stopText = useCallback((reason: Parameters<typeof getFieldAutoStopText>[0]) => (
        mode === 'walk' ? getFieldWalkStopText(reason, stateRef.current.player) : getFieldAutoStopText(reason, stateRef.current.player)
    ), [mode]);

    useEffect(() => {
        if (!looping || paused || busyRef.current) return undefined;
        const walkMode = mode === 'walk';
        const timer = window.setTimeout(() => {
            if (blocked) {
                halt(stopText('mode'));
                return;
            }
            const latest = stateRef.current;
            const step = getAutoExploreStep(latest, { requireJob: walkMode });
            if (step.kind === 'stop') {
                halt(stopText(step.reason));
                return;
            }
            busyRef.current = true;
            const run = async () => {
                try {
                    if (step.kind === 'explore') {
                        if (latest.postCombatResult) {
                            actionsRef.current.clearPostCombat?.();
                            return;
                        }
                        const current = latest.player?.fieldMap;
                        const currentMap = latest.player?.loc ? DB.MAPS[latest.player.loc] : null;
                        if (!latest.player || !current || !currentMap || current.loc !== latest.player.loc) {
                            halt(stopText('mode'));
                            return;
                        }
                        if (current.pending) return; // 처리할 일 이펙트가 넘긴다
                        const currentLayout = getFieldMapLayout(current, currentMap);
                        if (walkMode) {
                            if (acknowledgedRef.current.seq !== current.seq) acknowledgedRef.current = { seq: current.seq, chests: [] };
                            const plan = planPlayerFieldAutoWalk(latest.player, current, currentLayout, acknowledgedRef.current.chests);
                            if (plan.kind === 'stop') {
                                if (plan.chestId !== undefined) {
                                    acknowledgedRef.current = { seq: current.seq, chests: [...acknowledgedRef.current.chests, plan.chestId] };
                                }
                                halt(getFieldWalkStopText(plan.reason, latest.player));
                                return;
                            }
                            actionsRef.current.fieldStep(plan.direction, false);
                            return;
                        }
                        const door = getFieldDoor(latest.player, current.loc, currentMap, currentLayout);
                        const direction = planFieldAutoStep(current, currentLayout, door);
                        if (!direction) {
                            halt(MSG.FIELD_AUTO_DONE);
                            return;
                        }
                        actionsRef.current.fieldStep(direction, true);
                    } else {
                        actionsRef.current.combat(step.kind);
                    }
                } catch {
                    halt(stopText('mode'));
                } finally {
                    busyRef.current = false;
                    setTick((value) => value + 1);
                }
            };
            void run();
        }, blocked ? 0 : (walkMode ? BALANCE.FIELD_AUTO_WALK_STEP_MS : BALANCE.FIELD_AUTO_STEP_MS) * timeScale);
        return () => window.clearTimeout(timer);
    }, [looping, mode, paused, blocked, tick, timeScale, halt, stopText, gameState, player, state.enemy, postCombatResult, pendingRelics, currentEvent, state.isAiThinking]);

    useEffect(() => {
        if (!looping || typeof document === 'undefined') return undefined;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') halt(stopText('hidden'));
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [looping, halt, stopText]);

    const idle = gameState === GS.IDLE && !postCombatResult && !pendingRelics && !currentEvent;
    const canWalk = Boolean(field && layout && idle && !pending && !looping && !blocked);
    const walk = useCallback((direction: FieldDirection) => {
        actionsRef.current.fieldStep(direction, false);
    }, []);

    // 방향 키 — 입력 칸에 글을 쓰는 동안은 받지 않는다.
    useEffect(() => {
        if (!canWalk || typeof window === 'undefined') return undefined;
        const onKey = (event: KeyboardEvent) => {
            const direction = KEY_DIRECTIONS[event.key];
            if (!direction || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
            event.preventDefault();
            walk(direction);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [canWalk, walk]);

    // 하루 횟수의 날짜 — 렌더에서 시계를 읽지 않고 1분마다 다시 읽는다.
    const [clock, setClock] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);
    const availability = getFieldAutoAvailability(player || {}, loc, field, layout, clock);
    const canStart = Boolean(field && layout && idle && !pending && !looping && !blocked && availability.lock === null);
    const startAuto = useCallback(() => {
        const latestPlayer = stateRef.current.player;
        const current = latestPlayer?.fieldMap;
        const currentMap = latestPlayer?.loc ? DB.MAPS[latestPlayer.loc] : null;
        if (!latestPlayer || !current || !currentMap) return;
        const now = getFieldAutoAvailability(
            latestPlayer, latestPlayer.loc || '', current, getFieldMapLayout(current, currentMap), Date.now(),
        );
        if (now.lock) return;
        if (now.resumable) {
            addLog?.('system', MSG.FIELD_AUTO_RESUMED);
        } else {
            actionsRef.current.fieldStartAuto();
        }
        setMode('run');
    }, [addLog]);
    const stopAuto = useCallback(() => {
        if (running) halt(getFieldAutoStopText('manual', stateRef.current.player));
    }, [running, halt]);

    const walkUnlocked = isFieldAutoWalkUnlocked(player);
    const canStartWalk = Boolean(field && layout && idle && !pending && !looping && !blocked && walkUnlocked);
    const startAutoWalk = useCallback(() => {
        const latestPlayer = stateRef.current.player;
        const current = latestPlayer?.fieldMap;
        if (!latestPlayer || !current || current.loc !== latestPlayer.loc || !isFieldAutoWalkUnlocked(latestPlayer)) return;
        setWalkSeq(current.seq);
        setMode('walk');
    }, []);
    const stopAutoWalk = useCallback(() => {
        if (walking) halt(getFieldWalkStopText('manual', stateRef.current.player));
    }, [walking, halt]);
    const door = getFieldDoor(player, loc, mapData, layout);

    return {
        active: Boolean(field && layout),
        field,
        layout,
        canWalk,
        walk,
        auto: { ...availability, running, canStart },
        startAuto,
        stopAuto,
        door,
        autoWalk: { unlocked: walkUnlocked, running: walking, canStart: canStartWalk },
        startAutoWalk,
        stopAutoWalk,
    };
}
