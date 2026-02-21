import { DB } from '../data/db';

/**
 * getAvailableCommands — 현재 상황에서 사용 가능한 커맨드 목록
 * Fast-refresh 경고 방지를 위해 별도 파일로 분리
 */
export const getAvailableCommands = (gameState, player) => {
    const isSafe = DB.MAPS[player.loc]?.type === 'safe';

    const base = [
        { cmd: 'help', desc: '커맨드 목록' },
        { cmd: 'status', desc: '캐릭터 상태' },
        { cmd: 'inventory', desc: '인벤토리' },
        { cmd: 'quest', desc: '퀘스트 목록' },
        { cmd: 'map', desc: '현재 위치/출구' },
    ];

    if (gameState === 'idle') {
        base.push({ cmd: 'explore', desc: '주변 탐색' });
        base.push({ cmd: 'move', desc: '이동 (move <지역명>)' });
        if (isSafe) {
            base.push({ cmd: 'rest', desc: '휴식 (100G)' });
            base.push({ cmd: 'shop', desc: '상점 열기' });
        }
    }

    if (gameState === 'combat') {
        base.push(
            { cmd: 'attack', desc: '공격 (a)' },
            { cmd: 'skill', desc: '스킬 사용 (s)' },
            { cmd: 'nextskill', desc: '스킬 전환 (sn)' },
            { cmd: 'escape', desc: '도주 (r)' }
        );
    }

    if (gameState === 'event') {
        base.push(
            { cmd: '1', desc: '이벤트 선택지 1' },
            { cmd: '2', desc: '이벤트 선택지 2' },
            { cmd: '3', desc: '이벤트 선택지 3' }
        );
    }

    const exits = DB.MAPS[player.loc]?.exits || [];
    exits.forEach(exitName => {
        base.push({ cmd: exitName, desc: `→ ${exitName}으로 이동` });
    });

    return base;
};
