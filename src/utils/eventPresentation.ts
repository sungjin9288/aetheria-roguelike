import { getStructuredFallbackTransaction } from '../data/structuredFallbackEvents';
import { RELICS } from '../data/relics';

export type EventChoiceTone = 'reward' | 'recovery' | 'danger' | 'story' | 'unknown';

export interface EventChoicePreview {
    text: string;
    tone: EventChoiceTone;
}

export interface EventPanelCopy {
    title: string;
    kind: string;
}

/**
 * `outcome` 원소 모양 — `GameEvent.outcomes`(session.ts)는 생산자마다 달라 `unknown[]`로
 * 열려 있고, 이 파일은 그중 자신이 실제로 읽는 필드만 좁혀 읽는다(campfire buff/회복,
 * 체인 reward, 한정 조우 tone/tradeoff, 정찰 scoutEffect, 보스 게이지 gaugeEffect 등).
 */
interface EventOutcome {
    choiceIndex?: number;
    buff?: { atk?: number; turn?: number; turns?: number };
    hp?: number;
    mp?: number;
    gold?: number;
    exp?: number;
    item?: unknown;
    relic?: unknown;
    elite?: boolean;
    status?: unknown;
    tradeoff?: string;
    tone?: EventChoiceTone;
    scoutEffect?: string;
    gaugeEffect?: string;
    type?: string;
    reward?: { type?: string; amount?: number; relicId?: string };
    log?: string;
}

/**
 * `GameEvent`(session.ts)가 공유 필드만 담기 때문에, 이 파일이 실제로 읽는 생산자별
 * 전용 필드(모닥불 `isCampfire`, 보스 게이지 `bossName`)까지 더한 로컬 뷰.
 */
interface PresentationEvent {
    title?: string;
    desc?: string;
    isCampfire?: boolean;
    isScout?: boolean;
    isBossGaugeChallenge?: boolean;
    isBoundedEncounter?: boolean;
    _chainId?: string;
    bossName?: string;
    source?: string;
    fallbackTransactionId?: string;
    outcomes?: EventOutcome[];
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

const getChainPreview = (outcome: EventOutcome | null): EventChoicePreview => {
    const rewardType = outcome?.reward?.type;
    const rewardAmount = Number(outcome?.reward?.amount);
    if (rewardType === 'gold' && Number.isFinite(rewardAmount) && rewardAmount < 0) {
        const rewardRelic = RELICS.find((relic) => relic.id === outcome?.reward?.relicId);
        const relicText = rewardRelic ? ` · ${rewardRelic.name} 획득` : '';
        return { text: `이야기 진행 · 골드 ${Math.abs(rewardAmount)} 소모${relicText}`, tone: 'danger' };
    }
    const rewardText: Record<string, string> = {
        gold: '이야기 진행 · 골드 보상',
        item: '이야기 진행 · 장비 보상',
        legendary_item: '이야기 진행 · 특별 장비 보상',
        relic: '이야기 진행 · 유물 보상',
        combat_bonus: '이야기 진행 · 다음 전투 강화',
        stat_bonus: '이야기 진행 · 영구 능력 상승',
        info: '이야기 진행 · 새로운 단서',
    };
    if (rewardType && rewardText[rewardType]) return { text: rewardText[rewardType], tone: 'reward' };
    if (outcome?.type === 'chain_advance') return { text: '이야기가 다음 단계로 이어짐', tone: 'story' };
    if (outcome?.type === 'chain_advance_fail') return { text: '이야기의 흐름이 달라질 수 있음', tone: 'danger' };
    if (outcome?.type === 'nothing') return { text: '이번 원정에서 미룸 · 귀환 후 다시 선택 가능', tone: 'unknown' };
    return { text: '결과는 선택 뒤에 드러남', tone: 'unknown' };
};

const getGeneralPreview = (outcome: EventOutcome | null): EventChoicePreview => {
    if (!outcome) return { text: '결과는 선택 뒤에 드러남', tone: 'unknown' };

    // 2026-09 Wave 3 I1: 확장 어휘(정예/상태이상/유물/버프)는 숫자 보상보다 먼저 읽힌다 —
    //   위험을 고르는 순간 무엇이 걸려 있는지 선택 전에 보여야 "공정한 위험"이 된다.
    if (outcome.elite === true) {
        return { text: outcome.relic ? '정예 전투 · 유물 선택' : '정예 전투로 이어짐', tone: 'danger' };
    }
    if (outcome.status) {
        const rewarded = Number(outcome.gold) > 0 || Number(outcome.exp) > 0 || Boolean(outcome.item) || Boolean(outcome.relic);
        return { text: rewarded ? '보상 가능 · 상태이상 위험' : '상태이상 위험', tone: 'danger' };
    }
    if (outcome.relic) return { text: '유물 선택지가 열림', tone: 'reward' };
    if (outcome.buff?.turns) return { text: '다음 전투 강화', tone: 'reward' };

    const hasReward = Number(outcome.gold) > 0 || Number(outcome.exp) > 0 || Boolean(outcome.item) || Boolean(outcome.buff);
    const hasRecovery = Number(outcome.hp) > 0 || Number(outcome.mp) > 0;
    const hasDanger = Number(outcome.hp) < 0 || Number(outcome.mp) < 0;

    if (hasDanger && hasReward) return { text: '보상 가능 · 생명 손실 위험', tone: 'danger' };
    if (hasDanger) return { text: '생명 손실 위험', tone: 'danger' };
    if (hasReward && hasRecovery) return { text: '보상과 회복 가능', tone: 'reward' };
    if (hasReward) return { text: '보상 가능', tone: 'reward' };
    if (hasRecovery) return { text: '회복 가능', tone: 'recovery' };
    return { text: '결과는 선택 뒤에 드러남', tone: 'unknown' };
};

const getBoundedPreview = (outcome: EventOutcome | null): EventChoicePreview => {
    const text = formatEventText(outcome?.tradeoff) || '결과는 선택 뒤에 드러남';
    const tone = outcome?.tone;
    return tone === 'reward' || tone === 'danger' || tone === 'story'
        ? { text, tone }
        : { text, tone: 'unknown' };
};

export const getEventChoicePreview = (event: PresentationEvent | null | undefined, choiceIndex: number): EventChoicePreview => {
    const outcome = findOutcome(event, choiceIndex);
    const fallbackTransaction = event?.source === 'fallback'
        ? getStructuredFallbackTransaction(event?.fallbackTransactionId)
        : null;
    if (fallbackTransaction?.choiceIndex === choiceIndex) {
        return { text: fallbackTransaction.preview, tone: 'danger' };
    }
    if (event?.isCampfire) return formatCampfirePreview(outcome);
    if (event?.isScout) return scoutPreview[outcome?.scoutEffect ?? ''] || scoutPreview.unknown;
    if (event?.isBossGaugeChallenge) {
        return outcome?.gaugeEffect === 'challenge'
            ? { text: `${event.bossName || '구역 보스'} 전투 시작`, tone: 'danger' }
            : { text: '이번에는 물러남 · 다음 탐험에 다시 선택', tone: 'unknown' };
    }
    if (event?.isBoundedEncounter) return getBoundedPreview(outcome);
    if (event?._chainId) return getChainPreview(outcome);
    return getGeneralPreview(outcome);
};
