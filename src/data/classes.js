export const CLASSES = {
    '모험가': {
        tier: 0, desc: '기본 직업', hpMod: 1.0, mpMod: 1.0, atkMod: 1.0,
        skills: [
            { name: '강타', mp: 10, type: '물리', mult: 1.5, desc: '강력한 일격으로 적을 타격한다' },
            { name: '방어 태세', mp: 8, type: 'buff', effect: 'def_up', val: 1.3, turn: 2, desc: 'DEF 30% 상승 2턴' },
            // 패시브
            { name: '투지', passive: true, effect: 'hp_up', val: 20, desc: '최대 HP +20 (패시브)' },
        ],
        next: ['전사', '마법사', '도적']
    },

    // ── 1차 전직 ─────────────────────────────────────────────────────────────
    '전사': {
        tier: 1, reqLv: 5, desc: '체력/공격 특화 — 전선을 지키는 용사', hpMod: 1.4, mpMod: 0.6, atkMod: 1.3,
        skills: [
            { name: '파워배시', mp: 15, mult: 2.0, desc: '강력한 내려찍기. 방패를 무시한다' },
            { name: '광폭화', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, turn: 3, desc: 'ATK 50% 상승 3턴' },
            { name: '출혈베기', mp: 25, mult: 1.8, effect: 'bleed', desc: '베인 상처에서 3턴간 지속 피해' },
            { name: '방패 전술', mp: 20, type: 'buff', effect: 'def_up', val: 1.4, turn: 2, desc: 'DEF 40% 상승 2턴' },
            { name: '전투 함성', mp: 15, type: 'debuff', effect: 'fear', turn: 3, desc: '전투 함성으로 적 ATK 25% 감소 3턴' },
            { name: '철벽 방어', mp: 35, type: 'buff', effect: 'def_up', val: 1.8, turn: 2, desc: 'DEF 80% 상승 2턴, 반격 자세 돌입' },
            // 패시브
            { name: '강인한 체력', passive: true, effect: 'hp_up', val: 80, desc: '최대 HP +80 (패시브)' },
            { name: '근력 훈련', passive: true, effect: 'atk_up', val: 5, desc: 'ATK +5 (패시브)' },
        ],
        skillBranches: {
            '파워배시': [
                { choice: 'A', label: '강화 배시', desc: '데미지 +35%', override: { mult: 2.7 } },
                { choice: 'B', label: '기절 배시', desc: '20% 확률 기절 1턴', override: { mult: 2.0, effect: 'stun', effectChance: 0.2 } },
            ],
            '광폭화': [
                { choice: 'A', label: '광란', desc: 'ATK +70% 3턴', override: { val: 1.7 } },
                { choice: 'B', label: '분노의 방패', desc: 'ATK +50% + DEF +20% 3턴', override: { val: 1.5, defBonus: 1.2 } },
            ],
            '출혈베기': [
                { choice: 'A', label: '심층 출혈', desc: '출혈 피해 +50%', override: { mult: 2.5, effect: 'bleed' } },
                { choice: 'B', label: '이중 상처', desc: '출혈 + 독 동시 부여', override: { mult: 2.2, effect: 'bleed', secondEffect: 'poison' } },
            ],
        },
        next: ['나이트', '버서커']
    },

    '마법사': {
        tier: 1, reqLv: 5, desc: '마법 공격 특화 — 원소의 학도', hpMod: 0.7, mpMod: 1.8, atkMod: 1.6,
        skills: [
            { name: '화염구', mp: 20, type: '화염', mult: 2.2, effect: 'burn', desc: '화염 속성 + 화상 부여' },
            { name: '썬더볼트', mp: 45, type: '빛', mult: 3.5, effect: 'stun', desc: '번개로 적 기절 부여' },
            { name: '아이스볼트', mp: 25, type: '냉기', mult: 2.0, effect: 'freeze', desc: '냉기 속성 + 빙결 부여' },
            { name: '마법 방벽', mp: 30, type: 'buff', effect: 'def_up', val: 1.5, turn: 3, desc: '마법 방벽으로 DEF 50% 상승 3턴' },
            { name: '마나 가속', mp: 0, type: 'buff', effect: 'mp_regen', val: 20, turn: 3, desc: 'MP 20 즉시 회복, 3턴간 추가 회복' },
            { name: '차원 분열', mp: 55, type: '어둠', mult: 3.8, effect: 'curse', desc: '공간을 찢어 저주와 대미지 부여' },
            // 패시브
            { name: '마력 집중', passive: true, effect: 'mp_up', val: 60, desc: '최대 MP +60 (패시브)' },
            { name: '원소 친화', passive: true, effect: 'atk_up', val: 8, desc: 'ATK +8 (패시브)' },
        ],
        skillBranches: {
            '화염구': [
                { choice: 'A', label: '폭발 화염', desc: '데미지 +35%', override: { mult: 2.97 } },
                { choice: 'B', label: '지속 화염', desc: '화상 3턴 (1→3턴)', override: { mult: 2.2, burnTurn: 3 } },
            ],
            '썬더볼트': [
                { choice: 'A', label: '초전도', desc: '데미지 +25%', override: { mult: 4.375 } },
                { choice: 'B', label: '마비 번개', desc: '기절 2턴 (확률 +)', override: { mult: 3.5, effect: 'stun', stunTurn: 2 } },
            ],
            '차원 분열': [
                { choice: 'A', label: '공간 붕괴', desc: '데미지 +30%', override: { mult: 4.94 } },
                { choice: 'B', label: '이중 저주', desc: '저주 + 출혈 동시 부여', override: { mult: 3.8, secondEffect: 'bleed' } },
            ],
        },
        next: ['아크메이지', '흑마법사', '성직자', '무당']
    },

    '도적': {
        tier: 1, reqLv: 5, desc: '치명타/속도 — 어둠 속의 칼날', hpMod: 1.0, mpMod: 1.0, atkMod: 1.4,
        skills: [
            { name: '급소찌르기', mp: 15, mult: 1.8, crit: 0.5, desc: '50% 치명타 확률 급소 공격' },
            { name: '독바르기', mp: 25, type: '자연', mult: 1.5, effect: 'poison', desc: '독 도포 + 자연 속성 피해' },
            { name: '연막탄', mp: 20, type: 'debuff', effect: 'blind', turn: 2, desc: '연막으로 적 명중률 2턴 하락' },
            { name: '그림자 발걸음', mp: 18, type: 'buff', effect: 'stealth', val: 1.3, turn: 2, desc: '은신 진입 + 회피 상승 2턴' },
            { name: '등 찌르기', mp: 30, mult: 2.5, crit: 0.6, desc: '은신 중 60% 치명타, 일반 시 강화 피해' },
            { name: '독 보강', mp: 22, type: '자연', mult: 1.6, effect: 'poison', desc: '기존 독 강화 + 추가 자연 피해' },
            // 패시브
            { name: '날카로운 감각', passive: true, effect: 'atk_up', val: 6, desc: 'ATK +6 (패시브)' },
            { name: '날렵함', passive: true, effect: 'def_up', val: 3, desc: 'DEF +3 (패시브)' },
        ],
        skillBranches: {
            '급소찌르기': [
                { choice: 'A', label: '치명 특화', desc: '치명타 확률 +20%', override: { crit: 0.7 } },
                { choice: 'B', label: '관통 찌르기', desc: '데미지 +30% (치명타 무관)', override: { mult: 2.34 } },
            ],
            '등 찌르기': [
                { choice: 'A', label: '심장 찌르기', desc: '데미지 +30%', override: { mult: 3.25 } },
                { choice: 'B', label: '혼란 찌르기', desc: '기절 + 출혈 동시 부여', override: { mult: 2.5, secondEffect: 'bleed', effectChance: 0.4 } },
            ],
            '독바르기': [
                { choice: 'A', label: '맹독', desc: '독 피해 +50%', override: { mult: 2.25 } },
                { choice: 'B', label: '이중 독', desc: '독 + 출혈 동시 부여', override: { mult: 1.5, secondEffect: 'bleed' } },
            ],
        },
        next: ['어쌔신', '레인저']
    },

    // ── 2차 전직 ─────────────────────────────────────────────────────────────
    '나이트': {
        tier: 2, reqLv: 30, desc: '철벽의 방어 — 성채를 걷는 기사', hpMod: 2.0, mpMod: 0.8, atkMod: 1.5,
        skills: [
            { name: '실드배시', mp: 20, mult: 2.5, effect: 'stun', desc: '방패 일격 + 기절 부여' },
            { name: '절대방어', mp: 50, type: 'buff', effect: 'def_up', val: 2.0, turn: 5, desc: 'DEF 100% 상승 5턴' },
            { name: '신성한 심판', mp: 80, type: '빛', mult: 5.0, effect: 'purify', desc: '궁극기 — 신성 피해 + 정화' },
            { name: '도발', mp: 30, type: 'debuff', effect: 'taunt', turn: 3, desc: '적 분노 유발, 집중 공격 3턴' },
            { name: '반격 자세', mp: 35, type: 'buff', effect: 'counter', val: 1.4, turn: 3, desc: '피격 시 반격 확률 상승 3턴' },
            { name: '성스러운 빛', mp: 40, type: '빛', mult: 3.0, effect: 'purify', desc: '빛으로 적 상태이상 제거 + 피해' },
            { name: '군주의 위엄', mp: 25, type: 'debuff', effect: 'fear', turn: 4, desc: '위압으로 적 ATK 35% 감소 4턴' },
            // 패시브
            { name: '철갑 단련', passive: true, effect: 'def_up', val: 12, desc: 'DEF +12 (패시브)' },
            { name: '기사의 맹세', passive: true, effect: 'hp_up', val: 150, desc: '최대 HP +150 (패시브)' },
        ],
        skillBranches: {
            '실드배시': [
                { choice: 'A', label: '강력 배시', desc: '데미지 +40%', override: { mult: 3.5 } },
                { choice: 'B', label: '철벽 배시', desc: '기절 후 DEF +20% 1턴', override: { mult: 2.5, defBonus: 1.2 } },
            ],
            '신성한 심판': [
                { choice: 'A', label: '천상 강타', desc: '데미지 +25%', override: { mult: 6.25 } },
                { choice: 'B', label: '신성한 화염', desc: '정화 + 화상 동시 부여', override: { mult: 5.0, secondEffect: 'burn' } },
            ],
        },
        next: []
    },

    '버서커': {
        tier: 2, reqLv: 30, desc: '광란의 공격 — 피를 마시는 전사', hpMod: 1.6, mpMod: 0.5, atkMod: 2.0,
        skills: [
            { name: '휠윈드', mp: 30, mult: 3.0, desc: '회전 연속 공격' },
            { name: '피의갈망', mp: 60, type: 'buff', effect: 'berserk', val: 2.5, turn: 3, desc: 'ATK 150% / DEF 감소 3턴' },
            { name: '대지 분쇄', mp: 80, type: '대지', mult: 5.5, effect: 'stun', desc: '궁극기 — 기절 + 대지 분쇄' },
            { name: '출혈 광란', mp: 50, mult: 3.5, effect: 'bleed', desc: '광란 상태 강력한 출혈 유발' },
            { name: '분노의 포효', mp: 25, type: 'buff', effect: 'atk_up', val: 2.0, turn: 2, desc: 'ATK 100% 상승 2턴 (DEF -30%)' },
            { name: '피의 강물', mp: 65, mult: 4.0, effect: 'bleed', desc: '광역 출혈 + 강대한 피해' },
            { name: '역경의 힘', mp: 20, type: 'buff', effect: 'hp_regen', val: 0.05, turn: 3, desc: 'HP 낮을수록 강해짐, 3턴간 HP 회복' },
            // 패시브
            { name: '무자비한 본능', passive: true, effect: 'atk_up', val: 15, desc: 'ATK +15 (패시브)' },
            { name: '전투 중독', passive: true, effect: 'hp_up', val: 60, desc: '최대 HP +60 (패시브)' },
        ],
        skillBranches: {
            '휠윈드': [
                { choice: 'A', label: '폭풍 회전', desc: '데미지 +35%', override: { mult: 4.05 } },
                { choice: 'B', label: '출혈 회전', desc: '출혈 부여 + 데미지', override: { mult: 3.0, effect: 'bleed' } },
            ],
            '대지 분쇄': [
                { choice: 'A', label: '지진 강타', desc: '데미지 +25%', override: { mult: 6.875 } },
                { choice: 'B', label: '독지 강타', desc: '기절 + 독 동시 부여', override: { mult: 5.5, secondEffect: 'poison' } },
            ],
        },
        next: []
    },

    '아크메이지': {
        tier: 2, reqLv: 30, desc: '원소의 지배자 — 세계를 태우는 마법사', hpMod: 0.8, mpMod: 2.5, atkMod: 2.2,
        skills: [
            { name: '메테오', mp: 60, type: '화염', mult: 4.5, effect: 'burn', desc: '하늘에서 운석을 소환, 화상 부여' },
            { name: '블리자드', mp: 60, type: '냉기', mult: 4.0, effect: 'freeze', desc: '얼음폭풍 + 빙결 부여' },
            { name: '천벌', mp: 100, type: '빛', mult: 6.0, effect: 'purify', desc: '궁극기 — 천상의 번개 강타' },
            { name: '마나 폭발', mp: 80, mult: 5.0, desc: '순수 마력을 폭발시켜 적을 강타' },
            { name: '원소 폭풍', mp: 70, type: '화염', mult: 4.8, effect: 'burn', desc: '화염+냉기 복합 원소 폭풍' },
            { name: '고위 마력 증폭', mp: 45, type: 'buff', effect: 'atk_up', val: 2.0, turn: 3, desc: '마력 증폭으로 ATK 100% 상승 3턴' },
            { name: '시간 왜곡', mp: 55, type: 'debuff', effect: 'stun', turn: 2, desc: '시간 왜곡으로 적 행동 중단 2턴' },
            // 패시브
            { name: '대마도사의 심상', passive: true, effect: 'mp_up', val: 120, desc: '최대 MP +120 (패시브)' },
            { name: '원소 강화', passive: true, effect: 'atk_up', val: 18, desc: 'ATK +18 (패시브)' },
        ],
        skillBranches: {
            '메테오': [
                { choice: 'A', label: '대운석', desc: '데미지 +30%', override: { mult: 5.85 } },
                { choice: 'B', label: '불꽃 운석', desc: '화상 + 출혈 동시 부여', override: { mult: 4.5, secondEffect: 'bleed' } },
            ],
            '천벌': [
                { choice: 'A', label: '천상의 분노', desc: '데미지 +25%', override: { mult: 7.5 } },
                { choice: 'B', label: '심판의 천벌', desc: '기절 2턴 + 저주', override: { mult: 6.0, secondEffect: 'curse', stunTurn: 2 } },
            ],
        },
        next: []
    },

    '흑마법사': {
        tier: 2, reqLv: 30, desc: '어둠의 계약 — 금단을 탐하는 자', hpMod: 0.9, mpMod: 2.0, atkMod: 2.0,
        skills: [
            { name: '다크메터', mp: 50, type: '어둠', mult: 4.0, effect: 'curse', desc: '암흑 에너지로 저주 부여' },
            { name: '생명흡수', mp: 40, mult: 3.0, effect: 'drain', desc: '적의 생명력을 흡수해 HP 회복' },
            { name: '영혼 파괴', mp: 100, type: '어둠', mult: 6.5, effect: 'curse', desc: '궁극기 — 영혼 분쇄 저주' },
            { name: '공포', mp: 35, type: 'debuff', effect: 'fear', turn: 3, desc: '광기로 적 ATK 30% 감소 3턴' },
            { name: '어둠의 서약', mp: 55, type: 'buff', effect: 'atk_up', val: 1.8, turn: 4, desc: 'ATK 80% 상승, HP를 소모하는 계약' },
            { name: '죽음의 손길', mp: 70, type: '어둠', mult: 4.5, effect: 'poison', desc: '어둠 독을 부여, 매 턴 심각한 피해' },
            { name: '혼돈의 파동', mp: 45, type: '어둠', mult: 3.5, effect: 'curse', desc: '혼돈의 파동으로 저주 강화' },
            // 패시브
            { name: '어둠의 속삭임', passive: true, effect: 'atk_up', val: 12, desc: 'ATK +12 (패시브)' },
            { name: '금단의 지식', passive: true, effect: 'mp_up', val: 80, desc: '최대 MP +80 (패시브)' },
        ],
        skillBranches: {
            '영혼 파괴': [
                { choice: 'A', label: '영혼 분쇄', desc: '데미지 +25%', override: { mult: 8.125 } },
                { choice: 'B', label: '저주 연쇄', desc: '저주 + 독 동시 부여', override: { mult: 6.5, secondEffect: 'poison' } },
            ],
            '생명흡수': [
                { choice: 'A', label: '강화 흡수', desc: '데미지 및 흡수량 +30%', override: { mult: 3.9 } },
                { choice: 'B', label: '저주 흡수', desc: '저주 부여 + 흡수', override: { mult: 3.0, secondEffect: 'curse' } },
            ],
        },
        next: []
    },

    '어쌔신': {
        tier: 2, reqLv: 30, desc: '일격필살 — 그림자의 사형집행인', hpMod: 1.1, mpMod: 1.2, atkMod: 1.9,
        skills: [
            { name: '암살', mp: 40, mult: 5.0, crit: 0.8, desc: '80% 치명타 확률 암살 일격' },
            { name: '은신', mp: 30, type: 'buff', effect: 'stealth', val: 2.0, turn: 2, desc: '완전 은신 + 회피 대폭 상승 2턴' },
            { name: '그림자 일섬', mp: 100, type: '어둠', mult: 7.0, crit: 1.0, desc: '궁극기 — 100% 치명타 어둠 일격' },
            { name: '치명 독', mp: 50, type: '자연', mult: 3.0, effect: 'poison', desc: '치명적인 독 도포 + 강화 피해' },
            { name: '이중 자상', mp: 35, mult: 2.0, crit: 0.7, desc: '두 번 연속 공격, 각 70% 치명타' },
            { name: '그림자 이동', mp: 20, type: 'buff', effect: 'stealth', val: 1.8, turn: 3, desc: '순간 은신 + 다음 공격 강화 3턴' },
            { name: '처형 판결', mp: 80, mult: 6.0, crit: 0.9, desc: '고배율 + 90% 치명타 처형기' },
            // 패시브
            { name: '암살자의 각인', passive: true, effect: 'atk_up', val: 10, desc: 'ATK +10 (패시브)' },
            { name: '그림자의 춤', passive: true, effect: 'def_up', val: 5, desc: 'DEF +5 (패시브)' },
        ],
        skillBranches: {
            '암살': [
                { choice: 'A', label: '치명 암살', desc: '치명타 확률 +15%', override: { crit: 0.95 } },
                { choice: 'B', label: '독 암살', desc: '독 부여 + 데미지', override: { mult: 5.0, secondEffect: 'poison' } },
            ],
            '그림자 일섬': [
                { choice: 'A', label: '심연의 일섬', desc: '데미지 +20%', override: { mult: 8.4 } },
                { choice: 'B', label: '저주 일섬', desc: '저주 + 출혈 동시 부여', override: { mult: 7.0, secondEffect: 'curse' } },
            ],
        },
        next: []
    },

    '레인저': {
        tier: 2, reqLv: 30, desc: '원거리 명사수 — 바람의 추적자', hpMod: 1.2, mpMod: 1.5, atkMod: 1.7,
        skills: [
            { name: '연속사격', mp: 35, mult: 3.5, desc: '빠른 연속 화살 3발 발사' },
            { name: '폭발화살', mp: 45, type: '화염', mult: 3.8, effect: 'burn', desc: '화염 화살 + 화상 부여' },
            { name: '저격', mp: 100, mult: 8.0, crit: 0.7, desc: '궁극기 — 70% 치명타 저격' },
            { name: '빙결 화살', mp: 40, type: '냉기', mult: 3.2, effect: 'freeze', desc: '냉기 화살 + 빙결 부여' },
            { name: '독화살', mp: 30, type: '자연', mult: 2.5, effect: 'poison', desc: '독 도포 화살' },
            { name: '독수리의 눈', mp: 25, type: 'buff', effect: 'atk_up', val: 1.6, turn: 3, desc: 'ATK 60% 상승, 정밀 조준 3턴' },
            { name: '폭풍 화살비', mp: 70, mult: 5.0, desc: '수십 발의 화살을 일제히 발사' },
            // 패시브
            { name: '정밀 조준', passive: true, effect: 'atk_up', val: 8, desc: 'ATK +8 (패시브)' },
            { name: '자연 친화', passive: true, effect: 'hp_up', val: 40, desc: '최대 HP +40 (패시브)' },
        ],
        skillBranches: {
            '저격': [
                { choice: 'A', label: '관통 저격', desc: '데미지 +25%', override: { mult: 10.0 } },
                { choice: 'B', label: '독 저격', desc: '독 부여 + 치명타', override: { mult: 8.0, secondEffect: 'poison' } },
            ],
            '폭발화살': [
                { choice: 'A', label: '거대 폭발', desc: '데미지 +30%', override: { mult: 4.94 } },
                { choice: 'B', label: '화염 폭발', desc: '화상 + 출혈 동시 부여', override: { mult: 3.8, secondEffect: 'bleed' } },
            ],
        },
        next: ['사냥의 군주']
    },

    // ── 1차 전직: 성직자 ──────────────────────────────────────────────────────
    '성직자': {
        tier: 1, reqLv: 5, desc: '치유와 빛의 마법사 — 신의 대리인', hpMod: 1.0, mpMod: 1.6, atkMod: 1.3,
        skills: [
            { name: '신성 광선', mp: 20, type: '빛', mult: 1.8, desc: '빛 속성 집중 공격' },
            { name: '정화', mp: 30, type: '빛', mult: 1.5, effect: 'purify', desc: '상태이상 정화 + 추가 빛 피해' },
            { name: '공포 유발', mp: 25, type: 'debuff', effect: 'fear', turn: 2, desc: '적 ATK 30% 감소 2턴' },
            { name: '신성한 보호막', mp: 35, type: 'buff', effect: 'def_up', val: 1.6, turn: 3, desc: '신성한 방어 DEF 60% 상승 3턴' },
            { name: '성스러운 빛', mp: 40, type: '빛', mult: 2.5, effect: 'purify', desc: '강화 빛 공격 + 정화' },
            { name: '기적의 손길', mp: 45, type: 'buff', effect: 'hp_regen', val: 0.15, turn: 3, desc: 'HP 15% 회복 + 3턴간 지속 회복' },
            // 패시브
            { name: '신의 은총', passive: true, effect: 'hp_up', val: 50, desc: '최대 HP +50 (패시브)' },
            { name: '성스러운 마나', passive: true, effect: 'mp_up', val: 40, desc: '최대 MP +40 (패시브)' },
        ],
        next: ['팔라딘']
    },

    // ── 3차 전직 (Lv 60+) ────────────────────────────────────────────────────
    '팔라딘': {
        tier: 3, reqLv: 60, desc: '빛의 수호자 — 치유와 방어의 정점', hpMod: 2.2, mpMod: 1.4, atkMod: 1.6,
        skills: [
            { name: '신성 강타', mp: 40, type: '빛', mult: 3.5, effect: 'stun', desc: '기절 + 신성 피해' },
            { name: '성스러운 방패', mp: 60, type: 'buff', effect: 'def_up', val: 2.5, turn: 5, desc: 'DEF 150% 상승 5턴' },
            { name: '신의 심판', mp: 120, type: '빛', mult: 7.0, effect: 'purify', desc: '궁극기 — 강력한 신성 심판' },
            { name: '정화의 빛', mp: 50, type: '빛', mult: 2.5, effect: 'purify', desc: '상태이상 정화 + 강화 피해' },
            { name: '성스러운 폭풍', mp: 80, type: '빛', mult: 5.5, effect: 'stun', desc: '빛의 폭풍으로 기절 + 대피해' },
            { name: '빛의 장벽', mp: 70, type: 'buff', effect: 'def_up', val: 3.0, turn: 4, desc: 'DEF 200% 상승 4턴 — 신성 장벽' },
            { name: '기적의 부활', mp: 90, type: 'buff', effect: 'hp_regen', val: 0.3, turn: 2, desc: 'HP 30% 즉시 회복 + 2턴 재생' },
            { name: '천상의 포화', mp: 100, type: '빛', mult: 6.5, effect: 'purify', desc: '빛의 연속 공격 + 정화' },
            // 패시브
            { name: '팔라딘의 맹세', passive: true, effect: 'hp_up', val: 250, desc: '최대 HP +250 (패시브)' },
            { name: '성소의 가호', passive: true, effect: 'def_up', val: 20, desc: 'DEF +20 (패시브)' },
        ],
        next: []
    },

    '드래곤 나이트': {
        tier: 3, reqLv: 60, desc: '용의 힘을 계승한 광전사', hpMod: 1.9, mpMod: 0.7, atkMod: 2.5,
        skills: [
            { name: '용의 포효', mp: 50, type: '화염', mult: 4.5, effect: 'burn', desc: '화상 + 강력한 화염 피해' },
            { name: '혈룡 광란', mp: 80, type: 'buff', effect: 'berserk', val: 3.0, turn: 4, desc: 'ATK 200% / DEF 감소 4턴' },
            { name: '용왕의 노여움', mp: 150, type: '화염', mult: 9.0, effect: 'burn', desc: '궁극기 — 용왕의 화염 강타' },
            { name: '파멸의 쐐기', mp: 70, mult: 5.5, effect: 'bleed', desc: '강력한 출혈 + 대미지' },
            { name: '용린의 방패', mp: 60, type: 'buff', effect: 'def_up', val: 2.2, turn: 3, desc: '용린 갑옷 DEF 120% 상승 3턴' },
            { name: '불꽃 숨결', mp: 65, type: '화염', mult: 5.0, effect: 'burn', desc: '용의 숨결 — 광역 화염 피해' },
            { name: '용사의 계승', mp: 85, type: 'buff', effect: 'atk_up', val: 2.8, turn: 3, desc: 'ATK 180% 상승 — 용의 힘 해방' },
            // 패시브
            { name: '용의 피', passive: true, effect: 'hp_up', val: 200, desc: '최대 HP +200 (패시브)' },
            { name: '화염 속성', passive: true, effect: 'atk_up', val: 20, desc: 'ATK +20 (패시브)' },
        ],
        next: []
    },

    '대마법사': {
        tier: 3, reqLv: 60, desc: '모든 원소를 지배하는 자', hpMod: 0.85, mpMod: 3.0, atkMod: 2.8,
        skills: [
            { name: '오메가 메테오', mp: 80, type: '화염', mult: 6.0, effect: 'burn', desc: '화상 + 거대 운석 소환' },
            { name: '시간 정지', mp: 100, type: 'debuff', effect: 'stun', turn: 3, desc: '시간을 정지시켜 3턴 기절' },
            { name: '대소멸', mp: 180, mult: 10.0, type: '빛', effect: 'purify', desc: '궁극기 — 절대 원소 소멸' },
            { name: '마나 폭풍', mp: 90, type: '냉기', mult: 6.5, effect: 'freeze', desc: '빙결 + 강력한 냉기 폭풍' },
            { name: '원소의 심판', mp: 120, type: '화염', mult: 8.0, effect: 'burn', desc: '5원소 동시 발동 심판' },
            { name: '차원의 균열', mp: 75, type: '어둠', mult: 5.5, effect: 'curse', desc: '차원 균열에서 나오는 어둠' },
            { name: '대마법사의 위엄', mp: 60, type: 'buff', effect: 'atk_up', val: 2.5, turn: 4, desc: 'ATK 150% 상승 4턴 — 마력 해방' },
            // 패시브
            { name: '마법의 정점', passive: true, effect: 'mp_up', val: 200, desc: '최대 MP +200 (패시브)' },
            { name: '원소 지배', passive: true, effect: 'atk_up', val: 25, desc: 'ATK +25 (패시브)' },
        ],
        next: []
    },

    '그림자 주군': {
        tier: 3, reqLv: 60, desc: '어둠과 일격의 절대자', hpMod: 1.2, mpMod: 1.5, atkMod: 2.3,
        skills: [
            { name: '신의 일격', mp: 60, mult: 7.0, crit: 0.9, desc: '90% 치명타 확률 신의 일격' },
            { name: '그림자 군주', mp: 80, type: 'buff', effect: 'stealth', val: 3.0, turn: 3, desc: '3턴간 강화 은신 + ATK 증가' },
            { name: '허무의 각', mp: 150, type: '어둠', mult: 11.0, crit: 1.0, desc: '궁극기 — 100% 치명타 어둠 일격' },
            { name: '독의 예술', mp: 60, type: '자연', mult: 4.5, effect: 'poison', desc: '예술적인 독 운용 — 강력한 독' },
            { name: '심연의 계단', mp: 70, type: '어둠', mult: 6.0, crit: 0.8, desc: '80% 치명타 심연 공격' },
            { name: '그림자 복제', mp: 85, type: 'buff', effect: 'atk_up', val: 2.5, turn: 3, desc: '그림자 분신 생성 ATK 150% 3턴' },
            { name: '무한 연격', mp: 90, mult: 8.0, crit: 0.95, desc: '연속 치명타 공격' },
            // 패시브
            { name: '절대 어둠', passive: true, effect: 'atk_up', val: 22, desc: 'ATK +22 (패시브)' },
            { name: '그림자 체질', passive: true, effect: 'def_up', val: 10, desc: 'DEF +10 (패시브)' },
        ],
        next: []
    },

    // ── Sprint 16 신규 직업 ────────────────────────────────────────────────
    '무당': {
        tier: 2, reqLv: 12, desc: '저주/독/소환 — 죽음에 가까울수록 강해지는 주술사', hpMod: 0.9, mpMod: 1.6, atkMod: 1.5,
        skills: [
            { name: '저주의 낙인', mp: 25, type: '어둠', mult: 1.6, effect: 'curse', desc: '강화된 저주 부여 — 적 피해 배율 증폭' },
            { name: '영혼 소환', mp: 35, mult: 2.0, effect: 'bleed', turn: 3, desc: '영혼을 소환해 3턴간 추가 피해' },
            { name: '역병의 안개', mp: 40, type: '자연', mult: 1.5, effect: 'poison', desc: '광역 독 — 모든 독 피해 강화' },
            { name: '혼의 흡수', mp: 30, mult: 1.8, effect: 'drain', desc: '생명 흡수 — 피해의 30% HP 회복' },
            { name: '죽음의 낫', mp: 50, type: '어둠', mult: 2.5, effect: 'curse', desc: 'HP 낮을수록 피해 증가, 저주 부여' },
            { name: '공허의 문', mp: 60, type: 'escape', effect: 'escape_100', desc: '100% 확률로 전투 이탈' },
            // 패시브
            { name: '죽음의 직관', passive: true, effect: 'low_hp_atk', val: 1.3, desc: 'HP 30% 이하 시 ATK 30% 상승 (패시브)' },
            { name: '저주 강화', passive: true, effect: 'curse_amp', val: 1.5, desc: '저주 피해 50% 증가 (패시브)' },
        ],
        skillBranches: {
            '저주의 낙인': [
                { choice: 'A', label: '심화 저주', desc: '데미지 +45%', override: { mult: 2.32 } },
                { choice: 'B', label: '지속 저주', desc: '저주 지속 +2턴', override: { mult: 1.6, curseTurn: 3 } },
            ],
            '죽음의 낫': [
                { choice: 'A', label: '처형의 낫', desc: '피해 배율 3.5배 (폭딜)', override: { mult: 3.5, effect: 'curse' } },
                { choice: 'B', label: '흡혈의 낫', desc: '피해의 35% HP 흡수', override: { mult: 2.5, effect: 'drain' } },
            ],
        },
        next: ['시간술사']
    },

    '시간술사': {
        tier: 3, reqLv: 25, desc: '시간 조작 — 턴을 지배하는 차원의 술사', hpMod: 1.0, mpMod: 2.2, atkMod: 1.9,
        skills: [
            { name: '시간 가속', mp: 40, type: 'buff', effect: 'extraTurn', val: 1.2, turn: 1, desc: '이번 턴 후 추가 행동 획득, ATK 20% 상승' },
            { name: '시간 역행', mp: 50, type: 'buff', effect: 'resetCooldowns', desc: '모든 스킬 쿨타임을 즉시 초기화' },
            { name: '시간 파열', mp: 70, type: '빛', mult: 3.5, desc: '시공간 파열 — 최강의 단일 피해' },
            { name: '시간 결빙', mp: 45, type: '냉기', mult: 2.0, effect: 'freeze', turn: 2, desc: '시간을 얼려 적을 2턴 빙결' },
            { name: '순간 이동', mp: 35, type: 'escape', effect: 'escape_100', desc: '즉시 전투 이탈 — 100% 성공' },
            { name: '인과율 조작', mp: 55, mult: 2.8, crit: 0.5, effect: 'crit_cooldown', desc: '크리 시 모든 쿨타임 -1' },
            { name: '시간 붕괴', mp: 120, type: '어둠', mult: 6.0, crit: 0.7, desc: '궁극기 — 70% 치명타 시공 붕괴' },
            // 패시브
            { name: '시간 감각', passive: true, effect: 'atk_up', val: 15, desc: 'ATK +15 (패시브)' },
            { name: '차원 감지', passive: true, effect: 'mp_up', val: 80, desc: '최대 MP +80 (패시브)' },
        ],
        skillBranches: {
            '시간 가속': [
                { choice: 'A', label: '시간 폭주', desc: '추가 행동 + ATK 40% 상승', override: { effect: 'extraTurn', val: 1.4 } },
                { choice: 'B', label: '시간 충전', desc: '추가 행동 + MP 30 즉시 회복', override: { effect: 'extraTurn', mpRestore: 30 } },
            ],
            '시간 파열': [
                { choice: 'A', label: '시공 소멸', desc: '데미지 4.8배 (순수 폭딜)', override: { mult: 4.8 } },
                { choice: 'B', label: '확정 파열', desc: '치명타 확정', override: { mult: 3.5, crit: 1.0 } },
            ],
        },
        next: []
    },

    '사냥의 군주': {
        tier: 3, reqLv: 60, desc: '자연과 원거리의 지배자', hpMod: 1.4, mpMod: 1.8, atkMod: 2.1,
        skills: [
            { name: '신성 화살비', mp: 60, mult: 5.5, type: '빛', effect: 'stun', desc: '연속 화살 + 기절 부여' },
            { name: '자연의 가호', mp: 70, type: 'buff', effect: 'all_up', val: 2.0, turn: 4, desc: 'ATK/DEF 100% 상승 4턴' },
            { name: '천지의 화살', mp: 160, mult: 9.5, crit: 0.8, desc: '궁극기 — 80% 치명타 대형 화살' },
            { name: '독폭탄', mp: 50, type: '자연', mult: 4.0, effect: 'poison', desc: '강력한 독 폭탄 투척' },
            { name: '바람의 화살', mp: 45, mult: 4.2, crit: 0.6, desc: '바람 속성 60% 치명타 화살' },
            { name: '수호 동물', mp: 55, type: 'buff', effect: 'def_up', val: 1.8, turn: 4, desc: '자연의 정령 소환 DEF 80% 상승 4턴' },
            { name: '대지의 화살', mp: 75, type: '대지', mult: 6.0, effect: 'stun', desc: '대지 속성 기절 + 강력한 피해' },
            // 패시브
            { name: '야생의 본능', passive: true, effect: 'atk_up', val: 18, desc: 'ATK +18 (패시브)' },
            { name: '숲의 수호', passive: true, effect: 'hp_up', val: 120, desc: '최대 HP +120 (패시브)' },
        ],
        next: []
    }
};
