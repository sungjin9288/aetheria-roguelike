// cycle 321: unused DB import 제거 — messages.ts 어디에서도 DB 참조 0건.

/**
 * messages.js — 게임 내 모든 메시지를 한국어로 통합 관리합니다.
 * CombatEngine, hooks 등에서 참조하세요.
 */
export const MSG: any = {
    // --- 전투 (Combat) ---
    // cycle 116: COMBAT_ATTACK 제거 — COMBAT_ATTACK_DETAIL이 active.
    COMBAT_ATTACK_DETAIL: (name: any, dmg: any, cur: any, max: any, tags: any) =>
        `${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    COMBAT_ENEMY_HIT: (name: any, dmg: any) => {
        const variants = [
            `${name}이(가) ${dmg} 피해를 가했습니다.`,
            `${name}의 공격! ${dmg} 피해를 받았습니다.`,
            `${name}에게 가격당했습니다. (${dmg})`,
        ];
        return variants[Math.floor(Math.random() * variants.length)];
    },
    COMBAT_ENEMY_HEAVY_HIT: (name: any, dmg: any) => {
        const variants = [
            `${name}의 강타! ${dmg} 피해를 입었습니다.`,
            `${name}이(가) 맹렬하게 공격합니다! ${dmg} 피해!`,
            `강력한 일격! ${name}의 공격에 ${dmg} 피해를 받았습니다.`,
        ];
        return variants[Math.floor(Math.random() * variants.length)];
    },
    COMBAT_ENEMY_GUARD: (name: any) => `${name}이(가) 방어 자세를 취했습니다.`,
    COMBAT_ENEMY_STUNNED: (name: any) => `${name}이(가) 기절하여 턴을 잃습니다.`,
    COMBAT_CRIT: '치명타!',
    COMBAT_WEAKNESS: '속성 약점 적중!',
    COMBAT_RESIST: '적이 속성을 저항했습니다.',

    // --- 스킬 (Skill) ---
    // slice 19: tags 추가 — 치명타/약점/저항을 본문에 통합 (COMBAT_ATTACK_DETAIL 동일 패턴)
    SKILL_USE: (skillName: any, dmg: any, name: any, cur: any, max: any, tags: any) =>
        `[${skillName}]: ${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    SKILL_BUFF_ACTIVE: (name: any, turns: any) => `[${name}] 버프 활성화 (${turns} 턴)`,
    SKILL_STATUS_BONUS: (effect: any, dmg: any) => `[${effect}] 추가 피해 +${dmg}`,
    SKILL_NO_MP: 'MP가 부족합니다.',
    SKILL_ON_COOLDOWN: (name: any, turns: any) => `[${name}] 쿨타임: ${turns} 턴`,
    SKILL_NONE: '사용 가능한 스킬이 없습니다.',

    // --- 탈출 (Escape) ---
    ESCAPE_SUCCESS: '성공적으로 탈출했습니다!',
    ESCAPE_FAIL: '탈출 실패!',
    ESCAPE_FAIL_DMG: (name: any, dmg: any) => `${name}이(가) 뒤쫓아 ${dmg} 피해를 입혔습니다.`,

    // --- 전투 결과 (Victory / Defeat) ---
    VICTORY: (exp: any, gold: any) => `승리! EXP +${exp}, Gold +${gold}`,
    LOOT_GET: (name: any) => `전리품: ${name}`,
    LOOT_PREFIX: (name: any) => `접두사 부여: [${name}]`,
    PRESTIGE_RARE_DROP: (name: any) => `✦ [심연의 메아리] 보스가 희귀 장비를 떨어뜨렸습니다: ${name}`,
    SIGNATURE_DISCOVERED: (name: any) => `✦ 전설 각인 ─ ${name} 획득!`,
    SIGNATURE_SELL_BLOCKED: (name: any) => `[${name}]은(는) 전설 각인 아이템이라 판매할 수 없습니다.`,
    SIGNATURE_SYNTH_BLOCKED: (name: any) => `[${name}]은(는) 전설 각인 아이템이라 합성 재료로 사용할 수 없습니다.`,
    SIGNATURE_BOSS_HINT: (bossName: any, count: any, topName: any, topPct: any) => (
        count > 1
            ? `✦ [${bossName}] 전설 각인 ${count}종 드롭 가능 — 최고 [${topName}] ${topPct}%`
            : `✦ [${bossName}] 전설 각인 [${topName}] 드롭 가능 — ${topPct}%`
    ),
    SIGNATURE_PITY_RESONANCE: (pct: any, pity: any) => `✦ 각인 공명 +${pct}% — 보스 ${pity}회 연속 무획득 보정 적용`,
    LEGACY_ESSENCE: (n: any) => `레거시 에센스 +${n}`,
    LEGACY_RANK: (n: any) => `레거시 랭크 ${n} 달성!`,
    // slice 19: 스탯 상승 표기 — 레벨업이 무엇을 바꿨는지 로그에서 즉시 확인 (성장 가시화)
    LEVEL_UP: (lv: any, atk: any, hp: any) => `⬆️ 레벨 업! Lv.${lv} — ATK +${atk} / HP +${hp}`,
    LEVEL_MILESTONE: (lv: any, gold: any) => `🎖️ Lv.${lv} 달성! 골드 ${gold.toLocaleString()} 획득`,
    LEVEL_MAJOR_MILESTONE: (lv: any, atk: any, hp: any, mp: any) => `✨ Lv.${lv} 메이저 마일스톤! ATK+${atk} / HP+${hp} / MP+${mp} 영구 증가`,
    EQUIP_LEVEL_REQUIRED: (name: any, lv: any) => `${name}은(는) Lv.${lv} 이상에서 장착할 수 있습니다.`,
    BUFF_EXPIRED: '버프 효과가 만료되었습니다.',
    DEFEAT: '전투에서 패배했습니다. 레거시 보너스는 유지됩니다.',
    // C-1 (B+ 2026-06): 첫 죽음 영구 메타 보상 안내 — "죽음도 성장이다".
    FIRST_DEATH_META: (atk: any, hp: any) => `[각성] 첫 죽음의 대가로 영구 힘을 얻었습니다. (ATK +${atk}, 최대 HP +${hp}) 다음 도전은 더 강하게 시작합니다.`,
    // B-1 (B+ 2026-06): 시작 부트 — 캐릭터 생성 직후 첫 유물 선택 안내.
    START_BOOT_RELIC: '[유산] 여정을 시작하기 전, 첫 유물을 선택하십시오. 당신의 빌드는 여기서 시작됩니다.',

    // --- 상태이상 (Status Effects) ---
    // cycle 107: 플레이어가 freeze/stun 상태에서 턴을 스킵할 때의 안내 — 적의
    // stunnedTurns 처리(MSG.COMBAT_ENEMY_STUNNED)와 짝.
    PLAYER_STATUS_SKIP: (effect: any) => {
        const label = effect === 'freeze' ? '빙결' : effect === 'stun' ? '기절' : effect;
        return `[${label}] 행동 불가 — 턴을 잃었습니다.`;
    },

    STATUS_DOT: (effect: any, dmg: any) => {
        // cycle 106: bleed → 출혈 라벨 추가. CombatEngine player DoT 분기에 bleed가
        // 누락돼 있던 회귀 fix와 함께 (enemy.dots 분기에선 이미 '출혈' 사용 중이라
        // surface 일관성 회복).
        const label = effect === 'poison' ? '중독'
            : effect === 'burn' ? '화상'
            : effect === 'bleed' ? '출혈'
            : effect;
        return `[${label}] 상태이상 피해 ${dmg}`;
    },

    // cycle 116: 데드 마일스톤 / 도감 메시지 키 제거 — MILESTONE_KILLS_*, MILESTONE_BOSS_*,
    // CODEX_DISCOVER/MILESTONE 등은 active 컴포넌트에서 inline 메시지로 대체되어 0건 사용.

    // --- 등급 (Rarity) ---
    RARITY_LABEL: { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' },

    // --- 합성 (Synthesis) ---
    SYNTHESIS_SUCCESS: (name: any) => `✨ 합성 성공! [${name}] 획득!`,
    SYNTHESIS_FAIL: '합성 실패... 일부 재료가 소실되었습니다.',
    SYNTHESIS_PROTECTED: '합성 보호 활성화 — 재료가 보존되었습니다.',
    SYNTHESIS_NOT_ENOUGH: '합성에 필요한 재료가 부족합니다.',
    SYNTHESIS_NOT_ENOUGH_GOLD: '합성에 필요한 골드가 부족합니다.',

    // --- 프리미엄 (Premium) ---
    PREMIUM_PURCHASE: (name: any, cost: any) => `${name} 구매 완료 (${cost} 크리스탈)`,
    PREMIUM_NOT_ENOUGH: '에테르 크리스탈이 부족합니다.',
    PREMIUM_INV_EXPAND: (size: any) => `인벤토리 확장! (최대 ${size}칸)`,

    // --- 강화 (Enhancement) ---
    ENHANCE_SUCCESS: (name: any, lv: any) => `✨ [${name}] +${lv} 강화 성공!`,
    ENHANCE_FAIL: (name: any, lv: any) => `💔 [${name}] +${lv} 강화 실패. 등급 유지.`,
    ENHANCE_MAX_LEVEL: '이미 최고 강화 등급입니다 (+10).',
    ENHANCE_NO_GOLD: (cost: any) => `강화 비용이 부족합니다. (필요: ${cost}G)`,
    ENHANCE_NO_MATERIAL: (name: any, count: any) => `${name}이(가) 부족합니다. (필요: ${count}개)`,
    ENHANCE_NOT_EQUIP: '강화는 장비 아이템에만 가능합니다.',

    // --- 주간 미션 (Weekly Mission) ---
    // cycle 116: WEEKLY_MISSION_COMPLETE/RESET 제거 — 0건 사용. CLAIM만 active.
    WEEKLY_MISSION_CLAIM: (gold: any, crystals: any) => `주간 보상 수령: +${gold}G${crystals ? ` +${crystals}💎` : ''}`,

    // --- 챌린지 런 (Challenge Run) ---
    // cycle 116: CHALLENGE_COMPLETE 제거 — 0건 사용. START만 active.
    CHALLENGE_START: (labels: any) => `⚔ 챌린지 런 시작: ${labels.join(', ')}`,

    // --- 진 엔딩 (True Ending) ---
    // cycle 116: TRUE_BOSS_PHASE3 제거 — 0건 사용. UNLOCK/APPEAR만 active.
    TRUE_BOSS_UNLOCK: '세계의 근원이 흔들립니다... 숨겨진 문이 열렸습니다!',
    TRUE_BOSS_APPEAR: '원시의 신이 강림했습니다. 이것이 진짜 끝입니다.',
    PRIMAL_SHARD_DROP: (count: any) => `원시의 파편 획득! (${count}/3)`,
    PRIMAL_SHARD_HINT: (count: any) => `원시의 파편 ${count}/3개. 마왕을 쓰러뜨리면 진실이 드러납니다.`,

    // --- 심연 마일스톤 (Abyss Milestone) ---
    ABYSS_MILESTONE: (floor: any) => `🌀 심연 ${floor}층 마일스톤 달성!`,
    ABYSS_BOSS_APPEAR: (name: any) => `💀 심연 보스 출현: ${name}`,

    // --- 묘비 침략 (Grave Invasion) ---
    INVADE_SUCCESS: (name: any, item: any) => `⚔ ${name}의 묘비 침략 성공! [${item}] 획득.`,
    INVADE_FAIL: (name: any) => `⚔ ${name}의 묘비 침략 실패. 아무것도 얻지 못했습니다.`,
    INVADE_LIMIT: '오늘의 침략 횟수를 모두 사용했습니다. (5회/일)',
    INVADE_NO_ITEMS: '묘비에 침략할 아이템이 없습니다.',

    // --- 신규 직업 스킬 (Sprint 16) ---
    SKILL_EXTRA_TURN: (name: any) => `[${name}] 시간이 흘러갑니다 — 추가 행동 획득!`,
    SKILL_RESET_COOLDOWNS: (name: any) => `[${name}] 모든 쿨타임이 초기화되었습니다!`,

    // cycle 116: 데드 키 제거 — REST_FULL/PARTIAL(REST_DONE_FULL이 active),
    // INVENTORY_FULL(INV_FULL active), BOSS_ENCOUNTER/AREA_BOSS_ENCOUNTER,
    // SAFE_ZONE_ARRIVE, MOVE_BLOCKED_COMBAT/EVENT(MOVE_BLOCKED active),
    // DISCOVERY_CHAIN_TRIGGER/COMPLETE(exploreUtils inline string 사용),
    // CHALLENGE_REWARD_BONUS, SKILL_CURSE_AMPLIFY(cycle 108에서 의도 구현했지만
    // inline 메시지로 대체).

    // --- 스킬 교체 ---
    SKILL_SWAP: (oldName: any, newName: any) => `스킬 교체: [${oldName}] → [${newName}]`,
    SKILL_SWAP_COST: (gold: any) => `스킬 교체 비용: ${gold}G`,

    // --- 직업/클래스 ---
    CLASS_TIER_0: '기본',
    CLASS_TIER_1: '1차 전직',
    CLASS_TIER_2: '2차 전직',
    CLASS_TIER_3: '최종 전직',
    CLASS_STAT_HP: 'HP',
    CLASS_STAT_MP: 'MP',
    CLASS_STAT_ATK: 'ATK',
    CLASS_REQ_LEVEL: (lv: any) => `Lv.${lv} 이상`,
    CLASS_TREE_TITLE: '전직 계통도',
    CLASS_CURRENT: '현재 직업',
    CLASS_AVAILABLE: '전직 가능',
    CLASS_LOCKED: '잠김',

    // --- 도감 ---
    // cycle 116: CODEX_NEW_ENTRY/DISCOVERED/UNDISCOVERED/PROGRESS 제거 — 0건 사용.
    MONSTER_WEAKNESS: '약점',
    MONSTER_RESISTANCE: '내성',
    MONSTER_KILL_COUNT: (n: any) => `처치 ${n}회`,
    EQUIP_STAT_COMPARE: '스탯 비교',
    // cycle 116: EQUIP_EQUIPPED / UI_EQUIPPED 둘 다 '장착 중' 중복 정의였음. 둘 다 제거.

    // --- 인벤토리/장비 액션 ---
    INV_ITEM_NOT_FOUND: '인벤토리에 없는 아이템입니다.',
    EQUIP_JOB_RESTRICT: (job: any, name: any) => `${job}은(는) ${name}을(를) 장착할 수 없습니다.`,
    EQUIP_TWO_HAND_SHIELD_BLOCK: '양손 무기 사용 중에는 방패를 장착할 수 없습니다.',
    EQUIP_TWO_HAND_OFFHAND_RELEASE: '양손 무기로 전환되어 보조 손 장비가 해제되었습니다.',
    EQUIP_TWO_HAND_TO_ONE_HAND: '양손 무기를 해제하고 한손 무기 체계로 전환했습니다.',
    EQUIP_OFFHAND_SET: '보조 손에 한손 무기를 장착했습니다.',
    EQUIP_MAIN_SHIFT: '새 무기를 주손에 장착하고 기존 무기를 보조손으로 이동했습니다.',
    EQUIP_MAIN_REPLACE: '주손 무기를 교체했습니다.',
    EQUIP_OFFHAND_REPLACE: '보조 손 장비를 교체했습니다.',
    EQUIP_DONE: (name: any) => `${name} 장착.`,
    CHALLENGE_NO_CONSUMABLE: '금욕 챌린지: 소모 아이템을 사용할 수 없습니다.',
    ITEM_USE_BUFF: (name: any) => `${name} 사용: 버프 활성화`,
    GOLD_INSUFFICIENT: '골드가 부족합니다.',
    INV_FULL: '인벤토리가 가득 찼습니다.',
    SHOP_BUY_DONE: (name: any) => `${name} 구매 완료.`,
    SHOP_SELL_DONE: (name: any, gold: any) => `${name} 판매 완료 (+${gold}G)`,
    CRAFT_MAT_INSUFFICIENT: (name: any) => `재료 부족: ${name}`,
    CRAFT_DONE: (name: any) => `${name} 제작 완료`,
    QUEST_NOT_COMPLETE: '아직 완료 조건을 만족하지 못했습니다.',
    QUEST_REWARD_ITEM: (name: any) => `보상 아이템: ${name}`,
    QUEST_TRAIT_BONUS: (title: any, gold: any) => `[${title}] 공명 보상 +${gold}G`,
    QUEST_DONE: (title: any) => `퀘스트 완료: ${title}`,
    ACH_NOT_UNLOCKED: '아직 달성하지 못한 업적입니다.',
    ACH_ALREADY_CLAIMED: '이미 수령한 업적입니다.',
    ACH_REWARD_ITEM: (name: any) => `업적 보상 아이템: ${name}`,
    ACH_DONE: (title: any) => `업적 달성: ${title}`,
    PREMIUM_INSUFFICIENT: (name: any) => `${name}이(가) 부족합니다.`,
    TITLE_ALREADY_OWNED: '이미 보유 중인 칭호입니다.',
    ITEM_NOT_FOUND: '아이템을 찾을 수 없습니다.',
    SKILL_BRANCH_CHOSEN: (name: any, choice: any) => `[${name}] 분기 ${choice} 선택 완료.`,
    BULK_SELL_EMPTY: '판매할 저가 재료가 없습니다.',
    BULK_SELL_DONE: (count: any, gold: any) => `재료 ${count}개 일괄 판매 (+${gold}G)`,

    // --- 이동/탐험 ---
    MOVE_BLOCKED: '지금은 이동할 수 없는 상태입니다.',
    MAP_NOT_FOUND: '존재하지 않는 지역입니다.',
    MOVE_SEASON_ONLY: '⚡ 시즌 이벤트 기간에만 접근할 수 있는 지역입니다.',
    MOVE_NO_EXIT: '갈 수 없는 곳입니다.',
    MOVE_LEVEL_REQUIRED: (lv: any) => `레벨 ${lv} 이상에서 입장할 수 있습니다.`,
    TOWN_BUFF_CLEAR: '마을에 복귀하며 임시 버프와 상태이상이 정리되었습니다.',
    EXPLORE_BLOCKED: '탐색할 수 없는 상태입니다.',
    TOWN_PEACEFUL: '마을 주변은 평화롭습니다.',
    MAP_UNKNOWN: '알 수 없는 위치입니다. 시작 마을로 이동하세요.',
    EXPLORE_NOTHING: '아무 일도 일어나지 않았습니다.',
    EXPLORE_QUIET: '주변이 조용합니다.',
    EXPLORE_RELIC_FOUND: '✨ [유물 발견] 전투 직전, 고대의 유물이 눈에 들어옵니다!',
    REST_SAFE_ONLY: '휴식은 안전한 지역에서만 가능합니다.',
    REST_GOLD_INSUFFICIENT: (cost: any) => `골드가 부족합니다. (필요: ${cost}G)`,
    // cycle 116: REST_DONE 제거 — REST_DONE_FULL이 active.
    SKILL_SWAP_SAFE_ONLY: '스킬 교체는 안전한 지역에서만 가능합니다.',
    SKILL_SWAP_GOLD_INSUFFICIENT: (cost: any) => `골드 부족 (필요: ${cost}G)`,
    SKILL_NO_BRANCH: '해당 스킬에 분기가 없습니다.',
    SKILL_INVALID_BRANCH: '유효하지 않은 분기입니다.',
    INIT_RECORD_APPLIED: '초기 기록이 적용되었습니다. 이름을 정하고 다시 시작해 주세요.',
    JOB_CHANGE_INVALID: '전직 가능한 직업이 아닙니다.',
    JOB_CHANGE_LEVEL: '전직 레벨이 부족합니다.',
    QUEST_TOWN_ONLY: '퀘스트 수락은 마을 게시판에서만 가능합니다.',
    QUEST_ALREADY_ACCEPTED: '이미 수락한 퀘스트입니다.',
    QUEST_LEVEL_REQUIRED: (lv: any) => `레벨 ${lv} 이상부터 수락할 수 있는 퀘스트입니다.`,
    QUEST_ACCEPTED: (title: any) => `퀘스트 수락: ${title}`,
    BOUNTY_TOWN_ONLY: '현상수배 수주는 마을 게시판에서만 가능합니다.',
    BOUNTY_ALREADY_ACTIVE: '이미 진행 중인 현상수배가 있습니다. (퀘스트 완료 후 수주 가능)',
    BOUNTY_DAILY_LIMIT: '오늘 현상수배는 이미 발급되었습니다. 내일 다시 요청하세요.',
    // cycle 116: BOUNTY_ACCEPTED 제거 — BOUNTY_ACCEPTED_NEW가 active.
    ASCEND_CANCEL: '환생을 취소했습니다. 여정을 계속합니다.',

    // --- 이동/탐험 동적 메시지 ---
    MOVE_EXITS: (exits: any) => `이동 가능한 지역: ${exits}`,
    MOVE_ARRIVED: (loc: any) => `${loc}로 이동했습니다.`,
    MOVE_NEW_AREA: (loc: any) => `🗺️ 새 지역 발견: ${loc}`,
    // C-2 (B+ 2026-06): 갓 진입한 위험 지역(권장 레벨 근접) 경고 — 정예/보스 readability.
    MOVE_AREA_DANGER: (lv: any) => `⚠️ 권장 레벨 ${lv} 지역입니다. 아직 이곳은 당신에게 벅찹니다 — 정예와 구역 보스를 경계하고, 위태로우면 후퇴하십시오.`,
    GRAVE_FOUND_MULTI: (count: any) => `근처에서 당신의 유해 ${count}구를 발견했습니다.`,
    GRAVE_FOUND_SINGLE: '근처에서 당신의 유해를 발견했습니다.',
    START_CALLSIGN: (name: any) => `[콜사인] ${name} — 에테리아 기록이 열렸습니다.`,
    START_INITIAL_SKILL: (name: any) => `초기 스킬: ${name}`,
    AI_QUOTA_REACHED: '오늘 AI 호출 한도에 도달했습니다.',
    ABYSS_FLOOR_WARNING: (floor: any) => `🌀 심연 ${floor}층 — 강대한 적들이 기다립니다...`,
    ENEMY_APPEAR: (name: any) => `${name} 등장!`,
    EVENT_RESULT_DEFAULT: '선택의 결과가 반영되었습니다.',
    // 캠프파이어 노드 (Phase 2, B+ 2026-06): 휴식 vs 단련 결정 (StS 캠프파이어).
    CAMPFIRE_DESC: '🔥 사그라드는 모닥불을 발견했습니다. 잠시 숨을 고를 수 있습니다 — 무엇을 하시겠습니까?',
    CAMPFIRE_REST_CHOICE: '휴식 — 체력과 마나를 회복한다',
    CAMPFIRE_FORGE_CHOICE: '단련 — 무기를 손질해 다음 전투를 대비한다',
    CAMPFIRE_REST_LOG: (hp: any, mp: any) => `🔥 불 곁에서 숨을 고릅니다. HP +${hp}, MP +${mp} 회복했습니다.`,
    CAMPFIRE_FORGE_LOG: (pct: any, turns: any) => `🔥 무기를 벼립니다. 다음 전투 ${turns}턴 동안 공격력 +${pct}%.`,
    EVENT_SUCCESS_GOLD: (gold: any) => `성공! ${gold}G를 획득했습니다.`,
    EVENT_FAIL_DAMAGE: (dmg: any) => `실패... ${dmg} 피해를 입었습니다.`,
    REST_DONE_FULL: (cost: any) => `휴식 완료. HP/MP가 회복되었습니다. (-${cost}G)`,
    JOB_CHANGE_DONE: (jobName: any) => `${jobName} 전직 완료!`,
    BOUNTY_ACCEPTED_NEW: (target: any, count: any) => `새로운 현상수배 수락: ${target} ${count}마리`,
    TITLE_UNLOCKED: (label: any) => `🏆 칭호 획득: [${label}]`,
    ASCEND_DONE: (rank: any, title: any) => `⚡ [에테르 환생 ${rank}회] ${title} 칭호 획득! 영구 보너스 적용됨.`,
    DAILY_PROTOCOL_DONE: (reward: any) => `📋 일일 프로토콜 완료: ${reward}`,
    CHAIN_REWARD_RELIC: (name: any) => `✨ [체인 보상] 유물 [${name}] 획득!`,
    CHAIN_REWARD_COMBAT_BONUS: (atkPct: any, turns: any) => `⚔ [최후의 영웅] 기사의 혼령 합류! ATK +${atkPct}% ${turns}턴`,

    // cycle 116: GM_OVERWHELM/CRISIS/UNDERDOG 제거 — 게임 마스터 톤 메시지가 0건 사용
    // (DifficultyManager가 자체 로그를 inline string으로 처리).

    // --- 전투 요약 (PostCombat Digest) ---
    COMBAT_DIGEST_KILL: (name: any) => `${name} 처치`,
    COMBAT_DIGEST_LOOT: (items: any) => `전리품 ${items}`,
    COMBAT_DIGEST: (parts: any) => `전투 정리: ${parts}`,
    COMBAT_DIGEST_BOSS_REWARD: (bonus: any, hint: any) => `보스 보상: ${bonus > 0 ? `초회 토벌 +${bonus}G` : '보스 전리품'} · ${hint}`,
    COMBAT_DIGEST_EQUIP_UPGRADE: (name: any, summary: any) => `장비 갱신: ${name} · ${summary}`,
    COMBAT_DIGEST_TRAIT_HINT: (name: any, summary: any) => `성향 공명: ${name} · ${summary}`,
    COMBAT_DIGEST_DEFAULT_SUMMARY: '장비 효율 상승',

    // --- 전투 상태 ---
    COMBAT_NOT_IN_BATTLE: '전투 상태가 아닙니다.',
    COMBAT_ITEM_NOT_FOUND: '인벤토리에 없는 아이템입니다.',
    COMBAT_CONSUMABLE_ONLY: '전투 중에는 소모품만 사용할 수 있습니다.',
    DEMON_KING_SLAIN_ASCEND: '⚡ 마왕이 쓰러졌습니다. 에테르 환생의 문이 열렸습니다...',
    TRUE_GOD_SLAIN: '🌟 원시의 신이 쓰러졌습니다. 세계의 진실이 밝혀집니다...',
    VOID_GOD_SLAIN: '💀 공허의 신이 쓰러졌습니다. 공허가 잠시 물러났습니다... 당신은 심연의 끝을 정복했습니다.',
    ABYSS_RECORD: (floor: any) => `🏆 심연 최고 기록 경신! ${floor}층 도달`,

    // --- 전투 아이템/스킬 ---
    COMBAT_CHAOS_SKILL: (name: any) => `혼돈의 기술: [${name}] 발동!`,
    COMBAT_DOT_KILL: (name: any) => `[지속 피해] ${name}이(가) 쓰러졌습니다!`,
    ITEM_USE_SIMPLE: (name: any) => `${name} 사용.`,
    ITEM_USE_CURE: (name: any) => `${name} 사용: 상태이상 해제`,

    // --- 전투 승리 ---
    QUEST_CONDITION_MET: (count: any) => `퀘스트 조건 달성: ${count}개`,
    KILL_STREAK_BONUS: (streak: any, atkPct: any) => `🔥 ${streak}연속 처치! ATK +${atkPct}% 보너스 발동`,

    // --- 심연 ---
    ABYSS_DESCEND: (floor: any) => `심연의 더 깊은 곳으로 진입했습니다. (현재: ${floor}층)`,
    ABYSS_LEGENDARY_ITEM: (name: any) => `🏆 전설 아이템 획득: [${name}]`,
    // cycle 194: ABYSS_PRESTIGE_POINTS 제거 — abyss milestone 'prestige_points' reward type이
    //   dead config(player.prestigePoints가 spend/UI 미구현)였음. 보상 타입을 relic_choice/
    //   legendary_item으로 교체해 메시지도 자연 dead → 정리.

    // --- Firebase 동기화 ---
    SYNC_SERVER_LOADED: '서버 데이터와 동기화되었습니다.',
    SYNC_AUTH_TIMEOUT: '인증 지연으로 오프라인 모드로 시작했습니다.',
    SYNC_NO_CONFIG: '클라우드 설정을 찾을 수 없어 오프라인 모드로 시작했습니다.',
    SYNC_AUTH_FAIL: '클라우드 인증 실패로 오프라인 모드로 시작했습니다.',
    SYNC_TIMEOUT: '클라우드 응답 지연으로 오프라인 모드로 시작했습니다.',
    SYNC_CONNECT_FAIL: '클라우드 연결 실패로 오프라인 모드로 시작했습니다.',

    // --- 탐험 선택지 ---
    CHOICE_DEFAULT: (n: any) => `선택지 ${n}`,

    // --- 이동 기본값 ---
    MOVE_NO_EXITS: '없음',

    // --- UI 라벨 (버튼/섹션) ---
    UI_CLOSE: '닫기',
    UI_OPEN: '열기',
    UI_REFRESH: '갱신',
    UI_REVIEW: '검토',
    UI_NOTABLE: '주목',
    // cycle 116: UI_ALL / UI_EQUIPPED 제거 — 0건 사용 (INV_FILTER_ALL과 inline string으로 대체).
    UI_MY_RANK: '내 순위',
    UI_LOOT_REVIEW: '전리품 검토',
    UI_LOOT_FOCUS: '전리품 주목',
    UI_LOOT_FOCUS_HINT: '이번 전투에서 얻은 장비를 우선 확인하세요.',
    UI_PRESTIGE: 'PRESTIGE',
    UI_PRESTIGE_COMPLETE: '환생 완료',
    UI_AUTO_EQUIP_BEST: '최적 장비 자동 장착',

    // --- 인벤토리 필터 ---
    INV_FILTER_ALL: '전체',
    INV_FILTER_WEAPON: '무기',
    INV_FILTER_ARMOR: '방어구',
    INV_FILTER_SHIELD: '보조',
    INV_FILTER_CONSUMABLE: '회복',
    INV_FILTER_MATERIAL: '재료',
    // cycle 116: INV_FULL_WARNING 제거 — INV_FULL이 active.
};
