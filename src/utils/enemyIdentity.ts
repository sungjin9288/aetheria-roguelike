import { CONSTANTS, type MonsterPrefixDef } from '../data/constants.js';

/**
 * 적 이름의 identity — 임무 목표 판정이 읽는 "이 적은 무엇인가".
 *
 * 생산자는 `spawnEnemy`(exploreUtils) 하나다: `baseName`이 종(種)이고, 표시용 `name`은
 * 그 위에 장식이 붙은 형태 둘뿐이다 — `${접두어} ${baseName}`(CONSTANTS.MONSTER_PREFIXES의
 * name 또는 초반 정예 `EARLY_ELITE_PREFIX_NAME`) · `[${depth}층] ${baseName}`(무한 심연).
 * 임무 목표는 종과 정확히 일치해야 한다. **substring 판정은 금지** — `'마왕의 사도'.includes('마왕')`이
 * 종장 임무 87을 마왕 승리 전에 완료시켰다(원장 §26.11). 가족 이름(`초록슬라임` vs `슬라임`,
 * `사슬 마왕` vs `마왕`)은 서로 다른 종이다.
 */
export const EARLY_ELITE_PREFIX_NAME = '정예';

const DECORATION_PREFIXES: ReadonlySet<string> = new Set<string>([
    ...CONSTANTS.MONSTER_PREFIXES.map((prefix) => prefix.name),
    EARLY_ELITE_PREFIX_NAME,
]);

/**
 * 이 종에 붙을 수 있는 무작위 접두어(2026-10 Wave 71, 소유자 결정 "접두어 겹치는 경우 빼기") — 종 이름에 이미 있는
 * 낱말의 접두어는 뺀다. "거대 사슴벌레"에 `거대`, "고대 마법사"에 `고대`가 붙어 "거대 거대 사슴벌레"가 됐다.
 * `spawnEnemy`가 이 풀에서 고른다(정예 · 초반 비정예 거르기는 그 위에서, 롤 수는 그대로).
 */
export const getSpeciesPrefixPool = (baseName: string | null | undefined): MonsterPrefixDef[] => {
    const words = new Set(String(baseName ?? '').split(/\s+/).filter(Boolean));
    return CONSTANTS.MONSTER_PREFIXES.filter((prefix) => !words.has(prefix.name));
};

/** `[N층] ` 무한 심연 층 태그 — spawnEnemy의 `[${depth}층] ${baseName}` 형식. */
const DEPTH_TAG = /^\[\d+층\]\s+/;

/**
 * 표시 이름에서 장식(층 태그 · 알려진 접두어 1개)만 벗겨 종 이름을 돌려준다.
 * 알려진 접두어가 아니면 첫 단어를 자르지 않는다 — `'마왕의 사도'`는 `'사도'`가 되지 않는다.
 */
export const stripEnemyDecoration = (name: string): string => {
    const undepth = name.replace(DEPTH_TAG, '');
    const space = undepth.indexOf(' ');
    if (space > 0 && DECORATION_PREFIXES.has(undepth.slice(0, space))) return undepth.slice(space + 1);
    return undepth;
};

/**
 * 임무 목표 판정: 종 이름(또는 장식만 벗긴 표시 이름)이 목표와 **정확히** 같을 때만 참.
 * 호출자는 가능하면 `enemy.baseName`을 넘긴다(combatVictory가 그렇게 한다); 표시 이름만
 * 있는 레거시 적도 장식을 벗겨 같은 결과를 낸다.
 */
export const matchesQuestTarget = (enemyName: string | undefined, target: string | undefined): boolean => {
    if (!enemyName || !target) return false;
    return enemyName === target || stripEnemyDecoration(enemyName) === target;
};
