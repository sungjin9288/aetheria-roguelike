import React, { useMemo } from 'react';
import { Coins, Shield, Sparkles, Sword } from 'lucide-react';
import { CONSTANTS } from '../data/constants';
import { countInventoryItemByName, getEnhanceAvailability } from '../utils/enhancementUtils';
import { getEquipmentProfile, getItemStatText, getWeaponStyleLabel } from '../utils/equipmentUtils';
import SignalBadge from './SignalBadge';

const SLOT_CONFIG = [
    { key: 'weapon', label: '주무기', icon: Sword },
    { key: 'armor', label: '방어구', icon: Shield },
    { key: 'offhand', label: '보조장비', icon: Sparkles },
];

const EquipmentPanel = ({ player, stats, actions, compact = false }) => {
    const equipProfile = useMemo(() => getEquipmentProfile(player?.equip), [player?.equip]);
    const enhanceMaterialCount = useMemo(
        () => countInventoryItemByName(player?.inv, CONSTANTS.ENHANCE_MATERIAL_NAME),
        [player?.inv]
    );

    const slotEntries = useMemo(() => SLOT_CONFIG.map((slot) => {
        const item = player?.equip?.[slot.key] || null;
        const availability = getEnhanceAvailability(item, player?.gold || 0, player?.inv || []);

        return {
            ...slot,
            item,
            requirement: availability.requirement,
            canEnhance: availability.canEnhance,
            affordable: availability.affordable,
            enhanceHint: availability.hint,
        };
    }), [player?.equip, player?.gold, player?.inv]);

    const offenseSummary = (stats?.atk || 0) + Math.round((stats?.critChance || 0) * 100);
    const defenseSummary = (stats?.def || 0) + (stats?.maxHp || 0);

    return (
        <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
            <div className={`overflow-hidden rounded-[1.1rem] ${compact ? 'aether-panel-core p-2.5' : 'border border-white/8 bg-black/18 p-3'}`}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/72">Equipment Bay</div>
                        <div className="mt-0.5 text-sm font-rajdhani font-bold text-white/90">현재 장비 현황</div>
                    </div>
                    <SignalBadge tone="neutral" size="sm">{player?.job || '모험가'}</SignalBadge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                        <div className="flex items-center gap-1 text-[11px] font-fira uppercase text-slate-400">
                            <Coins size={10} /> Gold
                        </div>
                        <div className="mt-0.5 text-xs font-fira font-bold text-[#f6e7c8]">{(player?.gold || 0).toLocaleString()} G</div>
                    </div>
                    <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                        <div className="text-[11px] font-fira uppercase text-slate-400">ATK/CRIT</div>
                        <div className="mt-0.5 text-xs font-fira font-bold text-[#dff7f5]">{offenseSummary}</div>
                    </div>
                    <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                        <div className="text-[11px] font-fira uppercase text-slate-400">강화 재료</div>
                        <div className="mt-0.5 text-xs font-fira font-bold text-[#e3dcff]">{enhanceMaterialCount}개</div>
                    </div>
                </div>
                <div className="mt-2 rounded-[0.95rem] aether-panel-muted px-2.5 py-2 text-[11px] font-fira text-slate-300/76">
                    방어 합산 {defenseSummary} · 주무기 {equipProfile.mainWeapon?.name || '미장착'} · 보조 {equipProfile.offhandItem?.name || '없음'}
                </div>
            </div>

            <div className="space-y-1.5">
                {slotEntries.map((slot) => {
                    const Icon = slot.icon;
                    const item = slot.item;
                    const slotKey = slot.key;

                    return (
                        <div
                            key={slot.key}
                            data-testid={`equipment-slot-${slot.key}`}
                            className={`rounded-[1rem] border ${compact ? 'px-2.5 py-2.5' : 'px-3 py-3'} ${item ? 'border-white/8 aether-panel-muted' : 'border-white/6 bg-black/14'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-slate-300/76">
                                            <Icon size={12} />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/68">{slot.label}</div>
                                            {item ? (
                                                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                    <span className="truncate text-sm font-fira text-white/88">{item.name}</span>
                                                    {(item.enhance || 0) > 0 && (
                                                        <span className="text-xs font-fira font-bold text-[#d5b180]">+{item.enhance}</span>
                                                    )}
                                                    <SignalBadge tone="equipped" size="sm">장착 중</SignalBadge>
                                                </div>
                                            ) : (
                                                <div className="mt-0.5 text-xs font-fira text-slate-500">장착된 장비가 없습니다</div>
                                            )}
                                        </div>
                                    </div>

                                    {item && (
                                        <>
                                            <div className="mt-2 text-xs font-fira text-slate-300/80">
                                                {getItemStatText(item)}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <SignalBadge tone="neutral" size="sm">{getWeaponStyleLabel(item)}</SignalBadge>
                                                <SignalBadge tone="neutral" size="sm">T{item.tier || 1}</SignalBadge>
                                            </div>
                                            {slot.canEnhance && slot.requirement && (
                                                <div className="mt-2 space-y-0.5 text-[11px] font-fira">
                                                    <div className="text-slate-400/76">
                                                        다음 강화: {slot.requirement.gold.toLocaleString()}G · {slot.requirement.materialName} {slot.requirement.materials}개
                                                    </div>
                                                    <div className={slot.affordable ? 'text-emerald-200/70' : 'text-amber-200/78'}>
                                                        {slot.enhanceHint}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {slot.canEnhance && item && actions?.enhanceItem && (
                                    <button
                                        type="button"
                                        data-testid={`equipment-enhance-${slot.key}`}
                                        onClick={() => actions.enhanceItem(item.id || `equip:${slotKey}`)}
                                        disabled={!slot.affordable}
                                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-fira font-bold transition-colors ${
                                            slot.affordable
                                                ? 'border-[#d5b180]/22 bg-[#d5b180]/10 text-[#f6e7c8] hover:bg-[#d5b180]/18'
                                                : 'border-white/8 bg-black/20 text-slate-500 opacity-80'
                                        }`}
                                        title={slot.requirement ? `다음 강화 비용 ${slot.requirement.gold.toLocaleString()}G / ${slot.requirement.materialName} ${slot.requirement.materials}개` : '강화 불가'}
                                    >
                                        강화
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EquipmentPanel;
