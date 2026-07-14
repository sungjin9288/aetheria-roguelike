import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('native boot keeps internal stage as data and shows a player-facing message', async () => {
    const source = await readSrc('src/components/app/BootScreen.tsx');

    assert.match(source, /data-boot-stage=\{bootStage\}/);
    assert.match(source, /모험을 준비하고 있습니다\./);
    assert.doesNotMatch(source, /SYSTEM INITIALIZING|\(\{bootStage\}\)/);
});

test('persistent status and enemy target use direct Korean metric labels', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');

    for (const label of ['생명', '기력', '경험', '골드', '교전 대상', '보스', '레벨']) {
        assert.match(source, new RegExp(label));
    }
    assert.match(source, /isMuted \? '소리 켜기' : '소리 끄기'/);
    assert.match(source, /data-testid="enemy-portrait"/);
    assert.match(source, /<MonsterIcon name=\{enemy\.name\}/);
    assert.match(source, /data-testid="enemy-status-label"/);
    assert.match(source, /data-testid="enemy-health-value"/);
    assert.doesNotMatch(source, /Target Lock|>Boss<|label="(?:HP|NRG|EXP)"|>CR<|Toggle Sound/);
});

test('persistent status separates identity, location, and readable metrics', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');

    assert.match(source, /data-testid="status-player-summary"/);
    assert.match(source, /data-testid="status-context-line"/);
    assert.match(source, /data-testid="status-metrics"/);
    assert.match(source, /data-testid="status-metric-label"/);
    assert.match(source, /data-testid="status-metric-value"/);
    assert.match(source, /text-\[10px\]/);
    assert.match(source, /text-\[11px\]/);
});

test('field log badges explain their meaning without developer abbreviations', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');

    for (const label of ['전투', '치명타', '이야기', '안내', '획득', '이벤트', '주의', '오류', '전설']) {
        assert.match(source, new RegExp(`label: '${label}'`));
    }
    assert.match(source, /data-testid="log-type-badge"/);
    assert.match(source, /이야기 흐름/);
    assert.match(source, /이야기를 이어가는 중/);
    assert.doesNotMatch(source, /label: '(?:COMBAT|CRIT|AI|SYS|GAIN|EVENT|WARN|ERROR|LEGEND)'|Narrative Pulse|PROCESSING NARRATIVE/);
});

test('growth and boss transition banners use the same player language', async () => {
    const levelBanner = await readSrc('src/components/LevelUpBanner.tsx');
    const phaseBanner = await readSrc('src/components/PhaseBanner.tsx');

    assert.match(levelBanner, /레벨 상승/);
    assert.match(levelBanner, /레벨 \{level\}/);
    assert.doesNotMatch(levelBanner, /Level Up|Lv\.\{level\}/);
    assert.match(phaseBanner, /최종 단계/);
    assert.match(phaseBanner, /\$\{phase\.n\}단계 진입/);
    assert.doesNotMatch(phaseBanner, /Final Phase|Phase \$\{phase\.n\}/);
});

test('post-combat equipment hint names the changed stats', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    const testApi = await readSrc('src/hooks/useGameTestApi.ts');

    assert.match(source, /공격력 \+\$\{atkDelta\}/);
    assert.match(source, /방어력 \+\$\{defDelta\}/);
    assert.match(source, /치명타 \+\$\{critDelta\}%/);
    assert.match(source, /기력 \+\$\{mpDelta\}/);
    assert.match(testApi, /공격력 \+4 \/ 방어력 \+1/);
});

test('status command repeats the same direct Korean metric vocabulary', async () => {
    const source = await readSrc('src/utils/commandParser.ts');

    assert.match(source, /\[상태\] 레벨 \$\{player\.level\}/);
    for (const label of ['생명:', '기력:', '골드:', '위치:']) {
        assert.match(source, new RegExp(label));
    }
    assert.doesNotMatch(source, /\[상태\] Lv\.|HP:|MP:|Gold:/);
});

test('smoke verifies the rendered status, enemy, and log vocabulary', async () => {
    const smoke = await readSrc('scripts/smoke-gameplay.mjs');

    assert.match(smoke, /Mobile status bar should expose one readable player summary/);
    assert.match(smoke, /Mobile status avatar should finish loading before visual evidence/);
    assert.match(smoke, /Mobile status bar should not overflow horizontally/);
    assert.match(smoke, /document\.getAnimations\(\)/);
    assert.match(smoke, /writeStateArtifact\('03-arrived-forest', state, page\)/);
    assert.match(smoke, /Enemy status should use the player-facing target label/);
    assert.match(smoke, /Enemy portrait should remain visually identifiable/);
    assert.match(smoke, /Enemy portrait should render a monster family shape/);
    assert.match(smoke, /Combat forecast labels should be at least 9px/);
    assert.match(smoke, /Field log should expose at least one readable type badge/);
    assert.match(smoke, /Status command should use direct Korean metric labels/);
});
