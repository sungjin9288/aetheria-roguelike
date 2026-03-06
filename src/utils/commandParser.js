import { DB } from '../data/db';

export const parseCommand = (input, gameState, player, actions) => {
  if (!input || !input.trim()) return;

  const tokens = input.trim().replace(/^\//, '').split(' ');
  const command = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1).join(' ');
  const readOnlyCommands = new Set(['help', 'h', '?', 'status', 'stat', '상태', 'i', 'inventory', 'inv', '인벤', 'quest', 'quests', '퀘스트', 'map', '지도']);
  const blockedStateMessages = {
    event: '이벤트 진행 중입니다. 1, 2, 3 중 하나를 선택하세요.',
    job_change: '전직 선택 중입니다. 화면에서 직업을 선택하거나 닫아 주세요.',
    quest_board: '퀘스트 보드가 열려 있습니다. 수락 또는 닫기를 먼저 완료하세요.',
    shop: '상점 이용 중입니다. 다른 행동은 상점을 닫은 뒤 진행하세요.',
    crafting: '제작 화면이 열려 있습니다. 제작을 완료하거나 닫아 주세요.',
    ascension: '환생 여부를 먼저 결정해야 합니다.',
    dead: '런이 종료되었습니다. 결과 화면에서 다시 시작하세요.',
  };

  const locationMap = {
    town: '시작의 마을',
    forest: '고요한 숲',
    cave: '어둠의 동굴',
    desert: '사막 오아시스',
    oasis: '사막 오아시스',
    fortress: '북부 요새',
    '버려진 동굴': '어둠의 동굴',
    '모래 오아시스': '사막 오아시스',
    마을: '시작의 마을',
    숲: '고요한 숲',
    동굴: '어둠의 동굴'
  };

  if (gameState === 'event' && (command === '1' || command === '2' || command === '3')) {
    actions.handleEventChoice(Number(command) - 1);
    return;
  }

  if (blockedStateMessages[gameState] && !readOnlyCommands.has(command)) {
    return blockedStateMessages[gameState];
  }

  switch (command) {
    case 'move':
    case 'go':
    case '이동':
    case '가':
      actions.move(locationMap[args.toLowerCase()] || args);
      return;

    case 'explore':
    case 'look':
    case '탐색':
      actions.explore();
      return;

    case 'rest':
    case 'sleep':
    case '휴식':
      actions.rest();
      return;

    case 'attack':
    case 'a':
    case '공격':
      actions.combat('attack');
      return;

    case 'skill':
    case 's':
    case '스킬':
      actions.combat('skill');
      return;

    case 'nextskill':
    case 'skillnext':
    case 'sn':
    case '스킬변경':
      actions.cycleSkill?.(1);
      return '스킬 슬롯을 전환했습니다.';

    case 'run':
    case 'escape':
    case 'r':
    case '도주':
      actions.combat('escape');
      return;

    case 'shop':
    case '상점':
      if (DB.MAPS[player.loc]?.type === 'safe') {
        actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
        actions.setGameState('shop');
        return '상점에 입장했습니다.';
      }
      return '상점은 안전 지역에서만 이용할 수 있습니다.';

    case 'status':
    case 'stat':
    case '상태':
    case 'i': {
      const stats = actions.getFullStats();
      return `[상태] Lv.${player.level} ${player.name} (${player.job}) | HP: ${player.hp}/${stats.maxHp} | MP: ${player.mp}/${player.maxMp} | Gold: ${player.gold}G | 위치: ${player.loc}`;
    }

    case 'inventory':
    case 'inv':
    case '인벤':
      actions.setSideTab('inventory');
      return `[인벤토리] ${player.inv.length}개 아이템`;

    case 'quest':
    case 'quests':
    case '퀘스트':
      actions.setSideTab('quest');
      return `[퀘스트] ${player.quests.length}개 진행 중`;

    case 'map':
    case '지도':
      return `[현재 위치: ${player.loc}] 이동 가능: ${(DB.MAPS[player.loc]?.exits || []).join(', ')}`;

    case 'help':
    case 'h':
    case '?':
      return `이동: move <지역>\n행동: explore, rest, shop\n전투: attack(a), skill(s), nextskill(sn), escape(r)\n정보: status, inventory, quest, map`;

    default:
      if (locationMap[command]) {
        actions.move(locationMap[command]);
        return;
      }
      if (DB.MAPS[command]) {
        actions.move(command);
        return;
      }
      return `알 수 없는 명령어: ${command} (/help)`;
  }
};
