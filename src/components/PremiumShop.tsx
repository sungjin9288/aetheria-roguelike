import { useMemo, useState } from 'react';
import {
    Backpack,
    Check,
    Gem,
    HeartPulse,
    ShieldCheck,
    Sparkles,
    Star,
    X,
    type LucideIcon,
} from 'lucide-react';
import type { Player } from '../types/index.js';
import {
    getCrystalExchangeOffers,
    getCrystalSources,
    type CrystalExchangeCategory,
    type CrystalExchangeOffer,
} from '../utils/crystalExchange';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';

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
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    selected
                        ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100'
                        : 'border-white/8 bg-black/18 text-slate-400'
                }`}>
                    {offer.owned ? <Check size={17} /> : <Icon size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                        <strong className="text-[14px] font-rajdhani text-white">{offer.name}</strong>
                        <span className="flex shrink-0 items-center gap-1 text-[12px] font-fira text-cyan-100">
                            <Gem size={13} /> {offer.cost}
                        </span>
                    </span>
                    <span className="mt-1 block text-[12px] font-fira leading-5 text-slate-400">
                        {offer.description}
                    </span>
                </span>
            </>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] flex justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <section
                data-testid="premium-shop"
                aria-label="에테르 교환소"
                className="panel-noise aether-surface relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-x border-cyan-300/16 bg-[#091218] pt-[var(--aether-safe-area-top)]"
                style={{ backgroundColor: '#091218' }}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-fira text-cyan-100/64">여정에서 얻은 보상</p>
                        <h2 className="mt-0.5 text-[20px] font-rajdhani font-bold text-white">에테르 교환소</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <div data-testid="crystal-exchange-balance" className="flex min-h-[44px] items-center gap-2 rounded-lg border border-cyan-300/24 bg-cyan-300/10 px-3 text-cyan-100">
                            <Gem size={15} />
                            <span className="text-[15px] font-rajdhani font-bold">{crystals}</span>
                            <span className="text-[11px] font-fira text-slate-300">크리스탈</span>
                        </div>
                        <button
                            type="button"
                            data-testid="premium-shop-close"
                            aria-label="에테르 교환소 닫기"
                            onClick={onClose}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition-colors hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                <div data-testid="crystal-exchange-scroll-region" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div>
                        <h3 className="text-[16px] font-rajdhani font-bold text-white">필요한 순간을 위해 고르세요</h3>
                        <p className="mt-1 text-[12px] font-fira leading-5 text-slate-400">
                            항목을 고르면 변화와 비용을 먼저 보여 드립니다. 하단 버튼을 누르기 전에는 크리스탈을 사용하지 않습니다.
                        </p>
                    </div>

                    <nav className="mt-4 grid grid-cols-2 gap-2" aria-label="교환 항목 분류">
                        {(Object.keys(CATEGORY_LABELS) as CrystalExchangeCategory[]).map((categoryId) => {
                            const active = category === categoryId;
                            return (
                                <button
                                    key={categoryId}
                                    type="button"
                                    data-testid={`crystal-category-${categoryId}`}
                                    aria-pressed={active}
                                    onClick={() => changeCategory(categoryId)}
                                    className={`min-h-[46px] rounded-lg border px-3 text-[12px] font-fira font-semibold transition-colors ${
                                        active
                                            ? 'border-cyan-300/38 bg-cyan-300/14 text-white'
                                            : 'border-white/8 bg-black/16 text-slate-400 hover:text-slate-200'
                                    }`}
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
                                className={`flex min-h-[82px] w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                    selectedOffer?.id === offer.id
                                        ? 'border-cyan-300/42 bg-cyan-300/10'
                                        : 'border-white/8 bg-black/14 hover:border-white/16'
                                }`}
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
                                className={`flex min-h-[82px] w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                    selectedOffer?.id === offer.id
                                        ? 'border-cyan-300/42 bg-cyan-300/10'
                                        : 'border-white/8 bg-black/14 hover:border-white/16'
                                }`}
                            >
                                {offerContent(offer)}
                            </button>
                        ))}
                    </div>

                    {selectedOffer && (
                        <section data-testid="crystal-exchange-preview" className="mt-5 border-t border-white/10 pt-4">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-[15px] font-rajdhani font-bold text-white">{selectedOffer.name}</h3>
                                <span className="text-[11px] font-fira text-cyan-100/72">
                                    {selectedOffer.owned ? '보유 완료' : `크리스탈 ${selectedOffer.cost}개`}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="min-h-[72px] rounded-lg border border-white/8 bg-black/16 p-3">
                                    <p className="text-[11px] font-fira text-slate-500">현재</p>
                                    <p data-testid="crystal-current-state" className="mt-2 text-[13px] font-fira text-slate-200">
                                        {selectedOffer.currentLabel}
                                    </p>
                                </div>
                                <span className="text-[15px] text-cyan-200/70" aria-hidden="true">→</span>
                                <div className="min-h-[72px] rounded-lg border border-cyan-300/22 bg-cyan-300/8 p-3">
                                    <p className="text-[11px] font-fira text-cyan-100/64">교환 후</p>
                                    <p data-testid="crystal-next-state" className="mt-2 text-[13px] font-fira leading-5 text-white">
                                        {selectedOffer.nextLabel}
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    <section data-testid="crystal-source-list" className="mt-5 border-t border-white/10 pt-4">
                        <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-cyan-200" />
                            <h3 className="text-[15px] font-rajdhani font-bold text-white">크리스탈을 얻는 길</h3>
                        </div>
                        <div className="mt-3 divide-y divide-white/8 rounded-lg border border-white/8 bg-black/14 px-3">
                            {sources.map((source) => (
                                <div key={source.id} className="flex min-h-[62px] items-center justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-fira font-semibold text-slate-200">{source.name}</p>
                                        <p className="mt-1 text-[11px] font-fira leading-4 text-slate-500">{source.detail}</p>
                                    </div>
                                    <span className="shrink-0 text-[12px] font-fira font-semibold text-cyan-100">{source.rewardLabel}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <footer data-testid="crystal-exchange-action-footer" className="shrink-0 border-t border-white/10 bg-[#091218]/96 px-4 pb-[max(12px,var(--aether-safe-area-bottom))] pt-3">
                    <div className="grid grid-cols-[104px_1fr] gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-[50px] rounded-lg border border-white/12 bg-black/20 text-[13px] font-fira text-slate-300"
                        >
                            돌아가기
                        </button>
                        <button
                            type="button"
                            data-testid="crystal-exchange-confirm"
                            disabled={!selectedOffer?.canExchange}
                            onClick={confirmExchange}
                            className="flex min-h-[50px] items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/14 px-3 text-[13px] font-rajdhani font-bold text-white transition-colors enabled:hover:bg-cyan-300/22 disabled:border-white/8 disabled:bg-black/16 disabled:text-slate-600"
                        >
                            {selectedOffer?.canExchange && <Gem size={15} />}
                            {confirmLabel}
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
};

export default PremiumShop;
