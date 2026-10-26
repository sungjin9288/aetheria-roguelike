import { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Check, Coins, GitBranch, RotateCcw, Shield, Sparkles, Zap } from 'lucide-react';
import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
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
import SignalChip from './archive/SignalChip';
import ActionButton from './ui/ActionButton';

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
    /** 이 화면의 금빛 주 단추는 하나 — 대기 중인 성장이 여럿이면 첫 결정만 금빛이다. */
    primary?: boolean;
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
    primary = true,
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
        return MSG.SKILL_BRANCH_CONFIRM(selectedBranch.label);
    })();

    return (
        <div data-testid={`skill-growth-decision-${skillName}`} className="space-y-3">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <div className="aether-type-meta font-readable text-ae-ink-3">{isFirstChoice ? '첫 성장' : '성장 변경'}</div>
                    <h3 className="aether-type-title mt-0.5 font-readable font-semibold text-ae-ink">
                        {MSG.SKILL_BRANCH_QUESTION(skillName)}
                    </h3>
                </div>
                <SignalChip tone={isFirstChoice ? 'recommended' : 'upgrade'} className="shrink-0">
                    {isFirstChoice ? '무료' : <>골드 <span className="font-fira tabular-nums">{cost}</span></>}
                </SignalChip>
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
                            data-active={selected ? 'true' : 'false'}
                            className="ae-archive-tab is-tile min-h-[92px] rounded-ae-md px-3 py-2.5 text-left"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-readable text-sm font-semibold text-ae-ink">{branch.label}</span>
                                {selected && <Check size={14} aria-hidden="true" className="shrink-0 text-ae-ether-hi" />}
                            </div>
                            <div className="aether-type-body mt-2 font-readable leading-snug text-ae-ink-2">
                                {formatSkillText(branch.desc)}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="ae-well flex items-start gap-2 px-3 py-2.5 font-readable">
                <Sparkles size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-gold" />
                <div className="min-w-0 flex-1">
                    <div className="aether-type-meta text-ae-ink-3">선택 결과</div>
                    <div className="aether-type-body mt-0.5 text-ae-ink">
                        {selectedBranch ? formatSkillText(selectedBranch.desc) : '후보를 선택하면 결과를 미리 볼 수 있습니다.'}
                    </div>
                </div>
            </div>

            <ActionButton
                variant={primary ? 'primary' : 'glass'}
                data-testid={`skill-growth-confirm-${skillName}`}
                onClick={() => selectedBranch?.choice && canConfirm && onConfirm?.(selectedBranch.choice)}
                disabled={!canConfirm}
                className="min-h-[48px] w-full px-4 text-sm"
                icon={isFirstChoice ? <GitBranch size={15} /> : <Coins size={15} />}
                label={confirmLabel}
            />
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
            data-active={selected ? 'true' : 'false'}
            className={`ae-archive-tab is-tile w-full rounded-ae-md px-3 py-2.5 text-left disabled:cursor-default ${cooldown > 0 ? 'opacity-70' : ''}`}
        >
            <div className="flex items-start gap-2.5">
                <div className="ae-sunk mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-ae-sm">
                    <SkillTypeIcon type={skill.type || '물리'} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-readable text-[15px] font-semibold text-ae-ink">{name}</span>
                        {selected && <SignalChip tone="recommended">전투 선택</SignalChip>}
                        {branchLabel && <SignalChip tone="resonance">성장 · {branchLabel}</SignalChip>}
                        {skill.fromWeapon && <SignalChip tone="spotlight">무기</SignalChip>}
                        {skill.fromTrait && <SignalChip tone="resonance">성향</SignalChip>}
                    </div>
                    <div className="aether-type-body mt-1 font-readable leading-snug text-ae-ink-2">
                        {formatSkillText(skill.desc)}
                    </div>
                    <div className="aether-type-meta mt-1.5 flex flex-wrap gap-x-2 gap-y-1 font-readable text-ae-ink-3">
                        {metrics.map((metric) => <span key={metric}>{metric}</span>)}
                        {effect && !metrics.includes(effect) && <span>{effect}</span>}
                        {typeLabel && <span className="text-ae-ink-2">{typeLabel}</span>}
                        {cooldown > 0 && <span className="text-ae-threat">재사용까지 <span className="font-fira tabular-nums">{cooldown}</span>턴</span>}
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
            {/* 2026-10 Wave 67: 제목과 "현재 선택"이 한 줄에 안 들어가면 "현재 선택"이 다음 줄로 내려간다 —
                둘을 한 줄에 묶어 두던 동안 375px에서 제목이 "나이트 전투 …"로 잘렸다(원장 §67.6). */}
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
                <ClassIcon className={player.job as string} size={34} tier={currentClass.tier || 0} />
                <div className="min-w-0 flex-[1_1_9rem]">
                    <div className="ae-eyebrow">기술 구성</div>
                    <h2 className="font-readable text-lg font-semibold text-ae-ink">
                        {player.job} 전투 기술
                    </h2>
                </div>
                <div className="ml-auto min-w-0 max-w-full text-right font-readable">
                    <div className="ae-eyebrow">현재 선택</div>
                    <div className="aether-type-body mt-0.5 font-semibold text-ae-ether-hi">{selectedSkillName || '없음'}</div>
                </div>
            </header>

            {pendingGrowth.length > 0 && (
                <section data-testid="skill-growth-pending" className="ae-card p-3.5">
                    <div className="mb-3 flex items-center gap-2 font-readable">
                        <GitBranch size={15} aria-hidden="true" className="text-ae-ether-hi" />
                        <div>
                            <div className="aether-type-title font-semibold text-ae-ink">기술 성장 선택</div>
                            <div className="aether-type-meta mt-0.5 text-ae-ink-3">
                                후보를 비교한 뒤 확정하세요. 첫 선택은 무료입니다.
                            </div>
                        </div>
                    </div>
                    <div className="space-y-5">
                        {pendingGrowth.map(([skillName, branches], index) => (
                            <GrowthDecision
                                key={skillName}
                                primary={index === 0}
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
                        <Shield size={14} aria-hidden="true" className="text-ae-ink-3" />
                        <h3 id="current-skills-title" className="aether-type-title font-readable font-semibold text-ae-ink">현재 기술</h3>
                    </div>
                    <span className="aether-type-meta font-readable text-ae-ink-3">
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
                                    <div className="mt-1.5 border-l border-ae-gold/30 pl-3">
                                        <button
                                            type="button"
                                            data-testid={`skill-growth-change-${name}`}
                                            onClick={() => setSwapTarget(isSwapping ? null : name)}
                                            className="flex min-h-[44px] items-center gap-2 rounded-ae-sm px-1 font-readable text-sm text-ae-gold-text transition-colors duration-[110ms] hover:text-ae-gold-hi motion-reduce:transition-none"
                                        >
                                            <RotateCcw size={14} aria-hidden="true" />
                                            {isSwapping ? '성장 변경 닫기' : '성장 변경'}
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {isSwapping && (
                                                <Motion.div
                                                    key={`${name}-${currentChoice}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="pb-2"
                                                >
                                                    <GrowthDecision
                                                        skillName={name}
                                                        branches={branches}
                                                        currentChoice={currentChoice}
                                                        primary={pendingGrowth.length === 0}
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
