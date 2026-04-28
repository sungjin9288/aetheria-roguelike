import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ITEMS } from '../src/data/items.js';
import { EXACT_ITEM_ICON_KEYS } from '../src/utils/itemVisuals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'public/assets/items');
const artifactDir = path.join(repoRoot, 'output/imagegen/all-item-exact-svgs');
const CANVAS = 160;

const rect = (x, y, width, height, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const poly = (points, fill, extra = '') =>
  `<polygon points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, width, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="square" ${extra}/>`;
const pathEl = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const shiftHex = (hex, amount = 0) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const parts = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((entry) => parseInt(entry, 16));
  const shifted = parts.map((entry) => clamp(entry + amount, 0, 255).toString(16).padStart(2, '0'));
  return `#${shifted.join('')}`;
};

const mulHex = (hex, factor = 1) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const parts = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((entry) => parseInt(entry, 16));
  const shifted = parts.map((entry) => clamp(Math.round(entry * factor), 0, 255).toString(16).padStart(2, '0'));
  return `#${shifted.join('')}`;
};

const keywordPalettes = [
  { patterns: ['녹슨', '낡은', '오래된'], colors: ['#7c5235', '#b37a46', '#d1a069'] },
  { patterns: ['강철', '철'], colors: ['#5f7086', '#bcc8d6', '#dce6f2'] },
  { patterns: ['미스릴', '은빛'], colors: ['#5a7ed1', '#d6f0ff', '#eef9ff'] },
  { patterns: ['흑요석', '어둠', '암흑', '그림자', '공허'], colors: ['#251f3c', '#7146c6', '#d1b9ff'] },
  { patterns: ['화염', '불', '용암'], colors: ['#872212', '#f97316', '#ffd27a'] },
  { patterns: ['빙결', '얼음', '냉기', '설원', '서리'], colors: ['#25506c', '#67e8f9', '#dff7ff'] },
  { patterns: ['번개', '폭풍', '천공'], colors: ['#29436d', '#8ab4ff', '#fff3ad'] },
  { patterns: ['대지', '사막', '황혼'], colors: ['#6a4b2a', '#c28b4c', '#f6d8a7'] },
  { patterns: ['자연', '숲', '엘프', '레인저'], colors: ['#24503b', '#6cc46a', '#dff6d1'] },
  { patterns: ['성', '천상', '신성', '빛', '축복', '성기사'], colors: ['#82652a', '#f6d98b', '#fff7d1'] },
  { patterns: ['피', '광기', '광전사'], colors: ['#5d1824', '#e55b58', '#ffd4be'] },
  { patterns: ['기계', '드워프'], colors: ['#425567', '#7dd4d8', '#e8f4ff'] },
  { patterns: ['독', '맹독'], colors: ['#315132', '#7ad05f', '#defbb3'] },
  { patterns: ['심연', '마왕'], colors: ['#2b223f', '#cf5fdc', '#f3c8ff'] },
];

const categoryDefaults = {
  weapon: ['#46659f', '#cdd8e6', '#f6e7c8'],
  armor: ['#35506a', '#8fa7bd', '#e9f2fa'],
  shield: ['#425164', '#d6dee8', '#f4d9a2'],
  consumable: ['#6b2f2f', '#ea5a63', '#ffd6cf'],
  material: ['#38495f', '#7dd4d8', '#e5fbff'],
  key: ['#6b5a2a', '#d9b469', '#fff2c3'],
  relic: ['#523b79', '#c39dff', '#f4ddff'],
  misc: ['#475569', '#b9c7d6', '#eef7ff'],
};

const inferCategory = (item) => {
  if (item.type === 'weapon') return 'weapon';
  if (item.type === 'armor') return 'armor';
  if (item.type === 'shield') return 'shield';
  if (['hp', 'mp', 'cure', 'buff'].includes(item.type)) return 'consumable';
  if (item.type === 'mat') return 'material';
  if (item.type === 'key') return 'key';
  if (item.type === 'all') return 'relic';
  return 'misc';
};

const getPalette = (item) => {
  const name = String(item.name || '');
  const match = keywordPalettes.find((entry) => entry.patterns.some((pattern) => name.includes(pattern)));
  const [base, accent, glow] = match?.colors || categoryDefaults[inferCategory(item)];
  const tierBoost = (item.tier || 1) * 6;
  return {
    base: shiftHex(base, tierBoost - 8),
    accent: shiftHex(accent, tierBoost),
    glow: shiftHex(glow, tierBoost),
    edge: mulHex(base, 0.58),
    shadow: 'rgba(8, 12, 18, 0.22)',
  };
};

const inferWeaponKind = (name = '') => {
  if (/지팡이|마법봉|마도서|완드|스태프/.test(name)) return 'staff';
  if (/활|궁/.test(name)) return 'bow';
  if (/창/.test(name)) return 'spear';
  if (/낫/.test(name)) return 'scythe';
  if (/도끼|포크/.test(name)) return 'axe';
  if (/해머|망치|철퇴|메이스|곤봉/.test(name)) return 'hammer';
  if (/단검|송곳니|표창|레이피어|시미터|칼/.test(name)) return 'dagger';
  if (/채찍/.test(name)) return 'whip';
  if (/양손검|대검/.test(name)) return 'greatsword';
  return 'sword';
};

const inferArmorKind = (name = '') => {
  if (/모자|투구|두건|후드/.test(name)) return 'head';
  if (/장화|부츠/.test(name)) return 'boots';
  if (/망토|외투/.test(name)) return 'cloak';
  if (/로브|예복|성의|가운|도복/.test(name)) return 'robe';
  if (/장갑/.test(name)) return 'gloves';
  return 'armor';
};

const inferShieldKind = (name = '', subtype = '') => {
  if (subtype === 'focus' || /마도서|서판|그리모어|성전/.test(name)) return 'book';
  return 'shield';
};

const inferMaterialKind = (name = '') => {
  if (/광석|원석|오리할콘|금속/.test(name)) return 'ore';
  if (/결정|수정|진주|파편/.test(name)) return 'crystal';
  if (/비늘|가죽|껍질|날개|깃털/.test(name)) return 'scale';
  if (/이빨|송곳니/.test(name)) return 'fang';
  if (/뼈|붕대/.test(name)) return 'bone';
  if (/핵|심장|혼|정수|코어|잉크/.test(name)) return 'core';
  if (/각인석|문장/.test(name)) return 'relic';
  if (/포자|이슬|눈물|성수|젤리|피/.test(name)) return 'herb';
  if (/열쇠/.test(name)) return 'key';
  if (/주머니/.test(name)) return 'pouch';
  return 'material';
};

const gem = (x, y, palette, rng) => {
  const size = 8 + Math.floor(rng() * 6);
  return [
    poly(
      [
        [x, y],
        [x + size, y + size / 2],
        [x, y + size],
        [x - size, y + size / 2],
      ],
      palette.accent,
      'shape-rendering="crispEdges"',
    ),
    poly(
      [
        [x, y + 2],
        [x + size / 2, y + size / 2],
        [x, y + size - 2],
        [x - size / 2, y + size / 2],
      ],
      palette.glow,
      'opacity="0.76" shape-rendering="crispEdges"',
    ),
  ].join('');
};

const renderSword = (palette, rng, kind) => {
  const longBlade = kind === 'greatsword';
  const bladeWidth = longBlade ? 22 : 14;
  const bladeHeight = longBlade ? 78 : 66;
  const baseX = longBlade ? 88 : 84;
  const guardWidth = longBlade ? 34 : 26;
  const hiltHeight = longBlade ? 24 : 20;
  return [
    poly(
      [
        [baseX, 18],
        [baseX + bladeWidth, 28],
        [baseX + Math.floor(bladeWidth * 0.62), 28 + bladeHeight],
        [baseX - Math.floor(bladeWidth * 0.38), 18 + bladeHeight],
      ],
      palette.base,
      'shape-rendering="crispEdges"',
    ),
    poly(
      [
        [baseX + 4, 24],
        [baseX + bladeWidth - 2, 30],
        [baseX + Math.floor(bladeWidth * 0.58), 24 + bladeHeight - 10],
        [baseX + 1, 26 + bladeHeight - 8],
      ],
      palette.glow,
      'opacity="0.82" shape-rendering="crispEdges"',
    ),
    rect(baseX - 10, 28 + bladeHeight, guardWidth, 10, palette.accent, 'shape-rendering="crispEdges"'),
    rect(baseX + 2, 38 + bladeHeight, 10, hiltHeight, palette.edge, 'shape-rendering="crispEdges"'),
    circle(baseX + 7, 40 + bladeHeight + hiltHeight, 7, palette.accent, 'shape-rendering="crispEdges"'),
    rng() > 0.55 ? gem(baseX + Math.floor(bladeWidth / 2), 34 + bladeHeight, palette, rng) : '',
  ].join('');
};

const renderDagger = (palette, rng) => {
  const tilt = Math.floor(rng() * 8);
  return [
    poly([[86, 28], [104, 40], [74, 90], [60, 78]], palette.base, 'shape-rendering="crispEdges"'),
    poly([[86, 32], [98, 40], [72, 82], [64, 76]], palette.glow, 'opacity="0.76" shape-rendering="crispEdges"'),
    rect(58 - tilt, 74, 28, 8, palette.accent, 'shape-rendering="crispEdges"'),
    rect(62 - tilt, 82, 10, 24, palette.edge, 'shape-rendering="crispEdges"'),
    circle(67 - tilt, 110, 6, palette.accent, 'shape-rendering="crispEdges"'),
  ].join('');
};

const renderAxe = (palette, rng) => {
  const doubleBlade = rng() > 0.62;
  return [
    rect(78, 22, 10, 96, '#6d4a2a', 'shape-rendering="crispEdges"'),
    poly([[88, 30], [122, 42], [112, 74], [88, 66]], palette.base, 'shape-rendering="crispEdges"'),
    poly([[90, 36], [114, 44], [106, 66], [90, 60]], palette.glow, 'opacity="0.82" shape-rendering="crispEdges"'),
    doubleBlade ? poly([[78, 34], [52, 48], [60, 76], [78, 66]], palette.accent, 'shape-rendering="crispEdges"') : '',
    rect(74, 22, 18, 8, palette.edge, 'shape-rendering="crispEdges"'),
  ].join('');
};

const renderHammer = (palette, rng) => {
  const spiked = rng() > 0.56;
  return [
    rect(76, 28, 10, 90, '#6d4a2a', 'shape-rendering="crispEdges"'),
    rect(52, 34, 58, 24, palette.base, 'shape-rendering="crispEdges"'),
    rect(58, 40, 46, 12, palette.glow, 'opacity="0.82" shape-rendering="crispEdges"'),
    spiked ? poly([[52, 46], [42, 52], [52, 58]], palette.accent, 'shape-rendering="crispEdges"') : '',
    spiked ? poly([[110, 46], [120, 52], [110, 58]], palette.accent, 'shape-rendering="crispEdges"') : '',
  ].join('');
};

const renderStaff = (palette, rng, short = false) => {
  const headY = short ? 34 : 24;
  const tailY = short ? 112 : 120;
  const orbX = 82 + Math.floor(rng() * 8);
  const orbY = headY - 2;
  return [
    rect(76, headY + 12, 8, tailY - headY, '#6d4a2a', 'shape-rendering="crispEdges"'),
    rect(72, tailY - 18, 16, 8, palette.accent, 'shape-rendering="crispEdges"'),
    line(80, headY + 8, 80, tailY, palette.edge, 3),
    circle(80, orbY + 6, 14, palette.base, 'shape-rendering="crispEdges"'),
    circle(80, orbY + 6, 9, palette.glow, 'opacity="0.82" shape-rendering="crispEdges"'),
    gem(80, orbY, palette, rng),
    rng() > 0.48 ? circle(96, orbY + 14, 4, palette.accent, 'opacity="0.78" shape-rendering="crispEdges"') : '',
  ].join('');
};

const renderBow = (palette, rng) => {
  const offset = Math.floor(rng() * 8);
  return [
    pathEl(
      `M52 ${118 - offset} Q42 80 52 ${42 + offset} L62 ${42 + offset} Q52 80 62 ${118 - offset} Z`,
      palette.base,
      'shape-rendering="crispEdges"',
    ),
    pathEl(
      `M102 ${42 + offset} Q112 80 102 ${118 - offset} L92 ${118 - offset} Q102 80 92 ${42 + offset} Z`,
      palette.base,
      'shape-rendering="crispEdges"',
    ),
    line(58, 44 + offset, 96, 116 - offset, palette.glow, 3),
    line(58, 116 - offset, 96, 44 + offset, palette.edge, 2, 'opacity="0.55"'),
    rect(70, 74, 20, 8, palette.accent, 'shape-rendering="crispEdges"'),
  ].join('');
};

const renderSpear = (palette, rng) => {
  const flag = rng() > 0.44;
  return [
    rect(77, 20, 6, 104, '#6d4a2a', 'shape-rendering="crispEdges"'),
    poly([[80, 12], [94, 32], [80, 46], [66, 32]], palette.base, 'shape-rendering="crispEdges"'),
    poly([[80, 18], [88, 32], [80, 40], [72, 32]], palette.glow, 'opacity="0.84" shape-rendering="crispEdges"'),
    flag ? poly([[84, 50], [114, 58], [84, 74]], palette.accent, 'shape-rendering="crispEdges"') : '',
    rect(72, 118, 16, 10, palette.edge, 'shape-rendering="crispEdges"'),
  ].join('');
};

const renderScythe = (palette, rng) => [
  rect(76, 24, 8, 98, '#6d4a2a', 'shape-rendering="crispEdges"'),
  poly([[82, 20], [126, 26], [126, 44], [92, 44], [84, 78], [68, 74], [74, 40], [52, 38], [56, 24]], palette.base, 'shape-rendering="crispEdges"'),
  poly([[84, 26], [116, 30], [116, 40], [90, 40], [84, 64], [74, 62], [78, 38], [60, 36], [62, 28]], palette.glow, 'opacity="0.84" shape-rendering="crispEdges"'),
  gem(72, 108, palette, rng),
].join('');

const renderWhip = (palette, rng) => {
  const tipY = 34 + Math.floor(rng() * 18);
  return [
    rect(48, 94, 20, 12, palette.edge, 'shape-rendering="crispEdges"'),
    pathEl(`M66 98 C90 84, 108 70, 114 52 C118 40, 126 34, 136 ${tipY}`, 'none', `stroke="${palette.base}" stroke-width="10" stroke-linecap="round"`),
    pathEl(`M66 98 C90 84, 108 70, 114 52 C118 40, 126 34, 136 ${tipY}`, 'none', `stroke="${palette.glow}" stroke-width="5" stroke-linecap="round" opacity="0.76"`),
    circle(136, tipY, 6, palette.accent, 'shape-rendering="crispEdges"'),
  ].join('');
};

const renderWeaponIcon = (item, palette, rng) => {
  const kind = inferWeaponKind(item.name || '');
  if (kind === 'greatsword' || kind === 'sword') return renderSword(palette, rng, kind);
  if (kind === 'dagger') return renderDagger(palette, rng);
  if (kind === 'axe') return renderAxe(palette, rng);
  if (kind === 'hammer') return renderHammer(palette, rng);
  if (kind === 'staff') return renderStaff(palette, rng, /마법봉|완드/.test(item.name || ''));
  if (kind === 'bow') return renderBow(palette, rng);
  if (kind === 'spear') return renderSpear(palette, rng);
  if (kind === 'scythe') return renderScythe(palette, rng);
  if (kind === 'whip') return renderWhip(palette, rng);
  return renderSword(palette, rng, 'sword');
};

const renderArmorIcon = (item, palette, rng) => {
  const kind = inferArmorKind(item.name || '');
  if (kind === 'head') {
    return [
      poly([[48, 102], [58, 56], [88, 34], [116, 48], [108, 104]], palette.base, 'shape-rendering="crispEdges"'),
      rect(54, 76, 52, 14, palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
      rect(60, 98, 40, 10, palette.accent, 'shape-rendering="crispEdges"'),
      rng() > 0.5 ? gem(110, 48, palette, rng) : '',
    ].join('');
  }
  if (kind === 'boots') {
    return [
      rect(42, 58, 26, 48, palette.base, 'shape-rendering="crispEdges"'),
      rect(92, 52, 26, 54, palette.base, 'shape-rendering="crispEdges"'),
      rect(34, 98, 42, 20, palette.edge, 'shape-rendering="crispEdges"'),
      rect(84, 98, 42, 20, palette.edge, 'shape-rendering="crispEdges"'),
      rect(48, 66, 14, 24, palette.glow, 'opacity="0.76" shape-rendering="crispEdges"'),
      rect(98, 62, 14, 24, palette.glow, 'opacity="0.76" shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'cloak') {
    return [
      poly([[46, 36], [116, 44], [128, 118], [90, 126], [62, 118], [34, 52]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[56, 44], [106, 50], [116, 108], [88, 114], [64, 108], [44, 56]], palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
      rect(60, 46, 40, 10, palette.accent, 'shape-rendering="crispEdges"'),
      rng() > 0.48 ? gem(108, 54, palette, rng) : '',
    ].join('');
  }
  if (kind === 'robe') {
    return [
      poly([[54, 34], [106, 34], [118, 66], [108, 122], [52, 122], [42, 66]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[62, 44], [98, 44], [108, 70], [98, 112], [62, 112], [52, 70]], palette.glow, 'opacity="0.76" shape-rendering="crispEdges"'),
      rect(72, 40, 16, 70, palette.accent, 'shape-rendering="crispEdges"'),
      rect(58, 72, 48, 8, palette.edge, 'opacity="0.5" shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'gloves') {
    return [
      poly([[38, 76], [58, 56], [74, 66], [62, 108], [38, 104]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[86, 66], [104, 54], [124, 74], [122, 104], [98, 108]], palette.base, 'shape-rendering="crispEdges"'),
      rect(46, 84, 14, 10, palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
      rect(98, 80, 14, 10, palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
    ].join('');
  }
  return [
    poly([[48, 30], [80, 20], [112, 30], [124, 72], [112, 118], [80, 130], [48, 118], [36, 72]], palette.base, 'shape-rendering="crispEdges"'),
    poly([[58, 36], [80, 28], [102, 36], [112, 72], [102, 108], [80, 118], [58, 108], [48, 72]], palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
    rect(56, 48, 48, 12, palette.accent, 'shape-rendering="crispEdges"'),
    rect(72, 58, 16, 46, palette.edge, 'shape-rendering="crispEdges"'),
    rng() > 0.42 ? gem(80, 108, palette, rng) : '',
  ].join('');
};

const renderShieldIcon = (item, palette, rng) => {
  const kind = inferShieldKind(item.name || '', item.subtype || '');
  if (kind === 'book') {
    return [
      rect(42, 28, 76, 98, palette.base, 'rx="6" ry="6" shape-rendering="crispEdges"'),
      rect(50, 36, 28, 82, palette.glow, 'opacity="0.8" rx="4" ry="4" shape-rendering="crispEdges"'),
      rect(82, 36, 28, 82, palette.glow, 'opacity="0.66" rx="4" ry="4" shape-rendering="crispEdges"'),
      rect(76, 28, 8, 98, palette.edge, 'shape-rendering="crispEdges"'),
      gem(102, 50, palette, rng),
    ].join('');
  }
  return [
    poly([[80, 18], [122, 34], [116, 94], [80, 126], [44, 94], [38, 34]], palette.base, 'shape-rendering="crispEdges"'),
    poly([[80, 28], [110, 40], [106, 88], [80, 112], [54, 88], [50, 40]], palette.glow, 'opacity="0.8" shape-rendering="crispEdges"'),
    rect(72, 34, 16, 62, palette.edge, 'shape-rendering="crispEdges"'),
    rect(56, 58, 48, 12, palette.accent, 'shape-rendering="crispEdges"'),
    rng() > 0.35 ? gem(80, 92, palette, rng) : '',
  ].join('');
};

const renderConsumableIcon = (item, palette, rng) => {
  const isScroll = /주문서/.test(item.name || '');
  if (isScroll) {
    return [
      rect(44, 34, 72, 82, '#f1e5b9', 'rx="8" ry="8" shape-rendering="crispEdges"'),
      rect(54, 48, 52, 54, palette.base, 'opacity="0.22" rx="4" ry="4" shape-rendering="crispEdges"'),
      rect(56, 30, 16, 16, palette.accent, 'rx="8" ry="8" shape-rendering="crispEdges"'),
      rect(88, 104, 16, 16, palette.accent, 'rx="8" ry="8" shape-rendering="crispEdges"'),
      gem(80, 72, palette, rng),
    ].join('');
  }

  const neck = item.type === 'buff' ? 18 : 14;
  return [
    rect(64, 24, 32, 18, palette.edge, 'rx="6" ry="6" shape-rendering="crispEdges"'),
    pathEl(`M56 42 L104 42 L114 64 L108 118 L52 118 L46 64 Z`, palette.base, 'shape-rendering="crispEdges"'),
    pathEl(`M64 50 L96 50 L102 68 L98 108 L62 108 L58 68 Z`, palette.glow, 'opacity="0.84" shape-rendering="crispEdges"'),
    rect(72, 18, 16, neck, '#f2e7c7', 'shape-rendering="crispEdges"'),
    rect(58, 72, 44, 10, palette.accent, 'opacity="0.6" shape-rendering="crispEdges"'),
    rng() > 0.45 ? circle(92, 44, 6, palette.accent, 'shape-rendering="crispEdges"') : '',
  ].join('');
};

const renderMaterialIcon = (item, palette, rng) => {
  const kind = inferMaterialKind(item.name || '');
  if (kind === 'ore') {
    return [
      poly([[40, 94], [54, 46], [96, 30], [122, 58], [114, 110], [66, 126]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[52, 92], [62, 54], [94, 42], [112, 62], [106, 100], [72, 112]], palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
      rect(74, 48, 12, 44, palette.accent, 'opacity="0.56" shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'crystal') {
    return [
      poly([[80, 20], [110, 52], [96, 122], [64, 122], [50, 52]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[80, 30], [102, 54], [92, 112], [68, 112], [58, 54]], palette.glow, 'opacity="0.8" shape-rendering="crispEdges"'),
      line(80, 24, 80, 118, palette.edge, 4),
    ].join('');
  }
  if (kind === 'scale') {
    return [
      pathEl('M80 22 C110 28 124 54 122 82 C120 108 102 126 80 136 C58 126 40 108 38 82 C36 54 50 28 80 22 Z', palette.base),
      pathEl('M80 34 C102 40 112 58 110 82 C108 100 96 114 80 122 C64 114 52 100 50 82 C48 58 58 40 80 34 Z', palette.glow, 'opacity="0.78"'),
      rect(72, 42, 16, 10, palette.accent, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'fang') {
    return [
      pathEl('M64 24 C90 24 110 38 112 62 C114 84 104 112 84 136 L68 136 C50 112 42 82 44 62 C46 40 56 24 64 24 Z', palette.base),
      pathEl('M72 30 C90 32 100 46 100 64 C100 84 92 110 78 128 L70 128 C58 108 54 84 56 66 C58 46 64 32 72 30 Z', palette.glow, 'opacity="0.8"'),
    ].join('');
  }
  if (kind === 'bone') {
    return [
      circle(50, 48, 14, palette.base),
      circle(112, 48, 14, palette.base),
      circle(50, 112, 14, palette.base),
      circle(112, 112, 14, palette.base),
      rect(50, 42, 62, 20, palette.base, 'shape-rendering="crispEdges"'),
      rect(50, 98, 62, 20, palette.base, 'shape-rendering="crispEdges"'),
      rect(70, 56, 20, 46, palette.glow, 'opacity="0.75" shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'core') {
    return [
      poly([[80, 22], [116, 40], [122, 82], [98, 126], [62, 126], [38, 82], [44, 40]], palette.base, 'shape-rendering="crispEdges"'),
      poly([[80, 38], [102, 50], [106, 80], [90, 110], [70, 110], [54, 80], [58, 50]], palette.edge, 'shape-rendering="crispEdges"'),
      circle(80, 80, 16, palette.glow, 'shape-rendering="crispEdges"'),
      circle(80, 80, 8, palette.accent, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'relic') {
    return [
      poly([[80, 20], [118, 40], [106, 84], [124, 126], [80, 112], [36, 126], [54, 84], [42, 40]], palette.base, 'shape-rendering="crispEdges"'),
      rect(72, 34, 16, 52, palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
      rect(50, 58, 60, 12, palette.accent, 'shape-rendering="crispEdges"'),
      gem(80, 98, palette, rng),
    ].join('');
  }
  if (kind === 'herb') {
    return [
      line(80, 28, 80, 128, '#6d4a2a', 6),
      pathEl('M80 72 C52 62 38 40 40 22 C62 24 78 40 80 72 Z', palette.base),
      pathEl('M80 90 C108 80 122 58 120 40 C98 42 82 58 80 90 Z', palette.base),
      pathEl('M80 112 C56 110 44 94 46 76 C64 78 76 92 80 112 Z', palette.glow, 'opacity="0.78"'),
    ].join('');
  }
  if (kind === 'pouch') {
    return [
      pathEl('M54 34 C54 26 64 20 80 20 C96 20 106 26 106 34 L106 44 L120 58 L112 118 C108 126 98 132 80 134 C62 132 52 126 48 118 L40 58 L54 44 Z', palette.base),
      rect(56, 44, 48, 14, palette.accent, 'shape-rendering="crispEdges"'),
      rect(62, 62, 36, 34, palette.glow, 'opacity="0.72" shape-rendering="crispEdges"'),
    ].join('');
  }
  if (kind === 'key') {
    return [
      circle(64, 64, 22, palette.base),
      circle(64, 64, 10, 'transparent', `stroke="${palette.glow}" stroke-width="8"`),
      rect(82, 58, 42, 12, palette.base, 'shape-rendering="crispEdges"'),
      rect(108, 70, 10, 16, palette.base, 'shape-rendering="crispEdges"'),
      rect(96, 70, 10, 10, palette.accent, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  return [
    poly([[80, 28], [104, 44], [110, 72], [96, 110], [64, 118], [48, 94], [44, 62], [58, 40]], palette.base, 'shape-rendering="crispEdges"'),
    poly([[80, 38], [96, 50], [100, 72], [90, 100], [68, 106], [56, 88], [54, 64], [64, 48]], palette.glow, 'opacity="0.78" shape-rendering="crispEdges"'),
    gem(84, 54, palette, rng),
  ].join('');
};

const renderRelicAffixIcon = (item, palette, rng) => {
  const name = item.name || '';
  if (/불타는|화염/.test(name)) {
    return [
      pathEl('M80 18 C96 40 112 52 112 74 C112 100 96 124 80 138 C64 124 48 100 48 74 C48 52 64 40 80 18 Z', palette.base),
      pathEl('M80 38 C90 54 98 62 98 78 C98 92 90 108 80 120 C70 108 62 92 62 78 C62 62 70 54 80 38 Z', palette.glow, 'opacity="0.8"'),
    ].join('');
  }
  if (/얼어붙은|빙결/.test(name)) {
    return [
      line(80, 22, 80, 138, palette.base, 8),
      line(32, 80, 128, 80, palette.base, 8),
      line(46, 46, 114, 114, palette.accent, 6),
      line(46, 114, 114, 46, palette.accent, 6),
      circle(80, 80, 14, palette.glow, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (/맹독/.test(name)) {
    return [
      pathEl('M80 20 C106 26 124 46 122 78 C120 106 102 126 80 140 C58 126 40 106 38 78 C36 46 54 26 80 20 Z', palette.base),
      pathEl('M62 66 C70 52 90 48 102 60 C92 60 84 66 80 80 C74 72 68 68 62 66 Z', palette.glow, 'opacity="0.8"'),
      circle(72, 96, 8, palette.accent, 'shape-rendering="crispEdges"'),
      circle(92, 104, 6, palette.accent, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  if (/신성한|축복/.test(name)) {
    return [
      circle(80, 44, 18, palette.accent, 'shape-rendering="crispEdges"'),
      pathEl('M80 26 C92 46 106 60 106 84 C106 104 94 122 80 136 C66 122 54 104 54 84 C54 60 68 46 80 26 Z', palette.base),
      pathEl('M80 46 C88 60 94 70 94 84 C94 96 88 110 80 120 C72 110 66 96 66 84 C66 70 72 60 80 46 Z', palette.glow, 'opacity="0.82"'),
    ].join('');
  }
  if (/저주받은/.test(name)) {
    return [
      poly([[80, 22], [118, 40], [106, 84], [124, 126], [80, 138], [36, 126], [54, 84], [42, 40]], palette.base, 'shape-rendering="crispEdges"'),
      rect(76, 30, 8, 82, palette.glow, 'opacity="0.82" shape-rendering="crispEdges"'),
      rect(48, 66, 64, 10, palette.accent, 'shape-rendering="crispEdges"'),
    ].join('');
  }
  return renderMaterialIcon({ ...item, type: 'all', name: '고대 문장' }, palette, rng);
};

const renderItemIcon = (item, palette, rng) => {
  const category = inferCategory(item);
  if (category === 'weapon') return renderWeaponIcon(item, palette, rng);
  if (category === 'armor') return renderArmorIcon(item, palette, rng);
  if (category === 'shield') return renderShieldIcon(item, palette, rng);
  if (category === 'consumable') return renderConsumableIcon(item, palette, rng);
  if (category === 'material' || category === 'key') return renderMaterialIcon(item, palette, rng);
  if (category === 'relic') return renderRelicAffixIcon(item, palette, rng);
  return renderMaterialIcon(item, palette, rng);
};

const renderFrameSparkles = (palette, rng) => {
  const sparkleCount = 2 + Math.floor(rng() * 3);
  return Array.from({ length: sparkleCount }, (_, index) => {
    const x = 22 + Math.floor(rng() * 116);
    const y = 22 + Math.floor(rng() * 116);
    const size = 4 + (index % 2) * 2;
    return [
      rect(x, y + size, size, size * 2, palette.glow, 'opacity="0.25" shape-rendering="crispEdges"'),
      rect(x - size / 2, y + size * 1.5, size * 2, size, palette.glow, 'opacity="0.25" shape-rendering="crispEdges"'),
    ].join('');
  }).join('');
};

const buildSvg = (item, key) => {
  const seed = hashString(`${item.name}-${key}-${item.type}-${item.tier || 1}`);
  const rng = seeded(seed);
  const palette = getPalette(item);
  const art = renderItemIcon(item, palette, rng);
  const aura = renderFrameSparkles(palette, rng);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" fill="none">
  <g shape-rendering="crispEdges">
    ${aura}
    ${art}
  </g>
</svg>
`;
};

const buildContactSheet = (entries) => {
  const columns = 8;
  const tile = CANVAS;
  const gap = 12;
  const rows = Math.ceil(entries.length / columns);
  const width = columns * tile + gap * (columns + 1);
  const height = rows * tile + gap * (rows + 1);
  const images = entries.map(({ key }, index) => {
    const x = gap + (index % columns) * (tile + gap);
    const y = gap + Math.floor(index / columns) * (tile + gap);
    return `<image href="../../public/assets/items/${key}.svg" x="${x}" y="${y}" width="${tile}" height="${tile}" />`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <rect width="${width}" height="${height}" fill="#0b1118"/>
  ${images}
</svg>
`;
};

const uniqueItems = [];
const seenNames = new Set();
for (const item of Object.values(ITEMS).flat().filter(Boolean)) {
  if (!item?.name) continue;
  if (seenNames.has(item.name)) continue;
  if (!EXACT_ITEM_ICON_KEYS[item.name]) continue;
  seenNames.add(item.name);
  uniqueItems.push(item);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(artifactDir, { recursive: true });

const generated = [];
for (const item of uniqueItems) {
  const key = EXACT_ITEM_ICON_KEYS[item.name];
  const svg = buildSvg(item, key);
  const outputPath = path.join(outputDir, `${key}.svg`);
  await fs.writeFile(outputPath, svg, 'utf8');
  generated.push({ key, name: item.name, outputPath });
}

await fs.writeFile(path.join(artifactDir, 'contact-sheet.svg'), buildContactSheet(generated), 'utf8');
await fs.writeFile(path.join(artifactDir, 'manifest.json'), JSON.stringify(generated, null, 2), 'utf8');

console.log(`generated ${generated.length} exact item SVGs`);
console.log(`contact_sheet=${path.join(artifactDir, 'contact-sheet.svg')}`);
