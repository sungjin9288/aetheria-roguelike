import type { Player } from '../types/player.js';

/**
 * 지난 여정에서 본 이야기 장면 (2026-11 재미 분석 G2 — 소유자 결정 Q4 "예").
 *
 * 이야기 체인 진행(`eventChainProgress`)은 Wave 108부터 사망 · 계승마다 처음부터다 — 같은 장면의 글을 다시 읽는다. 그 피로만
 * 덜어 준다: 이벤트 화면이 지난 여정에서 이미 지나간 단계의 '지금 상황'을 첫 문장으로 접고 '다시 읽기'로 편다. 표시만이다 —
 * 선택지 · 결과 · 진행 범위는 그대로다.
 *
 * 장부 `stats.storySceneLedger`는 체인마다 지난 여정들에서 닿은 가장 높은 진행 값(= 지나간 단계 수)이다. 쓰는 곳은
 * `pickPermanentPlayerState` 하나다(Wave 125 각인 장부와 같은 방식 — 단계를 지나는 지점마다 쓰지 않는다). 실패한 체인 · 한정 조우
 * 영수증처럼 숫자가 아닌 진행 값은 건너뛴다(어디까지 봤는지 모르는 값을 지어내지 않는다). 게임 판정은 이 장부를 읽지 않는다.
 */
export type StorySceneLedger = Record<string, number>;

const toProgress = (value: unknown): number | null => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
);

/** 저장된 장부 — 모양이 틀린 칸은 버린다(세이브는 남이 고칠 수 있는 데이터다). */
export const readStorySceneLedger = (value: unknown): StorySceneLedger => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const ledger: StorySceneLedger = {};
    for (const [chainId, progress] of Object.entries(value as Record<string, unknown>)) {
        const step = toProgress(progress);
        if (step !== null) ledger[chainId] = step;
    }
    return ledger;
};

/** 사망 · 계승 지점에서 넘길 장부 — 지난 장부 ∪ 이번 여정의 진행(체인마다 큰 값). */
export const collectStorySceneLedger = (player: Pick<Player, 'stats' | 'eventChainProgress'>): StorySceneLedger => {
    const ledger = readStorySceneLedger(player.stats?.storySceneLedger);
    for (const [chainId, progress] of Object.entries(player.eventChainProgress || {})) {
        const step = toProgress(progress);
        if (step !== null && step > (ledger[chainId] ?? 0)) ledger[chainId] = step;
    }
    return ledger;
};

/** 지난 여정에서 지나간 단계인가 — 이번 여정에서 지나간 단계는 다시 나오지 않으므로 장부만 본다. */
export const isStorySceneSeen = (
    player: Pick<Player, 'stats'> | null | undefined,
    chainId: string | null | undefined,
    step: number | null | undefined,
): boolean => {
    if (!chainId || typeof step !== 'number') return false;
    return (readStorySceneLedger(player?.stats?.storySceneLedger)[chainId] ?? 0) > step;
};

const FIRST_SENTENCE = /^[\s\S]*?[.!?…](?=\s|$)/;

/**
 * 접힌 장면의 첫 문장 — 문장이 하나뿐이면 null(접을 것이 없다). 따옴표 안의 마침표에서 끊기더라도 첫 줄은 장면을 떠올리는 실마리일 뿐이고
 * 전문은 '다시 읽기'가 보인다.
 */
export const getStorySceneExcerpt = (text: string | null | undefined): string | null => {
    const trimmed = String(text || '').trim();
    const match = trimmed.match(FIRST_SENTENCE);
    if (!match) return null;
    const excerpt = match[0].trim();
    return excerpt.length < trimmed.length ? excerpt : null;
};
