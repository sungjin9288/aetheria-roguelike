// 웹 · iOS · Android 빌드(dist → Capacitor)는 토스 빌드와 같은 런타임 그림만 담는다 (scripts/webPublicAssets.mjs).
// public/assets 205MB 중 137MB(1024px 레거시 장비 원본 126MB · 몬스터 원본 · 옛 SVG 아이콘)는 런타임이 읽지 않는데
// Vite가 public을 통째로 복사해 앱 설치 크기가 필요한 양의 2.5배였다. 원본은 저장소에 그대로 둔다(아트 재현성 · 증빙).
// 계약: ① 목록 = 런타임 그림 목록 ∪ public/assets 밖의 웹 셸 ② 런타임이 그리는 모든 그림 경로가 목록 안에 있다
// ③ vite.config.js의 빌드가 실제로 그 목록만 복사하고, 토스 빌드(미리 담은 .toss/public)는 그대로 둔다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import viteConfig from '../vite.config.js';
import tossViteConfig from '../vite.toss.config.js';
import { buildTossAssetCatalog } from '../scripts/tossAssetCatalog.mjs';
import { buildWebPublicFileList } from '../scripts/webPublicAssets.mjs';
import IntroScreen from '../src/components/IntroScreen.tsx';
import { DB } from '../src/data/db.ts';
import monsterArtManifest from '../src/data/monsterArtManifest.json' with { type: 'json' };
import { RELICS } from '../src/data/relics.ts';
import { getAvatarEquipmentPreviewCandidates, getAvatarSpriteCandidates } from '../src/utils/avatarSpriteCandidates.ts';
import { getEquipmentOverlayAssetSrc, getItemIconAssetSrc } from '../src/utils/itemVisuals.ts';
import { getLocationVisual } from '../src/utils/locationVisuals.ts';
import { getMonsterVisual } from '../src/utils/monsterVisuals.ts';
import { getRelicVisual } from '../src/utils/relicVisuals.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const MIB = 1024 * 1024;
const toRuntimePath = (file) => `/${file.replace(/^public\//, '')}`;
const findPlugin = (config, name) => config.plugins.flat().find((plugin) => plugin?.name === name);

const listOutput = async (directory, root = directory) => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await listOutput(absolutePath, root));
        else files.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }
    return files;
};

// 런타임 그림 경로를 만드는 곳 전부 — 아이템(접두어 · 강화 변형 포함) · 착용 겹 · 몬스터 · 지역 · 직업 초상 · 장비 미리보기 · 유물 · 첫 화면.
const collectRuntimeArtPaths = () => {
    const paths = new Map();
    const add = (src, source) => {
        if (src && !paths.has(src)) paths.set(src, source);
    };

    const items = [...DB.ITEMS.weapons, ...DB.ITEMS.armors, ...DB.ITEMS.consumables, ...DB.ITEMS.materials];
    const prefixes = DB.ITEMS.prefixes.map((prefix) => prefix.name);
    for (const item of items) {
        const variants = [item, ...prefixes.map((prefix) => ({ ...item, name: `${prefix} ${item.name}` })), { ...item, name: `${item.name} +3`, enhance: 3 }];
        for (const variant of variants) {
            add(getItemIconAssetSrc(variant), `item ${variant.name}`);
            add(getEquipmentOverlayAssetSrc(variant), `overlay ${variant.name}`);
        }
    }
    add(getItemIconAssetSrc(null), 'item null');

    const monsterNames = new Set(Object.keys(DB.MONSTERS));
    for (const map of Object.values(DB.MAPS)) {
        for (const name of [...(map.monsters || []), ...(map.bossMonsters || [])]) monsterNames.add(name);
    }
    for (const name of monsterNames) add(getMonsterVisual(name)?.src, `monster ${name}`);

    for (const name of Object.keys(DB.MAPS)) add(getLocationVisual(name)?.src, `location ${name}`);

    const jobs = [...Object.keys(DB.CLASSES), '알 수 없는 직업'];
    for (const job of jobs) {
        for (const src of getAvatarSpriteCandidates({ job })) add(src, `avatar ${job}`);
        for (const armorStyle of ['coat', 'plate', 'leather', 'robe', undefined]) {
            for (const loadoutStyle of ['sword', 'heavy', 'dagger', 'archer', 'caster', 'guardian', 'lancer', undefined]) {
                for (const weapon of [null, { name: 'probe' }]) {
                    for (const src of getAvatarEquipmentPreviewCandidates({ job, armorStyle, loadoutStyle, weapon })) {
                        add(src, `preview ${job}/${armorStyle}/${loadoutStyle}`);
                    }
                }
            }
        }
    }

    for (const relic of RELICS) {
        add(getRelicVisual(relic).src, `relic ${relic.name}`);
        add(getRelicVisual(relic, true).src, `relic ${relic.name} legendary`);
    }

    const intro = renderToStaticMarkup(createElement(IntroScreen, { onStart: () => {} }));
    for (const match of intro.matchAll(/src="(\/assets\/[^"]+)"/g)) add(match[1], 'intro');

    return paths;
};

test('웹 빌드는 런타임 그림 목록과 public/assets 밖의 웹 셸만 담는다 — 레거시 원본 · 몬스터 원본은 빠진다', async () => {
    const [list, catalog] = await Promise.all([
        buildWebPublicFileList({ repoRoot }),
        buildTossAssetCatalog({ repoRoot }),
    ]);
    const files = new Set(list.files);

    assert.deepEqual(list.missing, []);
    for (const file of catalog.files) assert.ok(files.has(file), `런타임 그림: ${file}`);
    for (const file of list.files.filter((entry) => !catalog.files.includes(entry))) {
        assert.ok(!file.startsWith('public/assets/'), `목록 밖 그림이 들어갔다: ${file}`);
    }
    // 웹 셸: SPA 리다이렉트 · 서비스 워커(앱 셸이 /vite.svg를 캐시한다 — 하나라도 없으면 설치가 실패한다) · manifest · 아이콘.
    for (const shell of ['public/_redirects', 'public/sw.js', 'public/vite.svg', 'public/manifest.webmanifest', 'public/icons/icon-192.png']) {
        assert.ok(files.has(shell), shell);
    }

    assert.ok(!list.files.some((file) => file.startsWith('public/assets/equipment-exact/item-')), '1024px 레거시 장비 원본');
    assert.ok(!list.files.some((file) => /^public\/assets\/items\/item-weapon-\d+\.svg$/.test(file)), '옛 SVG 무기 아이콘');
    const monsterSources = Object.values(monsterArtManifest.entries).map((entry) => `public${entry.sourceRuntimePath}`);
    assert.ok(monsterSources.length > 200);
    assert.deepEqual(monsterSources.filter((file) => files.has(file)), [], '몬스터 원본(sourceRuntimePath)은 증빙 · 재현용이다');

    assert.ok(list.totalBytes <= 80 * MIB, `웹 public ${(list.totalBytes / MIB).toFixed(1)}MiB`);
});

test('런타임이 그리는 모든 그림 경로가 웹 빌드 목록 안에 있다', async () => {
    const list = await buildWebPublicFileList({ repoRoot });
    const shipped = new Set(list.files.map(toRuntimePath));
    const paths = collectRuntimeArtPaths();

    // 공허참 방지: 해석기마다 실제로 경로를 냈다.
    for (const kind of ['/assets/equipment-exact/', '/assets/equipment-wearable-exact/', '/assets/items/', '/assets/monsters/catalog/',
        '/assets/locations/', '/assets/avatars/canonical/', '/assets/relics/', '/assets/intro/']) {
        assert.ok([...paths.keys()].some((src) => src.startsWith(kind)), `해석된 경로: ${kind}`);
    }
    assert.ok(paths.size > 500, `해석한 그림 ${paths.size}개`);

    const missing = [...paths].filter(([src]) => !shipped.has(src)).map(([src, source]) => `${source} → ${src}`);
    assert.deepEqual(missing, []);
});

test('vite 빌드는 public을 통째로 복사하지 않고 목록만 복사한다 — 토스 빌드의 미리 담은 public은 그대로 둔다', async (t) => {
    const plugin = findPlugin(viteConfig, 'aetheria:web-public-assets');
    assert.ok(plugin, 'vite.config.js가 웹 public 목록 플러그인을 쓴다');

    assert.deepEqual(plugin.config({ root: repoRoot }), { build: { copyPublicDir: false } });
    assert.equal(plugin.config({ root: repoRoot, publicDir: false }), undefined);
    assert.equal(tossViteConfig.publicDir, '.toss/public');
    assert.equal(plugin.config({ ...tossViteConfig, root: repoRoot }), undefined, '토스 빌드는 Vite가 .toss/public을 복사한다');

    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'aetheria-web-public-'));
    t.after(() => rm(outputRoot, { recursive: true, force: true }));
    assert.deepEqual(plugin.config({ root: repoRoot }), { build: { copyPublicDir: false } });
    plugin.configResolved({ root: outputRoot, build: { outDir: 'dist', write: true } });
    await plugin.writeBundle();

    const list = await buildWebPublicFileList({ repoRoot });
    const copied = await listOutput(path.join(outputRoot, 'dist'));
    assert.deepEqual(copied.sort(), list.files.map((file) => file.replace(/^public\//, '')).sort());
    assert.equal(
        await readFile(path.join(outputRoot, 'dist/sw.js'), 'utf8'),
        await readFile(path.join(repoRoot, 'public/sw.js'), 'utf8'),
    );
    await assert.rejects(readFile(path.join(outputRoot, 'dist/assets/equipment-exact/item-weapon-078.png')));
});
