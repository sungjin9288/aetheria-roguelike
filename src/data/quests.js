export const QUESTS = [
    // ── 초반 퀘스트 (Lv 1-10) ────────────────────────────────────────────────
    { id: 1,  title: '슬라임 소탕',      desc: '슬라임 3마리 처치',       target: '슬라임',      goal: 3,  reward: { exp: 50,   gold: 100 },           minLv: 1 },
    { id: 2,  title: '멧돼지 사냥',      desc: '멧돼지 5마리 처치',       target: '멧돼지',      goal: 5,  reward: { exp: 80,   gold: 150 },           minLv: 2 },
    { id: 3,  title: '광산의 위협',      desc: '코볼트 5마리 처치',       target: '코볼트',      goal: 5,  reward: { exp: 300,  gold: 500,  item: '강철 롱소드' }, minLv: 3 },
    { id: 4,  title: '숲의 해충',        desc: '거미떼 8마리 처치',       target: '거미떼',      goal: 8,  reward: { exp: 200,  gold: 250,  item: '해독제' },      minLv: 3 },
    { id: 5,  title: '호수의 수호자',    desc: '물의 정령 5마리 처치',    target: '물의 정령',   goal: 5,  reward: { exp: 350,  gold: 400,  item: '마나 결정' },   minLv: 5 },
    { id: 6,  title: '폐허 탐험',        desc: '해골 병사 10마리 처치',   target: '해골 병사',   goal: 10, reward: { exp: 500,  gold: 600 },           minLv: 5 },
    { id: 7,  title: '광산 정화',        desc: '광석골렘 5마리 처치',     target: '광석골렘',    goal: 5,  reward: { exp: 600,  gold: 700,  item: '미스릴 원석' }, minLv: 8 },
    { id: 8,  title: '늑대 무리 토벌',   desc: '늑대 8마리 처치',         target: '늑대',        goal: 8,  reward: { exp: 150,  gold: 200 },           minLv: 2 },
    { id: 9,  title: '들개 퇴치',        desc: '들개 6마리 처치',         target: '들개',        goal: 6,  reward: { exp: 120,  gold: 180 },           minLv: 3 },
    { id: 10, title: '전직의 자격 (1차)',desc: '레벨 5 달성',             target: 'Level',       goal: 5,  reward: { exp: 0,    gold: 1000 },          minLv: 4 },
    { id: 14, title: '독버섯 제거',      desc: '독버섯 10마리 처치',      target: '독버섯',      goal: 10, reward: { exp: 180,  gold: 220,  item: '해독제' },      minLv: 2 },
    { id: 15, title: '거대 벌레 퇴치',   desc: '거대 사슴벌레 5마리',     target: '거대 사슴벌레', goal: 5, reward: { exp: 200, gold: 280 },            minLv: 3 },
    { id: 16, title: '숲 요정의 위협',   desc: '숲 요정 8마리 처치',      target: '숲 요정',     goal: 8,  reward: { exp: 280,  gold: 350,  item: '요정의 날개' }, minLv: 4 },
    { id: 17, title: '평원 정화',        desc: '평원 도적 5마리 처치',    target: '평원 도적',   goal: 5,  reward: { exp: 250,  gold: 320 },           minLv: 4 },
    { id: 18, title: '호수 님프 조사',   desc: '수련 님프 6마리 처치',    target: '수련 님프',   goal: 6,  reward: { exp: 300,  gold: 400 },           minLv: 5 },

    // ── 중반 퀘스트 (Lv 10-25) ───────────────────────────────────────────────
    { id: 11, title: '동굴 트롤 토벌',   desc: '동굴 트롤 5마리 처치',    target: '동굴 트롤',   goal: 5,  reward: { exp: 800,  gold: 1000, item: '전투도끼' },    minLv: 10 },
    { id: 12, title: '사막의 무법자',    desc: '사막도적 10마리 처치',    target: '사막도적',    goal: 10, reward: { exp: 1000, gold: 1500, item: '암살자의 단검' },minLv: 15 },
    { id: 13, title: '화염의 시련',      desc: '화염 정령 10마리 처치',   target: '화염 정령',   goal: 10, reward: { exp: 1200, gold: 1800, item: '화염의 결정' }, minLv: 15 },
    { id: 19, title: '고블린 소탕',      desc: '고블린 12마리 처치',      target: '고블린',      goal: 12, reward: { exp: 700,  gold: 900 },            minLv: 6 },
    { id: 20, title: '석상의 비밀',      desc: '석상 가디언 4마리 처치',  target: '석상 가디언', goal: 4,  reward: { exp: 900,  gold: 1100 },           minLv: 8 },
    { id: 21, title: '폐허 구울 처치',   desc: '폐허 구울 8마리 처치',    target: '폐허 구울',   goal: 8,  reward: { exp: 850,  gold: 1000 },           minLv: 7 },
    { id: 22, title: '다크 엘프 추적',   desc: '다크 엘프 6마리 처치',    target: '다크 엘프',   goal: 6,  reward: { exp: 1100, gold: 1300, item: '엘프의 단검' }, minLv: 12 },
    { id: 23, title: '박쥐 퇴치',        desc: '광산 박쥐 15마리 처치',   target: '광산 박쥐',   goal: 15, reward: { exp: 600,  gold: 700 },            minLv: 8 },
    { id: 24, title: '수정 정령 채집',   desc: '결정 정령 8마리 처치',    target: '결정 정령',   goal: 8,  reward: { exp: 900,  gold: 1200, item: '수정 조각' },   minLv: 12 },
    { id: 25, title: '화염 사원 조사',   desc: '화염 사제 6마리 처치',    target: '화염 사제',   goal: 6,  reward: { exp: 1300, gold: 1600, item: '불의 정수' },   minLv: 18 },
    { id: 26, title: '피라미드의 비밀',  desc: '미라 15마리 처치',        target: '미라',        goal: 15, reward: { exp: 1500, gold: 2000, item: '저주해제 주문서' }, minLv: 20 },
    { id: 27, title: '얼음 성채 정복',   desc: '얼음 거인 5마리 처치',    target: '얼음 거인',   goal: 5,  reward: { exp: 2000, gold: 2500, item: '냉기의 결정' }, minLv: 20 },
    { id: 28, title: '설원 수호자',      desc: '서리 늑대 10마리 처치',   target: '서리 늑대',   goal: 10, reward: { exp: 1800, gold: 2200 },            minLv: 22 },
    { id: 135, title: '사막 도적단 소탕', desc: '사막 도적 8마리 처치',    target: '사막 도적',   goal: 8,  reward: { exp: 2000, gold: 2600, item: '도적의 망토' },  minLv: 23 },
    { id: 136, title: '고대 유적 탐사',   desc: '고대 골렘 6마리 처치',    target: '고대 골렘',   goal: 6,  reward: { exp: 2400, gold: 3000, item: '고대의 파편' },  minLv: 25 },
    { id: 137, title: '보물고 침입자',    desc: '보물고 수호자 5마리 처치', target: '보물고 수호자', goal: 5, reward: { exp: 2600, gold: 3500, item: '황금 열쇠' },   minLv: 26 },
    { id: 29, title: '탑 수호자 격파',   desc: '탑 수호자 5마리 처치',    target: '탑 수호자',   goal: 5,  reward: { exp: 2200, gold: 2800, item: '마법사의 로브' }, minLv: 25 },
    { id: 30, title: '영웅의 길 (2차)',  desc: '레벨 30 달성',           target: 'Level',       goal: 30, reward: { exp: 0,    gold: 5000 },            minLv: 29 },

    // ── 고급 퀘스트 (Lv 25-40) ───────────────────────────────────────────────
    { id: 31, title: '용의 둥지 습격',   desc: '레드 드래곤 처치',        target: '레드 드래곤', goal: 1,  reward: { exp: 5000,  gold: 8000,  item: '용의 심장' },  minLv: 25 },
    { id: 32, title: '빙결의 마녀 토벌', desc: '빙결의 마녀 처치',        target: '빙결의 마녀', goal: 1,  reward: { exp: 6000,  gold: 10000, item: '현자의 예복' }, minLv: 30 },
    { id: 33, title: '암흑 성 침공',     desc: '데스나이트 10마리 처치',  target: '데스나이트',  goal: 10, reward: { exp: 4000,  gold: 6000,  item: '암흑의 대검' }, minLv: 30 },
    { id: 34, title: '리치 처단',        desc: '리치 처치',               target: '리치',        goal: 1,  reward: { exp: 7000,  gold: 12000, item: '혼돈의 지팡이' }, minLv: 35 },
    { id: 35, title: '뱀파이어 박멸',    desc: '뱀파이어 5마리 처치',     target: '뱀파이어',    goal: 5,  reward: { exp: 5500,  gold: 7500 },            minLv: 32 },
    { id: 36, title: '감옥 해방',        desc: '고문관 8마리 처치',       target: '고문관',      goal: 8,  reward: { exp: 4500,  gold: 6500,  item: '강인함의 증표' }, minLv: 33 },
    { id: 37, title: '타락 기사 토벌',   desc: '타락 기사 5마리 처치',    target: '타락 기사',   goal: 5,  reward: { exp: 5000,  gold: 7000 },            minLv: 34 },
    { id: 38, title: '기계 폐도 봉쇄',   desc: '강철 자동인형 12마리 처치', target: '강철 자동인형', goal: 12, reward: { exp: 12000, gold: 18000, item: '기계 코어' }, minLv: 30 },
    { id: 39, title: '전류 추적자 격파', desc: '전류 추적자 10마리 처치', target: '전류 추적자', goal: 10, reward: { exp: 10000, gold: 14000 },           minLv: 30 },

    // ── 최종 퀘스트 (Lv 40+) ─────────────────────────────────────────────────
    { id: 40, title: '마왕의 사도 척결',  desc: '마왕의 사도 10마리 처치', target: '마왕의 사도', goal: 10, reward: { exp: 8000,  gold: 15000 },           minLv: 40 },
    { id: 41, title: '타락한 천사',       desc: '타락한 천사 처치',        target: '타락한 천사', goal: 1,  reward: { exp: 10000, gold: 20000, item: '천상의갑주' }, minLv: 45 },
    { id: 42, title: '천공의 균열',       desc: '성운 감시자 8마리 처치',  target: '성운 감시자', goal: 8,  reward: { exp: 15000, gold: 22000, item: '천공 결정' }, minLv: 36 },
    { id: 43, title: '심해 추락자',       desc: '심연 크라켄 처치',        target: '심연 크라켄', goal: 1,  reward: { exp: 18000, gold: 26000, item: '청해 단검' }, minLv: 42 },
    { id: 44, title: '에테르 붕괴 저지',  desc: '차원 파쇄자 처치',        target: '차원 파쇄자', goal: 1,  reward: { exp: 22000, gold: 32000, item: '심연 파쇄창' }, minLv: 50 },
    { id: 45, title: '영겁의 문',         desc: '영겁의 수문장 처치',      target: '영겁의 수문장', goal: 1, reward: { exp: 24000, gold: 35000, item: '성광 방벽' }, minLv: 52 },
    { id: 46, title: '천공의 계승자',     desc: '에테르 드래곤 처치',      target: '에테르 드래곤', goal: 1, reward: { exp: 30000, gold: 42000, item: '에테르 세이버' }, minLv: 55 },
    { id: 47, title: '차원 마왕 격파',    desc: '차원 마왕 처치',          target: '차원 마왕',   goal: 1,  reward: { exp: 35000, gold: 50000, item: '차원의 단편' }, minLv: 58 },
    { id: 99, title: '마왕 토벌',         desc: '최종 보스 마왕 처치',     target: '마왕',        goal: 1,  reward: { exp: 50000, gold: 99999, item: '성검 에테르니아' }, minLv: 50 },

    // ── 추가 킬 퀘스트 (전용 몬스터) ───────────────────────────────────────
    // 초반 (Lv 1-10)
    { id: 110, title: '거미떼 퇴치',            desc: '숲을 위협하는 거미떼를 처치하세요',                target: '거미떼',        goal: 10, reward: { exp: 200,   gold: 500 },                          minLv: 1 },
    { id: 111, title: '멧돼지 사냥 (대규모)',    desc: '평원의 멧돼지를 대규모로 사냥하세요',             target: '멧돼지',        goal: 8,  reward: { exp: 250,   gold: 600 },                          minLv: 3 },
    { id: 112, title: '머맨 토벌',              desc: '호수에 출몰하는 머맨을 처치하세요',               target: '머맨',          goal: 8,  reward: { exp: 300,   gold: 700 },                          minLv: 5 },
    { id: 113, title: '유령 기사 퇴치',         desc: '폐허를 떠도는 유령 기사를 처치하세요',            target: '유령 기사',     goal: 6,  reward: { exp: 350,   gold: 800 },                          minLv: 5 },
    { id: 114, title: '광석 골렘 파괴',         desc: '광산의 광석 골렘을 파괴하세요',                   target: '광석골렘',      goal: 8,  reward: { exp: 400,   gold: 900 },                          minLv: 8 },

    // 중반 (Lv 10-25)
    { id: 115, title: '수정 골렘 정화',         desc: '동굴의 수정 골렘을 정화하세요',                   target: '수정 골렘',     goal: 10, reward: { exp: 600,   gold: 1200 },                         minLv: 12 },
    { id: 116, title: '동굴 트롤 소탕',         desc: '어둠의 동굴에서 트롤을 소탕하세요',               target: '동굴 트롤',     goal: 8,  reward: { exp: 700,   gold: 1500 },                         minLv: 10 },
    { id: 117, title: '암흑 마법사 처단',       desc: '위험한 암흑 마법사를 처단하세요',                 target: '암흑 마법사',   goal: 6,  reward: { exp: 800,   gold: 1800 },                         minLv: 10 },
    { id: 118, title: '화염 정령 소멸',         desc: '화염의 협곡에서 화염 정령을 소멸시키세요',         target: '화염 정령',     goal: 10, reward: { exp: 900,   gold: 2000 },                         minLv: 15 },
    { id: 119, title: '하피 격퇴',              desc: '고원의 하피를 격퇴하세요',                        target: '광풍의 하피',   goal: 8,  reward: { exp: 750,   gold: 1600 },                         minLv: 14 },
    { id: 120, title: '그리핀 사냥',            desc: '고원의 그리핀을 사냥하세요',                      target: '고원 그리핀',   goal: 5,  reward: { exp: 1000,  gold: 2200 },                         minLv: 14 },
    { id: 121, title: '하수도 악어 퇴치',       desc: '하수도의 거대 악어를 퇴치하세요',                 target: '하수도 악어',   goal: 10, reward: { exp: 650,   gold: 1400 },                         minLv: 10 },

    // 고급 (Lv 25-40)
    { id: 122, title: '빙결 정령 파괴',         desc: '얼음 성채의 빙결 정령을 파괴하세요',              target: '빙결 정령',     goal: 12, reward: { exp: 1500,  gold: 3000 },                         minLv: 25 },
    { id: 123, title: '미라 토벌',              desc: '피라미드의 미라를 토벌하세요',                    target: '미라',          goal: 10, reward: { exp: 1800,  gold: 3500 },                         minLv: 25 },
    { id: 124, title: '강철 자동인형 해체',     desc: '기계 폐도의 자동인형을 해체하세요',               target: '강철 자동인형', goal: 10, reward: { exp: 2000,  gold: 4000 },                         minLv: 30 },
    { id: 125, title: '가고일 격파',            desc: '고대 마법 탑의 가고일을 격파하세요',              target: '가고일',        goal: 8,  reward: { exp: 1900,  gold: 3800 },                         minLv: 28 },
    { id: 126, title: '그림자 암살자 추적',     desc: '암흑 성에 숨어있는 암살자를 추적 처치하세요',      target: '그림자 암살자', goal: 6,  reward: { exp: 2500,  gold: 5000,  item: '암살자의 단검' }, minLv: 35 },

    // 최종 (Lv 40+)
    { id: 127, title: '심해 대사 처치',         desc: '심해 회랑의 거대 뱀을 처치하세요',                target: '심해 대사',     goal: 8,  reward: { exp: 4000,  gold: 8000 },                         minLv: 40 },
    { id: 128, title: '에테르 골렘 분쇄',       desc: '에테르 관문의 골렘을 분쇄하세요',                 target: '에테르 골렘',   goal: 6,  reward: { exp: 5000,  gold: 10000 },                        minLv: 45 },
    { id: 129, title: '차원 보행자 소멸',       desc: '차원의 틈새에서 나타나는 보행자를 소멸시키세요',    target: '차원 보행자',   goal: 5,  reward: { exp: 6000,  gold: 12000 },                        minLv: 45 },
    { id: 130, title: '리치 재토벌',            desc: '되살아난 리치를 다시 한번 처치하세요',             target: '리치',          goal: 3,  reward: { exp: 7000,  gold: 15000, item: '혼돈의 로드' },   minLv: 40 },
    { id: 131, title: '죽음의 기사 토벌',       desc: '마왕성의 죽음의 기사를 토벌하세요',               target: '죽음의 기사',   goal: 5,  reward: { exp: 4500,  gold: 9000 },                         minLv: 42 },

    // 보스 챌린지
    { id: 132, title: '[보스] 하수도 여왕 처치',      desc: '하수도의 여왕을 처치하세요',       target: '하수도의 여왕',     goal: 1, reward: { exp: 2000,  gold: 3000 },                         minLv: 10 },
    { id: 133, title: '[보스] 전초기지 사령관 격파',  desc: '전초기지 사령관을 격파하세요',     target: '전초기지 사령관',   goal: 1, reward: { exp: 3000,  gold: 5000 },                         minLv: 18 },
    { id: 134, title: '[보스] 기계 장군 파괴',        desc: '기계 폐도의 장군을 파괴하세요',   target: '기계 장군',         goal: 1, reward: { exp: 6000,  gold: 12000, item: '부서진 기어' },  minLv: 35 },

    // ── 직업/빌드 특화 퀘스트 ────────────────────────────────────────────────
    { id: 60, title: '대장장이의 의뢰',      type: 'craft',           desc: '아이템 3개 제작',              target: 'crafts',             goal: 3,  reward: { exp: 3000,  gold: 5000,  item: '강화 재료' }, minLv: 10 },
    { id: 61, title: '탐험가의 기록',        type: 'explore_count',   desc: '20번 탐색',                    target: 'explores',           goal: 20, reward: { exp: 5000,  gold: 3000 }, minLv: 5 },
    { id: 62, title: '생존의 의지',          type: 'survive_low_hp',  desc: 'HP 20% 이하에서 승리 5회',     target: 'lowHpWins',          threshold: 0.2, goal: 5, reward: { exp: 8000, gold: 6000, item: '생존자의 반지' }, minLv: 15 },
    { id: 63, title: '맨몸의 용사',          type: 'survive_low_hp',  desc: 'HP 10% 이하에서 승리 3회',     target: 'lowHpWins',          threshold: 0.1, goal: 3, reward: { exp: 12000, gold: 10000, item: '투사의 증표' }, minLv: 25 },
    { id: 64, title: '황금 수집가',          type: 'explore_count',   desc: '50번 탐색',                    target: 'explores',           goal: 50, reward: { exp: 10000, gold: 15000 }, minLv: 20 },
    { id: 65, title: '장인의 길',            type: 'craft',           desc: '아이템 10개 제작',             target: 'crafts',             goal: 10, reward: { exp: 15000, gold: 20000, item: '장인의 도구' }, minLv: 25 },
    { id: 66, title: '현상금 사냥꾼',        type: 'bounty_count',    desc: '현상수배 5건 완료',            target: 'bountiesCompleted',  goal: 5,  reward: { exp: 10000, gold: 15000 }, minLv: 10 },
    { id: 67, title: '전설의 사냥꾼',        type: 'bounty_count',    desc: '현상수배 15건 완료',           target: 'bountiesCompleted',  goal: 15, reward: { exp: 25000, gold: 40000, item: '현상금 사냥꾼의 망토' }, minLv: 25 },
    { id: 68, title: '파쇄 전술 훈련',       type: 'build_victory',   buildTag: 'crusher',  buildLabel: '양손 파쇄',  desc: '양손 파쇄 운영으로 전투 4회 승리', objective: '양손 파쇄 축으로 전투 승리 4회', target: 'crusher', goal: 4, reward: { exp: 7000, gold: 8500 }, minLv: 8 },
    { id: 69, title: '연계 추격 실습',       type: 'build_victory',   buildTag: 'dual',     buildLabel: '쌍수 연격',  desc: '쌍수 연격 운영으로 전투 5회 승리', objective: '쌍수 연격 축으로 전투 승리 5회', target: 'dual', goal: 5, reward: { exp: 8500, gold: 9000 }, minLv: 10 },
    { id: 70, title: '방벽 유지 규율',       type: 'build_victory',   buildTag: 'fortress', buildLabel: '방패 요새',  desc: '방패 요새 운영으로 전투 4회 승리', objective: '방패 요새 축으로 전투 승리 4회', target: 'fortress', goal: 4, reward: { exp: 9000, gold: 9500 }, minLv: 12 },
    { id: 71, title: '비전 공명 관측',       type: 'build_victory',   buildTag: 'arcane',   buildLabel: '비전 공명',  desc: '비전 공명 운영으로 전투 4회 승리', objective: '비전 공명 축으로 전투 승리 4회', target: 'arcane', goal: 4, reward: { exp: 9500, gold: 10000 }, minLv: 12 },
    { id: 72, title: '개척자의 현장 기록',   type: 'discovery_count', buildTag: 'explorer', buildLabel: '탐험 수집가', desc: '탐험 발견 6회 달성', objective: '탐험 발견 6회 달성', target: 'discoveries', goal: 6, reward: { exp: 10000, gold: 11000 }, minLv: 10 },
    { id: 73, title: '마스터 크래프터',      type: 'craft',           desc: '아이템 25개 제작',             target: 'crafts',             goal: 25, reward: { exp: 30000, gold: 40000, item: '전설의 장인 도구' }, minLv: 40 },
    { id: 74, title: '탐험의 극한',          type: 'explore_count',   desc: '100번 탐색',                   target: 'explores',           goal: 100, reward: { exp: 20000, gold: 30000 }, minLv: 30 },
    { id: 75, title: '전설의 경계인',        type: 'survive_low_hp',  desc: 'HP 5% 이하에서 승리 1회',      target: 'lowHpWins',          threshold: 0.05, goal: 1, reward: { exp: 20000, gold: 25000, item: '기적의 부적' }, minLv: 35 },
    { id: 76, title: '끝없는 현상금',        type: 'bounty_count',    desc: '현상수배 30건 완료',           target: 'bountiesCompleted',  goal: 30, reward: { exp: 50000, gold: 80000, item: '전설 현상수배 증표' }, minLv: 40 },

    // ── 스토리 퀘스트 ─────────────────────────────────────────────────────────
    { id: 80, title: '[스토리] 첫 번째 여정', desc: '고요한 숲을 처음 탐험한다',      type: 'explore_count', target: 'explores', goal: 1,  reward: { exp: 100, gold: 200 },            minLv: 1 },
    { id: 81, title: '[스토리] 폐허의 진실',  desc: '잊혀진 폐허에서 10번 탐험',      type: 'explore_count', target: 'explores', goal: 10, reward: { exp: 2000, gold: 2000 },           minLv: 5 },
    { id: 82, title: '[스토리] 불꽃의 시험',  desc: '화염의 협곡에서 화염 정령 처치', target: '화염 정령',   goal: 5,  reward: { exp: 3000, gold: 3000, item: '불의 시험 증표' }, minLv: 15 },
    { id: 83, title: '[스토리] 얼음의 저주',  desc: '빙결의 마녀의 정체를 밝혀라',    target: '빙결의 마녀', goal: 1,  reward: { exp: 8000, gold: 8000, item: '해방의 빙정' },    minLv: 30 },
    { id: 84, title: '[스토리] 기계의 심장',  desc: '기계 폐도의 진실을 파헤쳐라',    target: '증기 골렘',   goal: 10, reward: { exp: 12000, gold: 15000, item: '기계 문명의 유산' }, minLv: 28 },
    { id: 85, title: '[스토리] 어둠의 근원',  desc: '마왕의 사도를 통해 마왕의 계획을 알아라', target: '마왕의 사도', goal: 5, reward: { exp: 15000, gold: 18000 }, minLv: 40 },
    { id: 86, title: '[스토리] 에테르의 균열', desc: '에테르 관문의 균열을 조사하라', target: '에테르 파편체', goal: 10, reward: { exp: 20000, gold: 25000, item: '에테르 탐사 보고서' }, minLv: 50 },
    { id: 87, title: '[스토리] 세계의 끝',    desc: '마왕을 쓰러뜨리고 세계를 구하라', target: '마왕',      goal: 1,  reward: { exp: 100000, gold: 100000, item: '영웅의 훈장' }, minLv: 50 },

    // ── 반복/수집 퀘스트 ─────────────────────────────────────────────────────
    { id: 90, title: '몬스터 100격파',   desc: '누적 몬스터 100마리 처치', type: 'explore_count', target: 'kills',  goal: 100,  reward: { exp: 5000,  gold: 10000 },           minLv: 10 },
    { id: 91, title: '몬스터 500격파',   desc: '누적 몬스터 500마리 처치', type: 'explore_count', target: 'kills',  goal: 500,  reward: { exp: 20000, gold: 30000, item: '전사의 훈장' }, minLv: 25 },
    { id: 92, title: '몬스터 1000격파',  desc: '누적 몬스터 1000마리 처치', type: 'explore_count', target: 'kills', goal: 1000, reward: { exp: 50000, gold: 80000, item: '학살자의 칭호증' }, minLv: 40 },
    { id: 93, title: '보스 사냥꾼',      desc: '보스 몬스터 10회 처치',    type: 'explore_count', target: 'bossKills', goal: 10, reward: { exp: 30000, gold: 50000, item: '보스 사냥꾼 증표' }, minLv: 25 },
    { id: 94, title: '제작 마스터',      type: 'craft', desc: '총 50회 제작',  target: 'crafts', goal: 50, reward: { exp: 60000, gold: 80000, item: '전설 레시피' }, minLv: 50 },
    { id: 95, title: '세계 탐험가',      type: 'explore_count', desc: '총 200번 탐색', target: 'explores', goal: 200, reward: { exp: 40000, gold: 60000, item: '탐험가의 외투' }, minLv: 35 },

    // ── 레벨 전직 퀘스트 ─────────────────────────────────────────────────────
    { id: 100, title: '전직의 자격 (2차)',  desc: '레벨 30 달성하여 2차 전직',   target: 'Level', goal: 30, reward: { exp: 0, gold: 5000 }, minLv: 29 },
    { id: 101, title: '전직의 자격 (3차)',  desc: '레벨 60 달성하여 3차 전직',   target: 'Level', goal: 60, reward: { exp: 0, gold: 20000, item: '전직 증표' }, minLv: 59 },
    { id: 102, title: '레벨 50 달성',       desc: '레벨 50 달성',                target: 'Level', goal: 50, reward: { exp: 0, gold: 15000, item: '영웅의 증표' }, minLv: 49 },
    { id: 103, title: '레벨 70 달성',       desc: '레벨 70 달성 — 전설의 영역',  target: 'Level', goal: 70, reward: { exp: 0, gold: 50000, item: '전설의 영혼석' }, minLv: 69 },
];


export const ACHIEVEMENTS = [
    // ── 전투 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_first_blood',  title: '첫 번째 피',     desc: '첫 전투 승리',              target: 'kills',      goal: 1,    reward: { gold: 50 } },
    { id: 'ach_kill_10',      title: '초보 사냥꾼',    desc: '몬스터 10마리 처치',        target: 'kills',      goal: 10,   reward: { gold: 200 } },
    { id: 'ach_kill_50',      title: '학살자',         desc: '몬스터 50마리 처치',        target: 'kills',      goal: 50,   reward: { gold: 500 } },
    { id: 'ach_kill_100',     title: '전장의 신',      desc: '몬스터 100마리 처치',       target: 'kills',      goal: 100,  reward: { gold: 2000, item: '중급 체력 물약' } },
    { id: 'ach_kill_300',     title: '피의 군주',      desc: '몬스터 300마리 처치',       target: 'kills',      goal: 300,  reward: { gold: 8000, item: '전사의 반지' } },
    { id: 'ach_kill_500',     title: '대학살자',       desc: '몬스터 500마리 처치',       target: 'kills',      goal: 500,  reward: { gold: 20000, item: '학살의 대검' } },
    { id: 'ach_kill_1000',    title: '세계의 파괴자',  desc: '몬스터 1000마리 처치',      target: 'kills',      goal: 1000, reward: { gold: 50000, item: '전설 학살 증표' } },

    // ── 보스 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_boss_first',   title: '용사의 증명',    desc: '보스 첫 처치',              target: 'bossKills',  goal: 1,   reward: { gold: 1000 } },
    { id: 'ach_boss_5',       title: '보스 사냥꾼',    desc: '보스 5회 처치',             target: 'bossKills',  goal: 5,   reward: { gold: 5000, item: '보스 사냥꾼 인장' } },
    { id: 'ach_boss_10',      title: '전설의 토벌자',  desc: '보스 10회 처치',            target: 'bossKills',  goal: 10,  reward: { gold: 15000, item: '보스 토벌 증표' } },
    { id: 'ach_boss_25',      title: '신화의 사냥꾼',  desc: '보스 25회 처치',            target: 'bossKills',  goal: 25,  reward: { gold: 40000, item: '신화 사냥 훈장' } },

    // ── 골드 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_gold_1000',    title: '저축왕',         desc: '누적 골드 1000G 달성',      target: 'total_gold', goal: 1000,   reward: { item: '하급 체력 물약' } },
    { id: 'ach_gold_10000',   title: '갑부',           desc: '누적 골드 10000G 달성',     target: 'total_gold', goal: 10000,  reward: { item: '엘릭서' } },
    { id: 'ach_gold_50000',   title: '거상',           desc: '누적 골드 50000G 달성',     target: 'total_gold', goal: 50000,  reward: { item: '황금 반지' } },
    { id: 'ach_gold_200000',  title: '전설의 재벌',    desc: '누적 골드 200000G 달성',    target: 'total_gold', goal: 200000, reward: { item: '황금 갑주' } },

    // ── 레벨 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_lv_10',        title: '성장의 기쁨',    desc: '레벨 10 달성',              target: 'level',      goal: 10,   reward: { item: '강철 롱소드' } },
    { id: 'ach_lv_20',        title: '성숙한 전사',    desc: '레벨 20 달성',              target: 'level',      goal: 20,   reward: { item: '강화된 갑옷' } },
    { id: 'ach_lv_30',        title: '노련한 모험가',  desc: '레벨 30 달성',              target: 'level',      goal: 30,   reward: { item: '영웅의 단검' } },
    { id: 'ach_lv_50',        title: '전설의 경지',    desc: '레벨 50 달성',              target: 'level',      goal: 50,   reward: { item: '전설의 갑주' } },
    { id: 'ach_lv_70',        title: '신의 영역',      desc: '레벨 70 달성',              target: 'level',      goal: 70,   reward: { item: '신화 전설 영혼' } },

    // ── 사망 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_die_1',        title: '죽음의 첫맛',    desc: '처음으로 전사',             target: 'deaths',     goal: 1,   reward: { gold: 100 } },
    { id: 'ach_die_5',        title: '불사조',         desc: '5번 전사 후 재기',          target: 'deaths',     goal: 5,   reward: { gold: 500, item: '부활의 깃털' } },
    { id: 'ach_die_10',       title: '불사조의 환생',  desc: '10번 전사 후 재기',         target: 'deaths',     goal: 10,  reward: { gold: 2000 } },
    { id: 'ach_die_30',       title: '죽음을 놀이로',  desc: '30번 전사',                 target: 'deaths',     goal: 30,  reward: { gold: 5000 } },

    // ── 탐험 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_explore_10',   title: '첫 탐험',        desc: '10번 탐색',                 target: 'explores',   goal: 10,   reward: { gold: 300 } },
    { id: 'ach_explore_50',   title: '탐험가',         desc: '50번 탐색',                 target: 'explores',   goal: 50,   reward: { gold: 1500 } },
    { id: 'ach_explore_100',  title: '베테랑 탐험가',  desc: '100번 탐색',                target: 'explores',   goal: 100,  reward: { gold: 4000, item: '탐험가의 장화' } },
    { id: 'ach_explore_500',  title: '세계의 지도자',  desc: '500번 탐색',                target: 'explores',   goal: 500,  reward: { gold: 20000, item: '세계 탐험 지도' } },
    { id: 'ach_explore_1000', title: '영원한 방랑자',  desc: '1000번 탐색',               target: 'explores',   goal: 1000, reward: { gold: 50000, item: '방랑자의 외투' } },

    // ── 제작 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_craft_5',      title: '견습 대장장이',  desc: '아이템 5개 제작',           target: 'crafts',     goal: 5,   reward: { gold: 1000 } },
    { id: 'ach_craft_20',     title: '숙련 대장장이',  desc: '아이템 20개 제작',          target: 'crafts',     goal: 20,  reward: { gold: 5000, item: '대장장이 망치' } },
    { id: 'ach_craft_50',     title: '장인',           desc: '아이템 50개 제작',          target: 'crafts',     goal: 50,  reward: { gold: 15000, item: '장인의 도구' } },
    { id: 'ach_craft_100',    title: '전설의 장인',    desc: '아이템 100개 제작',         target: 'crafts',     goal: 100, reward: { gold: 40000, item: '전설 제작 증표' } },

    // ── 휴식 업적 ─────────────────────────────────────────────────────────────
    { id: 'ach_rest_10',      title: '여유로운 여행자', desc: '10번 휴식',                target: 'rests',      goal: 10,  reward: { gold: 200 } },
    { id: 'ach_rest_50',      title: '게으른 모험가',  desc: '50번 휴식',                 target: 'rests',      goal: 50,  reward: { gold: 1000 } },

    // ── 현상금 업적 ──────────────────────────────────────────────────────────
    { id: 'ach_bounty_3',     title: '현상금 입문',    desc: '현상수배 3건 완료',         target: 'bountiesCompleted', goal: 3,  reward: { gold: 2000 } },
    { id: 'ach_bounty_10',    title: '현상금 전문가',  desc: '현상수배 10건 완료',        target: 'bountiesCompleted', goal: 10, reward: { gold: 8000, item: '현상금 배지' } },
    { id: 'ach_bounty_25',    title: '전설의 사냥꾼',  desc: '현상수배 25건 완료',        target: 'bountiesCompleted', goal: 25, reward: { gold: 25000, item: '전설 현상금 배지' } },

    // ── 심연 업적 ────────────────────────────────────────────────────────────
    { id: 'ach_abyss_10',     title: '심연 입문',      desc: '혼돈의 심연 10층 도달',     target: 'abyssFloor', goal: 10,  reward: { gold: 5000 } },
    { id: 'ach_abyss_30',     title: '심연 탐험자',    desc: '혼돈의 심연 30층 도달',     target: 'abyssFloor', goal: 30,  reward: { gold: 15000, item: '심연의 파편' } },
    { id: 'ach_abyss_50',     title: '심연의 지배자',  desc: '혼돈의 심연 50층 도달',     target: 'abyssFloor', goal: 50,  reward: { gold: 40000, item: '심연 지배 증표' } },

    // ── 유물 업적 ────────────────────────────────────────────────────────────
    { id: 'ach_relic_5',   title: '유물 수집가',  desc: '유물 5개 획득',    target: 'relicCount', goal: 5,   reward: { gold: 3000 } },
    { id: 'ach_relic_15',  title: '유물 학자',    desc: '유물 15개 획득',   target: 'relicCount', goal: 15,  reward: { gold: 10000, item: '유물 감정서' } },
    { id: 'ach_relic_30',  title: '전설의 수집가',desc: '유물 30개 획득',   target: 'relicCount', goal: 30,  reward: { gold: 30000, item: '전설 유물 봉인서' } },

    // ── 합성 업적 ────────────────────────────────────────────────────────────
    { id: 'ach_synth_5',   title: '연금술사 입문', desc: '합성 5회 성공',   target: 'synths',     goal: 5,   reward: { gold: 2000 } },
    { id: 'ach_synth_20',  title: '숙련 연금술사', desc: '합성 20회 성공',  target: 'synths',     goal: 20,  reward: { gold: 8000, item: '연금술사 장갑' } },
    { id: 'ach_synth_50',  title: '대연금술사',    desc: '합성 50회 성공',  target: 'synths',     goal: 50,  reward: { gold: 25000, item: '대연금술사 코트' } },

    // ── 탐험 지역 업적 ───────────────────────────────────────────────────────
    { id: 'ach_discover_5',  title: '호기심 많은 여행자', desc: '새 지역 5곳 발견',  target: 'discoveries', goal: 5,  reward: { gold: 1000 } },
    { id: 'ach_discover_10', title: '지도 제작자',        desc: '새 지역 10곳 발견', target: 'discoveries', goal: 10, reward: { gold: 5000, item: '탐험가의 지도' } },
    { id: 'ach_discover_15', title: '세계를 걷는 자',     desc: '새 지역 15곳 발견', target: 'discoveries', goal: 15, reward: { gold: 15000, item: '세계 지도 원본' } },

    // ── 프레스티지 업적 ──────────────────────────────────────────────────────
    { id: 'ach_prestige_1',  title: '최초의 각성',   desc: '첫 번째 프레스티지',   target: 'prestige',   goal: 1, reward: { gold: 10000, item: '환생의 결정' } },
    { id: 'ach_prestige_3',  title: '세 번째 윤회',  desc: '세 번째 프레스티지',   target: 'prestige',   goal: 3, reward: { gold: 30000, item: '초월의 징표' } },
    { id: 'ach_prestige_5',  title: '다섯 번째 환생', desc: '다섯 번째 프레스티지', target: 'prestige',   goal: 5, reward: { gold: 60000, item: '영겁의 수정' } },

    // ── 특수 업적 ────────────────────────────────────────────────────────────
    { id: 'ach_demon_king',   title: '세계의 구원자',  desc: '마왕을 처치하여 세계를 구함', target: 'demonKingSlain', goal: 1, reward: { gold: 50000, item: '세계 구원자의 증표' } },
    { id: 'ach_demon_king_5', title: '반복된 전설',    desc: '마왕 5회 처치',             target: 'demonKingSlain', goal: 5, reward: { gold: 100000, item: '전설의 반지' } },
];
