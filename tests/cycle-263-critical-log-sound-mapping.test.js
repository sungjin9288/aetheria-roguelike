import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 263: 'critical' 로그 타입 sensory cue 누락 dead config
 *   (cycle 222-262 silent dead config 시리즈 34번째).
 *
 * 발견 (sensory cue gap):
 * - useGameEngine.tsx:48-52에서 lastLog.type → soundManager.play 매핑:
 *   combat→attack / levelUp→levelUp / error→error / item→item / legendary→legendary.
 * - 그러나 'critical' 로그 타입(crit hit 시 MSG.COMBAT_CRIT, 보스 reveal 등 14건)에 대한
 *   sound 매핑 누락.
 * - 결과: 일반 공격은 'attack' 사운드 재생되지만 크리티컬 hit은 무음 — 전투 피드백
 *   퇴행. 강화된 hit이 약화된 hit처럼 들림.
 *
 * 발생 경로:
 * - CombatEngine: isCrit 시 logs.push({ type: 'critical', text: MSG.COMBAT_CRIT }) — 일반
 *   공격 'combat' 로그 직후 'critical' 추가 → lastLog는 'critical' → 매핑 X → 무음.
 * - executeAtkTriggered (예언의 돌판), phase3 보스 변신 등도 'critical' 로그.
 *
 * 패턴 (cycle 222-262 silent dead config 시리즈 34번째):
 * - cycle 122-123: quest_complete 사운드 도입.
 * - cycle 217-220: levelUp/death/victory/skill/heal/explore 사운드.
 * - cycle 261: claim 액션 sensory cue paired completion.
 * - cycle 263: 'critical' 로그 sensory cue paired completion.
 *
 * 수정 (src/hooks/useGameEngine.ts):
 * - lastLog 사운드 매핑에 'critical' → 'attack' 추가 (combat과 동일 — 강화된 hit도 attack 결).
 *
 * 회귀 가드:
 * - 기존 5개 매핑 (combat/levelUp/error/item/legendary) 동작 유지.
 * - lastLog 의존성 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 263: useGameEngine에서 critical 로그 타입 → attack 사운드 매핑', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(/lastLog\.type === ['"]critical['"][\s\S]{0,80}soundManager\.play\(['"]attack['"]\)/.test(source),
        "useGameEngine에 lastLog.type === 'critical' → soundManager.play('attack') 매핑 추가");
});

test('cycle 263: 기존 5개 사운드 매핑 동작 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    const mappings = [
        ['combat', 'attack'],
        ['levelUp', 'levelUp'],
        ['error', 'error'],
        ['item', 'item'],
        ['legendary', 'legendary'],
    ];
    mappings.forEach(([logType, sound]) => {
        const re = new RegExp(`lastLog\\.type === ['"]${logType}['"][\\s\\S]{0,60}soundManager\\.play\\(['"]${sound}['"]\\)`);
        assert.ok(re.test(source), `'${logType}' → '${sound}' 매핑 유지`);
    });
});

test('cycle 263: critical 로그 타입이 CombatEngine에서 사용 (회귀 가드)', async () => {
    // slice 19: 중복 COMBAT_CRIT 별도 로그가 본문 태그로 통합되면서 literal
    //   `type: 'critical'` 수가 줄었다. crit 시 main 로그가 ternary
    //   (isCrit ? 'critical' : 'combat')로 critical 타입을 유지하므로
    //   literal + ternary 양쪽을 합산해 가드한다.
    const source = await readSrc('src/systems/CombatEngine.ts');
    const literal = source.match(/type:\s*['"]critical['"]/g) || [];
    const ternary = source.match(/isCrit\s*\?\s*['"]critical['"]/g) || [];
    assert.ok(literal.length + ternary.length >= 3,
        `CombatEngine에 'critical' 로그 ≥3건 (literal ${literal.length} + ternary ${ternary.length})`);
});
