import { DEATH_LORE, type DeathLoreGroup, type DeathLoreLine } from '../data/deathLore.js';
import type { Monster } from '../types/monster.js';
import { getChapterOf } from './chapters.js';

/**
 * 2026-11 B6 돌기둥의 증언 (명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md` §2):
 * 전투 패배 한 번 = 증언 한 줄(새 줄 또는 이미 들은 줄). 장부 `stats.deathLore`(계정 범위, 들은 순서 · 중복 없음)는
 * 패배 전이(`combatHandlers.settleNonVictory`) 한 곳이 쓰고 `pickPermanentPlayerState`가 사망 · 계승 너머로 운반한다.
 * 선택은 난수를 쓰지 않는다 — 묶음 안의 순서와 계정 사망 수만으로 정해진다.
 */
export const ABYSS_LOCATION = '혼돈의 심연';

export type DeathLoreKind = 'strong' | 'field';

export interface DeathLoreView {
    id: string;
    text: string;
    isNew: boolean;
    collected: number;
    total: number;
}

const KNOWN_IDS: ReadonlySet<string> = new Set(DEATH_LORE.map((entry) => entry.id));

export const DEATH_LORE_TOTAL = DEATH_LORE.length;

/** 저장된 장부를 읽는다: 문자열 배열 · 알려진 id만 · 순서 유지 · 중복 제거. 없으면 빈 장부. */
export const readDeathLoreLedger = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const ledger: string[] = [];
    for (const id of value) {
        if (typeof id !== 'string' || !KNOWN_IDS.has(id) || seen.has(id)) continue;
        seen.add(id);
        ledger.push(id);
    }
    return ledger;
};

/** 쓰러진 자리 → 묶음. 장 지역이면 그 장, 혼돈의 심연이면 abyss, 그 밖(안전지대 · 계절 · 열쇠 지역)은 wild. */
export const getDeathLoreGroup = (loc: unknown): DeathLoreGroup => {
    if (loc === ABYSS_LOCATION) return 'abyss';
    const chapter = getChapterOf(loc);
    return chapter === null ? 'wild' : `c${chapter}`;
};

/** 쓰러뜨린 적 → 종류. 보스 · 정예 · 토벌 우두머리면 강적, 그 밖(적이 없는 이상 상태 포함)은 일반. */
export const getDeathLoreKind = (enemy: Partial<Monster> | null | undefined): DeathLoreKind => (
    enemy && (enemy.isBoss || enemy.isElite || enemy.huntChampion) ? 'strong' : 'field'
);

const pickLine = (
    heard: ReadonlySet<string>,
    group: DeathLoreGroup,
    kind: DeathLoreKind,
    deathCount: number,
): DeathLoreLine | null => {
    const lines = DEATH_LORE.filter((entry) => entry.group === group);
    if (lines.length === 0) return null;
    const strongLine = lines.find((entry) => entry.strong && !heard.has(entry.id));
    if (kind === 'strong' && strongLine) return strongLine;
    const fieldLine = lines.find((entry) => !entry.strong && !heard.has(entry.id));
    if (fieldLine) return fieldLine;
    if (strongLine) return strongLine;
    // 묶음을 다 들었다 — 같은 묶음의 들은 줄을 계정 사망 수로 돈다(다른 묶음의 줄을 끌어오지 않는다).
    const index = Math.max(0, Math.floor(deathCount)) % lines.length;
    return lines[index];
};

/**
 * 이번 패배의 증언을 고르고 장부를 늘린다(순수 함수). `deathCount`는 이 사망을 센 뒤의 계정 사망 수다.
 * 고를 줄이 없으면(데이터 결함) 장부를 그대로 두고 view는 null이다.
 */
export const recordDeathLore = (
    ledgerValue: unknown,
    loc: unknown,
    enemy: Partial<Monster> | null | undefined,
    deathCount: number,
): { ledger: string[]; view: DeathLoreView | null } => {
    const ledger = readDeathLoreLedger(ledgerValue);
    const heard = new Set(ledger);
    const chosen = pickLine(heard, getDeathLoreGroup(loc), getDeathLoreKind(enemy), deathCount);
    if (!chosen) return { ledger, view: null };
    const isNew = !heard.has(chosen.id);
    const nextLedger = isNew ? [...ledger, chosen.id] : ledger;
    return {
        ledger: nextLedger,
        view: { id: chosen.id, text: chosen.text, isNew, collected: nextLedger.length, total: DEATH_LORE_TOTAL },
    };
};

/** 들은 증언(들은 순서). 모르는 id는 건너뛴다. */
export const getHeardDeathLore = (ledgerValue: unknown): DeathLoreLine[] => {
    const byId = new Map(DEATH_LORE.map((entry) => [entry.id, entry]));
    return readDeathLoreLedger(ledgerValue)
        .map((id) => byId.get(id))
        .filter((entry): entry is DeathLoreLine => Boolean(entry));
};
