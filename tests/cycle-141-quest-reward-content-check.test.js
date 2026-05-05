import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { QUESTS, ACHIEVEMENTS } from '../src/data/quests.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';

/**
 * cycle 141: quest / achievement reward.item baseline 가드 — known content gap.
 *
 * cycle 140이 이벤트 체인의 7건 missing item을 발견·수정한 후 같은 패턴을
 * QUESTS / ACHIEVEMENTS에서도 검증해 보니 75종의 unique missing item 발견
 * (40 quests + 40 achievements references). 모든 reward가 silent no-op.
 *
 * 이 컨텐츠 갭은 큰 데이터 정리(75개 신규 items.ts 등록 또는 이름 매핑) 사이클이
 * 필요해 단일 cycle 범위 초과. 대신 이번 사이클은:
 *
 * 1. 현재 missing 75종을 baseline으로 기록 — 명시 인정.
 * 2. NEW missing item(이 baseline 외 추가)이 생기면 즉시 실패 — 회귀 가드.
 * 3. baseline 줄어들면 (콘텐츠 정리 진행됐다면) 즉시 실패 — 점진 좁히기.
 *
 * 결국 baseline이 0이 될 때까지 이 테스트가 진행도를 lock한다.
 */

const allItemNames = new Set();
for (const bucket of Object.values(DB.ITEMS || {})) {
    if (Array.isArray(bucket)) {
        for (const item of bucket) {
            if (item?.name) allItemNames.add(item.name);
        }
    }
}

// cycle 141 시점 baseline (75종) — 향후 사이클에서 콘텐츠 정리 진행 시 줄여나감.
const KNOWN_MISSING_REWARD_ITEMS = new Set([
    '강인함의 증표', '강화된 갑옷', '고대의 파편', '공허의 핵심',
    '균열 봉인석', '기계 문명의 유산', '기적의 부적', '대연금술사 코트',
    '대장장이 망치', '도적의 망토', '마법사의 로브', '무한의 결정체',
    '방랑자의 외투', '보스 사냥꾼 인장', '보스 사냥꾼 증표', '보스 토벌 증표',
    '부서진 기어', '부활의 깃털', '불의 시험 증표', '불의 정수',
    '생존자의 반지', '세계 구원자의 증표', '세계 지도 원본', '세계 탐험 지도',
    '세계수의 이슬', '세트 완성의 증표', '수정 조각', '수호자의 파편',
    '신전의 성광석', '신화 사냥 훈장', '신화 전설 영혼', '심연 수호자의 코어',
    '심연 지배 증표', '심연의 결정', '심연의 파편',
    '에테르 집대성의 왕관', '에테르 탐사 보고서', '엘프의 단검', '연금술사 장갑',
    '영겁의 수정', '영웅의 단검', '영웅의 증표', '영웅의 훈장',
    '유물 감정서', '장인의 도구', '전사의 반지', '전사의 훈장',
    '전설 레시피', '전설 유물 봉인서', '전설 제작 증표', '전설 학살 증표',
    '전설 현상금 배지', '전설 현상수배 증표', '전설의 갑주', '전설의 반지',
    '전설의 영혼석', '전설의 장인 도구', '전직 증표', '차원의 단편',
    '초월의 징표', '초월자의 증표', '탐험가의 외투', '탐험가의 장화',
    '탐험가의 지도', '투사의 증표', '파수꾼의 인장', '학살의 대검',
    '학살자의 칭호증', '해방의 빙정', '현상금 배지', '현상금 사냥꾼의 망토',
    '환생의 결정', '황금 갑주', '황금 반지', '황금 열쇠',
]);

const collectMissing = (entries) => {
    const missing = [];
    for (const e of entries) {
        if (typeof e?.reward?.item === 'string' && !allItemNames.has(e.reward.item)) {
            missing.push(e.reward.item);
        }
    }
    return missing;
};

test('quest/achievement reward.item: NEW missing item 0건 (회귀 가드)', () => {
    const missingNames = new Set([...collectMissing(QUESTS), ...collectMissing(ACHIEVEMENTS)]);
    const newMissing = [...missingNames].filter((n) => !KNOWN_MISSING_REWARD_ITEMS.has(n));
    assert.deepEqual(newMissing, [],
        `NEW missing items detected (need to add to items.ts or to baseline):\n  ${newMissing.join('\n  ')}`);
});

test('quest/achievement reward.item: baseline 좁히기 — 등록된 known missing이 실제 missing에서 사라지면 baseline에서도 제거 (점진 정리)', () => {
    const missingNames = new Set([...collectMissing(QUESTS), ...collectMissing(ACHIEVEMENTS)]);
    const staleBaseline = [...KNOWN_MISSING_REWARD_ITEMS].filter((n) => !missingNames.has(n));
    assert.deepEqual(staleBaseline, [],
        `stale baseline (these items are now defined — remove from KNOWN_MISSING_REWARD_ITEMS):\n  ${staleBaseline.join('\n  ')}`);
});

test('cycle 140 회귀 가드: EVENT_CHAINS 보상은 모두 실재 item (cycle 140 fix 보존)', () => {
    // cycle 140 baseline (이벤트 체인은 실제로 모두 fix 됨) — 0이어야 함.
    const missing = [];
    for (const chain of (EVENT_CHAINS || [])) {
        for (const step of (chain.steps || [])) {
            for (const outcome of (step.event?.outcomes || [])) {
                const rwd = outcome.reward;
                if (rwd && (rwd.type === 'item' || rwd.type === 'legendary_item') && rwd.name) {
                    if (!allItemNames.has(rwd.name)) missing.push(rwd.name);
                }
            }
        }
    }
    assert.deepEqual(missing, [], 'EVENT_CHAINS rewards should all reference existing items');
});
