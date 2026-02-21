# Aetheria Roguelike

> 텍스트 기반 사이버펑크 판타지 RPG — 터미널 UI + 클라우드 세이브 + AI 이벤트 생성

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20Vite%20%2B%20Firebase-blue)](#)
[![License](https://img.shields.io/badge/license-Private-lightgrey)](#)

---

## 🛠 Tech Stack

| 레이어 | 기술 |
|--------|------|
| Framework | React 19 + Vite |
| Styling | TailwindCSS + Custom Cyberpunk Theme |
| Animation | Framer Motion |
| Backend | Firebase Auth + Firestore (Cloud Save, Leaderboard) |
| State | `useReducer` + Custom Hooks (Hooks-based architecture) |
| Audio | Web Audio API (외부 에셋 불필요) |
| AI | Optional Proxy (Gemini / GPT — 이벤트 생성) |

---

## 🎮 Features

### 핵심 게임플레이
- **터미널 커맨드 UI** — `explore`, `move`, `attack`, `skill`, `rest`, `shop` 등
- **10가지 직업 클래스** — 각기 다른 스킬셋 + 전직 트리
- **13개 지역** — 레벨 요건 기반 잠금, 보스 특수 구역
- **퀘스트 & 업적 시스템** — 킬/탐색/골드 기반 미션
- **AI 이벤트 생성** — 위치별 맥락형 스토리 이벤트 (오프라인 폴백 포함)

### ✨ 신규 기능 (v3.8)
| 기능 | 설명 |
|------|------|
| ⚔️ **PostCombatCard** | 전투 종료 시 EXP/골드/전리품 요약 팝업 + HP/인벤 스마트 제안 |
| 🎒 **SmartInventory** | 카테고리 탭 필터 + 장비 ATK/DEF 증감 미리보기 + 추천 장착 |
| 🧭 **OnboardingGuide** | 신규 유저 3단계 행동 가이드 (자동 완료 인식) |
| 🗺️ **MapNavigator** | 현재 위치 + 연결 지역 노드 맵 (레벨 잠금 표시) |
| ⌨️ **CommandAutocomplete** | 현재 상태에 맞는 커맨드 자동완성 드롭다운 |
| ⚡ **QuickSlot** | 소모품 3슬롯 즉시 사용 바 (전투/탐색 모두 사용 가능) |
| 📚 **SkillTreePreview** | 현재 스킬 목록 + 전직 직업 스킬 미리보기 |
| 🏆 **AchievementPanel** | 8개 업적 (킬/사망/골드/보스 기반) + 진행도 바 |
| 🤖 **Auto Explore** | HP 감시 자동 탐색 (최대 10회, 위험 시 자동 정지) |
| 💥 **Damage Flash** | HP 변화 시 색상 플래시 + 플로팅 데미지 숫자 |

### 기타
- **PWA 지원** — iOS/Android 홈 화면 설치 가능
- **클라우드 자동 저장** — Firebase 익명 로그인 + Firestore 동기화
- **모바일 최적화** — 44px 터치 타겟, dvh 반응형 레이아웃
- **리더보드** — 전체 킬 수 기반 공개 랭킹
- **한국어 로그** — 전투/이벤트 메시지 완전 한국어 통일

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+ (개발 환경: v24.13.1)
- npm

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
```

### Environment Variables

| 변수 | 용도 |
|------|------|
| `VITE_USE_AI_PROXY` | AI 프록시 사용 여부 (`true`/`false`) |
| `VITE_AI_PROXY_URL` | AI 프록시 엔드포인트 URL |
| Firebase 키들 | `VITE_FIREBASE_*` — Firebase 콘솔에서 발급 |

---

## 📂 Project Structure

```
src/
├── components/          # UI 컴포넌트
│   ├── Dashboard.jsx    # 사이드 패널 (6 탭: 인벤/퀘스트/업적/스킬/지도/시스템)
│   ├── TerminalView.jsx # 메인 로그 + 커맨드 입력 + 자동완성 + 퀵슬롯
│   ├── ControlPanel.jsx # 전투/이벤트/상점 컨트롤
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
│   ├── useAutoExplore.js
│   └── useDamageFlash.js
├── systems/             # 코어 시스템
│   ├── CombatEngine.js
│   └── SoundManager.js
├── services/            # 외부 서비스
│   └── aiService.js     # AI 이벤트 생성 + 폴백 풀
├── reducers/
│   ├── gameReducer.js   # 전체 상태 + INITIAL_STATE
│   └── actionTypes.js   # AT 상수 (타입 안전 액션)
├── data/                # 게임 데이터 (DB, 맵, 클래스, 아이템)
└── utils/               # 공유 유틸 (gameUtils, commandSuggestions)
```

---

## 🔒 Security

`SECURITY.md` 참고. **`.env.local` 커밋 금지.**

---

## 📝 License

Private Personal Project.
