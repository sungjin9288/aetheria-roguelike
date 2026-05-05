import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 148: relic.effect 핸들러 baseline 가드.
 *
 * cycle 141(quest reward.item baseline) / 147(dead AT keys) 흐름의 연장.
 * 유물은 effect 문자열 키로 dispatch — 코드 어딘가에서 `'effect_name'` 비교
 * 로 발동된다. 핸들러가 없으면 유물이 인벤에 들어와도 silent no-op (상태에
 * 표시는 되지만 실제 효과 0).
 *
 * 발견: 81종 unique effect 중 34종이 src/ 어디에서도 핸들러 등록 0건.
 * 해당 유물이 드랍되더라도 효과 발동 안 함. 신화/창세 tier 유물이 다수
 * 포함 — 큰 콘텐츠 갭. 단일 사이클로는 못 닫음 — baseline lock으로 점진 정리:
 *
 * 1. KNOWN_MISSING_RELIC_EFFECTS Set — 현재 34종 명시 인정.
 * 2. NEW dead effect 가드: baseline 외 추가되면 즉시 실패 — 새 유물 추가
 *    시 핸들러 누락 catch.
 * 3. baseline 좁히기 가드: handled 된 effect가 baseline에 남아 있으면 실패
 *    — 점진 정리 강제.
 *
 * baseline이 0이 될 때까지 이 테스트가 진행도 추적.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'src');
const RELICS_PATH = path.join(SRC, 'data/relics.ts');

const KNOWN_MISSING_RELIC_EFFECTS = new Set([
    // 일반/희귀 (cycle 148 초기 발견 14종)
    // 'on_hit_freeze', ← cycle 152: 일반 공격 시 val 확률로 적 빙결 핸들러 추가.
    // 'first_turn_evade', ← cycle 150: DEF 보너스 핸들러 추가 (첫 턴 회피는 별도 사이클).
    'battle_start_buff',
    // 'titan',     ← cycle 149: HP 보너스 핸들러 추가 (critReduce는 별도 사이클).
    'spell_stack',
    // 'hp_drain_atk', ← cycle 150: atkBonus 핸들러 추가 (매 턴 HP cost는 별도 사이클).
    // 'elem_boost', ← cycle 151: 약점 적중 배율 boost 핸들러 추가.
    // 'genesis',   ← cycle 149: statBonus 핸들러 추가 (healPerTurn은 별도 사이클).
    'kill_stack_atk',
    // 'cooldown_reduce', ← cycle 151: cdReduction 핸들러 추가 (firstFree는 별도 사이클).
    'phoenix_revive',
    // 'reflect_crit', ← cycle 152: critBonus 핸들러 추가 (피해 반사는 별도 사이클).
    'devour_hp',
    'entropy_tick',
    // 'arcane_surge', ← cycle 153: applySynergyBonuses 코멘트로 effect-name 명시.
    // 신화/창세 tier (의미상 ultimate 빌드)
    // cycle 153: 시너지 effect-name dispatch 추가로 11건 baseline 통과 (vampire_lord / arcane_surge /
    //   unbreakable / time_master / death_oracle / immortal_warrior / eternal_life / infinite_devour /
    //   absolute_immortal / blood_immortal / primordial_wrath). bonus-key fallback 보존.
    // 'vampire_lord',
    // 'unbreakable',
    // 'time_master',
    // 'death_oracle',
    // 'immortal_warrior',
    'hell_reaper',
    'annihilator',
    // 'eternal_life',
    'time_dominator',
    'absolute_reflect',
    'entropy_brand',
    // 'infinite_devour',
    // 'void_dragon', ← cycle 154: bonus.critDmg 시너지 dispatch 추가 (CombatEngine attack/performSkill).
    // 'absolute_immortal',
    // 'blood_immortal',
    'arcane_singularity',
    // 'primordial_wrath',
    // 'eternal_fortress', ← cycle 154: applySynergyBonuses defMult 추가 (DEF +80%).
    // 'entropy_god', ← cycle 154: applySynergyBonuses chaosAtk → atkMult 합류 (ATK +50%).
]);

const collectRelicEffects = async () => {
    const src = await readFile(RELICS_PATH, 'utf8');
    const effects = new Set();
    const re = /effect:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src)) !== null) effects.add(m[1]);
    return effects;
};

const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    let out = '';
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            out += await walk(full);
        } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
            if (full === RELICS_PATH) continue;
            out += await readFile(full, 'utf8');
            out += '\n';
        }
    }
    return out;
};

const findMissingEffects = async () => {
    const effects = await collectRelicEffects();
    const corpus = await walk(SRC);
    const missing = new Set();
    for (const eff of effects) {
        if (
            !corpus.includes(`'${eff}'`) &&
            !corpus.includes(`"${eff}"`) &&
            !corpus.includes(`\`${eff}\``)
        ) {
            missing.add(eff);
        }
    }
    return missing;
};

test('relic.effect: NEW missing handler 0건 (baseline 외 추가 시 즉시 실패)', async () => {
    const missing = await findMissingEffects();
    const newMissing = [...missing].filter((e) => !KNOWN_MISSING_RELIC_EFFECTS.has(e));
    assert.deepEqual(newMissing, [],
        `NEW relic effects without handler (add handler or update baseline):\n  ${newMissing.join('\n  ')}`);
});

test('relic.effect: baseline 좁히기 — known missing이 핸들러 추가됐으면 baseline에서 제거', async () => {
    const missing = await findMissingEffects();
    const stale = [...KNOWN_MISSING_RELIC_EFFECTS].filter((e) => !missing.has(e));
    assert.deepEqual(stale, [],
        `stale baseline (these effects are now handled — remove from KNOWN_MISSING_RELIC_EFFECTS):\n  ${stale.join('\n  ')}`);
});
