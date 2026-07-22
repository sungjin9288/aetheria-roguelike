export type RegionVisualKey = 'forest' | 'plains' | 'ruins' | 'fire';

export interface MonsterVisual {
    key: string;
    regionKey: RegionVisualKey;
    src: string;
}

export interface RegionVisual {
    key: RegionVisualKey;
    src: string;
}

const monster = (regionKey: RegionVisualKey, key: string): MonsterVisual => ({
    key,
    regionKey,
    src: `/assets/monsters/${regionKey}/${key}.png`,
});

const MONSTER_VISUALS: Record<string, MonsterVisual> = {
    슬라임: monster('forest', 'slime'),
    늑대: monster('forest', 'wolf'),
    '숲의 정령': monster('forest', 'forest-spirit'),
    거미떼: monster('forest', 'spider-swarm'),
    독버섯: monster('forest', 'poison-mushroom'),
    '거대 사슴벌레': monster('forest', 'stag-beetle'),
    '숲 요정': monster('forest', 'forest-fairy'),
    멧돼지: monster('plains', 'boar'),
    들개: monster('plains', 'wild-dog'),
    코볼트: monster('plains', 'kobold'),
    초록슬라임: monster('plains', 'green-slime'),
    '평원 도적': monster('plains', 'plains-bandit'),
    '해골 병사': monster('ruins', 'skeleton-soldier'),
    고블린: monster('ruins', 'goblin'),
    '석상 가디언': monster('ruins', 'stone-guardian'),
    '유령 기사': monster('ruins', 'ghost-knight'),
    '폐허 구울': monster('ruins', 'ruins-ghoul'),
    '화염 정령': monster('fire', 'fire-spirit'),
    '용암 골렘': monster('fire', 'lava-golem'),
    파이어뱃: monster('fire', 'fire-bat'),
    '화염 도마뱀': monster('fire', 'fire-lizard'),
    '화염의 군주': monster('fire', 'fire-lord'),
    '레드 드래곤': monster('fire', 'red-dragon'),
};

const MONSTER_ALIASES = Object.keys(MONSTER_VISUALS).sort((left, right) => right.length - left.length);

const REGION_FAMILIES: Record<string, RegionVisualKey> = {
    '고요한 숲': 'forest',
    '서쪽 평원': 'plains',
    '바람의 고원': 'plains',
    '여행자의 쉼터': 'plains',
    '잊혀진 폐허': 'ruins',
    '버려진 광산': 'ruins',
    '고대 하수도': 'ruins',
    '고대 마법 탑': 'ruins',
    '몰락한 전초기지': 'ruins',
    '화염의 협곡': 'fire',
    '화염의 사원': 'fire',
    '용의 둥지': 'fire',
    '용암 지대': 'fire',
};

export const getMonsterVisual = (name: string): MonsterVisual | null => {
    const exact = MONSTER_VISUALS[name];
    if (exact) return exact;

    const alias = MONSTER_ALIASES.find((candidate) => name.includes(candidate));
    return alias ? MONSTER_VISUALS[alias] : null;
};

export const getRegionVisual = (name: string): RegionVisual | null => {
    const key = REGION_FAMILIES[name];
    return key ? { key, src: `/assets/regions/${key}.png` } : null;
};
