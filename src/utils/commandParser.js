import { DB } from '../data/db';

export const parseCommand = (input, gameState, player, actions) => {
    if (!input || !input.trim()) return;

    const tokens = input.trim().replace(/^\//, '').split(' ');
    const command = tokens[0].toLowerCase();
    const args = tokens.slice(1).join(' ');

    // Helper for fuzzy matching
    const findItem = (name, list) => list.find(i => i.name === name || i.name.toLowerCase() === name.toLowerCase());

    switch (command) {
        // --- MOVEMENT ---
        case 'move':
        case 'go':
        case '이동':
        case '갈래':
            actions.move(args);
            return;

        // --- ACTIONS ---
        case 'explore':
        case 'look':
        case '탐험':
        case '조사':
            actions.explore();
            return;

        case 'rest':
        case 'sleep':
        case '휴식':
        case '잠보기':
            actions.rest();
            return;

        // --- COMBAT ---
        case 'attack':
        case 'hit':
        case '공격':
            actions.combat('attack');
            return;

        case 'skill':
        case 'use':
        case '스킬':
            actions.combat('skill');
            return;

        case 'run':
        case 'escape':
        case 'flee':
        case '도망':
            actions.combat('escape');
            return;

        // --- SHOP ---
        case 'buy':
        case '구매':
        case '사기':
            if (!args) return "무엇을 구매하시겠습니까? (예: 구매 포션)";
            // We need access to shopItems?? 
            // Shop items are usually in state.shopItems. 
            // We probably need to pass shopItems to the parser if we want to validate here, 
            // or we just assume the action handles it? 
            // The `actions.market` takes an ITEM object.
            // So we MUST find the item object. 
            // Limitation: We need the list of available shop items.
            // For now, let's return a message that CLI shop buying is tricky without the item list context passed in.
            // Or we modify the signature to accept `context` object.
            return "상점 이용은 아직 클릭을 권장합니다. (아이템 매칭 필요)";

        // --- INFO ---
        case 'status':
        case 'stat':
        case '상태':
        case '정보':
            return `[상태] Lv.${player.level} ${player.name} (${player.job}) / HP: ${player.hp}/${player.maxHp} / Gold: ${player.gold}G`;

        case 'help':
        case '도움말':
        case '?':
            return "명령어: 이동 [장소], 탐험, 공격, 도망, 휴식, 상태";

        default:
            // Implicit Move Check (e.g. typing "Northern Forest" directly)
            // But we need to be careful.
            return `알 수 없는 명령어입니다: ${command}`;
    }
};
