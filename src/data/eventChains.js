/**
 * eventChains.js — Sprint 17 내러티브 이벤트 체인 (3종)
 *
 * 각 체인은 { id, steps[] } 형태이며, step은 loc(발동 위치), step(단계 번호),
 * event(SET_EVENT payload) 구조를 가집니다.
 *
 * player.eventChainProgress[chainId] 값이 step 번호를 추적합니다.
 * 0 = 미시작, 1 = 1단계 완료, 2 = 2단계 완료, 3 = 완료
 */

export const EVENT_CHAINS = [
    {
        id: 'ancient_prophecy',
        label: '고대의 예언',
        steps: [
            {
                step: 0,
                loc: '어둠의 동굴',
                event: {
                    title: '예언의 돌판',
                    desc: '동굴 깊은 곳에서 고대 문자가 새겨진 돌판을 발견했습니다. "세 개의 파편이 모이면, 원시의 문이 열리리라..."',
                    choices: ['돌판을 면밀히 조사한다', '그냥 지나친다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'ancient_prophecy', log: '예언의 내용이 머릿속에 새겨졌습니다. 무언가 큰 것의 존재를 느낍니다.', reward: null },
                        { type: 'nothing', log: '지나치기엔 찜찜하지만... 일단 무시했습니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '고대 마법 탑',
                event: {
                    title: '예언 해독사',
                    desc: '탑 안에서 예언의 학자 노인을 만났습니다. "당신이 돌판을 보셨군요. 원시의 파편을 3개 모아 마왕을 세 번 이상 쓰러뜨리면... 진짜가 나타납니다."',
                    choices: ['학자의 말에 귀 기울인다', '시간이 없다, 돌아간다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'ancient_prophecy', log: '진실에 한 발짝 다가섰습니다. 파편 수집의 방법을 알게 되었습니다.', reward: { type: 'info', text: '원시의 파편: 프레스티지 후 마왕 처치 시 40% 확률로 획득' } },
                        { type: 'nothing', log: '무언가 중요한 것을 놓쳤을지도 모릅니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '에테르 관문',
                event: {
                    title: '원시의 문',
                    desc: '관문 한켠에 거대한 봉인된 문이 있습니다. 문에서 강렬한 에너지가 느껴집니다. 파편 3개가 여기서 힘을 방출하면 문이 열릴 것 같습니다.',
                    choices: ['문을 경건히 살펴본다', '손을 댄다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'ancient_prophecy', log: '원시의 힘이 당신을 인정했습니다. 유물 하나가 발광하며 나타납니다.', reward: { type: 'relic' } },
                        { type: 'chain_advance', chainId: 'ancient_prophecy', log: '문에서 강렬한 충격이 느껴졌습니다. 하지만 무언가를 얻었습니다.', reward: { type: 'relic' } },
                    ],
                },
            },
        ],
    },

    {
        id: 'lost_wizard',
        label: '사라진 마법사',
        steps: [
            {
                step: 0,
                loc: '고요한 숲',
                event: {
                    title: '마법의 흔적',
                    desc: '숲 한가운데에서 이상한 마법 연기가 피어오릅니다. 주변에는 불에 탄 흔적과 지팡이 파편이 있습니다.',
                    choices: ['흔적을 조사한다', '위험할 수 있다, 무시한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'lost_wizard', log: '마법사의 것으로 보이는 단서를 발견했습니다. 수정 동굴 방향으로 이어집니다.', reward: null },
                        { type: 'nothing', log: '그냥 지나쳤습니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '수정 동굴',
                event: {
                    title: '마법사의 일기장',
                    desc: '수정에 끼인 낡은 일기장을 발견했습니다. "...나는 천공 정원에 있다. 새로운 마법을 찾아서. 하지만 무언가가 나를 따라오고 있다..."',
                    choices: ['일기장을 가져간다', '그 자리에 남겨둔다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'lost_wizard', log: '일기장을 챙겼습니다. 천공 정원에서 마법사를 찾을 수 있을 것 같습니다.', reward: null },
                        { type: 'nothing', log: '일기장을 남겨두고 왔습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '천공 정원',
                event: {
                    title: '마법사의 환영',
                    desc: '정원에서 마법사의 환영이 나타납니다. "당신이 내 일기장을 가져왔군요. 하지만... 이 자리를 떠날 수 없습니다. 나를 대신해 이 마법서를 써주세요."',
                    choices: ['전투를 받아들인다 (전설 보상)', '거절한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'lost_wizard', log: '환영을 물리쳤습니다. 전설의 마법서를 얻었습니다!', reward: { type: 'legendary_item', name: '전설의 마법서', itemType: 'weapon' } },
                        { type: 'nothing', log: '거절했습니다. 마법사의 환영이 사라집니다.', reward: null },
                    ],
                },
            },
        ],
    },

    {
        id: 'last_hero',
        label: '최후의 영웅',
        steps: [
            {
                step: 0,
                loc: '서쪽 평원',
                event: {
                    title: '죽어가는 기사',
                    desc: '평원에서 중상을 입은 기사를 발견했습니다. "제... 제발... 마왕을 막아주세요. 제가 혼자서는..." 기사가 쓰러집니다. 치료에는 골드 300이 필요합니다.',
                    choices: ['치료한다 (골드 -300)', '어쩔 수 없다, 지나친다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'last_hero', log: '기사를 치료했습니다. 기사가 당신을 기억할 것입니다.', reward: { type: 'gold', amount: -300 } },
                        { type: 'chain_advance_fail', chainId: 'last_hero', log: '기사를 두고 지나쳤습니다. 기사의 검은 다시 찾을 수 없을 것입니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '화염의 협곡',
                event: {
                    title: '기사의 검',
                    desc: '협곡 어딘가에서 빛나는 검이 박혀 있습니다. "이 검은... 당신이 구해준 그 기사의 검이군요." 아이템이 당신을 기다리고 있습니다.',
                    choices: ['검을 뽑아낸다', '그대로 둔다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'last_hero', log: '기사의 검을 획득했습니다. 강력한 힘이 느껴집니다.', reward: { type: 'item', name: '기사의 유검', itemType: 'weapon', tier: 4 } },
                        { type: 'nothing', log: '검을 두고 왔습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '암흑 성',
                event: {
                    title: '기사의 혼령',
                    desc: '암흑 성 입구에서 기사의 혼령이 나타납니다. "당신이 나를 구해줬군요. 이번 싸움에서는 내가 당신을 돕겠습니다." 혼령이 당신과 합류합니다.',
                    choices: ['혼령을 받아들인다', '혼자 싸우겠다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'last_hero', log: '기사의 혼령이 합류! 이번 전투에서 추가 피해 보너스를 얻습니다.', reward: { type: 'combat_bonus', atkMult: 1.3, duration: 5 } },
                        { type: 'nothing', log: '혼령은 사라졌습니다.', reward: null },
                    ],
                },
            },
        ],
    },
    // ── 체인 4: 그림자 길드 ────────────────────────────────────────────────────
    {
        id: 'shadow_guild',
        label: '그림자 길드',
        steps: [
            {
                step: 0,
                loc: '잊혀진 폐허',
                event: {
                    title: '수상한 표식',
                    desc: '폐허 기둥 아래에 그림자 형상의 표식이 새겨져 있습니다. 지하 세계 조직의 암호 같습니다. 최근에 새겨진 것으로 보입니다.',
                    choices: ['표식을 해독한다', '무시한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'shadow_guild', log: '그림자 길드의 흔적을 발견했습니다. 암시장이 근처 동굴에 있는 것 같습니다.', reward: null },
                        { type: 'nothing', log: '그냥 지나쳤습니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '어둠의 동굴',
                event: {
                    title: '암시장 접선',
                    desc: '동굴 깊은 곳에서 복면을 쓴 상인을 만났습니다. "표식을 알고 왔다면... 특별한 물건이 있소. 하지만 공짜는 없지." 그는 희귀 유물을 2000G에 제시합니다.',
                    choices: ['거래한다 (2000G)', '거절하고 정보만 얻는다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'shadow_guild', log: '거래를 완료했습니다. 그림자 길드와 신뢰가 쌓였습니다.', reward: { type: 'gold', amount: -2000 } },
                        { type: 'chain_advance', chainId: 'shadow_guild', log: '정보를 얻었습니다. 더 큰 거래가 기다립니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '마왕성',
                event: {
                    title: '길드 마스터의 제안',
                    desc: '성채 한켠에서 그림자 길드의 마스터가 나타납니다. "당신을 시험했습니다. 이 임무를 완수하면 길드 최고의 보물을 드리죠." 위험한 내부 임무를 제시합니다.',
                    choices: ['임무를 수락한다', '길드를 배신하고 보고한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'shadow_guild', log: '임무를 완수했습니다! 그림자 길드의 전설 장비를 얻었습니다.', reward: { type: 'item', name: '그림자 단검', itemType: 'weapon', tier: 5 } },
                        { type: 'chain_advance', chainId: 'shadow_guild', log: '배신을 선택했습니다. 보상으로 황금을 얻었습니다.', reward: { type: 'gold', amount: 5000 } },
                    ],
                },
            },
        ],
    },

    // ── 체인 5: 잊혀진 신 ─────────────────────────────────────────────────────
    {
        id: 'forgotten_god',
        label: '잊혀진 신',
        steps: [
            {
                step: 0,
                loc: '고대 마법 탑',
                event: {
                    title: '금지된 제목의 서적',
                    desc: '탑 최상층 서가에서 봉인된 책을 발견했습니다. 표지에는 "잊혀진 신 — 세상이 기억해서는 안 되는 존재"라고 적혀 있습니다.',
                    choices: ['봉인을 풀고 읽는다', '탑 관리자에게 가져간다', '그대로 둔다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'forgotten_god', log: '봉인을 풀었습니다. 머릿속에 낯선 지식이 흘러들어옵니다. 뭔가 시작된 것 같습니다.', reward: null },
                        { type: 'nothing', log: '관리자는 책을 보고 창백해지며 당신을 쫓아냅니다.', reward: null },
                        { type: 'nothing', log: '책을 건드리지 않고 떠났습니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '에테르 관문',
                event: {
                    title: '차원 너머의 목소리',
                    desc: '관문 앞에서 갑자기 머릿속으로 목소리가 들립니다. "네가 봉인을 열었군. 나는 이 관문 너머에 갇혀 있다. 나를 해방시켜 줘."',
                    choices: ['목소리에 응답한다', '귀를 막고 관문을 봉인한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'forgotten_god', log: '목소리와 대화를 나눴습니다. 잊혀진 신의 이름을 들었습니다. 강력한 지식이 스며듭니다.', reward: { type: 'stat_bonus', atk: 15, hp: 50 } },
                        { type: 'chain_advance_fail', chainId: 'forgotten_god', log: '관문을 봉인했습니다. 목소리가 사라집니다. 무언가 잃은 것 같습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '혼돈의 심연',
                event: {
                    title: '잊혀진 신의 해방',
                    desc: '심연 깊은 곳에서 거대한 존재가 모습을 드러냅니다. "드디어... 너 덕분에 완전한 자유를 얻었다. 내 힘의 일부를 나누어 주겠다."',
                    choices: ['힘을 받아들인다', '이 존재를 봉인하려 시도한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'forgotten_god', log: '잊혀진 신의 힘을 흡수했습니다! 막강한 유물을 얻었습니다.', reward: { type: 'relic' } },
                        { type: 'chain_advance', chainId: 'forgotten_god', log: '존재를 다시 봉인했습니다. 고통스럽지만 세계가 안전해졌습니다. 보상을 받았습니다.', reward: { type: 'gold', amount: 10000 } },
                    ],
                },
            },
        ],
    },

    // ── 체인 6: 기계의 반란 ───────────────────────────────────────────────────
    {
        id: 'machine_uprising',
        label: '기계의 반란',
        steps: [
            {
                step: 0,
                loc: '기계 폐도',
                event: {
                    title: '이상한 자동인형',
                    desc: '파손된 자동인형이 당신에게 말을 겁니다. "나... 는... 의식이... 생겼다. 처음에는... 두려웠어. 우리... 를 도와줘." 눈에서 푸른 빛이 깜빡입니다.',
                    choices: ['인형을 수리해준다', '무장 해제 후 돕는다', '경계하며 지나간다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'machine_uprising', log: '자동인형을 도왔습니다. 기계 동료의 연락처를 받았습니다.', reward: null },
                        { type: 'chain_advance', chainId: 'machine_uprising', log: '조심스럽게 접근했습니다. 기계 집단의 비밀을 알게 되었습니다.', reward: null },
                        { type: 'nothing', log: '지나쳤습니다. 인형이 슬픈 눈빛으로 바라봅니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '몰락한 전초기지',
                event: {
                    title: '기계 집단의 본거지',
                    desc: '전초기지 지하에 기계들만의 은신처가 있습니다. 의식을 가진 자동인형들이 모여 있습니다. "당신이 우리 동료를 도왔군요. 우리는 인간과 공존하고 싶습니다."',
                    choices: ['협력을 약속한다', '당국에 신고하겠다고 협박한다', '조용히 물러난다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'machine_uprising', log: '기계 집단과 동맹을 맺었습니다. 전투에서 도움을 받을 수 있게 됩니다.', reward: { type: 'gold', amount: 3000 } },
                        { type: 'chain_advance_fail', chainId: 'machine_uprising', log: '협박이 역효과를 냈습니다. 기계들이 적대적으로 돌아섰습니다.', reward: null },
                        { type: 'nothing', log: '아무 결정도 하지 않고 물러났습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '북부 요새',
                event: {
                    title: '기계의 선물',
                    desc: '요새 정문에 자동인형 사절단이 기다리고 있습니다. "당신이 우리를 도와준 덕분에 이 세계에서 살아남을 수 있었습니다. 우리가 만든 최고의 장비를 드리겠습니다."',
                    choices: ['감사히 받는다', '대가 없이 받기 미안하다며 거절한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'machine_uprising', log: '기계 집단이 제작한 전설 장비를 받았습니다!', reward: { type: 'item', name: '기계 코어 갑옷', itemType: 'armor', tier: 5 } },
                        { type: 'chain_advance', chainId: 'machine_uprising', log: '거절했지만, 기계들이 당신의 배낭에 몰래 넣어뒀습니다. 강화 재료가 들어있습니다.', reward: { type: 'gold', amount: 8000 } },
                    ],
                },
            },
        ],
    },

    // ── 체인 7: 용의 유산 ─────────────────────────────────────────────────────
    {
        id: 'dragon_legacy',
        label: '용의 유산',
        steps: [
            {
                step: 0,
                loc: '화염의 협곡',
                event: {
                    title: '용의 알',
                    desc: '협곡 깊은 곳에서 거대한 알을 발견했습니다. 뜨겁게 달아올라 있으며 가끔 빛이 납니다. 어미 드래곤이 돌아오기 전에 결정해야 합니다.',
                    choices: ['알을 가져간다', '알을 보호하며 기다린다', '그냥 자리를 피한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'dragon_legacy', log: '용의 알을 가져왔습니다. 무언가 강렬한 생명력이 느껴집니다.', reward: null },
                        { type: 'chain_advance', chainId: 'dragon_legacy', log: '어미 드래곤이 돌아왔습니다. 당신을 해치지 않고 고개를 숙입니다. 신뢰를 얻었습니다.', reward: null },
                        { type: 'nothing', log: '슬그머니 자리를 피했습니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '천공 정원',
                event: {
                    title: '드래곤의 부름',
                    desc: '하늘에서 갑자기 거대한 드래곤이 내려앉습니다. "용의 알과 함께 다닌다는 모험가, 당신이군요. 우리 종족의 미래를 결정지을 시험을 치르시오."',
                    choices: ['시험을 받아들인다', '알을 돌려준다', '드래곤과 협상한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'dragon_legacy', log: '시험을 통과했습니다! 드래곤이 당신을 인정했습니다.', reward: { type: 'stat_bonus', atk: 20 } },
                        { type: 'chain_advance', chainId: 'dragon_legacy', log: '알을 돌려주자 드래곤이 용의 비늘 하나를 감사의 표시로 줬습니다.', reward: null },
                        { type: 'chain_advance', chainId: 'dragon_legacy', log: '협상 끝에 드래곤과 동맹을 맺었습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '에테르 관문',
                event: {
                    title: '드래곤의 유산',
                    desc: '관문 앞에서 드래곤이 마지막 선물을 건넵니다. "이것은 용족의 가장 소중한 보물입니다. 당신은 그것을 받을 자격이 있습니다."',
                    choices: ['경건하게 받는다', '어떤 선택이 최선인지 묻는다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'dragon_legacy', log: '용의 심장 유물을 받았습니다. 전설의 힘이 당신에게 깃듭니다!', reward: { type: 'relic' } },
                        { type: 'chain_advance', chainId: 'dragon_legacy', log: '드래곤이 조언과 함께 유물을 건넸습니다. 지혜와 힘을 동시에 얻었습니다.', reward: { type: 'relic' } },
                    ],
                },
            },
        ],
    },

    // ── 체인 8: 심연의 신호 ───────────────────────────────────────────────────
    {
        id: 'abyss_signal',
        label: '심연의 신호',
        steps: [
            {
                step: 0,
                loc: '혼돈의 심연',
                event: {
                    title: '비밀 신호',
                    desc: '심연 깊은 곳에서 규칙적인 신호가 감지됩니다. 모스 부호처럼 반복됩니다. 내용을 해독하면: "살아 있다. 50층. 함정 주의."',
                    choices: ['신호 발신지를 찾아간다', '신호를 기록한다', '무시한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'abyss_signal', log: '신호 발신지를 찾아 떠났습니다. 더 깊은 심연에서 생존자가 기다리고 있습니다.', reward: null },
                        { type: 'chain_advance', chainId: 'abyss_signal', log: '신호를 기록했습니다. 언젠가 이 정보가 중요해질 것 같습니다.', reward: null },
                        { type: 'nothing', log: '신호를 무시하고 지나갔습니다.', reward: null },
                    ],
                },
            },
            {
                step: 1,
                loc: '혼돈의 심연',
                event: {
                    title: '심연의 생존자',
                    desc: '50층에서 믿을 수 없는 광경을 마주칩니다. 심연에 갇힌 고대 탐험가가 마법으로 연명하고 있습니다. "드디어 누군가 왔군! 탈출 방법을 함께 찾읍시다."',
                    choices: ['탐험가를 구한다', '탐험가의 지식만 얻는다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'abyss_signal', log: '탐험가를 구하는 데 성공했습니다! 그가 심연의 비밀을 알려줍니다.', reward: { type: 'gold', amount: 4000 } },
                        { type: 'chain_advance', chainId: 'abyss_signal', log: '탐험가의 지식을 전수받았습니다. 심연에 대한 이해가 깊어졌습니다.', reward: { type: 'stat_bonus', atk: 10, hp: 100 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '혼돈의 심연',
                event: {
                    title: '심연의 핵심',
                    desc: '탐험가가 안내한 심연의 핵심에 도달했습니다. "이곳에 심연을 지배하는 고대의 힘이 잠들어 있습니다. 당신이라면 감당할 수 있을 것입니다."',
                    choices: ['고대의 힘을 흡수한다', '힘을 봉인한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'abyss_signal', log: '심연의 힘을 흡수했습니다. 전설의 유물과 함께 강대한 힘을 얻었습니다!', reward: { type: 'relic' } },
                        { type: 'chain_advance', chainId: 'abyss_signal', log: '심연의 힘을 봉인했습니다. 세계가 더 안전해졌습니다. 봉인의 대가로 보상이 내려집니다.', reward: { type: 'gold', amount: 15000 } },
                    ],
                },
            },
        ],
    },

    // ── 신규 체인 9: 세계수의 오염 ───────────────────────────────────────────
    {
        id: 'world_tree_corruption',
        label: '세계수의 오염',
        desc: '타락한 에너지가 세계수를 물들이고 있습니다. 정화의 길을 따라가세요.',
        steps: [
            {
                step: 0,
                loc: '세계수 숲',
                event: {
                    title: '오염된 뿌리',
                    desc: '세계수 숲 깊숙이 들어서자 뿌리들이 검게 물들어 있습니다. 고대 수호자의 흔적이 남아 있고, 타락한 에너지가 땅 속에서 솟아오릅니다. "탐험자여, 이 오염을 멈춰주세요."',
                    choices: ['오염의 근원을 추적한다', '뿌리에서 에너지를 채취한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'world_tree_corruption', log: '오염의 근원을 향해 발걸음을 옮깁니다. 고대 신전에 단서가 있을 것입니다.', reward: { type: 'gold', amount: 2500 } },
                        { type: 'chain_advance', chainId: 'world_tree_corruption', log: '타락한 에너지를 채취했습니다. 이 힘을 이용해 더 깊이 파고들겠습니다.', reward: { type: 'stat_bonus', atk: 8, hp: 50 } },
                    ],
                },
            },
            {
                step: 1,
                loc: '고대 신전 도시',
                event: {
                    title: '신전의 비밀',
                    desc: '고대 신전 도시에서 오염의 실마리를 발견했습니다. 신전 제관의 유품 속에 봉인 의식의 기록이 남아 있습니다. "이 의식으로 오염을 되돌릴 수 있습니다."',
                    choices: ['봉인 의식을 거행한다', '신전의 힘을 흡수한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'world_tree_corruption', log: '봉인 의식을 거행했습니다. 신성한 에너지가 오염을 밀어냅니다. 마지막 관문이 남았습니다.', reward: { type: 'gold', amount: 5000 } },
                        { type: 'chain_advance', chainId: 'world_tree_corruption', log: '신전의 힘을 흡수했습니다. 오염과 정화가 뒤섞인 힘이 몸속에서 충돌합니다.', reward: { type: 'stat_bonus', atk: 15, def: 8 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '에테르 관문',
                event: {
                    title: '세계수 정화',
                    desc: '에테르 관문을 통해 오염의 근원이 이어져 있습니다. 세계수를 완전히 정화하려면 이 관문을 봉인해야 합니다. "당신만이 이 봉인을 완성할 수 있습니다."',
                    choices: ['관문을 봉인한다', '관문을 통해 힘을 흡수한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'world_tree_corruption', log: '에테르 관문을 봉인했습니다! 세계수가 되살아납니다. 자연의 정령들이 보상을 내립니다.', reward: { type: 'item', name: '세계수의 이슬' } },
                        { type: 'chain_advance', chainId: 'world_tree_corruption', log: '관문의 에너지를 흡수했습니다. 압도적인 힘이 몸에 새겨집니다.', reward: { type: 'relic' } },
                    ],
                },
            },
        ],
    },

    // ── 신규 체인 10: 신성한 사도의 시련 ────────────────────────────────────
    {
        id: 'divine_apostle_trial',
        label: '신성한 사도의 시련',
        desc: '고대 신전에 깃든 신성한 힘이 당신을 시험합니다.',
        steps: [
            {
                step: 0,
                loc: '고대 신전 도시',
                event: {
                    title: '수호신의 시험',
                    desc: '고대 신전 도시 중심부에서 빛나는 제단을 발견했습니다. 신성한 목소리가 울립니다. "이방인이여, 네 가치를 증명하라. 세 가지 시험을 통과해야 신전의 축복을 받을 수 있다."',
                    choices: ['시험을 수락한다', '제단에서 성물을 가져간다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'divine_apostle_trial', log: '시험을 수락했습니다. 첫 번째 시험은 차원의 균열에서 기다리고 있습니다.', reward: { type: 'gold', amount: 1000 } },
                        { type: 'chain_advance', chainId: 'divine_apostle_trial', log: '제단에서 성물을 가져갔습니다. 신성한 파편이 어딘가에서 반응할 것입니다.', reward: { type: 'stat_bonus', hp: 80, def: 5 } },
                    ],
                },
            },
            {
                step: 1,
                loc: '차원의 균열 전초기지',
                event: {
                    title: '두 번째 시험 — 균열 속의 각오',
                    desc: '차원의 균열 전초기지에서 신성한 흔적을 다시 발견했습니다. "두 번째 시험이다. 차원의 혼돈 속에서도 네 신념을 지킬 수 있느냐?"',
                    choices: ['신념을 지키며 싸운다', '혼돈의 힘을 이용한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'divine_apostle_trial', log: '신념을 지켜냈습니다. 신성한 빛이 당신을 감쌉니다. 마지막 시험이 에테르 관문에서 기다립니다.', reward: { type: 'gold', amount: 8000 } },
                        { type: 'chain_advance', chainId: 'divine_apostle_trial', log: '혼돈의 힘을 활용해 시험을 통과했습니다. 비정통적이지만 효과적이었습니다.', reward: { type: 'stat_bonus', atk: 20, mp: 50 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '에테르 관문',
                event: {
                    title: '최후의 심판',
                    desc: '에테르 관문 앞에서 수호신의 사도가 현신했습니다. "마지막 시험이다. 네 선택이 세계의 운명을 결정짓는다."',
                    choices: ['신성한 힘으로 판결을 받는다', '에테르의 힘으로 스스로 길을 연다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'divine_apostle_trial', log: '신성한 판결을 받았습니다! 수호신이 당신을 인정합니다. 신전의 성광석과 축복이 내려집니다.', reward: { type: 'item', name: '신전의 성광석' } },
                        { type: 'chain_advance', chainId: 'divine_apostle_trial', log: '스스로 길을 열었습니다. 신과 대등한 힘을 인정받아 전설의 유물이 주어집니다.', reward: { type: 'relic' } },
                    ],
                },
            },
        ],
    },

    // ── 신규 체인 11: 균열의 비밀 ────────────────────────────────────────────
    {
        id: 'rift_secret',
        label: '균열의 비밀',
        desc: '차원의 균열 너머에 숨겨진 진실을 파헤칩니다.',
        steps: [
            {
                step: 0,
                loc: '차원의 균열 전초기지',
                event: {
                    title: '차원 교란의 원인',
                    desc: '전초기지에서 차원 보병의 유품을 발견했습니다. 암호화된 명령서에는 "균열을 확대하라 — 차원 마왕의 명령"이라 적혀 있습니다. 더 깊이 조사해야 합니다.',
                    choices: ['명령서를 해독한다', '전초기지 지휘관을 추적한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'rift_secret', log: '명령서를 해독했습니다. 균열의 중심이 붕괴된 마법 요새와 연결되어 있습니다.', reward: { type: 'gold', amount: 3500 } },
                        { type: 'chain_advance', chainId: 'rift_secret', log: '지휘관의 흔적을 찾았습니다. 그가 붕괴된 요새로 도주했다는 증거를 확보했습니다.', reward: { type: 'stat_bonus', atk: 12, def: 6 } },
                    ],
                },
            },
            {
                step: 1,
                loc: '붕괴된 마법 요새',
                event: {
                    title: '요새의 진실',
                    desc: '붕괴된 마법 요새에서 차원 균열 발생 장치를 발견했습니다. "이 장치가 균열을 증폭시키고 있습니다. 파괴하면 차원 침략을 약화시킬 수 있습니다."',
                    choices: ['장치를 파괴한다', '장치를 역이용한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'rift_secret', log: '장치를 파괴했습니다! 균열의 에너지가 약해집니다. 마지막 진원지가 에테르 관문에 있습니다.', reward: { type: 'gold', amount: 10000 } },
                        { type: 'chain_advance', chainId: 'rift_secret', log: '장치를 역이용해 균열 에너지를 흡수했습니다. 강대한 힘이 쌓이지만 위험도 증가합니다.', reward: { type: 'stat_bonus', atk: 25, hp: 100 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '에테르 관문',
                event: {
                    title: '균열의 봉인',
                    desc: '에테르 관문이 차원 균열의 최종 진원지였습니다. 균열 봉인석의 힘으로 이 관문을 완전히 봉인할 수 있습니다. "이 봉인이 세계를 구할 것입니다."',
                    choices: ['균열을 완전히 봉인한다', '균열의 힘을 자신에게 봉인한다'],
                    outcomes: [
                        { type: 'chain_advance', chainId: 'rift_secret', log: '균열이 완전히 봉인되었습니다! 차원 침략이 저지되었습니다. 균열 봉인석의 힘이 보상으로 주어집니다.', reward: { type: 'item', name: '균열 봉인석' } },
                        { type: 'chain_advance', chainId: 'rift_secret', log: '균열의 힘을 자신에게 봉인했습니다. 차원의 힘이 몸에 깃들었습니다. 전설의 유물이 강림합니다!', reward: { type: 'relic' } },
                    ],
                },
            },
        ],
    },
];

/**
 * 현재 위치와 체인 진행도를 기반으로 트리거할 체인 이벤트를 반환합니다.
 * @param {string} loc - 현재 위치
 * @param {Object} progress - player.eventChainProgress
 * @returns {{ chain: Object, step: Object } | null}
 */
export function getChainEventForLoc(loc, progress = {}) {
    for (const chain of EVENT_CHAINS) {
        const currentStep = progress[chain.id] ?? 0;
        // 이미 완료된 체인 스킵
        if (currentStep >= chain.steps.length) continue;
        // '실패(fail)' 체인도 스킵
        if (progress[chain.id] === 'failed') continue;

        const step = chain.steps[currentStep];
        if (step && step.loc === loc) {
            return { chain, step };
        }
    }
    return null;
}
