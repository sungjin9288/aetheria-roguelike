import { useMemo, useState } from 'react';
// cycle 417: Sword / Shield import 제거 — SLOT_CONFIG.icon 출력 dead 정리 cascade.
import { Sparkles, Target, ChevronDown, ChevronUp, ListTree } from 'lucide-react';
import { CONSTANTS } from '../data/constants';
import { MSG } from '../data/messages';
import { countInventoryItemByName, getEnhancePreview, type EnhanceItemSlot } from '../utils/enhancementUtils';
import { getEquipmentDisclosure, getEquipmentProfile, getItemStatText } from '../utils/equipmentUtils';
import { deriveCharacterAppearance } from '../utils/characterAppearance';
import { getSignatureSetGuidance } from '../utils/signatureSetBonus.js';
import { isSignatureItem } from '../data/signatureItems.js';
import { getJobSetCatalog, getJobOutfitNextHint } from '../utils/jobOutfitAffinity.js';
import { DB } from '../data/db';
import PixelCharacterAvatar from './PixelCharacterAvatar';
import ItemIcon from './icons/ItemIcon';
import EnhanceDecisionCard from './EnhanceDecisionCard';
import ActionButton from './ui/ActionButton';
import { isEquipmentDiscovered } from '../utils/signatureDiscovery';
import type { GameActions } from '../hooks/actionDeps';
import type { EquipSlots, FullStats, Item, Player } from '../types/index.js';

/** EquipmentPanel이 실제로 호출하는 액션만 좁혀 받는다 (강화 실행). */
type EquipmentPanelActions = Pick<GameActions, 'enhanceItem'>;

// cycle 474: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 5 ternary 가지까지 정리 (cycle 472-473 paired).
interface EquipmentPanelProps {
    player: Player;
    stats?: FullStats | null;
    actions?: EquipmentPanelActions;
}

// cycle 417: icon 출력 dead 정리 — slot.icon read 0건. render는 key/label만 사용.
const SLOT_CONFIG: Array<{ key: keyof EquipSlots; label: string }> = [
    { key: 'weapon', label: '주무기' },
    { key: 'armor', label: '방어구' },
    { key: 'offhand', label: '보조 장비' },
];

interface SignatureSetTone {
    border: string;
    glow: string;
    text: string;
}

// cycle 411: frost / arcane 제거 — signatureSets.json sets는 fire/holy/nature/shadow
//   4 tone만 emit. activeSignatureSet.tone / setProgress.tone lookup 절대 hit 안 됨.
// 2026-10 에테르 유리(VD-06): 색은 각인 계열 별칭 토큰(--aether-sig-*-rgb, index.css w3:archive-a)이다 — 원시 hex · rgba 없음.
const SIG_SET_TONE: Record<string, SignatureSetTone> = Object.freeze({
    holy: { border: 'rgb(var(--aether-sig-holy-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-holy-rgb) / 0.16)', text: 'rgb(var(--aether-sig-holy-rgb))' },
    fire: { border: 'rgb(var(--aether-sig-fire-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-fire-rgb) / 0.16)', text: 'rgb(var(--aether-sig-fire-rgb))' },
    shadow: { border: 'rgb(var(--aether-sig-shadow-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-shadow-rgb) / 0.16)', text: 'rgb(var(--aether-sig-shadow-rgb))' },
    nature: { border: 'rgb(var(--aether-sig-nature-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-nature-rgb) / 0.16)', text: 'rgb(var(--aether-sig-nature-rgb))' },
});

// 직업 세트 맞춤 단계 — 단계마다 토큰 하나(금 → 에테르 → 무채).
const AFFINITY_TONE_CLASS: Record<string, string> = Object.freeze({
    full: 'bg-ae-gold-hi/10 text-ae-gold-hi ring-ae-gold-hi/30',
    partial2: 'bg-ae-gold/10 text-ae-gold-text ring-ae-gold/30',
    partial1: 'bg-ae-ether/10 text-ae-ether-hi ring-ae-ether/30',
});

// cycle 452: 컴팩트 default 제거 — Dashboard 호출자가 명시 전달이라 도달 불가.
const EquipmentPanel = ({ player, stats, actions }: EquipmentPanelProps) => {
    const [showSetCatalog, setShowSetCatalog] = useState(false);
    const [detailOverride, setDetailOverride] = useState<boolean | null>(null);
    const [enhanceTarget, setEnhanceTarget] = useState<{ item: Item; slot: EnhanceItemSlot; itemId: string } | null>(null);
    const disclosure = getEquipmentDisclosure(player);
    const showDetails = detailOverride ?? disclosure.showDetails;
    const equipProfile = useMemo(() => getEquipmentProfile(player?.equip || {}), [player?.equip]);
    const setCatalog = useMemo(() => getJobSetCatalog(player?.job, DB.ITEMS), [player?.job]);
    // 인벤토리 + 장착 중 보유 아이템 이름 set (카탈로그에서 ✓/💼 표시용)
    const ownedItemNames = useMemo(() => {
        const names = new Set<string>();
        (player?.inv || []).forEach((it) => it?.name && names.add(it.name));
        Object.values(player?.equip || {}).forEach((it) => it?.name && names.add(it.name));
        return names;
    }, [player?.inv, player?.equip]);
    const equippedItemNames = useMemo(() => {
        const names = new Set<string>();
        Object.values(player?.equip || {}).forEach((it) => it?.name && names.add(it.name));
        return names;
    }, [player?.equip]);
    const appearance = useMemo(() => deriveCharacterAppearance(player), [player]);
    const enhanceMaterialCount = useMemo(
        () => countInventoryItemByName(player?.inv || [], CONSTANTS.ENHANCE_MATERIAL_NAME),
        [player?.inv]
    );

    const slotEntries = useMemo(() => SLOT_CONFIG.map((slot) => {
        const equip = player?.equip || {};
        const item = equip[slot.key] || null;
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
    const setProgress = useMemo(() => getSignatureSetGuidance(player), [player]);
    // 아직 활성화되지 않았거나(1개만 착용) 상위 티어가 남은 경우에만 힌트 카드 표시
    const showProgressHint = setProgress && setProgress.nextBonus;
    const progressTone = setProgress ? (SIG_SET_TONE[setProgress.tone] || SIG_SET_TONE.holy) : null;

    return (
        <div
            data-testid="equipment-panel"
            data-equipment-view={showDetails ? 'full' : 'summary'}
            className="space-y-3"
        >
            <div className="flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                    <div className="text-[13px] font-readable font-bold text-ae-ink">장비 판단</div>
                    <div className="mt-0.5 text-[12px] font-readable text-ae-ink-3">
                        {showDetails ? '보너스와 강화 조건까지 표시 중' : '착용 상태와 세트 조건만 표시 중'}
                    </div>
                </div>
                <ActionButton
                    variant="ghost"
                    data-testid="equipment-detail-toggle"
                    aria-expanded={showDetails}
                    onClick={() => setDetailOverride(!showDetails)}
                    className="min-h-11 shrink-0 px-3 text-[12px]"
                    icon={<ListTree size={14} />}
                    label={showDetails ? '간단히 보기' : '상세 보기'}
                />
            </div>
            {/* 2026-10 에테르 유리: 캐릭터 진열대(바닥 광채 위 정수배 그림) + 능력치 · 착용 줄. 상자 안 상자는 두 층까지만. */}
            <div className="ae-card p-3">
                <div className="flex items-start gap-3">
                    <div className="ae-showcase flex shrink-0 items-center justify-center p-1.5">
                        <PixelCharacterAvatar
                            player={player}
                            appearance={appearance}
                            size="lg"
                            dataTestId="equipment-character-preview"
                            label="직업 초상"
                            className="shrink-0"
                            showEnhanceBadge={false}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="ae-well px-2.5 py-2">
                                <div className="ae-eyebrow">공격력</div>
                                <div className="mt-0.5 font-fira text-[17px] font-bold tabular-nums text-ae-ink">{stats?.atk || 0}</div>
                            </div>
                            <div className="ae-well px-2.5 py-2">
                                <div className="ae-eyebrow">방어력</div>
                                <div className="mt-0.5 font-fira text-[17px] font-bold tabular-nums text-ae-ink">{stats?.def || 0}</div>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between px-1">
                            <span className="text-[12px] font-readable text-ae-ink-3">강화 재료</span>
                            <span className="text-[13px] font-readable font-bold text-ae-exp"><span className="font-fira tabular-nums">{enhanceMaterialCount}</span>개</span>
                        </div>
                    </div>
                </div>
                <div className="ae-rows mt-3">
                    {[
                        { key: 'weapon', label: '주무기', name: weaponName, slot: stats?.jobAffinity?.slots?.weapon },
                        { key: 'armor',  label: '방어구', name: armorName,  slot: stats?.jobAffinity?.slots?.armor },
                        {
                            key: 'offhand',
                            label: '보조 장비',
                            name: twoHandSetCounted ? MSG.OUTFIT_SET_TWO_HAND_SLOT : offhandName,
                            slot: stats?.jobAffinity?.slots?.offhand,
                        },
                    ].map((s) => (
                        <div
                            key={s.key}
                            className="flex min-h-[40px] min-w-0 items-center gap-2 px-1 py-1.5"
                            title={s.slot ? `${player?.job} 세트 매치 슬롯` : undefined}
                        >
                            <span className="w-[64px] shrink-0 text-[12px] font-readable text-ae-ink-3">{s.label}</span>
                            <span className={`min-w-0 flex-1 text-[13px] leading-snug font-readable font-semibold ${s.slot ? 'text-ae-gold-text' : 'text-ae-ink'}`}>{s.name}</span>
                            {s.slot && <Sparkles size={13} aria-label="세트 매치" className="shrink-0 text-ae-gold" />}
                        </div>
                    ))}
                </div>
                {/* cycle 57: 세트 효과 발동 상태 + 발동 조건 안내. matchCount 0 케이스도 노출. */}
                {(() => {
                    const aff = stats?.jobAffinity;
                    if (!aff) return null;
                    const matchCount = aff.matchCount || 0;
                    const toneClass = AFFINITY_TONE_CLASS[aff.tier ?? ''] || 'bg-ae-ink/5 text-ae-ink-2 ring-ae-ink/10';
                    const dots = [0, 1, 2].map((i) => i < matchCount ? '●' : '○').join('');
                    const nextHint = getJobOutfitNextHint(aff, player.job);
                    return (
                        <div
                            data-testid="job-outfit-affinity"
                            data-affinity-tier={aff.tier}
                            data-match-count={matchCount}
                            className={`mt-2 rounded-ae-md px-3 py-2 text-[12px] font-readable ring-1 ring-inset ${toneClass}`}
                        >
                            <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                <span className="tracking-[0.18em]" aria-hidden="true">{dots}</span>
                                <span>{aff.label || `${player?.job} 세트`} (<span className="font-fira tabular-nums">{matchCount}/3</span>)</span>
                                {showDetails && (aff.bonus?.atkMult || 0) > 1 && <span className="text-ae-ink">공격력 +{Math.round(((aff.bonus.atkMult || 0) - 1) * 100)}%</span>}
                                {showDetails && (aff.bonus?.defMult || 0) > 1 && <span className="text-ae-ink">방어력 +{Math.round(((aff.bonus.defMult || 0) - 1) * 100)}%</span>}
                                {showDetails && (aff.bonus?.hpBonus || 0) > 0 && <span className="text-ae-ink">생명 +{Math.round((aff.bonus.hpBonus || 0) * 100)}%</span>}
                                {showDetails && (aff.bonus?.mpBonus || 0) > 0 && <span className="text-ae-ink">기력 +{Math.round((aff.bonus.mpBonus || 0) * 100)}%</span>}
                            </div>
                            <div className="mt-1 font-normal leading-snug text-ae-ink-2">
                                {nextHint}
                            </div>
                            {showDetails && aff.twoHandCounted && (
                                <div data-testid="job-outfit-two-hand-hint" className="mt-1 font-normal leading-snug text-ae-ink-2">
                                    {MSG.OUTFIT_SET_TWO_HAND_HINT}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* cycle 58: 직업 세트 카탈로그 — 어떤 아이템이 세트에 포함되는지 명시.
                사용자 피드백: "세트 효과마다 어떤 아이템들이 세트로 포함되는지를 알려줘야
                유저들이 그걸 보고 세트아이템을 맞추지". 펼침 토글로 인벤 가시성 보존. */}
            {showDetails && (setCatalog.weapon.length + setCatalog.armor.length + setCatalog.offhand.length) > 0 && (
                <div className="ae-card is-quiet px-3 py-1.5">
                    <button
                        type="button"
                        onClick={() => setShowSetCatalog((prev) => !prev)}
                        data-testid="job-set-catalog-toggle"
                        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-ae-sm text-left"
                        aria-expanded={showSetCatalog}
                    >
                        <div className="min-w-0">
                            <div className="text-[13px] font-readable font-bold text-ae-gold-text">{player?.job} 세트 목록</div>
                            <div className="mt-0.5 text-[12px] font-readable text-ae-ink-3 leading-snug">
                                슬롯별 후보 · 장착 중 · 보유 · 미발견
                            </div>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-readable text-ae-ink-3">
                            <span className="font-fira tabular-nums">{setCatalog.weapon.length + setCatalog.armor.length + setCatalog.offhand.length}</span>개
                            {showSetCatalog ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                        </span>
                    </button>
                    {showSetCatalog && (
                        <div className="ae-rows mb-1.5 mt-1.5">
                            {[
                                { key: 'weapon', label: '주무기', list: setCatalog.weapon },
                                { key: 'armor',  label: '방어구', list: setCatalog.armor },
                                { key: 'offhand', label: '보조 장비', list: setCatalog.offhand },
                            ].map((group) => {
                                if (group.list.length === 0) return null;
                                const ownedCount = group.list.filter((it) => ownedItemNames.has(it.name ?? '')).length;
                                return (
                                    <div key={group.key} className="py-2.5">
                                        <div className="mb-1.5 flex items-center justify-between gap-2">
                                            <span className="ae-eyebrow">{group.label}</span>
                                            <span className="text-[11px] font-readable text-ae-ink-3"><span className="font-fira tabular-nums">{ownedCount}/{group.list.length}</span> 보유</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.list.map((it) => {
                                                const isEquipped = equippedItemNames.has(it.name ?? '');
                                                const isOwned = ownedItemNames.has(it.name ?? '');
                                                // 2026-10 Wave 103 (소유자 결정 §107.6 "미보유 이름만 숨김"): 가진 적도 도감에 오른 적도 없는 장비는
                                                //   이름 · 능력치를 숨기고 등급만 남긴다.
                                                const isKnown = isOwned || (player ? isEquipmentDiscovered(it.name ?? '', player) : false);
                                                const baseCls = 'ae-chip max-w-full whitespace-normal font-readable leading-tight';
                                                const cls = isEquipped
                                                    ? `${baseCls} ae-chip-good`
                                                    : isOwned
                                                        ? `${baseCls} ae-chip-gold`
                                                        : `${baseCls} text-ae-ink-3`;
                                                return (
                                                    <span
                                                        key={it.name}
                                                        className={cls}
                                                        title={isKnown ? `${it.name} (등급 ${it.tier || 1}) · ${getItemStatText(it as Item)}` : MSG.JOB_OUTFIT_UNKNOWN_ITEM}
                                                        data-testid={`set-catalog-item-${it.name}`}
                                                        data-known={isKnown ? 'true' : 'false'}
                                                    >
                                                        <span>{isEquipped ? '장착' : isOwned ? '보유' : isKnown ? MSG.JOB_OUTFIT_SEEN : '미발견'}</span>
                                                        <span className={isKnown ? 'text-ae-ink' : undefined}>{isKnown ? it.name : MSG.JOB_OUTFIT_UNKNOWN_ITEM}</span>
                                                        <span className="font-normal text-ae-ink-3">등급 <span className="font-fira tabular-nums">{it.tier || 1}</span></span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="py-2.5 text-[12px] font-readable leading-relaxed text-ae-ink-2">
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
                    className="relative overflow-hidden rounded-ae-md px-3 py-2.5"
                    style={{
                        boxShadow: `inset 0 0 0 1px ${sigSetTone.border}`,
                        background: `radial-gradient(circle at 18% 42%, ${sigSetTone.glow}, transparent 54%), linear-gradient(180deg, var(--aether-s2) 0%, var(--aether-s1) 100%)`,
                    }}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <Sparkles size={14} aria-hidden="true" className="shrink-0" style={{ color: sigSetTone.text }} />
                            <span
                                className="font-display text-[13px] font-bold"
                                style={{ color: sigSetTone.text }}
                            >
                                {activeSignatureSet.name}
                            </span>
                        </div>
                        <span className="shrink-0 text-[12px] font-readable" style={{ color: sigSetTone.text }}>
                            <span className="font-fira tabular-nums">{activeSignatureSet.tier}</span>세트 활성
                        </span>
                    </div>
                    {showDetails && activeSignatureSet.desc && (
                        <div className="mt-1 text-[12px] font-readable leading-relaxed text-ae-ink-2">
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
                    className="ae-card is-quiet relative overflow-hidden px-3 py-2.5"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <Target size={13} aria-hidden="true" className="shrink-0" style={{ color: progressTone.text }} />
                            <span className="font-display text-[13px] font-bold" style={{ color: progressTone.text }}>
                                {setProgress.name}
                            </span>
                            <span className="shrink-0 text-[12px] font-readable text-ae-ink-3">
                                <span className="font-fira tabular-nums">{setProgress.equippedCount}</span>피스 적용
                            </span>
                        </div>
                        <span
                            className="ae-chip shrink-0"
                            style={{ color: progressTone.text, boxShadow: `inset 0 0 0 1px ${progressTone.border}` }}
                        >
                            {setProgress.nextItems.length > 0 ? `${setProgress.nextTier}세트 후보` : '조합 확인'}
                        </span>
                    </div>
                    {setProgress.nextItems.length > 0 ? (
                        <div className="mt-1 text-[12px] font-readable leading-relaxed text-ae-ink-2">
                            아래 후보 중 1개를 추가 장착하면 — {setProgress.nextBonus?.desc}
                        </div>
                    ) : (
                        <div className="mt-1 text-[12px] font-readable leading-relaxed text-ae-ink-2">
                            {setProgress.additionStatus === 'previous-job'
                                ? '이전 직업의 장비를 유지 중입니다. 현재 직업의 착용 조건에 맞춰 조합을 다시 살펴보세요.'
                                : '현재 직업에서 이 세트 장비를 유지한 채 추가 장착으로 다음 단계를 완성할 수 없습니다.'}
                            {' '}장비 자체 능력과 이미 발동한 효과는 그대로 적용됩니다.
                        </div>
                    )}
                    {setProgress.nextItems.map((candidate) => (
                        <div key={candidate.name} data-testid="signature-set-candidate" className="mt-1 text-[12px] font-readable leading-relaxed text-ae-ink-2">
                            후보: {candidate.discovered ? candidate.name : MSG.SIGNATURE_SET_UNKNOWN_CANDIDATE} · {candidate.availableNow ? '착용 조건 충족' : `레벨 ${candidate.requiredLevel} 필요`}
                        </div>
                    ))}
                    {setProgress.nextItems.length > 0 && (
                        <div className="mt-1 text-[12px] font-readable text-ae-ink-3">미보유 장비도 포함합니다. 같은 한손무기는 별도의 한 자루가 필요합니다.</div>
                    )}
                    {setProgress.twoHandCounted && (
                        <div
                            data-testid="signature-set-two-hand-hint"
                            className="mt-1 text-[12px] font-readable text-ae-ink-3 leading-snug"
                        >
                            {MSG.SIGNATURE_SET_TWO_HAND_HINT}
                        </div>
                    )}
                </div>
            )}

            {showDetails && <div className="ae-card ae-rows px-3 py-1">
                {slotEntries.map((slot) => {
                    const item = slot.item;
                    const slotKey = slot.key;
                    const isSignature = slot.isSignature;

                    // 2026-10 에테르 유리: 칸은 상자가 아니라 hairline으로 나뉜 줄이다 — 전설 각인 칸만 금빛 물빛으로 띄운다.
                    const slotClassName = isSignature
                        ? 'ae-equip-slot is-signature -mx-1.5 my-1 rounded-ae-md px-1.5 py-3'
                        : 'ae-equip-slot py-3';

                    return (
                        <div
                            key={slot.key}
                            data-testid={`equipment-slot-${slot.key}`}
                            data-is-signature={isSignature ? 'true' : 'false'}
                            className={slotClassName}
                        >
                            <div className="flex items-start justify-between gap-3">
                                {item && (
                                    <ItemIcon
                                        item={item}
                                        size={42}
                                        showBorder
                                        className="mt-0.5"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="min-w-0">
                                        <div className="ae-eyebrow">{slot.label}</div>
                                        {item ? (
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                <span className={`break-words text-[14px] font-readable font-bold ${isSignature ? 'text-ae-gold-hi' : 'text-ae-ink'}`}>
                                                    {item.name}
                                                </span>
                                                {(item.enhance || 0) > 0 && (
                                                    <span className="font-fira text-[13px] font-bold tabular-nums text-ae-gold-text">+{item.enhance}</span>
                                                )}
                                                {isSignature && (
                                                    <span
                                                        data-testid={`equipment-signature-chip-${slot.key}`}
                                                        className="ae-chip ae-chip-gold"
                                                    >
                                                        <Sparkles size={11} aria-hidden="true" />
                                                        전설 각인
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-0.5 text-[13px] font-readable text-ae-ink-3">장착된 장비가 없습니다</div>
                                        )}
                                    </div>
                                    {item && (
                                        <>
                                            <div className="mt-1.5 text-[12px] font-readable leading-relaxed text-ae-ink-2">{getItemStatText(item, slot.key === 'offhand' ? 'offhand' : undefined)}</div>
                                            {slot.canEnhance && slot.requirement && (
                                                <div className="ae-sunk mt-2 space-y-0.5 rounded-ae-sm px-2.5 py-2 text-[12px] font-readable">
                                                    <div className="text-ae-ink-2">
                                                        골드 <span className="font-fira tabular-nums">{slot.requirement.gold.toLocaleString()}</span> · {slot.requirement.materialName} <span className="font-fira tabular-nums">{slot.requirement.materials}</span>개
                                                    </div>
                                                    <div className={slot.affordable ? 'text-ae-good' : 'text-ae-gold-text'}>
                                                        {slot.enhanceHint}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {slot.canEnhance && item && actions?.enhanceItem && (
                                    <ActionButton
                                        variant="glass"
                                        data-testid={`equipment-enhance-${slot.key}`}
                                        onClick={() => setEnhanceTarget({
                                            item,
                                            slot: slotKey as EnhanceItemSlot,
                                            itemId: item.id || `equip:${slotKey}`,
                                        })}
                                        aria-label={`${item.name} 강화 결과와 비용 보기`}
                                        className="min-h-11 shrink-0 px-3 text-[12px]"
                                        title="강화 결과와 비용 보기"
                                        label="강화 보기"
                                    />
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
