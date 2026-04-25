#!/usr/bin/env node
/**
 * generate_imagegen_prompts.mjs
 *
 * imagegen으로 만들어지지 않은 weapon/armor/shield 아이템들의 명단 + prompt를 출력.
 * 사용자가 imagegen tool에 batch로 던질 수 있도록 정리.
 *
 * 사용법:
 *   node scripts/generate_imagegen_prompts.mjs [--type=weapon|armor|shield] [--limit=N]
 *
 * 출력:
 *   output/imagegen-todo.json — 객체 배열 [{ key, name, type, tier, prompt, suggestedPath }]
 *   output/imagegen-todo.txt — 사람이 읽기 좋은 형식 (key | name | prompt)
 *
 * imagegen에서 받은 PNG는 public/assets/equipment-exact/{key}.png에 배치하면
 * 자동으로 게임에 반영됨. 그 다음 cycle 36의 IMAGEGEN_OVERLAY_KEYS set에
 * 새 키들을 추가하면 character overlay에도 적용.
 */

import { ITEMS } from '../src/data/items.js';
import {
    EXACT_ITEM_ICON_KEYS,
    SPECIAL_ITEM_ICON_KEYS,
    IMAGEGEN_OVERLAY_KEYS,
} from '../src/utils/itemVisuals.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'output');

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    acc[k] = v ?? true;
    return acc;
}, {});

// 무기 type 추론 (이름 기반)
const inferWeaponShape = (name) => {
    if (/단검|단도|독아|송곳니|표창/.test(name)) return 'dagger';
    if (/검(?!\s*감시|장)|소드|블레이드|레이피어|사브르|시미터|팔치온/.test(name)) return 'sword';
    if (/대검|양손검|그레이트소드|클레이모어/.test(name)) return 'greatsword';
    if (/도끼|액스/.test(name)) return 'axe';
    if (/대도끼|그레이트액스/.test(name)) return 'greataxe';
    if (/해머|망치|메이스|철퇴/.test(name)) return 'hammer';
    if (/지팡이|로드|스태프/.test(name)) return 'staff';
    if (/완드|마법봉/.test(name)) return 'wand';
    if (/활|궁(?!수)/.test(name)) return /장궁|롱보우/.test(name) ? 'longbow' : 'bow';
    if (/창|랜스|글레이브/.test(name)) return 'spear';
    if (/낫|사이즈/.test(name)) return 'scythe';
    if (/채찍|위프/.test(name)) return 'whip';
    if (/곤봉/.test(name)) return 'club';
    return 'sword';
};

// 재질/속성 hint
const inferMaterial = (name) => {
    if (/녹슨|낡은/.test(name)) return 'rusty iron, weathered';
    if (/나무|목재|곤봉/.test(name)) return 'carved wood, brass fittings';
    if (/뼈|본/.test(name)) return 'bleached bone, dark sinew';
    if (/강철|스틸/.test(name)) return 'polished steel, leather grip';
    if (/은/.test(name)) return 'silver, blue gem';
    if (/금|골드/.test(name)) return 'gold, ornate engraving';
    if (/용|드래곤/.test(name)) return 'dragon scale plating, red gem';
    if (/얼음|빙|서리/.test(name)) return 'ice crystal, frost glow';
    if (/불꽃|화염|용암/.test(name)) return 'molten edge, ember glow';
    if (/빛|성광|성/.test(name)) return 'radiant gold, white aura';
    if (/어둠|암흑|심연|공허/.test(name)) return 'obsidian, purple void glow';
    if (/마법|마도|아크|에테르|차원/.test(name)) return 'arcane runes, blue gem';
    if (/세계수|숲|자연/.test(name)) return 'living wood, green leaves';
    return 'steel, leather grip';
};

// armor 종류 추론
const inferArmorShape = (name) => {
    if (/로브|예복|성의/.test(name)) return 'wizard robe';
    if (/판금|풀플레이트|중갑|중장|갑주/.test(name)) return 'full plate armor';
    if (/가죽|경갑/.test(name)) return 'leather jerkin';
    if (/외투|망토|클로크/.test(name)) return 'travel cloak';
    if (/튜닉|복/.test(name)) return 'tunic';
    if (/모자|후드|투구/.test(name)) return 'helmet';
    return 'tunic';
};

// shield 종류
const inferShieldShape = (name) => {
    if (/마도서|그리모어|주문서|책/.test(name)) return 'magic tome';
    if (/원형|라운드/.test(name)) return 'round shield';
    if (/카이트|타워/.test(name)) return 'tall kite shield';
    return 'kite shield';
};

const buildPrompt = (item) => {
    const tier = item.tier || 1;
    const tierWord = tier <= 1 ? 'common starter' : tier <= 2 ? 'apprentice' : tier <= 3 ? 'veteran' : tier <= 4 ? 'rare' : tier <= 5 ? 'legendary' : 'mythic';
    const material = inferMaterial(item.name);

    const stylePreamble = 'chibi pixel art game asset, transparent background, no shadow ground, no pedestal, dark outline rgb(42,31,46), soft shading, warm palette, matching mobile RPG adventurer chibi character style, 256x256';

    if (item.type === 'weapon') {
        const shape = inferWeaponShape(item.name);
        return `${stylePreamble}, single ${tierWord} ${shape} weapon (Korean: ${item.name}), ${material}, blade pointing up-right at 45 degrees, isolated weapon only, full handle visible`;
    }
    if (item.type === 'armor') {
        const shape = inferArmorShape(item.name);
        return `${stylePreamble}, single ${tierWord} ${shape} (Korean: ${item.name}), ${material}, displayed flat front-view, no character body, isolated garment only`;
    }
    if (item.type === 'shield') {
        const shape = inferShieldShape(item.name);
        return `${stylePreamble}, single ${tierWord} ${shape} (Korean: ${item.name}), ${material}, displayed front-view, isolated shield only`;
    }
    return null;
};

const filterType = args.type || null;
const limit = args.limit ? Number(args.limit) : null;

const allItems = Object.values(ITEMS).flat().filter((i) => i && ['weapon', 'armor', 'shield'].includes(i.type));
const todos = [];

for (const item of allItems) {
    if (filterType && item.type !== filterType) continue;
    const exactKey = EXACT_ITEM_ICON_KEYS[item.name] || SPECIAL_ITEM_ICON_KEYS[item.name];
    if (!exactKey) continue;
    if (IMAGEGEN_OVERLAY_KEYS.has(exactKey)) continue;
    if (exactKey.startsWith('named-')) continue;  // signature는 별도 pipeline

    const prompt = buildPrompt(item);
    if (!prompt) continue;

    todos.push({
        key: exactKey,
        name: item.name,
        type: item.type,
        tier: item.tier,
        prompt,
        suggestedPath: `public/assets/equipment-exact/${exactKey}.png`,
    });

    if (limit && todos.length >= limit) break;
}

const jsonPath = path.join(OUTPUT_DIR, 'imagegen-todo.json');
writeFileSync(jsonPath, JSON.stringify(todos, null, 2));

const txtLines = [
    `# imagegen todo — ${todos.length} 개 아이템`,
    `# 출처: scripts/generate_imagegen_prompts.mjs`,
    `# imagegen에서 받은 PNG는 suggestedPath에 저장하면 자동 적용`,
    `# 그 후 src/utils/itemVisuals.js의 IMAGEGEN_OVERLAY_KEYS set에 키 추가`,
    '',
];
for (const t of todos) {
    txtLines.push(`## ${t.key} | ${t.name} | type=${t.type} tier=${t.tier}`);
    txtLines.push(`prompt: ${t.prompt}`);
    txtLines.push(`save_to: ${t.suggestedPath}`);
    txtLines.push('');
}
const txtPath = path.join(OUTPUT_DIR, 'imagegen-todo.txt');
writeFileSync(txtPath, txtLines.join('\n'));

console.log(`Generated ${todos.length} imagegen prompts`);
console.log(`  JSON: ${jsonPath}`);
console.log(`  TXT:  ${txtPath}`);
console.log('\nType breakdown:');
const byType = {};
for (const t of todos) byType[t.type] = (byType[t.type] || 0) + 1;
console.log(byType);
