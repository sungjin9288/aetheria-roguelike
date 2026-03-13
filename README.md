# Aetheria Roguelike

> 텍스트 기반 사이버펑크 판타지 RPG — 터미널 UI + 클라우드 세이브 + AI 이벤트 생성

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Version](https://img.shields.io/badge/version-v4.0-cyber)](#)
[![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20Vite%207%20%2B%20Firebase%2012-blue)](#)
[![License](https://img.shields.io/badge/license-Private-lightgrey)](#)

---

## 🛠 Tech Stack

| 레이어 | 기술 |
|--------|------|
| Framework | React 19 + Vite 7 |
| Styling | TailwindCSS + Custom Cyberpunk Theme |
| Animation | Framer Motion |
| Backend | Firebase 12 — Auth (익명) + Firestore (Cloud Save, Leaderboard) |
| State | `useReducer` + Custom Hooks (Hooks-based architecture) |
| Audio | Web Audio API (외부 에셋 불필요) |
| AI | Optional Proxy (Gemini / GPT — 이벤트 생성) |
| Mobile | Capacitor 8 (iOS + Android 네이티브 래핑) |

---

## 🎮 Features

### 핵심 게임플레이
- **듀얼 조작 UI** — 데스크톱은 터미널 커맨드, 모바일은 버튼 중심 진행
- **10가지 직업 클래스** — 각기 다른 스킬셋 + 전직 트리
- **22개 지역** — 레벨 요건 기반 잠금, 보스/심연/확장 구역 포함
- **퀘스트 & 업적 시스템** — 킬/탐색/골드 기반 미션
- **AI 이벤트 생성** — 위치별 맥락형 스토리 이벤트 (오프라인 폴백 포함)
- **성향 시스템** — 플레이 방식에 따라 전용 스킬과 패시브 보너스 변화

### ✨ 신규 확장 콘텐츠 (v4.0) — 로그라이크 & 프레스티지 시스템

| 시스템 | 설명 |
|------|------|
| 🔮 **유물 시스템** | 탐색 중 8% 확률로 유물 3지선다 선택 (런 당 최대 5개). 사망/리셋 시 소멸. EXP/골드/전투 등 30종 유물. |
| ⚡ **보스 페이즈 전환** | 보스 HP 50% 이하 시 이름/ATK/패턴 변경 + 상태이상 부여 (10개 보스 적용). |
| 🌟 **에테르 환생** | 마왕 처치 → 환생 선택. 레벨/인벤/유물 리셋, 영구 ATK+5/HP+25/MP+15 보너스 보존. 최대 10회, 고유 칭호 획득. |
| 🏆 **칭호 시스템** | 25개 달성 칭호 (킬/보스/레벨/재화/유물/프레스티지 등). 리더보드 표시, 활성 칭호 선택 가능. |
| 📋 **일일 프로토콜** | 매일 3개 미션 자동 생성 (처치/탐색/골드). 완료 시 에센스/아이템/유물 조각 보상. |
| 📈 **EXP 곡선 완화** | Lv25 그라인드 벽 해소: `nextExp *= 1.5` → `× 1.2`. 현상수배 보상 레벨 스케일링 적용. |

### ✨ 이전 확장 콘텐츠 (v3.9)
| 시스템 | 설명 |
|------|------|
| 🗡️ **무기 운용 시스템** | 한손 듀얼 운용(좌/우), 양손 전용 운용, 한손+방패 조합 지원 |
| 🔮 **무기 공명 마법** | 마법 계열 무기 장착 시 무기 속성 기반 스킬 자동 생성 |
| 🔗 **장비 세트 효과** | 특수 접두어 세트 장비 착용 시 추가 능력치 (HP, ATK, DEF 배율 증가) |
| 💀 **엘리트 몬스터** | 희귀 접두어를 가진 엘리트 몬스터 등장 (드롭률 및 스탯 대폭 증가) |
| 🌪️ **특수 환경 이상** | 탐색 시 무작위 기상 이변(독안개, 산성비, 마나 폭풍) 및 상태이상 발생 |
| 🗺️ **시크릿 던전** | 잊혀진 열쇠 아이템을 통해 숨겨진 '고대 보물고' 입장 가능 |
| 📖 **몬스터 도감 연구** | 처치 횟수에 따른 몬스터 연구 레벨업 및 영구 패시브 보너스 획득 |
| 📜 **일일 현상수배** | 퀘스트 탭에서 새로운 현상수배 의뢰 수주 및 대량의 보상 획득 |
| 🌌 **확장 지역 콘텐츠** | 기계 폐도/천공 정원/심해 회랑/에테르 관문 + 신규 몬스터/장비/퀘스트 |

### 🛠 UI / UX 기능 (v3.8)
| 기능 | 설명 |
|------|------|
| ⚔️ **PostCombatCard** | 전투 종료 시 데스크톱은 상세 카드, 모바일은 소형 결과 카드 + 핵심 제안 |
| 🎒 **SmartInventory** | 카테고리 탭 필터 + 장비 ATK/DEF 증감 미리보기 + 추천 장착 |
| 🧭 **OnboardingGuide** | 신규 유저 3단계 행동 가이드 (자동 완료 인식) |
| 🗺️ **MapNavigator** | 현재 위치 + 연결 지역 노드 맵 (레벨 잠금 표시) |
| ⌨️ **CommandAutocomplete** | 현재 상태에 맞는 커맨드 자동완성 드롭다운 |
| ⚡ **QuickSlot** | 소모품 3슬롯 즉시 사용 바 (전투/탐색 모두 사용 가능) |
| 📚 **SkillTreePreview** | 현재 스킬 목록 + 전직 직업 스킬 미리보기 |
| 🏆 **AchievementPanel** | 8개 업적 (킬/사망/골드/보스 기반) + 진행도 바 |
| 🤖 **Auto Explore** | HP 감시 자동 탐색 (최대 10회, 위험 시 자동 정지) |
| 💥 **Damage Flash** | HP 변화 시 색상 플래시 + 플로팅 데미지 숫자 |
| 📱 **모바일 무입력 모드** | 터치 버튼과 로그만으로 진행, 키보드 없이 핵심 루프 가능 |
| 🎯 **목표 가이드 HUD** | 현재 목표, 퀘스트 진행, 탐험 예보, 추천 행동을 HUD에서 즉시 확인 |

### 기타
- **PWA 지원** — iOS/Android 홈 화면 설치 가능
- **클라우드 자동 저장** — Firebase 익명 로그인 + Firestore 동기화
- **모바일 최적화** — 44px 터치 타겟, dvh 반응형 레이아웃
- **리더보드** — 전체 킬 수 기반 공개 랭킹
- **한국어 로그** — 전투/이벤트 메시지 완전 한국어 통일

---

## 🔧 최근 수정 (Hotfixes)

| # | 분류 | 내용 |
|---|------|------|
| B1 | 버그 | `gameReducer.js` — `CONSTANTS.LOG_MAX_SIZE` (undefined) → `BALANCE.LOG_MAX_SIZE` 수정 |
| B2 | 버그 | `useCombatActions.js` — PostCombatResult `loot` 중복 필드 제거 (`items`만 유지) |
| B3 | 버그 | `useGameActions.js` — `makeItem` / `findItemByName` 인라인 중복 제거 → `gameUtils` import 통합 |
| B4 | 버그 | `useCombatActions.js` — 적 반격 `setTimeout` cleanup 추가 (stale dispatch 방지) |
| B5 | 버그 | `CombatEngine.updateQuestProgress` — 퀘스트 역방향 매칭 제거 (false positive 방지) |
| Q1 | 품질 | `useGameEngine.js` — `handleCommand` `useCallback` 메모이제이션 적용 |
| Q2 | 품질 | `gameUtils.migrateData` — Firestore 스냅샷 직접 변이 방지 (deep clone 추가) |
| Q3 | 품질 | `constants.js` — `ADMIN_UIDS` 플레이스홀더 → `VITE_ADMIN_UIDS` 환경변수로 교체 |
| Q4 | 품질 | `ControlPanel.jsx` — FORMAT DRIVE `window.confirm` → 인라인 2단계 확인 UI 적용 |
| S1 | 시스템 | `constants.js` — `INV_MAX_SIZE`, `AUTO_EXPLORE_HP_THRESHOLD` 등 BALANCE 상수 추가 |
| S2 | 시스템 | `useAutoExplore.js` — 하드코딩 매직넘버 → `BALANCE` 상수 참조로 교체 |
| S3 | 시스템 | `useCombatActions.js` — 인벤 풀 체크 `>= 20` → `BALANCE.INV_MAX_SIZE` 교체 |
| S4 | 시스템 | **상태이상 DoT 구현** — `poison` / `burn` 상태이상 전투 턴마다 피해 적용 (`maxHp × 4%`) |

---

## 🏗 Architecture

### 상태 관리 흐름

```
App.jsx
  └── useGameEngine (중앙 엔진)
        ├── useReducer(gameReducer)     ← 모든 상태 단일 소유
        ├── createGameActions(deps)    ← 탐색/이벤트/이동/퀘스트
        ├── createCombatActions(deps)  ← 전투/스킬/도주
        ├── createInventoryActions(deps) ← 장비/소모품/상점
        ├── useFirebaseSync            ← 자동 저장/불러오기
        └── useAutoExplore             ← HP 감시 자동 탐색
```

### 핵심 설계 원칙
- **`CombatEngine.js`** — 순수 함수만 포함 (상태 반환, 부수효과 없음)
- **`BALANCE` 객체** — 모든 게임 밸런스 수치 중앙화 (`Object.freeze`)
- **`AT` 액션 타입** — 문자열 오타 방지용 상수 집합 (`actionTypes.js`)
- **`MSG` 객체** — 전체 메시지 한국어 단일 관리 (`messages.js`)

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+ (개발 환경: v24.13.1)
- npm
- Native builds: Xcode, Java 21, Android command-line tools or Android Studio

### Installation

```bash
# 1. 클론
git clone https://github.com/sungjin9288/aetheria-roguelike.git
cd aetheria-roguelike

# 2. 의존성 설치
npm install

# 3. 환경변수 설정 (.env.local)
# SECURITY.md 참고 — API 키는 절대 커밋하지 마세요
cp .env.example .env.local   # (파일이 있는 경우)

# 4. 개발 서버 실행
npm run dev

# 5. 네이티브 앱 동기화
npm run ios:sync
npm run android:sync
```

네이티브 빌드 상세 절차는 `docs/MOBILE_SETUP.md`, 릴리즈 명령 요약은 `docs/MOBILE_RELEASE.md`, 스토어 제출 단계별 가이드는 `docs/STORE_SUBMISSION_GUIDE.md`, 플레이 검증 순서는 `docs/PLAYTEST_CHECKLIST.md` 참고.

빠른 회귀 확인은 아래 순서로 돌릴 수 있습니다.

```bash
npm run test:unit
npm run test:smoke
./scripts/local-playtest.sh
```

### Environment Variables

| 변수 | 용도 |
|------|------|
| `VITE_USE_AI_PROXY` | AI 프록시 사용 여부 (`true`/`false`) |
| `VITE_AI_PROXY_URL` | AI 프록시 엔드포인트 URL |
| `VITE_ADMIN_UIDS` | 관리자 Firebase UID 목록 (쉼표 구분, 예: `uid1,uid2`) |
| Firebase 키들 | `VITE_FIREBASE_*` — Firebase 콘솔에서 발급 |

---

## 📂 Project Structure

```
src/
├── components/          # UI 컴포넌트
│   ├── Dashboard.jsx    # 상태/HUD + 인벤/퀘스트/업적/스킬/지도/시스템 탭
│   ├── TerminalView.jsx # 메인 로그 + 데스크톱 입력 / 모바일 로그 패널 + 퀵슬롯
│   ├── ControlPanel.jsx # 전투/이벤트/상점 컨트롤 (인라인 RESET 확인 UI 포함)
│   ├── PostCombatCard.jsx
│   ├── SmartInventory.jsx
│   ├── OnboardingGuide.jsx
│   ├── MapNavigator.jsx
│   ├── CommandAutocomplete.jsx
│   ├── QuickSlot.jsx
│   ├── SkillTreePreview.jsx
│   └── AchievementPanel.jsx
├── hooks/               # 게임 로직 훅
│   ├── useGameEngine.js # 중앙 엔진 (상태 + 액션 통합)
│   ├── useGameActions.js
│   ├── useCombatActions.js
│   ├── useInventoryActions.js
│   ├── useFirebaseSync.js
│   ├── useAutoExplore.js
│   └── useDamageFlash.js
├── systems/             # 코어 시스템
│   ├── CombatEngine.js  # 순수 함수 기반 전투 로직 (DoT 포함)
│   └── SoundManager.js  # Web Audio API 합성 음향
├── services/            # 외부 서비스
│   └── aiService.js     # AI 이벤트 생성 + 폴백 풀
├── reducers/
│   ├── gameReducer.js   # 전체 상태 + INITIAL_STATE
│   └── actionTypes.js   # AT 상수 (타입 안전 액션)
├── data/                # 게임 데이터
│   ├── constants.js     # BALANCE / CONSTANTS (Object.freeze)
│   ├── messages.js      # 전체 한국어 메시지 관리 (MSG)
│   ├── db.js            # 클래스/맵/퀘스트/아이템 DB
│   ├── items.js         # 아이템 정의
│   └── monsters.js      # 몬스터 + 보스 목록
└── utils/               # 공유 유틸
    ├── gameUtils.js     # makeItem, findItemByName, migrateData 등
    ├── commandParser.js
    ├── commandSuggestions.js
    └── equipmentUtils.js
```

---

## 🔒 Security

`SECURITY.md` 참고. **`.env.local` 커밋 금지.**

---

## 📝 License

Private Personal Project.
