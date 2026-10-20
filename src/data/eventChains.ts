/**
 * eventChains.ts — 내러티브 이벤트 체인
 *
 * 각 체인은 { id, label, steps[] } 형태이며, step은 loc(그 단계가 일어나는 지역), step(단계 번호)과
 * event(SET_EVENT payload) 또는 questStart(임무로 여는 단계) 중 하나를 가집니다.
 *
 * 2026-10 Wave 127 · 128(소유자 결정 "처음 숲의 이야기는 퀘스트를 통해 자동으로 알게" · "임무로 시작하게 바꿔 —
 *   스토리, 시나리오, 퀘스트 같이 자연스러운 구조로 이어지게"): 모든 체인의 0단계는 임무로 연다(`questStart`).
 *   그 임무를 수령하면 단계가 끝나고(`advanceQuestStartedChains`) 단서 기록(`log`)이 다음 단계의 지역을 알린다.
 *   여는 임무는 그 이야기가 시작되는 지역(`loc`)에서 하는 임무다 — 본편 장(80 · 81 · 82 · 84)이 곁가지 이야기를 열고,
 *   나머지는 그 지역의 임무가 연다. 본편이 아닌 임무는 게시판에 소문(`hook`)을 보인다(`getQuestOpenedChain`).
 *   1단계부터는 지역 이벤트다.
 *
 * player.eventChainProgress[chainId] 값이 step 번호를 추적합니다.
 * 0 = 미시작, 1 = 1단계 완료, 2 = 2단계 완료, 3 = 완료
 */

import { BALANCE } from './constants';
import { FIRST_STORY_QUEST_ID } from './quests';
import type { EventChainProgress } from '../types/player.js';

const PRIMAL_SHARD_DROP_PERCENT = Math.round(BALANCE.PRIMAL_SHARD_DROP_CHANCE * 100);
/** 심연의 신호가 가리키는 층 — 신호 문구("50층")와 생존자 · 핵심 스텝의 층 조건이 같은 값을 읽는다(Wave 62 C17). */
const ABYSS_SIGNAL_SURVIVOR_FLOOR = 50;

/** 임무로 여는 체인 단계(Wave 127 · 128) — `questId` 임무를 수령하면 그 단계가 끝난다. */
export interface ChainQuestStart {
    questId: number;
    /** 게시판 소문 — 본편이 아닌 임무가 아직 열리지 않은 이야기를 열 때 그 임무의 추천 이유 칸에 보인다(Wave 128). */
    hook?: string;
    /** 수령 기록 — 임무에서 알게 된 것과 다음 단계의 지역. */
    log: string;
}
const chainQuestStart = (value: ChainQuestStart): ChainQuestStart => value;

export const EVENT_CHAINS = [
    {
        id: 'ancient_prophecy',
        label: '고대의 예언',
        steps: [
            {
                step: 0,
                loc: '어둠의 동굴',
                // 임무 117 '암흑 마법사 처단' — 동굴의 암흑 마법사들이 돌판을 두고 모여 있었다.
                questStart: chainQuestStart({
                    questId: 117,
                    hook: '어둠의 동굴 깊은 곳에서 암흑 마법사들이 고대 문자가 새겨진 돌판 앞에 모인다는 소문이 있습니다.',
                    log: '처단한 암흑 마법사의 품에서 돌판의 탁본이 나왔습니다. "세 개의 파편이 모이면, 원시의 문이 열리리라..." 이 고대 문자를 읽을 수 있는 학자가 고대 마법 탑에 있다고 합니다.',
                }),
            },
            {
                step: 1,
                loc: '고대 마법 탑',
                event: {
                    title: '예언 해독사',
                    desc: '탑 안에서 예언의 학자 노인을 만났습니다. "당신이 돌판을 보셨군요. 계승 3단계에 올라 원시의 파편을 3개 모은 뒤 마왕을 쓰러뜨리면, 옥좌 뒤 봉인이 열리고 곧바로 다음 전투가 시작됩니다."',
                    choices: ['학자의 말에 귀 기울인다', '시간이 없다, 돌아간다'],
                    outcomes: [
                        { type: 'chain_advance', log: '진실에 한 발짝 다가섰습니다. 파편 수집의 방법을 알게 되었습니다.', reward: { type: 'info', text: `원시의 파편: 계승 1단계부터 마왕 처치 시 ${PRIMAL_SHARD_DROP_PERCENT}% 확률로 획득` } },
                        { type: 'nothing', log: '무언가 중요한 것을 놓쳤을지도 모릅니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '마왕성',
                event: {
                    title: '원시의 문',
                    desc: '마왕의 옥좌 뒤편에 거대한 봉인된 문이 서 있습니다. 학자가 말한 조건이 가리키던 곳이 바로 이 성이었습니다. 파편 3개가 여기서 힘을 방출하면 문이 열릴 것 같습니다.',
                    choices: ['문을 경건히 살펴본다', '손을 댄다'],
                    outcomes: [
                        { type: 'chain_advance', log: '원시의 힘이 당신을 인정했습니다. 유물 하나가 발광하며 나타납니다.', reward: { type: 'relic' } },
                        { type: 'chain_advance', log: '손을 대자 문이 거세게 진동했지만 당신을 해치지는 않았습니다. 틈새에서 무언가가 모습을 드러냅니다.', reward: { type: 'relic' } },
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
                // 본편 80 '[스토리] 첫 번째 여정'(Wave 127) — 첫 탐험이 이야기 화면으로 막히지 않는다. 단계 번호는 그대로라
                //   저장된 진행 값의 뜻이 바뀌지 않는다(다른 체인의 0단계도 같다).
                questStart: chainQuestStart({
                    questId: FIRST_STORY_QUEST_ID,
                    log: '첫 여정에서 주운 그을린 지팡이 파편은 사라진 마법사의 것이었습니다. 흔적은 수정 동굴로 이어집니다.',
                }),
            },
            {
                step: 1,
                loc: '수정 동굴',
                event: {
                    title: '마법사의 일기장',
                    desc: '수정에 끼인 낡은 일기장을 발견했습니다. "...나는 천공 정원에 있다. 새로운 마법을 찾아서. 하지만 무언가가 나를 따라오고 있다..."',
                    choices: ['일기장을 가져간다', '그 자리에 남겨둔다'],
                    outcomes: [
                        { type: 'chain_advance', log: '일기장을 챙겼습니다. 천공 정원에서 마법사를 찾을 수 있을 것 같습니다.', reward: null },
                        { type: 'nothing', log: '일기장을 남겨두고 왔습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '천공 정원',
                event: {
                    title: '마법사의 환영',
                    desc: '정원에서 마법사의 환영이 나타납니다. "당신이 내 일기장을 가져왔군요. 하지만... 이 자리를 떠날 수 없습니다. 내 지팡이를 이어받고 싶다면, 먼저 내 환영을 쓰러뜨려 자격을 증명하세요."',
                    choices: ['전투를 받아들인다 (전설 보상)', '거절한다'],
                    outcomes: [
                        // cycle 140: '전설의 마법서'가 items.ts에 없는 missing item이라 보상이 silently 누락됐음. 실재하는 tier 5 mage staff '천벌의 지팡이'로 교체.
                        // Wave 62 C19(소유자 결정 "설명대로"): 고르면 실제 전투가 열린다(`combat` — 기존 종 '고대 마법사'를 이 지역 레벨로
                        //   스폰한 정예). 지팡이 · 진행은 승리 때만 정산되고 `log`가 그때의 승리 로그다. 지거나 물러나면 단계는 그대로 남는다.
                        {
                            type: 'chain_advance', log: '환영을 물리쳤습니다. 천벌의 지팡이를 얻었습니다!', reward: { type: 'legendary_item', name: '천벌의 지팡이' },
                            combat: { monster: '고대 마법사', enemyName: '사라진 마법사의 환영', intro: '마법사의 환영이 지팡이를 들어 올립니다. 자격을 증명할 시간입니다!' },
                        },
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
                // 임무 17 '평원 정화' — 도적 떼에게 습격당한 기사를 구한다(그 기사의 검이 1단계에서 기다린다).
                questStart: chainQuestStart({
                    questId: 17,
                    hook: '서쪽 평원에서 도적 떼에게 습격당한 기사가 쓰러져 있다는 소문이 돕니다.',
                    log: '도적 떼를 몰아낸 자리에서 중상을 입은 기사를 마을로 옮겨 치료했습니다. 기사는 마왕을 막아 달라는 부탁과 함께, 화염의 협곡에서 잃어버린 자신의 검 이야기를 남겼습니다.',
                }),
            },
            {
                step: 1,
                loc: '화염의 협곡',
                event: {
                    title: '기사의 검',
                    desc: '협곡 어딘가에서 빛나는 검이 박혀 있습니다. "이 검은... 당신이 구해준 그 기사의 검이군요." 아이템이 당신을 기다리고 있습니다.',
                    choices: ['검을 뽑아낸다', '그대로 둔다'],
                    outcomes: [
                        // cycle 140: '기사의 유검' missing → tier 4 light knight sword '심판자의 검'으로 교체.
                        { type: 'chain_advance', log: '기사의 검을 획득했습니다. 심판자의 검에 강력한 힘이 깃들어 있습니다.', reward: { type: 'item', name: '심판자의 검' } },
                        { type: 'nothing', log: '검을 두고 왔습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '암흑 성',
                event: {
                    title: '기사의 혼령',
                    desc: '암흑 성 입구에서 기사의 혼령이 나타납니다. "당신이 나를 구해줬군요. 이제 내가 잠시 당신 곁에서 싸우겠습니다." 혼령이 당신과 합류합니다.',
                    choices: ['혼령을 받아들인다', '혼자 싸우겠다'],
                    outcomes: [
                        { type: 'chain_advance', log: '기사의 혼령이 합류! 혼령이 곁에 머무는 동안 공격이 더 강해집니다.', reward: { type: 'combat_bonus', atkMult: 1.3, duration: 5, buffName: '기사의 혼령', buffIntro: '최후의 영웅이 합류해' } },
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
                // 임무 19 '고블린 소탕' — 폐허의 고블린들이 그림자 길드의 쪽지를 나르고 있었다.
                questStart: chainQuestStart({
                    questId: 19,
                    hook: '잊혀진 폐허의 고블린들이 그림자 문양이 찍힌 쪽지를 어딘가로 나른다는 소문이 있습니다.',
                    log: '소탕한 고블린들이 지닌 쪽지마다 그림자 형상의 표식이 찍혀 있었습니다. 지하 조직의 암호를 풀자 접선 장소가 드러났습니다. 그림자 길드의 암시장은 어둠의 동굴 깊은 곳에 있습니다.',
                }),
            },
            {
                step: 1,
                loc: '어둠의 동굴',
                event: {
                    title: '암시장 접선',
                    desc: '동굴 깊은 곳에서 복면을 쓴 상인을 만났습니다. "표식을 알고 왔다면... 상인의 인장을 넘기겠소. 하지만 공짜는 없지." 그는 희귀 유물 상인의 인장을 2000G에 제시합니다.',
                    choices: ['상인의 인장을 산다 (2000G)', '거절하고 정보만 얻는다'],
                    outcomes: [
                        { type: 'chain_advance', log: '거래를 완료해 희귀 유물 상인의 인장을 얻었습니다. 그림자 길드와 신뢰가 쌓였습니다.', reward: { type: 'gold', amount: -2000, relicId: 'merchant_seal' } },
                        { type: 'chain_advance', log: '정보를 얻었습니다. 더 큰 거래가 기다립니다.', reward: null },
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
                        // cycle 140: '그림자 단검' missing → tier 5 shadow weapon '그림자 절단기'로 교체.
                        { type: 'chain_advance', log: '임무를 완수했습니다! 그림자 절단기를 얻었습니다.', reward: { type: 'item', name: '그림자 절단기' } },
                        { type: 'chain_advance', log: '배신을 선택했습니다. 보상으로 황금을 얻었습니다.', reward: { type: 'gold', amount: 5000 } },
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
                // 임무 29 '탑 수호자 격파' — 수호자들이 지키던 최상층 서가의 봉인된 책.
                questStart: chainQuestStart({
                    questId: 29,
                    hook: '고대 마법 탑의 수호자들이 최상층 서가의 봉인된 책을 지키고 있다고 합니다.',
                    log: '탑 수호자들이 지키던 최상층 서가에서 봉인된 책을 가져왔습니다. 표지에는 "잊혀진 신 — 세상이 기억해서는 안 되는 존재"라고 적혀 있습니다. 봉인을 풀자 낯선 지식이 머릿속으로 흘러들었고, 그 지식은 지하 미궁을 가리킵니다.',
                }),
            },
            {
                // 2026-09 Wave 14 F2: loc이 '에테르 관문'(경로 게이트 68)이었다 — 종착 스텝
                //   '혼돈의 심연'(48)보다 중간 스텝이 더 높아 체인 13개 중 유일하게 스텝이
                //   역전돼 있었고, 완주에 170.23h가 필요한데 리포트는 53.28h로 적었다.
                //   '지하 미궁'(44)은 로어가 이 체인의 전제를 직접 가리킨다 — "원시의 신이
                //   봉인되기 전 만들어진 미궁"이고, step 2의 무대 '혼돈의 심연'의 보스가
                //   바로 그 원시의 신이다. 문구도 함께 옮겼다(관문 → 미궁): loc만 바꾸면
                //   이 wave가 없애려는 "장소와 텍스트가 어긋난다"를 새로 만든다.
                step: 1,
                loc: '지하 미궁',
                event: {
                    title: '봉인 너머의 목소리',
                    desc: '미궁 깊은 곳에서 갑자기 머릿속으로 목소리가 들립니다. "네가 봉인을 열었군. 나는 이 미궁이 지어지기 전부터 갇혀 있다. 나를 해방시켜 줘."',
                    choices: ['목소리에 응답한다', '귀를 막고 미궁을 빠져나간다'],
                    outcomes: [
                        { type: 'chain_advance', log: '목소리와 대화를 나눴습니다. 잊혀진 신의 이름을 들었습니다. 강력한 지식이 스며듭니다.', reward: { type: 'stat_bonus', atk: 15, hp: 50 } },
                        { type: 'chain_advance_fail', log: '미궁을 빠져나왔습니다. 목소리가 사라집니다. 무언가 잃은 것 같습니다.', reward: null },
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
                        { type: 'chain_advance', log: '잊혀진 신의 힘을 흡수했습니다! 막강한 유물을 얻었습니다.', reward: { type: 'relic' } },
                        { type: 'chain_advance', log: '존재를 다시 봉인했습니다. 고통스럽지만 세계가 안전해졌습니다. 보상을 받았습니다.', reward: { type: 'gold', amount: 10000 } },
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
                // 본편 84 '[스토리] 기계의 심장' — 명령을 반복하는 병기들 사이에서 의식을 가진 자동인형 하나가 말을 건다.
                questStart: chainQuestStart({
                    questId: 84,
                    log: '증기 골렘을 쓰러뜨린 잔해 더미에서 부서진 자동인형 하나가 말을 걸었습니다. "나... 는... 의식이... 생겼다. 우리... 를 도와줘." 인형을 고쳐 주자, 의식을 가진 동료들이 몰락한 전초기지 지하에 숨어 있다고 알려 주었습니다.',
                }),
            },
            {
                step: 1,
                loc: '몰락한 전초기지',
                event: {
                    title: '기계 집단의 본거지',
                    desc: '전초기지 지하에 기계들만의 은신처가 있습니다. 의식을 가진 자동인형들이 모여 있습니다. "당신이 우리 동료를 도왔군요. 우리는 인간과 공존하고 싶습니다."',
                    choices: ['협력을 약속한다', '당국에 신고하겠다고 협박한다', '조용히 물러난다'],
                    outcomes: [
                        // 2026-10 Wave 62 C13 (소유자 결정 "문구"): 보상은 골드 3,000뿐이고 이 진행을 읽는 전투 도움은 없다 — 약속하지 않는다.
                        { type: 'chain_advance', log: '기계 집단과 동맹을 맺었습니다. 감사의 표시로 그들이 모아 둔 금화를 건넵니다.', reward: { type: 'gold', amount: 3000 } },
                        { type: 'chain_advance_fail', log: '협박이 역효과를 냈습니다. 기계들은 은신처를 버리고 자취를 감췄습니다. 다시는 그들을 만날 수 없을 것입니다.', reward: null },
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
                        // cycle 140: '기계 코어 갑옷' missing → tier 5 armor '천상의갑주'로 교체 (기계 자동인형 사절단의 최고급 의장).
                        { type: 'chain_advance', log: '기계 집단이 제작한 천상의갑주를 받았습니다!', reward: { type: 'item', name: '천상의갑주' } },
                        // 2026-09 Wave 39: 문구가 약속한 강화 재료를 준다(골드 8,000을 주던 동안 로그와 보상이 달랐다).
                        { type: 'chain_advance', log: '거절했지만, 기계들이 당신의 배낭에 몰래 넣어뒀습니다. 강화 재료가 들어있습니다.', reward: { type: 'item', name: '강화 재료' } },
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
                // 본편 82 '[스토리] 불꽃의 시험' — 화염 정령들이 둘러싸고 있던 용의 알(1단계 드래곤이 알을 데려온 모험가를 찾는다).
                questStart: chainQuestStart({
                    questId: 82,
                    log: '화염 정령들이 둘러싸고 있던 협곡 깊은 곳에서 뜨겁게 달아오른 거대한 알을 품고 나왔습니다. 비늘 무늬는 둥지의 붉은 용이 아니라 구름 위에 사는 용족의 것입니다. 알의 주인을 아는 용은 천공 정원에 있을 것입니다.',
                }),
            },
            {
                step: 1,
                loc: '천공 정원',
                event: {
                    title: '드래곤의 부름',
                    desc: '하늘에서 갑자기 거대한 드래곤이 내려앉습니다. "용의 알과 함께 다닌다는 모험가, 당신이군요. 우리 종족의 미래를 결정지을 시험을 치르시오."',
                    choices: ['시험을 받아들인다', '알을 돌려준다', '드래곤과 협상한다'],
                    outcomes: [
                        { type: 'chain_advance', log: '시험을 통과했습니다! 드래곤이 당신을 인정했습니다.', reward: { type: 'stat_bonus', atk: 20 } },
                        // Wave 61: 문구가 약속한 용의 비늘을 준다(보상이 비어 있었다 — 원장 §61 A15).
                        { type: 'chain_advance', log: '알을 돌려주자 드래곤이 용의 비늘 하나를 감사의 표시로 줬습니다.', reward: { type: 'item', name: '용의 비늘' } },
                        { type: 'chain_advance', log: '협상 끝에 드래곤과 동맹을 맺었습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '천공 정원',
                event: {
                    title: '드래곤의 유산',
                    desc: '시험을 치렀던 그 자리에 드래곤이 다시 내려앉습니다. 구름 위 정원의 빛 속에서 마지막 선물을 건넵니다. "이것은 용족의 가장 소중한 보물입니다. 당신은 그것을 받을 자격이 있습니다."',
                    choices: ['경건하게 받는다', '어떤 선택이 최선인지 묻는다'],
                    outcomes: [
                        // Wave 62 C3: '용의 심장'은 재료라 그런 유물이 없었다 — 전설 등급 유물을 준다(데이터가 등급을 선언, 엔진이 읽는다).
                        { type: 'chain_advance', log: '용족이 지켜 온 전설의 유물을 받았습니다. 전설의 힘이 당신에게 깃듭니다!', reward: { type: 'relic', rarity: 'legendary' as const } },
                        { type: 'chain_advance', log: '드래곤이 조언과 함께 유물을 건넸습니다. 지혜와 힘을 동시에 얻었습니다.', reward: { type: 'relic' } },
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
                // 임무 205 '[심연] 혼돈 속의 생존자' — 심연의 수호자들이 지키던 자리에서 생존자의 신호를 잡는다.
                questStart: chainQuestStart({
                    questId: 205,
                    hook: '혼돈의 심연 깊은 곳에서 규칙적인 신호가 잡힌다는 이야기가 있습니다.',
                    log: `심연의 수호자들을 쓰러뜨린 자리에서 규칙적인 신호를 잡았습니다. 해독하면: "살아 있다. ${ABYSS_SIGNAL_SURVIVOR_FLOOR}층. 함정 주의." 생존자는 혼돈의 심연 ${ABYSS_SIGNAL_SURVIVOR_FLOOR}층에서 기다리고 있습니다.`,
                }),
            },
            {
                step: 1,
                loc: '혼돈의 심연',
                // 2026-10 Wave 62 C17 (소유자 결정 "설명대로"): 신호가 말한 50층에 닿아야 생존자를 만난다 — 위치만 보던 동안
                //   1층에서 바로 다음 탐험에 발동했다. 판정은 `isChainStepFloorReached` 하나다(지금 싸우는 층 = 돌파 층 + 1).
                minAbyssFloor: ABYSS_SIGNAL_SURVIVOR_FLOOR,
                event: {
                    title: '심연의 생존자',
                    desc: `${ABYSS_SIGNAL_SURVIVOR_FLOOR}층에서 믿을 수 없는 광경을 마주칩니다. 심연에 갇힌 고대 탐험가가 마법으로 연명하고 있습니다. "드디어 누군가 왔군! 탈출 방법을 함께 찾읍시다."`,
                    choices: ['탐험가를 구한다', '탐험가의 지식만 얻는다'],
                    outcomes: [
                        { type: 'chain_advance', log: '탐험가를 구하는 데 성공했습니다! 그가 심연의 비밀을 알려줍니다.', reward: { type: 'gold', amount: 4000 } },
                        { type: 'chain_advance', log: '탐험가의 지식을 전수받았습니다. 심연에 대한 이해가 깊어졌습니다.', reward: { type: 'stat_bonus', atk: 10, hp: 100 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '혼돈의 심연',
                // 핵심은 50층의 생존자가 안내하는 더 깊은 곳이다 — 같은 층 조건을 둔다(돌파 층은 사망 · 계승을 넘어 유지되므로
                //   생존자를 만난 플레이어에게는 추가 조건이 아니고, 이전 세이브에서 1단계를 이미 넘긴 진행만 50층을 요구받는다).
                minAbyssFloor: ABYSS_SIGNAL_SURVIVOR_FLOOR,
                event: {
                    title: '심연의 핵심',
                    desc: '탐험가가 안내한 심연의 핵심에 도달했습니다. "이곳에 심연을 지배하는 고대의 힘이 잠들어 있습니다. 당신이라면 감당할 수 있을 것입니다."',
                    choices: ['고대의 힘을 흡수한다', '힘을 봉인한다'],
                    outcomes: [
                        { type: 'chain_advance', log: '심연의 힘을 흡수했습니다. 그 힘이 전설의 유물로 응결됩니다!', reward: { type: 'relic', rarity: 'legendary' as const } },
                        { type: 'chain_advance', log: '심연의 힘을 봉인했습니다. 세계가 더 안전해졌습니다. 봉인의 대가로 보상이 내려집니다.', reward: { type: 'gold', amount: 15000 } },
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
                // 임무 141 '자연의 정령 정화' — 정화한 정령들이 검게 물든 뿌리를 알린다.
                questStart: chainQuestStart({
                    questId: 141,
                    hook: '세계수 숲의 정령들이 날뛰기 시작했고, 숲 깊은 곳의 뿌리가 검게 물들었다는 소문이 있습니다.',
                    log: '정화한 자연의 정령들이 마지막으로 속삭였습니다. "탐험자여, 뿌리가 검게 물들고 있어요. 이 오염을 멈춰 주세요." 오염의 실마리는 구름 위 천공 정원에 있습니다.',
                }),
            },
            {
                step: 1,
                loc: '천공 정원',
                event: {
                    title: '수호자의 기록',
                    desc: '구름 위 잔해 정원에서 오염의 실마리를 발견했습니다. 타락한 세계수 수호자가 품고 있던 유품 속에 봉인 의식의 기록이 남아 있습니다. "이 의식으로 오염을 되돌릴 수 있습니다."',
                    choices: ['봉인 의식을 거행한다', '수호자의 힘을 흡수한다'],
                    outcomes: [
                        { type: 'chain_advance', log: '봉인 의식을 거행했습니다. 신성한 에너지가 오염을 밀어냅니다. 이제 세계수 앞으로 돌아갈 차례입니다.', reward: { type: 'gold', amount: 5000 } },
                        { type: 'chain_advance', log: '수호자의 힘을 흡수했습니다. 오염과 정화가 뒤섞인 힘이 몸속에서 충돌합니다.', reward: { type: 'stat_bonus', atk: 15, def: 8 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '세계수 숲',
                event: {
                    title: '세계수 정화',
                    desc: '봉인 의식의 기록을 들고 세계수 숲으로 돌아왔습니다. 검게 물든 줄기 앞에 서자 오염의 근원이 나무 속에서 요동칩니다. "당신만이 이 봉인을 완성할 수 있습니다."',
                    choices: ['오염의 뿌리를 봉인한다', '오염된 수액을 흡수한다'],
                    outcomes: [
                        // cycle 140: '세계수의 이슬' missing → 자연 계열 tier 5 weapon '세계수의 지팡이'로 교체.
                        { type: 'chain_advance', log: '오염의 뿌리를 봉인했습니다! 세계수가 되살아납니다. 자연의 정령들이 세계수의 지팡이를 내립니다.', reward: { type: 'item', name: '세계수의 지팡이' } },
                        { type: 'chain_advance', log: '오염된 수액을 흡수했습니다. 압도적인 힘이 몸에 새겨집니다.', reward: { type: 'relic' } },
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
                // 임무 143 '신전 경비병 소탕' — 제단을 지키던 경비병을 물리친 것이 첫 번째 시험이다.
                questStart: chainQuestStart({
                    questId: 143,
                    hook: '고대 신전 도시의 경비병들이 빛나는 제단에 다가가는 이방인을 막아선다고 합니다.',
                    log: '신전 경비병들을 물리치자 그들이 지키던 제단이 빛나며 목소리가 울렸습니다. "이방인이여, 네 가치를 증명했다. 첫 번째 시험은 끝났다." 두 번째 시험은 차원의 균열 전초기지에서 기다리고 있습니다.',
                }),
            },
            {
                step: 1,
                loc: '차원의 균열 전초기지',
                event: {
                    title: '두 번째 시험 — 균열 속의 각오',
                    desc: '차원의 균열 전초기지에서 신성한 흔적을 다시 발견했습니다. "두 번째 시험이다. 차원의 혼돈 속에서도 네 신념을 지킬 수 있느냐?"',
                    choices: ['신념을 지키며 싸운다', '혼돈의 힘을 이용한다'],
                    outcomes: [
                        { type: 'chain_advance', log: '신념을 지켜냈습니다. 신성한 빛이 당신을 감쌉니다. 마지막 시험이 에테르 관문에서 기다립니다.', reward: { type: 'gold', amount: 8000 } },
                        { type: 'chain_advance', log: '혼돈의 힘을 활용해 시험을 통과했습니다. 비정통적이지만 효과적이었습니다.', reward: { type: 'stat_bonus', atk: 20, mp: 50 } },
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
                        // cycle 140: '신전의 성광석' missing → tier 5 holy spear '성스러운 창'으로 교체.
                        { type: 'chain_advance', log: '신성한 판결을 받았습니다! 수호신이 당신을 인정하며 성스러운 창을 내립니다.', reward: { type: 'item', name: '성스러운 창' } },
                        { type: 'chain_advance', log: '스스로 길을 열었습니다. 신과 대등한 힘을 인정받아 전설의 유물이 주어집니다.', reward: { type: 'relic', rarity: 'legendary' as const } },
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
                // 임무 146 '차원 보병 격멸' — 차원 보병의 유품에서 나온 암호 명령서.
                questStart: chainQuestStart({
                    questId: 146,
                    hook: '차원의 균열 전초기지의 차원 보병들이 암호로 된 명령서를 지니고 다닌다고 합니다.',
                    log: '격멸한 차원 보병의 유품에서 암호화된 명령서를 찾았습니다. "균열을 확대하라 — 차원 마왕의 명령." 해독하자 균열의 중심이 붕괴된 마법 요새와 이어져 있다는 사실이 드러났습니다.',
                }),
            },
            {
                step: 1,
                loc: '붕괴된 마법 요새',
                event: {
                    title: '요새의 진실',
                    desc: '붕괴된 마법 요새에서 차원 균열 발생 장치를 발견했습니다. "이 장치가 균열을 증폭시키고 있습니다. 파괴하면 차원 침략을 약화시킬 수 있습니다."',
                    choices: ['장치를 파괴한다', '장치를 역이용한다'],
                    outcomes: [
                        { type: 'chain_advance', log: '장치를 파괴했습니다! 균열의 에너지가 약해집니다. 마지막 진원지가 에테르 관문에 있습니다.', reward: { type: 'gold', amount: 10000 } },
                        { type: 'chain_advance', log: '장치를 역이용해 균열 에너지를 흡수했습니다. 균열의 힘이 몸에 쌓입니다. 마지막 진원지가 에테르 관문에 있습니다.', reward: { type: 'stat_bonus', atk: 25, hp: 100 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '에테르 관문',
                event: {
                    title: '균열의 봉인',
                    desc: '에테르 관문이 차원 균열의 최종 진원지였습니다. 지금이라면 이 관문의 균열을 완전히 봉인할 수 있습니다. "이 봉인이 세계를 구할 것입니다."',
                    choices: ['균열을 완전히 봉인한다', '균열의 힘을 자신에게 봉인한다'],
                    outcomes: [
                        // cycle 140: '균열 봉인석' missing → tier 4 균열 light shield '균열 차단 방패'로 교체.
                        { type: 'chain_advance', log: '균열이 완전히 봉인되었습니다! 차원 침략이 저지되었습니다. 균열 차단 방패의 힘이 보상으로 주어집니다.', reward: { type: 'item', name: '균열 차단 방패' } },
                        { type: 'chain_advance', log: '균열의 힘을 자신에게 봉인했습니다. 차원의 힘이 몸에 깃들었습니다. 전설의 유물이 강림합니다!', reward: { type: 'relic', rarity: 'legendary' as const } },
                    ],
                },
            },
        ],
    },

    // ── 신규 체인 12: 잊혀진 사령관 (cycle 62) ───────────────────────────────
    // 옛 제국 사령관의 이야기를 따라가는 3단계 체인. 폐허 → 전초기지 → 마왕성으로
    // 자연스러운 레벨 진행 구간을 따른다 (레벨 5+ → 18+ → 50+).
    {
        id: 'forgotten_commander',
        label: '잊혀진 사령관',
        desc: '300년 전 마왕군과 싸운 제국 사령관의 흔적을 추적합니다.',
        steps: [
            {
                step: 0,
                loc: '잊혀진 폐허',
                // 본편 81 '[스토리] 폐허의 진실' — 제국 연구자들의 기록과 함께 제국 사령관의 갑옷이 나온다.
                questStart: chainQuestStart({
                    questId: 81,
                    log: '폐허를 살피다 녹슨 갑옷과 부서진 검을 발견했습니다. 갑옷에는 제국 사령관의 문장이, 검의 손잡이에는 "용서받지 못한 자"라는 글귀가 새겨져 있습니다. 사령관의 마지막 임무지는 몰락한 전초기지였던 것 같습니다.',
                }),
            },
            {
                step: 1,
                loc: '몰락한 전초기지',
                event: {
                    title: '사령관의 일지',
                    desc: '전초기지 지하 병기고에서 사령관의 일지를 발견했습니다. "...마왕성으로 떠난다. 돌아오지 못할 것이다. 누군가 이 일지를 발견하면, 부디 내 뜻을 이어 마왕에게 닿게 해주오."',
                    choices: ['일지의 부탁을 받아들인다', '위험을 무릅쓰지 않는다'],
                    outcomes: [
                        { type: 'chain_advance', log: '사령관의 의지를 이어받았습니다. 그의 의지가 시간을 거슬러 당신의 무기에 빛을 더합니다.', reward: { type: 'combat_bonus', atkMult: 1.25, duration: 8, buffName: '사령관의 의지', buffIntro: '사령관의 의지가 깃들어' } },
                        { type: 'chain_advance_fail', log: '일지를 그대로 두고 떠났습니다.', reward: null },
                    ],
                },
            },
            {
                step: 2,
                loc: '마왕성',
                event: {
                    title: '사령관의 영혼',
                    desc: '마왕성 입구에서 푸른 빛이 일렁입니다. 사령관의 영혼이 모습을 드러냅니다. "당신이 내 뜻을 이어 여기까지 왔구나... 마지막 한 번, 함께 싸워주겠소?"',
                    choices: ['사령관의 영혼과 함께 싸운다', '영혼에게 안식을 권한다'],
                    outcomes: [
                        { type: 'chain_advance', log: '사령관의 영혼이 당신과 동행합니다. 그의 마지막 의지가 전설 유물로 응결됩니다.', reward: { type: 'relic', rarity: 'legendary' as const } },
                        // 2026-10 Wave 108 (소유자 결정 "죽으면 모든 게 초기화"): 이야기 능력치는 이번 여정 범위다(`storyStatBonus`).
                        { type: 'chain_advance', log: '사령관에게 안식을 권했습니다. 영혼이 남긴 수호의 의지가 스며들어 이번 여정 동안 방어력과 생명이 강해집니다.', reward: { type: 'stat_bonus', def: 12, hp: 100 } },
                    ],
                },
            },
        ],
    },

    // ── 신규 체인 13: 물의 사도 (cycle 66) ───────────────────────────────────
    // 호수 → 사막 → 피라미드로 이어지는 잃어버린 신관의 순례. 약 Lv5~30
    // 진행에 맞춰 자연스러운 경로 + 마지막에 정수의 결정 또는 유물 보상.
    {
        id: 'water_apostle',
        label: '물의 사도',
        desc: '호수 신전을 떠나 사막을 가로질러 피라미드까지 닿은 옛 신관의 발자취를 추적합니다.',
        steps: [
            {
                step: 0,
                loc: '호수의 신전',
                // 임무 5 '호수의 수호자' — 물의 정령들이 날뛴 까닭이 신관의 일기에 있다.
                questStart: chainQuestStart({
                    questId: 5,
                    hook: '호수의 신전에서 물의 정령들이 갑자기 날뛰기 시작했고, 신전을 지키던 신관도 보이지 않는다고 합니다.',
                    log: '날뛰던 물의 정령들을 가라앉힌 뒤 신전 한구석에서 물에 젖지 않은 신관의 일기를 찾았습니다. "물의 정수가 마르고 있다. 사막을 건너 피라미드로 향한다." 정령들이 날뛴 까닭이었습니다. 신관의 흔적은 사막 오아시스로 이어집니다.',
                }),
            },
            {
                step: 1,
                loc: '사막 오아시스',
                event: {
                    title: '메마른 우물',
                    desc: '오아시스 가운데 메마른 우물 옆에 신관의 망토 조각이 걸려 있습니다. 망토 안쪽에는 "정수는 피라미드 심장부에 봉인됐다"는 메모가 새겨져 있습니다.',
                    choices: ['메모를 받아 피라미드로 향한다', '망토 조각만 챙기고 떠난다'],
                    outcomes: [
                        { type: 'chain_advance', log: '신관의 의지를 이어받아 피라미드 심장부로 향합니다. 마지막 봉인을 풀 수 있을지도 모릅니다.', reward: { type: 'combat_bonus', atkMult: 1.2, duration: 6, buffName: '신관의 의지', buffIntro: '신관의 의지가 깃들어' } },
                        { type: 'chain_advance_fail', log: '망토 조각만 챙기고 다음 길은 포기했습니다.', reward: { type: 'gold', amount: 1500 } },
                    ],
                },
            },
            {
                step: 2,
                loc: '피라미드',
                event: {
                    title: '봉인된 정수',
                    desc: '피라미드 심장부에서 신관이 봉인했던 물의 정수를 마주했습니다. 봉인이 약해진 채 천천히 빛을 잃고 있습니다. 신관의 의지가 마지막 한 번을 부탁합니다.',
                    choices: ['정수에 의지를 더해 봉인을 강화한다', '정수의 힘을 받아들인다'],
                    outcomes: [
                        { type: 'chain_advance', log: '봉인이 단단해졌습니다. 정수가 보답으로 신관의 유산을 남겼습니다.', reward: { type: 'item', name: '엘릭서' } },
                        { type: 'chain_advance', log: '정수의 힘이 당신에게 깃들었습니다. 전설 유물 한 점이 손 안에 응결됩니다.', reward: { type: 'relic', rarity: 'legendary' as const } },
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
// cycle 596: progress default {} 제거 — exploreActions:41 (production) + 6+
//   test caller 모두 progress 명시 전달이라 default 도달 불가.
export function normalizeDeferredEventChainSteps(value: unknown, progress: Record<string, unknown> = {}): Record<string, number> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const records = value as Record<string, unknown>;
    const deferred: Record<string, number> = {};
    for (const chain of EVENT_CHAINS) {
        if (!Object.hasOwn(records, chain.id)) continue;
        const step = records[chain.id];
        if (!Number.isSafeInteger(step) || step !== (progress?.[chain.id] ?? 0)) continue;
        const stepData = chain.steps.find((entry) => entry.step === step);
        if (stepData?.event?.outcomes.some((outcome) => outcome.type === 'nothing')) {
            deferred[chain.id] = step as number;
        }
    }
    return Object.keys(deferred).length > 0 ? deferred : undefined;
}

/**
 * 체인별 진행 값은 `Player.eventChainProgress`(types/player.ts)가 정본이다 — 체인 id 키는
 * 스텝 번호 또는 '실패' 마커, 예약 키 `boundedEncounterReceipts`만 영수증 레코드를 담는다.
 */
/**
 * 2026-10 Wave 62 C17: 스텝이 요구하는 심연 층에 닿았는가 — 트리거의 층 판정은 이것 하나다.
 * 층 조건(`minAbyssFloor`)을 가진 스텝은 **지금 싸우는 층**(돌파한 층 `stats.abyssFloor` + 1, Wave 35 층 번호)이
 * 그 층 이상일 때만 발동한다. 조건이 없는 스텝은 언제나 통과한다.
 */
export function isChainStepFloorReached(
    step: { loc?: string; minAbyssFloor?: number },
    clearedAbyssFloor: number | undefined,
): boolean {
    if (typeof step.minAbyssFloor !== 'number') return true;
    const cleared = Number.isFinite(clearedAbyssFloor) ? Math.max(0, Number(clearedAbyssFloor)) : 0;
    return cleared + 1 >= step.minAbyssFloor;
}

/**
 * `clearedAbyssFloor`는 `player.stats.abyssFloor`(돌파한 층 수)다 — 층 조건이 있는 스텝(심연의 신호 1 · 2단계)은
 * 그 층에 닿기 전에는 발동하지 않고, 다른 체인 판정으로 넘어간다(Wave 62 C17).
 */
export function getChainEventForLoc(
    loc: string | undefined,
    progress: EventChainProgress | null | undefined,
    deferredSteps: Record<string, number> | undefined,
    clearedAbyssFloor: number | undefined,
) {
    for (const chain of EVENT_CHAINS) {
        const rawStep = progress?.[chain.id];
        // '실패(fail)' 체인 스킵 — 원래는 완료 검사 뒤에 있었지만 'failed' >= n 은 항상 false라 순서 무관
        if (rawStep === 'failed') continue;
        // 체인 id 키에는 숫자만 온다(레코드는 예약 키 전용) — `?? 0`과 동치
        const currentStep = typeof rawStep === 'number' ? rawStep : 0;
        // 이미 완료된 체인 스킵
        if (currentStep >= chain.steps.length) continue;
        if (deferredSteps?.[chain.id] === currentStep) continue;

        const step = chain.steps[currentStep];
        // Wave 127 · 128: 임무로 여는 단계(`questStart`)는 이벤트가 없다 — 그 자리에서 아무것도 띄우지 않고 다른 체인으로 넘어간다.
        if (isChainEventStep(step) && step.loc === loc && isChainStepFloorReached(step, clearedAbyssFloor)) {
            return { chain, step };
        }
    }
    return null;
}

type EventChainStepEntry = (typeof EVENT_CHAINS)[number]['steps'][number];
/** 이벤트를 띄우는 체인 단계 — 임무로 여는 단계(`questStart`, Wave 127 · 128)가 아닌 모든 단계다. */
export type EventChainEventStep = EventChainStepEntry & { event: NonNullable<EventChainStepEntry['event']> };

export function isChainEventStep(step: EventChainStepEntry | undefined): step is EventChainEventStep {
    return Boolean(step?.event);
}

/** 임무로 여는 단계면 그 임무 · 소문 · 단서, 이벤트 단계면 null. */
export function getChainQuestStart(step: EventChainStepEntry | undefined): ChainQuestStart | null {
    return step && 'questStart' in step && step.questStart ? step.questStart : null;
}

/** 체인 진행 값의 지금 단계 번호 — 시작 전이면 0, 실패했으면 null(체인 id 키에는 숫자 또는 '실패' 마커만 온다). */
const currentChainStepIndex = (progress: EventChainProgress | null | undefined, id: string): number | null => {
    const raw = progress?.[id];
    return typeof raw === 'number' ? raw : raw === undefined ? 0 : null;
};

/**
 * 2026-10 Wave 128: 이 임무가 아직 열리지 않은 이야기를 여는가 — 지금 단계가 그 임무로 여는 단계인 체인과 게시판 소문.
 * 임무 게시판(`questOperations` — 이야기 임무 칸 · 추천 이유)이 읽는다. 이미 연 이야기 · 실패한 이야기는 null이다.
 */
export function getQuestOpenedChain(
    questId: unknown,
    progress: EventChainProgress | null | undefined,
): { chain: (typeof EVENT_CHAINS)[number]; hook: string | null } | null {
    for (const chain of EVENT_CHAINS) {
        const stepIndex = currentChainStepIndex(progress, chain.id);
        if (stepIndex === null) continue;
        const questStart = getChainQuestStart(chain.steps[stepIndex]);
        if (questStart && questStart.questId === questId) return { chain, hook: questStart.hook ?? null };
    }
    return null;
}

/**
 * 2026-10 Wave 127 · 128(소유자 결정 "퀘스트를 통해 자동으로 알게" · "임무로 시작하게"): 지금 단계가 임무로 여는 단계
 * (`questStart`)이고 그 임무를 수령했으면 그 단계를 끝낸다. 임무 수령(`CLAIM_QUEST_REWARD`)과 불러오기(`LOAD_DATA` — 이
 * 규칙 전에 그 임무를 받고 0단계 이벤트를 지나친 세이브)가 이것 하나를 읽는다. 열린 단계가 없으면 같은 참조를 돌려준다.
 */
export function advanceQuestStartedChains(
    progress: EventChainProgress | null | undefined,
    claimedQuestIds: readonly unknown[] | null | undefined,
): { progress: EventChainProgress; started: Array<{ label: string; log: string }> } {
    const current: EventChainProgress = progress || {};
    const claimed = Array.isArray(claimedQuestIds) ? claimedQuestIds : [];
    let next = current;
    const started: Array<{ label: string; log: string }> = [];
    for (const chain of EVENT_CHAINS) {
        const stepIndex = currentChainStepIndex(current, chain.id);
        if (stepIndex === null) continue;
        const questStart = getChainQuestStart(chain.steps[stepIndex]);
        if (!questStart || !claimed.includes(questStart.questId)) continue;
        next = { ...next, [chain.id]: stepIndex + 1 };
        started.push({ label: chain.label, log: questStart.log });
    }
    return { progress: next, started };
}
