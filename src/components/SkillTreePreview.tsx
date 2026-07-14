import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
// cycle 323: unused RefreshCw icon import 제거 — SkillTreePreview JSX에서 <RefreshCw> 0건.
import { Zap, Shield, ChevronDown, ChevronRight, Sparkles, GitBranch } from 'lucide-react';
import { DB } from '../data/db';
import { getJobSkills } from '../utils/gameUtils';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import SignalBadge from './SignalBadge';
import SkillTypeIcon from './icons/SkillTypeIcon';
import ClassIcon from './icons/ClassIcon';
import ClassTree from './ClassTree';
import type { Player } from '../types/index.js';

// cycle 479: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 + 14 ternary + SkillCard subprop까지
//   일괄 정리 (cycle 472-478 paired).
interface SkillTreePreviewProps {
    player: Player;
    actions?: any;
}

const EFFECT_LABELS: any = {
    burn: '화상',
    bleed: '출혈',
    poison: '독',
    stun: '기절',
    freeze: '빙결',
    drain: '흡수',
    curse: '저주',
    fear: '공포',
    atk_up: '공격력 상승',
    def_up: '방어력 상승',
    all_up: '공격력과 방어력 상승',
    berserk: '광란',
    stealth: '은신',
};

const formatSkillText = (text: unknown) => String(text || '')
    .replace(/\bATK\b/g, '공격력')
    .replace(/\bDEF\b/g, '방어력')
    .replace(/\bHP\b/g, '생명')
    .replace(/\bMP\b/g, '기력')
    .replace(/\bCRIT\b/g, '치명타')
    .replace(/데미지/g, '피해');

const formatSkillPower = (mult: number) => `위력 ${Math.round(mult * 100)}%`;

const TYPE_TONE: any = {
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

const SkillCard = ({ skill, cooldown = 0, selected = false, summary = false, branchLabel = null, onSelect = null }: any) => {
    const isOnCooldown = cooldown > 0;
    const tone = TYPE_TONE[skill.type] || 'neutral';
    const interactive = Boolean(onSelect) && !selected;

    const baseClassName = `rounded-[1.05rem] border transition-all ${summary ? 'px-2.5 py-2' : 'px-3 py-3'} ${
        selected
            ? 'border-[#7dd4d8]/40 bg-[#7dd4d8]/14 shadow-[0_16px_28px_rgba(125,212,216,0.16)]'
            : interactive
                ? 'border-white/10 bg-black/18 hover:border-[#7dd4d8]/26 hover:bg-[#7dd4d8]/6 cursor-pointer'
                : 'border-white/8 bg-black/18'
    } ${isOnCooldown ? 'opacity-64' : ''}`;

    // 탭 가능한 경우 button으로, 아니면 div로 (a11y).
    const Wrapper = interactive ? 'button' : 'div';
    const wrapperProps: any = interactive
        ? {
            type: 'button',
            onClick: () => onSelect(skill.name),
            'data-testid': `skill-card-select-${skill.name}`,
            'aria-label': `${skill.name} 선택`,
            className: `${baseClassName} text-left w-full`,
        }
        : { className: baseClassName };

    return (
        <Wrapper {...wrapperProps}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <div className="text-[1rem] font-rajdhani font-bold text-slate-100">
                            {skill.name}
                        </div>
                        {skill.type && <SignalBadge tone={tone} size="sm"><SkillTypeIcon type={skill.type} size={10} className="mr-0.5 -mt-px" />{SKILL_TYPE_LABELS[skill.type] || skill.type}</SignalBadge>}
                        {selected && <SignalBadge tone="recommended" size="sm">현재 사용</SignalBadge>}
                        {branchLabel && <SignalBadge tone="resonance" size="sm">성장 · {branchLabel}</SignalBadge>}
                        {skill.fromWeapon && <SignalBadge tone="spotlight" size="sm">무기</SignalBadge>}
                        {skill.fromTrait && <SignalBadge tone="resonance" size="sm">성향</SignalBadge>}
                        {isOnCooldown && <SignalBadge tone="danger" size="sm">재사용까지 {cooldown}턴</SignalBadge>}
                    </div>

                    {!summary && (
                        <div className="mt-1 text-[12px] leading-snug text-slate-300/78">
                            {formatSkillText(skill.desc)}
                        </div>
                    )}

                    {skill.effect && EFFECT_LABELS[skill.effect] && !summary && (
                        <div className="mt-2 font-readable text-[11px] text-slate-400/72">
                            추가 효과 · <span className="text-slate-200/82">{EFFECT_LABELS[skill.effect]}</span>
                        </div>
                    )}
                </div>

                <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/18 px-2 py-1 font-readable text-[11px] text-slate-200/82">
                        <Zap size={11} className="text-[#7dd4d8]" />
                        {skill.mp > 0 ? `기력 ${skill.mp}` : '기력 소모 없음'}
                    </div>
                    {skill.mult && (
                        <div className="mt-1 font-readable text-[11px] text-[#f6e7c8]/78">
                            {formatSkillPower(skill.mult)}
                        </div>
                    )}
                </div>
            </div>
        </Wrapper>
    );
};

// cycle 565: actions default null 제거 — 1 production caller (Dashboard:188
//   <SkillTreePreview player={player} actions={actions} />) 명시 전달이라
//   default 도달 불가. SkillTreePreviewProps interface의 actions?: any
//   optional은 보존. 청소 메가 시리즈 58번째.
const SkillTreePreview = ({ player, actions }: SkillTreePreviewProps) => {
    const [expandedJob, setExpandedJob] = useState<any>(null);
    const [swapTarget, setSwapTarget] = useState<any>(null); // skillName being swapped
    const [showClassTree, setShowClassTree] = useState(false);
    const currentClass = DB.CLASSES[player.job as string];
    const allCurrentSkills = getJobSkills(player);
    const selectedIndex = player.skillLoadout?.selected ?? 0;
    const cooldowns = player.skillLoadout?.cooldowns || {};
    const isInSafeZone = DB.MAPS[player?.loc as string]?.type === 'safe';
    const swapCost = BALANCE.SKILL_SWAP_COST || 50;

    if (!currentClass) return null;

    const nextJobs = currentClass.next || [];
    const selectedSkillName = allCurrentSkills[selectedIndex % Math.max(1, allCurrentSkills.length)]?.name || null;
    const pendingSkillBranches = Object.entries(currentClass.skillBranches || {})
        .filter(([skillName]) => !player.skillChoices?.[skillName]) as Array<[string, any[]]>;

    return (
        <div data-testid="skill-tree-preview" className="space-y-3">
            <div className="rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <ClassIcon className={player.job} size={28} tier={currentClass?.tier || 0} />
                        <div>
                            <div className="font-readable text-[11px] text-slate-400/72">
                                기술 구성
                            </div>
                            <div className="mt-1 text-[1.05rem] font-rajdhani font-bold text-slate-100">
                                {player.job} 전투 기술
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <SignalBadge tone="neutral" size="sm">사용 기술 {allCurrentSkills?.length || 0}개</SignalBadge>
                        {nextJobs.length > 0 && <SignalBadge tone="resonance" size="sm">다음 전직 {nextJobs.length}개</SignalBadge>}
                    </div>
                </div>
            </div>

            {pendingSkillBranches.length > 0 && (
                <div className="rounded-[1.15rem] border border-[#7dd4d8]/18 bg-[#7dd4d8]/5 px-4 py-3.5">
                    <div className="mb-1 flex items-center gap-2 font-readable text-[12px] text-slate-200/82">
                        <GitBranch size={12} />
                        기술 성장 선택
                    </div>
                    <div className="mb-3 text-[11px] leading-snug text-slate-400/72">
                        첫 선택은 무료입니다. 이후에는 안전한 지역에서 골드를 사용해 바꿀 수 있습니다.
                    </div>
                    <div className="space-y-3">
                        {pendingSkillBranches.map(([skillName, branches]) => (
                            <div key={skillName}>
                                <div className="mb-1.5 font-rajdhani text-[14px] font-bold text-slate-200/86">{skillName}</div>
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                    {branches.map((branch: any) => (
                                        <button
                                            key={branch.choice}
                                            type="button"
                                            data-testid={`skill-branch-choice-${skillName}-${branch.choice}`}
                                            onClick={() => actions?.chooseSkillBranch?.(skillName, branch.choice)}
                                            disabled={!actions?.chooseSkillBranch}
                                            className="min-h-[52px] rounded-[0.95rem] border border-white/8 bg-black/16 px-3 py-2.5 text-left text-slate-300 transition-all hover:border-[#7dd4d8]/24 hover:bg-[#7dd4d8]/6 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-rajdhani text-[14px] font-bold">{branch.label}</span>
                                                <SignalBadge tone="recommended" size="sm">무료 선택</SignalBadge>
                                            </div>
                                            <div className="mt-1 text-[12px] leading-snug text-slate-400/76">{formatSkillText(branch.desc)}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-[1.15rem] border border-white/8 bg-black/16 px-4 py-3.5">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-readable text-[12px] text-slate-300/76">
                        <Shield size={12} />
                        현재 기술
                    </div>
                    {isInSafeZone && actions?.swapSkillChoice && (
                        <SignalBadge tone="success" size="sm">기술 변경 가능</SignalBadge>
                    )}
                </div>
                <div className="space-y-2">
                    {allCurrentSkills?.map((skill: any) => {
                        const branches = currentClass?.skillBranches?.[skill.name];
                        const currentChoice = player.skillChoices?.[skill.name];
                        const currentBranchLabel = branches?.find((branch: any) => branch.choice === currentChoice)?.label;
                        const isSwapping = swapTarget === skill.name;
                        return (
                            <div key={skill.name}>
                                <SkillCard
                                    skill={skill}
                                    selected={skill.name === selectedSkillName}
                                    cooldown={cooldowns[skill.name] || 0}
                                    branchLabel={currentBranchLabel}
                                    onSelect={actions?.selectSkill || null}
                                />
                                {isInSafeZone && branches && currentChoice && actions?.swapSkillChoice && (
                                    <div className="mt-1.5 rounded-[1rem] border border-[#d5b180]/14 bg-[#d5b180]/5 px-2.5 py-2">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-1.5 font-readable text-[11px] text-[#d5b180]/76">
                                                <GitBranch size={10} />
                                                현재 성장 · {currentBranchLabel}
                                            </div>
                                            <button
                                                onClick={() => setSwapTarget(isSwapping ? null : skill.name)}
                                                className="min-h-[36px] rounded-full px-2.5 font-readable text-[11px] text-slate-300/76 transition-colors hover:bg-white/[0.04] hover:text-white"
                                            >
                                                {isSwapping ? '닫기' : '다시 선택'}
                                            </button>
                                        </div>
                                        {isSwapping && (
                                            <div className="space-y-1.5">
                                                {branches.map((branch: any) => {
                                                    const isActive = currentChoice === branch.choice;
                                                    const canAfford = (player.gold || 0) >= swapCost;
                                                    return (
                                                        <button
                                                            key={branch.choice}
                                                            disabled={isActive || !canAfford}
                                                            onClick={() => {
                                                                actions.swapSkillChoice(skill.name, branch.choice);
                                                                setSwapTarget(null);
                                                            }}
                                                            className={`min-h-[44px] w-full rounded-[0.85rem] border px-2.5 py-2 text-left text-[12px] transition-all disabled:cursor-not-allowed ${
                                                                isActive
                                                                    ? 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10 text-[#dff7f5]'
                                                                    : canAfford
                                                                        ? 'border-white/8 bg-black/18 text-slate-200 hover:border-[#d5b180]/24 hover:bg-[#d5b180]/8'
                                                                        : 'border-white/8 bg-black/18 text-slate-500 opacity-50'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-rajdhani font-bold">{branch.label}</span>
                                                                {isActive
                                                                    ? <SignalBadge tone="recommended" size="sm">선택중</SignalBadge>
                                                                    : <span className="font-readable text-[11px] text-[#f6e7c8]/76">골드 {swapCost}</span>
                                                                }
                                                            </div>
                                                            <div className="mt-0.5 text-[11px] leading-snug text-slate-400/76">{formatSkillText(branch.desc)}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {nextJobs.length > 0 && (
                    <div className="rounded-[1.15rem] border border-white/8 bg-black/16 px-4 py-3.5">
                        <div className="mb-3 flex items-center gap-2 font-readable text-[12px] text-slate-300/76">
                            <Sparkles size={12} />
                            다음 전직 기술 미리보기
                        </div>

                        <div className="space-y-2">
                            {nextJobs.map((jobName: any) => {
                                const jobData = DB.CLASSES[jobName];
                                if (!jobData) return null;
                                const isOpen = expandedJob === jobName;
                                const meetsReq = (player.level ?? 0) >= (jobData.reqLv || 0);

                                return (
                                    <div
                                        key={jobName}
                                        className={`rounded-[1rem] border transition-all ${
                                            isOpen
                                                ? 'border-[#9a8ac0]/24 bg-[#9a8ac0]/10'
                                                : 'border-white/8 bg-white/[0.03]'
                                        }`}
                                    >
                                        <button
                                            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                                            onClick={() => setExpandedJob(isOpen ? null : jobName)}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`text-[1rem] font-rajdhani font-bold ${meetsReq ? 'text-[#e3dcff]' : 'text-slate-200/86'}`}>
                                                        {jobName}
                                                    </span>
                                                    <SignalBadge tone={meetsReq ? 'resonance' : 'neutral'} size="sm">
                                                        레벨 {jobData.reqLv}
                                                    </SignalBadge>
                                                </div>
                                                <div className="mt-1 text-[11px] font-fira text-slate-400/76">
                                                    {jobData.desc}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-slate-400">
                                                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {isOpen && (
                                                <Motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="space-y-2 border-t border-white/8 px-3 pb-3 pt-3">
                                                        {jobData.skills?.map((skill: any) => (
                                                            <SkillCard key={skill.name} skill={skill} />
                                                        ))}
                                                    </div>
                                                </Motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
            )}

            {/* 전직 계통도 */}
            <div className="rounded-[1.15rem] border border-white/8 bg-black/16 px-4 py-3.5">
                <button
                    onClick={() => setShowClassTree(v => !v)}
                    className="flex min-h-[40px] w-full items-center justify-between font-readable text-[12px] text-slate-400/76 transition-colors hover:text-slate-200"
                >
                    <span className="flex items-center gap-2">
                        <Sparkles size={12} />
                        {MSG.CLASS_TREE_TITLE}
                    </span>
                    {showClassTree ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {showClassTree && (
                    <div className="mt-3">
                        <ClassTree player={player} />
                    </div>
                )}
            </div>

        </div>
    );
};

export default SkillTreePreview;
