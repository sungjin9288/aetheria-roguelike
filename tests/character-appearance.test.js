import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveCharacterAppearance } from '../src/utils/characterAppearance.js';
import { getAvatarEquipmentPreviewCandidates, getAvatarSpriteCandidates, JOB_SPRITE_SLUG_MAP } from '../src/utils/avatarSpriteCandidates.js';
import { buildEquipmentPreviewAppearance, getEquipmentPreviewStage } from '../src/utils/avatarEquipmentPreview.js';
import { CLASSES } from '../src/data/classes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarAssetDir = path.resolve(__dirname, '../public/assets/avatars');
const characterProcessorPath = path.resolve(__dirname, '../scripts/process_character_art.py');
const characterPromptGeneratorPath = path.resolve(__dirname, '../scripts/generate_job_sprite_prompts.mjs');
const pixelInspectorPath = path.resolve(__dirname, '../scripts/inspect_art_pixels.py');
const characterManifest = JSON.parse(
    readFileSync(path.resolve(__dirname, '../src/data/characterArtManifest.json'), 'utf8')
);
const canonicalSharedDirection = 'Aetheria Roguelike canonical full-body chibi pixel-art hero, transparent square canvas, front three-quarter pose facing right, feet on one shared baseline, head-to-body ratio 1:3, two-level dark plum outline, light from upper left, shadow to lower right, no scenery, no text, no border, face and primary weapon unobscured, readable at 40 pixels.';

const readPngCanvas = (assetPath) => {
    const png = readFileSync(assetPath);
    assert.deepEqual(
        [...png.subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10],
        `Expected a PNG signature at ${assetPath}`,
    );
    return {
        width: png.readUInt32BE(16),
        height: png.readUInt32BE(20),
    };
};

const createOpaqueCheckerboardFixture = (assetPath) => spawnSync('python3', [
    '-c',
    [
        'from PIL import Image, ImageDraw',
        'import sys',
        'image = Image.new("RGB", (24, 24))',
        'pixels = image.load()',
        'for y in range(24):',
        '    for x in range(24):',
        '        tone = 250 if ((x // 4) + (y // 4)) % 2 == 0 else 238',
        '        pixels[x, y] = (tone, tone, tone)',
        'draw = ImageDraw.Draw(image)',
        'draw.rectangle((6, 3, 17, 21), fill=(42, 31, 46))',
        'draw.rectangle((7, 4, 16, 20), fill=(64, 112, 180))',
        'draw.rectangle((9, 8, 11, 10), fill=(255, 255, 255))',
        'image.save(sys.argv[1])',
    ].join('\n'),
    assetPath,
], { encoding: 'utf8' });

const runCharacterProcessor = (args) => spawnSync('python3', [characterProcessorPath, ...args], {
    encoding: 'utf8',
});

test('all 18 canonical jobs resolve to their only manifest sprite on a normalized canvas', () => {
    const classNames = Object.keys(CLASSES).sort();
    assert.deepEqual(Object.keys(characterManifest.entries).sort(), classNames);

    for (const job of classNames) {
        const entry = characterManifest.entries[job];
        const candidates = getAvatarSpriteCandidates({ job });
        assert.deepEqual(
            candidates,
            [entry.runtimePath],
            `${job} must use only its canonical manifest sprite`,
        );
        if (job !== '모험가') {
            assert.equal(
                candidates.some((candidate) => candidate.endsWith('/adventurer.png')),
                false,
                `${job} must not include the adventurer fallback`,
            );
        }

        const assetPath = path.resolve(__dirname, `../public${entry.runtimePath}`);
        assert.equal(existsSync(assetPath), true, `Missing canonical sprite for ${job}: ${assetPath}`);
        assert.deepEqual(readPngCanvas(assetPath), { width: 768, height: 768 });
    }
});

test('character processor rejects opaque tracked masters before runtime export', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'aetheria-character-art-'));
    try {
        const rawPath = path.join(fixtureRoot, 'raw.png');
        const sourceDir = path.join(fixtureRoot, 'sources');
        const runtimeDir = path.join(fixtureRoot, 'runtime');
        await mkdir(sourceDir, { recursive: true });
        const fixture = createOpaqueCheckerboardFixture(rawPath);
        assert.equal(fixture.status, 0, fixture.stderr);
        await copyFile(rawPath, path.join(sourceDir, 'adventurer.png'));

        const result = runCharacterProcessor([
            '--source-dir', sourceDir,
            '--runtime-dir', runtimeDir,
            '--only', 'adventurer',
        ]);

        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /tracked source master must contain transparent pixels/);
        assert.equal(existsSync(path.join(runtimeDir, 'adventurer.png')), false);
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
});

test('character processor imports edge-connected checkerboards without erasing enclosed whites', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'aetheria-character-art-'));
    try {
        const rawPath = path.join(fixtureRoot, 'raw.png');
        const sourceDir = path.join(fixtureRoot, 'sources');
        const runtimeDir = path.join(fixtureRoot, 'runtime');
        const fixture = createOpaqueCheckerboardFixture(rawPath);
        assert.equal(fixture.status, 0, fixture.stderr);

        const result = runCharacterProcessor([
            '--source-dir', sourceDir,
            '--runtime-dir', runtimeDir,
            '--only', 'adventurer',
            '--import-source', `adventurer=${rawPath}`,
        ]);
        assert.equal(result.status, 0, result.stderr || result.stdout);

        const cleanedSource = path.join(sourceDir, 'adventurer.png');
        const runtimeExport = path.join(runtimeDir, 'adventurer.png');
        const sourceInspection = spawnSync('python3', [
            '-c',
            [
                'from PIL import Image',
                'import json, sys',
                'image = Image.open(sys.argv[1]).convert("RGBA")',
                'print(json.dumps({"corner": image.getpixel((0, 0)), "highlight": image.getpixel((10, 9))}))',
            ].join('\n'),
            cleanedSource,
        ], { encoding: 'utf8' });
        assert.equal(sourceInspection.status, 0, sourceInspection.stderr);
        assert.deepEqual(JSON.parse(sourceInspection.stdout), {
            corner: [250, 250, 250, 0],
            highlight: [255, 255, 255, 255],
        });
        assert.deepEqual(readPngCanvas(runtimeExport), { width: 768, height: 768 });

        const runtimeInspection = spawnSync('python3', [
            pixelInspectorPath,
            '--path', runtimeExport,
            '--margin', '16',
            '--foot-baseline', '708',
        ], { encoding: 'utf8' });
        assert.equal(runtimeInspection.status, 0, runtimeInspection.stderr);
        assert.deepEqual(
            {
                hasAlpha: JSON.parse(runtimeInspection.stdout).hasAlpha,
                hasTransparentPixels: JSON.parse(runtimeInspection.stdout).hasTransparentPixels,
                boundsWithinMargin: JSON.parse(runtimeInspection.stdout).boundsWithinMargin,
                footBaselineMatches: JSON.parse(runtimeInspection.stdout).footBaselineMatches,
            },
            {
                hasAlpha: true,
                hasTransparentPixels: true,
                boundsWithinMargin: true,
                footBaselineMatches: true,
            },
        );
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
});

test('character prompt generator emits one approved manifest-driven prompt for every lineage role', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'aetheria-character-prompts-'));
    try {
        const outputPath = path.join(fixtureRoot, 'prompts.json');
        const provenancePath = path.join(fixtureRoot, 'provenance.json');
        const result = spawnSync(process.execPath, [
            characterPromptGeneratorPath,
            '--output', outputPath,
            '--provenance', provenancePath,
        ], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr || result.stdout);

        const prompts = JSON.parse(readFileSync(outputPath, 'utf8'));
        const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
        assert.equal(prompts.sharedDirection, canonicalSharedDirection);
        assert.equal(
            prompts.sharedDirectionSha256,
            createHash('sha256').update(canonicalSharedDirection).digest('hex'),
        );
        assert.equal(prompts.entries.length, 18);
        assert.deepEqual(
            new Set(prompts.entries.map((entry) => entry.job)),
            new Set(Object.keys(CLASSES)),
        );
        assert.deepEqual(
            prompts.entries.map((entry) => entry.slug),
            [
                'adventurer', 'warrior', 'knight', 'dragon-knight', 'berserker',
                'mage', 'archmage', 'grand-mage', 'warlock', 'cleric', 'paladin',
                'shaman', 'chronomancer', 'rogue', 'assassin', 'shadow-lord',
                'ranger', 'hunt-lord',
            ],
        );
        for (const entry of prompts.entries) {
            assert.ok(entry.prompt.startsWith('Use case: stylized-concept\nAsset type: canonical game character master'));
            assert.ok(entry.prompt.includes(canonicalSharedDirection));
            assert.match(entry.prompt, /Role silhouette:/);
            assert.match(entry.prompt, /Primary weapon:/);
            assert.match(entry.prompt, /Palette:/);
            assert.match(entry.prompt, /flat solid #00FF7F chroma background/);
            assert.equal(entry.promptSha256, createHash('sha256').update(entry.prompt).digest('hex'));
        }
        assert.equal(provenance.promptSet.sharedDirection, canonicalSharedDirection);
        assert.equal(provenance.promptSet.entries.length, 18);
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
});

test('deriveCharacterAppearance falls back to a stable adventurer silhouette', () => {
    const appearance = deriveCharacterAppearance({
        job: '모험가',
        level: 1,
        equip: {},
    });

    assert.equal(appearance.job, '모험가');
    assert.equal(appearance.weapon.type, 'none');
    assert.equal(appearance.offhand.type, 'none');
    assert.equal(appearance.armorStyle, 'coat');
    assert.equal(appearance.loadoutStyle, 'sword');
    assert.equal(appearance.accessoryStyle, 'ribbon');
    assert.equal(appearance.palette.outfit, '#5b7dd8');
});

test('deriveCharacterAppearance maps magic two-hand weapons and focus offhands', () => {
    const appearance = deriveCharacterAppearance({
        job: '마법사',
        level: 8,
        equip: {
            weapon: { name: '화염의 지팡이', type: 'weapon', hands: 2, elem: '화염', enhance: 2 },
            offhand: { name: '심연의 마도서', type: 'shield', subtype: 'focus', elem: '어둠', enhance: 1 },
            armor: { name: '수련생 로브', type: 'armor', elem: '빛', enhance: 3 },
        },
    });

    assert.equal(appearance.weapon.type, 'staff');
    assert.equal(appearance.offhand.type, 'book');
    assert.equal(appearance.armorStyle, 'robe');
    assert.equal(appearance.loadoutStyle, 'caster');
    assert.equal(appearance.accessoryStyle, 'hat');
    assert.equal(appearance.palette.weapon, '#d8c7a5');
    assert.equal(appearance.palette.offhand, '#bfa88b');
    assert.equal(appearance.frameTone, '빛');
});

test('deriveCharacterAppearance maps martial loadouts to cute pixel combat silhouettes', () => {
    const appearance = deriveCharacterAppearance({
        job: '나이트',
        level: 12,
        equip: {
            weapon: { name: '롱소드', type: 'weapon', hands: 1, enhance: 4 },
            offhand: { name: '성광 방벽', type: 'shield', elem: '빛', enhance: 2 },
            armor: { name: '기사의 흉갑', type: 'armor', enhance: 1 },
        },
    });

    assert.equal(appearance.weapon.type, 'sword');
    assert.equal(appearance.offhand.type, 'shield');
    assert.equal(appearance.armorStyle, 'plate');
    assert.equal(appearance.loadoutStyle, 'guardian');
    assert.equal(appearance.accessoryStyle, 'crest');
    assert.equal(appearance.weapon.enhance, 4);
    assert.equal(appearance.offhand.enhance, 2);
});

test('deriveCharacterAppearance distinguishes leather and coat armor silhouettes from item naming', () => {
    const leatherAppearance = deriveCharacterAppearance({
        job: '도적',
        equip: {
            armor: { name: '가죽 조끼', type: 'armor' },
        },
    });
    const coatAppearance = deriveCharacterAppearance({
        job: '레인저',
        equip: {
            armor: { name: '사냥꾼의 외투', type: 'armor' },
        },
    });

    assert.equal(leatherAppearance.armorStyle, 'leather');
    assert.equal(coatAppearance.armorStyle, 'coat');
});

test('deriveCharacterAppearance derives distinct loadout styles from equipped weapon families', () => {
    const heavyAppearance = deriveCharacterAppearance({
        job: '버서커',
        equip: {
            weapon: { name: '광전사의 도끼', type: 'weapon', hands: 2 },
        },
    });
    const archerAppearance = deriveCharacterAppearance({
        job: '레인저',
        equip: {
            weapon: { name: '사냥꾼의 활', type: 'weapon', hands: 2 },
        },
    });
    const lancerAppearance = deriveCharacterAppearance({
        job: '전사',
        equip: {
            weapon: { name: '정예병의 창', type: 'weapon', hands: 2 },
        },
    });

    assert.equal(heavyAppearance.loadoutStyle, 'heavy');
    assert.equal(archerAppearance.loadoutStyle, 'archer');
    assert.equal(lancerAppearance.loadoutStyle, 'lancer');
});

test('getAvatarSpriteCandidates uses the job-only canonical manifest sprite', () => {
    const candidates = getAvatarSpriteCandidates({
        job: '팔라딘',
        armorStyle: 'plate',
        loadoutStyle: 'guardian',
    });

    assert.deepEqual(candidates, ['/assets/avatars/canonical/paladin.png']);
});

test('shadow-lord uses dedicated default sprite regardless of equipment', () => {
    const candidates = getAvatarSpriteCandidates({
        job: '그림자 주군',
        armorStyle: 'plate',  // 비전공 armor
        loadoutStyle: 'sword', // 비전공 weapon
    });
    assert.deepEqual(candidates, ['/assets/avatars/canonical/shadow-lord.png']);
});

test('unknown job falls back to the canonical adventurer sprite', () => {
    const candidates = getAvatarSpriteCandidates({
        job: '미확인 직업',
        armorStyle: 'robe',
        loadoutStyle: 'caster',
    });
    assert.deepEqual(candidates, ['/assets/avatars/canonical/adventurer.png']);
});

test('cycle 46: 모험가는 어떤 장비를 입든 항상 같은 sprite', () => {
    const cases = [
        { armorStyle: 'leather', loadoutStyle: 'dagger' },
        { armorStyle: 'plate', loadoutStyle: 'sword' },
        { armorStyle: 'robe', loadoutStyle: 'caster' },
        { armorStyle: 'coat', loadoutStyle: 'archer' },
    ];
    const sprites = new Set(
        cases.map((c) => getAvatarSpriteCandidates({ job: '모험가', ...c })[0])
    );
    assert.equal(sprites.size, 1, 'should always pick the same sprite');
    assert.equal([...sprites][0], '/assets/avatars/canonical/adventurer.png');
});

test('buildEquipmentPreviewAppearance derives robe previews from the same avatar family path', () => {
    const preview = buildEquipmentPreviewAppearance({
        name: '여행자 튜닉',
        type: 'armor',
    });

    assert.equal(preview.job, '모험가');
    assert.equal(preview.armorStyle, 'coat');
    assert.equal(preview.loadoutStyle, 'sword');
    assert.equal(preview.armor?.item?.name, '여행자 튜닉');
    assert.equal(preview.armor?.art?.bodyStyle, 'tunic');
});

test('buildEquipmentPreviewAppearance derives specific loadout previews for offhand and one-hand items', () => {
    const bookPreview = buildEquipmentPreviewAppearance({
        name: '견습 주문서',
        type: 'shield',
        subtype: 'focus',
    });
    const daggerPreview = buildEquipmentPreviewAppearance({
        name: '녹슨 단검',
        type: 'weapon',
        hands: 1,
    });

    assert.equal(bookPreview.job, '마법사');
    assert.equal(bookPreview.armorStyle, 'robe');
    assert.equal(bookPreview.loadoutStyle, 'caster');
    assert.equal(bookPreview.offhand?.art?.slot, 'offhand');
    assert.equal(daggerPreview.job, '도적');
    assert.equal(daggerPreview.armorStyle, 'leather');
    assert.equal(daggerPreview.loadoutStyle, 'dagger');
    assert.equal(daggerPreview.weapon?.art?.slot, 'weapon');
});

test('equipment preview candidates emphasize loadout silhouettes for weapon and offhand cards', () => {
    const swordPreview = buildEquipmentPreviewAppearance({
        name: '롱소드',
        type: 'weapon',
        hands: 1,
    });
    const shieldPreview = buildEquipmentPreviewAppearance({
        name: '목재 방패',
        type: 'shield',
    });
    const armorPreview = buildEquipmentPreviewAppearance({
        name: '여행자 튜닉',
        type: 'armor',
    });
    const robePreview = buildEquipmentPreviewAppearance({
        name: '천 로브',
        type: 'armor',
        elem: '빛',
    });
    const bowPreview = buildEquipmentPreviewAppearance({
        name: '엘프의활',
        type: 'weapon',
        hands: 2,
        elem: '자연',
    });
    const platePreview = buildEquipmentPreviewAppearance({
        name: '기사의 흉갑',
        type: 'armor',
        elem: '빛',
    });

    assert.equal(getAvatarEquipmentPreviewCandidates(swordPreview)[0], '/assets/avatars/adventurer-sword.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(shieldPreview)[0], '/assets/avatars/knight-plate-guardian.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(armorPreview)[0], '/assets/avatars/adventurer-coat.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(robePreview)[0], '/assets/avatars/archmage-robe.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(bowPreview)[0], '/assets/avatars/ranger-coat-archer.png');
    assert.equal(getAvatarEquipmentPreviewCandidates(platePreview)[0], '/assets/avatars/paladin-plate.png');
});

test('equipment preview stage emphasizes the relevant slot instead of shrinking everything equally', () => {
    const headgearStage = getEquipmentPreviewStage(
        { name: '짚 모자', type: 'armor' },
        buildEquipmentPreviewAppearance({ name: '짚 모자', type: 'armor' }),
    );
    const armorStage = getEquipmentPreviewStage(
        { name: '여행자 튜닉', type: 'armor' },
        buildEquipmentPreviewAppearance({ name: '여행자 튜닉', type: 'armor' }),
    );
    const shieldStage = getEquipmentPreviewStage(
        { name: '목재 방패', type: 'shield' },
        buildEquipmentPreviewAppearance({ name: '목재 방패', type: 'shield' }),
    );
    const swordStage = getEquipmentPreviewStage(
        { name: '롱소드', type: 'weapon', hands: 1 },
        buildEquipmentPreviewAppearance({ name: '롱소드', type: 'weapon', hands: 1 }),
    );

    assert.equal(headgearStage.focus, 'headgear');
    assert.equal(armorStage.focus, 'armor');
    assert.equal(shieldStage.focus, 'offhand');
    assert.equal(swordStage.focus, 'weapon');
    assert.equal(headgearStage.scale > armorStage.scale, true);
    assert.equal(shieldStage.translateX > 0, true);
    assert.equal(swordStage.translateX < 0, true);

    const headgearCardStage = getEquipmentPreviewStage(
        { name: '짚 모자', type: 'armor' },
        buildEquipmentPreviewAppearance({ name: '짚 모자', type: 'armor' }),
        'card',
    );
    const shieldCardStage = getEquipmentPreviewStage(
        { name: '목재 방패', type: 'shield' },
        buildEquipmentPreviewAppearance({ name: '목재 방패', type: 'shield' }),
        'card',
    );

    assert.equal(headgearCardStage.scale > headgearStage.scale, true);
    assert.equal(headgearCardStage.origin, '50% 14%');
    assert.equal(shieldCardStage.scale > shieldStage.scale, true);
    assert.equal(shieldCardStage.translateX > shieldStage.translateX, true);
});

test('all mapped job sprites exist as concrete avatar PNG assets', () => {
    const uniqueSlugs = [...new Set(Object.values(JOB_SPRITE_SLUG_MAP))];

    for (const slug of uniqueSlugs) {
        const assetPath = path.join(avatarAssetDir, `${slug}.png`);
        assert.equal(
            existsSync(assetPath),
            true,
            `Expected avatar sprite asset for slug "${slug}" at ${assetPath}`,
        );
    }
});

test('class-specific armor variants exist for the current premium avatar coverage set', () => {
    const expectedVariants = [
        'warrior-plate',
        'knight-plate',
        'berserker-plate',
        'rogue-leather',
        'assassin-leather',
        'ranger-coat',
        'mage-robe',
        'archmage-robe',
        'warlock-robe',
        'paladin-plate',
        'chronomancer-robe',
        'shadow-lord-leather',
        'grand-mage-robe',
    ];

    for (const variant of expectedVariants) {
        const assetPath = path.join(avatarAssetDir, `${variant}.png`);
        assert.equal(
            existsSync(assetPath),
            true,
            `Expected armor-style avatar variant asset at ${assetPath}`,
        );
    }
});

test('loadout-style avatar variants exist for the premium individuality coverage set', () => {
    const expectedVariants = [
        'adventurer-sword',
        'adventurer-heavy',
        'adventurer-archer',
        'adventurer-caster',
        'adventurer-guardian',
        'adventurer-dagger',
        'adventurer-lancer',
        'warrior-plate-sword',
        'warrior-plate-heavy',
        'knight-plate-guardian',
        'berserker-plate-heavy',
        'rogue-leather-dagger',
        'assassin-leather-dagger',
        'ranger-coat-archer',
        'mage-robe-caster',
        'archmage-robe-caster',
        'warlock-robe-caster',
        'paladin-plate-guardian',
        'chronomancer-robe-caster',
        'shadow-lord-leather-dagger',
        'grand-mage-robe-caster',
    ];

    for (const variant of expectedVariants) {
        const assetPath = path.join(avatarAssetDir, `${variant}.png`);
        assert.equal(
            existsSync(assetPath),
            true,
            `Expected loadout-style avatar variant asset at ${assetPath}`,
        );
    }
});
