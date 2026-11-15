import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { buildFieldMimic } from '../../systems/fieldChest';
import { getEnemyThreat } from '../../utils/enemyThreat';
import { applyBattleStartRelics } from './exploreFlow';
import type { FieldDirection } from '../../types/fieldMap';
import type { Player } from '../../types';
import type { GameActionDeps } from '../actionDeps';

interface FieldActionLinks {
    explore: () => unknown;
    move: (loc: string) => unknown;
}

/**
 * 2026-11 지역 지도 걷기(설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md). 걸음 · 상자 · 클리어 · 자동 탐험 횟수는 리듀서
 * (`reducers/handlers/fieldHandlers.ts`)가 소유하고, 여기서는 처리할 일(`fieldMap.pending`)을 기존 액션으로 넘긴다 —
 * 조우는 `explore()` 그대로(조우 n번 = 탐험 n번), 출구는 `move()`, 미믹은 다른 전투와 같은 시작 파이프다.
 */
export const createFieldActions = (deps: GameActionDeps, links: FieldActionLinks) => {
    const { player, gameState, dispatch, addLog, getFullStats } = deps;
    const rng = typeof deps.rng === 'function' ? deps.rng : Math.random;

    const startFieldMimic = (chestId: number) => {
        const field = player.fieldMap;
        const mapData = player.loc ? DB.MAPS[player.loc] : null;
        if (!field || !mapData || !player.loc) return;
        const mimic = buildFieldMimic(player, mapData, { loc: player.loc, seed: field.seed, chestId });
        if (!mimic) return;
        const fullStats = getFullStats();
        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: Player) => applyBattleStartRelics(p, p.relics || [], fullStats, { addLog, rng }),
        });
        dispatch({ type: AT.SET_ENEMY, payload: mimic });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
        addLog('combat', MSG.ENEMY_APPEAR(mimic.name || ''));
        // 정예와 같은 위협 줄(Wave 111) — 행동 권고는 붙이지 않는다(Wave 88).
        const threat = getEnemyThreat(player, mimic);
        addLog('warning', MSG.ELITE_THREAT(threat.hit, threat.maxHp, threat.pct, threat.hits));
    };

    return {
        /** 지도 지역에 있는데 지도가 없으면(이전 세이브 · 새 여정의 시작) 지도를 만든다. */
        fieldEnter: () => dispatch({ type: AT.FIELD_ENTER }),
        fieldStep: (direction: FieldDirection, auto = false) => dispatch({
            type: AT.FIELD_STEP,
            payload: { direction, auto, now: Date.now() },
        }),
        fieldStartAuto: () => dispatch({ type: AT.FIELD_AUTO_START, payload: { now: Date.now() } }),
        /** 남은 처리할 일 하나를 넘긴다 — 대기 상태 · 지금 지역의 지도일 때만. 지운 뒤 넘기므로 두 번 처리되지 않는다. */
        processFieldPending: async () => {
            const field = player.fieldMap;
            const pending = field?.pending;
            if (!pending || !field || field.loc !== player.loc || gameState !== GS.IDLE) return;
            dispatch({ type: AT.FIELD_CLEAR_PENDING, payload: { kind: pending.kind } });
            switch (pending.kind) {
                case 'encounter':
                    await links.explore();
                    return;
                case 'exit':
                    links.move(pending.to);
                    return;
                case 'mimic':
                    startFieldMimic(pending.chestId);
                    return;
                default:
                    return;
            }
        },
    };
};
