// cycle 321: unused DB import 제거 — messages.ts 어디에서도 DB 참조 0건.

/**
 * messages.js — 게임 내 모든 메시지를 한국어로 통합 관리합니다.
 * CombatEngine, hooks 등에서 참조하세요.
 *
 * 2026-07 타입화: MSG 객체 리터럴 타입을 TypeScript가 그대로 추론하도록 두고
 * (const로 export), 각 함수의 파라미터에 실제 호출부 인자 타입을 명시해
 * `: any` 107건을 해소했다. MSG 자체에는 명시적 타입 주석을 달지 않는다 —
 * 리터럴 추론이 실제 함수 시그니처(파라미터/반환 타입)를 그대로 보존해
 * 소비처 33개 파일과의 호환성이 더 안전하다.
 */
export const MSG = {
    // --- 전투 (Combat) ---
    // cycle 116: COMBAT_ATTACK 제거 — COMBAT_ATTACK_DETAIL이 active.
    COMBAT_ATTACK_DETAIL: (name: string | undefined, dmg: number, cur: number, max: number | undefined, tags: string[]) =>
        `${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    COMBAT_ENEMY_HIT: (name: string | undefined, dmg: number) => {
        const variants = [
            `${name}이(가) ${dmg} 피해를 가했습니다.`,
            `${name}의 공격! ${dmg} 피해를 받았습니다.`,
            `${name}에게 가격당했습니다. (${dmg})`,
        ];
        return variants[Math.floor(Math.random() * variants.length)];
    },
    COMBAT_ENEMY_HEAVY_HIT: (name: string | undefined, dmg: number) => {
        const variants = [
            `${name}의 강타! ${dmg} 피해를 입었습니다.`,
            `${name}이(가) 맹렬하게 공격합니다! ${dmg} 피해!`,
            `강력한 일격! ${name}의 공격에 ${dmg} 피해를 받았습니다.`,
        ];
        return variants[Math.floor(Math.random() * variants.length)];
    },
    COMBAT_ENEMY_GUARD: (name: string | undefined) => `${name}이(가) 방어 자세를 취했습니다.`,
    COMBAT_ENEMY_STUNNED: (name: string | undefined) => `${name}이(가) 기절하여 턴을 잃습니다.`,
    COMBAT_CRIT: '치명타!',
    COMBAT_WEAKNESS: '속성 약점 적중!',
    COMBAT_RESIST: '적이 속성을 저항했습니다.',

    // --- 스킬 (Skill) ---
    // slice 19: tags 추가 — 치명타/약점/저항을 본문에 통합 (COMBAT_ATTACK_DETAIL 동일 패턴)
    SKILL_USE: (skillName: string | undefined, dmg: number, name: string | undefined, cur: number, max: number | undefined, tags: string[]) =>
        `[${skillName}]: ${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    SKILL_BUFF_ACTIVE: (name: string, turns: number) => `${name} 강화 효과가 ${turns}턴 동안 적용됩니다.`,
    SKILL_STATUS_BONUS: (effect: string, dmg: number) => `[${effect}] 추가 피해 +${dmg}`,
    SKILL_NO_MP: '기력이 부족합니다.',
    SKILL_ON_COOLDOWN: (name: string, turns: number) => `${name} 재사용까지 ${turns}턴 남았습니다.`,
    SKILL_NONE: '사용 가능한 스킬이 없습니다.',

    // --- 탈출 (Escape) ---
    ESCAPE_SUCCESS: '성공적으로 탈출했습니다!',
    ESCAPE_FAIL: '탈출 실패!',
    ESCAPE_FAIL_DMG: (name: string | undefined, dmg: number) => `${name}이(가) 뒤쫓아 ${dmg} 피해를 입혔습니다.`,

    // --- 전투 결과 (Victory / Defeat) ---
    VICTORY: (exp: number, gold: number) => `승리했습니다. 경험 +${exp} · 골드 +${gold}`,
    FIRST_BOSS_GOLD: (gold: number) => `첫 보스 토벌 보상 · 골드 +${gold}`,
    BLOOD_OATH_HEAL: (health: number) => `피의 서약으로 생명을 ${health}만큼 회복했습니다.`,
    WORLD_DEVOUR_HEALTH: (health: number) => `세계 포식자가 영혼을 흡수해 최대 생명이 ${health}만큼 늘었습니다.`,
    IMMORTAL_WARRIOR_HEAL: (health: number) => `불멸의 전사 효과로 생명을 ${health}만큼 회복했습니다.`,
    INFINITE_DEVOUR_HEAL: (health: number) => `무한 포식 효과로 생명을 ${health}만큼 회복했습니다.`,
    STAR_CORE_RESTORE: '별의 핵이 기력을 모두 회복했습니다.',
    LOOT_GET: (name: string) => `전리품: ${name}`,
    LOOT_PREFIX: (name: string) => `접두사 부여: [${name}]`,
    PRESTIGE_RARE_DROP: (name: string) => `✦ [심연의 메아리] 보스가 희귀 장비를 떨어뜨렸습니다: ${name}`,
    SIGNATURE_DISCOVERED: (name: string) => `✦ 전설 각인 ─ ${name} 획득!`,
    SIGNATURE_SELL_BLOCKED: (name: string | undefined) => `[${name}]은(는) 전설 각인 아이템이라 판매할 수 없습니다.`,
    SIGNATURE_SYNTH_BLOCKED: (name: string) => `[${name}]은(는) 전설 각인 아이템이라 합성 재료로 사용할 수 없습니다.`,
    SIGNATURE_BOSS_HINT: (bossName: string, count: number, topName: string, topPct: number | string) => (
        count > 1
            ? `✦ [${bossName}] 전설 각인 ${count}종 드롭 가능 — 최고 [${topName}] ${topPct}%`
            : `✦ [${bossName}] 전설 각인 [${topName}] 드롭 가능 — ${topPct}%`
    ),
    SIGNATURE_PITY_RESONANCE: (pct: number | string, pity: number | undefined) => `✦ 각인 공명 +${pct}% — 보스 ${pity}회 연속 무획득 보정 적용`,
    // fix/signature-set-two-hand: 양손 시그니처 무기가 세트 카운트에 2피스로 반영됐을 때
    // EquipmentPanel "세트 진행도" 카드에 표시하는 힌트 1줄.
    SIGNATURE_SET_TWO_HAND_HINT: '💡 양손 무기는 보조 슬롯을 함께 차지해 2피스로 계산됩니다.',
    OUTFIT_SET_TWO_HAND_SLOT: '양손 무기가 함께 사용',
    OUTFIT_SET_TWO_HAND_HINT: '양손 무기는 보조 장비 칸까지 2피스로 계산됩니다.',
    LEGACY_ESSENCE: (n: number) => `계승 정수 +${n}`,
    LEGACY_RANK: (n: number) => `계승 단계 ${n} 달성`,
    // 2026-07 — 에테르 거울: revive 노드(런당 1회 치명상 부활) 발동 로그.
    MIRROR_REVIVE: '[에테르 수호] 거울의 가호가 치명상을 막아냈습니다!',
    MIRROR_PURCHASE: (name: string, newLevel: number, cost: number) => `에테르 거울에 ${name} ${newLevel}단계를 새겼습니다. 계승 정수 -${cost}`,
    MIRROR_MAX_LEVEL: (name: string) => `${name}은(는) 이미 최대 레벨입니다.`,
    MIRROR_ESSENCE_INSUFFICIENT: (cost: number) => `에센스가 부족합니다. (필요: ${cost})`,
    // slice 19: 스탯 상승 표기 — 레벨업이 무엇을 바꿨는지 로그에서 즉시 확인 (성장 가시화)
    LEVEL_UP: (level: number, attack: number, health: number) => `레벨 ${level} 상승 · 공격력 +${attack} · 생명 +${health}`,
    LEVEL_MILESTONE: (level: number, gold: number) => `레벨 ${level} 달성 · 골드 ${gold.toLocaleString()} 획득`,
    LEVEL_MAJOR_MILESTONE: (level: number, attack: number, health: number, energy: number) => `레벨 ${level} 성장 보너스 · 공격력 +${attack} · 생명 +${health} · 기력 +${energy}`,
    EQUIP_LEVEL_REQUIRED: (name: string, level: number) => `${name} 장착에는 레벨 ${level} 이상이 필요합니다.`,
    BUFF_EXPIRED: '강화 효과가 끝났습니다.',
    DEFEAT: '전투에서 쓰러졌습니다. 계승한 힘은 다음 여정에도 남습니다.',
    // C-1 (B+ 2026-06): 첫 죽음 영구 메타 보상 안내 — "죽음도 성장이다".
    FIRST_DEATH_META: (attack: number, health: number) => `첫 패배를 딛고 영구적인 힘을 얻었습니다. 공격력 +${attack} · 최대 생명 +${health}. 다음 여정은 더 강하게 시작합니다.`,
    // B-1 (B+ 2026-06): 시작 부트 — 캐릭터 생성 직후 첫 유물 선택 안내.
    START_BOOT_RELIC: '여정을 떠나기 전, 함께할 첫 유물을 고르세요. 이 선택이 앞으로의 전투 방식을 만듭니다.',

    // --- 상태이상 (Status Effects) ---
    // cycle 107: 플레이어가 freeze/stun 상태에서 턴을 스킵할 때의 안내 — 적의
    // stunnedTurns 처리(MSG.COMBAT_ENEMY_STUNNED)와 짝.
    PLAYER_STATUS_SKIP: (effect: string) => {
        const label = effect === 'freeze' ? '빙결' : effect === 'stun' ? '기절' : effect;
        return `[${label}] 행동 불가 — 턴을 잃었습니다.`;
    },

    STATUS_DOT: (effect: string, dmg: number) => {
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
    RARITY_LABEL: { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' } as Record<string, string>,

    // --- 합성 (Synthesis) ---
    SYNTHESIS_SUCCESS: (name: string) => `✨ 합성 성공! [${name}] 획득!`,
    SYNTHESIS_FAIL: '합성 실패... 일부 재료가 소실되었습니다.',
    SYNTHESIS_PROTECTED: '합성 보호 활성화 — 재료가 보존되었습니다.',
    SYNTHESIS_NOT_ENOUGH: '합성에 필요한 재료가 부족합니다.',
    SYNTHESIS_NOT_ENOUGH_GOLD: '합성에 필요한 골드가 부족합니다.',

    // --- 프리미엄 (Premium) ---
    PREMIUM_PURCHASE: (name: string, cost: number) => `${name} 구매 완료 (${cost} 크리스탈)`,
    PREMIUM_NOT_ENOUGH: '에테르 크리스탈이 부족합니다.',
    PREMIUM_INV_EXPAND: (size: number) => `가방을 ${size}칸까지 확장했습니다.`,

    // --- 강화 (Enhancement) ---
    ENHANCE_SUCCESS: (name: string, lv: number) => `✨ [${name}] +${lv} 강화 성공!`,
    ENHANCE_FAIL: (name: string, lv: number) => `💔 [${name}] +${lv} 강화 실패. 등급 유지.`,
    ENHANCE_MAX_LEVEL: '이미 최고 강화 등급입니다 (+10).',
    ENHANCE_NO_GOLD: (cost: number) => `강화할 골드가 부족합니다. 필요 골드: ${cost}`,
    ENHANCE_NO_MATERIAL: (name: string, count: number) => `${name}이(가) 부족합니다. (필요: ${count}개)`,
    ENHANCE_NOT_EQUIP: '강화는 장비 아이템에만 가능합니다.',

    // --- 주간 미션 (Weekly Mission) ---
    // cycle 116: WEEKLY_MISSION_COMPLETE/RESET 제거 — 0건 사용. CLAIM만 active.
    WEEKLY_MISSION_CLAIM: (gold: number, crystals?: number) => `주간 보상 · 골드 +${gold}${crystals ? ` · 수정 +${crystals}` : ''}`,

    // --- 도전 설정 ---
    // cycle 116: CHALLENGE_COMPLETE 제거 — 0건 사용. START만 active.
    CHALLENGE_START: (labels: string[]) => `⚔ 도전 모험 시작: ${labels.join(', ')}`,

    // --- 진 엔딩 (True Ending) ---
    // cycle 116: TRUE_BOSS_PHASE3 제거 — 0건 사용. UNLOCK/APPEAR만 active.
    TRUE_BOSS_UNLOCK: '세계의 근원이 흔들립니다... 숨겨진 문이 열렸습니다!',
    TRUE_BOSS_APPEAR: '원시의 신이 강림했습니다. 이것이 진짜 끝입니다.',
    PRIMAL_SHARD_DROP: (count: number) => `원시의 파편 획득! (${count}/3)`,
    PRIMAL_SHARD_HINT: (count: number) => `원시의 파편 ${count}/3개. 마왕을 쓰러뜨리면 진실이 드러납니다.`,

    // --- 심연 마일스톤 (Abyss Milestone) ---
    ABYSS_MILESTONE: (floor: number) => `🌀 심연 ${floor}층 마일스톤 달성!`,
    ABYSS_BOSS_APPEAR: (name: string) => `💀 심연 보스 출현: ${name}`,

    // --- 묘비 침략 (Grave Invasion) ---
    INVADE_SUCCESS: (name: string, item: string) => `⚔ ${name}의 묘비 침략 성공! [${item}] 획득.`,
    INVADE_FAIL: (name: string) => `⚔ ${name}의 묘비 침략 실패. 아무것도 얻지 못했습니다.`,
    INVADE_LIMIT: '오늘의 침략 횟수를 모두 사용했습니다. (5회/일)',
    INVADE_NO_ITEMS: '묘비에 침략할 아이템이 없습니다.',

    // --- 신규 직업 스킬 (Sprint 16) ---
    SKILL_EXTRA_TURN: (name: string) => `[${name}] 시간이 흘러갑니다 — 추가 행동 획득!`,
    SKILL_RESET_COOLDOWNS: (name: string) => `${name} 효과로 모든 기술을 바로 다시 사용할 수 있습니다.`,

    // cycle 116: 데드 키 제거 — REST_FULL/PARTIAL(REST_DONE_FULL이 active),
    // INVENTORY_FULL(INV_FULL active), BOSS_ENCOUNTER/AREA_BOSS_ENCOUNTER,
    // SAFE_ZONE_ARRIVE, MOVE_BLOCKED_COMBAT/EVENT(MOVE_BLOCKED active),
    // DISCOVERY_CHAIN_TRIGGER/COMPLETE(exploreUtils inline string 사용),
    // CHALLENGE_REWARD_BONUS, SKILL_CURSE_AMPLIFY(cycle 108에서 의도 구현했지만
    // inline 메시지로 대체).

    // --- 스킬 교체 ---
    SKILL_SWAP: (skillName: string, oldName: string, newName: string) => `${skillName} 성장 변경: ${oldName} → ${newName}`,
    SKILL_SWAP_COST: (gold: number) => `기술 교체 비용 · 골드 ${gold}`,

    // --- 직업/클래스 ---
    CLASS_TIER_0: '기본',
    CLASS_TIER_1: '1차 전직',
    CLASS_TIER_2: '2차 전직',
    CLASS_TIER_3: '최종 전직',
    CLASS_STAT_HP: '생명',
    CLASS_STAT_MP: '기력',
    CLASS_STAT_ATK: '공격력',
    CLASS_REQ_LEVEL: (level: number) => `레벨 ${level} 이상`,
    CLASS_TREE_TITLE: '전직 계통도',
    CLASS_CURRENT: '현재 직업',
    CLASS_AVAILABLE: '전직 가능',
    CLASS_LOCKED: '잠김',

    // --- 도감 ---
    // cycle 116: CODEX_NEW_ENTRY/DISCOVERED/UNDISCOVERED/PROGRESS 제거 — 0건 사용.
    MONSTER_WEAKNESS: '약점',
    MONSTER_RESISTANCE: '내성',
    MONSTER_KILL_COUNT: (n: number) => `처치 ${n}회`,
    EQUIP_STAT_COMPARE: '능력 비교',
    // cycle 116: EQUIP_EQUIPPED / UI_EQUIPPED 둘 다 '장착 중' 중복 정의였음. 둘 다 제거.

    // --- 인벤토리/장비 액션 ---
    INV_ITEM_NOT_FOUND: '가방에 없는 아이템입니다.',
    EQUIP_JOB_RESTRICT: (job: string | undefined, name: string | undefined) => `${job}은(는) ${name}을(를) 장착할 수 없습니다.`,
    EQUIP_TWO_HAND_SHIELD_BLOCK: '양손 무기 사용 중에는 방패를 장착할 수 없습니다.',
    EQUIP_TWO_HAND_OFFHAND_RELEASE: '양손 무기로 전환되어 보조 손 장비가 해제되었습니다.',
    EQUIP_TWO_HAND_TO_ONE_HAND: '양손 무기를 해제하고 한손 무기 체계로 전환했습니다.',
    EQUIP_OFFHAND_SET: '보조 손에 한손 무기를 장착했습니다.',
    EQUIP_MAIN_SHIFT: '새 무기를 주손에 장착하고 기존 무기를 보조손으로 이동했습니다.',
    EQUIP_MAIN_REPLACE: '주손 무기를 교체했습니다.',
    EQUIP_OFFHAND_REPLACE: '보조 손 장비를 교체했습니다.',
    EQUIP_DONE: (name: string) => `${name} 장착.`,
    CHALLENGE_NO_CONSUMABLE: '물약 없이: 회복과 보조 아이템을 사용할 수 없습니다.',
    ITEM_USE_BUFF: (name: string) => `${name}을 사용해 강화 효과를 얻었습니다.`,
    GOLD_INSUFFICIENT: '골드가 부족합니다.',
    INV_FULL: '가방이 가득 찼습니다.',
    SHOP_BUY_DONE: (name: string | undefined) => `${name} 구매 완료.`,
    SHOP_SELL_DONE: (name: string | undefined, gold: number) => `${name} 판매 · 골드 +${gold}`,
    CRAFT_MAT_INSUFFICIENT: (name: string) => `재료 부족: ${name}`,
    CRAFT_DONE: (name: string) => `${name} 제작 완료`,
    QUEST_NOT_COMPLETE: '아직 완료 조건을 만족하지 못했습니다.',
    QUEST_REWARD_ITEM: (name: string) => `보상 아이템: ${name}`,
    QUEST_TRAIT_BONUS: (title: string, gold: number) => `${title} 공명 보상 · 골드 +${gold}`,
    QUEST_DONE: (title: string) => `퀘스트 완료: ${title}`,
    ACH_NOT_UNLOCKED: '아직 달성하지 못한 업적입니다.',
    ACH_ALREADY_CLAIMED: '이미 수령한 업적입니다.',
    ACH_REWARD_ITEM: (name: string) => `업적 보상 아이템: ${name}`,
    ACH_DONE: (title: string | undefined) => `업적 달성: ${title}`,
    PREMIUM_INSUFFICIENT: (name: string) => `${name}이(가) 부족합니다.`,
    TITLE_ALREADY_OWNED: '이미 보유 중인 칭호입니다.',
    ITEM_NOT_FOUND: '아이템을 찾을 수 없습니다.',
    SKILL_BRANCH_CHOSEN: (name: string, branchName: string) => `${name} 성장 선택: ${branchName}`,
    SKILL_BRANCH_ALREADY_CHOSEN: (name: string) => `${name}의 첫 성장 선택은 끝났습니다. 안전한 지역에서 다시 선택할 수 있습니다.`,
    BULK_SELL_EMPTY: '판매할 저가 재료가 없습니다.',
    BULK_SELL_DONE: (count: number, gold: number) => `재료 ${count}개 판매 · 골드 +${gold}`,

    // --- 이동/탐험 ---
    MOVE_BLOCKED: '지금은 이동할 수 없는 상태입니다.',
    MAP_NOT_FOUND: '존재하지 않는 지역입니다.',
    MOVE_SEASON_ONLY: '⚡ 시즌 이벤트 기간에만 접근할 수 있는 지역입니다.',
    MOVE_NO_EXIT: '갈 수 없는 곳입니다.',
    MOVE_LEVEL_REQUIRED: (lv: number | string) => `레벨 ${lv} 이상에서 입장할 수 있습니다.`,
    TOWN_BUFF_CLEAR: '마을에 돌아와 임시 강화 효과와 상태 이상을 정리했습니다.',
    EXPLORE_BLOCKED: '탐색할 수 없는 상태입니다.',
    TOWN_PEACEFUL: '마을 주변은 평화롭습니다.',
    MAP_UNKNOWN: '알 수 없는 위치입니다. 시작 마을로 이동하세요.',
    EXPLORE_NOTHING: '아무 일도 일어나지 않았습니다.',
    EXPLORE_QUIET: '주변이 조용합니다.',
    EXPLORE_RELIC_FOUND: '✨ [유물 발견] 전투 직전, 고대의 유물이 눈에 들어옵니다!',
    REST_SAFE_ONLY: '휴식은 안전한 지역에서만 가능합니다.',
    REST_GOLD_INSUFFICIENT: (cost: number) => `휴식할 골드가 부족합니다. 필요 골드: ${cost}`,
    // cycle 116: REST_DONE 제거 — REST_DONE_FULL이 active.
    SKILL_SWAP_SAFE_ONLY: '스킬 교체는 안전한 지역에서만 가능합니다.',
    SKILL_SWAP_GOLD_INSUFFICIENT: (cost: number) => `기술을 바꿀 골드가 부족합니다. 필요 골드: ${cost}`,
    SKILL_NO_BRANCH: '해당 스킬에 분기가 없습니다.',
    SKILL_INVALID_BRANCH: '유효하지 않은 분기입니다.',
    JOB_CHANGE_INVALID: '전직 가능한 직업이 아닙니다.',
    JOB_CHANGE_LEVEL: '전직 레벨이 부족합니다.',
    QUEST_TOWN_ONLY: '퀘스트 수락은 마을 게시판에서만 가능합니다.',
    QUEST_ALREADY_ACCEPTED: '이미 수락한 퀘스트입니다.',
    QUEST_ALREADY_COMPLETED: '이미 완료해 보상을 받은 퀘스트입니다.',
    QUEST_LEVEL_REQUIRED: (lv: number | undefined) => `레벨 ${lv} 이상부터 수락할 수 있는 퀘스트입니다.`,
    QUEST_PREREQUISITE_REQUIRED: (title: string | undefined) => `‘${title}’ 임무를 먼저 완료해야 이어지는 이야기를 받을 수 있습니다.`,
    QUEST_ACCEPTED: (title: string | undefined) => `퀘스트 수락: ${title}`,
    QUEST_ABANDON_TOWN_ONLY: '임무 포기는 마을 게시판에서만 가능합니다.',
    QUEST_ABANDON_REWARD_PENDING: '완료한 임무는 보상을 받은 뒤 목록에서 정리할 수 있습니다.',
    QUEST_ABANDONED: (title: string | undefined) => `${title} 임무를 포기했습니다. 같은 임무는 다시 수락할 수 있습니다.`,
    EXPEDITION_FOCUS_TOWN_ONLY: '원정 임무 편성은 마을에서만 바꿀 수 있습니다.',
    EXPEDITION_FOCUS_LIMIT: '이번 원정에는 임무를 최대 3개까지 지정할 수 있습니다.',
    EXPEDITION_FOCUS_REQUIRED: '원정 임무를 최소 1개는 유지해야 합니다.',
    EXPEDITION_FOCUS_ADDED: (title: string) => `이번 원정 임무 추가: ${title}`,
    EXPEDITION_FOCUS_REMOVED: (title: string) => `이번 원정 임무 제외: ${title}`,
    BOUNTY_TOWN_ONLY: '현상수배 수주는 마을 게시판에서만 가능합니다.',
    BOUNTY_ABANDONED: '현상수배 임무를 포기했습니다. 오늘은 새 현상수배를 받을 수 없습니다.',
    BOUNTY_ALREADY_ACTIVE: '이미 진행 중인 현상수배가 있습니다. (퀘스트 완료 후 수주 가능)',
    BOUNTY_DAILY_LIMIT: '오늘 현상수배는 이미 발급되었습니다. 내일 다시 요청하세요.',
    // cycle 116: BOUNTY_ACCEPTED 제거 — BOUNTY_ACCEPTED_NEW가 active.
    ASCEND_CANCEL: '환생을 취소했습니다. 여정을 계속합니다.',

    // --- 이동/탐험 동적 메시지 ---
    MOVE_EXITS: (exits: string) => `이동 가능한 지역: ${exits}`,
    MOVE_ARRIVED: (loc: string) => `${loc}에 도착했습니다.`,
    MOVE_NEW_AREA: (loc: string) => `처음 발견한 지역은 ${loc}입니다.`,
    // C-2 (B+ 2026-06): 갓 진입한 위험 지역(권장 레벨 근접) 경고 — 정예/보스 readability.
    MOVE_AREA_DANGER: (lv: number | string) => `이 지역의 권장 레벨은 ${lv}입니다. 정예와 구역 보스를 주의하고, 생명이 부족하면 돌아가세요.`,
    GRAVE_FOUND_MULTI: (count: number) => `근처에서 당신의 유해 ${count}구를 발견했습니다.`,
    GRAVE_FOUND_SINGLE: '근처에서 당신의 유해를 발견했습니다.',
    START_JOURNEY: (name: string) => `${name}의 첫 여정이 시작됩니다.`,
    START_SKILL: (name: string) => `첫 기술로 익힌 능력은 ${name}입니다.`,
    AI_QUOTA_REACHED: '오늘 AI 호출 한도에 도달했습니다.',
    ABYSS_FLOOR_WARNING: (floor: number) => `🌀 심연 ${floor}층 — 강대한 적들이 기다립니다...`,
    ENEMY_APPEAR: (name: string) => `${name} 등장!`,
    EVENT_RESULT_DEFAULT: '선택의 결과가 반영되었습니다.',
    // 캠프파이어 노드 (Phase 2, B+ 2026-06): 휴식 vs 단련 결정 (StS 캠프파이어).
    CAMPFIRE_DESC: '사그라드는 모닥불을 발견했습니다. 잠시 숨을 고를 수 있습니다. 무엇을 하시겠습니까?',
    CAMPFIRE_REST_CHOICE: '휴식 — 생명과 기력을 회복한다',
    CAMPFIRE_FORGE_CHOICE: '단련 — 무기를 손질해 다음 전투를 대비한다',
    CAMPFIRE_REST_LOG: (health: number, energy: number) => `불 곁에서 숨을 고르며 생명 +${health} · 기력 +${energy} 회복했습니다.`,
    CAMPFIRE_FORGE_LOG: (pct: number, turns: number) => `무기를 벼립니다. 다음 전투 ${turns}턴 동안 공격력 +${pct}%.`,
    // 탐험 스카우팅 (2026-07): 사전 정찰 카드 — 체인/캠프파이어 다음 우선순위 결정 노드.
    SCOUT_DESC: '앞길에서 낯선 기척이 느껴집니다. 어떻게 정찰하시겠습니까?',
    SCOUT_COMBAT_CHOICE: '전투의 기척 — 적과 맞서며 처치 보상을 더 받는다',
    // 관대함 하향 (2026-07 밸런스 감사): "전투 회피 = 안전"으로만 읽히지 않도록 이변
    //   위험을 문구에 명시 — anomaly 확률 실제 가중(SCOUT_SIGNAL_ANOMALY_MULT)과 정합.
    SCOUT_ANOMALY_CHOICE: '이상 신호 — 전투를 피하고 이변의 흔적을 살핀다',
    SCOUT_UNKNOWN_CHOICE: '짙은 안개 — 결과를 알 수 없는 길로 들어간다',
    SCOUT_ELITE_CHOICE: '정예의 흔적 — 강력한 적과 싸워 유물을 노린다',
    SCOUT_COMBAT_LOG: '기척을 쫓아 적과 정면으로 마주칩니다.',
    SCOUT_ANOMALY_LOG: '이상 신호를 따라 주변을 조심스럽게 살핍니다.',
    SCOUT_UNKNOWN_LOG: '짙은 안개 속으로 발을 내딛습니다.',
    SCOUT_ELITE_LOG: '정예의 흔적을 따라가 강력한 적과 마주칩니다.',
    // 원정 보스 접근 게이지 (2026-07): 던전 진입 시 원정 목표 배너 + 만충 시 도전/회피 선택.
    EXPEDITION_GOAL_BANNER: (bossName: string) => `🎯 원정 목표: ${bossName} — 흔적을 쫓아 접근하라.`,
    BOSS_GAUGE_FULL_DESC: (bossName: string) => `${bossName}의 흔적이 짙어졌습니다. 지금 정면으로 맞서시겠습니까?`,
    BOSS_GAUGE_CHALLENGE_CHOICE: '도전 — 구역 보스와 정면으로 맞선다',
    BOSS_GAUGE_AVOID_CHOICE: '회피 — 흔적을 피해 계속 나아간다',
    BOSS_GAUGE_CHALLENGE_LOG: (bossName: string) => `${bossName}에게 정면으로 도전합니다.`,
    BOSS_GAUGE_AVOID_LOG: '흔적을 피해 발걸음을 돌립니다. 기척은 여전히 짙게 남아 있습니다.',
    MAP_BADGE_BOSS_GAUGE: (pct: number) => `게이지 ${pct}%`,
    EXPEDITION_CLEAR_RECAP: (bossName: string, kills: number, gold: number) => (
        `원정 완료 · ${bossName} 격파 · 적 ${kills}마리 처치 · 골드 +${gold}`
    ),
    EVENT_SUCCESS_GOLD: (gold: number) => `선택에 성공했습니다. 골드 +${gold}`,
    EVENT_FAIL_DAMAGE: (dmg: number) => `선택의 대가로 생명 ${dmg}을 잃었습니다.`,
    REST_DONE_FULL: (cost: number) => `휴식을 마치고 생명과 기력을 모두 회복했습니다. 골드 -${cost}`,
    JOB_CHANGE_DONE: (jobName: string) => `${jobName} 전직 완료!`,
    BOUNTY_ACCEPTED_NEW: (target: string, count: number) => `새로운 현상수배 수락: ${target} ${count}마리`,
    TITLE_UNLOCKED: (label: string) => `새 칭호를 얻었습니다. ${label}`,
    ASCEND_DONE: (rank: number, title: string) => `⚡ [에테르 환생 ${rank}회] ${title} 칭호 획득! 영구 보너스 적용됨.`,
    DAILY_PROTOCOL_DONE: (reward: string) => `📋 일일 프로토콜 완료: ${reward}`,
    CHAIN_REWARD_RELIC: (name: string) => `이야기 보상 · 유물 ${name}을 얻었습니다.`,
    CHAIN_REWARD_COMBAT_BONUS: (attackPercent: number, turns: number) => `최후의 영웅이 합류해 ${turns}턴 동안 공격력이 ${attackPercent}% 오릅니다.`,

    // --- 체인 저널 (Quest 탭) ---
    CHAIN_JOURNAL_TITLE: '진행 중인 이야기',
    CHAIN_JOURNAL_EMPTY: '아직 진행 중인 이야기가 없습니다. 탐험 중 우연히 시작될 수 있습니다.',
    CHAIN_JOURNAL_STEP: (current: number, total: number) => `${current}/${total} 단계`,
    CHAIN_JOURNAL_NEXT_LOC: (loc: string) => `다음 이야기: ${loc}`,

    // --- 맵 exit 배지 (MapNavigator) ---
    MAP_BADGE_BOSS: '보스',
    MAP_BADGE_HIGH_EVENT: '이벤트↑',
    MAP_BADGE_SHOP: '상점',
    MAP_BADGE_GRAVE: '유해 회수↑',

    // --- 복귀 브리핑 카드 (리텐션 훅) ---
    RETURN_BRIEFING_TITLE: '복귀를 환영합니다',
    RETURN_BRIEFING_AWAY: (hours: number) => `마지막 접속 이후 ${hours}시간이 지났습니다.`,
    RETURN_BRIEFING_LOCATION_LABEL: '현재 위치',
    RETURN_BRIEFING_STATUS_LABEL: '현재 상태',
    RETURN_BRIEFING_MISSIONS_LABEL: '남은 오늘의 임무',
    RETURN_BRIEFING_MISSIONS_VALUE: (count: number) => `${count}건`,
    RETURN_BRIEFING_CHAINS_LABEL: '진행 중인 이야기',
    RETURN_BRIEFING_CHAINS_VALUE: (count: number) => `${count}건`,
    RETURN_BRIEFING_CLOSE: '탐험 계속하기',

    // --- 심연 데일리 다이브 (리텐션 훅) ---
    ABYSS_DAILY_DIVE_START: (mult: number) => `🌀 오늘의 첫 다이브 — 보상 ${mult}배 적용!`,

    // cycle 116: GM_OVERWHELM/CRISIS/UNDERDOG 제거 — 게임 마스터 톤 메시지가 0건 사용
    // (DifficultyManager가 자체 로그를 inline string으로 처리).

    // --- 전투 요약 (PostCombat Digest) ---
    COMBAT_DIGEST_KILL: (name: string) => `${name} 처치`,
    COMBAT_DIGEST_LOOT: (items: string) => `전리품 ${items}`,
    COMBAT_DIGEST: (parts: string) => `전투 정리: ${parts}`,
    COMBAT_DIGEST_BOSS_REWARD: (bonus: number, hint: string) => `보스 보상: ${bonus > 0 ? `첫 토벌 골드 +${bonus}` : '보스 전리품'} · ${hint}`,
    KILL_STACK_ATTACK: (source: string, percent: number) => `${source} 효과로 이번 전투의 공격력이 ${percent}% 올랐습니다.`,
    COMBAT_DIGEST_EQUIP_UPGRADE: (name: string, summary: string) => `장비 갱신: ${name} · ${summary}`,
    COMBAT_DIGEST_TRAIT_HINT: (name: string, summary: string) => `성향 공명: ${name} · ${summary}`,
    COMBAT_DIGEST_DEFAULT_SUMMARY: '장비 효율 상승',

    // --- 전투 상태 ---
    COMBAT_NOT_IN_BATTLE: '전투 상태가 아닙니다.',
    COMBAT_ITEM_NOT_FOUND: '가방에 없는 아이템입니다.',
    COMBAT_CONSUMABLE_ONLY: '전투 중에는 소모품만 사용할 수 있습니다.',
    DEMON_KING_SLAIN_ASCEND: '⚡ 마왕이 쓰러졌습니다. 에테르 환생의 문이 열렸습니다...',
    TRUE_GOD_SLAIN: '🌟 원시의 신이 쓰러졌습니다. 세계의 진실이 밝혀집니다...',
    VOID_GOD_SLAIN: '💀 공허의 신이 쓰러졌습니다. 공허가 잠시 물러났습니다... 당신은 심연의 끝을 정복했습니다.',
    ABYSS_RECORD: (floor: number) => `🏆 심연 최고 기록 경신! ${floor}층 도달`,

    // --- 전투 아이템/스킬 ---
    COMBAT_CHAOS_SKILL: (name: string) => `뒤섞인 기술: [${name}]이(가) 발동했습니다!`,
    COMBAT_DOT_KILL: (name: string) => `[지속 피해] ${name}이(가) 쓰러졌습니다!`,
    ITEM_USE_SIMPLE: (name: string) => `${name} 사용.`,
    ITEM_USE_CURE: (name: string) => `${name} 사용: 상태이상 해제`,

    // --- 전투 승리 ---
    QUEST_CONDITION_MET: (count: number) => `퀘스트 조건 달성: ${count}개`,
    KILL_STREAK_BONUS: (streak: number, atkPct: number) => `🔥 ${streak}연속 처치! 공격력 +${atkPct}% 보너스 발동`,

    // --- 심연 ---
    ABYSS_DESCEND: (floor: number) => `심연의 더 깊은 곳으로 진입했습니다. (현재: ${floor}층)`,
    ABYSS_LEGENDARY_ITEM: (name: string | undefined) => `🏆 전설 아이템 획득: [${name}]`,
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
    CHOICE_DEFAULT: (n: number) => `선택지 ${n}`,

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
