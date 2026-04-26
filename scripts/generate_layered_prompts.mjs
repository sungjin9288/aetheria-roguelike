#!/usr/bin/env node
/**
 * generate_layered_prompts.mjs
 *
 * cycle 47 layered character system용 imagegen prompt 자동 생성.
 *
 * 출력:
 *   output/layered-todo.json — 객체 배열 [{ key, layerType, prompt, suggestedPath }]
 *   output/layered-todo.txt — 사람이 읽기 좋은 형식
 *
 * Tier 1 (모험가 완성 — 최소 set, 즉시 시각화 가능):
 *   - body: adventurer (1개)
 *   - cape: cloak (1개)
 *   - armor: leather, plate, robe, coat (4개)
 *   - boots: leather, plate, cloth (3개)
 *   - weapon: dagger, sword, staff, bow, axe, spear (6개)
 *   - helmet: cap, hood, helm, wizard-hat (4개)
 *   = 19개 PNG로 모험가 완성
 *
 * Tier 2 (다른 직업 13명): 직업당 body 1개 = 13개
 * Tier 3 (signature/special weapon variations): 점진적 확장
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'output');
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// 직업별 body 컨셉 (chibi naked weaponless)
const JOB_BODY_CONCEPT = {
    adventurer:    'young brown-haired adventurer hero, friendly determined face',
    warrior:       'fierce mortal warrior, scarred face, muscular build',
    knight:        'noble knight, blonde short hair, royal posture',
    berserker:     'wild barbarian berserker, red unkempt hair, war paint',
    rogue:         'cunning rogue, dark hair, smug grin',
    assassin:      'silent assassin, dark hair, cold eyes',
    ranger:        'forest ranger, brown hair, alert expression',
    mage:          'apprentice mage, blue hair, curious expression',
    archmage:      'wise archmage, white beard, ancient power',
    warlock:       'dark warlock, purple eyes, void aura',
    paladin:       'holy paladin, golden hair, righteous glow',
    chronomancer:  'time mage, silver hair, ageless face',
    'shadow-lord': 'shadow lord, glowing red eyes, dark aura',
    'grand-mage':  'grand archmage, silver-blue magical glow, ancient power',
};

// armor concept (transparent body underneath, layer fits over body)
const ARMOR_CONCEPT = {
    leather: 'leather jerkin armor with belts and pouches',
    plate:   'shiny full plate armor with gold trim',
    robe:    'flowing wizard robe with runed sash',
    coat:    'brown travel coat with leather accents',
};

const BOOTS_CONCEPT = {
    leather: 'sturdy leather boots',
    plate:   'armored steel boots',
    cloth:   'simple cloth shoes',
};

const WEAPON_CONCEPT = {
    dagger:     'rusty iron dagger held in right hand',
    sword:      'steel longsword held in right hand',
    greatsword: 'large two-handed greatsword',
    axe:        'battle axe held in right hand',
    greataxe:   'large two-handed greataxe',
    hammer:     'war hammer held in right hand',
    staff:      'wooden magic staff with glowing blue orb',
    rod:        'short magic rod with crystal',
    wand:       'small magic wand',
    bow:        'wooden shortbow drawn with arrow',
    longbow:    'large longbow drawn with arrow',
    spear:      'long iron spear',
    scythe:     'curved scythe',
    club:       'wooden club',
};

const HELMET_CONCEPT = {
    cap:          'simple cloth cap',
    hood:         'pulled-up cloth hood',
    helm:         'steel knight helm',
    'wizard-hat': 'pointy purple wizard hat with stars',
    'straw-hat':  'rustic straw farmer hat',
};

const CAPE_CONCEPT = {
    cloak: 'flowing royal blue cloak',
};

const STYLE_PREAMBLE = [
    'chibi pixel art game asset, transparent background, 256x256 square canvas',
    'matching style of existing adventurer.png chibi pixel character (warm soft shading, dark outline rgb(42,31,46))',
    'centered with generous padding, no shadow ground, no border, no text',
].join(', ');

const buildBodyPrompt = (jobKey, concept) =>
    `${STYLE_PREAMBLE}, full body chibi character: ${concept}, ` +
    `wearing ONLY plain undergarments (white tunic and brown pants), no armor, no weapon, no cape, ` +
    `arms relaxed at sides with open hands ready to hold weapons, neutral standing pose, ` +
    `this is the BODY layer base — other equipment will be added as separate transparent layers on top`;

const buildLayerPrompt = (layerType, key, concept) => {
    const baseInstr = `${STYLE_PREAMBLE}, ONLY the ${layerType} item: ${concept}, ` +
        `transparent everywhere except the actual item pixels — NO body, NO character, NO ground, ` +
        `positioned exactly where it would fit on a 256x256 chibi character body that stands centered, ` +
        `same scale and proportions as the chibi body layer it overlays`;
    if (layerType === 'weapon') {
        return baseInstr + `, positioned in the right-hand area of the character (~right side of canvas, mid-height)`;
    }
    if (layerType === 'helmet') {
        return baseInstr + `, positioned at the top-center of the canvas (head area)`;
    }
    if (layerType === 'cape') {
        return baseInstr + `, positioned behind the character body (shoulder to ankles), this is the BACK layer`;
    }
    if (layerType === 'boots') {
        return baseInstr + `, positioned at the bottom-center (feet area only)`;
    }
    if (layerType === 'armor') {
        return baseInstr + `, positioned on the chest and torso area (covers body from shoulders to waist)`;
    }
    return baseInstr;
};

const todos = [];

// Tier 1: 모험가 풀 set (Tier 1 ID로 표시)
todos.push({
    tier: 1, key: 'adventurer', layerType: 'body',
    prompt: buildBodyPrompt('adventurer', JOB_BODY_CONCEPT.adventurer),
    suggestedPath: 'public/assets/avatars/layers/body/adventurer.png',
});

todos.push({
    tier: 1, key: 'cloak', layerType: 'cape',
    prompt: buildLayerPrompt('cape', 'cloak', CAPE_CONCEPT.cloak),
    suggestedPath: 'public/assets/avatars/layers/cape/cloak.png',
});

for (const [k, c] of Object.entries(ARMOR_CONCEPT)) {
    todos.push({
        tier: 1, key: k, layerType: 'armor',
        prompt: buildLayerPrompt('armor', k, c),
        suggestedPath: `public/assets/avatars/layers/armor/${k}.png`,
    });
}

for (const [k, c] of Object.entries(BOOTS_CONCEPT)) {
    todos.push({
        tier: 1, key: k, layerType: 'boots',
        prompt: buildLayerPrompt('boots', k, c),
        suggestedPath: `public/assets/avatars/layers/boots/${k}.png`,
    });
}

const TIER_1_WEAPONS = ['dagger', 'sword', 'staff', 'bow', 'axe', 'spear'];
for (const k of TIER_1_WEAPONS) {
    todos.push({
        tier: 1, key: k, layerType: 'weapon',
        prompt: buildLayerPrompt('weapon', k, WEAPON_CONCEPT[k]),
        suggestedPath: `public/assets/avatars/layers/weapon/${k}.png`,
    });
}

for (const [k, c] of Object.entries(HELMET_CONCEPT)) {
    todos.push({
        tier: 1, key: k, layerType: 'helmet',
        prompt: buildLayerPrompt('helmet', k, c),
        suggestedPath: `public/assets/avatars/layers/helmet/${k}.png`,
    });
}

// Tier 2: 다른 직업 12명 body
for (const [k, c] of Object.entries(JOB_BODY_CONCEPT)) {
    if (k === 'adventurer') continue;
    todos.push({
        tier: 2, key: k, layerType: 'body',
        prompt: buildBodyPrompt(k, c),
        suggestedPath: `public/assets/avatars/layers/body/${k}.png`,
    });
}

// Tier 3: 추가 weapon variants
const TIER_3_WEAPONS = ['greatsword', 'greataxe', 'hammer', 'rod', 'wand', 'longbow', 'scythe', 'club'];
for (const k of TIER_3_WEAPONS) {
    todos.push({
        tier: 3, key: k, layerType: 'weapon',
        prompt: buildLayerPrompt('weapon', k, WEAPON_CONCEPT[k]),
        suggestedPath: `public/assets/avatars/layers/weapon/${k}.png`,
    });
}

writeFileSync(path.join(OUTPUT_DIR, 'layered-todo.json'), JSON.stringify(todos, null, 2));

const txtLines = [
    `# layered character imagegen todo — ${todos.length}개`,
    `# 출처: scripts/generate_layered_prompts.mjs`,
    `# imagegen에서 받은 PNG는 suggestedPath에 저장 (또는 staged-layered/{layerType}/{key}.png)`,
    `# 그 후 node scripts/deploy_layered_sprites.mjs 실행 → manifest 자동 갱신 + cap:sync`,
    '',
];
let currentTier = null;
for (const t of todos) {
    if (t.tier !== currentTier) {
        currentTier = t.tier;
        txtLines.push(`\n# ===== Tier ${currentTier} =====\n`);
    }
    txtLines.push(`## ${t.layerType}/${t.key}`);
    txtLines.push(`prompt: ${t.prompt}`);
    txtLines.push(`save_to: ${t.suggestedPath}`);
    txtLines.push('');
}
writeFileSync(path.join(OUTPUT_DIR, 'layered-todo.txt'), txtLines.join('\n'));

console.log(`Generated ${todos.length} layered prompts`);
console.log(`  JSON: output/layered-todo.json`);
console.log(`  TXT:  output/layered-todo.txt`);

const byTier = {};
for (const t of todos) byTier[`Tier ${t.tier}`] = (byTier[`Tier ${t.tier}`] || 0) + 1;
console.log('\nBy tier:', byTier);
const byType = {};
for (const t of todos) byType[t.layerType] = (byType[t.layerType] || 0) + 1;
console.log('By layer type:', byType);
