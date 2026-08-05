import { useCallback, useMemo, useState } from 'react';
import {
    ChevronDown,
    Copy,
    Crown,
    Download,
    Eye,
    Gem,
    ListTree,
    MessageSquare,
    Save,
    Shield,
    Skull,
    Sparkles,
    Trophy,
    Wrench,
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { APP_ID, CONSTANTS } from '../../data/constants';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { exportToJson } from '../../utils/fileUtils';
import { getTitleColor, getTitleLabel, getTitlePassiveLabel } from '../../utils/gameUtils';
import { RARITY_COLORS } from '../../data/titles';
import { FeedbackValidator } from '../../systems/FeedbackValidator';
import { formatRelicText, getRelicDisplayName } from '../../utils/relicPresentation';
import RelicIcon from '../icons/RelicIcon';

const SESSION_ID = Math.random().toString(36).slice(2, 10).toUpperCase();

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
    ascension: '계승',
    true_ending: '마지막 이야기',
    error: '오류',
};

const READABILITY_OPTIONS = [
    { value: 'standard', label: '표준' },
    { value: 'high', label: '선명하게' },
] as const;

const EQUIPMENT_DETAIL_OPTIONS = [
    { value: 'auto', label: '자동' },
    { value: 'summary', label: '간단히' },
    { value: 'full', label: '상세' },
] as const;

const getQaValueLabel = (value: unknown) => QA_VALUE_LABELS[String(value)] || String(value || '확인 안 됨');

const SettingsDisclosure = ({ testId, icon: Icon, title, summary, children }: any) => (
    <details data-testid={testId} className="group border-b border-white/8 last:border-b-0">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-1 py-2.5 text-left [&::-webkit-details-marker]:hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.65rem] border border-white/8 bg-white/[0.04] text-slate-200">
                <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-readable text-xs font-bold text-slate-100">{title}</span>
                <span className="mt-0.5 block font-readable text-[11px] leading-snug text-slate-400">{summary}</span>
            </span>
            <ChevronDown size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-white/8 px-1 py-3">{children}</div>
    </details>
);

interface SystemTabProps {
    player?: any;
    actions?: any;
    stats?: any;
    runtime?: any;
}

const SystemTab = ({ player, actions, stats, runtime }: SystemTabProps) => {
    const [notice, setNotice] = useState<any>(null);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState<any>(null);

    const readabilityMode = player.settings?.readabilityMode === 'high' ? 'high' : 'standard';
    const equipmentDetailMode = ['summary', 'full'].includes(player.settings?.equipmentDetailMode)
        ? player.settings.equipmentDetailMode
        : 'auto';
    const titles = useMemo(() => player.titles || [], [player.titles]);
    const relics = useMemo(() => player.relics || [], [player.relics]);
    const relicCapacity = getPrestigeUnlocks(player.meta?.prestigeRank).maxRelics;
    const leaderboard = actions.leaderboard || [];
    const activeTitleLabel = player.activeTitle ? getTitleLabel(player.activeTitle) : '선택 안 함';
    const activeTitlePassive = player.activeTitle ? getTitlePassiveLabel(player.activeTitle) : '칭호를 선택하면 고유 효과가 적용됩니다.';

    const handleSetReadabilityMode = useCallback((mode: 'standard' | 'high') => {
        actions.setReadabilityMode?.(mode);
        setNotice({
            type: 'success',
            text: `화면을 ${mode === 'high' ? '선명하게' : '표준'} 표시로 바꿨습니다.`,
        });
    }, [actions]);

    const handleSetEquipmentDetailMode = useCallback((mode: 'auto' | 'summary' | 'full') => {
        actions.setEquipmentDetailMode?.(mode);
        const label = EQUIPMENT_DETAIL_OPTIONS.find((option) => option.value === mode)?.label || '자동';
        setNotice({ type: 'success', text: `장비 정보를 ${label} 표시로 바꿨습니다.` });
    }, [actions]);

    const handleSetActiveTitle = useCallback((id: string) => {
        const nextTitle = player.activeTitle === id ? null : id;
        actions.setActiveTitle?.(nextTitle);
        setNotice({
            type: 'success',
            text: nextTitle ? `[${getTitleLabel(nextTitle)}] 칭호를 적용했습니다.` : '칭호 적용을 해제했습니다.',
        });
    }, [actions, player.activeTitle]);

    const qaContext = useMemo(() => {
        const platform = typeof navigator !== 'undefined'
            ? ((navigator as any).userAgentData?.platform || navigator.platform || 'unknown')
            : 'unknown';
        const screen = typeof window !== 'undefined'
            ? `${window.innerWidth}x${window.innerHeight}`
            : 'unknown';

        return {
            build: `v${CONSTANTS.DATA_VERSION}`,
            viewport: runtime?.viewport || 'unknown',
            state: runtime?.gameState || 'unknown',
            sync: runtime?.syncStatus || 'unknown',
            ai: runtime?.isAiThinking ? 'thinking' : 'idle',
            platform,
            screen,
            player: player.name,
            job: player.job,
            level: player.level,
            loc: player.loc,
            readability: readabilityMode,
            equipmentDetail: equipmentDetailMode,
            session: SESSION_ID,
        };
    }, [equipmentDetailMode, player.job, player.level, player.loc, player.name, readabilityMode, runtime]);

    const qaReadout = useMemo(() => [
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
        `EQUIPMENT_DETAIL=${qaContext.equipmentDetail}`,
        `SESSION=${qaContext.session}`,
    ].join('\n'), [qaContext]);

    const qaSnapshot = useMemo(() => {
        const inventoryCounts = (player.inv || []).reduce((counts: Record<string, number>, item: any) => {
            if (item?.name) counts[item.name] = (counts[item.name] || 0) + 1;
            return counts;
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
                equipmentDetailMode,
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
            relics: relics.map((relic: any) => ({ id: relic.id, name: relic.name, rarity: relic.rarity })),
            titles,
            inventoryCounts,
            meta: player.meta || null,
            dailyProtocol: player.stats?.dailyProtocol || null,
        };
    }, [equipmentDetailMode, player, qaContext, readabilityMode, relics, runtime, stats, titles]);

    const copyQaReadout = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(qaReadout);
            setNotice({ type: 'success', text: '기기 점검 정보를 복사했습니다.' });
        } catch {
            setNotice({ type: 'error', text: '기기 점검 정보를 복사하지 못했습니다.' });
        }
    }, [qaReadout]);

    const exportQaSnapshot = useCallback(() => {
        exportToJson(`aetheria_qa_snapshot_${Date.now()}.json`, qaSnapshot);
        setNotice({ type: 'success', text: '기기 점검 파일을 저장했습니다.' });
    }, [qaSnapshot]);

    const exportPlayRecord = useCallback(() => {
        exportToJson(`aetheria_log_${Date.now()}.json`, {
            timestamp: new Date().toISOString(),
            summary: { name: player.name, level: player.level, job: player.job, gold: player.gold },
            stats,
            equipment: player.equip,
            history: [...(player.archivedHistory || []), ...(player.history || [])],
        });
        setNotice({ type: 'success', text: '플레이 기록을 저장했습니다.' });
    }, [player, stats]);

    const updateLiveConfig = useCallback(async (partialConfig: any) => {
        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
        await setDoc(configRef, { config: partialConfig }, { merge: true });
    }, []);

    const handleSetMultiplier = useCallback(async () => {
        const raw = window.prompt('이벤트 보상 배율을 입력하세요. (1-5)', String(actions.liveConfig?.eventMultiplier || 1));
        if (raw === null) return;

        const value = Number.parseFloat(raw);
        if (!Number.isFinite(value) || value < 1 || value > 5) {
            setNotice({ type: 'error', text: '배율은 1에서 5 사이여야 합니다.' });
            return;
        }

        try {
            await updateLiveConfig({ eventMultiplier: value });
            setNotice({ type: 'success', text: `이벤트 보상 배율을 x${value}로 바꿨습니다.` });
        } catch {
            setNotice({ type: 'error', text: '이벤트 보상 배율을 바꾸지 못했습니다.' });
        }
    }, [actions.liveConfig, updateLiveConfig]);

    const handleBroadcast = useCallback(async () => {
        const raw = window.prompt('공지 내용을 입력하세요. (최대 100자)', actions.liveConfig?.announcement || '');
        if (raw === null) return;

        const announcement = raw.trim();
        if (!announcement) {
            setNotice({ type: 'error', text: '공지 내용을 입력해 주세요.' });
            return;
        }

        try {
            await updateLiveConfig({ announcement: announcement.slice(0, 100) });
            setNotice({ type: 'success', text: '공지를 등록했습니다.' });
        } catch {
            setNotice({ type: 'error', text: '공지를 등록하지 못했습니다.' });
        }
    }, [actions.liveConfig, updateLiveConfig]);

    const submitFeedback = useCallback(async () => {
        const validation = FeedbackValidator.validate(feedbackText);
        if (!validation.valid) {
            setFeedbackStatus({ type: 'error', text: validation.error });
            return;
        }

        try {
            const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
            await addDoc(feedbackCol, {
                uid: actions.getUid(),
                nickname: player.name,
                message: feedbackText.trim(),
                statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
                timestamp: serverTimestamp(),
            });
            FeedbackValidator.markSubmitted();
            setFeedbackText('');
            setFeedbackStatus({ type: 'success', text: '의견을 보냈습니다.' });
        } catch {
            setFeedbackStatus({ type: 'error', text: '의견을 보내지 못했습니다.' });
        }
    }, [actions, feedbackText, player]);

    const noticeClass = notice?.type === 'error'
        ? 'border-rose-300/22 bg-rose-400/10 text-rose-100'
        : 'border-emerald-300/22 bg-emerald-300/10 text-emerald-100';
    const feedbackStatusClass = feedbackStatus?.type === 'error'
        ? 'border-rose-300/22 bg-rose-400/10 text-rose-100'
        : 'border-emerald-300/22 bg-emerald-300/10 text-emerald-100';

    return (
        <Motion.div
            data-testid="system-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 p-1.5"
        >
            <section data-testid="system-player-settings" className="border-b border-white/8 pb-4">
                <div>
                    <h3 className="font-readable text-sm font-bold text-white">플레이 설정</h3>
                    <p className="mt-1 font-readable text-[11px] leading-relaxed text-slate-400">
                        화면과 장비 설명을 편한 방식으로 맞춥니다.
                    </p>
                </div>

                <div data-testid="readability-settings" className="mt-4">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 font-readable text-xs font-bold text-[#dff7f5]">
                                <Eye size={14} /> 화면 선명도
                            </div>
                            <p className="mt-1 font-readable text-[11px] leading-snug text-slate-400">
                                글자와 경계가 흐리게 느껴질 때 선명하게를 선택합니다.
                            </p>
                        </div>
                        <span data-testid="readability-mode-current" className="shrink-0 font-readable text-[11px] text-[#b9f1ec]">
                            {readabilityMode === 'high' ? '선명하게' : '표준'}
                        </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="화면 선명도">
                        {READABILITY_OPTIONS.map((option) => {
                            const active = readabilityMode === option.value;
                            return (
                                <Motion.button
                                    key={option.value}
                                    type="button"
                                    whileTap={{ scale: 0.98 }}
                                    data-testid={`readability-mode-${option.value}`}
                                    aria-pressed={active}
                                    onClick={() => handleSetReadabilityMode(option.value)}
                                    className={`min-h-[44px] rounded-[0.65rem] border px-3 font-readable text-xs font-bold transition-colors ${
                                        active
                                            ? 'border-[#7dd4d8]/34 bg-[#7dd4d8]/16 text-[#dff7f5]'
                                            : 'border-white/8 bg-black/20 text-slate-300 hover:border-white/14 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    {option.label}
                                </Motion.button>
                            );
                        })}
                    </div>
                </div>

                <div data-testid="equipment-detail-settings" className="mt-5 border-t border-white/8 pt-4">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 font-readable text-xs font-bold text-[#f6e7c8]">
                                <ListTree size={14} /> 장비 설명
                            </div>
                            <p className="mt-1 font-readable text-[11px] leading-snug text-slate-400">
                                자동은 초반에는 핵심만, 성장한 뒤에는 세부 효과까지 보여 줍니다.
                            </p>
                        </div>
                        <span data-testid="equipment-detail-mode-current" className="shrink-0 font-readable text-[11px] text-[#f6e7c8]">
                            {EQUIPMENT_DETAIL_OPTIONS.find((option) => option.value === equipmentDetailMode)?.label}
                        </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="장비 설명">
                        {EQUIPMENT_DETAIL_OPTIONS.map((option) => {
                            const active = equipmentDetailMode === option.value;
                            return (
                                <Motion.button
                                    key={option.value}
                                    type="button"
                                    whileTap={{ scale: 0.98 }}
                                    data-testid={`equipment-detail-mode-${option.value}`}
                                    aria-pressed={active}
                                    onClick={() => handleSetEquipmentDetailMode(option.value)}
                                    className={`min-h-[44px] rounded-[0.65rem] border px-2 font-readable text-[11px] font-bold transition-colors ${
                                        active
                                            ? 'border-[#d5b180]/34 bg-[#d5b180]/14 text-[#f6e7c8]'
                                            : 'border-white/8 bg-black/20 text-slate-300 hover:border-white/14 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    {option.label}
                                </Motion.button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {notice && (
                <div data-testid="system-notice" role="status" className={`rounded-[0.65rem] border px-3 py-2 font-readable text-[11px] ${noticeClass}`}>
                    {notice.text}
                </div>
            )}

            <section data-testid="system-growth-links" className="border-b border-white/8 pb-4">
                <h3 className="font-readable text-sm font-bold text-white">장기 성장</h3>
                <p className="mt-1 font-readable text-[11px] leading-relaxed text-slate-400">
                    다음 여정을 준비하거나 모은 에테르를 필요한 곳에 사용합니다.
                </p>

                <div className="mt-3 space-y-2">
                    <button
                        type="button"
                        data-testid="open-mirror-panel"
                        onClick={() => runtime?.onOpenMirror?.()}
                        className="flex min-h-[58px] w-full items-center gap-3 rounded-[0.7rem] border border-[#9a8ac0]/22 bg-[#9a8ac0]/8 px-3 py-2.5 text-left transition-colors hover:bg-[#9a8ac0]/12"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.65rem] border border-[#9a8ac0]/18 bg-black/18 text-[#e3dcff]">
                            <Sparkles size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block font-readable text-xs font-bold text-[#e3dcff]">에테르 거울</span>
                            <span className="mt-0.5 block font-readable text-[11px] text-slate-400">계승 정수로 영구 성장을 준비합니다.</span>
                        </span>
                        <span className="shrink-0 font-readable text-[11px] font-semibold text-[#d9d0f3]">{player.meta?.essence || 0} 정수</span>
                    </button>

                    <button
                        type="button"
                        data-testid="open-crystal-exchange"
                        onClick={() => runtime?.onOpenCrystalExchange?.()}
                        className="flex min-h-[58px] w-full items-center gap-3 rounded-[0.7rem] border border-cyan-300/20 bg-cyan-300/8 px-3 py-2.5 text-left transition-colors hover:bg-cyan-300/12"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.65rem] border border-cyan-300/18 bg-black/18 text-cyan-100">
                            <Gem size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block font-readable text-xs font-bold text-cyan-50">에테르 교환소</span>
                            <span className="mt-0.5 block font-readable text-[11px] text-slate-400">가방과 원정 지원을 교환합니다.</span>
                        </span>
                        <span className="shrink-0 font-readable text-[11px] font-semibold text-cyan-100/80">{player.premiumCurrency || 0} 크리스탈</span>
                    </button>
                </div>
            </section>

            {titles.length > 0 && (
                <section data-testid="system-title-section" className="border-b border-white/8 pb-4">
                    <h3 className="font-readable text-sm font-bold text-white">칭호</h3>
                    <div className="mt-2 border-l-2 border-[#d5b180]/34 pl-3">
                        <div className={`font-readable text-xs font-bold ${player.activeTitle ? getTitleColor(player.activeTitle) : 'text-slate-200'}`}>
                            {activeTitleLabel}
                        </div>
                        <p className="mt-1 font-readable text-[11px] leading-snug text-slate-400">{activeTitlePassive}</p>
                    </div>

                    <details data-testid="system-title-picker" className="group mt-3 border-y border-white/8">
                        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 py-2 font-readable text-xs font-semibold text-[#f6e7c8] [&::-webkit-details-marker]:hidden">
                            <Crown size={14} />
                            <span className="flex-1">칭호 바꾸기 · {titles.length}개 보유</span>
                            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-1 border-t border-white/8 py-2">
                            {titles.map((id: string) => {
                                const isActive = player.activeTitle === id;
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        data-testid={`system-title-${id}`}
                                        aria-pressed={isActive}
                                        onClick={() => handleSetActiveTitle(id)}
                                        className={`min-h-[48px] w-full border-b border-white/6 px-2 py-2 text-left last:border-b-0 ${isActive ? 'bg-[#d5b180]/8' : 'hover:bg-white/[0.03]'}`}
                                    >
                                        <span className={`font-readable text-xs font-bold ${getTitleColor(id)}`}>[{getTitleLabel(id)}]</span>
                                        {isActive && <span className="ml-2 font-readable text-[11px] text-[#f6e7c8]">적용 중</span>}
                                        <span className="mt-1 block font-readable text-[11px] leading-snug text-slate-400">{getTitlePassiveLabel(id)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </details>
                </section>
            )}

            {relics.length > 0 && (
                <section data-testid="system-relic-section" className="border-b border-white/8 pb-2">
                    <SettingsDisclosure
                        testId="system-relic-list"
                        icon={Sparkles}
                        title={`보유 유물 ${relics.length}/${relicCapacity}`}
                        summary="현재 여정에서 얻은 유물과 효과를 확인합니다."
                    >
                        <div className="space-y-2">
                            {relics.map((relic: any) => (
                                <div key={relic.id} className="flex items-center gap-2.5 border-b border-white/6 px-1 pb-2 last:border-b-0 last:pb-0">
                                    <RelicIcon relic={relic} size={42} />
                                    <div className="min-w-0 flex-1">
                                        <div className={`font-readable text-xs font-bold ${RARITY_COLORS[relic.rarity] || 'text-slate-200'}`}>
                                            {getRelicDisplayName(relic.name)}
                                        </div>
                                        <p className="mt-1 font-readable text-[11px] leading-snug text-slate-400">{formatRelicText(relic.desc)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SettingsDisclosure>
                </section>
            )}

            <section data-testid="system-secondary-tools">
                <h3 className="font-readable text-sm font-bold text-white">기타</h3>
                <p className="mt-1 font-readable text-[11px] leading-relaxed text-slate-400">
                    순위, 의견, 저장과 기기 점검은 필요할 때 펼쳐 봅니다.
                </p>

                <div className="mt-2 border-t border-white/8">
                    <SettingsDisclosure
                        testId="system-online-records"
                        icon={Trophy}
                        title="명예의 전당"
                        summary="다른 모험가와 누적 처치 기록을 비교합니다."
                    >
                        <div className="space-y-1">
                            {leaderboard.length > 0 ? leaderboard.map((ranker: any, index: number) => {
                                const isMe = ranker.nickname === player.name;
                                return (
                                    <div key={`${ranker.nickname}-${index}`} className={`flex min-h-[40px] items-center gap-2 border-b border-white/6 px-1 py-2 last:border-b-0 ${isMe ? 'bg-emerald-300/[0.05]' : ''}`}>
                                        <span className={`w-6 shrink-0 text-center font-readable text-[11px] font-bold ${index < 3 ? 'text-[#f6e7c8]' : 'text-slate-500'}`}>
                                            {index + 1}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-readable text-xs text-slate-100">
                                            {ranker.nickname}
                                            {ranker.activeTitle && <span className="ml-1 text-[#d9d0f3]">[{getTitleLabel(ranker.activeTitle)}]</span>}
                                            {isMe && <span className="ml-1 text-emerald-100">나</span>}
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1 font-readable text-[11px] text-rose-200">
                                            {ranker.prestigeRank > 0 && <span className="mr-1 text-[#d9d0f3]">계승 {ranker.prestigeRank}</span>}
                                            <Skull size={12} /> {(ranker.totalKills || 0).toLocaleString('ko-KR')}
                                        </span>
                                    </div>
                                );
                            }) : (
                                <p className="py-3 text-center font-readable text-[11px] text-slate-400">아직 순위 기록을 불러오지 못했습니다.</p>
                            )}
                        </div>
                    </SettingsDisclosure>

                    <SettingsDisclosure
                        testId="system-feedback"
                        icon={MessageSquare}
                        title="의견 보내기"
                        summary="불편했던 점이나 이상한 동작을 개발팀에 알립니다."
                    >
                        {feedbackStatus && (
                            <div role="status" className={`mb-2 rounded-[0.65rem] border px-3 py-2 font-readable text-[11px] ${feedbackStatusClass}`}>
                                {feedbackStatus.text}
                            </div>
                        )}
                        <textarea
                            aria-label="의견 내용"
                            placeholder="불편했던 점이나 이상한 동작을 적어 주세요."
                            className="h-28 w-full resize-none rounded-[0.65rem] border border-white/8 bg-black/24 p-3 font-readable text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#7dd4d8]/28"
                            value={feedbackText}
                            onChange={(event) => setFeedbackText(event.target.value)}
                            maxLength={500}
                        />
                        <Motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={submitFeedback}
                            className="mt-2 min-h-[44px] w-full rounded-[0.65rem] border border-emerald-300/24 bg-emerald-300/10 px-3 py-2 font-readable text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-300/16"
                        >
                            보내기
                        </Motion.button>
                    </SettingsDisclosure>

                    <SettingsDisclosure
                        testId="system-support-tools"
                        icon={Wrench}
                        title="저장과 기기 점검"
                        summary="플레이 기록을 보관하거나 문제 확인 정보를 준비합니다."
                    >
                        <button
                            type="button"
                            data-testid="system-export-play-record"
                            onClick={exportPlayRecord}
                            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[0.65rem] border border-[#7dd4d8]/22 bg-[#7dd4d8]/10 px-3 py-2 font-readable text-xs font-bold text-[#dff7f5] transition-colors hover:bg-[#7dd4d8]/16"
                        >
                            <Download size={15} /> 플레이 기록 저장
                        </button>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                data-testid="system-copy-diagnostics"
                                onClick={copyQaReadout}
                                className="flex min-h-[44px] items-center justify-center gap-2 rounded-[0.65rem] border border-white/8 bg-black/20 px-2 py-2 font-readable text-[11px] font-semibold text-slate-200"
                            >
                                <Copy size={14} /> 점검 정보 복사
                            </button>
                            <button
                                type="button"
                                data-testid="system-export-diagnostics"
                                onClick={exportQaSnapshot}
                                className="flex min-h-[44px] items-center justify-center gap-2 rounded-[0.65rem] border border-white/8 bg-black/20 px-2 py-2 font-readable text-[11px] font-semibold text-slate-200"
                            >
                                <Save size={14} /> 점검 파일 저장
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-white/8 py-3 font-readable text-[11px] text-slate-400">
                            <div>화면 · {getQaValueLabel(runtime?.viewport)}</div>
                            <div>상태 · {getQaValueLabel(runtime?.gameState)}</div>
                            <div>동기화 · {getQaValueLabel(runtime?.syncStatus)}</div>
                            <div>이야기 · {runtime?.isAiThinking ? '생성 중' : '대기'}</div>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap break-all font-fira text-[11px] leading-relaxed text-slate-500">{qaReadout}</pre>
                    </SettingsDisclosure>

                    {actions.isAdmin() && (
                        <SettingsDisclosure
                            testId="system-admin-tools"
                            icon={Shield}
                            title="운영 설정"
                            summary="승인된 운영자만 보상 배율과 공지를 바꿀 수 있습니다."
                        >
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={handleSetMultiplier}
                                    className="min-h-[44px] rounded-[0.65rem] border border-rose-300/22 bg-rose-400/10 px-2 py-2 font-readable text-[11px] font-semibold text-rose-100"
                                >
                                    보상 배율
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBroadcast}
                                    className="min-h-[44px] rounded-[0.65rem] border border-rose-300/22 bg-rose-400/10 px-2 py-2 font-readable text-[11px] font-semibold text-rose-100"
                                >
                                    공지 등록
                                </button>
                            </div>
                        </SettingsDisclosure>
                    )}
                </div>
            </section>
        </Motion.div>
    );
};

export default SystemTab;
