import { DB } from '../data/db';

/**
 * Command Parser - CLI command handling
 * v3.6: Enhanced Korean command support
 */
export const parseCommand = (input, gameState, player, actions) => {
    if (!input || !input.trim()) return;

    const tokens = input.trim().replace(/^\//, '').split(' ');
    const command = tokens[0].toLowerCase();
    const args = tokens.slice(1).join(' ');

    // --- Movement shortcuts: Direct location names ---
    const locationMap = {
        '마을': '시작의 마을',
        '숲': '북부 숲',
        '북부숲': '북부 숲',
        '동굴': '버려진 동굴',
        '사막': '사막 오아시스',
        '요새': '북부 요새',
        'town': '시작의 마을',
        'forest': '북부 숲',
        'cave': '버려진 동굴',
        'desert': '사막 오아시스',
        'fortress': '북부 요새'
    };

    switch (command) {
        // --- MOVEMENT ---
        case 'move':
        case 'go':
        case '이동':
        case '갈래':
        case '가자':
            const dest = locationMap[args.toLowerCase()] || args;
            actions.move(dest);
            return;

        // --- ACTIONS ---
        case 'explore':
        case 'look':
        case '탐험':
        case '탐색':
        case '조사':
        case '보기':
            actions.explore();
            return;

        case 'rest':
        case 'sleep':
        case '휴식':
        case '쉬기':
        case '자기':
            actions.rest();
            return;

        // --- COMBAT ---
        case 'attack':
        case 'hit':
        case '공격':
        case '때리기':
        case 'a':
            actions.combat('attack');
            return;

        case 'skill':
        case 'use':
        case '스킬':
        case '기술':
        case 's':
            actions.combat('skill');
            return;

        case 'run':
        case 'escape':
        case 'flee':
        case '도망':
        case '도망가기':
        case '튀어':
        case 'r':
            actions.combat('escape');
            return;

        // --- SHOP ---
        case 'shop':
        case '상점':
        case '가게':
            if (DB.MAPS[player.loc]?.type === 'safe') {
                actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
                actions.setGameState('shop');
                return '상점에 입장했습니다.';
            }
            return '상점은 마을에서만 이용 가능합니다.';

        case 'buy':
        case '구매':
        case '사기':
            return "상점 이용은 클릭을 권장합니다. 또는 '상점' 명령어로 입장하세요.";

        // --- INFO ---
        case 'status':
        case 'stat':
        case '상태':
        case '정보':
        case 'i':
            return `[상태] Lv.${player.level} ${player.name} (${player.job}) | HP: ${player.hp}/${player.maxHp} | MP: ${player.mp}/${player.maxMp} | Gold: ${player.gold}G | 위치: ${player.loc}`;

        case 'inventory':
        case 'inv':
        case '인벤':
        case '가방':
            actions.setSideTab('inventory');
            return `[인벤토리] ${player.inv.length}개 아이템 소지 중`;

        case 'quest':
        case 'quests':
        case '퀘스트':
        case '의뢰':
            actions.setSideTab('quests');
            return `[퀘스트] ${player.quests.length}개 진행 중`;

        case 'equip':
        case '장비':
            actions.setSideTab('equip');
            return '장비 탭을 열었습니다.';

        case 'map':
        case '지도':
        case '맵':
            const mapData = DB.MAPS[player.loc];
            return `[현재 위치: ${player.loc}] 이동 가능: ${mapData.exits.join(', ')}`;

        case 'help':
        case '도움말':
        case '도움':
        case '?':
        case 'h':
            return `▶ 이동: 이동 [장소] (마을/숲/동굴)
▶ 행동: 탐색, 휴식, 상점
▶ 전투: 공격(a), 스킬(s), 도망(r)
▶ 정보: 상태(i), 인벤, 퀘스트, 지도`;

        default:
            // Try direct location match
            if (locationMap[command]) {
                actions.move(locationMap[command]);
                return;
            }
            // Check if it's a valid map location
            if (DB.MAPS[command]) {
                actions.move(command);
                return;
            }
            return `알 수 없는 명령어: ${command} ('도움말' 입력)`;
    }
};
