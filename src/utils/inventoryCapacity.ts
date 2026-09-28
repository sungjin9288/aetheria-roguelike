import { BALANCE } from '../data/constants';
import type { Player } from '../types';

/**
 * 가방 상한 규칙의 단일 원천 (2026-09 Wave 27 N2, D2).
 *
 * 정책은 두 줄이다.
 *   ① **보상은 잃지 않는다** — 퀘스트·업적·체인·처치 마일스톤·묘비 회수·발견 체인 보상은
 *      상한을 넘겨도 가방에 넣는다(지급 쪽에 상한 검사를 두지 않는다).
 *   ② **상한은 증가만 막는다** — 어떤 조작이 가방을 상한과 **현재 크기 둘 다**보다 크게
 *      만들 때만 거부한다. 순증 0(장비 교체)이나 감소 조작은 상한을 넘긴 가방에서도 허용된다.
 *
 * ①이 ②보다 먼저 성립해야 했던 이유: 보상이 21/20을 만들고 나면, 교체 "뒤" 크기만 보던
 * 검사(`inventory.length > cap`)가 순증 0인 장비 교체까지 전부 거부했다 — 자연 플레이에서
 * 대마법사가 체인 전설 지팡이를 Lv60~68 동안 장착하지 못했다.
 *
 * 구매·전리품은 언제나 +1 이상이므로 ②가 그대로 막는다(상한에서도, 상한을 넘긴 뒤에도).
 */
export const getInventoryCapacity = (player: Pick<Player, 'maxInv'>): number => (
    Number.isSafeInteger(player.maxInv) && Number(player.maxInv) > 0
        ? Number(player.maxInv)
        : BALANCE.INV_MAX_SIZE
);

/** 조작 뒤 크기 `nextSize`가 상한과 현재 크기를 **둘 다** 넘으면 true(= 상한 거부). */
export const growsPastInventoryCapacity = (
    player: Pick<Player, 'maxInv' | 'inv'>,
    nextSize: number,
): boolean => nextSize > getInventoryCapacity(player) && nextSize > (player.inv || []).length;
