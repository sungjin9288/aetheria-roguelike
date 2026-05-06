import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { makeItem } from '../../utils/gameUtils';
import { RELICS, pickWeightedRelics } from '../../data/relics';

/**
 * 마왕 처치 후처리: 파편 드랍 / 진 보스 진입 / 일반 환생
 * @returns {boolean} true이면 호출자가 즉시 return해야 함
 */
export const handleDemonKingSlain = (updatedPlayer: any, dispatch: any, addLog: any) => {
    const prestigeRank = updatedPlayer.meta?.prestigeRank || 0;
    const shardCount = (updatedPlayer.inv || []).filter((i: any) => i?.name === '원시의 파편').length;

    // cycle 137: PRIMAL_SHARD_DROP_CHANCE는 BALANCE 객체에 있는데 기존엔 CONSTANTS의
    // 동일명 키(undefined)를 참조해 Math.random() < undefined가 항상 false였음
    // → 진엔딩 unlock 경로의 shard가 절대 드랍 안 되던 잠복 버그 수정.
    // 또한 hardcoded 3 → BALANCE.PRIMAL_SHARD_REQUIRED로 교체 (DRY).
    const SHARD_REQ = BALANCE.PRIMAL_SHARD_REQUIRED || 3;
    if (prestigeRank >= 1 && shardCount < SHARD_REQ && Math.random() < BALANCE.PRIMAL_SHARD_DROP_CHANCE) {
        const shardItem = makeItem({ name: '원시의 파편', type: 'key', price: 0, tier: 5, desc: '원시의 신의 기억이 담긴 파편.' });
        dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, inv: [...(p.inv || []), shardItem] }) });
        addLog('event', MSG.PRIMAL_SHARD_DROP(shardCount + 1));
    }

    const currentShardCount = (updatedPlayer.inv || []).filter((i: any) => i?.name === '원시의 파편').length;
    if (prestigeRank >= 3 && currentShardCount >= SHARD_REQ) {
        addLog('critical', MSG.TRUE_BOSS_UNLOCK);
        let removed = 0;
        const newInv = (updatedPlayer.inv || []).filter((i: any) => {
            if (i?.name === '원시의 파편' && removed < 3) { removed++; return false; }
            return true;
        });
        const trueBossData = DB.MONSTERS?.['원시의 신'];
        if (trueBossData) {
            const trueBoss: Record<string, any> = {
                name: '원시의 신', baseName: '원시의 신',
                hp: Math.floor(8000 * (trueBossData.hpMult || 2.2)),
                maxHp: Math.floor(8000 * (trueBossData.hpMult || 2.2)),
                atk: Math.floor(280 * (trueBossData.atkMult || 1.8)),
                def: 120, level: 70, isBoss: true,
                weakness: '빛', resistance: '어둠',
                expMult: trueBossData.expMult || 5.0,
                goldMult: trueBossData.goldMult || 5.0,
                dropMod: trueBossData.dropMod || 5.0,
                phase2: trueBossData.phase2, phase3: trueBossData.phase3,
                exp: 5000, gold: 9999,
                pattern: { guardChance: 0.05, heavyChance: 0.4 },
            };
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, inv: newInv }) });
            dispatch({ type: AT.SET_ENEMY, payload: trueBoss });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
            addLog('critical', MSG.TRUE_BOSS_APPEAR);
        }
        return true;
    }

    if (prestigeRank >= 1 && shardCount < SHARD_REQ) {
        addLog('info', MSG.PRIMAL_SHARD_HINT(Math.min(shardCount + 1, SHARD_REQ)));
    }
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.ASCENSION });
    addLog('system', MSG.DEMON_KING_SLAIN_ASCEND);
    return true;
};

/**
 * 무한 심연 층 진행. 현재 위치가 심연 맵이 아니면 player를 그대로 반환.
 * @returns {object} 업데이트된 player
 */
export const applyAbyssFloorAdvance = (p: any, dispatch: any, addLog: any) => {
    if (p.loc !== CONSTANTS.ABYSS_MAP_NAME) return p;
    const newDepth = (p.stats?.abyssFloor || 1) + 1;
    const prevRecord = p.stats?.abyssRecord || 0;
    const newRecord = Math.max(prevRecord, newDepth);
    let updated = {
        ...p,
        stats: { ...(p.stats || {}), abyssFloor: newDepth, abyssRecord: newRecord },
    };
    if (newDepth > prevRecord) {
        addLog('system', MSG.ABYSS_RECORD(newDepth));
    }
    addLog('system', MSG.ABYSS_DESCEND(newDepth));
    const milestone = BALANCE.ABYSS_MILESTONE_REWARDS[newDepth];
    if (milestone) {
        addLog('event', MSG.ABYSS_MILESTONE(newDepth));
        if (milestone.type === 'relic_choice') {
            const available = RELICS.filter((r: any) => !(updated.relics || []).some((pr: any) => pr.id === r.id));
            if (available.length > 0) dispatch({ type: AT.SET_PENDING_RELICS, payload: pickWeightedRelics(available, 3) });
        } else if (milestone.type === 'legendary_item') {
            // cycle 179: DB.ITEMS는 object — `.flat()` 호출은 TypeError. abyss 50/100/300층
            //   milestone 처리 중 예외 발생해 abyss 진행 끊기던 잠복 회귀 fix.
            const allItems: any[] = (Object.values(DB.ITEMS) as any[]).flat().filter((i: any) => i && typeof i === 'object');
            const legendaryPool = allItems.filter((i: any) => i.tier === 5);
            if (legendaryPool.length > 0) {
                const item = makeItem(legendaryPool[Math.floor(Math.random() * legendaryPool.length)] as any);
                updated = { ...updated, inv: [...(updated.inv || []), item] };
                addLog('success', MSG.ABYSS_LEGENDARY_ITEM(item.name));
            }
        }
        // cycle 194: 'prestige_points' 핸들러 제거 — player.prestigePoints가 spend/UI 미구현
        //   상태로 dead currency였음. constants.ts ABYSS_MILESTONE_REWARDS에서 75/200/500을
        //   relic_choice/legendary_item으로 교체해 visible 보상 보장.
    }
    return updated;
};
