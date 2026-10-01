/**
 * signatureSale.ts — 전설 각인(서명) 아이템의 판매 가능 판정 (2026-09 Wave 28, 소유자 결정 D4).
 *
 * 서명 아이템은 실수로 팔지 못하게 판매가 막혀 있었다. 그런데 수집 기록(도감)은 **획득 순간**
 * `stats.codex`에 남고(signatureDiscovery.ts) 승천을 넘어 보존되며, 가방은 승천 때 비워진다
 * (permanentProgress.ts). 즉 가방 속 사본의 가치는 "이번 런에 장착할 수 있느냐"뿐이다 — 쓸 수 없는
 * 사본까지 막은 결과 Lv50 이후 가방 7~11칸이 영구 점유돼 전리품 80~92%가 용량에 막혔다(자연 플레이 감사).
 *
 * 규칙: 서명 사본은 **① 같은 이름의 사본이 가방·장비에 하나 더 있거나 ② 현재 직업과 앞으로 전직할 수 있는
 * 모든 직업(`CLASSES[*].next` 전이 폐포)이 착용할 수 없을 때만** 판매할 수 있다. 쓸 수 있는 유일한 사본은
 * 계속 보호한다. 직업 판정은 착용 검증(`canEquip`)과 같은 규칙(`item.jobs` 목록)을 쓴다.
 * 현재 직업을 알 수 없으면 ②는 성립하지 않는다(fail-closed — 모르면 보호한다).
 */
import { CLASSES } from '../data/classes';
import { getSignatureBaseName } from '../data/signatureItems';
import type { Item, Player } from '../types/index.js';

export type SignatureSaleReason = 'duplicate' | 'off-path' | 'protected';

export interface SignatureSaleVerdict {
    sellable: boolean;
    reason: SignatureSaleReason;
}

/** 현재 직업과, 거기서 전직으로 도달할 수 있는 모든 직업. 알 수 없는 직업이면 빈 집합이다. */
export const getJobPath = (job: string | null | undefined): Set<string> => {
    const path = new Set<string>();
    if (!job || !Object.hasOwn(CLASSES, job)) return path;
    const queue = [job];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        if (path.has(current)) continue;
        path.add(current);
        for (const next of CLASSES[current]?.next || []) {
            if (!path.has(next) && Object.hasOwn(CLASSES, next)) queue.push(next);
        }
    }
    return path;
};

// 2026-10 Wave 58: 사본은 전설 각인 바탕 이름으로 센다 — 접두어가 붙은 사본("날카로운 라그나로크")도 같은 전설 각인이다.
const countCopies = (player: Player, baseName: string) => {
    const isCopy = (entry: Item | null | undefined) => getSignatureBaseName(entry) === baseName;
    const inBag = (player.inv || []).filter(isCopy).length;
    const equip = player.equip || {};
    const equipped = [equip.weapon, equip.armor, equip.offhand].filter(isCopy).length;
    return inBag + equipped;
};

/** 서명이 아니면 null — 일반 아이템의 판매 규칙은 이 판정과 무관하다. */
export const getSignatureSaleVerdict = (
    item: Item | null | undefined,
    player: Player,
): SignatureSaleVerdict | null => {
    const baseName = getSignatureBaseName(item);
    if (!item || !baseName) return null;
    if (countCopies(player, baseName) >= 2) return { sellable: true, reason: 'duplicate' };

    const jobs = item.jobs;
    const path = getJobPath(player.job);
    if (Array.isArray(jobs) && path.size > 0 && ![...path].some((job) => jobs.includes(job))) {
        return { sellable: true, reason: 'off-path' };
    }
    return { sellable: false, reason: 'protected' };
};
