import React from 'react';
import { AT } from '../../reducers/actionTypes';
import { SEASON_REWARDS, SEASON_TIER_XP } from '../../data/seasonPass';
import SignalBadge from '../SignalBadge';

const rewardLabel = (reward) => {
    if (!reward) return '—';
    return [
        reward.gold && `+${reward.gold}G`,
        reward.premiumCurrency && `+${reward.premiumCurrency}💎`,
        reward.item && reward.item,
        reward.title && `칭호: ${reward.title}`,
    ].filter(Boolean).join(' / ');
};

const SeasonPassPanel = ({ player, dispatch }) => {
    const sp = player?.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
    const { xp, tier, claimed, isPremium } = sp;
    const tierXpProgress = xp % SEASON_TIER_XP;
    const nextTierXp = SEASON_TIER_XP;
    const xpPct = Math.min(100, Math.round((tierXpProgress / nextTierXp) * 100));

    const claimReward = (rewardTier) => {
        dispatch?.({ type: AT.CLAIM_SEASON_REWARD, payload: { tier: rewardTier } });
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-slate-500 text-xs font-fira tracking-[0.18em] uppercase">
                    {sp.seasonId} · SEASON PASS
                </div>
                <SignalBadge tone="resonance" size="sm">Tier {tier} / 30</SignalBadge>
            </div>

            {/* XP Bar */}
            <div className="rounded-[1rem] border border-white/8 bg-black/18 px-3 py-2.5 space-y-1.5">
                <div className="flex justify-between text-[9px] font-fira text-slate-400 uppercase tracking-[0.14em]">
                    <span>Season XP</span>
                    <span>{xp} / {(tier + 1) * SEASON_TIER_XP}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-black/30 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700"
                        style={{ width: `${xpPct}%` }}
                    />
                </div>
                <div className="text-[8px] font-fira text-slate-500">
                    다음 티어까지 {nextTierXp - tierXpProgress} XP
                </div>
            </div>

            {/* Track header */}
            <div className="grid grid-cols-[2rem_1fr_1fr] gap-1 text-[8px] font-fira uppercase tracking-[0.14em] text-slate-500 px-1">
                <span></span>
                <span>FREE</span>
                <span className={isPremium ? 'text-cyan-400' : 'text-slate-600'}>PREMIUM</span>
            </div>

            {/* Tier rows */}
            <div className="space-y-1 max-h-[360px] overflow-y-auto pr-0.5">
                {SEASON_REWARDS.map(row => {
                    const unlocked = tier >= row.tier;
                    const isClaimed = claimed.includes(row.tier);
                    const isCurrent = tier === row.tier;

                    return (
                        <div
                            key={row.tier}
                            className={`grid grid-cols-[2rem_1fr_1fr] gap-1 items-center rounded-[0.85rem] border px-2 py-1.5 transition-colors ${
                                isCurrent
                                    ? 'border-violet-400/30 bg-violet-400/8'
                                    : unlocked
                                        ? 'border-white/10 bg-black/12'
                                        : 'border-white/5 bg-black/8 opacity-50'
                            }`}
                        >
                            {/* Tier number */}
                            <span className={`text-center text-[9px] font-fira ${isCurrent ? 'text-violet-300' : unlocked ? 'text-slate-400' : 'text-slate-600'}`}>
                                {row.tier}
                            </span>

                            {/* Free track */}
                            <div className="min-w-0">
                                {unlocked && !isClaimed ? (
                                    <button
                                        onClick={() => claimReward(row.tier)}
                                        className="w-full rounded-[0.6rem] border border-cyber-green/50 bg-cyber-green/15 px-1.5 py-0.5 text-[8px] font-fira text-cyber-green hover:bg-cyber-green/25 transition-all text-left truncate"
                                    >
                                        {rewardLabel(row.free)} 수령
                                    </button>
                                ) : (
                                    <span className={`text-[8px] font-fira truncate block ${isClaimed ? 'text-slate-600 line-through' : unlocked ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {isClaimed ? '✓ ' : ''}{rewardLabel(row.free)}
                                    </span>
                                )}
                            </div>

                            {/* Premium track */}
                            <div className="min-w-0">
                                {isPremium && unlocked ? (
                                    <span className="text-[8px] font-fira text-cyan-300 truncate block">{rewardLabel(row.premium)}</span>
                                ) : (
                                    <span className="text-[8px] font-fira text-slate-700 truncate block">🔒 {rewardLabel(row.premium)}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Premium upgrade note */}
            {!isPremium && (
                <div className="rounded-[0.95rem] border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[9px] font-fira text-cyan-400/70 text-center">
                    프리미엄 트랙 — 추후 업데이트 예정
                </div>
            )}
        </div>
    );
};

export default SeasonPassPanel;
