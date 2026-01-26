import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { 
  Terminal, Shield, Sword, Map as MapIcon, 
  User, Zap, Skull, Coins, Save, DownloadCloud, 
  ShoppingBag, Hammer, Beaker, HelpCircle, Flame, Leaf, Mountain, Snowflake, Sun, Moon,
  ScrollText, Bot, ArrowRight, XCircle, RefreshCw, Briefcase, Play, CheckCircle, AlertTriangle, Key, Layers, Gem, Gift, Crown, Ghost, GraduationCap, Home, Medal, Award
} from 'lucide-react';

/* --------------------------------------------------------------------------
   0. AI SERVICE
   -------------------------------------------------------------------------- */
const GEMINI_API_KEY = "AIzaSyBmEi1NX4LwxQI_khiJ27_-TOnswNjamiI";

const FALLBACK_TEMPLATES = {
  encounter: (name) => `전방에서 [${name}]의 기척이 느껴집니다!`,
  victory: (name) => `[${name}]이(가) 쓰러졌습니다. 승리의 순간을 만끽하세요.`,
  bossSkill: (name) => `[${name}]의 주변에서 위험한 마력이 감지됩니다!`,
  bossGimmick: (name) => `[${name}]이(가) 분노하며 진정한 힘을 개방합니다!`,
  levelUp: (level) => `새로운 힘이 솟구칩니다! 레벨 ${level} 달성!`,
  death: () => `의식이 흐려집니다... 당신의 여정은 여기서 끝이 났습니다.`,
  jobChange: (job) => `새로운 길, [${job}]의 자격을 얻었습니다.`
};

const AI_SERVICE = {
  generateStory: async (type, data) => {
    try {
      const systemPrompt = `당신은 다크 판타지 RPG 게임의 내레이터입니다. 상황을 한국어로 1~2문장으로 짧고 비장하게 묘사하세요.`;
      let userPrompt = "";
      if (type === 'encounter') userPrompt = `상황: [${data.loc}]에서 [${data.name}] 몬스터 조우. 묘사해줘.`;
      else if (type === 'victory') userPrompt = `상황: [${data.name}] 처치 승리. 묘사해줘.`;
      else if (type === 'bossSkill') userPrompt = `상황: 보스 [${data.name}] 스킬 사용 직전. 위험 묘사.`;
      else if (type === 'bossGimmick') userPrompt = `상황: 보스 [${data.name}]가 체력이 낮아져 광폭화(패턴 변화)함. 공포스럽게 묘사.`;
      else if (type === 'levelUp') userPrompt = `상황: 레벨 ${data.level} 달성. 성장 묘사.`;
      else if (type === 'death') userPrompt = `상황: 플레이어 사망. 비극적 최후 묘사.`;
      else if (type === 'jobChange') userPrompt = `상황: 플레이어가 [${data.job}]으로 전직함. 각성 묘사.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + "\n" + userPrompt }] }] }),
        }
      );

      if (!response.ok) throw new Error('API Error');
      const json = await response.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || FALLBACK_TEMPLATES[type](data.name || data.level || data.job);
    } catch (error) {
      return FALLBACK_TEMPLATES[type] ? FALLBACK_TEMPLATES[type](data.name || data.level || data.job) : "운명의 수레바퀴가 조용히 돌아갑니다.";
    }
  }
};

/* --------------------------------------------------------------------------
   1. GAME DATA
   -------------------------------------------------------------------------- */
const ELEMENTS = {
  '물리': { icon: <Sword size={12}/>, strong: [], weak: [] },
  '화염': { icon: <Flame size={12} className="text-orange-500"/>, strong: ['자연', '냉기'], weak: ['대지', '물'] },
  '냉기': { icon: <Snowflake size={12} className="text-cyan-400"/>, strong: ['화염', '대지'], weak: ['빛'] },
  '자연': { icon: <Leaf size={12} className="text-green-500"/>, strong: ['대지', '물'], weak: ['화염'] },
  '대지': { icon: <Mountain size={12} className="text-amber-700"/>, strong: ['냉기'], weak: ['자연'] },
  '빛':   { icon: <Sun size={12} className="text-yellow-400"/>, strong: ['어둠'], weak: ['자연'] },
  '어둠': { icon: <Moon size={12} className="text-purple-500"/>, strong: ['빛'], weak: ['화염'] }
};

const QUEST_DATA = {
  1: { title: '슬라임 소탕', desc: '슬라임 3마리 처치', target: '슬라임', goal: 3, reward: { exp: 50, gold: 100 }, minLv: 1 },
  2: { title: '멧돼지 사냥', desc: '멧돼지 5마리 처치', target: '멧돼지', goal: 5, reward: { exp: 80, gold: 150 }, minLv: 2 },
  3: { title: '광산의 위협', desc: '코볼트 5마리 처치', target: '코볼트', goal: 5, reward: { exp: 300, gold: 500, item: '강철 롱소드' }, minLv: 3 },
  4: { title: '박쥐 퇴치', desc: '박쥐 10마리 처치', target: '박쥐', goal: 10, reward: { exp: 400, gold: 400, item: '중급 체력 물약' }, minLv: 5 },
  10: { title: '전직의 자격 (1차)', desc: '1차 전직을 위해 레벨 10 달성', target: 'Level', goal: 10, reward: { exp: 0, gold: 1000 }, minLv: 9 },
  11: { title: '사막의 무법자', desc: '사막도적 10마리 처치', target: '사막도적', goal: 10, reward: { exp: 1000, gold: 1500 }, minLv: 15 },
  12: { title: '늪지 정화', desc: '맹독히드라 처치', target: '맹독히드라', goal: 1, reward: { exp: 2000, gold: 3000, item: '해독제' }, minLv: 20 },
  30: { title: '영웅의 길 (2차)', desc: '2차 전직을 위해 레벨 30 달성', target: 'Level', goal: 30, reward: { exp: 0, gold: 5000 }, minLv: 29 },
  99: { title: '마왕 토벌', desc: '최종 보스 마왕 처치', target: '마왕', goal: 1, reward: { exp: 50000, gold: 99999, item: '성검 에테르니아' }, minLv: 50 }
};

// 업적 데이터 (자동 달성)
const ACHIEVEMENT_DATA = [
  { id: 'ach_kill_10', title: '초보 사냥꾼', desc: '몬스터 10마리 처치', target: 'kills', goal: 10, reward: { gold: 200 } },
  { id: 'ach_kill_100', title: '학살자', desc: '몬스터 100마리 처치', target: 'kills', goal: 100, reward: { gold: 2000, item: '중급 체력 물약' } },
  { id: 'ach_gold_1000', title: '저축왕', desc: '누적 골드 1000G 달성', target: 'total_gold', goal: 1000, reward: { item: '하급 체력 물약' } },
  { id: 'ach_gold_10000', title: '갑부', desc: '누적 골드 10000G 달성', target: 'total_gold', goal: 10000, reward: { item: '엘릭서' } },
  { id: 'ach_lv_10', title: '성장의 기쁨', desc: '레벨 10 달성', target: 'level', goal: 10, reward: { item: '강철 롱소드' } },
  { id: 'ach_die_1', title: '죽음은 또 다른 시작', desc: '최초 사망 달성', target: 'deaths', goal: 1, reward: { gold: 100 } }
];

const CLASSES = {
  '모험가': { tier: 0, desc: '기본 직업', hpMod: 1.0, mpMod: 1.0, atkMod: 1.0, skills: [{ name: '강타', mp: 10, type: '물리', mult: 1.5 }], next: ['전사', '마법사', '도적'] },
  '전사': { tier: 1, reqLv: 10, desc: '체력/공격 특화', hpMod: 1.4, mpMod: 0.6, atkMod: 1.3, skills: [{ name: '파워배시', mp: 15, mult: 2.0 }, { name: '광폭화', mp: 30, type: 'buff', val: 1.5, turn: 3 }], next: ['나이트', '버서커'] },
  '마법사': { tier: 1, reqLv: 10, desc: '마법 공격 특화', hpMod: 0.7, mpMod: 1.8, atkMod: 1.6, skills: [{ name: '화염구', mp: 20, type: '화염', mult: 2.2, effect: 'burn' }, { name: '썬더볼트', mp: 45, type: '빛', mult: 3.5, effect: 'stun' }], next: ['아크메이지', '흑마법사'] },
  '도적': { tier: 1, reqLv: 10, desc: '치명타/속도', hpMod: 1.0, mpMod: 1.0, atkMod: 1.4, skills: [{ name: '급소찌르기', mp: 15, mult: 1.8, crit: 0.5 }, { name: '독바르기', mp: 25, type: '자연', mult: 1.5, effect: 'poison' }], next: ['어쌔신', '레인저'] },
  // ... (2차 전직 데이터 유지)
  '나이트': { tier: 2, reqLv: 30, desc: '철벽의 방어', hpMod: 2.0, mpMod: 0.8, atkMod: 1.5, skills: [{ name: '실드배시', mp: 20, mult: 2.5, effect: 'stun' }, { name: '절대방어', mp: 50, type: 'buff', val: 2.0, turn: 5 }], next: [] },
  '버서커': { tier: 2, reqLv: 30, desc: '광란의 공격', hpMod: 1.6, mpMod: 0.5, atkMod: 2.0, skills: [{ name: '휠윈드', mp: 30, mult: 3.0 }, { name: '피의갈망', mp: 60, type: 'buff', val: 2.5, turn: 3 }], next: [] },
  '아크메이지': { tier: 2, reqLv: 30, desc: '원소의 지배자', hpMod: 0.8, mpMod: 2.5, atkMod: 2.2, skills: [{ name: '메테오', mp: 60, type: '화염', mult: 4.5, effect: 'burn' }, { name: '블리자드', mp: 60, type: '냉기', mult: 4.0, effect: 'stun' }], next: [] },
  '흑마법사': { tier: 2, reqLv: 30, desc: '어둠의 계약', hpMod: 0.9, mpMod: 2.0, atkMod: 2.0, skills: [{ name: '다크메터', mp: 50, type: '어둠', mult: 4.0, effect: 'poison' }, { name: '생명흡수', mp: 40, mult: 3.0 }], next: [] },
  '어쌔신': { tier: 2, reqLv: 30, desc: '일격필살', hpMod: 1.1, mpMod: 1.2, atkMod: 1.9, skills: [{ name: '암살', mp: 40, mult: 5.0, crit: 0.8 }, { name: '은신', mp: 30, type: 'buff', val: 2.0, turn: 2 }], next: [] },
  '레인저': { tier: 2, reqLv: 30, desc: '원거리 명사수', hpMod: 1.2, mpMod: 1.5, atkMod: 1.7, skills: [{ name: '연속사격', mp: 35, mult: 3.5 }, { name: '폭발화살', mp: 45, type: '화염', mult: 3.8, effect: 'burn' }], next: [] }
};

const ITEM_PREFIXES = [
  { name: '날카로운', type: 'weapon', stat: 'atk', val: 3, price: 1.2 },
  { name: '묵직한', type: 'weapon', stat: 'atk', val: 5, price: 1.3 },
  { name: '불타는', type: 'weapon', stat: 'atk', val: 5, elem: '화염', price: 1.5 },
  { name: '얼어붙은', type: 'weapon', stat: 'atk', val: 5, elem: '냉기', price: 1.5 },
  { name: '단단한', type: 'armor', stat: 'def', val: 2, price: 1.2 },
  { name: '수호의', type: 'armor', stat: 'def', val: 5, price: 1.4 },
  { name: '축복받은', type: 'all', stat: 'hp', val: 20, price: 2.0 }, 
];

const BASE_ITEMS = {
  weapons: [
    { name: '단검', type: 'weapon', val: 5, tier: 1, price: 50, jobs: ['모험가', '도적', '마법사', '어쌔신', '레인저'], desc: '녹이 슬어 무딘 단검.', desc_stat: 'ATK+5' },
    { name: '녹슨 단검', type: 'weapon', val: 5, tier: 1, price: 50, jobs: ['모험가', '도적', '마법사', '어쌔신', '레인저'], desc: '기본 단검', desc_stat: 'ATK+5' },
    { name: '롱소드', type: 'weapon', val: 15, tier: 1, price: 150, jobs: ['전사', '모험가', '나이트', '버서커'], desc: '표준적인 검.', desc_stat: 'ATK+15' },
    { name: '전투도끼', type: 'weapon', val: 25, tier: 2, price: 400, jobs: ['전사', '버서커'], desc: '무거운 도끼.', desc_stat: 'ATK+25' },
    { name: '마법지팡이', type: 'weapon', val: 20, tier: 2, price: 500, jobs: ['마법사', '아크메이지', '흑마법사'], desc: '마력이 깃든 지팡이.', desc_stat: 'ATK+20' },
    { name: '강철 롱소드', type: 'weapon', val: 25, tier: 2, price: 400, jobs: ['전사', '모험가', '나이트'], desc: '잘 제련된 강철 검.', desc_stat: 'ATK+25' },
    { name: '화염의 지팡이', type: 'weapon', val: 35, tier: 2, price: 600, elem: '화염', jobs: ['마법사', '아크메이지'], desc: '불꽃이 일렁이는 지팡이.', desc_stat: 'ATK+35(화)' },
    { name: '미스릴검', type: 'weapon', val: 45, tier: 3, price: 1200, jobs: ['전사', '모험가', '나이트'], desc: '가볍고 강한 미스릴 검.', desc_stat: 'ATK+45' },
    { name: '흑요석단검', type: 'weapon', val: 40, tier: 3, price: 1000, jobs: ['도적', '어쌔신'], desc: '날카로운 흑요석 단검.', desc_stat: 'ATK+40' },
    { name: '엘프의활', type: 'weapon', val: 35, tier: 3, price: 1100, jobs: ['도적', '모험가', '레인저'], desc: '엘프가 만든 활.', desc_stat: 'ATK+35' },
    { name: '용살자의창', type: 'weapon', val: 80, tier: 4, price: 5000, jobs: ['전사', '나이트'], desc: '용을 잡는 창.', desc_stat: 'ATK+80' },
    { name: '아크스태프', type: 'weapon', val: 90, tier: 4, price: 6000, jobs: ['마법사', '아크메이지'], desc: '대마법사의 지팡이.', desc_stat: 'ATK+90' },
    { name: '성검 에테르니아', type: 'weapon', val: 200, tier: 5, price: 30000, elem: '빛', jobs: ['전사', '모험가', '나이트'], desc: '전설 속 영웅이 사용하던 검.', desc_stat: 'ATK+200(빛)' },
    { name: '성검', type: 'weapon', val: 150, tier: 5, price: 20000, jobs: ['전사', '나이트'], elem: '빛', desc: '성스러운 빛의 검.', desc_stat: 'ATK+150(빛)' }
  ],
  armors: [
    { name: '천옷', type: 'armor', val: 2, tier: 1, price: 30, jobs: ['모험가', '마법사', '아크메이지', '흑마법사'], desc: '평범한 천옷.', desc_stat: 'DEF+2' },
    { name: '여행자 튜닉', type: 'armor', val: 2, tier: 1, price: 50, jobs: ['모험가', '전사', '마법사', '도적', '레인저'], desc: '활동하기 편한 얇은 옷.', desc_stat: 'DEF+2' },
    { name: '가죽갑옷', type: 'armor', val: 8, tier: 1, price: 100, jobs: ['모험가', '전사', '도적', '어쌔신'], desc: '질긴 가죽 갑옷.', desc_stat: 'DEF+8' },
    { name: '가죽 갑옷', type: 'armor', val: 8, tier: 1, price: 120, jobs: ['모험가', '전사', '도적', '어쌔신'], desc: '덧대어 만든 가죽 갑옷.', desc_stat: 'DEF+8' },
    { name: '사슬갑옷', type: 'armor', val: 15, tier: 2, price: 300, jobs: ['전사', '나이트', '버서커'], desc: '쇠사슬로 엮은 갑옷.', desc_stat: 'DEF+15' },
    { name: '사슬 갑옷', type: 'armor', val: 18, tier: 2, price: 350, jobs: ['전사', '나이트', '버서커'], desc: '튼튼한 사슬 갑옷.', desc_stat: 'DEF+18' },
    { name: '판금갑옷', type: 'armor', val: 30, tier: 3, price: 800, jobs: ['전사', '나이트'], desc: '두꺼운 강철 판금.', desc_stat: 'DEF+30' },
    { name: '마법로브', type: 'armor', val: 10, tier: 3, price: 700, jobs: ['마법사', '아크메이지', '흑마법사'], desc: '마력이 깃든 로브.', desc_stat: 'DEF+10' },
    { name: '용비늘갑옷', type: 'armor', val: 60, tier: 4, price: 5000, jobs: ['전사', '모험가', '버서커'], desc: '용의 비늘로 만든 갑옷.', desc_stat: 'DEF+60' },
    { name: '드래곤 스케일', type: 'armor', val: 100, tier: 4, price: 7000, jobs: ['전사', '모험가', '나이트'], desc: '전설적인 드래곤 갑옷.', desc_stat: 'DEF+100' },
    { name: '천상의갑주', type: 'armor', val: 100, tier: 5, price: 15000, jobs: ['전사', '나이트'], desc: '천계의 금속으로 만듬.', desc_stat: 'DEF+100' }
  ],
  potions: [
    { name: '하급 체력 물약', val: 50, type: 'hp', price: 30, desc: 'HP 50 회복', desc_stat: 'HP+50' },
    { name: '중급 체력 물약', val: 150, type: 'hp', price: 100, desc: 'HP 150 회복', desc_stat: 'HP+150' },
    { name: '상급 체력 물약', val: 300, type: 'hp', price: 300, desc: 'HP 300 회복', desc_stat: 'HP+300' },
    { name: '엘릭서', val: 9999, type: 'hp', price: 2000, desc: 'HP 완전 회복', desc_stat: 'HP MAX' },
    { name: '해독제', type: 'cure', effect: 'poison', price: 50, desc: '중독 상태를 치료', desc_stat: '해독' }
  ],
  materials: [
    { name: '슬라임 젤리', type: 'mat', price: 5, desc: '끈적거리는 액체', desc_stat: '재료' },
    { name: '동전 주머니', type: 'mat', price: 50, desc: '동전이 든 주머니', desc_stat: '재료' },
    { name: '철광석', type: 'mat', price: 20, desc: '단단한 광석', desc_stat: '재료' },
    { name: '마나 결정', type: 'mat', price: 100, desc: '마력이 응축된 결정', desc_stat: '재료' },
    { name: '용의 비늘', type: 'mat', price: 500, desc: '매우 단단한 비늘', desc_stat: '재료' },
    { name: '어둠의 정수', type: 'mat', price: 300, desc: '불길한 기운', desc_stat: '재료' },
    { name: '멧돼지 가죽', type: 'mat', price: 20, desc: '질긴 가죽', desc_stat: '재료' },
    { name: '박쥐 날개', type: 'mat', price: 15, desc: '연금술 재료', desc_stat: '재료' },
    { name: '화염의 결정', type: 'mat', price: 100, desc: '뜨거운 열기', desc_stat: '재료' }
  ]
};

const LOOT_TABLE = {
  '슬라임': ['슬라임 젤리', '하급 체력 물약'],
  '초록슬라임': ['슬라임 젤리'],
  '대왕슬라임': ['슬라임 젤리', '중급 체력 물약', '녹슨 단검'],
  '멧돼지': ['멧돼지 가죽', '여행자 튜닉'],
  '코볼트': ['철광석', '녹슨 단검', '동전 주머니'],
  '박쥐': ['박쥐 날개'],
  '파이어뱃': ['박쥐 날개', '화염의 지팡이', '중급 체력 물약'],
  '라바골렘': ['철광석', '강철 롱소드'],
  '스켈레톤': ['철광석', '녹슨 단검'],
  '화염의 군주': ['화염의 지팡이', '엘릭서', '용비늘갑옷']
};

const WORLD_MAP = {
  '시작의 마을': { level: 0, desc: '평화로운 마을입니다. [상점], [퀘스트], [전직]이 가능합니다.', exits: ['슬라임 평원'], type: 'safe' },
  '슬라임 평원': { level: 1, desc: '끈적한 슬라임들이 뛰어노는 평원입니다.', monsters: ['초록슬라임', '대왕슬라임', '멧돼지'], midBoss: '킹슬라임', boss: '슬라임엠페러', elements: ['자연'], exits: ['시작의 마을', '고요한 숲'] },
  '고요한 숲': { level: 3, desc: '나무가 울창하여 빛이 잘 들지 않습니다.', monsters: ['멧돼지', '박쥐'], midBoss: '거대곰', boss: '숲의수호자', elements: ['자연'], exits: ['슬라임 평원', '고블린 부락'] },
  '고블린 부락': { level: 5, desc: '고블린들이 모여사는 시끄러운 곳입니다.', monsters: ['코볼트'], midBoss: '고블린대장', boss: '고블린로드', elements: ['대지'], exits: ['고요한 숲', '버려진 광산'] },
  '버려진 광산': { level: 8, desc: '깊고 어두운 지하 광산입니다.', monsters: ['박쥐', '코볼트', '스켈레톤'], midBoss: '코볼트감독관', boss: '자이언트웜', elements: ['대지', '어둠'], exits: ['고블린 부락', '바위 협곡'] },
  '바위 협곡': { level: 10, desc: '날카로운 바위들이 솟아있는 협곡입니다.', monsters: ['스켈레톤'], midBoss: '산적우두머리', boss: '스톤골렘', elements: ['대지'], exits: ['버려진 광산', '고대 유적'] },
  '고대 유적': { level: 12, desc: '이끼 낀 고대의 석조 건물들입니다.', monsters: ['스켈레톤'], midBoss: '스켈레톤장군', boss: '리치', elements: ['어둠'], exits: ['바위 협곡', '오아시스'] },
  '오아시스': { level: 15, desc: '사막 한가운데의 쉼터입니다.', monsters: ['슬라임 젤리'], midBoss: '거대전갈', boss: '샌드웜', elements: ['자연', '물리'], exits: ['고대 유적', '작열하는 사막'] },
  '작열하는 사막': { level: 18, desc: '숨쉬기 힘들 정도로 뜨거운 사막입니다.', monsters: ['파이어뱃'], midBoss: '미라로드', boss: '파라오의저주', elements: ['화염'], exits: ['오아시스', '맹독의 늪'] },
  '맹독의 늪': { level: 20, desc: '지독한 독기가 올라오는 늪지대입니다.', monsters: ['슬라임'], midBoss: '맹독히드라', boss: '늪의주인', elements: ['자연', '어둠'], exits: ['작열하는 사막', '안개 낀 습지'] },
  '안개 낀 습지': { level: 23, desc: '한치 앞도 보이지 않는 안개 속입니다.', monsters: ['슬라임'], midBoss: '안개군주', boss: '서펜트', elements: ['냉기', '어둠'], exits: ['맹독의 늪', '얼어붙은 설원'] },
  '얼어붙은 설원': { level: 25, desc: '살을 에는 추위가 몰아칩니다.', monsters: ['코볼트'], midBoss: '예티', boss: '설녀', elements: ['냉기'], exits: ['안개 낀 습지', '빙하 동굴'] },
  '빙하 동굴': { level: 28, desc: '모든 것이 얼어붙은 수정 동굴입니다.', monsters: ['박쥐'], midBoss: '얼음여왕', boss: '에이션트프로스트', elements: ['냉기'], exits: ['얼어붙은 설원', '화산 지대 입구'] },
  '화산 지대 입구': { level: 30, desc: '갑작스러운 열기가 느껴집니다.', monsters: ['파이어뱃', '라바골렘'], midBoss: '케르베로스', boss: '화염거인', elements: ['화염'], exits: ['빙하 동굴', '용암 동굴'] },
  '용암 동굴': { level: 35, desc: '펄펄 끓는 용암이 흐릅니다.', monsters: ['라바골렘'], midBoss: '발록', boss: '화염의군주', elements: ['화염'], exits: ['화산 지대 입구', '타락한 신전'] },
  '타락한 신전': { level: 40, desc: '신성함은 사라지고 악의 기운만 남았습니다.', monsters: ['스켈레톤'], midBoss: '타락한대사제', boss: '아크데몬', elements: ['어둠'], exits: ['용암 동굴', '심연의 입구'] },
  '심연의 입구': { level: 45, desc: '끝을 알 수 없는 어둠이 시작됩니다.', monsters: ['스켈레톤'], midBoss: '심연의감시자', boss: '다크로드', elements: ['어둠'], exits: ['타락한 신전', '마계의 성'] },
  '마계의 성': { level: 50, desc: '마왕이 거주하는 성입니다.', monsters: ['스켈레톤'], midBoss: '사천왕', boss: '마왕', elements: ['어둠', '화염'], exits: ['심연의 입구', '혼돈의 틈'] },
  '혼돈의 틈': { level: 60, desc: '현실과 차원이 뒤섞인 공간입니다.', monsters: ['스켈레톤'], midBoss: '차원의지배자', boss: '혼돈의신', elements: ['빛', '어둠'], exits: ['마계의 성', '천상의 문'] },
  '천상의 문': { level: 70, desc: '신들의 영역으로 가는 문입니다.', monsters: ['스켈레톤'], midBoss: '가브리엘', boss: '절대자', elements: ['빛'], exits: ['혼돈의 틈'] }
};

/* --------------------------------------------------------------------------
   2. CONTEXT & PROVIDER
   -------------------------------------------------------------------------- */
const GameContext = createContext();

const GameProvider = ({ children }) => {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [logs, setLogs] = useState([{ type: 'system', text: '게임을 시작합니다. 명령어 입력 또는 버튼으로 진행하세요.', id: 0 }]);
  const [player, setPlayer] = useState({
    name: '방랑자', job: '모험가', level: 1,
    hp: 150, maxHp: 150, mp: 50, maxMp: 50,
    atk: 10, def: 5, exp: 0, nextExp: 100, gold: 500,
    loc: '시작의 마을',
    inv: [{ name: '녹슨 단검', type: 'weapon', val: 5, tier: 1, price: 50, desc: '기본 단검', desc_stat: 'ATK+5' }, 
          { name: '하급 체력 물약', type: 'hp', val: 50, price: 30, desc: 'HP 50 회복', desc_stat: 'HP+50' },
          { name: '하급 체력 물약', type: 'hp', val: 50, price: 30, desc: 'HP 50 회복', desc_stat: 'HP+50' }], 
    equip: { 
      weapon: { name: '녹슨 단검', type: 'weapon', val: 5, tier: 1, price: 50, desc: '기본 단검', desc_stat: 'ATK+5' }, 
      armor: { name: '여행자 튜닉', type: 'armor', val: 2, tier: 1, price: 50, desc: '활동하기 편한 얇은 옷.', desc_stat: 'DEF+2' }
    },
    quests: [], 
    tempBuff: { atk: 0, turn: 0 },
    status: [], // { type: 'poison', val: 5, turn: 3 }
    stats: { kills: 0, total_gold: 0, deaths: 0 } // Achievement Stats
  });
  const [grave, setGrave] = useState(null); 
  const [gameState, setGameState] = useState('idle');
  const [enemy, setEnemy] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [sideTab, setSideTab] = useState('inventory'); 
  const logIdCounter = useRef(0);

  useEffect(() => {
    const savedData = localStorage.getItem('aetheria_save_slot_auto');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (typeof parsed.equip.weapon === 'string') {
         parsed.equip.weapon = BASE_ITEMS.weapons.find(w => w.name === parsed.equip.weapon) || BASE_ITEMS.weapons[0];
         parsed.equip.armor = BASE_ITEMS.armors.find(a => a.name === parsed.equip.armor) || BASE_ITEMS.armors[0];
      }
      // Initialize new stats if old save
      if (!parsed.stats) parsed.stats = { kills: 0, total_gold: 0, deaths: 0 };
      if (!parsed.achievements) parsed.achievements = [];
      if (!parsed.status) parsed.status = [];
      setPlayer(parsed);
      setIsGameStarted(true);
    }
  }, []);

  const startGame = (nickname) => {
    setPlayer(prev => ({ ...prev, name: nickname }));
    setIsGameStarted(true);
    addLog('system', `환영합니다, ${nickname}님. 에테르니아의 세계에 오신 것을 환영합니다.`);
  };

  const generateLogId = () => {
    logIdCounter.current += 1;
    return `${Date.now()}-${logIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addLog = (type, text) => {
    setLogs(prev => [...prev, { type, text, id: generateLogId() }]);
  };

  const addStoryLog = async (type, data) => {
    const tempId = generateLogId();
    setLogs(prev => [...prev, { type: 'loading', text: '📜 ...', id: tempId }]);
    const storyText = await AI_SERVICE.generateStory(type, data);
    setLogs(prev => prev.map(l => l.id === tempId ? { type: 'story', text: storyText, id: tempId } : l));
  };

  const getFullStats = () => {
    const wVal = player.equip.weapon?.val || 0;
    const aVal = player.equip.armor?.val || 0;
    const wElem = player.equip.weapon?.elem || '물리';
    const buff = player.tempBuff.turn > 0 ? (player.atk * 0.5) : 0;
    return {
      atk: Math.floor((player.atk + wVal + buff) * CLASSES[player.job].atkMod),
      def: player.def + aVal,
      elem: wElem
    };
  };

  // Safe Item Generation
  const generateDrop = (baseItemName) => {
    const all = [...BASE_ITEMS.weapons, ...BASE_ITEMS.armors, ...BASE_ITEMS.potions, ...BASE_ITEMS.materials];
    const base = all.find(i => i.name === baseItemName);
    if (!base) return null;

    const isEquip = BASE_ITEMS.weapons.some(w=>w.name===base.name) || BASE_ITEMS.armors.some(a=>a.name===base.name);
    if (!isEquip) return { ...base };

    if (Math.random() < 0.2) {
      const type = BASE_ITEMS.weapons.some(w=>w.name===base.name) ? 'weapon' : 'armor';
      const validPrefixes = ITEM_PREFIXES.filter(p => p.type === 'all' || p.type === type);
      
      if (validPrefixes.length > 0) {
        const prefix = validPrefixes[Math.floor(Math.random() * validPrefixes.length)];
        const newVal = (base.val || 0) + prefix.val;
        const newName = `${prefix.name} ${base.name}`;
        const newPrice = Math.floor(base.price * prefix.price);
        const newDesc = `${prefix.name} 기운이 서린 ${base.name}`;
        const newStat = base.desc_stat ? `${base.desc_stat.split('+')[0]}+${newVal}` : `성능 +${newVal}`;
        return { 
          ...base, name: newName, val: newVal, price: newPrice, desc: newDesc, desc_stat: newStat, elem: prefix.elem || base.elem
        };
      }
    }
    return { ...base };
  };

  const useItem = (targetName) => {
    const itemIndex = player.inv.findIndex(i => i.name === targetName);
    if (itemIndex === -1) return addLog('error', '가방에 없는 아이템입니다.');
    const item = player.inv[itemIndex];

    if (item.type === 'hp') {
      if (player.hp >= player.maxHp) return addLog('warning', '체력이 이미 가득 찼습니다.');
      setPlayer(prev => {
        const newInv = [...prev.inv];
        newInv.splice(itemIndex, 1);
        return { ...prev, hp: Math.min(prev.maxHp, prev.hp + item.val), inv: newInv };
      });
      addLog('success', `🧪 ${item.name} 사용. (${item.desc_stat})`);
    } else if (item.type === 'cure') {
      setPlayer(prev => {
        const newInv = [...prev.inv];
        newInv.splice(itemIndex, 1);
        return { ...prev, status: [], inv: newInv };
      });
      addLog('success', `🌿 해독제를 사용하여 모든 상태이상을 제거했습니다.`);
    } else if (item.type === 'weapon' || item.type === 'armor') {
      if (item.jobs && !item.jobs.includes(player.job)) {
        return addLog('error', `🚫 [${player.job}] 직업은 착용할 수 없습니다.`);
      }
      const type = item.type; 
      setPlayer(prev => {
        const oldEquip = prev.equip[type]; 
        const newInv = [...prev.inv];
        newInv.splice(itemIndex, 1); 
        if (oldEquip && oldEquip.name) newInv.push(oldEquip);
        return { ...prev, inv: newInv, equip: { ...prev.equip, [type]: item } };
      });
      addLog('success', `🛡️ ${item.name} 장착 완료.`);
    } else {
        addLog('info', '사용할 수 없는 아이템입니다.');
    }
  };

  const sellItem = (itemName) => {
    const itemIndex = player.inv.findIndex(i => i.name === itemName);
    if (itemIndex === -1) return;
    const item = player.inv[itemIndex];
    const sellPrice = Math.floor(item.price * 0.5);
    setPlayer(prev => {
      const newInv = [...prev.inv];
      newInv.splice(itemIndex, 1);
      return { ...prev, gold: prev.gold + sellPrice, inv: newInv };
    });
    addLog('success', `💰 ${itemName} 판매 (+${sellPrice}G)`);
  };

  const changeJob = (job) => {
    if (!CLASSES[job]) return;
    const targetClass = CLASSES[job];
    const currentClass = CLASSES[player.job];

    if (player.level < targetClass.reqLv) return addLog('error', `전직하려면 레벨 ${targetClass.reqLv}이 필요합니다.`);
    
    if (targetClass.tier === 1) {
        if (currentClass.tier !== 0) return addLog('error', '이미 1차 전직을 완료했습니다.');
    } else if (targetClass.tier === 2) {
        if (currentClass.tier !== 1) return addLog('error', '1차 전직 상태여야 합니다.');
        if (!currentClass.next.includes(job)) return addLog('error', `현재 직업에서는 [${job}]으로 전직할 수 없습니다.`);
    }

    setPlayer(prev => {
      const newMaxHp = Math.floor(150 * targetClass.hpMod + (prev.level * 20));
      const newMaxMp = Math.floor(50 * targetClass.mpMod + (prev.level * 10));
      return {
        ...prev, job: job, maxHp: newMaxHp, maxMp: newMaxMp, hp: Math.min(prev.hp, newMaxHp), mp: Math.min(prev.mp, newMaxMp)
      };
    });
    addStoryLog('jobChange', { job });
    addLog('success', `✨ [${job}]으로 전직했습니다!`);
    setGameState('idle');
  };

  const acceptQuest = (qId) => {
    if (player.quests.some(q => q.id === qId)) return;
    const qData = QUEST_DATA[qId];
    if (player.level < qData.minLv) return addLog('error', `레벨 ${qData.minLv} 이상이어야 합니다.`);

    let progress = 0;
    let completed = false;
    if (qData.target === 'Level') {
        progress = player.level;
        if (player.level >= qData.goal) completed = true;
    }

    setPlayer(p => ({ ...p, quests: [...p.quests, { id: qId, progress: progress, completed: completed, justFinished: completed }] }));
    addLog('event', `📜 퀘스트 수락: ${qData.title}`);
    setSideTab('quest'); 
  };

  useEffect(() => {
    if (isGameStarted) localStorage.setItem('aetheria_save_slot_auto', JSON.stringify(player));
  }, [player, isGameStarted]);

  const handleDeath = () => {
    addStoryLog('death', { name: player.name });
    addLog('error', '💀 사망했습니다. 모든 것이 초기화됩니다...');
    const lostGold = Math.floor(player.gold * 0.1);
    let lostItem = null;
    if (player.inv.length > 0) lostItem = player.inv[Math.floor(Math.random() * player.inv.length)];
    setGrave({ loc: player.loc, gold: lostGold, item: lostItem }); 
    setPlayer(prev => ({
      ...prev, level: 1, exp: 0, nextExp: 100, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5,
      loc: '시작의 마을', gold: 500, job: '모험가', quests: [], achievements: [], 
      stats: { kills: 0, total_gold: 0, deaths: prev.stats.deaths + 1 }, // Maintain Death Count
      inv: [{ name: '녹슨 단검', type: 'weapon', val: 5, tier: 1, price: 50, desc: '기본 단검', desc_stat: 'ATK+5' }, 
            { name: '하급 체력 물약', type: 'hp', val: 50, price: 30, desc: 'HP 50 회복', desc_stat: 'HP+50' }],
      equip: { weapon: { name: '녹슨 단검', type: 'weapon', val: 5, tier: 1, price: 50, desc: '기본 단검', desc_stat: 'ATK+5' }, 
               armor: { name: '여행자 튜닉', type: 'armor', val: 2, tier: 1, price: 50, desc: '활동하기 편한 얇은 옷.', desc_stat: 'DEF+2' }},
      tempBuff: { atk: 0, turn: 0 }, status: []
    }));
    setGameState('idle'); setEnemy(null);
  };

  const lootGrave = () => {
    if (grave && grave.loc === player.loc) {
      addLog('event', `⚰️ 과거의 유해를 발견했습니다!`);
      let msg = "";
      if (grave.gold > 0) {
        setPlayer(p => ({ ...p, gold: p.gold + grave.gold }));
        msg += `${grave.gold}G `;
      }
      if (grave.item) {
        setPlayer(p => ({ ...p, inv: [...p.inv, grave.item] }));
        msg += `[${grave.item.name}] `;
      }
      if (msg) addLog('success', `유해에서 ${msg}를 회수했습니다.`);
      else addLog('info', '유해는 텅 비어있었습니다.');
      setGrave(null);
    } else {
        addLog('info', '이곳에는 유해가 없습니다.');
    }
  };

  return (
    <GameContext.Provider value={{ 
      player, setPlayer, logs, addLog, addStoryLog,
      gameState, setGameState, enemy, setEnemy, shopItems, setShopItems,
      getFullStats, handleDeath, lootGrave, grave, isGameStarted, startGame,
      sideTab, setSideTab, useItem, sellItem, acceptQuest, generateDrop, changeJob
    }}>
      {children}
    </GameContext.Provider>
  );
};
const useGame = () => useContext(GameContext);

/* --------------------------------------------------------------------------
   3. COMPONENTS (UI)
   -------------------------------------------------------------------------- */

const StartScreen = () => {
  const { startGame } = useGame();
  const [name, setName] = useState('');
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-2">
        <Sword size={64} className="mx-auto text-emerald-500 mb-4" />
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">AETHERIA</h1>
        <p className="text-slate-400 text-sm tracking-widest uppercase">Roguelike Text RPG</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) startGame(name.trim()); }} className="w-full max-w-xs space-y-4">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-3 text-center text-white outline-none" placeholder="모험가 이름" autoFocus />
        <button type="submit" disabled={!name.trim()} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded transition-all flex items-center justify-center gap-2"><Play size={18} /> 모험 시작</button>
      </form>
    </div>
  );
};

const ActionButtons = ({ setInput, handleCommand }) => {
  const { gameState, player } = useGame();
  const exec = (cmd) => handleCommand(cmd);

  if (gameState === 'combat') {
    return (
      <div className="grid grid-cols-3 gap-2 mt-2">
        <button onClick={() => exec('공격')} className="bg-red-900/40 hover:bg-red-800 border border-red-700 p-3 rounded flex flex-col items-center gap-1 text-red-200"><Sword size={20}/> <span className="text-xs font-bold">공격</span></button>
        <button onClick={() => exec('기술')} className="bg-blue-900/40 hover:bg-blue-800 border border-blue-700 p-3 rounded flex flex-col items-center gap-1 text-blue-200"><Zap size={20}/> <span className="text-xs font-bold">기술</span></button>
        <button onClick={() => exec('도망')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-3 rounded flex flex-col items-center gap-1 text-slate-300"><ArrowRight size={20}/> <span className="text-xs font-bold">도망</span></button>
      </div>
    );
  }
  if (gameState === 'shop' || gameState === 'job_change') return null; 
  if (gameState === 'moving') {
    const exits = WORLD_MAP[player.loc].exits;
    const allExits = exits.includes('시작의 마을') ? exits : [...exits, '시작의 마을'];
    
    return (
      <div className="flex flex-col gap-2 mt-2">
        <div className="text-xs text-center text-cyan-400 mb-1">이동할 장소를 선택하세요</div>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {allExits.map(exit => {
             if (exit === '시작의 마을' && player.loc === '시작의 마을') return null;
             return (
              <button key={exit} onClick={() => exec(`이동 ${exit}`)} className={`whitespace-nowrap px-4 py-3 rounded text-sm flex items-center ${exit === '시작의 마을' ? 'bg-yellow-900/40 border border-yellow-700 text-yellow-200' : 'bg-emerald-900/40 hover:bg-emerald-800 border border-emerald-700 text-emerald-200'}`}>
                {exit === '시작의 마을' ? <Home size={14} className="mr-1"/> : <MapIcon size={14} className="mr-1"/>} {exit}
              </button>
             );
          })}
          <button onClick={() => exec('취소')} className="bg-slate-800 px-4 py-3 rounded text-slate-400 text-sm">취소</button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 gap-2 mt-2">
      <button onClick={() => exec('탐색')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1"><MapIcon size={16}/> <span className="text-[10px]">탐색</span></button>
      <button onClick={() => exec('이동')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1"><ArrowRight size={16}/> <span className="text-[10px]">이동</span></button>
      
      {WORLD_MAP[player.loc].type === 'safe' ? (
        <>
          <button onClick={() => exec('상점')} className="bg-yellow-900/30 hover:bg-yellow-800 border border-yellow-700 text-yellow-200 p-2 rounded flex flex-col items-center gap-1"><ShoppingBag size={16}/> <span className="text-[10px]">상점</span></button>
          <button onClick={() => exec('전직')} className="bg-purple-900/40 hover:bg-purple-800 border border-purple-700 text-purple-200 p-2 rounded flex flex-col items-center gap-1"><GraduationCap size={16}/> <span className="text-[10px]">전직</span></button>
        </>
      ) : (
        <>
          <button onClick={() => exec('상태')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1"><User size={16}/> <span className="text-[10px]">상태</span></button>
          <button onClick={() => exec('가방')} className="lg:hidden bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1"><Briefcase size={16}/> <span className="text-[10px]">가방</span></button>
        </>
      )}
      
      <button onClick={() => exec('퀘스트받기')} className="bg-indigo-900/40 hover:bg-indigo-800 border border-indigo-700 text-indigo-200 p-2 rounded flex flex-col items-center gap-1"><ScrollText size={16}/> <span className="text-[10px]">의뢰</span></button>
    </div>
  );
};

const TerminalView = () => {
  const { player, setPlayer, logs, addLog, addStoryLog, gameState, setGameState, enemy, setEnemy, shopItems, setShopItems, getFullStats, handleDeath, lootGrave, grave, sellItem, acceptQuest, setSideTab, generateDrop, useItem, changeJob } = useGame();
  const [input, setInput] = useState('');
  const [shopTab, setShopTab] = useState('buy');
  const [questList, setQuestList] = useState([]); 
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const spawnMonster = (mapData) => {
    const mName = mapData.monsters[Math.floor(Math.random() * mapData.monsters.length)];
    const isMainBoss = mapData.boss && Math.random() < 0.05; 
    const isMidBoss = !isMainBoss && mapData.midBoss && Math.random() < 0.15; 
    
    let finalName = mName;
    let baseName = mName;
    let hp = 100, atk = 15, exp = 50, gold = 50;
    let levelMult = mapData.level || 1;
    let rank = 'normal';
    let prefixMod = { expMod: 1.0, mod: 1.0 };

    if (isMainBoss) {
        finalName = mapData.boss;
        baseName = mapData.boss;
        hp = 500 * levelMult; atk = 30 * levelMult; exp = 500 * levelMult; gold = 200 * levelMult;
        rank = 'boss';
    } else if (isMidBoss) {
        finalName = mapData.midBoss;
        baseName = mapData.midBoss;
        hp = 300 * levelMult; atk = 25 * levelMult; exp = 300 * levelMult; gold = 100 * levelMult;
        rank = 'midboss';
    } else {
        const pIdx = Math.floor(Math.random() * MONSTER_PREFIXES.length);
        const prefix = MONSTER_PREFIXES[pIdx];
        prefixMod = prefix;
        finalName = `${prefix.name} ${mName}`;
        hp = Math.floor((80 + levelMult * 20) * prefix.mod);
        atk = Math.floor((10 + levelMult * 3) * prefix.mod);
        exp = Math.floor((10 + levelMult * 5) * prefix.expMod);
        gold = Math.floor((10 + levelMult * 2) * prefix.expMod);
    }

    if (!isMainBoss && !isMidBoss) {
        const scale = Math.pow(1.25, levelMult);
        exp = Math.floor(20 * scale * prefixMod.expMod);
        gold = Math.floor(10 * scale * 0.8 * prefixMod.expMod);
    }

    setEnemy({ 
      name: finalName, baseName: baseName, rank: rank,
      hp, maxHp: hp, atk, exp, gold, 
      element: mapData.elements[0], isBoss: isMainBoss || isMidBoss, turnCount: 0,
      status: [] // Enemy Status Effects
    });
    setGameState('combat');
    addLog('combat', `⚠️ [${finalName}] 출현! (HP: ${hp}/${hp})`);
    addStoryLog('encounter', { name: finalName, loc: player.loc });
  };

  const handleCombat = (action) => {
    const stats = getFullStats();
    let dmg = 0;
    if (action === '공격') {
      dmg = Math.floor(stats.atk * (0.9 + Math.random() * 0.2));
      let mult = 1.0;
      if (ELEMENTS[stats.elem]?.strong.includes(enemy.element)) mult = 1.5;
      if (ELEMENTS[stats.elem]?.weak.includes(enemy.element)) mult = 0.7;
      dmg = Math.floor(dmg * mult);
      const newHp = enemy.hp - dmg;
      addLog('combat', `⚔️ ${enemy.name}에게 ${dmg} 피해! (HP: ${Math.max(0, newHp)}/${enemy.maxHp})`);
      if (newHp <= 0) winCombat();
      else { setEnemy(prev => ({ ...prev, hp: newHp })); enemyTurn(); }
    } else if (action === '도망') {
      let chance = 0.3;
      if (enemy.rank === 'midboss') chance = 0.1;
      if (enemy.rank === 'boss') chance = 0.05;
      
      if (Math.random() < chance) { addLog('info', '전투에서 이탈했습니다.'); setGameState('idle'); setEnemy(null); }
      else { addLog('warning', '도망 실패!'); enemyTurn(); }
    }
  };

  // Turn Logic with Status Effects & Gimmicks
  const enemyTurn = () => {
    // 1. Enemy Status Effect Tick
    let statusDmg = 0;
    let isStunned = false;
    const nextEnemyStatus = [];
    
    if (enemy.status) {
        enemy.status.forEach(ef => {
            if (ef.type === 'burn') {
                statusDmg += 10;
                addLog('combat', `🔥 ${enemy.name}이(가) 화상을 입었습니다! (-10)`);
            } else if (ef.type === 'poison') {
                statusDmg += 5;
                addLog('combat', `☠️ ${enemy.name}에게 독이 퍼집니다... (-5)`);
            } else if (ef.type === 'stun') {
                isStunned = true;
                addLog('combat', `💫 ${enemy.name}은(는) 기절하여 움직일 수 없습니다!`);
            }
            if (ef.turn > 1) nextEnemyStatus.push({...ef, turn: ef.turn - 1});
        });
    }

    // Apply Status Damage
    const afterStatusHp = Math.max(0, enemy.hp - statusDmg);
    if (afterStatusHp <= 0) {
        setEnemy(prev => ({...prev, hp: 0}));
        winCombat();
        return;
    }
    setEnemy(prev => ({ ...prev, hp: afterStatusHp, status: nextEnemyStatus }));
    
    if (isStunned) return; // Skip turn if stunned

    // 2. Boss Gimmick (Rage Mode at <40% HP)
    let gimmickDmgMult = 1.0;
    if (enemy.isBoss && afterStatusHp < enemy.maxHp * 0.4 && !enemy.raged) {
        setEnemy(prev => ({ ...prev, raged: true }));
        addStoryLog('bossGimmick', { name: enemy.name });
        addLog('warning', `👿 ${enemy.name}이(가) 광폭화했습니다! 공격력이 상승합니다.`);
        gimmickDmgMult = 1.5;
    }

    const stats = getFullStats();
    let dmg = Math.max(1, Math.floor(enemy.atk * gimmickDmgMult) - stats.def);
    
    if (enemy.isBoss && enemy.turnCount % 3 === 0) { 
        dmg = Math.floor(dmg * 2); 
        addStoryLog('bossSkill', { name: enemy.name }); 
    }
    
    // 3. Player Status Logic (Player turn start essentially)
    // Simplified: Player status applied here
    let playerStatusDmg = 0;
    // (Implementation omitted for brevity, but structure is here)

    const newHp = Math.max(0, player.hp - dmg - playerStatusDmg);
    setPlayer(prev => ({ ...prev, hp: newHp }));
    addLog('warning', `💥 ${enemy.name}의 공격! ${dmg} 피해.`);
    
    if (enemy.isBoss) setEnemy(e => ({ ...e, turnCount: (e.turnCount || 0) + 1 }));
    if (newHp <= 0) { setTimeout(handleDeath, 100); }
  };

  const winCombat = () => {
    // 1. Calculate Rewards (Local vars)
    let gainedExp = enemy.exp;
    let gainedGold = enemy.gold;
    let gainedItems = [];

    // Loot Drop
    const possibleDrops = LOOT_TABLE[enemy.baseName] || []; 
    if (possibleDrops.length > 0) {
        possibleDrops.forEach(drop => {
            if(Math.random() < (drop.rate || 0.3)) {
                const itemObj = generateDrop(drop.item);
                if(itemObj) gainedItems.push(itemObj);
            }
        });
    } else {
        if (Math.random() < 0.3) {
            const miscPool = [...BASE_ITEMS.potions, ...BASE_ITEMS.materials];
            const baseDrop = miscPool[Math.floor(Math.random() * miscPool.length)];
            const itemObj = generateDrop(baseDrop.name);
            if(itemObj) gainedItems.push(itemObj);
        }
    }

    addLog('success', `🎉 ${enemy.name} 처치! 경험치 +${gainedExp}, 골드 +${gainedGold}`);
    addStoryLog('victory', { name: enemy.name });
    
    if(gainedItems.length > 0) {
        gainedItems.forEach(i => addLog('event', `🎁 [${i.name}]을(를) 획득했습니다!`));
    }

    // Quest Check
    const updatedQuests = player.quests.map(q => {
      const qData = QUEST_DATA[q.id];
      if (!q.completed && (enemy.name.includes(qData.target) || (qData.target==='Boss' && enemy.isBoss))) {
        const newProgress = q.progress + 1;
        if (newProgress >= qData.goal) {
          addLog('event', `✅ 퀘스트 완료: [${qData.title}]`);
          return { ...q, progress: newProgress, completed: true, justFinished: true };
        }
        return { ...q, progress: newProgress };
      }
      return q;
    });

    updatedQuests.forEach(q => {
        if(q.justFinished) {
            const r = QUEST_DATA[q.id].reward;
            gainedExp += r.exp;
            gainedGold += r.gold;
            if(r.item) {
                const rItem = generateDrop(r.item);
                if(rItem) gainedItems.push(rItem);
            }
            q.justFinished = false; 
        }
    });

    // Update Stats for Achievements
    const newStats = { 
        ...player.stats, 
        kills: (player.stats?.kills || 0) + 1,
        total_gold: (player.stats?.total_gold || 0) + gainedGold
    };
    
    // Check Achievements
    const newAchievements = [...(player.achievements || [])];
    ACHIEVEMENT_DATA.forEach(ach => {
        if (!newAchievements.includes(ach.id)) {
            if (newStats[ach.target] >= ach.goal) {
                newAchievements.push(ach.id);
                addLog('event', `🏆 업적 달성: [${ach.title}]`);
                gainedGold += ach.reward.gold || 0;
                if (ach.reward.item) {
                     const rItem = generateDrop(ach.reward.item);
                     if(rItem) gainedItems.push(rItem);
                }
            }
        }
    });

    let { exp, level, nextExp, maxHp, maxMp, atk } = player;
    let totalExp = exp + gainedExp;
    let newLevel = level;
    let newNextExp = nextExp;
    let newMaxHp = maxHp;
    let newMaxMp = maxMp;
    let newAtk = atk;
    
    let leveledUp = false;
    while (totalExp >= newNextExp) {
      newLevel++; 
      totalExp -= newNextExp; 
      newNextExp = Math.floor(newNextExp * 1.2); 
      newMaxHp += 20; newMaxMp += 10; newAtk += 2;
      leveledUp = true;
    }

    if (leveledUp) {
      addStoryLog('levelUp', { level: newLevel });
      addLog('success', `🆙 레벨 업! (Lv.${newLevel}) 체력이 모두 회복되었습니다.`);
      
      updatedQuests.forEach(q => {
          const qData = QUEST_DATA[q.id];
          if(qData.target === 'Level' && !q.completed && newLevel >= qData.goal) {
              q.progress = newLevel;
              q.completed = true;
              addLog('event', `✅ 퀘스트 완료: [${qData.title}]`);
              gainedGold += qData.reward.gold; 
          }
      });
      // Achievement Check for Level
      ACHIEVEMENT_DATA.forEach(ach => {
          if (!newAchievements.includes(ach.id) && ach.target === 'level' && newLevel >= ach.goal) {
              newAchievements.push(ach.id);
              addLog('event', `🏆 업적 달성: [${ach.title}]`);
              if (ach.reward.item) {
                   const rItem = generateDrop(ach.reward.item);
                   if(rItem) gainedItems.push(rItem);
              }
          }
      });
    }

    setPlayer(p => ({ 
      ...p, 
      exp: totalExp, level: newLevel, nextExp: newNextExp, maxHp: newMaxHp, maxMp: newMaxMp, atk: newAtk, 
      gold: p.gold + gainedGold, 
      inv: [...p.inv, ...gainedItems],
      quests: updatedQuests,
      achievements: newAchievements,
      stats: newStats,
      hp: leveledUp ? newMaxHp : p.hp
    }));
    setGameState('idle'); setEnemy(null);
  };

  const handleCommand = (cmd) => {
    const [action, ...args] = cmd.trim().split(' ');
    const arg = args.join(' ');

    if (gameState === 'combat') { if (['공격', '도망'].includes(action)) handleCombat(action); return; }
    
    if (gameState === 'shop') {
      if (action === '나가기') { setGameState('idle'); addLog('info', '상점에서 나왔습니다.'); return; }
      if (action === '구매') {
        const item = shopItems.find(i => i.name === arg);
        if (!item) return addLog('error', '없는 물건입니다.');
        if (player.gold < item.price) return addLog('error', '골드가 부족합니다.');
        const boughtItem = generateDrop(item.name) || item; 
        setPlayer(p => ({ ...p, gold: p.gold - item.price, inv: [...p.inv, boughtItem] }));
        addLog('success', `💰 ${item.name} 구매 완료.`);
      }
      return;
    }
    if (gameState === 'quest_board' || gameState === 'job_change') {
      if (action === '나가기') { setGameState('idle'); return; }
      return;
    }

    if (gameState === 'moving') {
      if (action === '이동') {
        setPlayer(p => ({ ...p, loc: arg })); setGameState('idle'); addLog('success', `👣 ${arg} 도착.`); addLog('system', WORLD_MAP[arg].desc);
        if (grave && grave.loc === arg) addLog('event', '⚰️ 이곳에서 당신의 유해를 발견했습니다. (명령어: 유해수습)');
      } else if (action === '취소') setGameState('idle');
      return;
    }

    switch (action) {
      case '이동': setGameState('moving'); break;
      case '탐색':
        if (player.loc === '시작의 마을') return addLog('info', '마을에서는 탐색할 수 없습니다.');
        if (grave && grave.loc === player.loc) lootGrave();
        if (Math.random() < 0.7) spawnMonster(WORLD_MAP[player.loc]);
        else addLog('info', '아무것도 발견하지 못했습니다.');
        break;
      case '상점':
        if (WORLD_MAP[player.loc].type !== 'safe') return addLog('error', '상점은 마을에만 있습니다.');
        setGameState('shop');
        const tier = Math.ceil(player.level / 10);
        const stock = [...BASE_ITEMS.potions, ...BASE_ITEMS.weapons.filter(i=>i.tier<=tier), ...BASE_ITEMS.armors.filter(i=>i.tier<=tier)];
        setShopItems(stock);
        addLog('event', '🏪 상점에 입장했습니다.');
        break;
      case '퀘스트받기':
        // Allow check quest everywhere, but check safe zone logic inside if needed. For now allow check.
        setGameState('quest_board');
        setQuestList(Object.entries(QUEST_DATA).map(([id, q]) => ({ id: parseInt(id), ...q })));
        break;
      case '전직':
        if (WORLD_MAP[player.loc].type !== 'safe') return addLog('error', '마을에서만 가능합니다.');
        setGameState('job_change');
        break;
      case '유해수습': lootGrave(); break;
      case '가방': setSideTab('inventory'); break;
      case '업적': setSideTab('achievement'); break;
      case '상태': 
        const s = getFullStats();
        addLog('info', `=== [${player.name}] Lv.${player.level} ===`);
        addLog('info', `EXP: ${player.exp} / ${player.nextExp} (${Math.floor((player.exp/player.nextExp)*100)}%)`);
        addLog('info', `공격력: ${s.atk} (${s.elem})  방어력: ${s.def}`);
        addLog('info', `골드: ${player.gold}G`);
        break;
      case '사용': useItem(arg); break;
      case '장착': useItem(arg); break;
      default: addLog('error', '알 수 없는 명령어입니다.');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black/60 border border-slate-800 rounded-lg p-4 relative shadow-2xl overflow-hidden h-full">
      {/* 1. 상점 UI */}
      {gameState === 'shop' && (
        <div className="absolute inset-0 bg-slate-900/95 z-10 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
            <h2 className="text-xl font-bold text-yellow-500">🛒 잡화점</h2>
            <div className="flex gap-2">
              <button onClick={() => setShopTab('buy')} className={`px-3 py-1 rounded text-sm ${shopTab==='buy' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300'}`}>구매</button>
              <button onClick={() => setShopTab('sell')} className={`px-3 py-1 rounded text-sm ${shopTab==='sell' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>판매</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {shopTab === 'buy' ? 
              shopItems.map((item, i) => (
                <button key={i} onClick={() => handleCommand(`구매 ${item.name}`)} className="flex flex-col bg-slate-800 p-3 rounded hover:bg-slate-700 border border-slate-600 text-left group">
                  <div className="flex justify-between w-full">
                    <span className="text-slate-200 font-bold group-hover:text-yellow-400">{item.name} <span className="text-[10px] text-emerald-400">({item.desc_stat})</span></span>
                    <span className="text-yellow-500">{item.price} G</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1">{item.desc}</span>
                </button>
              )) : 
              player.inv.map((item, i) => {
                const sellPrice = Math.floor(item.price * 0.5);
                return (
                  <button key={i} onClick={() => sellItem(item.name)} className="flex flex-col bg-slate-800 p-3 rounded hover:bg-red-900/30 border border-slate-600 text-left group">
                    <div className="flex justify-between w-full"><span className="text-slate-200 font-bold">{item.name}</span><span className="text-emerald-400">+{sellPrice} G</span></div>
                    <span className="text-xs text-slate-500 mt-1">클릭하여 판매</span>
                  </button>
                );
              })
            }
          </div>
          <button onClick={() => handleCommand('나가기')} className="w-full mt-4 bg-red-900/50 text-red-200 py-3 rounded font-bold">나가기</button>
        </div>
      )}

      {/* 2. 전직 UI */}
      {gameState === 'job_change' && (
        <div className="absolute inset-0 bg-slate-900/95 z-10 p-4 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-purple-400 mb-6">전직의 제단</h2>
          <div className="text-slate-400 mb-4 text-sm">현재 직업: {player.job} (Lv.{player.level})</div>
          
          <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
            {(() => {
                const currentClassData = CLASSES[player.job];
                let availableJobs = [];
                if (currentClassData.tier === 0) {
                    availableJobs = Object.keys(CLASSES).filter(j => CLASSES[j].tier === 1);
                } else if (currentClassData.next) {
                    availableJobs = currentClassData.next;
                }
                
                if (availableJobs.length === 0) return <div className="text-slate-500 text-center">더 이상 전직할 수 없습니다.</div>;

                return availableJobs.map(job => {
                    const cls = CLASSES[job];
                    const canChange = player.level >= cls.reqLv;
                    return (
                      <button key={job} onClick={() => changeJob(job)} disabled={!canChange} className={`p-4 rounded border text-left ${canChange ? 'bg-slate-800 border-purple-900 hover:border-purple-500' : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'}`}>
                        <div className="font-bold text-lg text-white mb-1">{job} <span className="text-xs text-slate-500">(Lv.{cls.reqLv})</span></div>
                        <div className="text-xs text-slate-400">{cls.desc}</div>
                      </button>
                    );
                });
            })()}
          </div>
          <button onClick={() => handleCommand('나가기')} className="mt-6 text-slate-500 hover:text-white">취소</button>
        </div>
      )}

      {/* 3. 퀘스트 UI */}
      {gameState === 'quest_board' && (
        <div className="absolute inset-0 bg-slate-900/95 z-10 p-4 overflow-y-auto">
          <h2 className="text-xl font-bold text-indigo-400 mb-4 text-center">📜 의뢰 게시판</h2>
          <div className="space-y-2">
            {questList.map(q => (
              <div key={q.id} className="bg-slate-800 p-3 rounded border border-slate-700">
                <div className="flex justify-between text-slate-200 font-bold mb-1"><span>{q.title}</span> <span className="text-xs text-slate-500">Lv.{q.minLv}+</span></div>
                <p className="text-xs text-slate-400 mb-2">{q.desc}</p>
                <div className="text-[10px] text-yellow-400 mb-2 flex gap-2">
                  <span>💰 {q.reward.gold}G</span> <span>✨ {q.reward.exp}EXP</span> <span>🎁 {q.reward.item || '없음'}</span>
                </div>
                {player.quests.some(pq => pq.id === q.id) ? 
                  <span className="text-xs text-green-500 block text-center border border-green-900 bg-green-900/20 py-1 rounded">수락됨</span> :
                  <button onClick={() => acceptQuest(q.id)} className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white py-1 rounded">수락하기</button>
                }
              </div>
            ))}
          </div>
          <button onClick={() => handleCommand('나가기')} className="w-full mt-4 bg-slate-700 text-slate-300 py-3 rounded font-bold">닫기</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-2 px-1 space-y-1">
        {logs.map(log => (
          <div key={log.id} className={`text-sm ${
            log.type === 'error' ? 'text-red-400 font-bold' :
            log.type === 'success' ? 'text-emerald-400' :
            log.type === 'combat' ? 'text-slate-200 border-l-2 border-red-800 pl-2 bg-red-950/20 py-1' :
            log.type === 'event' ? 'text-yellow-300 font-bold' :
            log.type === 'story' ? 'text-purple-300 italic pl-4 py-2 border-l-2 border-purple-500 bg-purple-900/10' :
            log.type === 'loading' ? 'text-slate-500 animate-pulse text-xs' : 'text-slate-400'
          }`}>
            {log.type === 'story' && <Bot size={14} className="inline mr-2" />}
            {log.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-2 border-t border-slate-800 pt-2">
        <ActionButtons setInput={setInput} handleCommand={handleCommand} />
      </div>
      <form onSubmit={e => { e.preventDefault(); handleCommand(input); setInput(''); }} className="mt-2 flex gap-2">
        <span className="text-emerald-500 font-bold">❯</span>
        <input className="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-700 text-sm" placeholder="명령어 입력... (예: 사용 하급체력물약)" value={input} onChange={e => setInput(e.target.value)} />
      </form>
    </div>
  );
};

const SidePanel = () => {
  const { player, getFullStats, useItem, sideTab, setSideTab } = useGame();
  const stats = getFullStats();

  const groupedInv = player.inv.reduce((acc, item) => {
    acc[item.name] = (acc[item.name] || 0) + 1;
    return acc;
  }, {});

  return (
    <aside className="w-72 hidden lg:flex flex-col gap-4">
      {/* 1. STATUS */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg">
        <h3 className="text-emerald-400 font-bold mb-3 text-sm flex items-center gap-2"><User size={16}/> STATUS</h3>
        <div className="space-y-2 text-xs text-slate-300">
          <div className="flex justify-between"><span>Lv.{player.level} {player.job}</span> <span className="text-yellow-400">{player.gold} G</span></div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative group">
             <div className="bg-red-500 h-full transition-all duration-300" style={{width: `${(player.hp/player.maxHp)*100}%`}}></div>
          </div>
          <div className="text-center text-[10px] text-slate-500">{player.hp} / {player.maxHp} HP</div>
          
          <div className="mt-1">
            <div className="flex justify-between text-[10px] text-slate-400"><span>EXP</span> <span>{Math.floor((player.exp/player.nextExp)*100)}%</span></div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
               <div className="bg-blue-500 h-full transition-all duration-300" style={{width: `${Math.min(100, (player.exp/player.nextExp)*100)}%`}}></div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
             <div className="flex justify-between"><span>공격력</span> <span className="text-white font-bold">{stats.atk} ({stats.elem})</span></div>
             <div className="flex justify-between"><span>방어력</span> <span className="text-white font-bold">{stats.def}</span></div>
             <div className="flex justify-between mt-2 text-slate-500">
               <span className="text-slate-400">무기</span> 
               <span className="text-slate-200 text-right truncate w-32">{player.equip.weapon.name}</span>
             </div>
             <div className="flex justify-between text-slate-500">
               <span className="text-slate-400">방어구</span>
               <span className="text-slate-200 text-right truncate w-32">{player.equip.armor.name}</span>
             </div>
          </div>
        </div>
      </div>

      {/* 2. TABBED PANEL (Inventory / Quest / Achievement) */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex-1 overflow-hidden flex flex-col">
        <div className="flex gap-4 mb-3 border-b border-slate-700 pb-2">
          <button onClick={() => setSideTab('inventory')} className={`text-xs font-bold flex items-center gap-1 ${sideTab === 'inventory' ? 'text-indigo-400' : 'text-slate-500'}`}>
            <Briefcase size={14}/> INVEN
          </button>
          <button onClick={() => setSideTab('quest')} className={`text-xs font-bold flex items-center gap-1 ${sideTab === 'quest' ? 'text-indigo-400' : 'text-slate-500'}`}>
            <ScrollText size={14}/> QUEST
          </button>
          <button onClick={() => setSideTab('achievement')} className={`text-xs font-bold flex items-center gap-1 ${sideTab === 'achievement' ? 'text-indigo-400' : 'text-slate-500'}`}>
            <Medal size={14}/> ACHV
          </button>
        </div>

        {sideTab === 'inventory' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {Object.keys(groupedInv).length === 0 ? <p className="text-xs text-slate-500 text-center py-4">가방이 비어있습니다.</p> : 
              Object.entries(groupedInv).map(([itemName, count], i) => {
                const item = player.inv.find(i => i.name === itemName); // 객체 찾기
                const isMat = item?.type === 'mat';
                return (
                  <div key={i} className="bg-slate-800/50 p-2 rounded border border-slate-700/50 group hover:border-slate-600">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-200 font-bold">{itemName} {count > 1 && <span className="text-slate-400">x{count}</span>}</span>
                      {!isMat && (
                        <button onClick={() => useItem(itemName)} className="text-[10px] bg-slate-700 hover:bg-emerald-700 text-slate-300 hover:text-white px-2 py-0.5 rounded transition-colors">
                          {item?.type==='hp' ? '사용' : '장착'}
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">{item?.desc_stat || '설명 없음'}</div>
                  </div>
                );
              })
            }
          </div>
        ) : sideTab === 'quest' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {player.quests.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">진행 중인 퀘스트가 없습니다.</p> :
              player.quests.filter(q => !q.completed).map((q, i) => {
                const data = QUEST_DATA[q.id];
                return (
                  <div key={i} className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                    <div className="text-xs text-slate-200 font-bold mb-1">{data.title}</div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{data.target} 처치</span>
                      <span>{q.progress} / {data.goal}</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all" style={{ width: `${Math.min(100, (q.progress/data.goal)*100)}%` }}></div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {ACHIEVEMENT_DATA.map((ach, i) => {
                    const isDone = player.achievements?.includes(ach.id);
                    return (
                        <div key={i} className={`p-2 rounded border ${isDone ? 'bg-emerald-900/20 border-emerald-800' : 'bg-slate-800/50 border-slate-700/50'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-xs font-bold ${isDone ? 'text-emerald-400' : 'text-slate-400'}`}>{ach.title}</span>
                                {isDone && <CheckCircle size={12} className="text-emerald-500"/>}
                            </div>
                            <p className="text-[10px] text-slate-500">{ach.desc}</p>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* 3. COMMANDS GUIDE */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg">
        <h3 className="text-slate-400 font-bold mb-2 text-sm flex items-center gap-2"><Key size={16}/> COMMANDS</h3>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500 font-mono">
          <span>• 이동 [장소]</span>
          <span>• 탐색 / 유해수습</span>
          <span>• 공격 / 도망</span>
          <span>• 기술 [이름]</span>
          <span>• 사용 [아이템]</span>
          <span>• 장착 [아이템]</span>
        </div>
      </div>
    </aside>
  );
};

const GameContent = () => {
  const { isGameStarted } = useGame();
  if (!isGameStarted) return <div className="flex h-screen bg-slate-950 items-center justify-center p-4"><StartScreen /></div>;
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-mono p-2 md:p-4 overflow-hidden">
      <header className="flex justify-between items-center mb-4 bg-slate-900 p-3 rounded border border-slate-800">
         <div className="font-bold flex items-center gap-2"><Sword size={20} className="text-emerald-500"/> AETHERIA: ROGUELIKE</div>
         <div className="text-xs text-slate-500">v2.5</div>
      </header>
      <div className="flex-1 flex gap-4 overflow-hidden">
        <TerminalView />
        <SidePanel />
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; background: #1e293b; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; radius: 4px; }`}</style>
    </div>
  );
};

const App = () => {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
};

export default App;