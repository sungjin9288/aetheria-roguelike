export const MAPS = {
    // 초반 지역 (Lv 1-10)
    '시작의 마을': { level: 1, type: 'safe', exits: ['고요한 숲', '서쪽 평원'], monsters: [], desc: '평화로운 시작의 마을입니다.', eventChance: 0 },
    '고요한 숲': { level: 1, type: 'dungeon', exits: ['시작의 마을', '잊혀진 폐허', '호수의 신전'], monsters: ['슬라임', '늑대', '숲의 정령', '거미떼'], desc: '새들의 지저귐 속에 긴장감이 감도는 숲입니다.', eventChance: 0.3 },
    '서쪽 평원': { level: 3, type: 'dungeon', exits: ['시작의 마을', '화염의 협곡', '사막 오아시스'], monsters: ['멧돼지', '들개', '코볼트', '초록슬라임'], desc: '넓은 초원이 펼쳐진 평화로운 지역입니다.', eventChance: 0.25 },
    '호수의 신전': { level: 5, type: 'dungeon', exits: ['고요한 숲'], monsters: ['물의 정령', '머맨', '거대 거북'], desc: '고대 수호신이 잠든 호수의 신전입니다.', eventChance: 0.35 },

    // 중반 지역 (Lv 5-20)
    '잊혀진 폐허': { level: 5, type: 'dungeon', exits: ['고요한 숲', '어둠의 동굴', '버려진 광산'], monsters: ['해골 병사', '고블린', '석상 가디언', '유령 기사'], desc: '오래된 문명의 흔적이 남아있는 폐허입니다.', eventChance: 0.3 },
    '버려진 광산': { level: 8, type: 'dungeon', exits: ['잊혀진 폐허'], monsters: ['광석골렘', '코볼트 광부', '광산 박쥐', '거대 지렁이'], desc: '금맥을 찾아 파헤쳐진 버려진 광산입니다.', eventChance: 0.35 },
    '어둠의 동굴': { level: 10, type: 'dungeon', exits: ['잊혀진 폐허', '암흑 성'], monsters: ['동굴 트롤', '박쥐 떼', '다크 엘프', '거대 지네', '암흑 마법사'], desc: '빛이 들지 않는 깊고 어두운 동굴입니다.', eventChance: 0.4 },

    // 화염 지역 (Lv 15-30)
    '화염의 협곡': { level: 15, type: 'dungeon', exits: ['서쪽 평원', '용의 둥지'], monsters: ['화염 정령', '용암 골렘', '파이어뱃', '화염 도마뱀'], desc: '뜨거운 용암이 흐르는 위험한 협곡입니다.', eventChance: 0.4 },
    '용의 둥지': { level: 25, type: 'dungeon', exits: ['화염의 협곡'], monsters: ['화염의 군주', '레드 드래곤', '화염 와이번', '드래곤 나이트'], desc: '용들이 거주하는 전설의 장소입니다.', eventChance: 0.5, boss: true },

    // 사막 지역 (Lv 15-25)
    '사막 오아시스': { level: 15, type: 'safe', exits: ['서쪽 평원', '피라미드'], monsters: [], desc: '사막 한가운데 있는 오아시스 마을입니다.', eventChance: 0 },
    '피라미드': { level: 20, type: 'dungeon', exits: ['사막 오아시스'], monsters: ['미라', '사막도적', '스핑크스', '아누비스 수호자'], desc: '고대 왕이 잠든 거대한 피라미드입니다.', eventChance: 0.45, boss: true },

    // 얼음 지역 (Lv 20-35)
    '얼음 성채': { level: 20, type: 'dungeon', exits: ['잊혀진 폐허', '빙하 심연', '북부 요새'], monsters: ['프로스트 위치', '얼음 거인', '스노우 울프', '아이스 골렘'], desc: '영원히 얼어붙은 고대 성채입니다.', eventChance: 0.4 },
    '빙하 심연': { level: 30, type: 'dungeon', exits: ['얼음 성채'], monsters: ['아이스 드래곤', '빙결의 마녀', '서리 정령'], desc: '깊은 빙하 속에 숨겨진 심연입니다.', eventChance: 0.5, boss: true },
    '북부 요새': { level: 30, type: 'safe', exits: ['얼음 성채'], monsters: [], desc: '북쪽 끝 설원에 위치한 전방 요새입니다. (Tier 3 상점)', eventChance: 0 },

    // 최종 지역 (Lv 30-50)
    '암흑 성': { level: 30, type: 'dungeon', exits: ['어둠의 동굴', '마왕성'], monsters: ['데스나이트', '리치', '뱀파이어', '암흑 사제'], desc: '어둠의 세력이 지배하는 성입니다.', eventChance: 0.45 },
    '마왕성': { level: 40, type: 'dungeon', exits: ['암흑 성'], monsters: ['마왕의 사도', '지옥의 문지기', '타락한 천사', '마왕'], desc: '마왕이 군림하는 최종 목적지입니다.', eventChance: 0.5, boss: true }
};
