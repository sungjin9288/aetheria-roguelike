import type { BoundedEncounter } from '../types/encounter.js';

export const BOUNDED_ENCOUNTER_PACK_ENABLED = true as const;

export const BOUNDED_ENCOUNTERS: readonly BoundedEncounter[] = Object.freeze([
    {
        id: 'forest-old-pillars',
        version: 1,
        region: '고요한 숲',
        family: '돌기둥의 속삭임',
        situation: '고요한 숲의 오래된 돌기둥 사이로 먼저 지나간 모험가의 흔적과 희미한 문장이 드러납니다.',
        eligibility: {},
        choices: [
            {
                id: 'read-runes',
                label: '돌기둥의 문장을 읽는다',
                tradeoff: '기력 10을 들여 다음 전투의 방어를 단단히 합니다.',
                cost: { mp: 10 },
                outcome: {
                    result: '돌기둥의 가호가 다음 전투까지 방어를 지켜 줍니다.',
                    buff: { name: '돌기둥의 가호', def: 0.2, turn: 3 },
                },
            },
            {
                id: 'lift-stone',
                label: '무거운 돌을 들어 올린다',
                tradeoff: '생명 8을 감수하고 골드 60을 바로 챙깁니다.',
                cost: { hp: 8 },
                outcome: { gold: 60, result: '돌 아래 숨겨진 골드 60을 찾아냈습니다.' },
            },
        ],
    },
    {
        id: 'forest-mutated-trail',
        version: 1,
        region: '고요한 숲',
        family: '변이된 숲길',
        situation: '변이된 덩굴이 상처 입은 숲길을 막고 있습니다. 지금의 생명 상태에 따라 대가가 달라집니다.',
        eligibility: { hpBand: 'strained' },
        choices: [
            {
                id: 'clear-thorns',
                label: '가시를 걷어 길을 연다',
                tradeoff: '생명 10을 내고 강화 재료를 확보합니다.',
                cost: { hp: 10 },
                outcome: { item: '강화 재료', result: '가시덤불을 걷어 내고 강화 재료를 챙겼습니다.' },
            },
            {
                id: 'soothe-spirit',
                label: '숲의 존재를 달랜다',
                tradeoff: '기력 12를 써서 생명 18을 회복합니다.',
                cost: { mp: 12 },
                outcome: { hp: 18, result: '숲의 기운이 상처를 감싸 생명 18을 회복했습니다.' },
            },
        ],
    },
    {
        id: 'plain-supply-cart',
        version: 1,
        region: '서쪽 평원',
        family: '버려진 보급 수레',
        situation: '서쪽 평원의 옛 곡창 지대에 보급 수레 하나가 멈춰 있습니다. 바퀴와 상자가 아직 쓸 만합니다.',
        eligibility: {},
        choices: [
            {
                id: 'repair-cart',
                label: '수레를 고쳐 보급을 챙긴다',
                tradeoff: '안정적으로 골드 40과 하급 체력 물약 1개를 얻습니다.',
                outcome: {
                    gold: 40,
                    item: '하급 체력 물약',
                    result: '수레를 고쳐 골드 40과 하급 체력 물약 1개를 챙겼습니다.',
                },
            },
            {
                id: 'search-cart',
                label: '수레를 빠르게 뒤진다',
                tradeoff: '생명 8을 감수하고 골드 80을 즉시 가져갑니다.',
                cost: { hp: 8 },
                outcome: { gold: 80, result: '위험을 감수한 대가로 골드 80을 찾아냈습니다.' },
            },
        ],
    },
    {
        id: 'plain-bandit-banner',
        version: 1,
        region: '서쪽 평원',
        family: '도적단의 낡은 깃발',
        situation: '서쪽 평원 언덕에 도적단의 낡은 깃발이 펄럭이고, 멀리 불의 협곡으로 이어지는 흔적이 보입니다.',
        eligibility: {
            lineage: ['전사', '나이트', '버서커', '팔라딘', '드래곤 나이트', '도적', '어쌔신', '레인저', '그림자 주군', '사냥의 군주'],
        },
        choices: [
            {
                id: 'read-formation',
                label: '깃발의 전투 신호를 읽는다',
                tradeoff: '기력 8을 들여 다음 전투의 공격을 끌어올립니다.',
                cost: { mp: 8 },
                outcome: {
                    buff: { name: '매복의 통찰', atk: 0.18, turn: 3 },
                    result: '도적의 전투 신호를 읽어 다음 전투의 공격이 강해집니다.',
                },
            },
            {
                id: 'follow-cache-map',
                label: '낡은 보관 지도를 따라간다',
                tradeoff: '생명 8을 감수하고 강화 재료 1개를 확보합니다.',
                cost: { hp: 8 },
                outcome: { item: '강화 재료', result: '숨겨진 보관처에서 강화 재료 1개를 찾았습니다.' },
            },
        ],
    },
]);
