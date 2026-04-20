import React, { useMemo } from 'react';
import { Shield, Sparkles, Sword } from 'lucide-react';
import { CONSTANTS } from '../data/constants';
import { countInventoryItemByName, getEnhanceAvailability } from '../utils/enhancementUtils';
import { getEquipmentProfile, getItemStatText } from '../utils/equipmentUtils';
import { deriveCharacterAppearance } from '../utils/characterAppearance';
import PixelCharacterAvatar from './PixelCharacterAvatar';

const SLOT_CONFIG = [
    { key: 'weapon', label: '주무기', icon: Sword },
    { key: 'armor', label: '방어구', icon: Shield },
    { key: 'offhand', label: '보조장비', icon: Sparkles },
];

const SIG_SET_TONE = Object.freeze({
    holy: { border: 'rgba(246,231,162,0.5)', glow: 'rgba(246,231,162,0.18)', text: '#f6e7a2' },
    fire: { border: 'rgba(255,180,138,0.5)', glow: 'rgba(255,180,138,0.18)', text: '#ffb48a' },
    frost: { border: 'rgba(204,232,245,0.5)', glow: 'rgba(204,232,245,0.18)', text: '#cce8f5' },
    shadow: { border: 'rgba(199,164,240,0.5)', glow: 'rgba(199,164,240,0.18)', text: '#c7a4f0' },
    arcane: { border: 'rgba(192,176,232,0.5)', glow: 'rgba(192,176,232,0.18)', text: '#c0b0e8' },
    nature: { border: 'rgba(168,208,160,0.5)', glow: 'rgba(168,208,160,0.18)', text: '#a8d0a0' },
});

const EquipmentPanel = ({ player, stats, actions, compact = false }) => {
    const equipProfile = useMemo(() => getEquipmentProfile(player?.equip), [player?.equip]);
    const appearance = useMemo(() => deriveCharacterAppearance(player), [player]);
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

    const weaponName = equipProfile.mainWeapon?.name || '없음';
    const offhandName = equipProfile.offhandItem?.name || '없음';
    const armorName = player?.equip?.armor?.name || '없음';
    const activeSignatureSet = stats?.activeSignatureSet || null;
    const sigSetTone = activeSignatureSet ? (SIG_SET_TONE[activeSignatureSet.tone] || SIG_SET_TONE.holy) : null;

    return (
        <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
            <div className={`overflow-hidden rounded-[1.1rem] ${compact ? 'aether-panel-core p-2.5' : 'border border-white/8 bg-black/18 p-3'}`}>
                <div className="flex items-start gap-3">
                    <PixelCharacterAvatar
                        appearance={appearance}
                        size={compact ? 'md' : 'lg'}
                        dataTestId="equipment-character-preview"
                        label="장비 외형 미리보기"
                        className="shrink-0"
                        showEnhanceBadge={false}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[11px] font-fira uppercase text-slate-400">ATK</div>
                                <div className="mt-0.5 text-xs font-fira font-bold text-[#dff7f5]">{stats?.atk || 0}</div>
                            </div>
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[11px] font-fira uppercase text-slate-400">DEF</div>
                                <div className="mt-0.5 text-xs font-fira font-bold text-white/88">{stats?.def || 0}</div>
                            </div>
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[11px] font-fira uppercase text-slate-400">강화 재료</div>
                                <div className="mt-0.5 text-xs font-fira font-bold text-[#e3dcff]">{enhanceMaterialCount}개</div>
                            </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/74">주무기</div>
                                <div className="mt-1 break-words text-[11px] font-fira font-semibold leading-[1.35] text-white/88">{weaponName}</div>
                            </div>
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/74">방어구</div>
                                <div className="mt-1 break-words text-[11px] font-fira font-semibold leading-[1.35] text-white/88">{armorName}</div>
                            </div>
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/74">보조장비</div>
                                <div className="mt-1 break-words text-[11px] font-fira font-semibold leading-[1.35] text-white/88">{offhandName}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {activeSignatureSet && sigSetTone && (
                <div
                    data-testid="active-signature-set-badge"
                    data-signature-set-key={activeSignatureSet.key}
                    className="relative overflow-hidden rounded-[1rem] px-3 py-2"
                    style={{
                        border: `1px solid ${sigSetTone.border}`,
                        background: `radial-gradient(circle at 18% 42%, ${sigSetTone.glow}, transparent 54%), linear-gradient(180deg, rgba(20,24,30,0.92) 0%, rgba(10,12,16,1) 100%)`,
                    }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Sparkles size={12} style={{ color: sigSetTone.text }} />
                            <span
                                className="font-rajdhani font-bold text-[12px] truncate"
                                style={{ color: sigSetTone.text }}
                            >
                                {activeSignatureSet.name}
                            </span>
                        </div>
                        <span className="shrink-0 text-[10px] font-fira" style={{ color: sigSetTone.text }}>
                            {activeSignatureSet.tier}세트 활성
                        </span>
                    </div>
                    {activeSignatureSet.desc && (
                        <div className="mt-1 text-[10px] font-fira leading-[1.4] text-slate-300/85">
                            {activeSignatureSet.desc}
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1.5">
                {slotEntries.map((slot) => {
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
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/68">{slot.label}</div>
                                        {item ? (
                                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                <span className="break-words text-sm font-fira text-white/88">{item.name}</span>
                                                {(item.enhance || 0) > 0 && (
                                                    <span className="text-xs font-fira font-bold text-[#d5b180]">+{item.enhance}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-0.5 text-xs font-fira text-slate-500">장착된 장비가 없습니다</div>
                                        )}
                                    </div>
                                    {item && (
                                        <>
                                            <div className="mt-2 text-xs font-fira leading-[1.45] text-slate-300/80">{getItemStatText(item)}</div>
                                            {slot.canEnhance && slot.requirement && (
                                                <div className="mt-2 rounded-[0.9rem] border border-white/8 bg-black/16 px-2.5 py-2 space-y-0.5 text-[11px] font-fira">
                                                    <div className="text-slate-300/86">
                                                        {slot.requirement.gold.toLocaleString()}G · {slot.requirement.materialName} {slot.requirement.materials}개
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
