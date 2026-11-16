import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { buildFieldMimic } from '../../systems/fieldChest';
import { isFieldDoorOpen } from '../../systems/fieldDoor';
import { isFieldMapRegion } from '../../systems/fieldMapWalk';
import { buildAreaBossChallengeCard } from '../../utils/bossChallengeCard';
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

    /**
     * 오버월드 3단계 보스 문 — 탐험의 카드와 같은 도전 카드를 연다(같은 카드 · 같은 전투, 물러나면 문 앞으로 돌아간다).
     * 문이 닫혔으면(게이지 · 격파 기록이 바뀐 뒤 다시 불러옴) 아무 일도 없다. 탐험이 아니라 탐험 수 · 게이지 · 위험은 그대로다.
     */
    const openFieldBossDoor = (): boolean => {
        const loc = player.loc;
        const mapData = loc ? DB.MAPS[loc] : null;
        if (gameState !== GS.IDLE || !loc || !mapData || !isFieldMapRegion(loc, mapData) || !isFieldDoorOpen(player, loc, mapData)) return false;
        const card = buildAreaBossChallengeCard(player, mapData, { door: true });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
        dispatch({ type: AT.SET_EVENT, payload: card });
        addLog('event', card.desc);
        return true;
    };

    return {
        /** 보스 문을 연다 — 걷기가 남긴 처리할 일과 자연 플레이 드라이버(걷지 않는 정책)가 부른다. */
        fieldOpenDoor: openFieldBossDoor,
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
                case 'door':
                    openFieldBossDoor();
                    return;
                default:
                    return;
            }
        },
    };
};
