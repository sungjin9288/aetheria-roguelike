---
name: aetheria-dev
description: |
  Aetheria Roguelike 프로젝트 전용 개발 가이드. 이 프로젝트의 실제 아키텍처, 코딩 규칙, 패턴을 담고 있다.

  다음 상황에서 반드시 이 스킬을 사용할 것:
  - Aetheria 프로젝트에서 새 기능 추가, 버그 수정, 리팩토링을 할 때
  - 전투 시스템(CombatEngine), 게임 루프(useGameActions), 상태 관리(gameReducer)를 수정할 때
  - 새 몬스터, 아이템, 직업, 유물, 퀘스트 데이터를 추가할 때
  - Firebase 저장/불러오기, AI 이벤트 생성 코드를 다룰 때
  - 한국어 메시지, 밸런스 상수, 액션 타입을 추가하거나 변경할 때
  - 모바일(Capacitor/iOS/Android) 관련 작업을 할 때
  - 이 프로젝트에서 "어떻게 하면 되나요?"라고 물을 때
---

# Aetheria Roguelike 개발 스킬

사이버펑크 판타지 텍스트 기반 roguelike RPG. React 19 + Vite 7 + TailwindCSS + Firebase + Capacitor 스택.

---

## 핵심 원칙 (항상 지킬 것)

| 원칙 | 방법 |
|------|------|
| 모든 수치 | `BALANCE.*` from `src/data/constants.js` |
| 모든 한국어 텍스트 | `MSG.*` from `src/data/messages.js` |
| 모든 dispatch action type | `AT.*` from `src/reducers/actionTypes.js` |
| 모든 gameState 비교 | `GS.*` from `src/reducers/gameStates.js` |
| 모든 게임 데이터 접근 | `DB.*` from `src/data/db.js` |
| 로그 출력 | `addLog(type, text)` 함수 |
| 상태 업데이트 | immutable spread (`{...state}`) |
| CombatEngine | pure function만 — side effect 절대 금지 |

---

## 아키텍처 개요

```
useGameEngine (useReducer + hook 조합)
  ├── useFirebaseSync      → 부팅/인증/세이브 사이클
  ├── createGameActions    → 이동/탐험/휴식/퀘스트
  ├── createCombatActions  → 전투 (attack/skill/defend/escape)
  └── createInventoryActions → 아이템 사용/장착/판매
```

**상태 흐름**: 모든 게임 상태는 `gameReducer.js`의 `INITIAL_STATE`가 단일 진실 원천. 컴포넌트는 렌더링만 담당하고, 로직은 `hooks/`, `systems/`, `utils/`에 둔다.

---

## 1. 상태 관리 패턴

### SET_PLAYER 함수형 payload (현재 상태 의존 업데이트)
```javascript
// GOOD: 함수형 payload로 현재 player 참조
dispatch({
  type: AT.SET_PLAYER,
  payload: (p) => ({ ...p, hp: p.hp - damage, gold: p.gold + reward })
});

// BAD: 클로저에서 오래된 player 캡처 위험
dispatch({ type: AT.SET_PLAYER, payload: { ...player, hp: player.hp - damage } });
```

### gameState 전환
```javascript
dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
// GS: IDLE, COMBAT, EVENT, MOVING, SHOP, JOB_CHANGE, QUEST_BOARD, DEAD, ASCENSION, TRUE_ENDING
```

### 로그 추가
```javascript
addLog('system', MSG.SOME_MESSAGE);       // 시스템 메시지
addLog('combat', MSG.COMBAT_ATTACK(name, dmg)); // 전투 로그
addLog('item', MSG.ITEM_FOUND(item.name)); // 아이템 로그
```

---

## 2. 전투 시스템

### CombatEngine 사용 패턴
`src/systems/CombatEngine.js`는 완전히 pure function. 항상 새 객체를 반환하고 외부 상태를 변경하지 않는다.

```javascript
import { CombatEngine } from '../systems/CombatEngine.js';

// 데미지 계산
const result = CombatEngine.calculateDamage(stats, {
  baseDamage: stats.atk,
  element: skill.element,   // optional
  isCrit: Math.random() < BALANCE.CRIT_CHANCE,
  isGuarded: enemy.guarding,
});
// result: { damage, isCrit, element, multiplier }

// 적에게 상태이상 적용
const newEnemy = CombatEngine.applyStatusEffectToEnemy(enemy, {
  type: 'poison',   // poison, burn, bleed, stun, freeze, blind, fear, curse
  duration: 3,
  value: statusVal,
});

// 상태이상 틱 (매 턴 호출)
const { enemy: updatedEnemy, logs: dotLogs } = CombatEngine.tickEnemyStatus(
  enemy, logs, curseAmpMult, synergyDotMult
);

// 치명타 시 MP 회복
const { player: newPlayer, logs: mpLogs } = CombatEngine.applyCritMpRestore(
  player, playerRelics, logs
);

// 사망 방지 (유물 효과)
const { player: survivedPlayer, logs: fatalLogs } = CombatEngine.applyFatalProtection(
  player, playerRelics, incomingDamage, logs, activeSynergies
);
```

### 전투 루프 흐름
```
1. attack() / skill() / defend() / escape()
   ↓
2. getFullStats() → 현재 스탯 계산
   ↓
3. CombatEngine.calculateDamage() → 데미지 계산
   ↓
4. CombatEngine.applyFatalProtection() → 사망 방지 체크
   ↓
5. dispatch(AT.SET_PLAYER) + dispatch(AT.SET_ENEMY) → 상태 반영
   ↓
6. addLog() → 전투 로그 출력
   ↓
7. endTurn() → pendingEnemyTurn ref로 적 턴 지연 실행
   ↓
8. 적 사망 시 → 경험치/골드/아이템 지급 → GS.IDLE 전환
```

### enemy turn cleanup 필수
전투 종료(도망/사망/이벤트 전환) 시 반드시:
```javascript
if (pendingEnemyTurn.current) {
  clearTimeout(pendingEnemyTurn.current);
  pendingEnemyTurn.current = null;
}
```
누락하면 전투 종료 후 적이 계속 공격하는 버그 발생.

---

## 3. 스탯 계산 시스템

### getFullStats() 계산 순서
`useGameEngine.js`의 `getFullStats(player)`는 이 순서로 계산:
```
1. 기본 스탯 (atk, def, hp, mp)
2. + 직업 mod (hpMod, mpMod, atkMod)
3. + 장비 프로파일 (equipmentUtils.getEquipmentProfile)
4. × 유물 배율 (relicAtkMult, relicDefMult, relicHpMult)
5. + 도감 보너스 (killCount 기반)
6. + 강화 보너스 (BALANCE.ENHANCE_STAT_BONUS × level)
7. + 세트 보너스 (장비 prefix 매칭)
8. + 패시브 스킬 보너스
9. + 칭호 패시브
10. + 특성 보너스
11. × 시너지 배율 (activeSynergies 기반)
```

### 양손/쌍검 무기 규칙
```javascript
// 양손무기: ATK × BALANCE.TWO_HAND_ATK_BONUS (1.55)
// 쌍검: ATK × BALANCE.DUAL_WIELD_ATK_BONUS (1.05), DEF × BALANCE.DUAL_WIELD_DEF_MULT (0.92)
```

---

## 4. 탐험 & 이벤트 롤 시스템

`src/utils/exploreUtils.js`의 `rollExplorationEvent()` 우선순위:
```
1. 열쇠 이벤트 (has "잊혀진 열쇠" + map level ≥ 10)
2. 변칙 현상 (BALANCE.ANOMALY_PITY_PER_EXPLORE 누적)
3. 유물 발견 (BALANCE.RELIC_PITY_PER_EXPLORE 누적, 최대 BALANCE.RELIC_FIND_MAX_CHANCE)
4. 아무 일도 없음 (BALANCE.EVENT_CHANCE_NOTHING)
5. 적 조우 → spawnEnemy()
```

### 탐험 결과 dispatch 패턴
```javascript
// 유물 발견 → 3선택 팝업
dispatch({ type: AT.SET_PENDING_RELICS, payload: threeRelics });
dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });

// 일반 전투 시작
dispatch({ type: AT.SET_ENEMY, payload: spawnedEnemy });
dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });

// 이벤트 체인
dispatch({ type: AT.SET_EVENT, payload: eventData });
dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
```

---

## 5. 데이터 구조 패턴

### 새 아이템 추가 (`src/data/items.js`)
```javascript
{
  id: 'unique_snake_case_id',   // 저장 키 — 절대 변경 금지
  name: '한국어 이름',
  type: 'weapon',               // weapon, armor, shield, accessory, consumable
  tier: 2,                      // 1-5
  rarity: 'rare',               // common, uncommon, rare, epic, legendary
  atk: 45, def: 0,              // 0이면 생략 가능
  element: 'fire',              // optional: fire, ice, lightning, dark, light
  effect: 'on_crit_burn',       // optional: 특수 효과 ID
  desc: '간단한 설명',
  price: 800,
}
```

### 새 몬스터 추가 (`src/data/monsters.js`)
```javascript
{
  id: 'monster_id',
  name: '몬스터 이름',
  hp: 120, atk: 25, def: 10,
  exp: 40, gold: 20,
  element: 'fire',              // optional
  skills: [                     // 보스 전용 스킬 패턴
    { name: '스킬명', mp: 0, type: '마법', mult: 2.0, effect: 'burn' }
  ],
  phase2?: { threshold: 0.5, atkMult: 1.5, newSkills: [...] },  // 보스 2페이즈
  loot: ['item_id_1', 'item_id_2'],
  area: ['지역명1', '지역명2'],   // 등장 지역
}
```

### 새 직업 추가 (`src/data/classes.js`)
```javascript
'직업명': {
  tier: 2,
  reqLv: 20,
  desc: '직업 설명',
  hpMod: 1.3, mpMod: 0.8, atkMod: 1.4,
  skills: [
    { name: '스킬명', mp: 15, type: '물리', mult: 2.0, desc: '스킬 설명' },
    { name: '패시브명', passive: true, effect: 'atk_up', val: 10, desc: '패시브 설명' },
  ],
  skillBranches: {           // optional: 스킬 분기 시스템
    '스킬명': [
      { choice: 'A', label: '선택 A', desc: '설명', override: { mult: 2.5 } },
      { choice: 'B', label: '선택 B', desc: '설명', override: { mult: 1.8, effect: 'stun', effectChance: 0.3 } },
    ]
  },
  next: ['상위직업1', '상위직업2'],
}
```

### 새 유물 추가 (`src/data/relics.js`)
```javascript
{
  id: 'relic_id',           // 저장 키 — 절대 변경 금지
  name: '유물 한국어 이름',
  rarity: 'rare',
  desc: '효과 설명 (한국어)',
  effect: 'effect_type_id', // useGameEngine의 getFullStats에서 처리
  val: 0.15,                // 또는 { atk: 0.2, def: -0.1 }
}
```

---

## 6. Firebase 저장/불러오기 패턴

### 부팅 단계 (`src/hooks/useFirebaseSync.js`)
```
bootStage: 'init' → 'auth' → 'config' → 'data' → 'ready'
```
`bootStage !== 'ready'`이면 게임 렌더링 금지 (race condition 방지).

### 저장 구조
- 경로: `artifacts/aetheria-rpg/users/{uid}`
- 500ms debounce로 저장 (과도한 write 방지)
- `CONSTANTS.DATA_VERSION = 5.0` — save 구조 변경 시 버전 bump 필수
- 구조 변경 시 `gameUtils.migrateData()` 업데이트 병행

### 오프라인 fallback
Firebase 인증 실패 또는 오프라인 환경에서도 전체 게임플레이 가능. 강제 오프라인 모드:
```javascript
// useFirebaseSync.js에서 isSmokeRuntime() 또는 타임아웃(8s) 시 offline 전환
```

### INITIAL_STATE 변경 주의
- 필드 **추가**: 자유롭게 가능
- 필드 **제거 또는 이름 변경**: `migrateData()` 없이 불가 (기존 Firebase 세이브 깨짐)

---

## 7. AI 이벤트 생성 패턴

`src/services/aiService.js`:

```javascript
// 이벤트 생성 (탐험 중 특별 이벤트)
const event = await AI_SERVICE.generateEvent(loc, history, uid, context);

// 내러티브 생성 (전투 승리, 레벨업 등)
const story = await AI_SERVICE.generateStory(type, data, uid);
// type: 'encounter' | 'victory' | 'death' | 'levelUp' | 'rest' |
//       'bossPhase2' | 'questComplete' | 'ruinRecap'
```

**할당량 관리**: 일일 `BALANCE.DAILY_AI_LIMIT`(50)회 제한. 초과 시 `getFallback(type, data)` 자동 사용.

**오프라인 fallback**: `AI_SERVICE.getFallback()`이 사전 제작된 한국어 이벤트 풀에서 선택.

---

## 8. 퀘스트/업적 시스템

```javascript
// 퀘스트 수락
dispatch({ type: AT.SET_PLAYER, payload: (p) => ({
  ...p,
  quests: { ...p.quests, [questId]: { status: 'active', progress: 0 } }
}) });

// 퀘스트 진행 업데이트
dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { key: 'kills', delta: 1 } });

// 도감 등록 (킬 카운트)
dispatch({ type: AT.UPDATE_CODEX, payload: { category: 'monsters', name: enemy.name } });
```

---

## 9. 아이템 생성 유틸리티

```javascript
import { makeItem, getItemRarity } from '../utils/gameUtils.js';

// DB 아이템으로부터 인스턴스 생성 (고유 ID 자동 부여)
const item = makeItem(DB.ITEMS.find(i => i.id === 'iron_sword'));
// item.instanceId = `${Date.now()}_${random}` 형태

// 인벤토리에 추가
dispatch({ type: AT.SET_PLAYER, payload: (p) => ({
  ...p,
  inv: [...p.inv, item]
}) });
```

---

## 10. 모바일 (Capacitor) 주의사항

- **viewport**: `100dvh` 사용 (iOS Safari 주소창 때문에 `100vh` 사용 금지)
- **safe area**: `env(safe-area-inset-*)` — `MainLayout.jsx`에서 이미 처리 중, 중복 적용 주의
- **빌드**: `npm run cap:sync` 후 각 플랫폼 빌드
- **청크**: `vite.config.js`의 `manualChunks` — 대형 라이브러리 추가 시 청크 분리 검토

---

## 11. 자주 쓰는 패턴 예시

### 탐험 후 경험치/골드 지급
```javascript
dispatch({
  type: AT.SET_PLAYER,
  payload: (p) => ({
    ...p,
    exp: p.exp + gainedExp,
    gold: p.gold + gainedGold,
    stats: { ...p.stats, totalKills: (p.stats.totalKills || 0) + 1 }
  })
});
addLog('combat', MSG.VICTORY(gainedExp, gainedGold));
```

### 레벨업 체크
```javascript
// gameReducer의 SET_PLAYER 내부 또는 useGameActions에서
if (player.exp >= player.nextExp) {
  const newLevel = player.level + 1;
  const newNextExp = Math.floor(BALANCE.BASE_EXP * Math.pow(BALANCE.EXP_SCALE_RATE, newLevel - 1));
  addLog('system', MSG.LEVEL_UP(newLevel));
  dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, level: newLevel, nextExp: newNextExp }) });
}
```

### 새 BALANCE 상수 추가
```javascript
// src/data/constants.js의 BALANCE 객체에 추가
export const BALANCE = {
  // 기존 상수들...
  NEW_FEATURE_CHANCE: 0.15,   // 새 기능 발동 확률 15%
  NEW_FEATURE_MULT: 2.0,      // 새 기능 배율
};
```

### 새 MSG 추가
```javascript
// src/data/messages.js의 MSG 객체에 추가
export const MSG = {
  // 기존 메시지들...
  NEW_EVENT: (name) => `${name}에서 특별한 일이 발생했습니다.`,
  NEW_REWARD: '특별 보상을 획득했습니다!',
};
```

---

## 빠른 참조

| 무엇을 하려는가 | 어느 파일을 봐야 하나 |
|---|---|
| 전투 데미지 수식 수정 | `src/systems/CombatEngine.js` |
| 게임 상태 머신 수정 | `src/reducers/gameReducer.js` + `gameStates.js` |
| 탐험 로직 수정 | `src/hooks/useGameActions.js` + `src/utils/exploreUtils.js` |
| 전투 액션 수정 | `src/hooks/useCombatActions.js` |
| 밸런스 수치 조정 | `src/data/constants.js` (BALANCE 객체) |
| 한국어 메시지 추가 | `src/data/messages.js` (MSG 객체) |
| 아이템/몬스터/직업 추가 | `src/data/items.js` / `monsters.js` / `classes.js` |
| 유물/시너지 추가 | `src/data/relics.js` |
| Firebase 저장 구조 변경 | `src/utils/gameUtils.js` (migrateData) + `CONSTANTS.DATA_VERSION` bump |
| AI 이벤트 수정 | `src/services/aiService.js` |
| UI 컴포넌트 수정 | `src/components/` (로직은 절대 넣지 말 것) |
