export const QUESTS = [
    // 초반 퀘스트 (Lv 1-10)
    { id: 1, title: '슬라임 소탕', desc: '슬라임 3마리 처치', target: '슬라임', goal: 3, reward: { exp: 50, gold: 100 }, minLv: 1 },
    { id: 2, title: '멧돼지 사냥', desc: '멧돼지 5마리 처치', target: '멧돼지', goal: 5, reward: { exp: 80, gold: 150 }, minLv: 2 },
    { id: 3, title: '광산의 위협', desc: '코볼트 5마리 처치', target: '코볼트', goal: 5, reward: { exp: 300, gold: 500, item: '강철 롱소드' }, minLv: 3 },
    { id: 4, title: '숲의 해충', desc: '거미떼 8마리 처치', target: '거미떼', goal: 8, reward: { exp: 200, gold: 250, item: '해독제' }, minLv: 3 },
    { id: 5, title: '호수의 수호자', desc: '물의 정령 5마리 처치', target: '물의 정령', goal: 5, reward: { exp: 350, gold: 400, item: '마나 결정' }, minLv: 5 },
    { id: 6, title: '폐허 탐험', desc: '해골 병사 10마리 처치', target: '해골 병사', goal: 10, reward: { exp: 500, gold: 600 }, minLv: 5 },
    { id: 7, title: '광산 정화', desc: '광석골렘 5마리 처치', target: '광석골렘', goal: 5, reward: { exp: 600, gold: 700, item: '미스릴 원석' }, minLv: 8 },
    { id: 10, title: '전직의 자격 (1차)', desc: '1차 전직을 위해 레벨 10 달성', target: 'Level', goal: 10, reward: { exp: 0, gold: 1000 }, minLv: 9 },
    // 중반 퀘스트 (Lv 10-25)
    { id: 11, title: '동굴 트롤 토벌', desc: '동굴 트롤 5마리 처치', target: '동굴 트롤', goal: 5, reward: { exp: 800, gold: 1000, item: '전투도끼' }, minLv: 10 },
    { id: 12, title: '사막의 무법자', desc: '사막도적 10마리 처치', target: '사막도적', goal: 10, reward: { exp: 1000, gold: 1500, item: '암살자의 단검' }, minLv: 15 },
    { id: 13, title: '화염의 시련', desc: '화염 정령 10마리 처치', target: '화염 정령', goal: 10, reward: { exp: 1200, gold: 1800, item: '화염의 결정' }, minLv: 15 },
    { id: 14, title: '피라미드의 비밀', desc: '미라 15마리 처치', target: '미라', goal: 15, reward: { exp: 1500, gold: 2000, item: '저주해제 주문서' }, minLv: 20 },
    { id: 15, title: '얼음 성채 정복', desc: '얼음 거인 5마리 처치', target: '얼음 거인', goal: 5, reward: { exp: 2000, gold: 2500, item: '냉기의 결정' }, minLv: 20 },
    // 고급 퀘스트 (Lv 25-40)
    { id: 20, title: '용의 둥지 습격', desc: '레드 드래곤 처치', target: '레드 드래곤', goal: 1, reward: { exp: 5000, gold: 8000, item: '용의 심장' }, minLv: 25 },
    { id: 21, title: '빙결의 마녀 토벌', desc: '빙결의 마녀 처치', target: '빙결의 마녀', goal: 1, reward: { exp: 6000, gold: 10000, item: '현자의 예복' }, minLv: 30 },
    { id: 22, title: '암흑 성 침공', desc: '데스나이트 10마리 처치', target: '데스나이트', goal: 10, reward: { exp: 4000, gold: 6000, item: '암흑의 대검' }, minLv: 30 },
    { id: 23, title: '리치 처단', desc: '리치 처치', target: '리치', goal: 1, reward: { exp: 7000, gold: 12000, item: '혼돈의 지팡이' }, minLv: 35 },
    { id: 30, title: '영웅의 길 (2차)', desc: '2차 전직을 위해 레벨 30 달성', target: 'Level', goal: 30, reward: { exp: 0, gold: 5000 }, minLv: 29 },
    // 최종 퀘스트 (Lv 40+)
    { id: 40, title: '마왕의 사도 척결', desc: '마왕의 사도 10마리 처치', target: '마왕의 사도', goal: 10, reward: { exp: 8000, gold: 15000 }, minLv: 40 },
    { id: 41, title: '타락한 천사', desc: '타락한 천사 처치', target: '타락한 천사', goal: 1, reward: { exp: 10000, gold: 20000, item: '천상의갑주' }, minLv: 45 },
    { id: 50, title: '기계 폐도 봉쇄', desc: '강철 자동인형 12마리 처치', target: '강철 자동인형', goal: 12, reward: { exp: 12000, gold: 18000, item: '기계 코어' }, minLv: 30 },
    { id: 51, title: '천공의 균열', desc: '성운 감시자 8마리 처치', target: '성운 감시자', goal: 8, reward: { exp: 15000, gold: 22000, item: '천공 결정' }, minLv: 36 },
    { id: 52, title: '심해 추락자', desc: '심연 크라켄 처치', target: '심연 크라켄', goal: 1, reward: { exp: 18000, gold: 26000, item: '청해 단검' }, minLv: 42 },
    { id: 53, title: '에테르 붕괴 저지', desc: '차원 파쇄자 처치', target: '차원 파쇄자', goal: 1, reward: { exp: 22000, gold: 32000, item: '심연 파쇄창' }, minLv: 50 },
    { id: 54, title: '영겁의 문', desc: '영겁의 수문장 처치', target: '영겁의 수문장', goal: 1, reward: { exp: 24000, gold: 35000, item: '성광 방벽' }, minLv: 52 },
    { id: 55, title: '천공의 계승자', desc: '에테르 드래곤 처치', target: '에테르 드래곤', goal: 1, reward: { exp: 30000, gold: 42000, item: '에테르 세이버' }, minLv: 55 },
    { id: 99, title: '마왕 토벌', desc: '최종 보스 마왕 처치', target: '마왕', goal: 1, reward: { exp: 50000, gold: 99999, item: '성검 에테르니아' }, minLv: 50 }
];

export const ACHIEVEMENTS = [
    { id: 'ach_first_blood', title: '첫 번째 피', desc: '첫 전투 승리', target: 'kills', goal: 1, reward: { gold: 50 } },
    { id: 'ach_kill_10', title: '초보 사냥꾼', desc: '몬스터 10마리 처치', target: 'kills', goal: 10, reward: { gold: 200 } },
    { id: 'ach_kill_50', title: '학살자', desc: '몬스터 50마리 처치', target: 'kills', goal: 50, reward: { gold: 500 } },
    { id: 'ach_kill_100', title: '전장의 신', desc: '몬스터 100마리 처치', target: 'kills', goal: 100, reward: { gold: 2000, item: '중급 체력 물약' } },
    { id: 'ach_boss_first', title: '용사의 증명', desc: '보스 몬스터 첫 처치', target: 'bossKills', goal: 1, reward: { gold: 1000 } },
    { id: 'ach_gold_1000', title: '저축왕', desc: '누적 골드 1000G 달성', target: 'total_gold', goal: 1000, reward: { item: '하급 체력 물약' } },
    { id: 'ach_gold_10000', title: '갑부', desc: '누적 골드 10000G 달성', target: 'total_gold', goal: 10000, reward: { item: '엘릭서' } },
    { id: 'ach_lv_10', title: '성장의 기쁨', desc: '레벨 10 달성', target: 'level', goal: 10, reward: { item: '강철 롱소드' } },
    { id: 'ach_die_1', title: '죽음은 또 다른 시작', desc: '최초 사망 달성', target: 'deaths', goal: 1, reward: { gold: 100 } },
    { id: 'ach_die_10', title: '불사조의 환생', desc: '10번 사망 후 재기', target: 'deaths', goal: 10, reward: { gold: 300 } }
];
