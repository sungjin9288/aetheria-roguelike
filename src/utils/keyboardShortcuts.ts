/**
 * 한 글자 단축키(전투 1 · 2 · 3, 빠른 칸 Q · W · E) 판정 — DOM 비의존 순수 함수.
 *
 * 단축키가 멈추는 경우:
 *  - 플레이어가 기록 탭 설정에서 한 글자 단축키를 껐다(2026-10-26 소유자 결정 D23 · 감사 A11Y-02 — 음성 입력 · 스위치 조작에서
 *    낱글자가 의도치 않은 행동이 되지 않게) — 그때는 어떤 키도 아무 동작을 하지 않는다
 *  - 대화상자(전체 화면 오버레이)가 열려 있다 — 유물 선택 뒤에서 물약이 쓰이거나 공격이 나가던 결함
 *  - Ctrl · Cmd · Alt를 함께 눌렀다 — 브라우저 · 운영체제 단축키다
 *  - 한글 조합 중이다(`isComposing` · `Process`)
 *  - 입력 칸에 쓰는 중이다
 *
 * 키는 글자(`key`)가 아니라 자리(`code`)로 읽는다 — 한글 입력 상태에서 Q가 'ㅂ'를 돌려줘도 같은 단축키다.
 */

export type CombatShortcutCommand = 'attack' | 'skill' | 'escape';

export type GlobalShortcut =
    | { readonly kind: 'combat'; readonly command: CombatShortcutCommand }
    | { readonly kind: 'quickSlot'; readonly index: number };

export interface ShortcutKeyInput {
    readonly key: string;
    readonly code?: string;
    readonly ctrlKey?: boolean;
    readonly metaKey?: boolean;
    readonly altKey?: boolean;
    /** Shift + 숫자는 기호 입력이다(이전처럼 전투 단축키가 아니다). 빠른 칸은 대문자도 받는다. */
    readonly shiftKey?: boolean;
    readonly isComposing?: boolean;
    /** 이벤트 대상의 태그 이름(대문자) — 입력 칸이면 단축키가 아니다. */
    readonly targetTagName?: string | null;
    readonly targetIsContentEditable?: boolean;
}

export interface ShortcutContext {
    readonly inCombat: boolean;
    readonly modalOpen: boolean;
    /** 기록 탭 설정의 '한 글자 단축키'(`utils/playerSettings.isKeyboardShortcutsEnabled`) — 거짓이면 판정은 언제나 null이다. */
    readonly shortcutsEnabled: boolean;
}

const TEXT_ENTRY_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const COMBAT_CODES: Readonly<Record<string, CombatShortcutCommand>> = {
    Digit1: 'attack',
    Digit2: 'skill',
    Digit3: 'escape',
    Numpad1: 'attack',
    Numpad2: 'skill',
    Numpad3: 'escape',
};

const QUICK_SLOT_CODES: Readonly<Record<string, number>> = {
    KeyQ: 0,
    KeyW: 1,
    KeyE: 2,
};

// `code`가 비어 있는 환경(일부 가상 키보드 · 합성 이벤트)만 글자로 읽는다.
const COMBAT_KEYS: Readonly<Record<string, CombatShortcutCommand>> = { 1: 'attack', 2: 'skill', 3: 'escape' };
const QUICK_SLOT_KEYS: Readonly<Record<string, number>> = { q: 0, w: 1, e: 2 };

function resolveCombatCommand(input: ShortcutKeyInput): CombatShortcutCommand | null {
    if (input.shiftKey) return null;
    if (input.code) return COMBAT_CODES[input.code] ?? null;
    return COMBAT_KEYS[input.key] ?? null;
}

function resolveQuickSlotIndex(input: ShortcutKeyInput): number | null {
    if (input.code) return QUICK_SLOT_CODES[input.code] ?? null;
    return QUICK_SLOT_KEYS[input.key.toLowerCase()] ?? null;
}

export function resolveGlobalShortcut(input: ShortcutKeyInput, context: ShortcutContext): GlobalShortcut | null {
    if (context.shortcutsEnabled === false) return null;
    if (context.modalOpen) return null;
    if (input.ctrlKey || input.metaKey || input.altKey) return null;
    if (input.isComposing || input.key === 'Process') return null;
    if (input.targetIsContentEditable) return null;
    if (input.targetTagName && TEXT_ENTRY_TAGS.has(input.targetTagName.toUpperCase())) return null;

    if (context.inCombat) {
        const command = resolveCombatCommand(input);
        if (command) return { kind: 'combat', command };
    }
    const index = resolveQuickSlotIndex(input);
    if (index !== null) return { kind: 'quickSlot', index };
    return null;
}
