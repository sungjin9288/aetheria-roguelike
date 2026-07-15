import { useState, useCallback, useMemo } from 'react';
import { Copy, Crown, Eye, Skull, Shield, Save } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { APP_ID, CONSTANTS } from '../../data/constants';
import { exportToJson } from '../../utils/fileUtils';
import { getTitleColor, getTitleLabel, getTitlePassiveLabel } from '../../utils/gameUtils';
import { RARITY_COLORS } from '../../data/titles';
import { MSG } from '../../data/messages';
import { FeedbackValidator } from '../../systems/FeedbackValidator';
import { formatRelicText, getRelicDisplayName } from '../../utils/relicPresentation';

const _SESSION_ID = Math.random().toString(36).slice(2, 10).toUpperCase();

const QA_VALUE_LABELS: Record<string, string> = {
    unknown: '확인 안 됨',
    mobile: '모바일',
    desktop: '데스크톱',
    idle: '대기',
    ready: '정상',
    offline: '연결 안 됨',
    synced: '저장됨',
    thinking: '생성 중',
    syncing: '동기화 중',
    combat: '전투',
    event: '이벤트',
    moving: '이동 중',
    shop: '상점',
    job_change: '전직',
    quest_board: '임무',
    crafting: '제작',
    dead: '쓰러짐',
    ascension: '승천',
    true_ending: '마지막 이야기',
    error: '오류',
};

const getQaValueLabel = (value: unknown) => QA_VALUE_LABELS[String(value)] || String(value || '확인 안 됨');

/**
 * SystemTab — Dashboard의 system 탭 콘텐츠 (#4 분리)
 * props: player, actions, stats
 */
// cycle 477: 컴팩트 prop / cascade 정리 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. 토글 상태 + 요약 모드 + 8 ternary cascade 정리.
interface SystemTabProps {
    player?: any;
    actions?: any;
    stats?: any;
    runtime?: any;
}

// cycle 589: runtime default null 제거 — 1 production caller (Dashboard:241)
//   runtime={runtime} 명시 전달이라 default 도달 불가.
const SystemTab = ({ player, actions, stats, runtime }: SystemTabProps) => {
    const today = new Date().toISOString().slice(0, 10);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState<any>(null);
    const readabilityMode = player.settings?.readabilityMode === 'high' ? 'high' : 'standard';

    const handleSetReadabilityMode = useCallback((mode: 'standard' | 'high') => {
        actions.setReadabilityMode?.(mode);
        setFeedbackStatus({
            type: 'success',
            text: `화면 가독성을 ${mode === 'high' ? '선명하게' : '표준'}로 바꿨습니다.`,
        });
    }, [actions]);

    const qaContext = useMemo(() => {
        const platform = typeof navigator !== 'undefined'
            ? ((navigator as any).userAgentData?.platform || navigator.platform || 'unknown')
            : 'unknown';
        const viewportSize = typeof window !== 'undefined'
            ? `${window.innerWidth}x${window.innerHeight}`
            : 'unknown';
        return {
            build: `v${CONSTANTS.DATA_VERSION}`,
            viewport: runtime?.viewport || 'unknown',
            state: runtime?.gameState || 'unknown',
            sync: runtime?.syncStatus || 'unknown',
            ai: runtime?.isAiThinking ? 'thinking' : 'idle',
            platform,
            screen: viewportSize,
            player: player.name,
            job: player.job,
            level: player.level,
            loc: player.loc,
            readability: readabilityMode,
            session: _SESSION_ID,
        };
    }, [player.job, player.level, player.loc, player.name, readabilityMode, runtime]);

    const qaReadout = useMemo(() => {
        return [
            `BUILD=${qaContext.build}`,
            `VIEWPORT=${qaContext.viewport}`,
            `STATE=${qaContext.state}`,
            `SYNC=${qaContext.sync}`,
            `AI=${qaContext.ai}`,
            `PLATFORM=${qaContext.platform}`,
            `SCREEN=${qaContext.screen}`,
            `PLAYER=${qaContext.player}`,
            `JOB=${qaContext.job}`,
            `LV=${qaContext.level}`,
            `LOC=${qaContext.loc}`,
            `READABILITY=${qaContext.readability}`,
            `SESSION=${qaContext.session}`,
        ].join('\n');
    }, [qaContext]);

    const qaSnapshot = useMemo(() => {
        const inventoryCounts = player.inv.reduce((acc: any, item: any) => {
            acc[item.name] = (acc[item.name] || 0) + 1;
            return acc;
        }, {});

        return {
            exportedAt: new Date().toISOString(),
            qa: qaContext,
            summary: {
                name: player.name,
                level: player.level,
                job: player.job,
                gold: player.gold,
                hp: player.hp,
                mp: player.mp,
                loc: player.loc,
                activeTitle: player.activeTitle || null,
                readabilityMode,
            },
            runtime: runtime || null,
            combatStats: stats
                ? {
                    atk: stats.atk,
                    def: stats.def,
                    maxHp: stats.maxHp,
                    maxMp: stats.maxMp,
                    critChance: stats.critChance,
                    elem: stats.elem,
                    isMagic: stats.isMagic,
                }
                : null,
            equipment: {
                weapon: player.equip?.weapon?.name || null,
                offhand: player.equip?.offhand?.name || null,
                armor: player.equip?.armor?.name || null,
            },
            relics: (player.relics || []).map((relic: any) => ({
                id: relic.id,
                name: relic.name,
                rarity: relic.rarity,
            })),
            titles: player.titles || [],
            inventoryCounts,
            meta: player.meta || null,
            dailyProtocol: player.stats?.dailyProtocol || null,
        };
    }, [player, qaContext, readabilityMode, runtime, stats]);

    const copyQaReadout = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(qaReadout);
            setFeedbackStatus({ type: 'success', text: '기기 점검 정보를 복사했습니다.' });
        } catch {
            setFeedbackStatus({ type: 'error', text: '기기 점검 정보를 복사하지 못했습니다.' });
        }
    }, [qaReadout]);

    const exportQaSnapshot = useCallback(() => {
        exportToJson(`aetheria_qa_snapshot_${Date.now()}.json`, qaSnapshot);
        setFeedbackStatus({ type: 'success', text: '기기 점검 파일을 저장했습니다.' });
    }, [qaSnapshot]);

    const updateLiveConfig = useCallback(async (partialConfig: any) => {
        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
        await setDoc(configRef, { config: partialConfig }, { merge: true });
    }, []);

    const handleSetMultiplier = useCallback(async () => {
        const raw = window.prompt('이벤트 보상 배율을 입력하세요. (1-5)', String(actions.liveConfig?.eventMultiplier || 1));
        if (raw === null) return;
        const value = Number.parseFloat(raw);
        if (!Number.isFinite(value) || value < 1 || value > 5) {
            setFeedbackStatus({ type: 'error', text: '배율은 1에서 5 사이여야 합니다.' });
            return;
        }
        try {
            await updateLiveConfig({ eventMultiplier: value });
            setFeedbackStatus({ type: 'success', text: `이벤트 보상 배율을 x${value}로 바꿨습니다.` });
        } catch { setFeedbackStatus({ type: 'error', text: '이벤트 보상 배율을 바꾸지 못했습니다.' }); }
    }, [actions.liveConfig, updateLiveConfig]);

    const handleBroadcast = useCallback(async () => {
        const raw = window.prompt('공지 내용을 입력하세요. (최대 100자)', actions.liveConfig?.announcement || '');
        if (raw === null) return;
        const text = raw.trim();
        if (!text) { setFeedbackStatus({ type: 'error', text: '공지 내용을 입력해 주세요.' }); return; }
        try {
            await updateLiveConfig({ announcement: text.slice(0, 100) });
            setFeedbackStatus({ type: 'success', text: '공지를 등록했습니다.' });
        } catch { setFeedbackStatus({ type: 'error', text: '공지를 등록하지 못했습니다.' }); }
    }, [actions.liveConfig, updateLiveConfig]);

    const submitFeedback = useCallback(async () => {
        const validation = FeedbackValidator.validate(feedbackText);
        if (!validation.valid) { setFeedbackStatus({ type: 'error', text: validation.error }); return; }
        try {
            const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
            await addDoc(feedbackCol, {
                uid: actions.getUid(),
                nickname: player.name,
                message: feedbackText.trim(),
                statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
                timestamp: serverTimestamp()
            });
            FeedbackValidator.markSubmitted();
            setFeedbackText('');
            setFeedbackStatus({ type: 'success', text: '의견을 보냈습니다.' });
        } catch { setFeedbackStatus({ type: 'error', text: '의견을 보내지 못했습니다.' }); }
    }, [actions, feedbackText, player]);

    const feedbackStatusClass = feedbackStatus?.type === 'error'
        ? 'text-rose-200 border-rose-300/22 bg-rose-400/10'
        : 'text-emerald-100 border-emerald-300/24 bg-emerald-300/10';
    return (
        <Motion.div data-testid="system-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 p-1.5">

            {/* 세션 정보 */}
            <div className="rounded-[1rem] border border-white/8 bg-black/18 text-[10px] text-slate-400/90 font-fira px-3 py-2.5">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <p className="truncate">세션: {_SESSION_ID}</p>
                    <p className="truncate">사용자: {actions.getUid() || '손님'}</p>
                    <p className="truncate">버전: v{CONSTANTS.DATA_VERSION}</p>
                </div>
                {(player.meta?.prestigeRank || 0) > 0 && (
                    <p className="text-[#d9d0f3] mt-1">{MSG.UI_PRESTIGE}: {player.meta.prestigeRank}회 {MSG.UI_PRESTIGE_COMPLETE}</p>
                )}
            </div>

            {/* 에테르 거울 — 에센스 소비 영구 업그레이드 트리 진입점 */}
            <button
                type="button"
                data-testid="open-mirror-panel"
                onClick={() => runtime?.onOpenMirror?.()}
                className="w-full min-h-[44px] rounded-[1rem] border border-[#9a8ac0]/22 bg-[#9a8ac0]/8 px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[#9a8ac0]/12 transition-colors"
            >
                <span className="text-[11px] font-bold text-[#e3dcff] font-rajdhani tracking-[0.16em]">에테르 거울</span>
                <span className="text-[10px] font-fira text-[#d9d0f3]">✦ {player.meta?.essence || 0}</span>
            </button>

            <div data-testid="readability-settings" className="rounded-[1rem] border border-[#7dd4d8]/18 bg-black/18 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#dff7f5] font-rajdhani tracking-[0.16em]">
                        <Eye size={12} /> 화면 가독성
                    </div>
                    <span
                        data-testid="readability-mode-current"
                        className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/80"
                    >
                        {readabilityMode === 'high' ? '선명하게' : '표준'}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="화면 가독성">
                    {(['standard', 'high'] as const).map((mode) => {
                        const active = readabilityMode === mode;
                        return (
                            <Motion.button
                                key={mode}
                                type="button"
                                whileTap={{ scale: 0.98 }}
                                data-testid={`readability-mode-${mode}`}
                                aria-pressed={active}
                                onClick={() => handleSetReadabilityMode(mode)}
                                className={`min-h-[42px] rounded-full border px-3 text-[10px] font-fira font-bold uppercase tracking-[0.14em] transition-colors ${
                                    active
                                        ? 'border-[#7dd4d8]/34 bg-[#7dd4d8]/16 text-[#dff7f5] shadow-[0_0_0_1px_rgba(125,212,216,0.12)]'
                                        : 'border-white/8 bg-black/20 text-slate-300/78 hover:border-white/14 hover:bg-white/[0.05]'
                                }`}
                            >
                                {mode === 'high' ? '선명하게' : '표준'}
                            </Motion.button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-[1rem] border border-white/8 bg-black/18 p-3">
                <div className="gap-3 mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-bold text-slate-300/76 font-readable tracking-normal">기기 점검 기록</div>
                    <div className="flex items-center gap-2">
                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={copyQaReadout}
                            className="min-h-[34px] px-3 text-[11px] rounded-full border border-white/8 bg-black/20 text-slate-200 font-fira flex items-center gap-1.5"
                        >
                            <Copy size={12} /> 복사
                        </Motion.button>
                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={exportQaSnapshot}
                            className="min-h-[34px] px-3 text-[11px] rounded-full border border-[#7dd4d8]/22 bg-[#7dd4d8]/10 text-[#dff7f5] font-fira flex items-center gap-1.5"
                        >
                            <Save size={12} /> 파일 저장
                        </Motion.button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-fira text-slate-300/76 mb-2">
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">화면: {getQaValueLabel(runtime?.viewport)}</div>
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">상태: {getQaValueLabel(runtime?.gameState)}</div>
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">동기화: {getQaValueLabel(runtime?.syncStatus)}</div>
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">이야기: {runtime?.isAiThinking ? '생성 중' : '대기'}</div>
                </div>
                <details className="rounded-[0.95rem] border border-white/8 bg-black/22 px-2.5 py-2 text-[10px] font-fira text-slate-400/90">
                    <summary className="cursor-pointer text-slate-300/82">자세한 기기 정보</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">{qaReadout}</pre>
                </details>
            </div>

            {/* 유물 */}
                    {(player.relics || []).length > 0 && (
                        <div className="rounded-[1rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/8 p-3">
                            <div className="text-[11px] font-bold text-[#e3dcff] mb-2 flex items-center gap-2 font-rajdhani tracking-[0.16em]">
                                유물 ({player.relics.length}/5)
                            </div>
                            <div className="space-y-1">
                                {player.relics.map((r: any) => (
                                    <div key={r.id} className="flex items-start gap-2 text-[11px] rounded-[0.9rem] border border-white/8 bg-black/16 px-2.5 py-2">
                                        <span className={`shrink-0 font-bold ${RARITY_COLORS[r.rarity] || 'text-slate-300'}`}>{getRelicDisplayName(r.name)}</span>
                                        <span className="text-slate-300/72">{formatRelicText(r.desc)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 칭호 */}
                    {(player.titles || []).length > 0 && (
                        <div className="rounded-[1rem] border border-[#d5b180]/18 bg-[#d5b180]/8 p-3">
                            <div className="text-[11px] font-bold text-[#f6e7c8] mb-2 flex items-center gap-2 font-readable tracking-normal">칭호 ({player.titles.length})</div>
                            {player.activeTitle && (
                                <div className="mb-2 rounded-[0.95rem] border border-[#d5b180]/18 bg-black/16 px-2.5 py-2 text-[10px] font-fira">
                                    <div className="text-[#f6e7c8] font-bold">활성 칭호: [{getTitleLabel(player.activeTitle)}]</div>
                                    <div className="text-slate-300/72 mt-1">패시브: {getTitlePassiveLabel(player.activeTitle)}</div>
                                </div>
                            )}
                            <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                                {player.titles.map((id: any) => {
                                    const isActive = player.activeTitle === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => actions.setActiveTitle?.(isActive ? null : id)}
                                            className={`w-full text-left text-xs px-2.5 py-2 rounded-[0.95rem] border transition-colors ${isActive ? 'bg-black/20 border-[#d5b180]/24' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'}`}
                                        >
                                            <span className={`font-bold ${getTitleColor(id)}`}>[{getTitleLabel(id)}]</span>
                                            {isActive && <span className="text-[#f6e7c8] text-[10px] ml-2">활성</span>}
                                            <div className="text-slate-400/90 text-[10px] mt-0.5">{getTitlePassiveLabel(id)}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 일일 프로토콜 */}
                    {(() => {
                        const dp = player.stats?.dailyProtocol;
                        if (!dp || !dp.missions?.length) return null;
                        if (dp.date !== today) return null;
                        return (
                            <div className="rounded-[1rem] border border-[#7dd4d8]/18 bg-[#7dd4d8]/8 p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-[11px] font-bold text-[#dff7f5] font-readable tracking-normal">오늘의 임무</div>
                                    {dp.relicShards > 0 && <span className="text-[10px] text-[#d9d0f3]">{dp.relicShards}/5 조각</span>}
                                </div>
                                <div className="space-y-2">
                                    {dp.missions.map((m: any) => {
                                        const pct = Math.min(100, ((m.progress || 0) / Math.max(1, m.goal)) * 100);
                                        const rewardText = m.reward.essence ? `에센스 ${m.reward.essence}` : m.reward.item || (m.reward.relicShard ? '유물 조각' : '');
                                        return (
                                            <div key={m.id} className="rounded-[0.95rem] border border-white/8 bg-black/16 px-2.5 py-2">
                                                <div className="flex justify-between text-[10px] mb-0.5">
                                                    <span className={m.done ? 'text-[#dff7f5] line-through' : 'text-slate-300/86'}>
                                                        {m.type === 'kills' ? `처치 ${m.goal}` : m.type === 'explores' ? `탐색 ${m.goal}` : `골드 지출 ${m.goal}`}
                                                    </span>
                                                    <span className="text-slate-500">{m.progress}/{m.goal} → {rewardText}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all ${m.done ? 'bg-[#7dd4d8]' : 'bg-[#7dd4d8]/60'}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Hall of Fame */}
                    <div className="rounded-[1rem] border border-[#d5b180]/18 bg-black/18 p-3 mb-2 relative overflow-hidden">
                        <div className="text-[11px] font-bold text-[#f6e7c8] mb-3 flex items-center gap-2 font-readable tracking-normal"><Crown size={12} /> 명예의 전당</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {actions.leaderboard?.length > 0 ? actions.leaderboard.map((ranker: any, i: any) => {
                                const isMe = ranker.nickname === player.name;
                                return (
                                    <div key={i} className={`flex justify-between text-[10px] border-b border-white/6 pb-1 last:border-0 p-1 rounded transition-colors font-fira ${isMe ? 'bg-emerald-300/[0.06] border-l-2 border-l-emerald-300 pl-2' : 'hover:bg-white/[0.03] text-slate-300/76'}`}>
                                        <span className="flex gap-2 items-center min-w-0">
                                            <span className={`w-4 text-center font-bold shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
                                            <span className={`truncate ${isMe ? 'text-emerald-100 font-bold' : 'text-white'}`}>
                                                {ranker.nickname}
                                                {ranker.activeTitle && <span className="text-[#d9d0f3]/70 ml-1">[{getTitleLabel(ranker.activeTitle)}]</span>}
                                                {isMe && <span className="text-emerald-100 ml-1">◀</span>}
                                            </span>
                                        </span>
                                        <span className="flex gap-2 items-center shrink-0 ml-1">
                                            {ranker.prestigeRank > 0 && <span className="text-[#d9d0f3] text-[9px]">⚡{ranker.prestigeRank}</span>}
                                            <span className="text-rose-300 flex items-center gap-1"><Skull size={8} /> {(ranker.totalKills || 0).toLocaleString()}</span>
                                        </span>
                                    </div>
                                );
                            }) : <div className="text-xs text-slate-500 text-center font-readable animate-pulse">순위를 불러오는 중…</div>}
                        </div>
                    </div>

                    {/* 로그 다운로드 */}
                    <Motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            const exportData: Record<string, any> = {
                                timestamp: new Date().toISOString(),
                                summary: { name: player.name, level: player.level, job: player.job, gold: player.gold },
                                stats,
                                equipment: player.equip,
                                history: [...(player.archivedHistory || []), ...player.history]
                            };
                            exportToJson(`aetheria_log_${Date.now()}.json`, exportData);
                        }}
                        className="w-full bg-[#7dd4d8]/10 hover:bg-[#7dd4d8]/16 text-[#dff7f5] py-3 rounded-full border border-[#7dd4d8]/22 flex items-center justify-center gap-2 font-rajdhani font-bold tracking-[0.16em] transition-all min-h-[42px]"
                    >
                        <Save size={16} /> 플레이 기록 저장
                    </Motion.button>

                    {/* Admin */}
                    {actions.isAdmin() && (
                        <div className="bg-rose-400/10 p-3 rounded-[1rem] border border-rose-300/22 mt-4">
                            <div className="text-[11px] font-bold text-rose-100 mb-2 font-readable flex items-center gap-2 tracking-normal"><Shield size={12} /> 운영 설정</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={handleSetMultiplier} className="min-h-[42px] bg-black/22 hover:bg-black/28 py-2 rounded-full text-rose-100 border border-rose-300/22 text-[11px]">보상 배율</button>
                                <button onClick={handleBroadcast} className="min-h-[42px] bg-black/22 hover:bg-black/28 py-2 rounded-full text-rose-100 border border-rose-300/22 text-[11px]">공지 등록</button>
                            </div>
                        </div>
                    )}

                    {/* Feedback */}
                    <div className="bg-black/18 p-3 rounded-[1rem] border border-white/8 mt-4">
                        <div className="text-[11px] font-bold text-slate-300/76 mb-2 font-readable tracking-normal">의견 보내기</div>
                        {feedbackStatus && (
                            <div className={`text-xs mb-2 px-2 py-1 rounded border ${feedbackStatusClass}`}>{feedbackStatus.text}</div>
                        )}
                        <textarea
                            placeholder="불편했던 점이나 이상한 동작을 적어 주세요."
                            className="w-full bg-black/24 border border-white/8 rounded-[0.95rem] p-2.5 text-sm text-slate-200/84 h-24 resize-none focus:outline-none focus:border-[#7dd4d8]/24 placeholder:text-slate-500 font-fira"
                            value={feedbackText}
                            onChange={(e: any) => setFeedbackText(e.target.value)}
                            maxLength={500}
                        />
                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={submitFeedback}
                            className="w-full mt-2 min-h-[42px] bg-emerald-300/10 hover:bg-emerald-300/16 py-2 rounded-full text-emerald-100 text-sm border border-emerald-300/24 font-bold tracking-[0.16em]"
                        >
                            보내기
                        </Motion.button>
                    </div>
        </Motion.div>
    );
};

export default SystemTab;
