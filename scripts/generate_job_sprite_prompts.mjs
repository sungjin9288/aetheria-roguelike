#!/usr/bin/env node
/** Build the approved, manifest-driven prompt set for all canonical job masters. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'src/data/characterArtManifest.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'output/character-art-prompts.json');
const DEFAULT_PROVENANCE = path.join(REPO_ROOT, 'docs/evidence/art/character-provenance.json');

export const SHARED_DIRECTION = 'Aetheria Roguelike canonical full-body chibi pixel-art hero, transparent square canvas, front three-quarter pose facing right, feet on one shared baseline, head-to-body ratio 1:3, two-level dark plum outline, light from upper left, shadow to lower right, no scenery, no text, no border, face and primary weapon unobscured, readable at 40 pixels.';

const LINEAGE_ORDER = [
    'adventurer',
    'warrior',
    'knight',
    'dragon-knight',
    'berserker',
    'mage',
    'archmage',
    'grand-mage',
    'warlock',
    'cleric',
    'paladin',
    'shaman',
    'chronomancer',
    'rogue',
    'assassin',
    'shadow-lord',
    'ranger',
    'hunt-lord',
];

const JOB_BRIEFS = Object.freeze({
    adventurer: {
        promise: '상황에 맞춰 배우고 적응한다',
        silhouette: 'one-handed sword, small round shield, and practical travel cloak',
        weapon: 'plain one-handed sword with a compact round shield',
        palette: 'leather brown and clear blue',
        parent: null,
    },
    warrior: {
        promise: '맞으면서 전선을 밀어낸다',
        silhouette: 'broad sword, thick squared pauldrons, and a visible battle scar',
        weapon: 'wide heavy-edged sword held forward',
        palette: 'iron gray and martial red',
        parent: 'adventurer',
    },
    knight: {
        promise: '방패로 적의 공격 흐름을 통제한다',
        silhouette: 'enormous shield, longsword, and fortress-like plate armor',
        weapon: 'longsword paired with an oversized defensive shield',
        palette: 'steel gray and royal blue',
        parent: 'warrior',
    },
    'dragon-knight': {
        promise: '용의 힘으로 위험을 감수하고 돌파한다',
        silhouette: 'dragon-scale armor, dragon-blade lance, and a small controlled flame-breath motif',
        weapon: 'long dragon-blade lance with a distinct draconic spearhead',
        palette: 'obsidian black and molten lava orange',
        parent: 'knight',
    },
    berserker: {
        promise: '방어를 버리고 폭발적인 피해를 선택한다',
        silhouette: 'massive axe, exposed muscular arms, and a torn battle cape',
        weapon: 'oversized two-handed execution axe',
        palette: 'blood red and black',
        parent: 'warrior',
    },
    mage: {
        promise: '원소와 상태이상을 조합한다',
        silhouette: 'training staff and three clearly separated elemental crystals',
        weapon: 'simple apprentice staff crowned by three elemental crystals',
        palette: 'navy, orange, and sky blue',
        parent: 'adventurer',
    },
    archmage: {
        promise: '강한 원소 주문의 순서를 설계한다',
        silhouette: 'large staff and three rotating elemental crystals around the shoulder line',
        weapon: 'large elemental staff with an open circular head',
        palette: 'white, navy, and restrained multicolor light',
        parent: 'mage',
    },
    'grand-mage': {
        promise: '모든 원소와 시간의 경계를 지배한다',
        silhouette: 'ritual staff, multiple compact magic circles, and a star-covered mantle',
        weapon: 'tall ritual staff with a prismatic core',
        palette: 'midnight blue, white, and prismatic accents',
        parent: 'archmage',
    },
    warlock: {
        promise: '저주와 흡수로 전투를 잠식한다',
        silhouette: 'curved staff, forbidden tome, and one spectral dark hand',
        weapon: 'crooked curse staff paired with an open forbidden tome',
        palette: 'purple, black, and sickly green',
        parent: 'mage',
    },
    cleric: {
        promise: '정화와 빛으로 위험을 되돌린다',
        silhouette: 'relic staff, long vestments, and a clean light sigil behind one shoulder',
        weapon: 'slender relic staff with a sun-shaped head',
        palette: 'ivory, gold, and sky blue',
        parent: 'mage',
    },
    paladin: {
        promise: '방어와 치유를 공격으로 연결한다',
        silhouette: 'crusader hammer, tower shield, and a compact halo of light',
        weapon: 'one-handed holy war hammer paired with a tall tower shield',
        palette: 'white, gold, and blue',
        parent: 'cleric',
    },
    shaman: {
        promise: '저주, 독, 소환을 겹쳐 위기를 힘으로 바꾼다',
        silhouette: 'bell staff, hanging talismans, and two small wandering spirits',
        weapon: 'ritual bell staff with visible paper talismans',
        palette: 'teal, earthy brown, and purple',
        parent: 'mage',
    },
    chronomancer: {
        promise: '행동 순서와 턴 자체를 바꾼다',
        silhouette: 'clock orb, time sword, and a cape split into two floating panels',
        weapon: 'short time sword paired with a clearly visible clock orb',
        palette: 'blue, gold, and white',
        parent: 'shaman',
    },
    rogue: {
        promise: '빠른 치명타와 독으로 빈틈을 공략한다',
        silhouette: 'twin daggers, low hood, and a visible poison vial at the belt',
        weapon: 'two short asymmetrical daggers',
        palette: 'charcoal black and poison green',
        parent: 'adventurer',
    },
    assassin: {
        promise: '은신 뒤 한 번의 처형을 완성한다',
        silhouette: 'slender twin blades, lower-face mask, and one restrained shadow afterimage',
        weapon: 'two long narrow execution blades',
        palette: 'black, silver, and magenta',
        parent: 'rogue',
    },
    'shadow-lord': {
        promise: '어둠을 쌓아 확정적인 처형을 완성한다',
        silhouette: 'long shadow blade, crown-shaped horns, and a black trailing afterimage',
        weapon: 'single elongated shadow sword',
        palette: 'black, purple, and blood red',
        parent: 'assassin',
    },
    ranger: {
        promise: '거리와 화살 종류를 선택한다',
        silhouette: 'longbow and a divided quiver showing several distinct arrow types',
        weapon: 'tall practical longbow with one nocked arrow',
        palette: 'forest green and tawny brown',
        parent: 'rogue',
    },
    'hunt-lord': {
        promise: '자연과 사격을 결합해 사냥을 완성한다',
        silhouette: 'enormous longbow, horn ornaments, and a broad beast-hide cloak',
        weapon: 'oversized ceremonial hunting longbow',
        palette: 'deep green, gold, and ivory',
        parent: 'ranger',
    },
});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const parseArgs = (args) => {
    const options = {
        manifest: DEFAULT_MANIFEST,
        output: DEFAULT_OUTPUT,
        provenance: DEFAULT_PROVENANCE,
    };
    for (let index = 0; index < args.length; index += 1) {
        const option = args[index];
        const key = {
            '--manifest': 'manifest',
            '--output': 'output',
            '--provenance': 'provenance',
        }[option];
        if (!key) throw new Error(`Unknown argument: ${option}`);
        const value = args[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
        options[key] = path.resolve(value);
        index += 1;
    }
    return options;
};

const buildPrompt = ({ brief, parent }) => [
    'Use case: stylized-concept',
    'Asset type: canonical game character master',
    SHARED_DIRECTION,
    `Combat promise: ${brief.promise}.`,
    `Role silhouette: ${brief.silhouette}.`,
    `Primary weapon: ${brief.weapon}.`,
    `Palette: ${brief.palette}.`,
    parent
        ? `Lineage continuity: retain the same Aetheria face proportions, pixel density, outline, and body scale as ${parent}, while changing the face detail, primary weapon, and shoulder silhouette for this role.`
        : 'Lineage continuity: establish the restrained base face proportions, pixel density, outline, and body scale for all later Aetheria jobs.',
    'Working delivery fallback: if true transparent PNG cannot be returned, use one perfectly flat solid #00FF7F chroma background with no texture, gradient, shadow, checkerboard, scenery, or background-colored effect touching the hero.',
    'Avoid: palette-only differentiation, hidden face, hidden weapon, cropped feet, floor shadow, environmental glow, labels, logo, watermark, faux transparency checkerboard.',
].join('\n');

export const buildCharacterPromptSet = (manifest) => {
    const entries = manifest?.entries;
    if (!entries || typeof entries !== 'object') throw new Error('Character manifest requires entries');
    const bySlug = new Map(
        Object.entries(entries).map(([job, entry]) => [entry.slug, { ...entry, job }]),
    );
    const missing = LINEAGE_ORDER.filter((slug) => !bySlug.has(slug));
    const extra = [...bySlug.keys()].filter((slug) => !LINEAGE_ORDER.includes(slug));
    if (missing.length || extra.length || bySlug.size !== 18) {
        throw new Error(`Manifest/prompt lineage mismatch: missing=${missing.join(',')} extra=${extra.join(',')}`);
    }

    const promptEntries = LINEAGE_ORDER.map((slug) => {
        const entry = bySlug.get(slug);
        const brief = JOB_BRIEFS[slug];
        if (!brief) throw new Error(`Missing approved job brief: ${slug}`);
        const prompt = buildPrompt({ brief, parent: brief.parent });
        return {
            job: entry.job,
            slug,
            runtimePath: entry.runtimePath,
            lineageParent: brief.parent,
            combatPromise: brief.promise,
            silhouette: brief.silhouette,
            primaryWeapon: brief.weapon,
            palette: brief.palette,
            prompt,
            promptSha256: sha256(prompt),
        };
    });

    return {
        version: 1,
        catalogSha256: manifest.catalogSha256,
        sharedDirection: SHARED_DIRECTION,
        sharedDirectionSha256: sha256(SHARED_DIRECTION),
        sourceDesign: 'docs/LONG_TERM_PLAYER_EXPERIENCE_AND_ART_DESIGN_2026-08-06.md',
        entries: promptEntries,
    };
};

const writeJson = (destination, value) => {
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const main = () => {
    const options = parseArgs(process.argv.slice(2));
    const manifest = JSON.parse(readFileSync(options.manifest, 'utf8'));
    const promptSet = buildCharacterPromptSet(manifest);
    writeJson(options.output, promptSet);

    let provenance = {};
    if (existsSync(options.provenance)) {
        const existing = JSON.parse(readFileSync(options.provenance, 'utf8'));
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) provenance = existing;
    }
    provenance = {
        ...provenance,
        version: 1,
        catalogSha256: manifest.catalogSha256,
        promptSet: {
            generator: 'scripts/generate_job_sprite_prompts.mjs',
            generationTool: 'OpenAI built-in image_gen imagegen',
            sharedDirection: promptSet.sharedDirection,
            sharedDirectionSha256: promptSet.sharedDirectionSha256,
            sourceDesign: promptSet.sourceDesign,
            entries: promptSet.entries.map((entry) => ({
                job: entry.job,
                slug: entry.slug,
                lineageParent: entry.lineageParent,
                combatPromise: entry.combatPromise,
                silhouette: entry.silhouette,
                primaryWeapon: entry.primaryWeapon,
                palette: entry.palette,
                prompt: entry.prompt,
                promptSha256: entry.promptSha256,
            })),
        },
    };
    writeJson(options.provenance, provenance);
    console.log(`Generated ${promptSet.entries.length} canonical character prompts`);
    console.log(`  Output: ${path.relative(REPO_ROOT, options.output)}`);
    console.log(`  Provenance: ${path.relative(REPO_ROOT, options.provenance)}`);
};

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
