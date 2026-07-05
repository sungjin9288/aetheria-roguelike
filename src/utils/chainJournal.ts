/**
 * chainJournal.ts — 체인 저널(Quest 탭) 데이터 가공 순수 함수.
 *
 * eventChainProgress(player.eventChainProgress)와 EVENT_CHAINS 정의를 조합해
 * "진행 중(시작됐지만 미완료)"인 체인만 추려 QuestTab 렌더링용 엔트리로 변환한다.
 * 컴포넌트에는 로직을 넣지 않는다 (CLAUDE.md §5 DO).
 */
import { EVENT_CHAINS } from '../data/eventChains.js';

export interface JournalEntry {
    chainId: string;
    label: string;
    currentStep: number;
    totalSteps: number;
    /** 다음 스텝이 발동되는 지역. 체인이 이미 마지막 스텝 단계면 존재하지 않을 수 있음. */
    nextLoc: string | null;
}

/**
 * player.eventChainProgress를 기반으로 "시작됐고 아직 완료되지 않은" 체인들의
 * 저널 엔트리 목록을 만든다. 완료(step >= steps.length)되었거나 실패('failed')
 * 처리되었거나 아직 시작되지 않은(step 0/미존재) 체인은 제외한다.
 */
export function buildChainJournal(
    eventChainProgress: Record<string, number | 'failed'> | null | undefined,
    chains: any[] = EVENT_CHAINS,
): JournalEntry[] {
    const progress = eventChainProgress || {};

    return chains.reduce((entries: JournalEntry[], chain: any) => {
        const rawStep = progress[chain.id];

        if (rawStep === 'failed') return entries;

        const currentStep = typeof rawStep === 'number' ? rawStep : 0;
        const totalSteps = chain.steps.length;

        // 미시작 또는 완료된 체인은 저널에 표시하지 않음.
        if (currentStep <= 0 || currentStep >= totalSteps) return entries;

        const nextStepData = chain.steps[currentStep];

        entries.push({
            chainId: chain.id,
            label: chain.label,
            currentStep,
            totalSteps,
            nextLoc: nextStepData?.loc ?? null,
        });

        return entries;
    }, []);
}
