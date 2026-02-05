# Aetheria RPG - Master Specification

**Version:** 3.6  
**Last Updated:** 2026-02-04

---

## Overview

Aetheria RPG is a text-based roguelike game built with React, Firebase, and AWS Lambda. It features AI-powered dynamic narratives, real-time cloud synchronization, and a CLI-style interface.

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
- **AI Proxy:** AWS Lambda + API Gateway
- **Hosting:** Vercel

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
| 3.6 | 2026-02-04 | Technical debt clearance, CombatEngine extraction, Hooks fix, CLI Enhancement, Balance Adjustment |
| 3.5 | 2026-01-30 | AWS Lambda integration, error hardening |
| 3.4 | 2026-01-29 | Live-ops module, admin panel |

---

## Testing Guidelines

1. **Build Verification:** `npm run build` must succeed
2. **Lint Check:** `npm run lint` must pass
3. **Manual Testing:** Core flows (explore, combat, shop, rest)
