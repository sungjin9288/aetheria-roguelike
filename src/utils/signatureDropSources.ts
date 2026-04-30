/**
 * signatureDropSources.js — signature 이름 → 드롭 가능한 몬스터 역 인덱스.
 *
 * LegendaryCodex detail 패널 "획득처" 표시용. bossSignatureHint의 쌍둥이 헬퍼다.
 * bossSignatureHint: monster → [signatures]
 * signatureDropSources: signature → [monsters]
 *
 * DROP_TABLES와 SIGNATURE_ITEM_REGISTRY를 빌드 시 한 번만 교차 스캔해서 Map을 만든다.
 * 레지스트리에는 있지만 드롭 경로가 없는 signature는 "영원히 획득 불가"이므로
 * tests/signature-drop-sources.test.js가 완전성 가드를 걸어둔다.
 */

import { DROP_TABLES } from '../data/dropTables.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';

/**
 * @typedef {{ monster: string, rate: number }} SignatureDropSource
 */

/** @type {Record<string, SignatureDropSource[]>} */
const buildSourceIndex = () => {
    /** @type {Record<string, SignatureDropSource[]>} */
    const index = {};
    // 모든 signature에 빈 배열 기본값 — consumer가 Array.isArray 체크 없이 쓸 수 있게
    for (const name of Object.keys(SIGNATURE_ITEM_REGISTRY)) {
        index[name] = [];
    }
    for (const [monster, drops] of Object.entries(DROP_TABLES)) {
        if (!Array.isArray(drops)) continue;
        for (const drop of drops) {
            const itemName = drop?.item;
            if (!itemName || !SIGNATURE_ITEM_REGISTRY[itemName]) continue;
            const rate = Number(drop.rate) || 0;
            index[itemName].push({ monster, rate });
        }
    }
    // rate 내림차순
    for (const name of Object.keys(index)) {
        index[name].sort((a, b) => b.rate - a.rate);
        Object.freeze(index[name]);
    }
    return Object.freeze(index);
};

const SOURCE_INDEX = buildSourceIndex();

/**
 * signature 아이템의 드롭 가능한 몬스터 목록 (rate 내림차순).
 *
 * @param {string | null | undefined} itemName
 * @returns {ReadonlyArray<SignatureDropSource>} 미등록/null → []
 */
export const getSignatureDropSources = (itemName) => {
    if (!itemName || typeof itemName !== 'string') return [];
    return SOURCE_INDEX[itemName] || [];
};

/**
 * 전체 signature 드롭 역 인덱스 (완전성 검증/벌크 UI용).
 *
 * @returns {Readonly<Record<string, ReadonlyArray<SignatureDropSource>>>}
 */
export const getAllSignatureDropSourceIndex = () => SOURCE_INDEX;
