# Aetheria RPG - Master Specification

**Version:** 3.8
**Last Updated:** 2026-09-10

---

## Overview

Aetheria RPG is a mobile-first text roguelike built with React, Firebase, Cloudflare Pages Functions, and Capacitor. It combines deterministic fallback narratives, optional AI-assisted stories, cloud synchronization, and a CLI-style interface.

## Current Content And Visual Coverage

- Playable jobs: `18`, each resolved through the canonical character-art manifest.
- World locations: `52`, each with a stable route medallion and production encounter pool.
- Monsters: `254` including `47` bosses. Every canonical name resolves to its own `160x160` portrait; unknown legacy names alone use the family fallback. V27 completes the approved semantic corrections:234 authored corrections and20 retained portraits. Earlier 눈보라 정령/머맨/스핑크스 defects are resolved; final69 corrections and retained20 have scoped static and actual390 UI acceptance. These are not254 bespoke originals or natural play-throughs.
- Equipment: `229` player identities (`117` weapons, `91` armors, `21` shields). Inventory, shop, and Codex use exact item art. Canonical character portraits are job-specific; wearable layers are image-failure fallback, not dynamically composited equipped-character art.
- Weapon handling preserves the production equipment rules: `61` two-handed and `56` one-handed weapons, with two-handed equipment clearing the offhand slot and all preview/equip paths sharing the same classification.
- Signature presentation: `25` exact wearable overlays across five registered signature sets. A two-handed signature contributes two set pieces and leaves offhand empty. Celestial completes at tier 2; worldtree, dragon-lord and shadow-lord define tiers 2/3, and dimension defines tier 2. Every advertised tier must have a legal inventory-action witness across the canonical jobs; a hand-built equipment object is not reachability evidence. Set activation, combat effect, discovery and visual quality are separate contracts.

The current completion plan is [게임 완성 설계와 실행 계획](superpowers/plans/2026-09-05-aetheria-game-completion.md). The approved S2 relic-lifetime and S3 visual-semantic corrections are implemented and scoped-verified. Final audit found a required-performance-metric false-PASS under correction; actual installed iPhone/lifecycle remains unverified. Successful builds or catalog coverage do not mean the whole Goal is complete.

---

## Architecture

### Frontend
- **Framework:** React 19 + Vite
- **State Management:** useReducer (gameReducer.js)
- **Styling:** TailwindCSS
- **Icons:** Lucide React

### Backend
- **Authentication:** Firebase Anonymous Auth
- **Database:** Firestore
- **AI Proxy:** Cloudflare Pages Functions
- **Hosting:** Cloudflare Pages

---

## Quality Standards

### Code Organization

| Rule | Description |
|------|-------------|
| **File Size** | Maximum 400 lines per file. Split larger files into modules. |
| **Pure Functions** | Prefer pure functions that return new state without side effects. |
| **Single Responsibility** | Each file should have one clear purpose. |

### React Best Practices

| Rule | Description |
|------|-------------|
| **Hooks Rules** | Never call useState/useEffect inside conditions or loops. |
| **Component Separation** | Modal/Panel components should be separate files. |
| **Prop Types** | Document expected props in JSDoc comments. |

### Constants & Configuration

```javascript
// ✅ GOOD: Use centralized constants
import { BALANCE } from './data/constants';
const cost = BALANCE.REST_COST;

// ❌ BAD: Magic numbers
const cost = 100;
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ShopPanel.jsx` |
| Hooks | camelCase with "use" prefix | `useGameEngine` |
| Constants | UPPER_SNAKE_CASE | `REST_COST` |
| Files (JS) | camelCase | `gameUtils.js` |

---

## Module Structure

```
src/
├── components/     # React UI components
├── data/           # Static game data (items, maps, classes)
├── reducers/       # State management
├── services/       # External service integrations (AI)
├── systems/        # Game logic modules (Combat, Quota, etc.)
└── utils/          # Helper functions
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `CombatEngine.js` | Pure combat calculation functions |
| `gameReducer.js` | Centralized state updates |
| `aiService.js` | AI narrative generation |
| `TokenQuotaManager.js` | Daily AI usage limits |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.8 | 2026-09-05 | 게임 완성 Goal, legal signature tier 계약 및 visual coverage/semantic completion 구분 |
| 3.7 | 2026-09-04 | Canonical content counts, monster portrait coverage, 1H/2H equipment presentation 기록 |
| 3.6 | 2026-02-04 | Technical debt clearance, CombatEngine extraction, Hooks fix, CLI Enhancement, Balance Adjustment |
| 3.5 | 2026-01-30 | AWS Lambda integration, error hardening |
| 3.4 | 2026-01-29 | Live-ops module, admin panel |

---

## Testing Guidelines

1. **Build Verification:** `npm run build` must succeed
2. **Lint Check:** `npm run lint` must pass
3. **Manual Testing:** Core flows (explore, combat, shop, rest)
