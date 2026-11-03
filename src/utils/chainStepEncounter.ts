/**
 * chainStepEncounter.ts — 기다리는 이야기 단계가 이번 탐험에 나타나는가.
 *
 * 2026-11 소유자 결정 "이야기 이벤트는 확정이 아니라 확률 — 돌아다니다 확률적으로 알게 되는 식": 사냥 지역의 이야기 단계는
 * 탐험마다 `BALANCE.CHAIN_STEP_ENCOUNTER_CHANCE`로 나타난다. 판정은 탐험 수 · 지역 · 이야기 · 단계의 해시다 — 탐험 난수
 * (`actionRng`)를 쓰면 그 지역의 모든 탐험 난수열이 밀린다(Wave 70 · 75와 같은 원칙). 같은 탐험 수면 같은 결과라 리로드로
 * 다시 굴릴 수 없다. 안전지대의 단계는 확정이다 — 그곳의 탐험 단추는 그 이야기 하나뿐이라(`getTownExploreIntent`) 확률은
 * 단추를 여러 번 누르게 할 뿐이다.
 */
import { BALANCE } from '../data/constants.js';
import { deriveSeed } from './seededRandom.js';
import type { Player } from '../types/index.js';

const UINT32 = 0x100000000;

export const isChainStepEncountered = (
    player: Pick<Player, 'loc' | 'stats'>,
    mapType: string | undefined,
    chainId: string,
    step: number,
): boolean => {
    if (mapType === 'safe') return true;
    const explores = Math.max(0, Math.floor(Number(player.stats?.explores) || 0));
    const unit = deriveSeed(0, 'chain-step', explores, String(player.loc || ''), chainId, step) / UINT32;
    return unit < BALANCE.CHAIN_STEP_ENCOUNTER_CHANCE;
};
