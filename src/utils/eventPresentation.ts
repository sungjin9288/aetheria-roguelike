import { findStructuredFallbackHiddenEvent, getStructuredFallbackTransaction } from '../data/structuredFallbackEvents';
import type { DimensionGraveRef, EventChoiceFeedback, EventChoiceTone, EventOutcome } from '../types/session.js';
import { BALANCE } from '../data/constants';
import { getDimensionGraveItemLabel } from './dimensionGrave';
import { RELICS } from '../data/relics';
import { MSG } from '../data/messages';
import { BOUNDED_ENCOUNTERS } from '../data/boundedEncounters';
import { mergeTempBuff, type TempBuffValue } from '../systems/tempBuffMerge';
import { getGoldIncome, type ChallengeHolder } from './challengeRules';

export type { EventChoiceTone };

export interface EventChoicePreview {
    text: string;
    tone: EventChoiceTone;
}

export interface EventPanelCopy {
    title: string;
    kind: string;
}

/**
 * `GameEvent`(session.ts)가 공유 필드만 담기 때문에, 이 파일이 실제로 읽는 생산자별
 * 전용 필드(모닥불 `isCampfire`, 보스 게이지 `bossName`)까지 더한 로컬 뷰.
 */
interface PresentationEvent {
    title?: string;
    desc?: string;
    choices?: readonly unknown[];
    isCampfire?: boolean;
    isScout?: boolean;
    isBossGaugeChallenge?: boolean;
    isDimensionGrave?: boolean;
    dimensionGrave?: DimensionGraveRef;
    isBoundedEncounter?: boolean;
    boundedEncounterId?: string;
    _chainId?: string;
    bossName?: string;
    source?: string;
    fallbackTransactionId?: string;
    outcomes?: EventOutcome[];
    choiceFeedback?: EventChoiceFeedback;
}

const unitLabels: Record<string, string> = {
    G: '골드',
    EXP: '경험',
    HP: '생명',
    MP: '기력',
};

export const formatEventText = (value: unknown) => String(value || '')
    .replace(/([+-])\s*(\d+)\s*(EXP|HP|MP|G)\b/gi, (_match, sign, amount, unit) => `${unitLabels[String(unit).toUpperCase()]} ${sign}${amount}`)
    .replace(/\b(\d+)\s*G\b/gi, '골드 $1')
    .replace(/\bATK\b/gi, '공격력')
    .replace(/\bDEF\b/gi, '방어력')
    .replace(/\bEXP\b/gi, '경험')
    .replace(/\bHP\b/gi, '생명')
    .replace(/\bMP\b/gi, '기력')
    .replace(/\bLv\.?\s*/gi, '레벨 ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 2026-10 U5: 결과 문구(`formatEventText`를 거친 것)가 적은 회복량을 실제로 오른 양으로 고친다.
 * 회복은 실효 최대치에서 멈추므로(`healWithinMax`) 모닥불 "생명 +80"이나 폴백 "(+50HP +30MP)"가 적은 양보다
 * 적게 오를 수 있다 — 적힌 수치가 결과의 명목 회복량과 같은 "생명 +N" · "기력 +N" 토큰만 바꾸고, 그 밖의 문구는
 * 그대로 둔다(수치를 말하지 않는 문구는 틀릴 것도 없다).
 */
export const reportActualRecovery = (
    text: string,
    nominal: { hp?: number; mp?: number },
    actual: { hp: number; mp: number },
): string => {
    let next = text;
    for (const [unit, key] of [['HP', 'hp'], ['MP', 'mp']] as const) {
        const stated = Number(nominal[key]);
        if (!(stated > 0) || actual[key] === stated) continue;
        next = next.replace(
            new RegExp(`${unitLabels[unit]} \\+${stated}(?!\\d)`, 'g'),
            `${unitLabels[unit]} +${actual[key]}`,
        );
    }
    return next;
};

/** 문구 속 골드 금액 하나를 실제로 받는 금액으로 다시 적는 규칙. `signed`가 true면 "골드 +N" 꼴만, false면 부호 없는 꼴만 고친다. */
export interface PaidGoldRestatement {
    nominal: number;
    paid: number;
    signed?: boolean;
}

/** 금액 바로 뒤에 올 수 있는 조사 글자 — 정규식은 뒤에 한글이 이어지지 않을 때만 조사로 본다("골드 60이상"의 '이'는 조사가 아니다). */
const NUMBER_PARTICLE_CLASS = MSG.NUMBER_PARTICLE_PAIRS.flat().join('');

/**
 * 2026-10 Wave 62 (원장 §61.4 C16): 결과 · 미리보기 문구(`formatEventText`를 거친 것)가 적은 골드 금액을 실제로 받는 금액으로 고친다 —
 * '빈손의 시작'이면 모든 골드 수입이 절반인데(`getGoldIncome`) 데이터 문구("(+500G)" · "골드 60을 찾아냈습니다")는 명목 금액이라
 * 읽은 숫자와 받은 숫자가 달랐다. 명목 금액과 같은 "골드 N" · "골드 +N" 토큰만 바꾸고(뒤따르는 조사도 맞춘다), 받는 금액이 명목과
 * 같으면 문구를 그대로 둔다(규칙이 없는 플레이어는 바이트 그대로). 한 번에 고쳐 바꾼 금액이 다른 규칙에 다시 걸리지 않는다.
 */
export const reportPaidGold = (text: string, restatements: readonly PaidGoldRestatement[]): string => {
    const active = restatements.filter((entry) => (
        Number.isFinite(entry.nominal) && entry.nominal > 0 && entry.paid !== entry.nominal
    ));
    if (active.length === 0) return text;
    const pattern = new RegExp(`${unitLabels.G} (\\+?)(\\d+)(?!\\d)(?:([${NUMBER_PARTICLE_CLASS}])(?![\\uAC00-\\uD7A3]))?`, 'g');
    return text.replace(pattern, (match: string, sign: string, digits: string, particle: string | undefined) => {
        const amount = Number(digits);
        const entry = active.find((candidate) => (
            candidate.nominal === amount && (candidate.signed === undefined || candidate.signed === (sign === '+'))
        ));
        if (!entry) return match;
        return `${unitLabels.G} ${sign}${entry.paid}${particle ? MSG.NUMBER_PARTICLE(particle, entry.paid) : ''}`;
    });
};

/** 받는 골드 하나(`nominal` → 이 플레이어가 실제로 받는 값)를 다시 적는 규칙 — 부호 있는 꼴 · 없는 꼴 모두. */
const paidGoldRestatement = (holder: ChallengeHolder, nominal: number, signed?: boolean): PaidGoldRestatement => ({
    nominal,
    paid: getGoldIncome(holder, nominal),
    ...(signed === undefined ? {} : { signed }),
});

export const getEventPanelCopy = (event: PresentationEvent | null | undefined): EventPanelCopy => {
    if (event?.isCampfire) return { title: '모닥불 앞에서', kind: '휴식처' };
    if (event?.isScout) return { title: '앞길 정찰', kind: '정찰' };
    if (event?.isBossGaugeChallenge) return { title: `${event.bossName || '구역 보스'}의 흔적`, kind: '보스' };
    if (event?.isBoundedEncounter) return { title: formatEventText(event.title) || '지역 사건', kind: '지역 사건' };
    if (event?._chainId) return { title: formatEventText(event.title) || '이어지는 이야기', kind: '이야기' };
    return { title: formatEventText(event?.title) || '뜻밖의 조우', kind: '조우' };
};

const findOutcome = (event: PresentationEvent | null | undefined, choiceIndex: number): EventOutcome | null => {
    const outcomes = Array.isArray(event?.outcomes) ? event.outcomes : [];
    if (event?._chainId) return outcomes[choiceIndex] || null;
    return outcomes.find((outcome: EventOutcome) => outcome?.choiceIndex === choiceIndex) || outcomes[choiceIndex] || null;
};

const formatCampfirePreview = (outcome: EventOutcome | null): EventChoicePreview => {
    if (outcome?.buff) {
        const attackPercent = Math.round((Number(outcome.buff.atk) || 0) * 100);
        const turns = Number(outcome.buff.turn) || 0;
        return {
            text: `다음 전투 공격력 +${attackPercent}%${turns > 0 ? ` · ${turns}턴` : ''}`,
            tone: 'reward',
        };
    }

    const recovery = [
        Number(outcome?.hp) > 0 && `생명 +${outcome?.hp}`,
        Number(outcome?.mp) > 0 && `기력 +${outcome?.mp}`,
    ].filter(Boolean).join(' · ');
    return recovery
        ? { text: recovery, tone: 'recovery' }
        : { text: '결과는 선택 뒤에 드러남', tone: 'unknown' };
};

const scoutPreview: Record<string, EventChoicePreview> = {
    combat: { text: '전투 확정 · 처치 보상 증가', tone: 'reward' },
    anomaly: { text: '전투 없이 이변과 유물 탐색', tone: 'story' },
    unknown: { text: '원래 탐험 흐름 · 결과 미지', tone: 'unknown' },
    elite: { text: '정예 전투 확정 · 승리 시 유물', tone: 'danger' },
};

/** 체인 보상 종류의 미리보기 이름 — 진행 머리말(`MSG.CHAIN_PREVIEW_PROGRESS`)이나 끝맺음 뒤에 붙는다. */
const chainRewardLabels: Record<string, string> = {
    gold: '골드 보상',
    item: '장비 보상',
    legendary_item: '특별 장비 보상',
    relic: '유물 보상',
    combat_bonus: '다음 전투 강화',
    // 2026-10 Wave 62 C2: 이야기 능력치 보상은 이번 여정 범위다(`storyStatBonus`, 사망 · 계승에서 사라진다) — '영구'는 계정 메타의 말이다.
    stat_bonus: MSG.CHAIN_PREVIEW_STAT_BONUS,
    info: '새로운 단서',
};

const getChainPreview = (outcome: EventOutcome | null): EventChoicePreview => {
    const rewardType = outcome?.reward?.type;
    const rewardAmount = Number(outcome?.reward?.amount);
    const isGoldCost = rewardType === 'gold' && Number.isFinite(rewardAmount) && rewardAmount < 0;
    // Wave 62 C3: 데이터가 전설 등급을 선언한 유물(`rarity: 'legendary'`)은 "전설 유물"이라 말한다 — 엔진이 그 등급에서 뽑는다.
    const rewardLabel = rewardType === 'relic' && outcome?.reward?.rarity === 'legendary'
        ? MSG.CHAIN_PREVIEW_LEGENDARY_RELIC
        : rewardType && !isGoldCost ? chainRewardLabels[rewardType] : undefined;
    // Wave 62 C19: 실제 전투를 여는 선택(`combat`)은 전투라고 말하고, 보상은 승리했을 때의 것이라고 말한다 — 지거나 물러나면
    //   단계가 그대로 남으므로 끝맺음 · 진행으로 보이면 안 된다.
    if (outcome?.combat) {
        return { text: MSG.CHAIN_PREVIEW_COMBAT(rewardLabel ?? null), tone: 'danger' };
    }
    // 2026-10: 체인을 닫는 선택이 먼저다 — 보상 종류를 먼저 읽던 동안 골드를 주는 실패 선택 3개가
    //   "이야기 진행 · 골드 보상"으로 보였다. 실패는 진행도를 'failed'로 고정하고(사망 · 계승도 넘어간다)
    //   다른 갈래가 없으므로 "흐름이 달라질 수 있음"도 거짓이었다. 남는 보상은 끝맺음 뒤에 붙인다.
    if (outcome?.type === 'chain_advance_fail') {
        return {
            text: rewardLabel ? `${MSG.CHAIN_PREVIEW_ENDS} · ${rewardLabel}` : MSG.CHAIN_PREVIEW_ENDS,
            tone: 'danger',
        };
    }
    if (isGoldCost) {
        const rewardRelic = RELICS.find((relic) => relic.id === outcome?.reward?.relicId);
        const relicText = rewardRelic ? ` · ${rewardRelic.name} 획득` : '';
        return { text: `이야기 진행 · 골드 ${Math.abs(rewardAmount)} 소모${relicText}`, tone: 'danger' };
    }
    if (rewardLabel) return { text: `${MSG.CHAIN_PREVIEW_PROGRESS} · ${rewardLabel}`, tone: 'reward' };
    if (outcome?.type === 'chain_advance') return { text: '이야기가 다음 단계로 이어짐', tone: 'story' };
    if (outcome?.type === 'nothing') return { text: '이번 원정에서 미룸 · 귀환 후 다시 선택 가능', tone: 'unknown' };
    return { text: '결과는 선택 뒤에 드러남', tone: 'unknown' };
};

const HP_LOSS_TEXT = '생명 손실 위험';

/**
 * 2026-10: 정예 · 상태이상 · 유물 · 버프 줄도 생명을 잃는 결과면 그 사실을 함께 보인다 — 이 줄들이 위험 판정보다
 * 먼저 반환하던 동안 생명을 잃는 폴백 결과 25개가 "다음 전투 강화" · "유물 선택지가 열림"으로만 보였다.
 */
const withHpLoss = (preview: EventChoicePreview, outcome: EventOutcome): EventChoicePreview => (
    Number(outcome.hp) < 0 ? { text: `${preview.text} · ${HP_LOSS_TEXT}`, tone: 'danger' } : preview
);

const getGeneralPreview = (outcome: EventOutcome | null): EventChoicePreview => {
    if (!outcome) return { text: '결과는 선택 뒤에 드러남', tone: 'unknown' };

    // 2026-09 Wave 3 I1: 확장 어휘(정예/상태이상/유물/버프)는 숫자 보상보다 먼저 읽힌다 —
    //   위험을 고르는 순간 무엇이 걸려 있는지 선택 전에 보여야 "공정한 위험"이 된다.
    if (outcome.elite === true) {
        return withHpLoss({ text: outcome.relic ? '정예 전투 · 유물 선택' : '정예 전투로 이어짐', tone: 'danger' }, outcome);
    }
    if (outcome.status) {
        const rewarded = Number(outcome.gold) > 0 || Number(outcome.exp) > 0 || Boolean(outcome.item) || Boolean(outcome.relic);
        return withHpLoss({ text: rewarded ? '보상 가능 · 상태이상 위험' : '상태이상 위험', tone: 'danger' }, outcome);
    }
    if (outcome.relic) return withHpLoss({ text: '유물 선택지가 열림', tone: 'reward' }, outcome);
    if (outcome.buff?.turns) return withHpLoss({ text: '다음 전투 강화', tone: 'reward' }, outcome);

    const hasReward = Number(outcome.gold) > 0 || Number(outcome.exp) > 0 || Boolean(outcome.item) || Boolean(outcome.buff);
    const hasRecovery = Number(outcome.hp) > 0 || Number(outcome.mp) > 0;
    const hasDanger = Number(outcome.hp) < 0 || Number(outcome.mp) < 0;
    const dangerText = Number(outcome.hp) < 0 ? HP_LOSS_TEXT : MSG.EVENT_PREVIEW_MP_LOSS;

    if (hasDanger && hasReward) return { text: `보상 가능 · ${dangerText}`, tone: 'danger' };
    if (hasDanger) return { text: dangerText, tone: 'danger' };
    if (hasReward && hasRecovery) return { text: '보상과 회복 가능', tone: 'reward' };
    if (hasReward) return { text: '보상 가능', tone: 'reward' };
    if (hasRecovery) return { text: '회복 가능', tone: 'recovery' };
    return { text: '결과는 선택 뒤에 드러남', tone: 'unknown' };
};

/**
 * 이 선택이 걸 강화 — 엔진의 환산과 같은 모양(이야기 `combat_bonus`: `eventActions` 체인 보상, 사건 `buff`: `applyOutcomeBuff`
 * 두 스키마). 강화를 걸지 않는 선택이면 null. 미리보기의 예측이 실제 정산과 같은지는
 * `tests/event-preview-reward-contract.test.js`가 실제 훅과 대조한다.
 */
const getIncomingBuff = (event: PresentationEvent | null | undefined, outcome: EventOutcome | null): TempBuffValue | null => {
    if (event?._chainId) {
        const reward = outcome?.reward;
        if (reward?.type !== 'combat_bonus') return null;
        return { atk: (reward.atkMult || 1.3) - 1, def: 0, turn: reward.duration || 5 };
    }
    const buff = outcome?.buff;
    if (!buff) return null;
    const isMultSchema = buff.atkMult !== undefined || buff.defMult !== undefined || buff.turns !== undefined;
    if (!isMultSchema) return { atk: 0, def: 0, turn: 0, ...buff, name: buff.name ?? null };
    const atk = Math.max(0, (Number(buff.atkMult) || 1) - 1);
    const def = Math.max(0, (Number(buff.defMult) || 1) - 1);
    const turn = Math.max(0, Number(buff.turns) || 0);
    return turn > 0 && (atk > 0 || def > 0) ? { atk, def, turn } : null;
};

/**
 * Wave 62 C6: 강화 칸은 더 센 쪽을 남긴다(`mergeTempBuff`) — 지금 걸린 강화가 더 세면 이 선택의 강화는 붙지 않는다고 말한다.
 * 지금 강화는 호출자가 넘긴다(이벤트 화면이 플레이어의 `tempBuff`를 넘긴다). 강화가 보상의 전부였으면 보상 어조를 거둔다.
 */
const withBuffKeptNotice = (
    preview: EventChoicePreview,
    event: PresentationEvent | null | undefined,
    outcome: EventOutcome | null,
    context: EventPreviewContext | undefined,
): EventChoicePreview => {
    const incoming = getIncomingBuff(event, outcome);
    if (!incoming || !context?.activeBuff) return preview;
    if (mergeTempBuff(context.activeBuff, incoming).kept !== 'current') return preview;
    return {
        text: `${preview.text} · ${MSG.EVENT_PREVIEW_BUFF_KEPT}`,
        tone: preview.tone === 'reward' ? 'unknown' : preview.tone,
    };
};

/** 한정 조우 선택지가 주는 골드(원장 `BOUNDED_ENCOUNTERS`) — 열린 이벤트의 칸은 문구 · 어조만 싣는다. */
const getBoundedOutcomeGold = (event: PresentationEvent | null | undefined, outcome: EventOutcome | null): number => {
    const encounter = BOUNDED_ENCOUNTERS.find((entry) => entry.id === event?.boundedEncounterId);
    const choice = encounter?.choices.find((entry) => entry.id === outcome?.choiceId);
    return Number(choice?.outcome.gold) || 0;
};

const getBoundedPreview = (
    event: PresentationEvent | null | undefined,
    outcome: EventOutcome | null,
    context: EventPreviewContext | undefined,
): EventChoicePreview => {
    // 2026-10 Wave 62 (원장 §61.4 C16): "골드 60을 바로 챙깁니다"는 실제로 받는 금액으로 적는다(정산은 `grantGold`).
    const text = reportPaidGold(
        formatEventText(outcome?.tradeoff),
        [paidGoldRestatement(context?.player, getBoundedOutcomeGold(event, outcome))],
    ) || '결과는 선택 뒤에 드러남';
    const tone = outcome?.tone;
    return tone === 'reward' || tone === 'danger' || tone === 'story'
        ? { text, tone }
        : { text, tone: 'unknown' };
};

/** 미리보기가 읽는 지금 상태 — 이벤트 밖의 값(지금 걸린 강화 · 골드 수입 규칙을 정하는 도전 조건)만 담는다. */
export interface EventPreviewContext {
    activeBuff?: TempBuffValue | null;
    /** 받는 골드를 정하는 플레이어 조각 — '빈손의 시작'이면 미리보기의 골드 금액이 실제로 받는 절반이다(`getGoldIncome`). */
    player?: ChallengeHolder;
}

export const getEventChoicePreview = (
    event: PresentationEvent | null | undefined,
    choiceIndex: number,
    context?: EventPreviewContext,
): EventChoicePreview => {
    // 2026-09 Wave 27 N1: 리듀서가 이 선택을 거부하고 이벤트를 열어 두었으면 그 이유가 먼저다 —
    //   이벤트 화면에는 로그가 그려지지 않으므로 이 줄이 플레이어가 보는 유일한 응답이다.
    const feedback = event?.choiceFeedback;
    if (feedback?.choiceIndex === choiceIndex && typeof feedback.text === 'string' && feedback.text) {
        return { text: feedback.text, tone: 'danger' };
    }
    const outcome = findOutcome(event, choiceIndex);
    const fallbackTransaction = event?.source === 'fallback'
        ? getStructuredFallbackTransaction(event?.fallbackTransactionId)
        : null;
    if (fallbackTransaction?.choiceIndex === choiceIndex) {
        // 2026-10 Wave 62 (원장 §61.4 C16): "골드 200 획득" · "이기면 골드 1000"은 받는 금액(지급액)이다 — 판돈(비용)은 그대로.
        return {
            text: reportPaidGold(fallbackTransaction.preview, [
                paidGoldRestatement(context?.player, fallbackTransaction.grossGold, false),
            ]),
            tone: 'danger',
        };
    }
    // 2026-10 Wave 62 C18: 결과를 숨기는 폴백 이벤트는 모든 선택지가 원장의 같은 문장을 쓴다 — 선택지마다 결과를 읽던 동안
    //   카드 · 크리스탈 · 암호 상자의 미리보기가 이기는 자리를 가리켰다. 판정과 같은 함수로 알아본다.
    const hiddenEvent = findStructuredFallbackHiddenEvent(event);
    if (hiddenEvent && choiceIndex >= 0 && choiceIndex < hiddenEvent.event.choices.length) {
        // 받는 골드(카드 · 암호 상자의 칸)는 실제로 받는 금액으로 적는다.
        const goldSlots = hiddenEvent.event.outcomes.filter((slot) => slot.gold > 0);
        return {
            text: reportPaidGold(hiddenEvent.preview, goldSlots.map((slot) => paidGoldRestatement(context?.player, slot.gold))),
            tone: hiddenEvent.tone,
        };
    }
    if (event?.isCampfire) return withBuffKeptNotice(formatCampfirePreview(outcome), event, outcome, context);
    if (event?.isScout) return scoutPreview[outcome?.scoutEffect ?? ''] || scoutPreview.unknown;
    if (event?.isBossGaugeChallenge) {
        return outcome?.gaugeEffect === 'challenge'
            ? { text: `${event.bossName || '구역 보스'} 전투 시작`, tone: 'danger' }
            : { text: '이번에는 물러남 · 다음 탐험에 다시 선택', tone: 'unknown' };
    }
    // Wave 70: 다른 차원의 묘비 — 침공은 실제 전투와 그 보상, 기도는 회복량, 지나침은 아무 일도 없다(엔진과 같은 수치).
    if (event?.isDimensionGrave) {
        if (outcome?.graveEffect === 'invade') {
            return { text: MSG.DIMENSION_GRAVE_PREVIEW_INVADE(getDimensionGraveItemLabel(event.dimensionGrave)), tone: 'danger' };
        }
        if (outcome?.graveEffect === 'pray') {
            return { text: MSG.DIMENSION_GRAVE_PREVIEW_PRAY(Math.round(BALANCE.DIMENSION_GRAVE_PRAYER_HEAL_RATIO * 100)), tone: 'recovery' };
        }
        return { text: MSG.DIMENSION_GRAVE_PREVIEW_LEAVE, tone: 'unknown' };
    }
    if (event?.isBoundedEncounter) return getBoundedPreview(event, outcome, context);
    if (event?._chainId) return withBuffKeptNotice(getChainPreview(outcome), event, outcome, context);
    return withBuffKeptNotice(getGeneralPreview(outcome), event, outcome, context);
};
