// 2026-10 디자인 기반(에테르 유리): 토큰의 정본은 src/index.css의 `--aether-*` 변수다. 여기서는 그 변수를 Tailwind 이름으로 연결만 한다.

/** 색 투명도 수식어(`border-white/8` · `text-slate-300/82`)는 Tailwind 기본 눈금(5 단위)에 없는 값이면 CSS가 생성되지 않는다.
 *  생성되지 않은 테두리는 preflight 기본 회색(#e5e7eb)으로 그려졌다(VD-01). 0 ~ 100 정수 전부를 둔다 — 쓰인 클래스만 생성되므로
 *  CSS가 커지지 않는다. `tests/tailwind-opacity-modifiers.test.js`가 src의 수식어가 모두 생성되는지 확인한다. */
const OPACITY_STEPS = Object.fromEntries(
  Array.from({ length: 101 }, (_, step) => [String(step), String(step / 100)]),
);

/** `--aether-<name>-rgb`(R G B 채널)를 투명도 수식어가 동작하는 색으로 잇는다. */
const channel = (name) => `rgb(var(--aether-${name}-rgb) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      opacity: OPACITY_STEPS,
      fontFamily: {
        readable: ['var(--aether-readable-font)'],
        // 표제 글꼴 — 지금은 본문 한글 묶음(굵기는 쓰는 곳이 정한다). 표제 전용 글꼴을 들일 때 변수 하나만 바꾼다.
        display: ['var(--aether-display-font)'],
        // Wave 69: 숫자 · 영문 · 기호만 Fira Code, 공백 · 한글은 본문 글꼴(src/index.css의 @font-face)
        fira: ['var(--aether-code-font)'],
      },
      colors: {
        ae: {
          void: channel('void'),
          bg: channel('bg'),
          s1: channel('s1'),
          s2: channel('s2'),
          s3: channel('s3'),
          s4: channel('s4'),
          sunk: channel('sunk'),
          ink: channel('ink'),
          'ink-2': channel('ink-2'),
          'ink-3': channel('ink-3'),
          ether: channel('ether'),
          'ether-hi': channel('ether-hi'),
          gold: channel('gold'),
          'gold-hi': channel('gold-hi'),
          'gold-lo': channel('gold-lo'),
          'gold-ink': channel('gold-ink'),
          'gold-text': channel('gold-text'),
          life: channel('life'),
          'life-lo': channel('life-lo'),
          will: channel('will'),
          'will-lo': channel('will-lo'),
          exp: channel('exp'),
          threat: channel('threat'),
          good: channel('good'),
          rarity: {
            common: channel('rarity-common'),
            uncommon: channel('rarity-uncommon'),
            rare: channel('rarity-rare'),
            epic: channel('rarity-epic'),
            legendary: channel('rarity-legendary'),
          },
        },
      },
      // 기본 rounded-* · shadow-* 키는 덮지 않는다 — 새 이름(ae-*)만 더한다.
      borderRadius: {
        'ae-xs': 'var(--aether-r-xs)',
        'ae-sm': 'var(--aether-r-sm)',
        'ae-md': 'var(--aether-r-md)',
        'ae-lg': 'var(--aether-r-lg)',
        'ae-xl': 'var(--aether-r-xl)',
      },
      boxShadow: {
        'ae-e1': 'var(--aether-e1)',
        'ae-e2': 'var(--aether-e2)',
        'ae-e3': 'var(--aether-e3)',
        'ae-gold': 'var(--aether-shadow-gold)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
