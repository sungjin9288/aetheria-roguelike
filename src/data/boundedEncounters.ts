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
        id: 'forest-engraved-echo',
        version: 1,
        region: '고요한 숲',
        family: '각인의 메아리',
        situation: '한 번 발견한 고유 장비의 각인이 고요한 숲의 오래된 문양에 반응합니다. 공명을 받아들일지, 흩어진 조각을 거둘지 선택해야 합니다.',
        eligibility: { requiresSignature: true },
        choices: [
            {
                id: 'align-engraving',
                label: '문양과 각인을 맞춘다',
                tradeoff: '기력 10을 들여 다음 전투의 공격과 방어를 함께 다듬습니다.',
                cost: { mp: 10 },
                outcome: {
                    result: '각인의 공명이 이어져 다음 전투의 공격과 방어가 함께 강해집니다.',
                    buff: { name: '각인의 공명', atk: 0.10, def: 0.10, turn: 3 },
                },
            },
            {
                id: 'gather-engraving-shards',
                label: '흩어진 각인 조각을 거둔다',
                tradeoff: '생명 8을 감수하고 강화 재료 1개를 확보합니다.',
                cost: { hp: 8 },
                outcome: {
                    item: '강화 재료',
                    result: '흩어진 문양 조각을 다듬어 강화 재료 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'forest-root-resonance',
        version: 1,
        region: '고요한 숲',
        family: '뿌리 아래 공명 결계',
        situation: '현재 갖춘 장비와 유물의 공명이 고요한 숲의 굵은 뿌리 아래 잠든 결계를 깨웁니다. 결계를 이어 다음 전투를 준비할지, 굳은 결정 조각을 거둘지 선택해야 합니다.',
        eligibility: {
            lineage: ['전사', '마법사', '도적'],
            anyBuildTags: ['arcane', 'fortress'],
        },
        choices: [
            {
                id: 'anchor-root-ward',
                label: '결계의 흐름을 이어 둔다',
                tradeoff: '기력 10을 들여 다음 전투의 방어를 단단히 합니다.',
                cost: { mp: 10 },
                outcome: {
                    result: '뿌리의 결계가 이어져 다음 전투의 방어가 단단해집니다.',
                    buff: { name: '뿌리의 결계', def: 0.2, turn: 3 },
                },
            },
            {
                id: 'gather-root-crystal',
                label: '굳은 결정 조각을 거둔다',
                tradeoff: '생명 8을 감수하고 강화 재료 1개를 확보합니다.',
                cost: { hp: 8 },
                outcome: {
                    item: '강화 재료',
                    result: '뿌리 사이의 결정을 다듬어 강화 재료 1개를 챙겼습니다.',
                },
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
    {
        id: 'plain-guardian-waterway',
        version: 1,
        region: '서쪽 평원',
        family: '메마른 수로의 잔향',
        situation: '고대 호수의 수호신을 넘어선 기억에 메마른 평원의 수로가 잠시 물빛으로 흔들립니다. 남은 힘을 깨울지, 퇴적층을 걷어 낼지 선택해야 합니다.',
        eligibility: { previousBoss: '고대 호수의 수호신' },
        choices: [
            {
                id: 'awaken-water-memory',
                label: '수로의 물빛을 깨운다',
                tradeoff: '기력 10을 들여 생명 18을 회복합니다.',
                cost: { mp: 10 },
                outcome: {
                    hp: 18,
                    result: '수호신의 잔향이 상처를 감싸 생명 18을 회복했습니다.',
                },
            },
            {
                id: 'clear-channel-silt',
                label: '굳은 퇴적층을 걷어 낸다',
                tradeoff: '생명 8을 감수하고 골드 70을 찾아냅니다.',
                cost: { hp: 8 },
                outcome: {
                    gold: 70,
                    result: '메마른 수로 아래에서 골드 70을 찾아냈습니다.',
                },
            },
        ],
    },
    {
        id: 'plain-windpath-stance',
        version: 1,
        region: '서쪽 평원',
        family: '바람길의 전투 흔적',
        situation: '지금 다듬은 전투 방식이 서쪽 평원을 가로지르는 끊긴 바람길과 맞물립니다. 흐름을 공격에 실을지, 흔적이 가리킨 보관처를 찾을지 선택해야 합니다.',
        eligibility: {
            lineage: ['전사', '마법사', '도적'],
            anyBuildTags: ['crusher', 'dual'],
        },
        choices: [
            {
                id: 'channel-wind-strike',
                label: '바람의 흐름을 공격에 싣는다',
                tradeoff: '기력 8을 들여 다음 전투의 공격을 끌어올립니다.',
                cost: { mp: 8 },
                outcome: {
                    result: '바람길의 흐름을 읽어 다음 전투의 공격이 강해집니다.',
                    buff: { name: '바람길의 태세', atk: 0.18, turn: 3 },
                },
            },
            {
                id: 'follow-wind-cache',
                label: '흔적이 가리킨 보관처를 찾는다',
                tradeoff: '생명 8을 감수하고 골드 70을 찾아냅니다.',
                cost: { hp: 8 },
                outcome: {
                    gold: 70,
                    result: '바람길 끝의 보관처에서 골드 70을 찾아냈습니다.',
                },
            },
        ],
    },
    // 2026-11 H7(소유자 결정 "정찰 자리 + 32개", 실행 스케치 §5): 토벌 의뢰 8곳 × 4개. 정찰 자리에서 원정당 한 번씩 나온다.
    //   수치는 그 지역에 머무는 플레이어(자연 플레이 중앙값)의 생명 · 기력 약 10%를 대가로, 골드는 같은 지역 폴백 이벤트와 같은 크기다.
    {
        id: 'outpost-ration-crate',
        version: 1,
        region: '몰락한 전초기지',
        family: '봉인된 보급 상자',
        situation: '몰락한 전초기지의 무너진 창고 안쪽에 군의 봉인이 남은 보급 상자가 깔려 있습니다. 녹슨 들보가 위태롭게 상자를 누르고 있습니다.',
        eligibility: {},
        choices: [
            {
                id: 'pry-ration-crate',
                label: '들보를 받치고 상자를 꺼낸다',
                tradeoff: '생명 90을 감수하고 중급 체력 물약 1개를 챙깁니다.',
                cost: {
                    hp: 90,
                },
                outcome: {
                    item: '중급 체력 물약',
                    result: '무너지는 들보를 버텨 내고 중급 체력 물약 1개를 꺼냈습니다.',
                },
            },
            {
                id: 'salvage-crate-coins',
                label: '상자 틈의 군자금만 긁어낸다',
                tradeoff: '안전하게 골드 130을 챙깁니다.',
                outcome: {
                    gold: 130,
                    result: '상자 틈에 끼어 있던 군자금에서 골드 130을 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'outpost-signal-fire',
        version: 1,
        region: '몰락한 전초기지',
        family: '꺼진 봉화대',
        situation: '전초기지 성벽 위 봉화대에 아직 마른 장작이 쌓여 있습니다. 불을 올리면 남은 파수꾼들이 몰려올 것입니다.',
        eligibility: {},
        choices: [
            {
                id: 'light-signal-fire',
                label: '봉화를 올려 결의를 다진다',
                tradeoff: '기력 40을 들여 다음 전투의 공격을 끌어올립니다.',
                cost: {
                    mp: 40,
                },
                outcome: {
                    buff: {
                        name: '봉화의 결의',
                        atk: 0.18,
                        turn: 3,
                    },
                    result: '타오르는 봉화를 등지고 다음 전투의 공격이 강해집니다.',
                },
            },
            {
                id: 'strip-signal-iron',
                label: '봉화대의 쇠붙이를 뜯어낸다',
                tradeoff: '생명 60을 감수하고 철광석 1개를 확보합니다.',
                cost: {
                    hp: 60,
                },
                outcome: {
                    item: '철광석',
                    result: '녹슨 받침을 뜯어 쓸 만한 철광석 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'outpost-field-surgeon',
        version: 1,
        region: '몰락한 전초기지',
        family: '군의관의 막사',
        situation: '상처를 안고 들어선 전초기지 구석에 군의관이 쓰던 막사가 남아 있습니다. 붕대와 약초가 아직 쓸 만합니다.',
        eligibility: {
            hpBand: 'strained',
        },
        choices: [
            {
                id: 'dress-wounds',
                label: '붕대로 상처를 동여맨다',
                tradeoff: '기력 40을 들여 생명 140을 회복합니다.',
                cost: {
                    mp: 40,
                },
                outcome: {
                    hp: 140,
                    result: '군의관의 붕대로 상처를 동여매 생명 140을 회복했습니다.',
                },
            },
            {
                id: 'pack-field-kit',
                label: '쓸 만한 약품만 챙겨 나온다',
                tradeoff: '아무것도 내지 않고 하급 체력 물약 1개를 챙깁니다.',
                outcome: {
                    item: '하급 체력 물약',
                    result: '막사 선반에서 하급 체력 물약 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'outpost-drill-yard',
        version: 1,
        region: '몰락한 전초기지',
        family: '버려진 연병장',
        situation: '갑옷을 입고 싸워 온 몸이 전초기지의 연병장을 알아봅니다. 허수아비와 방패벽이 그대로 서 있습니다.',
        eligibility: {
            lineage: ['전사', '나이트', '버서커', '드래곤 나이트', '팔라딘'],
        },
        choices: [
            {
                id: 'drill-shield-wall',
                label: '방패벽 자세를 되새긴다',
                tradeoff: '기력 40을 들여 다음 전투의 방어를 단단히 합니다.',
                cost: {
                    mp: 40,
                },
                outcome: {
                    buff: {
                        name: '연병장의 방패벽',
                        def: 0.22,
                        turn: 3,
                    },
                    result: '몸에 익은 방패벽 자세가 다음 전투의 방어를 단단히 합니다.',
                },
            },
            {
                id: 'spar-scarecrow',
                label: '허수아비를 상대로 몸을 푼다',
                tradeoff: '생명 90을 감수하고 다음 전투의 공격을 크게 끌어올립니다.',
                cost: {
                    hp: 90,
                },
                outcome: {
                    buff: {
                        name: '연병장의 감각',
                        atk: 0.25,
                        turn: 3,
                    },
                    result: '거친 연습 끝에 다음 전투의 공격이 크게 강해집니다.',
                },
            },
        ],
    },
    {
        id: 'tower-rune-library',
        version: 1,
        region: '고대 마법 탑',
        family: '잠긴 서고',
        situation: '고대 마법 탑의 서고 문에 빛나는 문양이 걸려 있습니다. 풀어내면 안쪽의 마력이 흘러나옵니다.',
        eligibility: {},
        choices: [
            {
                id: 'unseal-library',
                label: '문양을 풀어 서고를 연다',
                tradeoff: '기력 50을 들여 마나 결정 1개를 확보합니다.',
                cost: {
                    mp: 50,
                },
                outcome: {
                    item: '마나 결정',
                    result: '문양이 풀린 서고 안에서 마나 결정 1개를 찾았습니다.',
                },
            },
            {
                id: 'copy-margin-notes',
                label: '문 밖의 낙서만 베껴 적는다',
                tradeoff: '안전하게 기력 60을 되찾습니다.',
                outcome: {
                    mp: 60,
                    result: '옛 마법사의 낙서를 따라 숨을 고르며 기력 60을 되찾았습니다.',
                },
            },
        ],
    },
    {
        id: 'tower-curse-ward',
        version: 1,
        region: '고대 마법 탑',
        family: '저주받은 계단',
        situation: '탑의 계단 한 칸마다 검은 저주의 글씨가 새겨져 있습니다. 대마도사의 저주가 여기서 시작된 듯합니다.',
        eligibility: {},
        choices: [
            {
                id: 'scrape-curse-glyph',
                label: '저주 글씨를 긁어낸다',
                tradeoff: '생명 100을 감수하고 저주해제 주문서 1개를 만듭니다.',
                cost: {
                    hp: 100,
                },
                outcome: {
                    item: '저주해제 주문서',
                    result: '저주에 손을 데이며 긁어낸 글씨로 저주해제 주문서 1개를 만들었습니다.',
                },
            },
            {
                id: 'step-around-glyph',
                label: '글씨를 피해 조심히 오른다',
                tradeoff: '안전하게 골드 180을 줍습니다.',
                outcome: {
                    gold: 180,
                    result: '계단 모서리에 떨어진 골드 180을 주워 들었습니다.',
                },
            },
        ],
    },
    {
        id: 'tower-mana-wellspring',
        version: 1,
        region: '고대 마법 탑',
        family: '넘치는 마력 샘',
        situation: '지금의 비전 기운에 탑 중층의 마력 샘이 크게 출렁입니다. 물결이 장비와 유물의 마력에 맞춰 일렁입니다.',
        eligibility: {
            anyBuildTags: ['arcane'],
        },
        choices: [
            {
                id: 'drink-wellspring',
                label: '샘의 마력을 들이켠다',
                tradeoff: '생명 100을 감수하고 다음 전투의 공격을 크게 끌어올립니다.',
                cost: {
                    hp: 100,
                },
                outcome: {
                    buff: {
                        name: '넘치는 마력',
                        atk: 0.25,
                        turn: 3,
                    },
                    result: '넘치는 마력이 몸을 채워 다음 전투의 공격이 크게 강해집니다.',
                },
            },
            {
                id: 'bottle-wellspring',
                label: '샘물을 병에 담는다',
                tradeoff: '기력 50을 들여 중급 마나 물약 1개를 확보합니다.',
                cost: {
                    mp: 50,
                },
                outcome: {
                    item: '중급 마나 물약',
                    result: '마력이 녹은 샘물을 담아 중급 마나 물약 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'tower-last-ward',
        version: 1,
        region: '고대 마법 탑',
        family: '마지막 수호진',
        situation: '쓰러지기 직전의 몸 아래로 탑 바닥의 수호진이 희미하게 깨어납니다. 남은 힘을 어디에 실을지 정해야 합니다.',
        eligibility: {
            hpBand: 'critical',
        },
        choices: [
            {
                id: 'kneel-in-ward',
                label: '수호진 안에 무릎을 꿇는다',
                tradeoff: '기력 50을 들여 생명 150을 회복합니다.',
                cost: {
                    mp: 50,
                },
                outcome: {
                    hp: 150,
                    result: '수호진의 빛이 상처를 메워 생명 150을 회복했습니다.',
                },
            },
            {
                id: 'bind-ward-to-armor',
                label: '수호진을 갑옷에 옮겨 새긴다',
                tradeoff: '기력 50을 들여 다음 전투의 방어를 크게 끌어올립니다.',
                cost: {
                    mp: 50,
                },
                outcome: {
                    buff: {
                        name: '옮겨 새긴 수호진',
                        def: 0.25,
                        turn: 3,
                    },
                    result: '갑옷에 옮겨 새긴 수호진이 다음 전투의 방어를 크게 지켜 줍니다.',
                },
            },
        ],
    },
    {
        id: 'nest-shed-scales',
        version: 1,
        region: '용의 둥지',
        family: '벗겨진 비늘 더미',
        situation: '용의 둥지 바위틈에 갓 벗겨진 붉은 비늘이 쌓여 있습니다. 아직 열기가 식지 않았습니다.',
        eligibility: {},
        choices: [
            {
                id: 'grab-hot-scale',
                label: '뜨거운 비늘을 그대로 집는다',
                tradeoff: '생명 140을 감수하고 용의 비늘 1개를 확보합니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    item: '용의 비늘',
                    result: '손이 데는 것을 참고 용의 비늘 1개를 챙겼습니다.',
                },
            },
            {
                id: 'wait-scale-cool',
                label: '식기를 기다려 부스러기만 줍는다',
                tradeoff: '안전하게 골드 180을 챙깁니다.',
                outcome: {
                    gold: 180,
                    result: '식은 비늘 부스러기를 팔 만큼 모아 골드 180을 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'nest-ember-hollow',
        version: 1,
        region: '용의 둥지',
        family: '잉걸불 웅덩이',
        situation: '둥지 아래 움푹 꺼진 자리에 용의 숨결이 남긴 잉걸불이 고여 있습니다. 화상을 다스리는 재가 함께 굳어 있습니다.',
        eligibility: {},
        choices: [
            {
                id: 'gather-cooling-ash',
                label: '굳은 재를 긁어모은다',
                tradeoff: '기력 70을 들여 치료약 1개를 만듭니다.',
                cost: {
                    mp: 70,
                },
                outcome: {
                    item: '치료약',
                    result: '굳은 재를 갈아 화상을 다스리는 치료약 1개를 만들었습니다.',
                },
            },
            {
                id: 'temper-in-embers',
                label: '잉걸불에 무기를 달군다',
                tradeoff: '생명 140을 감수하고 다음 전투의 공격을 크게 끌어올립니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    buff: {
                        name: '잉걸불의 담금질',
                        atk: 0.25,
                        turn: 3,
                    },
                    result: '달군 날이 붉게 빛나 다음 전투의 공격이 크게 강해집니다.',
                },
            },
        ],
    },
    {
        id: 'nest-wyvern-roost',
        version: 1,
        region: '용의 둥지',
        family: '와이번의 쉼터',
        situation: '상처를 안고 숨어든 바위 그늘이 와이번의 빈 쉼터였습니다. 둥지의 온기가 아직 남아 있습니다.',
        eligibility: {
            hpBand: 'strained',
        },
        choices: [
            {
                id: 'rest-in-roost',
                label: '온기 속에서 잠시 쉰다',
                tradeoff: '기력 70을 들여 생명 200을 회복합니다.',
                cost: {
                    mp: 70,
                },
                outcome: {
                    hp: 200,
                    result: '쉼터의 온기에 몸을 맡겨 생명 200을 회복했습니다.',
                },
            },
            {
                id: 'pluck-roost-wing',
                label: '버려진 날개 조각을 챙긴다',
                tradeoff: '생명 70을 감수하고 와이번 날개 1개를 확보합니다.',
                cost: {
                    hp: 70,
                },
                outcome: {
                    item: '와이번 날개',
                    result: '날카로운 뼈에 긁히며 와이번 날개 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'nest-red-dragon-hoard',
        version: 1,
        region: '용의 둥지',
        family: '붉은 용의 보물 자리',
        situation: '레드 드래곤을 쓰러뜨린 기억을 따라가자 그 용이 지키던 보물 자리가 드러납니다. 녹아내린 금과 굳은 심장 조각이 뒤섞여 있습니다.',
        eligibility: {
            previousBoss: '레드 드래곤',
        },
        choices: [
            {
                id: 'melt-hoard-gold',
                label: '녹아 붙은 금을 떼어 낸다',
                tradeoff: '생명 140을 감수하고 골드 300을 챙깁니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    gold: 300,
                    result: '뜨거운 금덩이를 떼어 내 골드 300을 챙겼습니다.',
                },
            },
            {
                id: 'claim-heart-shard',
                label: '굳은 심장 조각을 거둔다',
                tradeoff: '기력 70을 들여 화염의 결정 1개를 확보합니다.',
                cost: {
                    mp: 70,
                },
                outcome: {
                    item: '화염의 결정',
                    result: '용의 열기가 굳은 조각에서 화염의 결정 1개를 거뒀습니다.',
                },
            },
        ],
    },
    {
        id: 'machine-repair-bay',
        version: 1,
        region: '기계 폐도',
        family: '멈춘 정비소',
        situation: '기계 폐도의 정비소에 반쯤 조립된 자동인형이 걸려 있습니다. 심장부의 코어가 아직 희미하게 돕니다.',
        eligibility: {},
        choices: [
            {
                id: 'extract-core',
                label: '코어를 억지로 뽑아낸다',
                tradeoff: '생명 140을 감수하고 기계 코어 1개를 확보합니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    item: '기계 코어',
                    result: '튀는 전류를 견디며 기계 코어 1개를 뽑아냈습니다.',
                },
            },
            {
                id: 'scrap-bay-parts',
                label: '선반의 부품만 팔 만큼 챙긴다',
                tradeoff: '안전하게 골드 200을 챙깁니다.',
                outcome: {
                    gold: 200,
                    result: '정비소 선반의 부품을 모아 골드 200을 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'machine-coolant-pipe',
        version: 1,
        region: '기계 폐도',
        family: '새는 냉각관',
        situation: '폐도의 굵은 냉각관에서 차가운 액체가 새어 나옵니다. 과열된 포격기의 열기를 식혀 온 관입니다.',
        eligibility: {},
        choices: [
            {
                id: 'cool-wounds',
                label: '냉각액으로 화상을 식힌다',
                tradeoff: '기력 70을 들여 생명 220을 회복합니다.',
                cost: {
                    mp: 70,
                },
                outcome: {
                    hp: 220,
                    result: '차가운 냉각액이 열기를 가라앉혀 생명 220을 회복했습니다.',
                },
            },
            {
                id: 'bottle-coolant',
                label: '냉각액을 약병에 받아 둔다',
                tradeoff: '생명 70을 감수하고 치료약 1개를 만듭니다.',
                cost: {
                    hp: 70,
                },
                outcome: {
                    item: '치료약',
                    result: '뜨거운 관에 손을 데며 받은 냉각액으로 치료약 1개를 만들었습니다.',
                },
            },
        ],
    },
    {
        id: 'machine-overclock-rig',
        version: 1,
        region: '기계 폐도',
        family: '과부하 장치',
        situation: '지금의 거친 싸움 방식이 폐도의 과부하 장치와 맞물립니다. 레버를 당기면 무기에 전류가 실립니다.',
        eligibility: {
            anyBuildTags: ['crusher', 'dual'],
        },
        choices: [
            {
                id: 'overclock-weapon',
                label: '레버를 끝까지 당긴다',
                tradeoff: '생명 140을 감수하고 다음 전투의 공격을 크게 끌어올립니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    buff: {
                        name: '과부하 전류',
                        atk: 0.25,
                        turn: 3,
                    },
                    result: '무기에 실린 전류가 다음 전투의 공격을 크게 끌어올립니다.',
                },
            },
            {
                id: 'stabilize-rig',
                label: '장치를 안정시켜 보호막을 켠다',
                tradeoff: '기력 70을 들여 다음 전투의 공격과 방어를 함께 다듬습니다.',
                cost: {
                    mp: 70,
                },
                outcome: {
                    buff: {
                        name: '안정된 보호막',
                        atk: 0.1,
                        def: 0.1,
                        turn: 3,
                    },
                    result: '안정된 보호막이 다음 전투의 공격과 방어를 함께 다듬어 줍니다.',
                },
            },
        ],
    },
    {
        id: 'machine-prototype-blueprint',
        version: 1,
        region: '기계 폐도',
        family: '프로토타입 설계도',
        situation: '프로토타입 제로를 멈춰 세운 기억이 폐도의 제어실 문을 엽니다. 남은 설계도와 미스릴 틀이 책상 위에 흩어져 있습니다.',
        eligibility: {
            previousBoss: '프로토타입 제로',
        },
        choices: [
            {
                id: 'study-blueprint',
                label: '설계도의 약점 표시를 읽는다',
                tradeoff: '기력 70을 들여 다음 전투의 공격을 끌어올립니다.',
                cost: {
                    mp: 70,
                },
                outcome: {
                    buff: {
                        name: '설계도의 약점',
                        atk: 0.2,
                        turn: 3,
                    },
                    result: '설계도의 약점 표시를 익혀 다음 전투의 공격이 강해집니다.',
                },
            },
            {
                id: 'pry-mithril-frame',
                label: '미스릴 틀을 뜯어낸다',
                tradeoff: '생명 140을 감수하고 미스릴 원석 1개를 확보합니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    item: '미스릴 원석',
                    result: '단단한 틀을 비틀어 미스릴 원석 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'lava-cooling-crust',
        version: 1,
        region: '용암 지대',
        family: '굳어 가는 용암 껍질',
        situation: '용암 지대의 흐름 한쪽이 검게 굳어 가고 있습니다. 껍질 아래로 붉은 핵이 아직 맥박칩니다.',
        eligibility: {},
        choices: [
            {
                id: 'break-lava-crust',
                label: '껍질을 깨고 핵을 꺼낸다',
                tradeoff: '생명 210을 감수하고 용암 핵 1개를 확보합니다.',
                cost: {
                    hp: 210,
                },
                outcome: {
                    item: '용암 핵',
                    result: '솟구치는 열기를 견디며 용암 핵 1개를 꺼냈습니다.',
                },
            },
            {
                id: 'skirt-lava-crust',
                label: '굳은 가장자리만 걷어 간다',
                tradeoff: '안전하게 골드 250을 챙깁니다.',
                outcome: {
                    gold: 250,
                    result: '굳은 가장자리에 박힌 광물을 팔 만큼 모아 골드 250을 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'lava-ash-spring',
        version: 1,
        region: '용암 지대',
        family: '재 덮인 온천',
        situation: '화산재가 내려앉은 바위 사이로 따뜻한 물이 솟습니다. 용암 지대에서 드물게 숨을 돌릴 수 있는 자리입니다.',
        eligibility: {},
        choices: [
            {
                id: 'soak-ash-spring',
                label: '온천에 몸을 담근다',
                tradeoff: '기력 80을 들여 생명 320을 회복합니다.',
                cost: {
                    mp: 80,
                },
                outcome: {
                    hp: 320,
                    result: '따뜻한 물이 화상을 달래 생명 320을 회복했습니다.',
                },
            },
            {
                id: 'scoop-spring-ash',
                label: '바닥의 재를 떠 둔다',
                tradeoff: '아무것도 내지 않고 치료약 1개를 만듭니다.',
                outcome: {
                    item: '치료약',
                    result: '온천 바닥의 재를 갈아 치료약 1개를 만들었습니다.',
                },
            },
        ],
    },
    {
        id: 'lava-giant-footprint',
        version: 1,
        region: '용암 지대',
        family: '용암 거인의 발자국',
        situation: '몸 상태가 좋을 때만 쫓아갈 수 있는 용암 거인의 깊은 발자국이 이어집니다. 끝에는 녹은 광맥이 드러나 있습니다.',
        eligibility: {
            hpBand: 'healthy',
        },
        choices: [
            {
                id: 'follow-footprint',
                label: '발자국 끝까지 쫓아간다',
                tradeoff: '생명 210을 감수하고 강화 재료 1개를 확보합니다.',
                cost: {
                    hp: 210,
                },
                outcome: {
                    item: '강화 재료',
                    result: '녹은 광맥을 파헤쳐 강화 재료 1개를 챙겼습니다.',
                },
            },
            {
                id: 'read-footprint-rhythm',
                label: '발자국의 박자를 몸에 익힌다',
                tradeoff: '기력 80을 들여 다음 전투의 공격을 끌어올립니다.',
                cost: {
                    mp: 80,
                },
                outcome: {
                    buff: {
                        name: '거인의 박자',
                        atk: 0.2,
                        turn: 3,
                    },
                    result: '거인의 묵직한 박자를 익혀 다음 전투의 공격이 강해집니다.',
                },
            },
        ],
    },
    {
        id: 'lava-obsidian-bulwark',
        version: 1,
        region: '용암 지대',
        family: '흑요석 방벽',
        situation: '지금 쌓아 온 단단한 방어가 용암 지대의 흑요석 방벽과 공명합니다. 검은 유리가 몸의 윤곽을 따라 빛납니다.',
        eligibility: {
            anyBuildTags: ['fortress'],
        },
        choices: [
            {
                id: 'absorb-obsidian',
                label: '방벽의 단단함을 받아들인다',
                tradeoff: '기력 80을 들여 다음 전투의 방어를 크게 끌어올립니다.',
                cost: {
                    mp: 80,
                },
                outcome: {
                    buff: {
                        name: '흑요석의 피부',
                        def: 0.25,
                        turn: 3,
                    },
                    result: '흑요석의 단단함이 스며 다음 전투의 방어가 크게 강해집니다.',
                },
            },
            {
                id: 'chip-obsidian',
                label: '흑요석 조각을 떼어 낸다',
                tradeoff: '생명 140을 감수하고 오리할콘 1개를 확보합니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    item: '오리할콘',
                    result: '방벽 속에 박혀 있던 오리할콘 1개를 떼어 냈습니다.',
                },
            },
        ],
    },
    {
        id: 'sky-falling-crystal',
        version: 1,
        region: '천공 정원',
        family: '떨어지는 수정 조각',
        situation: '천공 정원의 부서진 테라스에서 빛나는 수정 조각이 구름 아래로 떨어지고 있습니다. 가장자리까지 몸을 내밀어야 닿습니다.',
        eligibility: {},
        choices: [
            {
                id: 'lunge-for-crystal',
                label: '가장자리로 몸을 날린다',
                tradeoff: '생명 230을 감수하고 천공 결정 1개를 확보합니다.',
                cost: {
                    hp: 230,
                },
                outcome: {
                    item: '천공 결정',
                    result: '난간에 몸을 부딪치며 천공 결정 1개를 붙잡았습니다.',
                },
            },
            {
                id: 'collect-fallen-shards',
                label: '테라스에 떨어진 조각만 줍는다',
                tradeoff: '안전하게 골드 280을 챙깁니다.',
                outcome: {
                    gold: 280,
                    result: '테라스 바닥의 작은 조각을 모아 골드 280을 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'sky-storm-chime',
        version: 1,
        region: '천공 정원',
        family: '폭풍의 풍경',
        situation: '정원의 기둥에 매달린 풍경이 다가오는 폭풍에 맞춰 울립니다. 소리가 귀를 울릴 때마다 몸이 굳어 갑니다.',
        eligibility: {},
        choices: [
            {
                id: 'tune-storm-chime',
                label: '풍경 소리에 호흡을 맞춘다',
                tradeoff: '기력 100을 들여 다음 전투의 공격과 방어를 함께 다듬습니다.',
                cost: {
                    mp: 100,
                },
                outcome: {
                    buff: {
                        name: '폭풍의 호흡',
                        atk: 0.12,
                        def: 0.12,
                        turn: 3,
                    },
                    result: '폭풍의 박자에 호흡을 맞춰 다음 전투의 공격과 방어가 함께 강해집니다.',
                },
            },
            {
                id: 'cut-storm-chime',
                label: '풍경을 끊어 낸다',
                tradeoff: '생명 150을 감수하고 폭풍 정수 1개를 확보합니다.',
                cost: {
                    hp: 150,
                },
                outcome: {
                    item: '폭풍 정수',
                    result: '번개에 손이 저리며 풍경 속의 폭풍 정수 1개를 거뒀습니다.',
                },
            },
        ],
    },
    {
        id: 'sky-hidden-perch',
        version: 1,
        region: '천공 정원',
        family: '숨은 횃대',
        situation: '그림자에 익숙한 눈에 정원 위 높은 횃대가 들어옵니다. 감시자들의 눈을 피해 정원 전체가 내려다보이는 자리입니다.',
        eligibility: {
            lineage: ['도적', '어쌔신', '레인저', '그림자 주군', '사냥의 군주'],
        },
        choices: [
            {
                id: 'mark-sky-targets',
                label: '높은 곳에서 표적을 정해 둔다',
                tradeoff: '기력 100을 들여 다음 전투의 공격을 크게 끌어올립니다.',
                cost: {
                    mp: 100,
                },
                outcome: {
                    buff: {
                        name: '횃대의 표적',
                        atk: 0.25,
                        turn: 3,
                    },
                    result: '표적을 미리 정해 두어 다음 전투의 공격이 크게 강해집니다.',
                },
            },
            {
                id: 'lift-sentinel-cache',
                label: '감시자의 보관함을 턴다',
                tradeoff: '생명 150을 감수하고 상급 체력 물약 1개를 챙깁니다.',
                cost: {
                    hp: 150,
                },
                outcome: {
                    item: '상급 체력 물약',
                    result: '들킬 뻔한 끝에 보관함에서 상급 체력 물약 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'sky-dew-garden',
        version: 1,
        region: '천공 정원',
        family: '구름 이슬 화단',
        situation: '상처를 안고 숨어든 화단에 구름 이슬이 맺혀 있습니다. 하늘 정령이 가꾸던 꽃이 아직 시들지 않았습니다.',
        eligibility: {
            hpBand: 'strained',
        },
        choices: [
            {
                id: 'drink-cloud-dew',
                label: '맺힌 이슬을 받아 마신다',
                tradeoff: '기력 100을 들여 생명 350을 회복합니다.',
                cost: {
                    mp: 100,
                },
                outcome: {
                    hp: 350,
                    result: '구름 이슬이 몸을 적셔 생명 350을 회복했습니다.',
                },
            },
            {
                id: 'pick-sky-blossom',
                label: '정령의 꽃을 꺾어 간다',
                tradeoff: '아무것도 내지 않고 상급 마나 물약 1개를 챙깁니다.',
                outcome: {
                    item: '상급 마나 물약',
                    result: '꽃잎을 우려 상급 마나 물약 1개를 만들었습니다.',
                },
            },
        ],
    },
    {
        id: 'dungeon-chain-vault',
        version: 1,
        region: '어둠의 지하 감옥',
        family: '사슬 걸린 금고',
        situation: '어둠의 지하 감옥 간수실 벽에 사슬로 감긴 금고가 박혀 있습니다. 사슬마다 어둠의 기운이 배어 있습니다.',
        eligibility: {},
        choices: [
            {
                id: 'break-vault-chains',
                label: '사슬을 끊어 금고를 연다',
                tradeoff: '생명 170을 감수하고 어둠의 정수 1개를 확보합니다.',
                cost: {
                    hp: 170,
                },
                outcome: {
                    item: '어둠의 정수',
                    result: '사슬의 기운에 베이며 금고 속 어둠의 정수 1개를 꺼냈습니다.',
                },
            },
            {
                id: 'pick-vault-lock',
                label: '자물쇠만 조심히 비튼다',
                tradeoff: '안전하게 골드 290을 챙깁니다.',
                outcome: {
                    gold: 290,
                    result: '자물쇠를 비틀어 연 틈에서 골드 290을 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'dungeon-prisoner-tally',
        version: 1,
        region: '어둠의 지하 감옥',
        family: '죄수의 눈금',
        situation: '감옥 벽에 먼저 갇혔던 용사들이 남긴 눈금이 빼곡합니다. 마지막 눈금 옆에 무언가 숨겨 둔 흔적이 있습니다.',
        eligibility: {},
        choices: [
            {
                id: 'honor-prisoner-tally',
                label: '눈금 앞에서 결의를 다진다',
                tradeoff: '기력 90을 들여 다음 전투의 방어를 단단히 합니다.',
                cost: {
                    mp: 90,
                },
                outcome: {
                    buff: {
                        name: '갇힌 용사의 결의',
                        def: 0.22,
                        turn: 3,
                    },
                    result: '먼저 간 용사들의 결의가 다음 전투의 방어를 단단히 합니다.',
                },
            },
            {
                id: 'dig-behind-tally',
                label: '마지막 눈금 뒤를 파낸다',
                tradeoff: '생명 120을 감수하고 상급 체력 물약 1개를 챙깁니다.',
                cost: {
                    hp: 120,
                },
                outcome: {
                    item: '상급 체력 물약',
                    result: '벽돌을 파내 숨겨져 있던 상급 체력 물약 1개를 찾았습니다.',
                },
            },
        ],
    },
    {
        id: 'dungeon-engraved-cell',
        version: 1,
        region: '어둠의 지하 감옥',
        family: '각인이 깨운 독방',
        situation: '한 번 발견한 고유 장비의 각인이 감옥 깊은 독방의 문양에 반응합니다. 굳게 닫혀 있던 문이 저절로 열립니다.',
        eligibility: {
            requiresSignature: true,
        },
        choices: [
            {
                id: 'answer-cell-engraving',
                label: '독방의 문양에 각인을 맞춘다',
                tradeoff: '기력 90을 들여 다음 전투의 공격과 방어를 함께 다듬습니다.',
                cost: {
                    mp: 90,
                },
                outcome: {
                    buff: {
                        name: '독방의 공명',
                        atk: 0.12,
                        def: 0.12,
                        turn: 3,
                    },
                    result: '독방의 문양이 각인과 공명해 다음 전투의 공격과 방어가 함께 강해집니다.',
                },
            },
            {
                id: 'loot-engraved-cell',
                label: '독방에 남은 조각을 거둔다',
                tradeoff: '생명 170을 감수하고 강화 재료 1개를 확보합니다.',
                cost: {
                    hp: 170,
                },
                outcome: {
                    item: '강화 재료',
                    result: '독방 바닥의 각인 조각을 다듬어 강화 재료 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'dungeon-chapel-ruin',
        version: 1,
        region: '어둠의 지하 감옥',
        family: '무너진 기도실',
        situation: '신성한 힘을 다루는 손끝에 감옥 안쪽의 무너진 기도실이 응답합니다. 깨진 제단에 성수가 아직 고여 있습니다.',
        eligibility: {
            lineage: ['성직자', '팔라딘', '무당', '시간술사'],
        },
        choices: [
            {
                id: 'purify-chapel',
                label: '제단을 정화하고 기도한다',
                tradeoff: '기력 90을 들여 생명 260을 회복합니다.',
                cost: {
                    mp: 90,
                },
                outcome: {
                    hp: 260,
                    result: '정화된 제단의 빛이 몸을 감싸 생명 260을 회복했습니다.',
                },
            },
            {
                id: 'collect-chapel-water',
                label: '고인 성수를 떠 간다',
                tradeoff: '생명 120을 감수하고 성수 1개를 확보합니다.',
                cost: {
                    hp: 120,
                },
                outcome: {
                    item: '성수',
                    result: '어둠에 시달리며 고인 성수 1개를 떠 왔습니다.',
                },
            },
        ],
    },
    {
        id: 'maze-trap-cache',
        version: 1,
        region: '지하 미궁',
        family: '함정 너머의 상자',
        situation: '지하 미궁의 막다른 길 끝에 상자 하나가 놓여 있습니다. 바닥의 돌판 몇 개가 미묘하게 떠 있습니다.',
        eligibility: {},
        choices: [
            {
                id: 'spring-trap-cache',
                label: '함정을 밟고 상자로 달려간다',
                tradeoff: '생명 280을 감수하고 강화 재료 1개를 확보합니다.',
                cost: {
                    hp: 280,
                },
                outcome: {
                    item: '강화 재료',
                    result: '쏟아지는 칼날을 견디며 상자 속 강화 재료 1개를 챙겼습니다.',
                },
            },
            {
                id: 'disarm-trap-cache',
                label: '돌판을 하나씩 짚어 해제한다',
                tradeoff: '기력 180을 들여 골드 300을 챙깁니다.',
                cost: {
                    mp: 180,
                },
                outcome: {
                    gold: 300,
                    result: '함정을 모두 풀고 상자에서 골드 300을 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'maze-centipede-den',
        version: 1,
        region: '지하 미궁',
        family: '독 지네의 굴',
        situation: '미궁 벽의 갈라진 틈에서 독 지네가 벗어 둔 껍질과 독샘이 보입니다. 굴 안쪽은 독기로 뿌옇습니다.',
        eligibility: {},
        choices: [
            {
                id: 'milk-venom-gland',
                label: '독샘을 짜 해독제를 만든다',
                tradeoff: '생명 140을 감수하고 해독제 1개를 만듭니다.',
                cost: {
                    hp: 140,
                },
                outcome: {
                    item: '해독제',
                    result: '독기에 숨이 막히며 짜낸 독으로 해독제 1개를 만들었습니다.',
                },
            },
            {
                id: 'coat-blade-venom',
                label: '독을 무기에 바른다',
                tradeoff: '기력 180을 들여 다음 전투의 공격을 크게 끌어올립니다.',
                cost: {
                    mp: 180,
                },
                outcome: {
                    buff: {
                        name: '지네 독날',
                        atk: 0.25,
                        turn: 3,
                    },
                    result: '독이 밴 날이 다음 전투의 공격을 크게 끌어올립니다.',
                },
            },
        ],
    },
    {
        id: 'maze-dead-end-shrine',
        version: 1,
        region: '지하 미궁',
        family: '막다른 길의 사당',
        situation: '쓰러지기 직전에 들어선 막다른 길에 작은 사당이 있습니다. 길을 잃은 모험가들이 남긴 물약이 제단에 놓여 있습니다.',
        eligibility: {
            hpBand: 'critical',
        },
        choices: [
            {
                id: 'pray-dead-end',
                label: '사당에 기대어 숨을 고른다',
                tradeoff: '기력 180을 들여 생명 500을 회복합니다.',
                cost: {
                    mp: 180,
                },
                outcome: {
                    hp: 500,
                    result: '사당의 고요함 속에서 생명 500을 회복했습니다.',
                },
            },
            {
                id: 'take-shrine-potion',
                label: '제단의 물약을 집어 든다',
                tradeoff: '아무것도 내지 않고 상급 체력 물약 1개를 챙깁니다.',
                outcome: {
                    item: '상급 체력 물약',
                    result: '먼저 간 모험가가 남긴 상급 체력 물약 1개를 챙겼습니다.',
                },
            },
        ],
    },
    {
        id: 'maze-avenger-grave',
        version: 1,
        region: '지하 미궁',
        family: '원한의 무덤길',
        situation: '원한의 용사를 쓰러뜨린 기억에 미궁의 한 갈래가 조용해집니다. 그가 지키던 무덤길 끝에 남은 유품이 놓여 있습니다.',
        eligibility: {
            previousBoss: '원한의 용사',
        },
        choices: [
            {
                id: 'lay-avenger-to-rest',
                label: '유품을 거두어 넋을 달랜다',
                tradeoff: '기력 180을 들여 다음 전투의 공격과 방어를 함께 다듬습니다.',
                cost: {
                    mp: 180,
                },
                outcome: {
                    buff: {
                        name: '달래진 원한',
                        atk: 0.12,
                        def: 0.12,
                        turn: 3,
                    },
                    result: '넋을 달랜 고요함이 다음 전투의 공격과 방어를 함께 다듬어 줍니다.',
                },
            },
            {
                id: 'claim-avenger-relic',
                label: '유품을 그대로 챙긴다',
                tradeoff: '생명 280을 감수하고 엘릭서 1개를 확보합니다.',
                cost: {
                    hp: 280,
                },
                outcome: {
                    item: '엘릭서',
                    result: '남은 원한에 시달리며 엘릭서 1개를 챙겼습니다.',
                },
            },
        ],
    },
]);
