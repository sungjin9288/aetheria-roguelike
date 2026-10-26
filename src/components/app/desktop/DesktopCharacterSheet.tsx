import { RARITY_CLASSES } from '../../../data/constants';
import { MSG } from '../../../data/messages';
import { getItemRarity } from '../../../utils/gameUtils';
import { isTwoHandWeapon } from '../../../utils/equipmentUtils';
import type { FullStats, Item, Player } from '../../../types/index.js';

type SlotKey = keyof typeof MSG.SHELL_EQUIP_SLOTS;

const SLOT_ORDER: readonly SlotKey[] = ['weapon', 'armor', 'offhand'];

interface DesktopCharacterSheetProps {
    player: Player;
    stats?: FullStats | null;
}

interface EquipRowProps {
    slot: SlotKey;
    item: Item | null;
    /** 양손 무기가 보조 장비 칸을 함께 쓴다(Wave 67 문구). */
    sharedByTwoHand: boolean;
}

const EquipRow = ({ slot, item, sharedByTwoHand }: EquipRowProps) => {
    const enhance = item?.enhance || 0;
    const rarityClass = item ? RARITY_CLASSES[getItemRarity(item)] || 'text-ae-ink' : 'text-ae-ink-3';
    const emptyLabel = sharedByTwoHand ? MSG.OUTFIT_SET_TWO_HAND_SLOT : MSG.SHELL_EQUIP_EMPTY;

    return (
        <li data-testid={`desktop-equip-${slot}`} className="flex min-h-[28px] items-baseline justify-between gap-3">
            <span className="shrink-0 text-[11px] text-ae-ink-3">{MSG.SHELL_EQUIP_SLOTS[slot]}</span>
            <span className={`min-w-0 text-right text-[12px] font-semibold leading-snug ${rarityClass}`}>
                {item ? item.name : emptyLabel}
                {enhance > 0 && (
                    <span className="ml-1 font-fira tabular-nums text-ae-gold-text">+{enhance}</span>
                )}
            </span>
        </li>
    );
};

/**
 * 2026-10 데스크톱 배치(VD-04 · UX-12): 왼쪽 캐릭터 열의 두 번째 카드 — 공격력 · 방어력과 장착 장비를 한눈에 보인다.
 * 모바일은 모험 기록의 장비 탭이 같은 정보를 그린다(이 카드는 넓은 화면의 빈 칸을 쓴다 — 새 정보가 아니다).
 */
const DesktopCharacterSheet = ({ player, stats }: DesktopCharacterSheetProps) => {
    const equip = player.equip || {};
    const weapon = (equip.weapon as Item | null | undefined) || null;
    const twoHanded = Boolean(weapon && isTwoHandWeapon(weapon));
    const facts = [
        { id: 'atk', label: MSG.SHELL_FACT_ATK, value: stats?.atk ?? player.atk ?? 0 },
        { id: 'def', label: MSG.SHELL_FACT_DEF, value: stats?.def ?? player.def ?? 0 },
    ];

    return (
        <section data-testid="desktop-character-sheet" aria-labelledby="desktop-equip-heading" className="ae-card is-quiet rounded-ae-lg px-4 py-3">
            <dl className="grid grid-cols-2 gap-2">
                {facts.map((fact) => (
                    <div key={fact.id} data-testid={`desktop-fact-${fact.id}`} className="ae-well rounded-ae-sm px-3 py-2">
                        <dt className="ae-eyebrow">{fact.label}</dt>
                        <dd className="mt-0.5 font-fira text-[17px] font-semibold leading-none tabular-nums text-ae-ink">{fact.value}</dd>
                    </div>
                ))}
            </dl>
            <div className="ae-divider my-3" />
            <h2 id="desktop-equip-heading" className="ae-eyebrow">{MSG.SHELL_EQUIP_HEADING}</h2>
            <ul className="mt-1.5 space-y-1">
                {SLOT_ORDER.map((slot) => (
                    <EquipRow
                        key={slot}
                        slot={slot}
                        item={(equip[slot] as Item | null | undefined) || null}
                        sharedByTwoHand={slot === 'offhand' && twoHanded}
                    />
                ))}
            </ul>
        </section>
    );
};

export default DesktopCharacterSheet;
