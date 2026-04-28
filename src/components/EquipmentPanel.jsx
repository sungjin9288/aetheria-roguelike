import React, { useMemo } from 'react';
import { Shield, Sparkles, Sword, Target } from 'lucide-react';
import { CONSTANTS } from '../data/constants';
import { countInventoryItemByName, getEnhanceAvailability } from '../utils/enhancementUtils';
import { getEquipmentProfile, getItemStatText } from '../utils/equipmentUtils';
import { deriveCharacterAppearance } from '../utils/characterAppearance';
import { getSignatureSetProgress } from '../utils/signatureSetBonus.js';
import { isSignatureItem } from '../data/signatureItems.js';
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
        const isSignature = item ? isSignatureItem(item) : false;

        return {
            ...slot,
            item,
            isSignature,
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
    const setProgress = useMemo(() => getSignatureSetProgress(player?.equip), [player?.equip]);
    // 아직 활성화되지 않았거나(1개만 착용) 상위 티어가 남은 경우에만 힌트 카드 표시
    const showProgressHint = setProgress && setProgress.nextBonus;
    const progressTone = setProgress ? (SIG_SET_TONE[setProgress.tone] || SIG_SET_TONE.holy) : null;

    return (
        <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
            <div className={`overflow-hidden rounded-[1.1rem] ${compact ? 'aether-panel-core p-2.5' : 'border border-white/8 bg-black/18 p-3'}`}>
                <div className="flex items-start gap-3">
                    <PixelCharacterAvatar
                        player={player}
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
                        {stats?.jobAffinity?.matchCount > 0 && (() => {
                            const aff = stats.jobAffinity;
                            const tone =
                                aff.tier === 'full' ? { color: '#f6e7a2', border: 'rgba(246,231,162,0.42)', bg: 'rgba(246,231,162,0.10)' } :
                                aff.tier === 'partial2' ? { color: '#d5b180', border: 'rgba(213,177,128,0.42)', bg: 'rgba(213,177,128,0.10)' } :
                                { color: '#7dd4d8', border: 'rgba(125,212,216,0.42)', bg: 'rgba(125,212,216,0.10)' };
                            return (
                                <div
                                    data-testid="job-outfit-affinity"
                                    data-affinity-tier={aff.tier}
                                    data-match-count={aff.matchCount}
                                    className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-fira font-bold"
                                    style={{ color: tone.color, border: `1px solid ${tone.border}`, background: tone.bg }}
                                >
                                    <span>⚔ {aff.label} ({aff.matchCount}/{aff.totalSlots || 3})</span>
                                    {aff.bonus.atkMult > 1 && (
                                        <span className="text-white/82">ATK +{Math.round((aff.bonus.atkMult - 1) * 100)}%</span>
                                    )}
                                    {aff.bonus.defMult > 1 && (
                                        <span className="text-white/82">DEF +{Math.round((aff.bonus.defMult - 1) * 100)}%</span>
                                    )}
                                    {aff.bonus.hpBonus > 0 && (
                                        <span className="text-white/82">HP +{Math.round(aff.bonus.hpBonus * 100)}%</span>
                                    )}
                                    {aff.bonus.mpBonus > 0 && (
                                        <span className="text-white/82">MP +{Math.round(aff.bonus.mpBonus * 100)}%</span>
                                    )}
                                </div>
                            );
                        })()}
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

            {showProgressHint && progressTone && (
                <div
                    data-testid="signature-set-progress-hint"
                    data-signature-set-key={setProgress.key}
                    data-equipped-count={setProgress.equippedCount}
                    data-next-tier={setProgress.nextTier}
                    className="relative overflow-hidden rounded-[1rem] px-3 py-2"
                    style={{
                        border: `1px dashed ${progressTone.border}`,
                        background: `linear-gradient(180deg, rgba(14,16,20,0.92) 0%, rgba(8,10,14,1) 100%)`,
                    }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Target size={11} style={{ color: progressTone.text }} />
                            <span className="font-rajdhani font-bold text-[11px] truncate" style={{ color: progressTone.text }}>
                                {setProgress.name}
                            </span>
                            <span className="shrink-0 text-[9px] font-fira text-slate-400/80">
                                {setProgress.equippedCount}/{setProgress.totalMembers} 장착
                            </span>
                        </div>
                        <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.12em]"
                            style={{ color: progressTone.text, border: `1px solid ${progressTone.border}` }}
                        >
                            {setProgress.nextTier}세트 대기
                        </span>
                    </div>
                    {setProgress.nextBonus?.desc && (
                        <div className="mt-1 text-[10px] font-fira leading-[1.4] text-slate-300/75">
                            {setProgress.nextTier - setProgress.equippedCount}개 더 장착 시 — {setProgress.nextBonus.desc}
                        </div>
                    )}
                    {setProgress.missingMembers.length > 0 && (
                        <div className="mt-1 text-[9px] font-fira text-slate-500/85 truncate">
                            필요: {setProgress.missingMembers.slice(0, 3).join(' · ')}
                            {setProgress.missingMembers.length > 3 ? ` +${setProgress.missingMembers.length - 3}` : ''}
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1.5">
                {slotEntries.map((slot) => {
                    const item = slot.item;
                    const slotKey = slot.key;
                    const isSignature = slot.isSignature;

                    const slotStyle = isSignature
                        ? {
                            border: '1px solid rgba(246,231,162,0.42)',
                            background: 'linear-gradient(180deg, rgba(246,231,162,0.08) 0%, rgba(18,16,10,0.72) 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(246,231,162,0.08)',
                        }
                        : undefined;

                    const slotClassName = isSignature
                        ? `rounded-[1rem] ${compact ? 'px-2.5 py-2.5' : 'px-3 py-3'}`
                        : `rounded-[1rem] border ${compact ? 'px-2.5 py-2.5' : 'px-3 py-3'} ${item ? 'border-white/8 aether-panel-muted' : 'border-white/6 bg-black/14'}`;

                    return (
                        <div
                            key={slot.key}
                            data-testid={`equipment-slot-${slot.key}`}
                            data-is-signature={isSignature ? 'true' : 'false'}
                            className={slotClassName}
                            style={slotStyle}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/68">{slot.label}</div>
                                        {item ? (
                                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    className={`break-words text-sm font-fira ${isSignature ? '' : 'text-white/88'}`}
                                                    style={isSignature ? { color: '#f6e7a2' } : undefined}
                                                >
                                                    {item.name}
                                                </span>
                                                {(item.enhance || 0) > 0 && (
                                                    <span className="text-xs font-fira font-bold text-[#d5b180]">+{item.enhance}</span>
                                                )}
                                                {isSignature && (
                                                    <span
                                                        data-testid={`equipment-signature-chip-${slot.key}`}
                                                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em]"
                                                        style={{
                                                            color: '#f6e7a2',
                                                            border: '1px solid rgba(246,231,162,0.42)',
                                                            background: 'rgba(246,231,162,0.08)',
                                                        }}
                                                    >
                                                        <Sparkles size={9} />
                                                        전설 각인
                                                    </span>
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
