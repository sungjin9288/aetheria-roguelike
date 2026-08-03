import { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Check, Coins, GitBranch, RotateCcw, Shield, Sparkles, Zap } from 'lucide-react';
import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { getJobSkills } from '../utils/gameUtils';
import {
    formatSkillText,
    getSkillEffectLabel,
    getSkillMetrics,
} from '../utils/skillPresentation';
import type { ClassSkill, SkillBranchChoice } from '../types/class.js';
import type { Player } from '../types/index.js';
import ClassIcon from './icons/ClassIcon';
import SkillTypeIcon from './icons/SkillTypeIcon';
import ClassTree from './ClassTree';
import SignalBadge from './SignalBadge';

interface SkillActions {
    chooseSkillBranch?: (skillName: string, choice: string) => void;
    selectSkill?: (skillName: string) => void;
    swapSkillChoice?: (skillName: string, choice: string) => void;
}

interface SkillTreePreviewProps {
    player: Player;
    actions?: SkillActions;
}

interface GrowthDecisionProps {
    skillName: string;
    branches: SkillBranchChoice[];
    currentChoice?: string;
    gold: number;
    cost: number;
    onConfirm?: (choice: string) => void;
}

interface SkillCardProps {
    skill: ClassSkill;
    cooldown: number;
    selected: boolean;
    branchLabel?: string;
    onSelect?: (skillName: string) => void;
}

const TYPE_TONES: Record<string, string> = {
    화염: 'warning',
    빛: 'upgrade',
    냉기: 'recommended',
    어둠: 'resonance',
    자연: 'success',
    대지: 'neutral',
    물리: 'neutral',
};

const SKILL_TYPE_LABELS: Record<string, string> = {
    buff: '강화',
    debuff: '약화',
    escape: '탈출',
};

const GrowthDecision = ({
    skillName,
    branches,
    currentChoice,
    gold,
    cost,
    onConfirm,
}: GrowthDecisionProps) => {
    const choices = branches.filter((branch) => branch.choice && branch.label);
    const [selectedChoice, setSelectedChoice] = useState(currentChoice || choices[0]?.choice || '');
    const selectedBranch = choices.find((branch) => branch.choice === selectedChoice);
    const isFirstChoice = !currentChoice;
    const isUnchanged = selectedChoice === currentChoice;
    const canAfford = isFirstChoice || gold >= cost;
    const canConfirm = Boolean(selectedBranch && onConfirm && canAfford && !isUnchanged);

    const confirmLabel = (() => {
        if (!selectedBranch) return '성장을 선택하세요';
        if (!isFirstChoice && !canAfford) return `골드 부족 · ${cost} 필요`;
        if (isUnchanged) return '현재 적용 중인 성장';
        return `${selectedBranch.label}로 성장 확정`;
    })();

    return (
        <div data-testid={`skill-growth-decision-${skillName}`} className="space-y-3">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <div className="aether-type-meta font-readable text-slate-400/76">{isFirstChoice ? '첫 성장' : '성장 변경'}</div>
                    <h3 className="aether-type-title mt-0.5 font-readable font-semibold text-slate-100">
                        {skillName}을 어떻게 바꿀까?
                    </h3>
                </div>
                <SignalBadge tone={isFirstChoice ? 'recommended' : 'upgrade'} size="sm">
                    {isFirstChoice ? '무료' : `골드 ${cost}`}
                </SignalBadge>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {choices.map((branch) => {
                    const choice = branch.choice as string;
                    const selected = selectedChoice === choice;
                    return (
                        <button
                            key={choice}
                            type="button"
                            data-testid={`skill-branch-choice-${skillName}-${choice}`}
                            data-selected={selected ? 'true' : 'false'}
                            aria-pressed={selected}
                            onClick={() => setSelectedChoice(choice)}
                            className={`min-h-[92px] rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                selected
                                    ? 'border-[#7dd4d8]/54 bg-[#7dd4d8]/12 text-white'
                                    : 'border-white/8 bg-black/14 text-slate-200 hover:border-[#7dd4d8]/24'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-readable text-sm font-semibold">{branch.label}</span>
                                {selected && <Check size={14} className="shrink-0 text-[#7dd4d8]" />}
                            </div>
                            <div className="aether-type-body mt-2 font-readable leading-snug text-slate-300/78">
                                {formatSkillText(branch.desc)}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-start gap-2 border-t border-white/8 pt-3 font-readable">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-[#d5b180]" />
                <div className="min-w-0 flex-1">
                    <div className="aether-type-meta text-slate-400/76">선택 결과</div>
                    <div className="aether-type-body mt-0.5 text-slate-100">
                        {selectedBranch ? formatSkillText(selectedBranch.desc) : '후보를 선택하면 결과를 미리 볼 수 있습니다.'}
                    </div>
                </div>
            </div>

            <button
                type="button"
                data-testid={`skill-growth-confirm-${skillName}`}
                onClick={() => selectedBranch?.choice && canConfirm && onConfirm?.(selectedBranch.choice)}
                disabled={!canConfirm}
                className="aether-cta-primary aether-disabled-action flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-4 font-readable text-sm font-semibold text-[#dff7f5] disabled:cursor-not-allowed"
            >
                {isFirstChoice ? <GitBranch size={15} /> : <Coins size={15} />}
                {confirmLabel}
            </button>
        </div>
    );
};

const SkillCard = ({ skill, cooldown, selected, branchLabel, onSelect }: SkillCardProps) => {
    const name = skill.name || '이름 없는 기술';
    const effect = getSkillEffectLabel(skill.effect);
    const metrics = getSkillMetrics(skill);
    const typeLabel = skill.type ? SKILL_TYPE_LABELS[skill.type] || skill.type : null;

    return (
        <button
            type="button"
            data-testid={`skill-card-select-${name}`}
            data-selected={selected ? 'true' : 'false'}
            aria-pressed={selected}
            onClick={() => onSelect?.(name)}
            disabled={!onSelect}
            className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
                selected
                    ? 'border-[#7dd4d8]/40 bg-[#7dd4d8]/10'
                    : 'border-white/8 bg-black/12 hover:border-white/16'
            } ${cooldown > 0 ? 'opacity-70' : ''}`}
        >
            <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/8 bg-black/18">
                    <SkillTypeIcon type={skill.type || '물리'} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-readable text-sm font-semibold text-slate-100">{name}</span>
                        {selected && <SignalBadge tone="recommended" size="sm">전투 선택</SignalBadge>}
                        {branchLabel && <SignalBadge tone="resonance" size="sm">성장 · {branchLabel}</SignalBadge>}
                        {skill.fromWeapon && <SignalBadge tone="spotlight" size="sm">무기</SignalBadge>}
                        {skill.fromTrait && <SignalBadge tone="resonance" size="sm">성향</SignalBadge>}
                    </div>
                    <div className="aether-type-body mt-1 line-clamp-2 font-readable leading-snug text-slate-300/76">
                        {formatSkillText(skill.desc)}
                    </div>
                    <div className="aether-type-meta mt-1.5 flex flex-wrap gap-x-2 gap-y-1 font-readable text-slate-400/76">
                        {metrics.map((metric) => <span key={metric}>{metric}</span>)}
                        {effect && !metrics.includes(effect) && <span>{effect}</span>}
                        {typeLabel && <span className="text-slate-300/82">{typeLabel}</span>}
                        {cooldown > 0 && <span className="text-rose-200">재사용까지 {cooldown}턴</span>}
                    </div>
                </div>
            </div>
        </button>
    );
};

const SkillTreePreview = ({ player, actions }: SkillTreePreviewProps) => {
    const [swapTarget, setSwapTarget] = useState<string | null>(null);
    const currentClass = DB.CLASSES[player.job as string];
    const currentSkills = getJobSkills(player) as ClassSkill[];
    const selectedIndex = player.skillLoadout?.selected ?? 0;
    const selectedSkillName = currentSkills[selectedIndex % Math.max(1, currentSkills.length)]?.name || null;
    const cooldowns = player.skillLoadout?.cooldowns || {};
    const isInSafeZone = DB.MAPS[player.loc as string]?.type === 'safe';
    const swapCost = BALANCE.SKILL_SWAP_COST || 50;

    if (!currentClass) return null;

    const pendingGrowth = Object.entries(currentClass.skillBranches || {})
        .filter(([skillName]) => !player.skillChoices?.[skillName]);

    return (
        <div data-testid="skill-tree-preview" className="space-y-4">
            <header className="flex items-center gap-3 border-b border-white/8 pb-3">
                <ClassIcon className={player.job as string} size={34} tier={currentClass.tier || 0} />
                <div className="min-w-0 flex-1">
                    <div className="aether-type-meta font-readable text-slate-400/76">기술 구성</div>
                    <h2 className="truncate font-readable text-lg font-semibold text-slate-100">
                        {player.job} 전투 기술
                    </h2>
                </div>
                <div className="shrink-0 text-right font-readable">
                    <div className="aether-type-meta text-slate-400/76">현재 선택</div>
                    <div className="aether-type-body mt-0.5 font-semibold text-[#dff7f5]">{selectedSkillName || '없음'}</div>
                </div>
            </header>

            {pendingGrowth.length > 0 && (
                <section data-testid="skill-growth-pending" className="border-y border-[#7dd4d8]/18 bg-[#7dd4d8]/5 px-3 py-3.5">
                    <div className="mb-3 flex items-center gap-2 font-readable">
                        <GitBranch size={15} className="text-[#7dd4d8]" />
                        <div>
                            <div className="aether-type-title font-semibold text-slate-100">기술 성장 선택</div>
                            <div className="aether-type-meta mt-0.5 text-slate-400/76">
                                후보를 비교한 뒤 확정하세요. 첫 선택은 무료입니다.
                            </div>
                        </div>
                    </div>
                    <div className="space-y-5">
                        {pendingGrowth.map(([skillName, branches]) => (
                            <GrowthDecision
                                key={skillName}
                                skillName={skillName}
                                branches={branches}
                                gold={player.gold || 0}
                                cost={swapCost}
                                onConfirm={actions?.chooseSkillBranch
                                    ? (choice) => actions.chooseSkillBranch?.(skillName, choice)
                                    : undefined}
                            />
                        ))}
                    </div>
                </section>
            )}

            <section aria-labelledby="current-skills-title">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Shield size={14} className="text-slate-400" />
                        <h3 id="current-skills-title" className="aether-type-title font-readable font-semibold text-slate-100">현재 기술</h3>
                    </div>
                    <span className="aether-type-meta font-readable text-slate-400/76">
                        {isInSafeZone ? '안전 지역 · 성장 변경 가능' : '마을에서 성장 변경'}
                    </span>
                </div>

                <div className="space-y-2">
                    {currentSkills.map((skill) => {
                        const name = skill.name || '이름 없는 기술';
                        const branches = currentClass.skillBranches?.[name];
                        const currentChoice = player.skillChoices?.[name];
                        const currentBranch = branches?.find((branch) => branch.choice === currentChoice);
                        const isSwapping = swapTarget === name;

                        return (
                            <div key={name}>
                                <SkillCard
                                    skill={skill}
                                    selected={name === selectedSkillName}
                                    cooldown={cooldowns[name] || 0}
                                    branchLabel={currentBranch?.label}
                                    onSelect={actions?.selectSkill}
                                />

                                {branches && currentChoice && isInSafeZone && actions?.swapSkillChoice && (
                                    <div className="mt-1.5 border-l border-[#d5b180]/24 pl-3">
                                        <button
                                            type="button"
                                            data-testid={`skill-growth-change-${name}`}
                                            onClick={() => setSwapTarget(isSwapping ? null : name)}
                                            className="flex min-h-[44px] items-center gap-2 font-readable text-sm text-[#f6e7c8]/82"
                                        >
                                            <RotateCcw size={14} />
                                            {isSwapping ? '성장 변경 닫기' : '성장 변경'}
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {isSwapping && (
                                                <Motion.div
                                                    key={`${name}-${currentChoice}`}
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -4 }}
                                                    className="pb-2"
                                                >
                                                    <GrowthDecision
                                                        skillName={name}
                                                        branches={branches}
                                                        currentChoice={currentChoice}
                                                        gold={player.gold || 0}
                                                        cost={swapCost}
                                                        onConfirm={(choice) => {
                                                            actions.swapSkillChoice?.(name, choice);
                                                            setSwapTarget(null);
                                                        }}
                                                    />
                                                </Motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            <ClassTree player={player} />
        </div>
    );
};

export default SkillTreePreview;
