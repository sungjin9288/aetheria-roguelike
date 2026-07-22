import { useMemo, useState } from 'react';
// cycle 417: Sword / Shield import 제거 — SLOT_CONFIG.icon 출력 dead 정리 cascade.
import { Sparkles, Target, ChevronDown, ChevronUp, ListTree } from 'lucide-react';
import { CONSTANTS } from '../data/constants';
import { MSG } from '../data/messages';
import { countInventoryItemByName, getEnhancePreview, type EnhanceItemSlot } from '../utils/enhancementUtils';
import { getEquipmentDisclosure, getEquipmentProfile, getItemStatText } from '../utils/equipmentUtils';
import { deriveCharacterAppearance } from '../utils/characterAppearance';
import { getSignatureSetProgress } from '../utils/signatureSetBonus.js';
import { isSignatureItem } from '../data/signatureItems.js';
import { getJobSetCatalog } from '../utils/jobOutfitAffinity.js';
import { DB } from '../data/db';
import PixelCharacterAvatar from './PixelCharacterAvatar';
import ItemIcon from './icons/ItemIcon';
import EnhanceDecisionCard from './EnhanceDecisionCard';
import type { Player } from '../types/index.js';

// cycle 474: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 5 ternary 가지까지 정리 (cycle 472-473 paired).
interface EquipmentPanelProps {
    player: Player;
    stats?: any;
    actions?: any;
}

// cycle 417: icon 출력 dead 정리 — slot.icon read 0건. render는 key/label만 사용.
const SLOT_CONFIG: any = [
    { key: 'weapon', label: '주무기' },
    { key: 'armor', label: '방어구' },
    { key: 'offhand', label: '보조 장비' },
];

// cycle 411: frost / arcane 제거 — signatureSets.json sets는 fire/holy/nature/shadow
//   4 tone만 emit. activeSignatureSet.tone / setProgress.tone lookup 절대 hit 안 됨.
const SIG_SET_TONE: any = Object.freeze({
    holy: { border: 'rgba(246,231,162,0.5)', glow: 'rgba(246,231,162,0.18)', text: '#f6e7a2' },
    fire: { border: 'rgba(255,180,138,0.5)', glow: 'rgba(255,180,138,0.18)', text: '#ffb48a' },
    shadow: { border: 'rgba(199,164,240,0.5)', glow: 'rgba(199,164,240,0.18)', text: '#c7a4f0' },
    nature: { border: 'rgba(168,208,160,0.5)', glow: 'rgba(168,208,160,0.18)', text: '#a8d0a0' },
});

// cycle 452: 컴팩트 default 제거 — Dashboard 호출자가 명시 전달이라 도달 불가.
const EquipmentPanel = ({ player, stats, actions }: EquipmentPanelProps) => {
    const [showSetCatalog, setShowSetCatalog] = useState(false);
    const [detailOverride, setDetailOverride] = useState<boolean | null>(null);
    const [enhanceTarget, setEnhanceTarget] = useState<{ item: any; slot: EnhanceItemSlot; itemId: string } | null>(null);
    const disclosure = getEquipmentDisclosure(player);
    const showDetails = detailOverride ?? disclosure.showDetails;
    const equipProfile = useMemo(() => getEquipmentProfile(player?.equip || {}), [player?.equip]);
    const setCatalog = useMemo(() => getJobSetCatalog(player?.job, DB.ITEMS), [player?.job]);
    // 인벤토리 + 장착 중 보유 아이템 이름 set (카탈로그에서 ✓/💼 표시용)
    const ownedItemNames = useMemo(() => {
        const names = new Set<string>();
        (player?.inv || []).forEach((it: any) => it?.name && names.add(it.name));
        (Object.values(player?.equip || {}) as any[]).forEach((it: any) => it?.name && names.add(it.name));
        return names;
    }, [player?.inv, player?.equip]);
    const equippedItemNames = useMemo(() => {
        const names = new Set<string>();
        (Object.values(player?.equip || {}) as any[]).forEach((it: any) => it?.name && names.add(it.name));
        return names;
    }, [player?.equip]);
    const appearance = useMemo(() => deriveCharacterAppearance(player), [player]);
    const enhanceMaterialCount = useMemo(
        () => countInventoryItemByName(player?.inv || [], CONSTANTS.ENHANCE_MATERIAL_NAME),
        [player?.inv]
    );

    const slotEntries = useMemo(() => SLOT_CONFIG.map((slot: any) => {
        const equipMap = (player?.equip || {}) as Record<string, any>;
        const item = equipMap[slot.key] || null;
        const preview = getEnhancePreview(item, player?.gold || 0, player?.inv || [], slot.key as EnhanceItemSlot);
        const isSignature = item ? isSignatureItem(item) : false;

        return {
            ...slot,
            item,
            isSignature,
            requirement: preview?.requirement || null,
            canEnhance: preview?.canEnhance || false,
            affordable: preview?.affordable || false,
            enhanceHint: preview?.hint || '강화 불가',
        };
    }), [player?.equip, player?.gold, player?.inv]);
    const enhancePreview = useMemo(() => (
        enhanceTarget
            ? getEnhancePreview(enhanceTarget.item, player?.gold || 0, player?.inv || [], enhanceTarget.slot)
            : null
    ), [enhanceTarget, player?.gold, player?.inv]);

    const confirmEnhancement = () => {
        if (!enhanceTarget || !enhancePreview?.affordable) return;
        actions?.enhanceItem?.(enhanceTarget.itemId);
        setEnhanceTarget(null);
    };

    const weaponName = equipProfile.mainWeapon?.name || '없음';
    const offhandName = equipProfile.offhandItem?.name || '없음';
    const armorName = player?.equip?.armor?.name || '없음';
    const twoHandSetCounted = Boolean(stats?.jobAffinity?.twoHandCounted);
    const activeSignatureSet = stats?.activeSignatureSet || null;
    const sigSetTone = activeSignatureSet ? (SIG_SET_TONE[activeSignatureSet.tone] || SIG_SET_TONE.holy) : null;
    const setProgress = useMemo(() => getSignatureSetProgress(player?.equip), [player?.equip]);
    // 아직 활성화되지 않았거나(1개만 착용) 상위 티어가 남은 경우에만 힌트 카드 표시
    const showProgressHint = setProgress && setProgress.nextBonus;
    const progressTone = setProgress ? (SIG_SET_TONE[setProgress.tone] || SIG_SET_TONE.holy) : null;

    return (
        <div
            data-testid="equipment-panel"
            data-equipment-view={showDetails ? 'full' : 'summary'}
            className="space-y-3"
        >
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/18 px-3 py-2">
                <div className="min-w-0">
                    <div className="text-[11px] font-readable font-bold text-white/88">장비 판단</div>
                    <div className="mt-0.5 text-[10px] font-readable text-slate-400/78">
                        {showDetails ? '보너스와 강화 조건까지 표시 중' : '착용 상태와 세트 조건만 표시 중'}
                    </div>
                </div>
                <button
                    type="button"
                    data-testid="equipment-detail-toggle"
                    aria-expanded={showDetails}
                    onClick={() => setDetailOverride(!showDetails)}
                    className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-md border border-[#d5b180]/26 bg-[#d5b180]/10 px-3 text-[10px] font-readable font-bold text-[#f6e7c8]"
                >
                    <ListTree size={13} />
                    {showDetails ? '간단히 보기' : '상세 보기'}
                </button>
            </div>
            <div className="overflow-hidden rounded-[1.1rem] border border-white/8 bg-black/18 p-3">
                <div className="flex items-start gap-3">
                    <PixelCharacterAvatar
                        player={player}
                        appearance={appearance}
                        size="lg"
                        dataTestId="equipment-character-preview"
                        label="장비 외형 미리보기"
                        className="shrink-0"
                        showEnhanceBadge={false}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[11px] font-readable text-slate-400">공격력</div>
                                <div className="mt-0.5 text-xs font-readable font-bold text-[#dff7f5]">{stats?.atk || 0}</div>
                            </div>
                            <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                                <div className="text-[11px] font-readable text-slate-400">방어력</div>
                                <div className="mt-0.5 text-xs font-readable font-bold text-white/88">{stats?.def || 0}</div>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                            <span className="text-[11px] font-readable text-slate-400">강화 재료</span>
                            <span className="text-xs font-readable font-bold text-[#e3dcff]">{enhanceMaterialCount}개</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                            {[
                                { key: 'weapon', label: '주무기', name: weaponName, slot: stats?.jobAffinity?.slots?.weapon },
                                { key: 'armor',  label: '방어구', name: armorName,  slot: stats?.jobAffinity?.slots?.armor },
                                {
                                    key: 'offhand',
                                    label: '보조 장비',
                                    name: twoHandSetCounted ? MSG.OUTFIT_SET_TWO_HAND_SLOT : offhandName,
                                    slot: stats?.jobAffinity?.slots?.offhand,
                                },
                            ].map((s: any) => (
                                <div
                                    key={s.key}
                                    className={`flex min-w-0 items-center gap-2 rounded-[0.85rem] px-2.5 py-1.5 transition-colors ${s.slot ? 'border border-[#d5b180]/30 bg-[#d5b180]/8' : 'aether-panel-muted'}`}
                                    title={s.slot ? `${player?.job} 세트 매치 슬롯` : undefined}
                                >
                                    <span className="w-[52px] shrink-0 text-[10px] font-readable text-slate-400/74">{s.label}</span>
                                    <span className={`min-w-0 flex-1 truncate text-[11px] font-readable font-semibold ${s.slot ? 'text-[#f6e7c8]' : 'text-white/88'}`}>{s.name}</span>
                                    {s.slot && <Sparkles size={11} aria-label="세트 매치" className="shrink-0 text-[#d5b180]" />}
                                </div>
                            ))}
                        </div>
                        {/* cycle 57: 세트 효과 발동 상태 + 발동 조건 안내. matchCount 0 케이스도 노출. */}
                        {(() => {
                            const aff = stats?.jobAffinity;
                            if (!aff) return null;
                            const matchCount = aff.matchCount || 0;
                            const tone =
                                aff.tier === 'full' ? { color: '#f6e7a2', border: 'rgba(246,231,162,0.42)', bg: 'rgba(246,231,162,0.10)' } :
                                aff.tier === 'partial2' ? { color: '#d5b180', border: 'rgba(213,177,128,0.42)', bg: 'rgba(213,177,128,0.10)' } :
                                aff.tier === 'partial1' ? { color: '#7dd4d8', border: 'rgba(125,212,216,0.42)', bg: 'rgba(125,212,216,0.10)' } :
                                { color: '#94a3b8', border: 'rgba(148,163,184,0.32)', bg: 'rgba(148,163,184,0.06)' };
                            const dots = [0, 1, 2].map((i: any) => i < matchCount ? '●' : '○').join('');
                            const nextHint = matchCount === 0
                                ? `같은 직업(${player?.job}) 호환 장비 1개 장착 시 세트 효과 발동`
                                : matchCount < 3
                                    ? `${3 - matchCount}개 더 맞추면 ${matchCount === 1 ? '2단계 효과 (공격력 +15%, 방어력 +10%)' : '풀세트 효과 (공격력 +30%, 방어력 +20%)'}`
                                    : aff.twoHandCounted
                                        ? '풀세트 발동 — 양손 무기 2피스와 방어구 매치 완료'
                                        : '풀세트 발동 — 모든 슬롯 매치 완료';
                            return (
                                <div
                                    data-testid="job-outfit-affinity"
                                    data-affinity-tier={aff.tier}
                                    data-match-count={matchCount}
                                    className="mt-2 rounded-[0.95rem] px-2.5 py-2 text-[10px] font-fira"
                                    style={{ color: tone.color, border: `1px solid ${tone.border}`, background: tone.bg }}
                                >
                                    <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                        <span className="tracking-[0.18em]" aria-hidden="true">{dots}</span>
                                        <span>{aff.label || `${player?.job} 세트`} ({matchCount}/3)</span>
                                        {showDetails && aff.bonus?.atkMult > 1 && <span className="text-white/82">공격력 +{Math.round((aff.bonus.atkMult - 1) * 100)}%</span>}
                                        {showDetails && aff.bonus?.defMult > 1 && <span className="text-white/82">방어력 +{Math.round((aff.bonus.defMult - 1) * 100)}%</span>}
                                        {showDetails && aff.bonus?.hpBonus > 0 && <span className="text-white/82">생명 +{Math.round(aff.bonus.hpBonus * 100)}%</span>}
                                        {showDetails && aff.bonus?.mpBonus > 0 && <span className="text-white/82">기력 +{Math.round(aff.bonus.mpBonus * 100)}%</span>}
                                    </div>
                                    <div className="mt-1 text-white/70 font-normal leading-snug" style={{ color: 'rgba(255,255,255,0.66)' }}>
                                        {nextHint}
                                    </div>
                                    {showDetails && aff.twoHandCounted && (
                                        <div data-testid="job-outfit-two-hand-hint" className="mt-1 text-white/70 font-normal leading-snug">
                                            {MSG.OUTFIT_SET_TWO_HAND_HINT}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* cycle 58: 직업 세트 카탈로그 — 어떤 아이템이 세트에 포함되는지 명시.
                사용자 피드백: "세트 효과마다 어떤 아이템들이 세트로 포함되는지를 알려줘야
                유저들이 그걸 보고 세트아이템을 맞추지". 펼침 토글로 인벤 가시성 보존. */}
            {showDetails && (setCatalog.weapon.length + setCatalog.armor.length + setCatalog.offhand.length) > 0 && (
                <div className="rounded-[1rem] border border-white/8 bg-black/16 px-3 py-2.5">
                    <button
                        type="button"
                        onClick={() => setShowSetCatalog((prev: any) => !prev)}
                        data-testid="job-set-catalog-toggle"
                        className="flex w-full items-center justify-between gap-2 text-left"
                        aria-expanded={showSetCatalog}
                    >
                        <div className="min-w-0">
                            <div className="text-[10px] font-readable text-[#d5b180]/82">{player?.job} 세트 목록</div>
                            <div className="mt-0.5 text-[11px] font-fira text-slate-300/72 leading-snug">
                                슬롯별 후보 · 장착 중 · 보유 · 미발견
                            </div>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-fira text-slate-400/72">
                            {setCatalog.weapon.length + setCatalog.armor.length + setCatalog.offhand.length}개
                            {showSetCatalog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                    </button>
                    {showSetCatalog && (
                        <div className="mt-2.5 space-y-2.5">
                            {[
                                { key: 'weapon', label: '주무기', list: setCatalog.weapon },
                                { key: 'armor',  label: '방어구', list: setCatalog.armor },
                                { key: 'offhand', label: '보조 장비', list: setCatalog.offhand },
                            ].map((group: any) => {
                                if (group.list.length === 0) return null;
                                const ownedCount = group.list.filter((it: any) => ownedItemNames.has(it.name)).length;
                                return (
                                    <div key={group.key}>
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className="text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400/80">{group.label}</span>
                                            <span className="text-[9px] font-fira text-slate-500">{ownedCount}/{group.list.length} 보유</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.list.map((it: any) => {
                                                const isEquipped = equippedItemNames.has(it.name);
                                                const isOwned = ownedItemNames.has(it.name);
                                                const baseCls = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-fira leading-tight';
                                                const cls = isEquipped
                                                    ? `${baseCls} border-emerald-300/50 bg-emerald-300/10 text-emerald-100`
                                                    : isOwned
                                                        ? `${baseCls} border-[#d5b180]/40 bg-[#d5b180]/8 text-[#f6e7c8]`
                                                        : `${baseCls} border-white/10 bg-white/[0.02] text-slate-400/80`;
                                                return (
                                                    <span
                                                        key={it.name}
                                                        className={cls}
                                                        title={`${it.name} (등급 ${it.tier || 1}) · ${getItemStatText(it)}`}
                                                        data-testid={`set-catalog-item-${it.name}`}
                                                    >
                                                        <span>{isEquipped ? '장착' : isOwned ? '보유' : '미발견'}</span>
                                                        <span className="truncate max-w-[100px]">{it.name}</span>
                                                        <span className="text-slate-500/80">등급 {it.tier || 1}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="rounded-[0.85rem] border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[10px] font-fira leading-snug text-slate-400/80">
                                한손 무기·방어구·보조 장비 또는 양손 무기(2피스)·방어구를 맞추면 풀세트 효과가 발동합니다. 공격력 +30%, 방어력 +20%, 생명 +10%, 기력 +15%
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                    {showDetails && activeSignatureSet.desc && (
                        <div className="mt-1 text-[10px] font-fira leading-[1.4] text-slate-300/85">
                            {activeSignatureSet.desc}
                        </div>
                    )}
                </div>
            )}

            {showDetails && showProgressHint && progressTone && (
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
                            {(setProgress.nextTier ?? 0) - setProgress.equippedCount}개 더 장착 시 — {setProgress.nextBonus.desc}
                        </div>
                    )}
                    {setProgress.missingMembers.length > 0 && (
                        <div className="mt-1 text-[9px] font-fira text-slate-500/85 truncate">
                            필요: {setProgress.missingMembers.slice(0, 3).join(' · ')}
                            {setProgress.missingMembers.length > 3 ? ` +${setProgress.missingMembers.length - 3}` : ''}
                        </div>
                    )}
                    {setProgress.twoHandCounted && (
                        <div
                            data-testid="signature-set-two-hand-hint"
                            className="mt-1 text-[9px] font-fira text-slate-500/85 leading-snug"
                        >
                            {MSG.SIGNATURE_SET_TWO_HAND_HINT}
                        </div>
                    )}
                </div>
            )}

            {showDetails && <div className="space-y-1.5">
                {slotEntries.map((slot: any) => {
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
                        ? 'rounded-[1rem] px-3 py-3'
                        : `rounded-[1rem] border px-3 py-3 ${item ? 'border-white/8 aether-panel-muted' : 'border-white/6 bg-black/14'}`;

                    return (
                        <div
                            key={slot.key}
                            data-testid={`equipment-slot-${slot.key}`}
                            data-is-signature={isSignature ? 'true' : 'false'}
                            className={slotClassName}
                            style={slotStyle}
                        >
                            <div className="flex items-start justify-between gap-3">
                                {item && (
                                    <ItemIcon
                                        item={item}
                                        size={42}
                                        showBorder
                                        className="mt-0.5 opacity-95"
                                    />
                                )}
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
                                                        골드 {slot.requirement.gold.toLocaleString()} · {slot.requirement.materialName} {slot.requirement.materials}개
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
                                        onClick={() => setEnhanceTarget({
                                            item,
                                            slot: slotKey as EnhanceItemSlot,
                                            itemId: item.id || `equip:${slotKey}`,
                                        })}
                                        disabled={!slot.affordable}
                                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-fira font-bold transition-colors ${
                                            slot.affordable
                                                ? 'border-[#d5b180]/22 bg-[#d5b180]/10 text-[#f6e7c8] hover:bg-[#d5b180]/18'
                                                : 'border-white/8 bg-black/20 text-slate-500 opacity-80'
                                        }`}
                                        title={slot.requirement ? `다음 강화 비용: 골드 ${slot.requirement.gold.toLocaleString()} · ${slot.requirement.materialName} ${slot.requirement.materials}개` : '강화 불가'}
                                    >
                                        강화 보기
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>}

            {enhancePreview && (
                <EnhanceDecisionCard
                    preview={enhancePreview}
                    onCancel={() => setEnhanceTarget(null)}
                    onConfirm={confirmEnhancement}
                />
            )}
        </div>
    );
};

export default EquipmentPanel;
