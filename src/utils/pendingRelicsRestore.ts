import { RELICS } from '../data/relics.js';
import type { Player } from '../types/player.js';
import type { Relic } from '../types/relic.js';

/**
 * 세이브에 실린 유물 제안(`pendingRelics`)을 되살리는 규칙 (2026-09 Wave 34, 원장 §27.6 잔여 → §34).
 *
 * 유물 선택(발견 3택 · 시작 부트 · 체인 완주 보상 · 상한 교체 제안)이 떠 있는 동안 리로드하면 제안이 사라졌다 —
 * 제안을 만든 사건은 이미 저장돼 다시 오지 않으므로 보상 소실이다. 이제 봉투에 싣되, 로드 때는 **id만 믿는다**:
 * 세이브의 필드(이름 · 값)가 아니라 `RELICS` 정의를 되살리고, 모르는 id · 중복 · 모양이 틀린 값은 버린다.
 */
export const sanitizeSavedPendingRelics = (raw: unknown): Relic[] | null => {
    if (!Array.isArray(raw)) return null;
    const seen = new Set<string>();
    const restored: Relic[] = [];
    for (const entry of raw) {
        const id = entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : undefined;
        if (typeof id !== 'string' || seen.has(id)) continue;
        const relic = RELICS.find((candidate) => candidate.id === id);
        if (!relic) continue;
        seen.add(id);
        restored.push(structuredClone(relic));
    }
    return restored.length > 0 ? restored : null;
};

/** 로드한 플레이어가 이미 가진 유물은 제안에서 뺀다(남는 게 없으면 null). */
export const restorePendingRelics = (raw: unknown, player: Pick<Player, 'relics'>): Relic[] | null => {
    const owned = new Set((player.relics || []).map((relic) => relic.id));
    const restored = (sanitizeSavedPendingRelics(raw) || []).filter((relic) => !owned.has(relic.id));
    return restored.length > 0 ? restored : null;
};
