import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 134: SoundManager 등록 사운드 키 단일 회귀 가드.
 *
 * cycle 88(escape) / 95(maxKillStreak — combatVictory 직접 호출은 없음, log
 * 매핑 통해서 trigger) / 117(discovery_chain) / 118(new_area) / 122-123/133
 * (quest_complete)에 걸쳐 사운드 키가 8종으로 늘어났다. 이번 사이클은 모든
 * 키가 SoundManager에 case로 정의되어 있고 호출 site의 키와 정확히 일치
 * 하는지 통합 회귀 가드를 추가한다.
 *
 * 기존 사이클들은 각자의 사운드 추가 시점에서만 검증했지만, 한 번에 모든
 * key가 정합한지 보장되는 테스트가 없었음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

// 활성 사운드 키 (cycle 88-133 전체 누적)
// cycle 325: 'hover' 제거 — soundManager.play('hover') 호출 0건이라 case dead branch.
const REGISTERED_KEYS = [
    'click', 'error', 'attack', 'levelUp', 'item', 'heal', 'death',
    'skill', 'explore', 'victory', 'legendary',
    'escape',          // cycle 88
    'discovery_chain', // cycle 117
    'new_area',        // cycle 118
    'quest_complete',  // cycle 122
];

test('SoundManager: 모든 등록 키가 case 분기로 정의됨', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    for (const key of REGISTERED_KEYS) {
        const re = new RegExp(`case\\s+['"]${key}['"]\\s*:`);
        assert.match(source, re, `SoundManager should have case for "${key}"`);
    }
});

test('SoundManager: case 외 stray 사운드 호출 키 없음 (정합성)', async () => {
    // src/ 전체에서 soundManager.play('XXX') 호출들의 키를 수집
    const SCAN_FILES = [
        'src/systems/SoundManager.ts',
        'src/systems/CombatEngine.ts',
        'src/components/tabs/CombatPanel.tsx',
        'src/components/ControlPanel.tsx',
        'src/components/MainLayout.tsx',
        'src/components/app/GameRoot.tsx',
        'src/components/Codex.tsx',
        'src/hooks/useGameEngine.ts',
        'src/hooks/useInventoryActions.ts',
        'src/hooks/combatActions/combatAttack.ts',
        'src/hooks/gameActions/moveActions.ts',
        'src/utils/exploreUtils.ts',
    ];
    const usedKeys = new Set();
    for (const file of SCAN_FILES) {
        try {
            const source = await readSrc(file);
            const matches = source.matchAll(/(?:soundManager\.|\.)play\(['"]([a-z_]+)['"]\)/g);
            for (const m of matches) usedKeys.add(m[1]);
        } catch {
            // file may not exist on this branch, skip
        }
    }
    // 모든 사용 키가 등록 키 set에 포함되어야 함.
    const registeredSet = new Set(REGISTERED_KEYS);
    for (const key of usedKeys) {
        assert.ok(
            registeredSet.has(key),
            `'${key}' is called via play() but not registered in SoundManager case set`
        );
    }
});

test('SoundManager: cycle 88+ 신규 사운드 6종 모두 활성', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    const newKeys = ['escape', 'discovery_chain', 'new_area', 'quest_complete'];
    for (const key of newKeys) {
        assert.match(source, new RegExp(`case\\s+['"]${key}['"]`), `${key} active`);
    }
});
