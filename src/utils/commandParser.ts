import { DB } from '../data/db';
import { MSG } from '../data/messages';
import type { Player } from '../types/index.js';
import type { GameActions } from '../hooks/actionDeps.js';
import { GS } from '../reducers/gameStates';
import type { GameMode } from '../reducers/gameStates';

type CommandParserActions = Pick<
    GameActions,
    'handleEventChoice' | 'move' | 'explore' | 'rest' | 'combat' | 'cycleSkill'
    | 'openShop' | 'getFullStats' | 'setSideTab'
>;

export const parseCommand = (input: string, gameState: GameMode, player: Player, actions: CommandParserActions) => {
  if (!input || !input.trim()) return;

  const tokens = input.trim().replace(/^\//, '').split(' ');
  const command = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1).join(' ');
  const readOnlyCommands = new Set(['help', 'h', '?', 'status', 'stat', '상태', 'i', 'inventory', 'inv', '인벤', 'quest', 'quests', '퀘스트', 'map', '지도']);
  // 모드별 차단 안내 **전수 표**. `null`은 "이 모드에서는 파서가 막지 않는다"이고,
  //   문자열은 그 모드의 안내다.
  // 2026-09 Wave 19 K1: 준비 중(`event_pending`)에는 아직 선택지가 없다 — 키가 없으면
  //   명령이 각 액션 가드로 흘러가 문구가 제각각이 된다(explore/move/rest/shop이
  //   서로 다른 에러). Wave 20 L1: `Record<GameMode, …>`라 그 누락이 **TS2741**이 된다.
  const blockedStateMessages: Record<GameMode, string | null> = {
    [GS.EVENT]: MSG.CMD_BLOCKED_EVENT,
    [GS.EVENT_PENDING]: MSG.AI_EVENT_PREPARING_BLOCKED,
    [GS.JOB_CHANGE]: MSG.CMD_BLOCKED_JOB_CHANGE,
    [GS.QUEST_BOARD]: MSG.CMD_BLOCKED_QUEST_BOARD,
    [GS.SHOP]: MSG.CMD_BLOCKED_SHOP,
    [GS.CRAFTING]: MSG.CMD_BLOCKED_CRAFTING,
    [GS.ASCENSION]: MSG.CMD_BLOCKED_ASCENSION,
    [GS.DEAD]: MSG.CMD_BLOCKED_DEAD,
    // 파서가 막지 않는 모드 — 게이트는 각 액션이 소유한다(§5 DON'T).
    [GS.IDLE]: null,
    [GS.COMBAT]: null,
    [GS.MOVING]: null,
    [GS.TRUE_ENDING]: null,
  };

  const locationMap: Record<string, string> = {
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

  if (gameState === GS.EVENT && (command === '1' || command === '2' || command === '3')) {
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
      return MSG.CMD_SKILL_CYCLED;

    case 'run':
    case 'escape':
    case 'r':
    case '도주':
      actions.combat('escape');
      return;

    // 2026-09 Wave 17 I1: 파서가 상점 진입 시퀀스를 직접 복제하면서 `type === 'safe'`만
    //   보고 `gameState`를 안 봤다 — 전투가 가능한 안전지대(황금 왕국)에서 전투 중
    //   `shop`을 치면 도주 판정 없이 전투를 버릴 수 있었다. 이제 액션 하나가 소유한다.
    case 'shop':
    case '상점':
      actions.openShop();
      return;

    case 'status':
    case 'stat':
    case '상태':
    case 'i': {
      const stats = actions.getFullStats();
      return MSG.CMD_STATUS(
        player.level, player.name, player.job,
        player.hp, stats.maxHp, player.mp, player.maxMp, player.gold, player.loc,
      );
    }

    case 'inventory':
    case 'inv':
    case '인벤':
      actions.setSideTab('inventory');
      return MSG.CMD_INVENTORY((player.inv || []).length);

    case 'quest':
    case 'quests':
    case '퀘스트':
      actions.setSideTab('quest');
      return MSG.CMD_QUEST((player.quests || []).length);

    case 'map':
    case '지도': {
      const visitedCount = new Set([...(player.stats?.visitedMaps || []), player.loc]).size;
      const totalCount = Object.keys(DB.MAPS).length;
      return MSG.CMD_MAP(visitedCount, totalCount, player.loc);
    }

    case 'help':
    case 'h':
    case '?':
      return MSG.CMD_HELP;

    default:
      if (locationMap[command]) {
        actions.move(locationMap[command]);
        return;
      }
      if (DB.MAPS[command]) {
        actions.move(command);
        return;
      }
      return MSG.CMD_UNKNOWN(command);
  }
};
