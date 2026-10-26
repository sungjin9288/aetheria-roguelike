import { useMemo, useState } from 'react';
import {
    Backpack,
    Check,
    Gem,
    HeartPulse,
    ShieldCheck,
    Sparkles,
    Star,
    type LucideIcon,
} from 'lucide-react';
import type { Player } from '../types/index.js';
import OverlayCloseButton from './OverlayCloseButton';
import ActionButton from './ui/ActionButton';
import {
    getCrystalExchangeOffers,
    getCrystalSources,
    type CrystalExchangeCategory,
    type CrystalExchangeOffer,
} from '../utils/crystalExchange';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import { MSG } from '../data/messages';

interface PremiumShopProps {
    player?: Player | null;
    onClose?: () => void;
    onExpandInventory?: () => void;
    onPurchaseSynthProtect?: () => void;
    onPurchaseRevive?: () => void;
    onPurchaseTitle?: (id: string, name: string, cost: number) => void;
}

const OFFER_ICONS: Record<string, LucideIcon> = {
    inv_expand: Backpack,
    synth_protect: ShieldCheck,
    revive: HeartPulse,
};

const CATEGORY_LABELS: Record<CrystalExchangeCategory, string> = {
    preparation: '원정 준비',
    titles: '칭호',
};

const PremiumShop = ({
    player,
    onClose,
    onExpandInventory,
    onPurchaseSynthProtect,
    onPurchaseRevive,
    onPurchaseTitle,
}: PremiumShopProps) => {
    usePlatformBackHandler(Boolean(onClose), () => onClose?.(), 200);
    const dialog = useOverlayDialog({ label: MSG.A11Y_DIALOG_PREMIUM_SHOP, onEscape: onClose });
    const crystals = Math.max(0, Number(player?.premiumCurrency) || 0);
    const [category, setCategory] = useState<CrystalExchangeCategory>('preparation');
    const [selectedId, setSelectedId] = useState('inv_expand');
    const offers = useMemo(() => getCrystalExchangeOffers(player), [player]);
    const sources = useMemo(() => getCrystalSources(), []);
    const visibleOffers = offers.filter((offer) => offer.category === category);
    const selectedOffer = visibleOffers.find((offer) => offer.id === selectedId) || visibleOffers[0];

    const changeCategory = (nextCategory: CrystalExchangeCategory) => {
        const firstOffer = offers.find((offer) => offer.category === nextCategory);
        setCategory(nextCategory);
        if (firstOffer) setSelectedId(firstOffer.id);
    };

    const confirmExchange = () => {
        if (!selectedOffer?.canExchange) return;

        switch (selectedOffer.id) {
            case 'inv_expand':
                onExpandInventory?.();
                break;
            case 'synth_protect':
                onPurchaseSynthProtect?.();
                break;
            case 'revive':
                onPurchaseRevive?.();
                break;
            default:
                if (selectedOffer.category === 'titles' && selectedOffer.titleName) {
                    onPurchaseTitle?.(selectedOffer.id, selectedOffer.titleName, selectedOffer.cost);
                }
        }
    };

    const confirmLabel = !selectedOffer
        ? '교환할 항목을 선택하세요'
        : selectedOffer.owned
            ? '이미 보유한 칭호입니다'
            : selectedOffer.canExchange
                ? `${selectedOffer.name} 교환`
                : `크리스탈 ${selectedOffer.shortage}개 부족`;

    const offerContent = (offer: CrystalExchangeOffer) => {
        const Icon = OFFER_ICONS[offer.id] || Star;
        const selected = selectedOffer?.id === offer.id;

        return (
            <>
                <span className={`ae-town-tile h-10 w-10 ${selected ? 'is-ether' : offer.owned ? 'is-good' : ''}`.trim()} aria-hidden="true">
                    {offer.owned ? <Check size={17} /> : <Icon size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                        <strong className="text-[14px] font-display font-bold text-ae-ink">{offer.name}</strong>
                        <span className="flex shrink-0 items-center gap-1 text-[13px] font-fira font-semibold tabular-nums text-ae-ether-hi">
                            <Gem size={13} aria-hidden="true" /> {offer.cost}
                        </span>
                    </span>
                    <span className="mt-1 block font-readable text-[12px] leading-5 text-ae-ink-2">
                        {offer.description}
                    </span>
                </span>
            </>
        );
    };

    return (
        <div {...dialog} className="ae-scrim ae-town-overlay fixed inset-0 z-[200] flex justify-center" onClick={onClose}>
            <section
                data-testid="premium-shop"
                aria-label="에테르 교환소"
                className="ae-sheet ae-town-sheet relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden pt-[var(--aether-safe-area-top)] lg:max-w-[600px]"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="ae-town-head flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                        <p className="ae-eyebrow font-readable">여정에서 얻은 보상</p>
                        <h2 className="mt-0.5 text-[20px] font-display font-extrabold text-ae-ink">에테르 교환소</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <div data-testid="crystal-exchange-balance" className="flex min-h-[44px] items-center gap-2 rounded-full bg-ae-ether/10 px-3 text-ae-ether-hi shadow-[inset_0_0_0_1px_var(--aether-rim-ether)]">
                            <Gem size={15} aria-hidden="true" />
                            <span className="font-fira text-[15px] font-bold tabular-nums">{crystals}</span>
                            <span className="font-readable text-[11px] text-ae-ink-2">크리스탈</span>
                        </div>
                        <OverlayCloseButton data-testid="premium-shop-close" aria-label="에테르 교환소 닫기" onClick={onClose} />
                    </div>
                </header>

                <div data-testid="crystal-exchange-scroll-region" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div>
                        <h3 className="text-[16px] font-display font-bold text-ae-ink">필요한 순간을 위해 고르세요</h3>
                        <p className="mt-1 font-readable text-[12px] leading-5 text-ae-ink-2">
                            항목을 고르면 변화와 비용을 먼저 보여 드립니다. 하단 버튼을 누르기 전에는 크리스탈을 사용하지 않습니다.
                        </p>
                    </div>

                    <nav className="ae-town-seg mt-4" aria-label="교환 항목 분류">
                        {(Object.keys(CATEGORY_LABELS) as CrystalExchangeCategory[]).map((categoryId) => {
                            const active = category === categoryId;
                            return (
                                <button
                                    key={categoryId}
                                    type="button"
                                    data-testid={`crystal-category-${categoryId}`}
                                    aria-pressed={active}
                                    onClick={() => changeCategory(categoryId)}
                                    className="ae-town-seg-btn font-readable"
                                >
                                    {CATEGORY_LABELS[categoryId]}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="mt-3 space-y-2">
                        {category === 'preparation' && visibleOffers.map((offer) => (
                            <button
                                key={offer.id}
                                type="button"
                                data-testid={`premium-buy-${offer.id}`}
                                aria-pressed={selectedOffer?.id === offer.id}
                                onClick={() => setSelectedId(offer.id)}
                                className="ae-town-pick flex min-h-[82px] items-start gap-3 p-3"
                            >
                                {offerContent(offer)}
                            </button>
                        ))}

                        {category === 'titles' && visibleOffers.map((offer) => (
                            <button
                                key={offer.id}
                                type="button"
                                data-testid={`premium-title-buy-${offer.id}`}
                                aria-pressed={selectedOffer?.id === offer.id}
                                onClick={() => setSelectedId(offer.id)}
                                className="ae-town-pick flex min-h-[82px] items-start gap-3 p-3"
                            >
                                {offerContent(offer)}
                            </button>
                        ))}
                    </div>

                    {selectedOffer && (
                        <section data-testid="crystal-exchange-preview" className="mt-5 pt-4 shadow-[inset_0_1px_0_var(--aether-hairline)]">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-[15px] font-display font-bold text-ae-ink">{selectedOffer.name}</h3>
                                <span className="font-fira text-[12px] tabular-nums text-ae-ink-2">
                                    {selectedOffer.owned ? '보유 완료' : `크리스탈 ${selectedOffer.cost}개`}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="ae-sunk min-h-[72px] rounded-ae-sm p-3">
                                    <p className="ae-eyebrow font-readable">현재</p>
                                    <p data-testid="crystal-current-state" className="mt-2 font-fira text-[13px] tabular-nums text-ae-ink-2">
                                        {selectedOffer.currentLabel}
                                    </p>
                                </div>
                                <span className="text-[15px] text-ae-ether" aria-hidden="true">→</span>
                                <div className="min-h-[72px] rounded-ae-sm bg-ae-ether/10 p-3 shadow-[inset_0_0_0_1px_var(--aether-rim-ether)]">
                                    <p className="font-readable text-[11px] font-bold text-ae-ether-hi">교환 후</p>
                                    <p data-testid="crystal-next-state" className="mt-2 font-fira text-[13px] leading-5 tabular-nums text-ae-ink">
                                        {selectedOffer.nextLabel}
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    <section data-testid="crystal-source-list" className="mt-5 pt-4 shadow-[inset_0_1px_0_var(--aether-hairline)]">
                        <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-ae-ether" aria-hidden="true" />
                            <h3 className="text-[15px] font-display font-bold text-ae-ink">크리스탈을 얻는 길</h3>
                        </div>
                        <div className="ae-town-group mt-3 px-3">
                            {sources.map((source) => (
                                <div key={source.id} className="ae-town-row flex min-h-[62px] items-center justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="font-readable text-[13px] font-semibold text-ae-ink">{source.name}</p>
                                        <p className="mt-1 font-readable text-[12px] leading-4 text-ae-ink-2">{source.detail}</p>
                                    </div>
                                    <span className="shrink-0 font-fira text-[12px] font-semibold tabular-nums text-ae-ether-hi">{source.rewardLabel}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <footer data-testid="crystal-exchange-action-footer" className="ae-town-sheet-foot shrink-0 px-4 pb-[max(12px,var(--aether-safe-area-bottom))] pt-3">
                    <div className="grid grid-cols-1 gap-2">
                        <ActionButton
                            variant="primary"
                            data-testid="crystal-exchange-confirm"
                            disabled={!selectedOffer?.canExchange}
                            onClick={confirmExchange}
                            icon={selectedOffer?.canExchange ? <Gem size={16} /> : undefined}
                            label={confirmLabel}
                            className="w-full font-display"
                        />
                    </div>
                </footer>
            </section>
        </div>
    );
};

export default PremiumShop;
