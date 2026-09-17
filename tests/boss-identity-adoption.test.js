import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildMonsterArtCatalog } from '../scripts/monsterArtCatalog.mjs';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';

const base = new URL('../scripts/art_sources/monsters/v21/', import.meta.url);
const root = new URL('../', import.meta.url);
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const remainingNames = new Set((await readJson(new URL('scripts/art_sources/monsters/v27/preflight.json', root))).selected.map(({ name }) => name));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bodies = {
    "공허의 대행자": "void-proxy",
    "무한의 화신": "infinite-avatar",
    "에테르 심판자": "aether-judge",
    "봄의 여왕": "spring-queen",
    "수호신의 사도": "guardian-apostle",
    "에테르 거인": "aether-giant",
    "하수도의 여왕": "sewer-queen",
    "혼돈의 수호자": "chaos-guardian"
};

test('eight boss portraits resolve to the reviewed body bytes through authored registry and runtime', async () => {
    const catalog = await buildMonsterArtCatalog();
    const manifest = await readJson(new URL('src/data/monsterArtManifest.json', root));
    const receipt = await readJson(new URL('exports/receipt.json', base));
    for (const [name, slug] of Object.entries(bodies)) {
        const correction = catalog.corrections[name];
        assert.ok(correction, `${name} must not use a reused ordinary monster prototype`);
        const entry = manifest.entries[name];
        const expected = await readFile(new URL(`exports/${slug}.png`, base));
        assert.equal(sha(expected), receipt.exportSha256[slug]);
        assert.equal(correction.sha256, sha(expected), name);
        assert.equal(entry.sourceRuntimePath, correction.sourceRuntimePath, name);
        for (const path of [entry.runtimePath, correction.sourceRuntimePath]) {
            assert.deepEqual(await readFile(new URL(`public${path}`, root)), expected, name);
        }
        assert.equal(getMonsterVisual(name).src, entry.runtimePath);
        assert.equal(getMonsterVisual(`정예 ${name}`).src, entry.runtimePath);
    }
});

test('historical next-eight checkpoint preserves 246 bodies before the approved final-seven adoption', async () => {
    const before = await readJson(new URL('previous/monsterArtManifest.json', base));
    const successor = new URL('scripts/art_sources/monsters/v22/previous/', root);
    const after = await readJson(new URL('monsterArtManifest.json', successor));
    const beforeRegistry = await readJson(new URL('previous/corrections.json', base));
    const afterRegistry = await readJson(new URL('corrections.json', successor));
    const finalBodies = new Set(['공허의 군주', '마왕', '에테르 군주', '엔트로피 군주',
        '차원 마왕', '허무의 황제', '에테르 드래곤']);
    const regionalBodies = new Set(['서리 늑대', '잉크 슬라임', '화염 감시자']);
    const regionalSix = new Set(['뿌리 포식자', '세계수 수호자', '꽃잎 슬라임', '화산재 골렘', '뇌운 와이번', '바람 드레이크']);
    assert.deepEqual(Object.keys(after.entries).sort(), Object.keys(before.entries).sort());
    const { entries: oldEntries, ...oldHeader } = before;
    const { entries: newEntries, ...newHeader } = after;
    assert.deepEqual(newHeader, oldHeader);
    const changed = [];
    for (const [name, entry] of Object.entries(oldEntries)) {
        const current = newEntries[name];
        if (Object.hasOwn(bodies, name)) {
            assert.notEqual(current.sha256, entry.sha256, name);
            const { sha256: oldHash, sourceRuntimePath: oldSource, ...oldIdentity } = entry;
            const { sha256: newHash, sourceRuntimePath: newSource, ...newIdentity } = current;
            assert.deepEqual(newIdentity, oldIdentity, name);
            assert.notEqual(newSource, oldSource, name);
            assert.notEqual(newHash, oldHash, name);
            assert.equal(sha(await readFile(new URL(`previous/${entry.key}.png`, base))), oldHash);
            changed.push(name);
        } else {
            assert.deepEqual(current, entry, name);
            const preserved = finalBodies.has(name)
                ? new URL(`${entry.key}.png`, successor)
                : regionalBodies.has(name)
                    ? new URL(`scripts/art_sources/monsters/v23/previous/${entry.key}.png`, root)
                    : new URL(remainingNames.has(name)
                    ? `scripts/art_sources/monsters/v27/previous/${entry.key}.png`
                    : `public${entry.runtimePath}`, root);
            const historicalBytes = regionalSix.has(name)
                ? new URL(`scripts/art_sources/monsters/v24/previous/${entry.key}.png`, root)
                : preserved;
            const elementalSix = ['번개 골렘', '부식된 골렘', '얼음 기사', '호수 수호자', '화염 와이번', '화염 비룡'];
            const checkpointBytes = elementalSix.includes(name)
                ? new URL(`scripts/art_sources/monsters/v25/previous/${entry.key}.png`, root)
                : historicalBytes;
            const retainedTen = ['전류 추적자', '변이 실험체', '에테르 잔류체', '에테르 흡수체', '망자의 사제', '암흑 사제', '언데드 마법사', '화염 도마뱀', '불꽃 도마뱀', '화산 도마뱀'];
            const retainedBytes = retainedTen.includes(name)
                ? new URL(`scripts/art_sources/monsters/v26/previous/${entry.key}.png`, root)
                : checkpointBytes;
            assert.equal(sha(await readFile(retainedBytes)), entry.sha256, name);
        }
    }
    assert.equal(Object.keys(oldEntries).length - changed.length, 246);
    assert.deepEqual(changed.sort(), Object.keys(bodies).sort());
    for (const [name, entry] of Object.entries(beforeRegistry.entries)) {
        assert.deepEqual(afterRegistry.entries[name], entry, name);
    }
    assert.deepEqual(Object.keys(afterRegistry.entries).filter((name) => !Object.hasOwn(beforeRegistry.entries, name)).sort(), Object.keys(bodies).sort());
});
