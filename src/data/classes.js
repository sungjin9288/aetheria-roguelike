export const CLASSES = {
    '모험가': {
        tier: 0, desc: '기본 직업', hpMod: 1.0, mpMod: 1.0, atkMod: 1.0,
        skills: [
            { name: '강타', mp: 10, type: '물리', mult: 1.5, desc: '강력한 일격' }
        ],
        next: ['전사', '마법사', '도적']
    },
    '전사': {
        tier: 1, reqLv: 10, desc: '체력/공격 특화', hpMod: 1.4, mpMod: 0.6, atkMod: 1.3,
        skills: [
            { name: '파워배시', mp: 15, mult: 2.0, desc: '강력한 내려찍기' },
            { name: '광폭화', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, turn: 3, desc: 'ATK 50% 상승 3턴' },
            { name: '출혈베기', mp: 25, mult: 1.8, effect: 'bleed', desc: '3턴간 지속 피해' }
        ],
        next: ['나이트', '버서커']
    },
    '마법사': {
        tier: 1, reqLv: 10, desc: '마법 공격 특화', hpMod: 0.7, mpMod: 1.8, atkMod: 1.6,
        skills: [
            { name: '화염구', mp: 20, type: '화염', mult: 2.2, effect: 'burn', desc: '화상 부여' },
            { name: '썬더볼트', mp: 45, type: '빛', mult: 3.5, effect: 'stun', desc: '기절 부여' },
            { name: '아이스볼트', mp: 25, type: '냉기', mult: 2.0, effect: 'freeze', desc: '빙결 부여' }
        ],
        next: ['아크메이지', '흑마법사']
    },
    '도적': {
        tier: 1, reqLv: 10, desc: '치명타/속도', hpMod: 1.0, mpMod: 1.0, atkMod: 1.4,
        skills: [
            { name: '급소찌르기', mp: 15, mult: 1.8, crit: 0.5, desc: '50% 치명타 확률' },
            { name: '독바르기', mp: 25, type: '자연', mult: 1.5, effect: 'poison', desc: '독 부여' },
            { name: '연막탄', mp: 20, type: 'debuff', effect: 'blind', turn: 2, desc: '적 명중률 하락' }
        ],
        next: ['어쌔신', '레인저']
    },
    '나이트': {
        tier: 2, reqLv: 30, desc: '철벽의 방어', hpMod: 2.0, mpMod: 0.8, atkMod: 1.5,
        skills: [
            { name: '실드배시', mp: 20, mult: 2.5, effect: 'stun', desc: '기절 부여' },
            { name: '절대방어', mp: 50, type: 'buff', effect: 'def_up', val: 2.0, turn: 5, desc: 'DEF 100% 상승' },
            { name: '신성한 심판', mp: 80, type: '빛', mult: 5.0, effect: 'purify', desc: '궁극기: 신성 피해' },
            { name: '도발', mp: 30, type: 'debuff', effect: 'taunt', turn: 3, desc: '적 공격 집중' }
        ],
        next: []
    },
    '버서커': {
        tier: 2, reqLv: 30, desc: '광란의 공격', hpMod: 1.6, mpMod: 0.5, atkMod: 2.0,
        skills: [
            { name: '휠윈드', mp: 30, mult: 3.0, desc: '회전 공격' },
            { name: '피의갈망', mp: 60, type: 'buff', effect: 'berserk', val: 2.5, turn: 3, desc: 'ATK 150% / DEF 감소' },
            { name: '대지 분쇄', mp: 80, type: '대지', mult: 5.5, effect: 'stun', desc: '궁극기: 기절 부여' },
            { name: '출혈 광란', mp: 50, mult: 3.5, effect: 'bleed', desc: '강력한 출혈' }
        ],
        next: []
    },
    '아크메이지': {
        tier: 2, reqLv: 30, desc: '원소의 지배자', hpMod: 0.8, mpMod: 2.5, atkMod: 2.2,
        skills: [
            { name: '메테오', mp: 60, type: '화염', mult: 4.5, effect: 'burn', desc: '화상 부여' },
            { name: '블리자드', mp: 60, type: '냉기', mult: 4.0, effect: 'freeze', desc: '빙결 부여' },
            { name: '천벌', mp: 100, type: '빛', mult: 6.0, effect: 'purify', desc: '궁극기: 신성 피해' },
            { name: '마나 폭발', mp: 80, mult: 5.0, desc: '순수 마력 폭발' }
        ],
        next: []
    },
    '흑마법사': {
        tier: 2, reqLv: 30, desc: '어둠의 계약', hpMod: 0.9, mpMod: 2.0, atkMod: 2.0,
        skills: [
            { name: '다크메터', mp: 50, type: '어둠', mult: 4.0, effect: 'curse', desc: '저주 부여' },
            { name: '생명흡수', mp: 40, mult: 3.0, effect: 'drain', desc: 'HP 흡수' },
            { name: '영혼 파괴', mp: 100, type: '어둠', mult: 6.5, effect: 'curse', desc: '궁극기: 강력한 저주' },
            { name: '공포', mp: 35, type: 'debuff', effect: 'fear', turn: 2, desc: '적 ATK 감소' }
        ],
        next: []
    },
    '어쌔신': {
        tier: 2, reqLv: 30, desc: '일격필살', hpMod: 1.1, mpMod: 1.2, atkMod: 1.9,
        skills: [
            { name: '암살', mp: 40, mult: 5.0, crit: 0.8, desc: '80% 치명타 확률' },
            { name: '은신', mp: 30, type: 'buff', effect: 'stealth', val: 2.0, turn: 2, desc: '회피 증가' },
            { name: '그림자 일섬', mp: 100, type: '어둠', mult: 7.0, crit: 1.0, desc: '궁극기: 100% 치명타' },
            { name: '치명 독', mp: 50, type: '자연', mult: 3.0, effect: 'poison', desc: '강력한 독' }
        ],
        next: []
    },
    '레인저': {
        tier: 2, reqLv: 30, desc: '원거리 명사수', hpMod: 1.2, mpMod: 1.5, atkMod: 1.7,
        skills: [
            { name: '연속사격', mp: 35, mult: 3.5, desc: '다중 공격' },
            { name: '폭발화살', mp: 45, type: '화염', mult: 3.8, effect: 'burn', desc: '화상 부여' },
            { name: '저격', mp: 100, mult: 8.0, crit: 0.7, desc: '궁극기: 70% 치명타' },
            { name: '빙결 화살', mp: 40, type: '냉기', mult: 3.2, effect: 'freeze', desc: '빙결 부여' }
        ],
        next: []
    }
};
