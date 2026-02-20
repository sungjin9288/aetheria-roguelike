# Aetheria Roguelike (Project Aetheria)

A text-based, terminal-style fantasy RPG built with modern web technologies. Optimized for mobile PWA and desktop play.

## 🛠 Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: TailwindCSS + Custom Cyberpunk Theme
- **Backend**: Firebase (Authentication, Firestore) for cloud save & leaderboard
- **State Management**: `useReducer` + Custom Hooks (Hooks-based architecture)
- **Audio**: Web Audio API (No external assets required)

## 🚀 Getting Started

### Prerequisites

- Node.js v18.0.0 or higher (Developed on v24.13.1)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd aetheria-roguelike
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment:
   - Copy `.env.example` to `.env` (if available) or set up your keys.
   - **Important**: This project uses `.env.local` for local API keys. See `SECURITY.md`.

4. Run Development Server:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

```
src/
├── components/   # UI Components (Terminal, Dashboard, etc.)
├── hooks/        # Game Logic Hooks (Core Engine, Combat, Inventory)
├── systems/      # Logic Systems (CombatEngine, SoundManager)
├── services/     # External Services (AI, Analytics)
├── data/         # Game Data (Items, Mobs, Maps)
└── reducers/     # Game State Reducer
```

## 🔒 Security

Please refer to `SECURITY.md` for guidelines on managing API keys and secrets. **Do not commit `.env.local`**.

## 📱 Features

- **PWA Support**: Installable on iOS/Android.
- **Auto-Save**: Cloud synchronization via Firebase.
- **Text-Based Interface**: Retro terminal aesthetic with modern UX.
- **AI Integration**: (Optional) generative storytelling features.

## 📝 License

Private Personal Project.
