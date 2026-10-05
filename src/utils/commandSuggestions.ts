import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getRestCost } from './expeditionReturnFlow';
import { isBlindMap } from './challengeRules';
import { GS } from '../reducers/gameStates';
import type { GameMode } from '../reducers/gameStates';
import type { Player } from '../types/index.js';

/**
 * getAvailableCommands — 현재 상황에서 사용 가능한 커맨드 목록
 * Fast-refresh 경고 방지를 위해 별도 파일로 분리
 */
export const getAvailableCommands = (gameState: GameMode, player: Player | null | undefined) => {
    const isSafe = DB.MAPS[player?.loc as string]?.type === 'safe';

    const base = [
        { cmd: 'help', desc: '커맨드 목록' },
        { cmd: 'status', desc: '캐릭터 상태' },
        { cmd: 'inventory', desc: '인벤토리' },
        { cmd: 'quest', desc: '퀘스트 목록' },
        { cmd: 'map', desc: '현재 위치/출구' },
    ];

    if (gameState === GS.IDLE) {
        base.push({ cmd: 'explore', desc: '주변 탐색' });
        base.push({ cmd: 'move', desc: '이동 (move <지역명>)' });
        if (isSafe && player) {
            // Wave 61 (원장 §61.3): 실제 휴식이 받는 비용(레벨 · 거울 반영)을 그린다 — 고정 "100G"였다.
            base.push({ cmd: 'rest', desc: MSG.CMD_SUGGEST_REST(getRestCost(player)) });
            base.push({ cmd: 'shop', desc: '상점 열기' });
        }
    }

    if (gameState === GS.COMBAT) {
        base.push(
            { cmd: 'attack', desc: '공격 (a)' },
            { cmd: 'skill', desc: '스킬 사용 (s)' },
            { cmd: 'nextskill', desc: '스킬 전환 (sn)' },
            { cmd: 'escape', desc: '도주 (r)' }
        );
    }

    if (gameState === GS.EVENT) {
        base.push(
            { cmd: '1', desc: '이벤트 선택지 1' },
            { cmd: '2', desc: '이벤트 선택지 2' },
            { cmd: '3', desc: '이벤트 선택지 3' }
        );
    }

    // 2026-10 Wave 62 (원장 §61.2 A10): 길 잃은 여행이면 출구 이름(지도 정보)을 자동완성에 띄우지 않는다.
    const exits = isBlindMap(player) ? [] : (DB.MAPS[player?.loc as string]?.exits || []);
    exits.forEach((exitName) => {
        base.push({ cmd: exitName, desc: `→ ${exitName}으로 이동` });
    });

    return base;
};
