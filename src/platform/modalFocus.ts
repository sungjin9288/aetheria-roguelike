/**
 * 전체 화면 오버레이(대화상자)의 포커스 범위 — React 비의존.
 *
 * 열린 대화상자 위에서만 키보드가 움직이게 한다:
 *  - 맨 위 대화상자만 살아 있다 — 그 조상 경로 밖의 형제 요소는 `inert`(포커스 · 클릭 · 보조 기술에서 빠진다)
 *  - Tab · Shift+Tab은 맨 위 대화상자 안에서 돈다(브라우저 밖으로도 새지 않는다)
 *  - Escape는 그 대화상자가 닫는 길을 줄 때만 닫는다(필수 선택 화면은 Escape로 닫히지 않는다)
 *  - 닫히면 연 요소로 포커스를 돌려준다. 연 요소가 사라졌으면 남은 대화상자, 없으면 본문(`MAIN_CONTENT_ID`)
 *
 * 대화상자가 여러 겹이면 `inert` 묶음은 맨 위 하나만 적용한다 — 겹마다 따로 걸면 아래 대화상자의 묶음이
 * 위 대화상자의 조상을 덮어 위 대화상자까지 죽는다. 원래부터 `inert`였던 요소는 건드리지 않는다.
 *
 * '맨 위'는 연 순서가 아니라 그려지는 순서다(`compareStackingOrder` — z-index, 같으면 문서 순서).
 * 늦게 읽히는(lazy) 아래 대화상자가 나중에 열려도 위에 보이는 대화상자가 살아 있다 — 연 순서로 고르던 동안
 * 위에 보이는 대화상자가 `inert`가 되어 누른 자리가 그 아래 대화상자로 빠졌다(귀환 정리 위의 유물 선택).
 */

export const MAIN_CONTENT_ID = 'aetheria-main';

const INERT_SKIP_TAGS: ReadonlySet<string> = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);

const TABBABLE_SELECTOR = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    'summary',
    '[tabindex]',
    '[contenteditable="true"]',
].join(',');

/** `inert` 대상을 고르는 데 필요한 최소 트리 모양(단위 테스트는 가짜 노드로 부른다). */
export interface InertTreeNode {
    readonly tagName: string;
    readonly parentElement: InertTreeNode | null;
    readonly children: ArrayLike<InertTreeNode>;
}

/**
 * 대화상자에서 `body`까지 올라가며 경로 밖의 형제를 모은다 — 이 요소들을 `inert`로 만들면
 * 대화상자와 그 조상만 살아 있다. 스크립트 · 스타일처럼 화면에 없는 요소는 건너뛴다.
 */
export function collectInertTargets<T extends InertTreeNode>(dialog: T): T[] {
    const targets: T[] = [];
    let current: InertTreeNode = dialog;
    while (current.tagName !== 'BODY' && current.parentElement) {
        const parent: InertTreeNode = current.parentElement;
        for (const sibling of Array.from(parent.children)) {
            if (sibling === current || INERT_SKIP_TAGS.has(sibling.tagName)) continue;
            targets.push(sibling as T);
        }
        current = parent;
    }
    return targets;
}

/** Tab 순환: 다음(또는 이전) 칸 번호. 지금 칸이 목록 밖(-1)이면 처음(또는 끝)으로 들어간다. */
export function getWrappedFocusIndex(count: number, current: number, backwards: boolean): number {
    if (count <= 0) return -1;
    if (current < 0 || current >= count) return backwards ? count - 1 : 0;
    if (backwards) return current === 0 ? count - 1 : current - 1;
    return current === count - 1 ? 0 : current + 1;
}

/** 쌓임 순서 판정에 필요한 계산된 스타일(`getComputedStyle`의 일부 — 단위 테스트는 객체로 넘긴다). */
export interface StackingStyle {
    readonly position: string;
    readonly zIndex: string;
    readonly display?: string;
    readonly opacity?: string;
    readonly transform?: string;
    readonly filter?: string;
    readonly backdropFilter?: string;
    readonly perspective?: string;
    readonly isolation?: string;
    readonly mixBlendMode?: string;
    readonly willChange?: string;
    readonly contain?: string;
}

/** 쌓임 순서 판정에 필요한 최소 트리 모양. */
export interface StackingTreeNode {
    readonly parentElement: StackingTreeNode | null;
    readonly children: ArrayLike<StackingTreeNode>;
}

const STACKING_WILL_CHANGE = /\b(?:position|z-index|opacity|transform|translate|scale|rotate|filter|backdrop-filter|perspective|isolation|mix-blend-mode)\b/;
const STACKING_CONTAIN = /\b(?:layout|paint|strict|content)\b/;
const FLEX_OR_GRID_DISPLAY = /\b(?:flex|grid)\b/;

const isStyleSet = (value: string | undefined, none: string): boolean => Boolean(value) && value !== none;

/** 이 요소가 자기 쌓임 맥락을 만드는가(CSS 쌓임 맥락 규칙 중 이 앱이 쓰는 것). */
export function createsStackingContext(style: StackingStyle, parentStyle: StackingStyle | null): boolean {
    if (style.position === 'fixed' || style.position === 'sticky') return true;
    if (style.zIndex !== 'auto') {
        if (style.position !== 'static') return true;
        if (FLEX_OR_GRID_DISPLAY.test(parentStyle?.display ?? '')) return true;
    }
    if (style.opacity !== undefined && style.opacity !== '' && Number(style.opacity) < 1) return true;
    if (isStyleSet(style.transform, 'none') || isStyleSet(style.filter, 'none')) return true;
    if (isStyleSet(style.backdropFilter, 'none') || isStyleSet(style.perspective, 'none')) return true;
    if (style.isolation === 'isolate' || isStyleSet(style.mixBlendMode, 'normal')) return true;
    if (style.willChange && STACKING_WILL_CHANGE.test(style.willChange)) return true;
    return Boolean(style.contain && STACKING_CONTAIN.test(style.contain));
}

function zIndexOf(style: StackingStyle): number {
    const value = Number.parseInt(style.zIndex, 10);
    return Number.isFinite(value) ? value : 0;
}

function pathToRoot<T extends StackingTreeNode>(node: T): T[] {
    const path: T[] = [];
    let current: StackingTreeNode | null = node;
    while (current) {
        path.push(current as T);
        current = current.parentElement;
    }
    return path;
}

/** 공통 조상 아래 경로(안 → 밖)에서 가장 바깥 쌓임 맥락의 z-index — 공통 조상 안에서 이 가지가 놓이는 층이다. */
function outerStackingLevel<T extends StackingTreeNode>(
    path: readonly T[],
    commonStyle: StackingStyle,
    readStyle: (node: T) => StackingStyle,
): number {
    for (let index = path.length - 1; index >= 0; index -= 1) {
        const style = readStyle(path[index]);
        const parentStyle = index + 1 < path.length ? readStyle(path[index + 1]) : commonStyle;
        if (createsStackingContext(style, parentStyle)) return zIndexOf(style);
    }
    return 0;
}

/**
 * 어느 쪽이 위에 그려지는가 — 양수면 `a`가 위, 음수면 `b`가 위, 0이면 견줄 수 없다(같은 요소 · 공통 조상 없음).
 * 공통 조상 아래에서 가장 바깥 쌓임 맥락의 z-index를 견주고, 같으면 문서 순서(뒤가 위)다.
 */
export function compareStackingOrder<T extends StackingTreeNode>(
    a: T,
    b: T,
    readStyle: (node: T) => StackingStyle,
): number {
    if (a === b) return 0;
    const pathA = pathToRoot(a);
    const pathB = pathToRoot(b);
    let common: T | null = null;
    while (pathA.length > 0 && pathB.length > 0 && pathA[pathA.length - 1] === pathB[pathB.length - 1]) {
        common = pathA.pop() ?? null;
        pathB.pop();
    }
    if (!common) return 0;
    // 한쪽이 다른 쪽의 조상이면 안쪽이 위에 그려진다.
    if (pathA.length === 0) return -1;
    if (pathB.length === 0) return 1;
    const commonStyle = readStyle(common);
    const levelA = outerStackingLevel(pathA, commonStyle, readStyle);
    const levelB = outerStackingLevel(pathB, commonStyle, readStyle);
    if (levelA !== levelB) return levelA > levelB ? 1 : -1;
    const siblings = Array.from(common.children);
    return siblings.indexOf(pathA[pathA.length - 1]) > siblings.indexOf(pathB[pathB.length - 1]) ? 1 : -1;
}

export type ModalKeyIntent = 'tab-forward' | 'tab-backward' | 'escape' | null;

export interface ModalKeyInput {
    readonly key: string;
    readonly shiftKey?: boolean;
    readonly altKey?: boolean;
    readonly ctrlKey?: boolean;
    readonly metaKey?: boolean;
    readonly isComposing?: boolean;
}

/** 대화상자가 가로채는 키. 한글 조합 중(`isComposing` · `Process`)의 키는 조합기의 것이다. */
export function resolveModalKeyIntent(input: ModalKeyInput): ModalKeyIntent {
    if (input.isComposing || input.key === 'Process') return null;
    if (input.key === 'Tab') {
        if (input.altKey || input.ctrlKey || input.metaKey) return null;
        return input.shiftKey ? 'tab-backward' : 'tab-forward';
    }
    if (input.key === 'Escape' || input.key === 'Esc') return 'escape';
    return null;
}

export interface ModalFocusScopeOptions {
    /** 지금의 닫기 처리기(없으면 Escape를 무시한다). 매번 읽으므로 최신 처리기가 불린다. */
    readonly getOnEscape?: () => (() => void) | undefined;
}

interface ModalScopeEntry {
    readonly element: HTMLElement;
    readonly returnTo: HTMLElement | null;
    readonly getOnEscape: () => (() => void) | undefined;
}

const scopeStack: ModalScopeEntry[] = [];
let appliedInert: HTMLElement[] = [];
let keyListenerInstalled = false;
// StrictMode는 ref를 붙였다 떼고 다시 붙인다 — 다시 붙을 때는 포커스가 이미 대화상자 안이라 연 요소를 다시 읽을 수 없다.
const rememberedReturnTo = new WeakMap<HTMLElement, HTMLElement | null>();

function releaseAppliedInert(): void {
    for (const element of appliedInert) element.inert = false;
    appliedInert = [];
}

const readComputedStackingStyle = (node: Element): StackingStyle => getComputedStyle(node);

/** 맨 위 대화상자 — 그려지는 순서로 고르고, 견줄 수 없으면 나중에 연 쪽이다. */
function getTopScope(): ModalScopeEntry | undefined {
    let top: ModalScopeEntry | undefined;
    for (const entry of scopeStack) {
        if (!top || compareStackingOrder<Element>(entry.element, top.element, readComputedStackingStyle) >= 0) top = entry;
    }
    return top;
}

function applyInertForTop(): void {
    releaseAppliedInert();
    const top = getTopScope();
    if (!top) return;
    const applied: HTMLElement[] = [];
    for (const target of collectInertTargets<HTMLElement>(top.element)) {
        if (target.inert) continue;
        target.inert = true;
        applied.push(target);
    }
    appliedInert = applied;
}

function isFocusable(element: HTMLElement): boolean {
    if (element.tabIndex < 0) return false;
    if ((element as HTMLButtonElement).disabled) return false;
    if (element.closest('[inert]')) return false;
    if (element.getClientRects().length === 0) return false;
    return getComputedStyle(element).visibility !== 'hidden';
}

export function getTabbableElements(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(isFocusable);
}

function focusElement(element: HTMLElement): void {
    element.focus({ preventScroll: true });
}

function handleTab(top: ModalScopeEntry, event: KeyboardEvent, backwards: boolean): void {
    event.preventDefault();
    const tabbables = getTabbableElements(top.element);
    if (tabbables.length === 0) {
        focusElement(top.element);
        return;
    }
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? tabbables.indexOf(active) : -1;
    const nextIndex = getWrappedFocusIndex(tabbables.length, currentIndex, backwards);
    focusElement(tabbables[nextIndex]);
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
    const top = getTopScope();
    if (!top) return;
    const intent = resolveModalKeyIntent(event);
    if (intent === 'tab-forward' || intent === 'tab-backward') {
        handleTab(top, event, intent === 'tab-backward');
        return;
    }
    if (intent === 'escape') {
        const onEscape = top.getOnEscape();
        if (!onEscape) return;
        event.preventDefault();
        event.stopPropagation();
        onEscape();
    }
}

function syncKeyListener(): void {
    const shouldListen = scopeStack.length > 0;
    if (shouldListen === keyListenerInstalled) return;
    if (shouldListen) document.addEventListener('keydown', handleDocumentKeyDown, true);
    else document.removeEventListener('keydown', handleDocumentKeyDown, true);
    keyListenerInstalled = shouldListen;
}

function captureReturnTo(element: HTMLElement): HTMLElement | null {
    if (rememberedReturnTo.has(element)) return rememberedReturnTo.get(element) ?? null;
    const active = document.activeElement;
    const returnTo = active instanceof HTMLElement && active !== document.body && !element.contains(active)
        ? active
        : null;
    rememberedReturnTo.set(element, returnTo);
    return returnTo;
}

function canReceiveFocus(element: HTMLElement | null): element is HTMLElement {
    return Boolean(element && element.isConnected && !element.closest('[inert]'));
}

function restoreFocusAfterClose(released: ModalScopeEntry): void {
    queueMicrotask(() => {
        if (scopeStack.some((entry) => entry.element === released.element)) return;
        rememberedReturnTo.delete(released.element);
        const active = document.activeElement;
        const focusLost = !active || active === document.body || released.element.contains(active) || !active.isConnected;
        if (!focusLost) return;
        const candidates: Array<HTMLElement | null> = [
            released.returnTo,
            getTopScope()?.element ?? null,
            document.getElementById(MAIN_CONTENT_ID),
        ];
        for (const candidate of candidates) {
            if (!canReceiveFocus(candidate)) continue;
            focusElement(candidate);
            if (document.activeElement === candidate) return;
        }
    });
}

/**
 * 대화상자를 연다. 돌려받은 함수가 닫는다(React 19 ref 정리 함수로 그대로 쓴다).
 */
export function openModalFocusScope(element: HTMLElement, options: ModalFocusScopeOptions = {}): () => void {
    const entry: ModalScopeEntry = {
        element,
        returnTo: captureReturnTo(element),
        getOnEscape: options.getOnEscape ?? (() => undefined),
    };
    scopeStack.push(entry);
    applyInertForTop();
    syncKeyListener();
    // 아래에 열린 대화상자는 포커스를 가져가지 않는다 — 포커스는 언제나 맨 위 대화상자 안이다.
    const top = getTopScope();
    if (top && !top.element.contains(document.activeElement)) focusElement(top.element);

    let released = false;
    return () => {
        if (released) return;
        released = true;
        const index = scopeStack.indexOf(entry);
        if (index >= 0) scopeStack.splice(index, 1);
        applyInertForTop();
        syncKeyListener();
        restoreFocusAfterClose(entry);
    };
}

/** 지금 열린 대화상자가 있는가 — 한 글자 단축키는 대화상자 위에서 멈춘다. */
export function isModalFocusScopeOpen(): boolean {
    if (scopeStack.length > 0) return true;
    return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null;
}
