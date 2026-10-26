// cycle 321: unused BALANCE import 제거 — EquipmentCodexCard 어디에서도 BALANCE 참조 0건.
// 2026-10 감사 VD-07 · VD-09: 등급 프레임 · 모서리 장식은 hex 맵이 아니라 등급 토큰(`ab-rar-*` → `--aether-rarity-*-rgb`)과
//   단일 출처 `RARITY_CLASSES`를 읽는다.
import { RARITY_CLASSES } from '../../data/constants';
import { MSG } from '../../data/messages';
import { getItemRarity } from '../../utils/gameUtils';
import ItemIcon from '../icons/ItemIcon';
import Chip from '../ui/Chip';
import type { Item, Player } from '../../types/index.js';

const CORNER_CLASSES = ['is-tl', 'is-tr', 'is-bl', 'is-br'] as const;

const StatRow = ({ label, value, compareValue }: { label: string; value: number; compareValue?: number | null }) => {
    const diff = compareValue != null ? value - compareValue : null;
    return (
        <div className="aether-type-meta flex items-center justify-between">
            <span className="text-ae-ink-3">{label}</span>
            <div className="flex items-center gap-1.5 font-fira tabular-nums">
                <span className="text-ae-ink">{value}</span>
                {diff != null && diff !== 0 && (
                    <span className={diff > 0 ? 'text-ae-good' : 'text-ae-threat'}>
                        {diff > 0 ? `+${diff}` : diff}
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * EquipmentCodexCard — 등급 프레임 + 스탯 비교 레이아웃
 */
interface EquipmentCodexCardProps {
    item?: Item;
    player?: Player | null;
}

const EquipmentCodexCard = ({ item, player }: EquipmentCodexCardProps) => {
    if (!item) return null;

    const rarity = getItemRarity(item);

    // 장착 중인 같은 슬롯 아이템 찾기
    // cycle 468: player.equipment 오타 → player.equip 정정. Player 도메인은
    //   `equip` 필드만 사용 (gameUtils 200+ 참조). 오타로 equipped가 항상 null이
    //   되어 비교 UI ("vs xxx" / diff badge) 미렌더되던 silent UI 결손 fix.
    //   shield 슬롯은 Player 스키마상 offhand에 들어가는 케이스가 일반적이지만,
    //   이번 수정은 typo만 정정하고 슬롯 매핑은 보존.
    const equipped: Item | null | undefined = item.type === 'weapon'
        ? player?.equip?.weapon
        : item.type === 'armor'
            ? player?.equip?.armor
            : item.type === 'shield'
                ? player?.equip?.offhand
                : null;

    return (
        <div data-testid="codex-equipment-card" className={`ab-tile ab-rar-${rarity} space-y-2.5 p-3.5`}>
            {/* 모서리 장식 — 일반 등급은 장식 없이 둔다 */}
            {rarity !== 'common' && CORNER_CLASSES.map((corner) => (
                <span key={corner} className={`ab-corner ${corner}`} aria-hidden="true" />
            ))}

            {/* 헤더 */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                    <ItemIcon item={item} size={32} showBorder />
                    <div className="min-w-0">
                        <div className="aether-type-body font-display font-bold text-ae-ink">{item.name}</div>
                        <div className="aether-type-meta mt-0.5 text-ae-ink-2">{item.desc}</div>
                    </div>
                </div>
                <Chip className={`shrink-0 ${RARITY_CLASSES[rarity] || RARITY_CLASSES.common}`}>
                    {MSG.RARITY_LABEL?.[rarity] || rarity}
                </Chip>
            </div>

            {/* 스탯 */}
            <div className="ae-well space-y-1 px-2.5 py-2">
                <div className="aether-type-meta mb-1.5 text-ae-ink-3">
                    {MSG.EQUIP_STAT_COMPARE}
                    {equipped && <span className="ml-1.5 text-ae-ink-3">{MSG.CODEX_COMPARE_EQUIPPED(equipped.name)}</span>}
                </div>
                {/* cycle W9-A1: atk / def 읽기 제거 — 카탈로그·Player.equip 어디에도 없는
                    필드라 항상 undefined였고 StatRow가 렌더된 적이 없다. 장비의 ATK/DEF는
                    `val`이며 목록 행(WeaponCodex)이 getItemStatText로 이미 보여준다. */}
                {item.hp != null && (
                    <StatRow label={MSG.CODEX_EQUIP_CARD_LIFE} value={item.hp} compareValue={equipped?.hp} />
                )}
                {item.mp != null && (
                    <StatRow label={MSG.CODEX_EQUIP_CARD_WILL} value={item.mp} compareValue={equipped?.mp} />
                )}
            </div>

            {/* 추가 정보 */}
            <div className="flex flex-wrap items-center gap-1.5">
                {item.elem && <Chip tone="gold">{item.elem}</Chip>}
                {item.hands === 2 && <Chip>{MSG.CODEX_EQUIP_CARD_TWO_HAND}</Chip>}
                {item.jobs && (
                    <span className="aether-type-meta text-ae-ink-3">
                        {item.jobs.join(' · ')}
                    </span>
                )}
            </div>

            {/* 가격 */}
            <div className="aether-type-meta text-right font-fira tabular-nums text-ae-ink-3">
                {MSG.CODEX_EQUIP_CARD_PRICE(item.price ?? 0)}
            </div>
        </div>
    );
};

export default EquipmentCodexCard;
