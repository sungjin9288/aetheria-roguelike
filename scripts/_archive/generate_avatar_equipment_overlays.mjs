import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ITEMS } from '../src/data/items.js';
import {
  EXACT_ITEM_ICON_KEYS,
  SPECIAL_ITEM_ICON_KEYS,
  getArmorStyleFromItem,
  getOffhandVisualKey,
  getWeaponVisualKey,
} from '../src/utils/itemVisuals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'public/assets/equipment-overlays');
const artifactDir = path.join(repoRoot, 'output/imagegen/equipment-avatar-overlays');
const CANVAS = 72;

const rect = (x, y, width, height, fill, extra = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
const poly = (points, fill, extra = '') => `<polygon points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="${fill}" ${extra}/>`;
const pathEl = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hashString = (value) => {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seeded = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shiftHex = (hex, amount = 0) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const parts = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((entry) => parseInt(entry, 16));
  const shifted = parts.map((entry) => clamp(entry + amount, 0, 255).toString(16).padStart(2, '0'));
  return `#${shifted.join('')}`;
};

const softenColor = (hex, alpha = 0.22) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) {
    return `rgba(255,255,255,${alpha})`;
  }
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const keywordPalettes = [
  { patterns: ['녹슨', '낡은', '오래된'], colors: ['#7a5435', '#ba8452', '#e4c28b'] },
  { patterns: ['강철', '철', '기사', '수련생'], colors: ['#6f756d', '#c5c9c4', '#efe6d1'] },
  { patterns: ['마법', '마도', '현자', '지팡이', '로브'], colors: ['#6d5f73', '#b79ce6', '#efe2ff'] },
  { patterns: ['불', '화염', '용'], colors: ['#76412d', '#f0884a', '#ffd49d'] },
  { patterns: ['빙결', '얼음', '냉기'], colors: ['#5d6d77', '#97c8d8', '#e8fbff'] },
  { patterns: ['숲', '자연', '레인저', '여행자'], colors: ['#57654c', '#8ca06d', '#e6f1d1'] },
  { patterns: ['성', '천상', '빛', '성기사'], colors: ['#7b6c4d', '#e1bf79', '#fff1c9'] },
  { patterns: ['어둠', '암흑', '그림자', '공허'], colors: ['#4f4558', '#9f89c2', '#e4d8ff'] },
  { patterns: ['가죽', '도적', '어쌔신'], colors: ['#715a45', '#b78c60', '#ead5bb'] },
  { patterns: ['드래곤', '와이번', '비늘'], colors: ['#615955', '#97a29a', '#eef1ea'] },
];

const defaultPalettes = {
  weapon: ['#766450', '#d2bea0', '#f6ebd7'],
  armor: ['#5e5b56', '#8f8b84', '#d9d3c7'],
  shield: ['#6d665d', '#c5b289', '#f3ead8'],
};

const getPalette = (item) => {
  const name = String(item?.name || '');
  const matched = keywordPalettes.find((entry) => entry.patterns.some((pattern) => name.includes(pattern)));
  const fallback = defaultPalettes[item.type] || defaultPalettes.weapon;
  const [base, accent, glow] = matched?.colors || fallback;
  const tierBoost = (item.tier || 1) * 4;
  return {
    base: shiftHex(base, tierBoost - 4),
    accent: shiftHex(accent, tierBoost),
    glow: shiftHex(glow, tierBoost),
    shadow: 'rgba(10, 12, 16, 0.28)',
    line: shiftHex(base, -24),
  };
};

const renderRightHandWeapon = (kind, palette, rng) => {
  const shine = softenColor(palette.glow, 0.72);
  if (kind === 'greatsword' || kind === 'sword') {
    const heavy = kind === 'greatsword';
    return [
      poly([[48, 38], [54, 40], [41, 61], [36, 58]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[49, 40], [53, 41], [42, 58], [38, 57]], shine, 'shape-rendering="crispEdges"'),
      rect(38, 56, heavy ? 9 : 7, 2, palette.accent, 'shape-rendering="crispEdges"'),
      rect(40, 58, 2, 7, palette.line, 'shape-rendering="crispEdges"'),
      circle(41, 66, heavy ? 2 : 1.5, palette.accent, 'shape-rendering="crispEdges"'),
      rng() > 0.55 ? circle(43, 57, 1, palette.glow, 'shape-rendering="crispEdges"') : '',
    ].join('');
  }
  if (kind === 'dagger') {
    return [
      poly([[50, 43], [54, 44], [46, 57], [42, 55]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[50, 44], [53, 45], [47, 55], [44, 54]], shine, 'shape-rendering="crispEdges"'),
      rect(44, 54, 6, 2, palette.accent, 'shape-rendering="crispEdges"'),
      rect(45, 56, 2, 5, palette.line, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'axe') {
    return [
      rect(46, 42, 2, 21, '#6f5337', 'shape-rendering="crispEdges"'),
      poly([[47, 42], [56, 45], [53, 53], [47, 51]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[48, 44], [54, 46], [52, 51], [48, 50]], shine, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'hammer') {
    return [
      rect(46, 43, 2, 20, '#6f5337', 'shape-rendering="crispEdges"'),
      rect(42, 42, 10, 5, palette.base, 'shape-rendering="crispEdges"'),
      rect(43, 43, 8, 2, shine, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'staff' || kind === 'wand') {
    const short = kind === 'wand';
    return [
      rect(46, short ? 42 : 36, 2, short ? 20 : 28, '#72563d', 'shape-rendering="crispEdges"'),
      circle(47, short ? 42 : 35, short ? 2 : 3, palette.base, 'shape-rendering="crispEdges"'),
      circle(47, short ? 42 : 35, 1.5, palette.glow, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'bow') {
    return [
      pathEl('M44 40 Q51 49 45 61 L47 62 Q54 50 48 39 Z', palette.base, 'shape-rendering="crispEdges"'),
      pathEl('M48 39 Q55 49 49 62 L51 63 Q58 50 52 38 Z', palette.base, 'shape-rendering="crispEdges"'),
      rect(48, 41, 1, 20, palette.glow, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'spear' || kind === 'scythe') {
    return [
      rect(46, 34, 2, 29, '#6f5337', 'shape-rendering="crispEdges"'),
      poly(kind === 'scythe' ? [[43, 35], [48, 35], [44, 42]] : [[45, 33], [49, 35], [47, 40]], palette.base, 'shape-rendering="crispEdges"'),
      kind === 'scythe' ? poly([[42, 36], [46, 36], [42, 41]], shine, 'shape-rendering="crispEdges"') : '',
    ].join('');
  }
  if (kind === 'whip') {
    return [
      rect(45, 50, 3, 8, palette.accent, 'shape-rendering="crispEdges"'),
      rect(43, 57, 3, 2, palette.base, 'shape-rendering="crispEdges"'),
      rect(41, 59, 3, 2, palette.base, 'shape-rendering="crispEdges"'),
      rect(39, 61, 3, 2, palette.base, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  return '';
};

const mirror = (markup) => `<g transform="translate(72 0) scale(-1 1)">${markup}</g>`;

const renderOffhand = (kind, palette, rng) => {
  if (kind === 'shield') {
    return mirror([
      poly([[43, 42], [49, 45], [48, 57], [43, 60], [38, 57], [37, 45]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[43, 45], [47, 47], [46, 55], [43, 57], [40, 55], [39, 47]], softenColor(palette.glow, 0.78), 'shape-rendering="crispEdges"'),
      rect(42, 48, 2, 6, palette.accent, 'shape-rendering="crispEdges"'),
    ].join(''));
  }
  if (kind === 'book') {
    return mirror([
      rect(38, 44, 10, 10, palette.base, 'shape-rendering="crispEdges"'),
      rect(39, 45, 8, 8, softenColor(palette.glow, 0.68), 'shape-rendering="crispEdges"'),
      rect(42, 44, 1, 10, palette.accent, 'shape-rendering="crispEdges"'),
      rng() > 0.5 ? rect(44, 47, 2, 2, palette.accent, 'shape-rendering="crispEdges"') : '',
    ].join(''));
  }
  return mirror(renderRightHandWeapon(kind, palette, rng));
};

const inferArmorKind = (name = '') => {
  if (/모자|투구|두건|후드/.test(name)) return 'head';
  if (/장화|부츠/.test(name)) return 'boots';
  if (/망토|외투/.test(name)) return 'cloak';
  if (/로브|예복|성의|가운|도복/.test(name)) return 'robe';
  if (/장갑/.test(name)) return 'gloves';
  return 'armor';
};

const renderArmor = (item, palette, rng) => {
  const armorStyle = getArmorStyleFromItem(item, 'coat');
  const armorKind = inferArmorKind(item.name || '');
  const trim = softenColor(palette.glow, 0.72);

  const parts = [];

  if (armorKind === 'head') {
    parts.push(
      poly([[20, 14], [28, 10], [43, 10], [52, 16], [47, 24], [24, 24]], palette.base, 'shape-rendering="crispEdges"'),
      rect(25, 22, 20, 2, trim, 'shape-rendering="crispEdges"'),
    );
    return parts.join('');
  }

  if (armorKind === 'boots') {
    parts.push(
      rect(24, 58, 10, 6, palette.base, 'shape-rendering="crispEdges"'),
      rect(40, 58, 10, 6, palette.base, 'shape-rendering="crispEdges"'),
      rect(24, 62, 12, 2, trim, 'shape-rendering="crispEdges"'),
      rect(40, 62, 12, 2, trim, 'shape-rendering="crispEdges"'),
    );
    return parts.join('');
  }

  if (armorKind === 'cloak' || armorStyle === 'coat') {
    parts.push(
      poly([[18, 38], [28, 34], [45, 34], [56, 40], [52, 60], [22, 60]], palette.base, 'shape-rendering="crispEdges"'),
      rect(28, 34, 16, 3, trim, 'shape-rendering="crispEdges"'),
      rect(24, 42, 5, 16, softenColor(palette.base, 0.28), 'shape-rendering="crispEdges"'),
      rect(43, 42, 5, 16, softenColor(palette.base, 0.28), 'shape-rendering="crispEdges"'),
    );
  } else if (armorKind === 'robe' || armorStyle === 'robe') {
    parts.push(
      poly([[20, 36], [28, 33], [44, 33], [52, 36], [50, 61], [22, 61]], palette.base, 'shape-rendering="crispEdges"'),
      rect(28, 33, 16, 3, trim, 'shape-rendering="crispEdges"'),
      rect(33, 37, 3, 21, trim, 'shape-rendering="crispEdges"'),
    );
  } else if (armorStyle === 'plate') {
    parts.push(
      rect(22, 38, 28, 16, palette.base, 'shape-rendering="crispEdges"'),
      rect(24, 36, 24, 4, trim, 'shape-rendering="crispEdges"'),
      rect(23, 42, 6, 12, softenColor(palette.base, 0.26), 'shape-rendering="crispEdges"'),
      rect(43, 42, 6, 12, softenColor(palette.base, 0.26), 'shape-rendering="crispEdges"'),
      rng() > 0.45 ? rect(35, 43, 2, 10, palette.accent, 'shape-rendering="crispEdges"') : '',
    );
  } else {
    parts.push(
      rect(22, 40, 28, 14, palette.base, 'shape-rendering="crispEdges"'),
      rect(23, 42, 5, 12, softenColor(palette.base, 0.24), 'shape-rendering="crispEdges"'),
      rect(44, 42, 5, 12, softenColor(palette.base, 0.24), 'shape-rendering="crispEdges"'),
      rect(28, 39, 16, 2, trim, 'shape-rendering="crispEdges"'),
    );
  }

  if (armorKind === 'gloves') {
    parts.push(
      rect(18, 46, 6, 8, palette.accent, 'shape-rendering="crispEdges"'),
      rect(48, 46, 6, 8, palette.accent, 'shape-rendering="crispEdges"'),
    );
  }

  return parts.join('');
};

const renderOverlaySvg = (item, assetKey) => {
  const palette = getPalette(item);
  const rng = seeded(hashString(`${item.name}:${assetKey}`));
  const weaponKind = item.type === 'weapon' ? getWeaponVisualKey(item) : null;
  const offhandKind = item.type === 'shield' ? getOffhandVisualKey(item) : null;

  let body = '';
  if (item.type === 'weapon') body = renderRightHandWeapon(weaponKind, palette, rng);
  if (item.type === 'shield') body = renderOffhand(offhandKind, palette, rng);
  if (item.type === 'armor') body = renderArmor(item, palette, rng);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" fill="none">
  <defs>
    <filter id="shadow-${assetKey}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.2" stdDeviation="0.8" flood-color="${palette.shadow}"/>
    </filter>
  </defs>
  <g filter="url(#shadow-${assetKey})">
    ${body}
  </g>
</svg>`;
};

const buildEquipmentEntries = () => {
  const byName = new Map();
  const allItems = Object.values(ITEMS).flat().filter(Boolean);
  for (const item of allItems) {
    if (!item?.name || !['weapon', 'armor', 'shield'].includes(item.type)) continue;
    const assetKey = SPECIAL_ITEM_ICON_KEYS[item.name] || EXACT_ITEM_ICON_KEYS[item.name];
    if (!assetKey) continue;
    if (!byName.has(assetKey)) byName.set(assetKey, item);
  }

  const genericEntries = [
    { name: 'generic sword', type: 'weapon', hands: 1, assetKey: 'sword' },
    { name: 'generic greatsword', type: 'weapon', hands: 2, assetKey: 'greatsword' },
    { name: 'generic dagger', type: 'weapon', hands: 1, assetKey: 'dagger' },
    { name: 'generic staff', type: 'weapon', hands: 2, elem: '빛', assetKey: 'staff' },
    { name: 'generic wand', type: 'weapon', hands: 1, elem: '빛', assetKey: 'wand' },
    { name: 'generic bow', type: 'weapon', hands: 2, assetKey: 'bow' },
    { name: 'generic axe', type: 'weapon', hands: 2, assetKey: 'axe' },
    { name: 'generic hammer', type: 'weapon', hands: 2, assetKey: 'hammer' },
    { name: 'generic spear', type: 'weapon', hands: 2, assetKey: 'spear' },
    { name: 'generic scythe', type: 'weapon', hands: 2, assetKey: 'scythe' },
    { name: 'generic whip', type: 'weapon', hands: 1, assetKey: 'whip' },
    { name: 'generic robe', type: 'armor', assetKey: 'robe' },
    { name: 'generic cloak', type: 'armor', assetKey: 'cloak' },
    { name: 'generic armor', type: 'armor', assetKey: 'armor' },
    { name: 'generic shield', type: 'shield', assetKey: 'shield' },
    { name: 'generic book', type: 'shield', subtype: 'focus', assetKey: 'book' },
  ];

  const entries = [...byName.entries()].map(([assetKey, item]) => ({ ...item, assetKey }));
  return [...entries, ...genericEntries];
};

const buildContactSheet = (entries) => {
  const columns = 6;
  const tile = 92;
  const rows = Math.ceil(entries.length / columns);
  const width = columns * tile;
  const height = rows * tile;
  const tiles = entries.map((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * tile;
    const y = row * tile;
    return `
      <g transform="translate(${x}, ${y})">
        <rect x="4" y="4" width="${tile - 8}" height="${tile - 8}" rx="12" fill="#0e131b" stroke="rgba(255,255,255,0.08)"/>
        <image href="../../public/assets/equipment-overlays/${entry.assetKey}.svg" x="10" y="10" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>
        <text x="${tile / 2}" y="${tile - 10}" text-anchor="middle" fill="#dbe4ee" font-size="7" font-family="Menlo, monospace">${entry.assetKey}</text>
      </g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#070b11"/>
  ${tiles}
</svg>`;
};

const main = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(artifactDir, { recursive: true });

  const entries = buildEquipmentEntries();

  for (const entry of entries) {
    const svg = renderOverlaySvg(entry, entry.assetKey);
    await fs.writeFile(path.join(outputDir, `${entry.assetKey}.svg`), svg, 'utf8');
  }

  const manifest = entries.map((entry) => ({
    assetKey: entry.assetKey,
    name: entry.name,
    type: entry.type,
  }));

  await fs.writeFile(path.join(artifactDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(artifactDir, 'contact-sheet.svg'), buildContactSheet(entries), 'utf8');

  console.log(`generated ${entries.length} avatar equipment overlays`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
