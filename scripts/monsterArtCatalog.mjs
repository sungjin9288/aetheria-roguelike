import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { MAPS } from '../src/data/maps.ts';
import { MONSTERS } from '../src/data/monsters.ts';
import { getLocationVisual } from '../src/utils/locationVisuals.ts';
import { compareCodePoints } from './artCatalog.mjs';

const LEGACY_REGION_KEYS = Object.freeze({
    '고요한 숲': 'forest',
    '서쪽 평원': 'plains',
    '잊혀진 폐허': 'ruins',
    '화염의 협곡': 'fire',
});

const LEGACY_MONSTER_KEYS = Object.freeze({
    슬라임: 'slime',
    늑대: 'wolf',
    '숲의 정령': 'forest-spirit',
    거미떼: 'spider-swarm',
    독버섯: 'poison-mushroom',
    '거대 사슴벌레': 'stag-beetle',
    '숲 요정': 'forest-fairy',
    멧돼지: 'boar',
    들개: 'wild-dog',
    코볼트: 'kobold',
    초록슬라임: 'green-slime',
    '평원 도적': 'plains-bandit',
    '해골 병사': 'skeleton-soldier',
    고블린: 'goblin',
    '석상 가디언': 'stone-guardian',
    '유령 기사': 'ghost-knight',
    '폐허 구울': 'ruins-ghoul',
    '화염 정령': 'fire-spirit',
    '용암 골렘': 'lava-golem',
    파이어뱃: 'fire-bat',
    '화염 도마뱀': 'fire-lizard',
    '화염의 군주': 'fire-lord',
    '레드 드래곤': 'red-dragon',
});

const includesAny = (name, words) => words.some((word) => name.includes(word));

const REVIEWED_ARCHETYPES = Object.freeze({
    '스노우 울프': 'beast',
    '살아있는 마법서': 'construct',
    '미믹': 'construct',
    '프로토타입 제로': 'machine',
    '마력 결정체': 'construct',
    '묘지기 네크론': 'caster',
    '설원 거인': 'warrior',
    '용암 거인': 'warrior',
    '생체 병기': 'beast',
    '증기 골렘': 'machine',
});

export const classifyMonsterArchetype = (name) => {
    if (Object.hasOwn(REVIEWED_ARCHETYPES, name)) return REVIEWED_ARCHETYPES[name];
    if (includesAny(name, ['버섯'])) return 'fungus';
    if (includesAny(name, ['슬라임', '점액', '젤리'])) return 'slime';
    if (includesAny(name, ['크라켄', '리바이어던', '나가', '머맨', '물고기', '해류'])) return 'aquatic';
    if (includesAny(name, ['천둥새', '그리핀', '수호조', '하피', '세이렌', '박쥐', '파이어뱃', '폭풍 매'])) return 'avian';
    if (includesAny(name, ['악어', '도마뱀', '거북'])) return 'reptile';
    if (includesAny(name, ['드래곤', '와이번', '비룡', '드레이크'])) return 'dragon';
    if (includesAny(name, ['기계', '로봇', '포격기', '병기', '폐회로', '자동인형'])) return 'machine';
    if (includesAny(name, ['골렘', '석상', '수호신상', '거인'])) return 'construct';
    if (includesAny(name, ['유령', '망령', '영혼', '망자', '사령'])) return 'spectral';
    if (includesAny(name, ['해골', '리치', '구울', '미라', '데스나이트', '뱀파이어', '사체', '언데드'])) return 'undead';
    if (includesAny(name, ['거미', '지네', '벌레', '지렁이', '사슴벌레', '나방', '전갈'])) return 'insect';
    if (includesAny(name, ['정령', '파편체', '수정체', '님프', '요정', '영혼', '원소', '마법 구체'])) return 'spirit';
    if (includesAny(name, ['공허', '허무', '혼돈', '엔트로피', '차원', '에테르', '심연의 눈', '무한의 화신', '영겁의 수문장'])) return 'aberration';
    if (includesAny(name, ['수호신', '원시의 신', '봄의 여왕', '아누비스', '스핑크스', '신성한 제관'])) return 'divine';
    if (includesAny(name, ['마왕', '지옥', '타락한 천사', '멸절의 사도'])) return 'demon';
    if (includesAny(name, ['마법사', '마녀', '사제', '마구스', '기도사', '위치', '마도병'])) return 'caster';
    if (includesAny(name, ['기사', '병사', '보병', '사령관', '장군', '용사', '전사', '수호자', '파수꾼', '집행관', '고문관'])) return 'warrior';
    if (includesAny(name, ['도적', '사냥꾼', '추적자', '포격수', '보물사냥꾼', '어부', '상인', '사기꾼'])) return 'rogue';
    if (includesAny(name, ['늑대', '멧돼지', '들개', '사자', '짐승', '설인', '트롤', '포식자'])) return 'beast';
    return 'humanoid';
};

const buildRegionIndex = () => {
    const regionsByMonster = new Map();
    for (const [regionName, region] of Object.entries(MAPS)) {
        const names = [
            ...(region.monsters || []),
            ...(region.bossMonsters || []),
            ...(typeof region.boss === 'string' ? [region.boss] : []),
        ];
        for (const name of names) {
            const regions = regionsByMonster.get(name) || [];
            regions.push(regionName);
            regionsByMonster.set(name, regions);
        }
    }
    return regionsByMonster;
};

const stableMonsterKey = (name) => (
    LEGACY_MONSTER_KEYS[name]
    || `monster-${createHash('sha256').update(name).digest('hex').slice(0, 12)}`
);

export const buildMonsterArtCatalog = async ({ corrections } = {}) => {
    const regionsByMonster = buildRegionIndex();
    const monsters = Object.entries(MONSTERS).map(([name, monster]) => {
        const regions = [...new Set(regionsByMonster.get(name) || [])];
        if (regions.length === 0) throw new Error(`Monster is unreachable from the map catalog: ${name}`);
        const primaryRegion = regions[0];
        const regionKey = LEGACY_REGION_KEYS[primaryRegion]
            || getLocationVisual(primaryRegion)?.key;
        if (!regionKey) throw new Error(`Monster region is missing visual identity: ${name}/${primaryRegion}`);
        return {
            name,
            key: stableMonsterKey(name),
            archetype: classifyMonsterArchetype(name),
            isBoss: Boolean(monster.isBoss),
            primaryRegion,
            regionKey,
            weakness: monster.weakness || '',
            resistance: monster.resistance || '',
            statusOnHit: monster.statusOnHit || '',
        };
    }).sort((left, right) => compareCodePoints(left.name, right.name));

    if (new Set(monsters.map(({ name }) => name)).size !== monsters.length) {
        throw new Error('Monster art catalog contains duplicate names');
    }
    if (new Set(monsters.map(({ key }) => key)).size !== monsters.length) {
        throw new Error('Monster art catalog contains duplicate keys');
    }

    const catalogSha256 = createHash('sha256').update(JSON.stringify(monsters)).digest('hex');
    const source = corrections ?? JSON.parse(await readFile(
        new URL('./art_sources/monsters/v1/corrections.json', import.meta.url), 'utf8',
    ));
    if (source.version !== 1 || !source.entries || Array.isArray(source.entries)) {
        throw new Error('Invalid monster art corrections');
    }
    for (const [name, correction] of Object.entries(source.entries)) {
        const monster = monsters.find((entry) => entry.name === name);
        if (!monster || correction?.sourceRuntimePath !== `/assets/monsters/authored/v1/${monster.key}.png`) {
            throw new Error(`Invalid monster art correction identity: ${name}`);
        }
        const bytes = await readFile(new URL(`../public${correction.sourceRuntimePath}`, import.meta.url));
        if (createHash('sha256').update(bytes).digest('hex') !== correction.sha256) {
            throw new Error(`Monster art correction hash drift: ${name}`);
        }
    }
    return { version: 1, catalogSha256, monsters, corrections: source.entries };
};

const isCli = process.argv[1]
    && fileURLToPath(import.meta.url) === new URL(process.argv[1], 'file:').pathname;

if (isCli) {
    if (!process.argv.includes('--stdout')) throw new Error('Usage: monsterArtCatalog.mjs --stdout');
    process.stdout.write(`${JSON.stringify(await buildMonsterArtCatalog(), null, 2)}\n`);
}
