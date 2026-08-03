export interface LocationVisual {
    key: string;
    src: string;
}

const LOCATION_VISUAL_KEYS: Record<string, string> = Object.freeze({
    '시작의 마을': 'start-village',
    '고요한 숲': 'quiet-forest',
    '서쪽 평원': 'western-plains',
    '호수의 신전': 'lake-temple',
    '신성한 호수': 'sacred-lake',
    '잊혀진 폐허': 'forgotten-ruins',
    '버려진 광산': 'abandoned-mine',
    '수정 동굴': 'crystal-cave',
    '고대 하수도': 'ancient-sewer',
    '바람의 고원': 'wind-highland',
    '몰락한 전초기지': 'fallen-outpost',
    '여행자의 쉼터': 'traveler-rest',
    '어둠의 동굴': 'dark-cave',
    '화염의 협곡': 'flame-canyon',
    '화염의 사원': 'fire-temple',
    '용의 둥지': 'dragon-nest',
    '사막 오아시스': 'desert-oasis',
    '피라미드': 'pyramid',
    '얼음 성채': 'ice-citadel',
    '북부 설원': 'northern-snowfield',
    '빙하 심연': 'glacial-abyss',
    '북부 요새': 'northern-fortress',
    '고대 마법 탑': 'ancient-magic-tower',
    '기계 폐도': 'machine-ruins',
    '천공 정원': 'sky-garden',
    '허공의 섬': 'void-island',
    '심해 회랑': 'deep-sea-corridor',
    '붕괴된 마법 요새': 'collapsed-magic-fortress',
    '에테르 관문': 'aether-gate',
    '차원의 틈새': 'dimensional-rift',
    '암흑 성': 'dark-castle',
    '어둠의 지하 감옥': 'dark-dungeon',
    '마왕성': 'demon-king-castle',
    '혼돈의 심연': 'chaos-abyss',
    '황금 왕국': 'golden-kingdom',
    '지하 미궁': 'underground-labyrinth',
    '공중 신전': 'sky-temple',
    '영혼의 강': 'river-of-souls',
    '금지된 도서관': 'forbidden-library',
    '세계수 숲': 'world-tree-forest',
    '고대 신전 도시': 'ancient-temple-city',
    '차원의 균열 전초기지': 'rift-outpost',
    '폐기된 연구소': 'abandoned-laboratory',
    '저주받은 묘지': 'cursed-graveyard',
    '용암 지대': 'lava-zone',
    '폭풍의 고원': 'storm-highland',
    '에테르 폐허': 'aether-ruins',
    '공허의 회랑': 'void-corridor',
    '종말의 전장': 'apocalypse-battlefield',
    '고대 보물고': 'ancient-vault',
    '봄의 정원': 'spring-garden',
    '서리 폭풍 유적': 'frost-storm-ruins',
});

export const getLocationVisual = (name: string): LocationVisual | null => {
    const key = LOCATION_VISUAL_KEYS[name];
    return key ? { key, src: `/assets/locations/${key}.png` } : null;
};
