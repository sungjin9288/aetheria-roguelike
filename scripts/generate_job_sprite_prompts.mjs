#!/usr/bin/env node
/**
 * generate_job_sprite_prompts.mjs
 *
 * 직업별 sprite 보강 — 누락된 job-armor-typicalLoadout sprite 명단과 imagegen
 * prompt를 자동 생성. cycle 43 가 직업 typical loadout sprite를 prefer하므로
 * 부족한 자산을 imagegen으로 채우면 캐릭터 시각이 더 풍부해진다.
 *
 * 사용법:
 *   node scripts/generate_job_sprite_prompts.mjs
 *
 * 출력:
 *   output/job-sprite-todo.json — 객체 배열 [{ key, job, armor, typical, prompt, suggestedPath }]
 *   output/job-sprite-todo.txt — 사람이 읽기 좋은 형식
 *
 * 기존 sprite 패턴 참고:
 *   - /assets/avatars/adventurer-coat.png 등은 hand-drawn / AI 생성된 chibi 픽셀 아트
 *   - 새 sprite도 같은 결로 만들어야 fitting (caption 유사하게 작성)
 *
 * imagegen에서 받은 PNG는 public/assets/avatars/{key}.png에 저장하면
 * AVAILABLE_AVATAR_KEYS set에 자동 등록 필요 (다음 워크플로우 참조).
 */

import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JOB_TYPICAL_LOADOUT } from '../src/utils/avatarSpriteCandidates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const AVATARS_DIR = path.join(REPO_ROOT, 'public/assets/avatars');
const OUTPUT_DIR = path.join(REPO_ROOT, 'output');

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const ARMOR_STYLES = ['coat', 'leather', 'plate', 'robe'];

// 직업별 비주얼 컨셉 (한글 이름 → 영어 prompt 컨셉)
const JOB_CONCEPT = {
    warrior:      'fierce mortal warrior, scarred face, brown hair',
    knight:       'noble knight, blonde hair, clean armor, royal blue accents',
    berserker:    'berserker barbarian, wild red hair, war paint, savage grin',
    rogue:        'cunning rogue thief, dark hair, smug grin, leather hood',
    assassin:     'silent assassin, dark hair, half-mask, midnight outfit',
    ranger:       'forest ranger, brown hair, green hood, alert eyes',
    mage:         'apprentice mage, blue hat, glowing book, curious expression',
    archmage:     'archmage scholar, white beard, runed staff, gold-trim robe',
    warlock:      'dark warlock, black hood, glowing purple eyes, void energy',
    paladin:      'holy paladin, golden halo, white-and-gold plate, righteous glow',
    chronomancer: 'time mage, silver hair, hourglass amulet, blue robe',
    'shadow-lord':'shadow lord, black cape, glowing red eyes, evil aura',
    'grand-mage': 'grand archmage, silver-blue robe, celestial runes, ancient power',
};

const ARMOR_CONCEPT = {
    coat:    'travel coat, leather pouch, sturdy boots',
    leather: 'leather jerkin armor, brown belts, agile',
    plate:   'full plate armor, polished steel',
    robe:    'flowing wizard robe, runed sash',
};

const LOADOUT_CONCEPT = {
    sword:    'holding a longsword in right hand',
    dagger:   'dual-wielding daggers, ready stance',
    'fang-dagger': 'dual-wielding fang daggers',
    'throwing-blade': 'holding throwing blades',
    twinblade: 'twin-blade dual sword',
    greatsword: 'wielding a greatsword two-handed',
    greataxe: 'wielding a greataxe two-handed',
    axe:      'holding a battle axe',
    hammer:   'holding a war hammer',
    mace:     'holding a mace',
    bow:      'drawing a shortbow with arrow nocked',
    longbow:  'drawing a longbow with arrow nocked',
    archer:   'drawing a longbow with arrow nocked',
    staff:    'holding a magic staff with glowing orb',
    rod:      'holding a magic rod',
    wand:     'holding a magic wand',
    caster:   'holding a magic staff with glowing orb',
    spear:    'holding a long spear',
    lance:    'holding a long lance',
    lancer:   'holding a long lance',
    scythe:   'wielding a scythe',
    whip:     'holding a coiled whip',
    guardian: 'holding sword and round shield, defensive stance',
    heavy:    'wielding a heavy two-handed weapon',
};

const buildPrompt = (job, armor, typical) => {
    const jobC = JOB_CONCEPT[job] || 'fantasy adventurer';
    const armorC = ARMOR_CONCEPT[armor] || 'travel outfit';
    const loadoutC = LOADOUT_CONCEPT[typical] || 'standing ready';
    return [
        'chibi pixel art game character, full body portrait, transparent background',
        'matching style of existing adventurer.png and adventurer-coat.png assets',
        'mobile RPG hero sprite, soft warm shading, dark outline rgb(42,31,46)',
        '512x512 square canvas with character centered, generous padding',
        'no shadow ground, no text, no border',
        `subject: ${jobC}, wearing ${armorC}, ${loadoutC}`,
    ].join(', ');
};

const allKeys = new Set(
    readdirSync(AVATARS_DIR)
        .filter((f) => f.endsWith('.png'))
        .map((f) => f.replace('.png', ''))
);

const todos = [];
for (const [job, typical] of Object.entries(JOB_TYPICAL_LOADOUT)) {
    for (const armor of ARMOR_STYLES) {
        const key = `${job}-${armor}-${typical}`;
        if (allKeys.has(key)) continue;
        // armor 변형 sprite (job-armor)도 우선순위에 있으니 같이 체크
        const armorOnlyKey = `${job}-${armor}`;
        const haveArmorOnly = allKeys.has(armorOnlyKey);
        todos.push({
            key,
            job,
            armor,
            typical,
            haveArmorOnly,
            prompt: buildPrompt(job, armor, typical),
            suggestedPath: `public/assets/avatars/${key}.png`,
        });
    }
}

writeFileSync(path.join(OUTPUT_DIR, 'job-sprite-todo.json'), JSON.stringify(todos, null, 2));

const txtLines = [
    `# job sprite todo — 누락 ${todos.length}개`,
    `# 출처: scripts/generate_job_sprite_prompts.mjs`,
    `# imagegen에서 받은 PNG는 suggestedPath에 저장`,
    `# 그 후 src/utils/avatarSpriteCandidates.js의 AVAILABLE_AVATAR_KEYS set에 자동 등록 필요`,
    '',
];
for (const t of todos) {
    txtLines.push(`## ${t.key} | job=${t.job} armor=${t.armor} typical=${t.typical}`);
    txtLines.push(`prompt: ${t.prompt}`);
    txtLines.push(`save_to: ${t.suggestedPath}`);
    txtLines.push('');
}
writeFileSync(path.join(OUTPUT_DIR, 'job-sprite-todo.txt'), txtLines.join('\n'));

console.log(`Generated ${todos.length} job sprite prompts`);
console.log(`  JSON: output/job-sprite-todo.json`);
console.log(`  TXT:  output/job-sprite-todo.txt`);

const byJob = {};
for (const t of todos) byJob[t.job] = (byJob[t.job] || 0) + 1;
console.log('\nBy job:', byJob);
