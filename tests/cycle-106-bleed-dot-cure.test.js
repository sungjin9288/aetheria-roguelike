import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';

/**
 * cycle 106: bleed 상태이상 DoT 누락 회귀 fix + 라벨 매핑.
 *
 * 발견된 버그:
 * - 보스 phase 2/3가 statusEffect: 'bleed'를 player에 부여할 수 있음 (CombatEngine
 *   p2/p3 처리에서 currentStatus.push). 그러나 player DoT 처리 분기는
 *   `const DOT_STATUSES = ['poison', 'burn']`로 bleed 누락 — bleed 상태가 표시
 *   만 되고 실제 피해를 주지 못함.
 * - 적의 DoT (enemy.dots) 처리는 bleed 포함 정상 동작 — 비대칭 회귀.
 * - 결과: 보스 phase 3 차원 분열자의 bleed 부여가 의도와 달리 무해. 보스
 *   설계 의도(처음 phase 3에 진입하면 위험 증폭)가 작동 안 함.
 *
 * 수정:
 * 1. CombatEngine player DoT 분기의 DOT_STATUSES에 'bleed' 추가.
 * 2. MSG.STATUS_DOT 라벨 매핑에 'bleed' → '출혈' 추가 — 기존엔 영문 'bleed'
 *    가 그대로 노출되던 자리.
 *
 * 별도 cure 아이템(지혈제) 추가는 itemVisuals.EXACT_ITEM_ICON_KEYS / asset
 * 매핑이 consumable index에 의존해 신규 PNG 자산이 필요하므로 다음 사이클로
 * 미룸. 회피 옵션은 purify 스킬(메이지) / 휴식(안전지대) / TURN-based decay.
 *
 * 영향:
 * 보스 phase 3 진입 후 bleed 부여 시 매 턴 maxHp의 4% 피해 (BALANCE.STATUS_DOT_RATIO).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('CombatEngine: player DOT_STATUSES에 bleed 포함', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.match(source, /DOT_STATUSES\s*=\s*\[[^\]]*['"]bleed['"]/);
});

test('items: 기존 cure 아이템 4종 회귀 보존', () => {
    // cycle 106 phase 1: 지혈제는 itemVisuals 자산 매핑 제약으로 다음 사이클로 미룸.
    const cures = (DB.ITEMS.consumables || []).filter((c) => c.type === 'cure');
    const effects = cures.map((c) => c.effect).sort();
    assert.deepEqual(effects, ['burn', 'curse', 'freeze', 'poison']);
});

test('MSG.STATUS_DOT: bleed → 출혈 라벨 매핑', () => {
    const msg = MSG.STATUS_DOT('bleed', 12);
    assert.match(msg, /출혈/, 'should map bleed to 출혈');
    assert.match(msg, /12/, 'damage value should appear');
});

test('MSG.STATUS_DOT: 기존 poison/burn 라벨 회귀 보존', () => {
    assert.match(MSG.STATUS_DOT('poison', 5), /중독/);
    assert.match(MSG.STATUS_DOT('burn', 7), /화상/);
});
