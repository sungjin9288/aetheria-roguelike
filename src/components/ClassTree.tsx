import { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import type { Player } from '../types/index.js';
import ClassIcon from './icons/ClassIcon';
import SignalBadge from './SignalBadge';

interface ClassTreeProps {
    player: Player;
}

const TIER_LABELS: any = { 0: MSG.CLASS_TIER_0, 1: MSG.CLASS_TIER_1, 2: MSG.CLASS_TIER_2, 3: MSG.CLASS_TIER_3 };
const TIER_COLORS: any = { 0: '#9ca3af', 1: '#00ccff', 2: '#bc13fe', 3: '#f59e0b' };

/**
 * 전직 트리의 노드 데이터 구축
 *
 * cycle 453: nodes / edges 출력 dead 정리 — 호출자가 tiers만 destructure.
 *   edges는 build됐지만 consumer 0건이라 push 자체 제거. nodes는 tiers
 *   그룹핑용 internal const로만 보존.
 */
const buildTree = () => {
    const nodes: Record<string, any> = {};

    // cycle 455: nodes 객체에서 설명 필드 제거 — TreeNode가 node.tier/.name/.reqLv만
    //   read하고 그 외 필드는 read 0건이라 cycle 453 paired completion으로 정리.
    (Object.entries(DB.CLASSES) as Array<[string, any]>).forEach(([name, data]: any) => {
        nodes[name] = { name, tier: data.tier || 0, reqLv: data.reqLv || 1 };
    });

    // 티어별 그룹
    const tiers: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [] };
    (Object.values(nodes) as any[]).forEach((n: any) => {
        if (tiers[n.tier]) tiers[n.tier].push(n);
    });

    return { tiers };
};

const TreeNode = ({ node, isCurrent, isAvailable, isLocked }: any) => {
    const tier = node.tier;

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative flex items-center gap-2 rounded-[0.95rem] border px-2.5 py-2 transition-all ${
                isCurrent
                    ? 'border-cyber-blue/50 bg-cyber-blue/12 shadow-[0_0_16px_rgba(0,204,255,0.2)]'
                    : isAvailable
                        ? 'border-cyber-purple/40 bg-cyber-purple/8 animate-pulse-slow'
                        : isLocked
                            ? 'border-white/6 bg-black/20 opacity-50'
                            : 'border-white/10 bg-white/[0.04]'
            }`}
        >
            <ClassIcon className={node.name} size={24} tier={tier} />
            <div className="min-w-0">
                <div className={`text-[11px] font-rajdhani font-bold truncate ${
                    isCurrent ? 'text-cyber-blue' : isAvailable ? 'text-cyber-purple' : isLocked ? 'text-slate-600' : 'text-slate-200'
                }`}>
                    {node.name}
                </div>
                <div className="text-[9px] font-fira text-slate-500">
                    {TIER_LABELS[tier]} · Lv.{node.reqLv}
                </div>
            </div>
            {isCurrent && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyber-blue shadow-[0_0_6px_rgba(0,204,255,0.8)]" />
            )}
        </Motion.div>
    );
};

/**
 * ClassTree — 전직 계통도 시각화 (CSS Grid 4열)
 */
const ClassTree = ({ player }: ClassTreeProps) => {
    const { tiers } = useMemo(() => buildTree(), []);
    const currentClass = DB.CLASSES[player.job as string];
    const availableJobs = new Set<string>(currentClass?.next || []);

    // 현재 직업에서 도달 가능한 모든 경로 찾기
    const reachable = useMemo(() => {
        const visited = new Set();
        const queue = [player.job];
        while (queue.length) {
            const name = queue.shift();
            if (visited.has(name)) continue;
            visited.add(name);
            (DB.CLASSES[name as string]?.next || []).forEach((n: any) => queue.push(n));
        }
        return visited;
    }, [player.job]);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                {MSG.CLASS_TREE_TITLE}
            </div>

            {/* 범례 */}
            <div className="flex flex-wrap gap-2 text-[9px] font-fira">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyber-blue" /> {MSG.CLASS_CURRENT}
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyber-purple animate-pulse" /> {MSG.CLASS_AVAILABLE}
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-600" /> {MSG.CLASS_LOCKED}
                </span>
            </div>

            {/* 트리 그리드 — 모바일: 2열(T0+T1 / T2+T3), 데스크탑: 4열 */}
            <div className="overflow-x-auto pb-2">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 min-w-[280px]">
                    {[0, 1, 2, 3].map((tier: any) => (
                        <div key={tier} className="space-y-1.5">
                            {/* 티어 헤더 */}
                            <div className="text-center mb-1">
                                <div className="text-[9px] font-fira uppercase tracking-wider" style={{ color: TIER_COLORS[tier] }}>
                                    T{tier}
                                </div>
                                <div className="text-[9px] font-fira text-slate-500">
                                    {TIER_LABELS[tier]}
                                </div>
                            </div>
                            {/* 노드 */}
                            {tiers[tier].map((node: any) => (
                                <TreeNode
                                    key={node.name}
                                    node={node}
                                    isCurrent={player.job === node.name}
                                    isAvailable={availableJobs.has(node.name)}
                                    isLocked={!reachable.has(node.name) && player.job !== node.name}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* 연결선 — 현재 직업의 전직 경로 강조 */}
            {availableJobs.size > 0 && (
                <div className="flex flex-wrap gap-1 text-[9px] font-fira text-slate-500">
                    <span className="text-slate-400">{player.job}</span>
                    <span>→</span>
                    {[...availableJobs].map((job: any) => {
                        const meetsReq = (player.level ?? 0) >= (DB.CLASSES[job]?.reqLv || 999);
                        return (
                            <span key={job} className={meetsReq ? 'text-cyber-purple' : 'text-slate-500'}>
                                {job}{meetsReq ? ' ✓' : ` (Lv.${DB.CLASSES[job]?.reqLv})`}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ClassTree;
