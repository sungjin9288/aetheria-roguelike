export const MONSTERS = {
    슬라임: { weakness: '화염', resistance: '대지', hpMult: 0.8, pattern: { guardChance: 0.05, heavyChance: 0.1 }, statusOnHit: 'poison' },
    늑대: { weakness: '화염', resistance: '자연', atkMult: 1.1, pattern: { guardChance: 0.05, heavyChance: 0.35 } },
    '숲의 정령': { weakness: '화염', resistance: '자연' },
    거미떼: { weakness: '화염', resistance: '자연', hpMult: 0.85, atkMult: 1.05, pattern: { guardChance: 0.0, heavyChance: 0.25 }, statusOnHit: 'poison' },
    멧돼지: { weakness: '냉기', resistance: '자연', hpMult: 1.15, pattern: { guardChance: 0.25, heavyChance: 0.2 } },
    코볼트: { weakness: '빛', resistance: '대지', atkMult: 0.95, pattern: { guardChance: 0.1, heavyChance: 0.15 } },
    '물의 정령': { weakness: '대지', resistance: '냉기' },
    머맨: { weakness: '자연', resistance: '냉기' },
    '해골 병사': { weakness: '빛', resistance: '어둠' },
    고블린: { weakness: '화염', resistance: '자연', atkMult: 0.9, pattern: { guardChance: 0.0, heavyChance: 0.2 } },
    '유령 기사': { weakness: '빛', resistance: '어둠', hpMult: 1.12 },
    광석골렘: { weakness: '대지', resistance: '화염', hpMult: 1.2, atkMult: 0.9, pattern: { guardChance: 0.3, heavyChance: 0.15 } },
    '동굴 트롤': { weakness: '화염', resistance: '대지', hpMult: 1.18, atkMult: 1.1 },
    '암흑 마법사': { weakness: '빛', resistance: '어둠', atkMult: 1.08 },
    '화염 정령': { weakness: '냉기', resistance: '화염' },
    '화염의 군주': {
        isBoss: true,
        weakness: '냉기',
        resistance: '화염',
        hpMult: 1.35,
        atkMult: 1.2,
        expMult: 1.35,
        goldMult: 1.35,
        phase2: { name: '분노한 화염의 군주', atkBonus: 0.35, pattern: { guardChance: 0.0, heavyChance: 0.55 }, log: '화염의 군주가 핵심 불꽃을 해방했습니다! 모든 것이 불타오릅니다!', statusEffect: 'burn' },
    },
    '레드 드래곤': {
        isBoss: true,
        weakness: '냉기',
        resistance: '화염',
        hpMult: 1.5,
        atkMult: 1.25,
        expMult: 1.45,
        goldMult: 1.4,
        phase2: { name: '격노한 레드 드래곤', atkBonus: 0.4, pattern: { guardChance: 0.0, heavyChance: 0.6 }, log: '레드 드래곤이 진정한 화염의 분노를 해방했습니다! 대기가 불꽃으로 가득 찹니다!', statusEffect: 'burn' },
    },
    스핑크스: {
        isBoss: true,
        weakness: '어둠',
        resistance: '빛',
        hpMult: 1.32,
        atkMult: 1.2,
        expMult: 1.32,
        goldMult: 1.3,
        phase2: { name: '각성한 스핑크스', atkBonus: 0.35, pattern: { guardChance: 0.15, heavyChance: 0.45 }, log: '스핑크스가 태고의 수수께끼를 풀어냈습니다! 공간이 뒤틀립니다!', statusEffect: 'poison' },
    },
    '아누비스 수호자': {
        isBoss: true,
        weakness: '빛',
        resistance: '어둠',
        hpMult: 1.34,
        atkMult: 1.2,
        expMult: 1.34,
        goldMult: 1.34,
        phase2: { name: '심판하는 아누비스', atkBonus: 0.38, pattern: { guardChance: 0.1, heavyChance: 0.5 }, log: '아누비스가 저승의 심판을 내립니다! 영혼의 울부짖음이 들립니다!', statusEffect: 'poison' },
    },
    '아이스 드래곤': {
        isBoss: true,
        weakness: '화염',
        resistance: '냉기',
        hpMult: 1.45,
        atkMult: 1.22,
        expMult: 1.45,
        goldMult: 1.4,
        phase2: { name: '빙하기의 아이스 드래곤', atkBonus: 0.38, pattern: { guardChance: 0.05, heavyChance: 0.55 }, log: '아이스 드래곤이 절대 영도의 냉기를 해방했습니다! 모든 것이 얼어붙습니다!' },
    },
    '빙결의 마녀': {
        isBoss: true,
        weakness: '화염',
        resistance: '냉기',
        hpMult: 1.3,
        atkMult: 1.2,
        expMult: 1.3,
        goldMult: 1.3,
        phase2: { name: '저주받은 빙결의 마녀', atkBonus: 0.42, pattern: { guardChance: 0.1, heavyChance: 0.5 }, log: '빙결의 마녀가 저주의 힘을 해방했습니다! 마법 에너지가 폭주합니다!', statusEffect: 'poison' },
    },
    데스나이트: { weakness: '빛', resistance: '어둠', hpMult: 1.12, atkMult: 1.08 },
    리치: { weakness: '빛', resistance: '어둠', hpMult: 1.2, atkMult: 1.12 },
    마왕: {
        isBoss: true,
        weakness: '빛',
        resistance: '어둠',
        hpMult: 1.6,
        atkMult: 1.3,
        expMult: 1.8,
        goldMult: 1.8,
        dropMod: 2.2,
        phase2: { name: '분노한 마왕', atkBonus: 0.3, pattern: { guardChance: 0.0, heavyChance: 0.5 }, log: '마왕이 절망의 심연을 해방했습니다! 세계가 어둠에 잠깁니다...', statusEffect: 'burn' },
        phase3: { name: '종말의 마왕', threshold: 0.2, atkBonus: 0.6, defBonus: 10, pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '마왕이 최후의 힘을 끌어냅니다! 현실이 붕괴하기 시작합니다!', statusEffect: 'curse' },
    },
    '심연의 수호자': { weakness: '빛', resistance: '어둠', hpMult: 1.25, atkMult: 1.15 },
    '공허의 짐승': { weakness: '빛', resistance: '어둠', hpMult: 1.2, atkMult: 1.1 },
    '황금 골렘': { weakness: '대지', resistance: '빛', hpMult: 1.25, goldMult: 1.5 },
    미믹: { weakness: '화염', resistance: '대지', hpMult: 1.1, dropMod: 1.5 },

    // 확장 지역 몬스터
    '강철 자동인형': { weakness: '대지', resistance: '냉기', hpMult: 1.12 },
    '전류 추적자': { weakness: '대지', resistance: '빛', atkMult: 1.14 },
    '증기 골렘': { weakness: '냉기', resistance: '화염', hpMult: 1.18 },
    '폐회로 마도병': { weakness: '빛', resistance: '어둠', atkMult: 1.1 },
    '천공 수호조': { weakness: '냉기', resistance: '빛', atkMult: 1.12 },
    '빛결 수정체': { weakness: '어둠', resistance: '빛', hpMult: 1.15 },
    '폭풍 세이렌': { weakness: '대지', resistance: '냉기', atkMult: 1.14 },
    '성운 감시자': { weakness: '어둠', resistance: '빛', hpMult: 1.2, atkMult: 1.1 },
    '심해 기도사': { weakness: '빛', resistance: '어둠', atkMult: 1.16 },
    '심연 크라켄': { weakness: '빛', resistance: '냉기', hpMult: 1.35, atkMult: 1.18 },
    '해류 파수꾼': { weakness: '대지', resistance: '냉기', hpMult: 1.2 },
    '망각의 나가': { weakness: '빛', resistance: '어둠', atkMult: 1.14 },
    '차원 파쇄자': {
        isBoss: true,
        weakness: '빛',
        resistance: '어둠',
        hpMult: 1.5,
        atkMult: 1.28,
        expMult: 1.6,
        goldMult: 1.55,
        dropMod: 2.0,
        phase2: { name: '완전 개방된 차원 파쇄자', atkBonus: 0.5, pattern: { guardChance: 0.3, heavyChance: 0.3 }, log: '차원의 균열이 극대화됩니다! 현실과 허상의 경계가 무너집니다!' },
    },
    '영겁의 수문장': {
        isBoss: true,
        weakness: '자연',
        resistance: '빛',
        hpMult: 1.45,
        atkMult: 1.25,
        expMult: 1.55,
        goldMult: 1.5,
        dropMod: 1.9,
        phase2: { name: '해방된 영겁의 수문장', atkBonus: 0.45, pattern: { guardChance: 0.1, heavyChance: 0.5 }, log: '영겁의 수문장이 시간의 족쇄를 끊었습니다! 모든 시간이 멈춥니다!', statusEffect: 'poison' },
    },
    '에테르 드래곤': {
        isBoss: true,
        weakness: '어둠',
        resistance: '빛',
        hpMult: 1.62,
        atkMult: 1.35,
        expMult: 1.75,
        goldMult: 1.7,
        dropMod: 2.3,
        phase2: { name: '해방된 에테르 드래곤', atkBonus: 0.45, pattern: { guardChance: 0.1, heavyChance: 0.5 }, log: '에테르의 흐름이 역전됩니다! 용이 에테르의 근원에 닿았습니다!', statusEffect: 'poison' },
    },

    // 기계 폐도 추가 몬스터
    '과부하 포격기': { weakness: '대지', resistance: '냉기', atkMult: 1.2, pattern: { guardChance: 0.0, heavyChance: 0.45 } },

    // 심해 회랑 추가 몬스터
    '어비스 리바이어던': { weakness: '빛', resistance: '냉기', hpMult: 1.4, atkMult: 1.16, pattern: { guardChance: 0.1, heavyChance: 0.4 } },

    // 에테르 관문 비보스 몬스터 (지역 탐험 중 등장)
    '에테르 파편체': { weakness: '어둠', resistance: '빛', hpMult: 1.25, atkMult: 1.22, pattern: { guardChance: 0.0, heavyChance: 0.35 } },
    '공허 집행관': { weakness: '빛', resistance: '어둠', hpMult: 1.3, atkMult: 1.28, pattern: { guardChance: 0.15, heavyChance: 0.4 } },

    // 혼돈의 심연 추가 몬스터
    '혼돈의 화신': { weakness: '빛', resistance: '어둠', hpMult: 1.45, atkMult: 1.3, pattern: { guardChance: 0.05, heavyChance: 0.5 } },

    // ══════ Phase 4A 확장 몬스터 ══════

    // 고요한 숲 +3
    '독버섯': { weakness: '화염', resistance: '자연' },
    '거대 사슴벌레': { weakness: '냉기', resistance: '자연', hpMult: 1.08 },
    '숲 요정': { weakness: '어둠', resistance: '자연' },

    // 서쪽 평원 +3
    '들개': { weakness: '냉기', resistance: '자연' },
    '초록슬라임': { weakness: '화염', resistance: '자연' },
    '평원 도적': { weakness: '빛', resistance: '어둠' },

    // 호수의 신전 +2
    '거대 거북': { weakness: '빛', resistance: '냉기', hpMult: 1.15 },
    '수련 님프': { weakness: '어둠', resistance: '자연' },

    // 잊혀진 폐허 +2
    '석상 가디언': { weakness: '대지', resistance: '빛', hpMult: 1.1 },
    '폐허 구울': { weakness: '빛', resistance: '어둠', atkMult: 1.06 },

    // 버려진 광산 +3
    '코볼트 광부': { weakness: '빛', resistance: '대지' },
    '광산 박쥐': { weakness: '빛', resistance: '어둠' },
    '거대 지렁이': { weakness: '화염', resistance: '대지', hpMult: 1.05 },

    // 어둠의 동굴 +2
    '박쥐 떼': { weakness: '빛', resistance: '어둠' },
    '거대 지네': { weakness: '냉기', resistance: '자연', atkMult: 1.05 },

    // 화염의 협곡 +3
    '용암 골렘': { weakness: '냉기', resistance: '화염', hpMult: 1.15 },
    '파이어뱃': { weakness: '냉기', resistance: '화염' },
    '화염 도마뱀': { weakness: '냉기', resistance: '화염' },

    // 용의 둥지 +2
    '화염 와이번': { weakness: '냉기', resistance: '화염', hpMult: 1.1, atkMult: 1.08 },
    '드래곤 나이트': { weakness: '냉기', resistance: '화염', hpMult: 1.2, atkMult: 1.12 },

    // 피라미드 +2
    '미라': { weakness: '화염', resistance: '어둠', hpMult: 1.08 },
    '사막도적': { weakness: '빛', resistance: '대지', atkMult: 1.06 },

    // 얼음 성채 +3
    '프로스트 위치': { weakness: '화염', resistance: '냉기', atkMult: 1.1 },
    '스노우 울프': { weakness: '화염', resistance: '냉기' },
    '아이스 골렘': { weakness: '화염', resistance: '냉기', hpMult: 1.15 },

    // 빙하 심연 +1
    '서리 정령': { weakness: '화염', resistance: '냉기' },

    // 암흑 성 +2
    '뱀파이어': { weakness: '빛', resistance: '어둠', hpMult: 1.15, atkMult: 1.1 },
    '암흑 사제': { weakness: '빛', resistance: '어둠', atkMult: 1.08 },

    // 마왕성 +2
    '마왕의 사도': { weakness: '빛', resistance: '어둠', hpMult: 1.18, atkMult: 1.12 },
    '지옥의 문지기': { weakness: '빛', resistance: '화염', hpMult: 1.3, atkMult: 1.15 },
    '타락한 천사': { weakness: '어둠', resistance: '빛', hpMult: 1.2, atkMult: 1.12 },

    // 고대 보물고 +1
    '보물사냥꾼': { weakness: '화염', resistance: '대지', atkMult: 1.08 },

    // 얼음 거인 (was referenced in drops but not defined)
    '얼음 거인': { weakness: '화염', resistance: '냉기', hpMult: 1.2, atkMult: 1.1 },

    // 다크 엘프 (referenced in drops)
    '다크 엘프': { weakness: '빛', resistance: '어둠', atkMult: 1.06 },

    // ══════ 신규 맵 전용 몬스터 ══════

    // 신성한 호수
    '호수 수호자': { weakness: '대지', resistance: '냉기', hpMult: 1.18, atkMult: 1.08 },
    '성스러운 물고기': { weakness: '어둠', resistance: '빛' },

    // 수정 동굴
    '수정 골렘': { weakness: '대지', resistance: '냉기', hpMult: 1.2, atkMult: 1.08 },
    '결정 정령': { weakness: '화염', resistance: '냉기' },
    '광물 지네': { weakness: '냉기', resistance: '대지', atkMult: 1.06 },
    '수정 지킴이': { weakness: '대지', resistance: '빛', hpMult: 1.12 },

    // 화염의 사원
    '화염 사제': { weakness: '냉기', resistance: '화염', atkMult: 1.12 },
    '불꽃 도마뱀': { weakness: '냉기', resistance: '화염' },
    '용암 정령': { weakness: '냉기', resistance: '화염', hpMult: 1.1 },
    '화염 골렘': { weakness: '냉기', resistance: '화염', hpMult: 1.18, atkMult: 1.1 },
    '화염 감시자': { weakness: '냉기', resistance: '화염', atkMult: 1.1 },

    // 북부 설원
    '서리 늑대': { weakness: '화염', resistance: '냉기', atkMult: 1.08 },
    '설원 거인': { weakness: '화염', resistance: '냉기', hpMult: 1.25, atkMult: 1.12 },
    '얼음 정령': { weakness: '화염', resistance: '냉기' },
    '설인': { weakness: '화염', resistance: '냉기', hpMult: 1.2, atkMult: 1.1 },
    '눈보라 정령': { weakness: '화염', resistance: '냉기', atkMult: 1.12 },

    // 고대 마법 탑
    '마법 구체': { weakness: '어둠', resistance: '빛', atkMult: 1.12 },
    '탑 수호자': { weakness: '대지', resistance: '빛', hpMult: 1.15, atkMult: 1.1 },
    '고대 마법사': { weakness: '냉기', resistance: '빛', atkMult: 1.15 },
    '마력 결정체': { weakness: '어둠', resistance: '빛', hpMult: 1.12 },
    '마법 인형': { weakness: '화염', resistance: '대지', hpMult: 1.08 },

    // 어둠의 지하 감옥
    '고문관': { weakness: '빛', resistance: '어둠', atkMult: 1.12 },
    '사슬 마왕': { weakness: '빛', resistance: '어둠', hpMult: 1.15, atkMult: 1.1 },
    '타락 기사': { weakness: '빛', resistance: '어둠', hpMult: 1.2, atkMult: 1.12 },
    '어둠 수호자': { weakness: '빛', resistance: '어둠', hpMult: 1.18 },
    '감옥 골렘': { weakness: '대지', resistance: '빛', hpMult: 1.3 },

    // 차원의 틈새
    '차원 분열체': { weakness: '빛', resistance: '어둠', atkMult: 1.2, hpMult: 1.25 },
    '공간 파괴자': { weakness: '대지', resistance: '어둠', atkMult: 1.25, hpMult: 1.2 },
    '에테르 거인': {
        isBoss: true,
        weakness: '어둠',
        resistance: '빛',
        hpMult: 1.55,
        atkMult: 1.3,
        expMult: 1.65,
        goldMult: 1.6,
        dropMod: 2.1,
        phase2: { name: '해방된 에테르 거인', atkBonus: 0.45, pattern: { guardChance: 0.1, heavyChance: 0.5 }, log: '에테르 거인이 차원의 힘을 완전히 해방했습니다!' },
    },
    '허무의 집행관': { weakness: '빛', resistance: '어둠', hpMult: 1.3, atkMult: 1.2 },
    '차원 마왕': {
        isBoss: true,
        weakness: '빛',
        resistance: '어둠',
        hpMult: 1.7,
        atkMult: 1.4,
        expMult: 1.9,
        goldMult: 1.85,
        dropMod: 2.5,
        phase2: { name: '각성한 차원 마왕', atkBonus: 0.5, pattern: { guardChance: 0.05, heavyChance: 0.6 }, log: '차원 마왕이 모든 차원의 힘을 집결시켰습니다! 현실이 무너집니다!', statusEffect: 'curse' },
    },

    // ── 진 최종 보스 (프레스티지 3회 + 원시의 파편 3개 해금) ─────────────────
    '원시의 신': {
        isBoss: true,
        weakness: '빛',
        resistance: '어둠',
        hpMult: 2.2,
        atkMult: 1.8,
        expMult: 5.0,
        goldMult: 5.0,
        dropMod: 5.0,
        phase2: { name: '분노한 원시의 신', atkBonus: 0.5, pattern: { guardChance: 0.0, heavyChance: 0.55 }, log: '원시의 신이 고대의 분노를 해방했습니다! 세계의 근원이 흔들립니다...', statusEffect: 'burn', threshold: 0.5 },
        phase3: { name: '원초적 혼돈', atkBonus: 0.9, pattern: { guardChance: 0.0, heavyChance: 0.75 }, log: '원시의 신이 존재 자체를 무너뜨립니다. 이것이 진짜 끝입니다!', statusEffect: 'curse', threshold: 0.25 },
    },

    // ── Sprint 18: 신규 일반 몬스터 25종 ────────────────────────────────────
    // 공중 신전 (5종)
    '폭풍 수호자':      { hp: 380, atk: 72, def: 28, exp: 210, gold: 95, weakness: '대지', resistance: '번개', pattern: { guardChance: 0.2, heavyChance: 0.3 } },
    '하늘 정령':        { hp: 290, atk: 85, def: 18, exp: 190, gold: 88, weakness: '대지', resistance: '빛', pattern: { guardChance: 0.1, heavyChance: 0.35 } },
    '번개 골렘':        { hp: 450, atk: 68, def: 40, exp: 220, gold: 100, weakness: '냉기', resistance: '번개', pattern: { guardChance: 0.3, heavyChance: 0.25 } },
    '바람 드레이크':    { hp: 340, atk: 90, def: 22, exp: 235, gold: 110, weakness: '대지', resistance: '바람', pattern: { guardChance: 0.1, heavyChance: 0.45 } },
    '구름 정령':        { hp: 260, atk: 78, def: 15, exp: 175, gold: 80, weakness: '불꽃', resistance: '바람', pattern: { guardChance: 0.05, heavyChance: 0.3 } },
    // 영혼의 강 (5종)
    '한 맺힌 망자':     { hp: 310, atk: 80, def: 20, exp: 200, gold: 90, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.1, heavyChance: 0.4 }, statusOnHit: 'curse' },
    '강의 요괴':        { hp: 360, atk: 74, def: 30, exp: 195, gold: 85, weakness: '빛', resistance: '물', pattern: { guardChance: 0.2, heavyChance: 0.3 } },
    '익사한 기사':      { hp: 420, atk: 82, def: 35, exp: 230, gold: 105, weakness: '불꽃', resistance: '냉기', pattern: { guardChance: 0.25, heavyChance: 0.35 } },
    '흡혼 해골':        { hp: 280, atk: 88, def: 12, exp: 205, gold: 95, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.05, heavyChance: 0.5 } },
    '저주받은 어부':    { hp: 330, atk: 76, def: 24, exp: 185, gold: 82, weakness: '빛', resistance: '물', pattern: { guardChance: 0.15, heavyChance: 0.35 }, statusOnHit: 'poison' },
    // 금지된 도서관 (5종)
    '살아있는 마법서':  { hp: 240, atk: 95, def: 10, exp: 215, gold: 98, weakness: '불꽃', resistance: '마법', pattern: { guardChance: 0.0, heavyChance: 0.55 } },
    '잉크 슬라임':      { hp: 400, atk: 60, def: 45, exp: 180, gold: 78, weakness: '불꽃', resistance: '냉기', pattern: { guardChance: 0.35, heavyChance: 0.15 } },
    '마법 감시자':      { hp: 350, atk: 86, def: 28, exp: 225, gold: 102, weakness: '어둠', resistance: '빛', pattern: { guardChance: 0.2, heavyChance: 0.35 } },
    '분노한 마구스':    { hp: 300, atk: 100, def: 16, exp: 240, gold: 112, weakness: '냉기', resistance: '불꽃', pattern: { guardChance: 0.05, heavyChance: 0.6 } },
    '책의 정령':        { hp: 270, atk: 92, def: 14, exp: 208, gold: 93, weakness: '불꽃', resistance: '빛', pattern: { guardChance: 0.1, heavyChance: 0.45 } },
    // 지하 미궁 (5종)
    '함정 수호자':      { hp: 390, atk: 78, def: 35, exp: 218, gold: 96, weakness: '빛', resistance: '대지', pattern: { guardChance: 0.3, heavyChance: 0.3 } },
    '미궁의 마왕':      { hp: 460, atk: 88, def: 40, exp: 245, gold: 115, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.2, heavyChance: 0.4 } },
    '돌 거인':          { hp: 500, atk: 70, def: 55, exp: 255, gold: 120, weakness: '번개', resistance: '물리', pattern: { guardChance: 0.4, heavyChance: 0.2 } },
    '독 지네':          { hp: 280, atk: 82, def: 18, exp: 188, gold: 84, weakness: '불꽃', resistance: '독', pattern: { guardChance: 0.1, heavyChance: 0.4 }, statusOnHit: 'poison' },
    '그림자 사냥꾼':    { hp: 320, atk: 96, def: 20, exp: 228, gold: 108, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.1, heavyChance: 0.5 } },
    // 황금 왕국 인근 필드 (5종)
    '황금 왕국 수호자': { hp: 480, atk: 75, def: 50, exp: 250, gold: 200, weakness: '번개', resistance: '물리', pattern: { guardChance: 0.4, heavyChance: 0.2 } },
    '탐욕의 상인':      { hp: 290, atk: 84, def: 22, exp: 192, gold: 180, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.15, heavyChance: 0.35 } },
    '용병 전사':        { hp: 370, atk: 88, def: 32, exp: 215, gold: 115, weakness: '마법', resistance: '물리', pattern: { guardChance: 0.25, heavyChance: 0.4 } },
    '왕국 기사':        { hp: 430, atk: 80, def: 45, exp: 235, gold: 120, weakness: '번개', resistance: '물리', pattern: { guardChance: 0.35, heavyChance: 0.3 } },
    '사기꾼 마법사':    { hp: 260, atk: 102, def: 12, exp: 210, gold: 130, weakness: '냉기', resistance: '불꽃', pattern: { guardChance: 0.05, heavyChance: 0.55 } },

    // ── Sprint 18: 숨겨진 보스 3종 ──────────────────────────────────────────
    '시간의 파수꾼': {
        isBoss: true, weakness: '어둠', resistance: '빛',
        hpMult: 1.8, atkMult: 1.5, expMult: 3.0, goldMult: 3.0, dropMod: 4.0,
        pattern: { guardChance: 0.05, heavyChance: 0.5 },
        phase2: { name: '분열하는 시간의 파수꾼', atkBonus: 0.6, pattern: { guardChance: 0.0, heavyChance: 0.65 }, log: '시간이 뒤틀립니다! 파수꾼이 과거와 미래를 동시에 공격합니다!', statusEffect: 'stun' },
    },
    '원한의 용사': {
        isBoss: true, weakness: '빛', resistance: '어둠',
        hpMult: 1.9, atkMult: 1.6, expMult: 3.5, goldMult: 3.5, dropMod: 4.5,
        pattern: { guardChance: 0.1, heavyChance: 0.45 },
        phase2: { name: '절규하는 원한의 용사', atkBonus: 0.7, pattern: { guardChance: 0.0, heavyChance: 0.6 }, log: '원한이 극에 달했습니다! 용사가 최후의 힘을 폭발시킵니다!', statusEffect: 'curse' },
    },
    '공허의 군주': {
        isBoss: true, weakness: '빛', resistance: '어둠',
        hpMult: 2.0, atkMult: 1.7, expMult: 4.0, goldMult: 4.0, dropMod: 5.0,
        pattern: { guardChance: 0.05, heavyChance: 0.5 },
        phase2: { name: '해방된 공허의 군주', atkBonus: 0.8, pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '공허가 세계를 집어삼킵니다! 군주가 진정한 힘을 드러냅니다!', statusEffect: 'burn' },
        phase3: { name: '공허의 심연', atkBonus: 1.2, pattern: { guardChance: 0.0, heavyChance: 0.8 }, log: '모든 것이 공허로 돌아갑니다!', statusEffect: 'curse', threshold: 0.25 },
    },

    // ── Sprint 21: 신규 지역 몬스터 ─────────────────────────────────────────

    // 세계수 숲 (5종)
    '세계수 수호자':    { hp: 320, atk: 68, def: 30, exp: 195, gold: 88, weakness: '화염', resistance: '자연', pattern: { guardChance: 0.2, heavyChance: 0.25 } },
    '자연의 정령':      { hp: 260, atk: 75, def: 18, exp: 178, gold: 80, weakness: '화염', resistance: '자연', pattern: { guardChance: 0.05, heavyChance: 0.3 } },
    '야생 그리핀':      { hp: 350, atk: 80, def: 22, exp: 210, gold: 95, weakness: '냉기', resistance: '빛', pattern: { guardChance: 0.1, heavyChance: 0.4 } },
    '고목 골렘':        { hp: 480, atk: 62, def: 50, exp: 225, gold: 100, weakness: '화염', resistance: '대지', pattern: { guardChance: 0.35, heavyChance: 0.2 } },
    '뿌리 포식자':      { hp: 290, atk: 85, def: 14, exp: 188, gold: 84, weakness: '화염', resistance: '자연', pattern: { guardChance: 0.05, heavyChance: 0.5 }, statusOnHit: 'poison' },

    // 고대 신전 도시 (5종)
    '신전 경비병':      { hp: 410, atk: 82, def: 38, exp: 228, gold: 105, weakness: '어둠', resistance: '빛', pattern: { guardChance: 0.3, heavyChance: 0.3 } },
    '영겁의 수호신상':  { hp: 550, atk: 70, def: 60, exp: 255, gold: 120, weakness: '대지', resistance: '빛', pattern: { guardChance: 0.4, heavyChance: 0.2 } },
    '신성한 제관':      { hp: 300, atk: 90, def: 20, exp: 218, gold: 98, weakness: '어둠', resistance: '빛', pattern: { guardChance: 0.1, heavyChance: 0.45 } },
    '시간 파편체':      { hp: 340, atk: 88, def: 24, exp: 232, gold: 108, weakness: '자연', resistance: '빛', pattern: { guardChance: 0.1, heavyChance: 0.4 } },
    '망령 기사단장':    { hp: 460, atk: 95, def: 42, exp: 260, gold: 125, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.25, heavyChance: 0.45 } },

    // 차원의 균열 전초기지 (5종 + 1 중보스)
    '차원 보병':        { hp: 380, atk: 92, def: 32, exp: 235, gold: 110, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.2, heavyChance: 0.35 } },
    '공허 포격수':      { hp: 280, atk: 108, def: 14, exp: 248, gold: 118, weakness: '대지', resistance: '어둠', pattern: { guardChance: 0.0, heavyChance: 0.6 } },
    '균열 감시자':      { hp: 440, atk: 88, def: 44, exp: 252, gold: 115, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.3, heavyChance: 0.3 } },
    '에테르 돌격대':    { hp: 360, atk: 102, def: 26, exp: 258, gold: 122, weakness: '자연', resistance: '빛', pattern: { guardChance: 0.1, heavyChance: 0.5 } },
    '차원 사령관':      { hp: 520, atk: 112, def: 50, exp: 280, gold: 140, weakness: '빛', resistance: '어둠', pattern: { guardChance: 0.2, heavyChance: 0.45 } },

    // ── Sprint 21: 신규 보스 3종 ─────────────────────────────────────────────
    '타락한 세계수 영혼': {
        isBoss: true, weakness: '화염', resistance: '자연',
        hpMult: 1.65, atkMult: 1.32, expMult: 2.8, goldMult: 2.8, dropMod: 3.5,
        pattern: { guardChance: 0.1, heavyChance: 0.4 },
        phase2: { name: '분노한 세계수 영혼', atkBonus: 0.5, pattern: { guardChance: 0.0, heavyChance: 0.55 }, log: '세계수의 영혼이 타락의 끝에 도달했습니다! 숲 전체가 울부짖습니다!', statusEffect: 'poison' },
    },
    '수호신의 사도': {
        isBoss: true, weakness: '어둠', resistance: '빛',
        hpMult: 1.75, atkMult: 1.38, expMult: 3.2, goldMult: 3.0, dropMod: 4.0,
        pattern: { guardChance: 0.15, heavyChance: 0.45 },
        phase2: { name: '해방된 수호신의 사도', atkBonus: 0.55, pattern: { guardChance: 0.0, heavyChance: 0.6 }, log: '수호신의 힘이 완전히 해방되었습니다! 신전 전체가 빛으로 가득 찹니다!', statusEffect: 'burn' },
        phase3: { name: '수호신의 심판', threshold: 0.25, atkBonus: 0.9, defBonus: 15, pattern: { guardChance: 0.0, heavyChance: 0.75 }, log: '수호신이 최후의 심판을 내립니다!', statusEffect: 'curse' },
    },
    '균열의 사령관': {
        isBoss: true, weakness: '빛', resistance: '어둠',
        hpMult: 1.7, atkMult: 1.42, expMult: 3.0, goldMult: 3.2, dropMod: 3.8,
        pattern: { guardChance: 0.1, heavyChance: 0.5 },
        phase2: { name: '각성한 균열의 사령관', atkBonus: 0.6, pattern: { guardChance: 0.0, heavyChance: 0.65 }, log: '균열의 사령관이 진정한 차원의 힘을 해방했습니다! 현실이 흔들립니다!', statusEffect: 'curse' },
    },

    // ── 심연 전용 보스 (10층 단위) ──────────────────────────────────────────
    '혼돈의 수호자': {
        isBoss: true,
        weakness: '빛',
        resistance: '어둠',
        hpMult: 1.5,
        atkMult: 1.3,
        expMult: 2.0,
        goldMult: 2.0,
        dropMod: 2.0,
        phase2: { name: '폭주한 혼돈의 수호자', atkBonus: 0.3, pattern: { guardChance: 0.05, heavyChance: 0.45 }, log: '혼돈의 기운이 폭주하며 수호자가 흉포해집니다!' },
    },
    '심연의 파수꾼': {
        isBoss: true,
        weakness: '화염',
        resistance: '냉기',
        hpMult: 1.7,
        atkMult: 1.4,
        expMult: 2.2,
        goldMult: 2.2,
        dropMod: 2.2,
        phase2: { name: '분노한 심연의 파수꾼', atkBonus: 0.35, pattern: { guardChance: 0.08, heavyChance: 0.5 }, log: '파수꾼이 심연의 분노를 해방합니다!' },
    },
    '차원 분열자': {
        isBoss: true,
        weakness: '자연',
        resistance: '비전',
        hpMult: 1.9,
        atkMult: 1.5,
        expMult: 2.5,
        goldMult: 2.5,
        dropMod: 2.5,
        phase2: { name: '해방된 차원 분열자', atkBonus: 0.4, pattern: { guardChance: 0.05, heavyChance: 0.55 }, log: '차원이 갈라지며 분열자의 진정한 힘이 드러납니다!', statusEffect: 'bleed' },
    },
    '엔트로피 군주': {
        isBoss: true,
        weakness: '냉기',
        resistance: '화염',
        hpMult: 2.1,
        atkMult: 1.6,
        expMult: 2.8,
        goldMult: 2.8,
        dropMod: 3.0,
        phase2: { name: '해방된 엔트로피 군주', atkBonus: 0.45, pattern: { guardChance: 0.05, heavyChance: 0.6 }, log: '엔트로피의 파도가 현실을 붕괴시킵니다!', statusEffect: 'poison' },
    },
    '무한의 화신': {
        isBoss: true,
        weakness: '어둠',
        resistance: '빛',
        hpMult: 2.5,
        atkMult: 1.8,
        expMult: 3.5,
        goldMult: 3.5,
        dropMod: 4.0,
        phase2: { name: '완전 각성 무한의 화신', atkBonus: 0.5, pattern: { guardChance: 0.05, heavyChance: 0.65 }, log: '무한의 화신이 영겁의 힘을 완전히 해방했습니다!', statusEffect: 'curse' },
    },

    // ── 중반 일반 몬스터 (Lv 10-18) ──────────────────────────────────────────
    '하수도 악어': { weakness: '화염', resistance: '냉기', hpMult: 1.15, atkMult: 1.05 },
    '독안개 요정': { weakness: '빛', resistance: '자연', atkMult: 1.1 },
    '부식된 기계병': { weakness: '대지', resistance: '화염', hpMult: 1.2 },
    '광풍의 하피': { weakness: '냉기', resistance: '자연', atkMult: 1.12 },
    '전초기지 파수꾼': { weakness: '어둠', resistance: '빛', hpMult: 1.25, atkMult: 1.08 },
    '고원 그리핀': { weakness: '대지', resistance: '자연', hpMult: 1.18, atkMult: 1.1 },

    // ── 중반 보스 (Lv 10-18) ─────────────────────────────────────────────────
    '하수도의 여왕': {
        isBoss: true, weakness: '화염', resistance: '냉기',
        hpMult: 1.3, atkMult: 1.15, expMult: 1.3, goldMult: 1.3,
        phase2: { name: '변이한 하수도 여왕', atkBonus: 0.35, pattern: { guardChance: 0.1, heavyChance: 0.5 }, log: '하수도의 여왕이 독성 변이를 시작합니다! 부식성 액체가 사방에 퍼집니다!', statusEffect: 'poison' },
    },
    '전초기지 사령관': {
        isBoss: true, weakness: '어둠', resistance: '빛',
        hpMult: 1.35, atkMult: 1.2, expMult: 1.35, goldMult: 1.35,
        phase2: { name: '각성한 전초기지 사령관', atkBonus: 0.38, pattern: { guardChance: 0.2, heavyChance: 0.45 }, log: '사령관이 고대 장치를 가동합니다! 기계 병기가 공명합니다!', statusEffect: 'stun' },
    },

    // ── Lv 35-45 보스 (중상위 갭 채우기) ─────────────────────────────────────
    '기계 장군': {
        isBoss: true, weakness: '자연', resistance: '대지',
        hpMult: 1.45, atkMult: 1.25, expMult: 1.4, goldMult: 1.4,
        phase2: { name: '폭주하는 기계 장군', atkBonus: 0.4, pattern: { guardChance: 0.05, heavyChance: 0.55 }, log: '기계 장군이 제한장치를 해제합니다! 증기와 화염이 분출됩니다!', statusEffect: 'burn' },
    },
    '혈월의 뱀파이어 로드': {
        isBoss: true, weakness: '빛', resistance: '어둠',
        hpMult: 1.5, atkMult: 1.3, expMult: 1.45, goldMult: 1.45,
        phase2: { name: '진조 혈월의 군주', atkBonus: 0.42, pattern: { guardChance: 0.15, heavyChance: 0.5 }, log: '혈월의 군주가 진정한 흡혈의 힘을 해방합니다! 주변의 생명력이 빨려들어갑니다!', statusEffect: 'curse' },
    },
    '심연의 크라켄': {
        isBoss: true, weakness: '대지', resistance: '냉기',
        hpMult: 1.55, atkMult: 1.28, expMult: 1.5, goldMult: 1.5,
        phase2: { name: '각성한 심연의 크라켄', atkBonus: 0.4, pattern: { guardChance: 0.1, heavyChance: 0.6 }, log: '크라켄이 심해의 압력을 해방합니다! 거대한 촉수가 공간을 휘감습니다!', statusEffect: 'stun' },
    },
    '타락한 세계수 수호자': {
        isBoss: true, weakness: '화염', resistance: '자연',
        hpMult: 1.48, atkMult: 1.22, expMult: 1.42, goldMult: 1.42,
        phase2: { name: '완전 타락한 세계수 수호자', atkBonus: 0.38, pattern: { guardChance: 0.2, heavyChance: 0.45 }, log: '세계수 수호자의 눈에서 검은 수액이 흘러내립니다! 타락한 자연의 힘이 폭주합니다!', statusEffect: 'poison' },
    },
    '차원 포식자': {
        isBoss: true, weakness: '빛', resistance: '어둠',
        hpMult: 1.52, atkMult: 1.32, expMult: 1.48, goldMult: 1.48,
        phase2: { name: '폭식하는 차원 포식자', atkBonus: 0.42, pattern: { guardChance: 0.0, heavyChance: 0.65 }, log: '차원 포식자가 공간 자체를 삼키기 시작합니다! 차원의 균열이 확산됩니다!', statusEffect: 'curse' },
    },
};

export const BOSS_BRIEFS = Object.freeze({
    '화염의 군주': {
        signature: '광역 화상과 강타 연사',
        entryHint: '냉기 속성과 회복 슬롯을 먼저 준비한 뒤 진입하는 편이 안정적입니다.',
        counterHint: '냉기 속성과 회복 루틴을 준비하면 화상 누적을 버티기 쉽습니다.',
        phaseHint: 'HP 50% 이하부터 강타 비중이 크게 늘어납니다. 회복과 방어를 아껴두세요.',
        rewardHint: '초회 토벌 보너스와 화염 계열 전리품을 노릴 가치가 큽니다.',
        warningChips: ['화상 누적', '강타 폭증'],
        recommendedBuilds: ['방패 요새', '비전 공명']
    },
    '레드 드래곤': {
        signature: '고화력 브레스와 연속 강타',
        entryHint: '브레스 패턴 전에 냉기 무기와 회복 수단을 갖추면 피해를 크게 줄일 수 있습니다.',
        counterHint: '냉기 속성과 방패 조합이 브레스 패턴을 안정적으로 받아냅니다.',
        phaseHint: '격노 이후에는 화상과 강타가 겹치므로 단기 화력으로 빠르게 넘기는 편이 낫습니다.',
        rewardHint: '초회 토벌 보너스와 고화력 무기 파밍 가치가 높은 보스입니다.',
        warningChips: ['브레스', '연속 강타'],
        recommendedBuilds: ['양손 파쇄', '방패 요새']
    },
    스핑크스: {
        signature: '교전 조절과 수수께끼 독패턴',
        entryHint: '짧은 교전으로 끝낼 준비를 하고, 장기전 운영은 피하는 편이 좋습니다.',
        counterHint: '어둠 약점에 맞춰 순간 화력을 준비하고, 긴 교전을 피하는 편이 좋습니다.',
        phaseHint: '각성 후 가드와 독이 섞이므로 큰 스킬은 가드가 빠진 턴에 몰아야 합니다.',
        rewardHint: '정교한 마도 전리품과 추가 골드를 노리기 좋은 지능형 보스입니다.',
        warningChips: ['독 누적', '가드 전환'],
        recommendedBuilds: ['비전 공명', '광전 도박']
    },
    '아누비스 수호자': {
        signature: '저주성 압박과 심판 강타',
        entryHint: '빛 속성 대응과 회복 루틴을 먼저 갖추고 장기전으로 가져가는 편이 좋습니다.',
        counterHint: '빛 속성과 안정적인 회복 루틴이 길어진 심판 턴을 버티는 핵심입니다.',
        phaseHint: '2페이즈에서는 강타와 독성 압박이 동시에 들어오므로 방어형 빌드가 유리합니다.',
        rewardHint: '초회 심판 보너스와 성역형 장비를 노릴 수 있습니다.',
        warningChips: ['심판 강타', '저주 압박'],
        recommendedBuilds: ['방패 요새', '비전 공명']
    },
    '아이스 드래곤': {
        signature: '빙결 누적과 강한 카운터',
        entryHint: '빙결 저항 수단이 없다면 짧은 폭딜 준비가 더 중요합니다.',
        counterHint: '화염 속성과 빠른 마무리 화력이 얼음 장기전을 끊는 데 유리합니다.',
        phaseHint: '절대 영도 이후에는 강타 주기가 짧아집니다. 회복보다 마무리 타이밍이 더 중요합니다.',
        rewardHint: '빙결 계열 재료와 첫 토벌 보상이 커서 고난도 진입 가치가 높습니다.',
        warningChips: ['빙결 누적', '카운터'],
        recommendedBuilds: ['양손 파쇄', '광전 도박']
    },
    '빙결의 마녀': {
        signature: '빙결 저주와 지속 압박',
        entryHint: '마나 회전과 화염 대응을 갖춘 뒤 들어가야 저주 페이즈를 버티기 쉽습니다.',
        counterHint: '화염 속성과 MP 유지가 중요합니다. 제어가 길어져도 스킬 루프가 끊기지 않아야 합니다.',
        phaseHint: '저주 페이즈에 들어가면 상태이상이 겹칩니다. 정화 수단이나 단기 화력을 챙기세요.',
        rewardHint: '비전/저주 계열 장비와 추가 보상을 기대할 수 있는 마도형 보스입니다.',
        warningChips: ['빙결 저주', '상태 겹침'],
        recommendedBuilds: ['비전 공명', '상태이상 집행자']
    },
    마왕: {
        signature: '전영역 압박과 절망 페이즈',
        entryHint: '빛 속성, 회복 루틴, 보스전용 마무리 화력을 모두 갖춘 뒤 진입해야 합니다.',
        counterHint: '빛 속성과 안정적인 회복, 그리고 보스전 전용 마무리 화력이 모두 필요합니다.',
        phaseHint: '분노한 마왕(50%)은 강타와 화상을, 종말의 마왕(20%)은 저주와 극강 강타를 쏟아냅니다. 리소스 비축이 핵심입니다.',
        rewardHint: '최종 토벌 보상과 환생 루프가 이어지는 핵심 전투입니다.',
        warningChips: ['절망 페이즈', '강타+화상', '종말 페이즈'],
        recommendedBuilds: ['방패 요새', '양손 파쇄']
    },
    '차원 파쇄자': {
        signature: '현실 붕괴 패턴과 가드 변조',
        entryHint: '빛 대응과 짧은 폭딜 루프를 만든 뒤 진입해야 왜곡 장기전을 피할 수 있습니다.',
        counterHint: '빛 속성이나 단기 폭딜이 좋고, 긴 교전은 차원 왜곡 때문에 손해가 커집니다.',
        phaseHint: '완전 개방 후 가드 빈도가 높아집니다. 큰 기술은 빈틈에 맞춰야 합니다.',
        rewardHint: '차원 계열 상위 전리품과 초회 관문 보너스를 노릴 수 있습니다.',
        warningChips: ['가드 변조', '왜곡 폭딜'],
        recommendedBuilds: ['양손 파쇄', '비전 공명']
    },
    '영겁의 수문장': {
        signature: '시간 지연과 중장기 소모전',
        entryHint: '방패와 회복 루틴을 준비하고, 장기전에 강한 세팅으로 들어가는 편이 좋습니다.',
        counterHint: '자연 약점 대응과 높은 방어력이 중요합니다. 회복 타이밍을 미리 잡는 편이 좋습니다.',
        phaseHint: '해방 후 강타와 제어가 섞여 들어오니 방패나 높은 HP가 체감됩니다.',
        rewardHint: '장기전 보상과 수호 계열 전리품 효율이 높은 보스입니다.',
        warningChips: ['시간 지연', '강타 제어'],
        recommendedBuilds: ['방패 요새', '탐험 수집가']
    },
    '에테르 드래곤': {
        signature: '에테르 역류와 최고난도 화력 체크',
        entryHint: '속성 대응, MP 회전, 마무리 화력을 모두 맞춘 뒤 최종 점검처럼 들어가야 합니다.',
        counterHint: '어둠 약점 대응과 단기 폭딜, 그리고 MP 회전이 모두 갖춰져야 합니다.',
        phaseHint: '해방 이후 공격 패턴이 고르게 강합니다. 한 가지 대응만 준비하면 무너집니다.',
        rewardHint: '최상위 전리품과 대량 초회 보상을 노릴 수 있는 최종 상위 보스입니다.',
        warningChips: ['에테르 역류', '전영역 압박'],
        recommendedBuilds: ['비전 공명', '양손 파쇄']
    },
    '시간의 파수꾼': {
        signature: '시간 분열과 2페이즈 기절 패턴',
        entryHint: '시간술사 직업 + Lv 40 이상에서 공중 신전 탐색 중 해금됩니다.',
        counterHint: '어둠 속성 공격이 효과적입니다. 기절에 대비해 HP를 넉넉히 유지하세요.',
        phaseHint: '50% 이하에서 연속 기절 패턴으로 전환됩니다. 고속 마무리가 핵심입니다.',
        rewardHint: '시간 계열 전리품과 희귀 유물이 높은 확률로 드랍됩니다.',
        warningChips: ['2페이즈', '기절 연속', '시간 분열'],
        recommendedBuilds: ['시간술사', '비전 공명']
    },
    '원한의 용사': {
        signature: '원한 강화와 2페이즈 저주 폭발',
        entryHint: '"최후의 영웅" 이벤트 체인 3단계를 완료하면 지하 미궁에서 만날 수 있습니다.',
        counterHint: '빛 속성이 효과적입니다. 저주 해제 아이템을 준비하세요.',
        phaseHint: '50% 이하에서 저주 + 고화력 복합 패턴이 시작됩니다.',
        rewardHint: '기사 계열 전설 장비 드랍 확률이 있습니다.',
        warningChips: ['2페이즈', '저주 폭발', '원한 강화'],
        recommendedBuilds: ['방패 요새', '양손 파쇄']
    },
    '공허의 군주': {
        signature: '공허 흡수와 3페이즈 전영역 파괴',
        entryHint: '심연 100층 클리어 후 금지된 도서관에서 해금됩니다.',
        counterHint: '빛 속성과 높은 MP 회전이 모두 필요합니다. 쿨타임 없이 연속 공세가 중요합니다.',
        phaseHint: '50% 이하에서 화상, 25% 이하에서 저주 + 전영역 압박으로 변신합니다.',
        rewardHint: '최상위 보상 및 공허 계열 전설 유물이 드랍됩니다.',
        warningChips: ['3페이즈', '화상+저주', '전영역 압박'],
        recommendedBuilds: ['비전 공명', '양손 파쇄', '시간술사']
    },
    '원시의 신': {
        signature: '존재 자체를 무너뜨리는 3페이즈 원초 파괴',
        entryHint: '프레스티지 3회 이상 + 원시의 파편 3개를 모아야만 마주칠 수 있는 진 최종 보스입니다.',
        counterHint: '빛 속성 무기와 최고 등급 방어력, 그리고 충분한 MP 회전이 전제 조건입니다.',
        phaseHint: '50% 이하에서 분노 페이즈, 25% 이하에서 원초적 혼돈으로 변신합니다. 자원을 아끼세요.',
        rewardHint: '이 보스를 쓰러뜨리면 진 엔딩이 해금됩니다. 게임의 진정한 결말입니다.',
        warningChips: ['3페이즈', '원초 저주', '강타+화상'],
        recommendedBuilds: ['비전 공명', '양손 파쇄', '방패 요새']
    }
});

export const BOSS_MONSTERS = Object.entries(MONSTERS)
    .filter(([, data]) => Boolean(data?.isBoss))
    .map(([name]) => name);
