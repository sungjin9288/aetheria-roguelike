import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    ChevronDown,
    Copy,
    Crown,
    Download,
    Eye,
    Keyboard,
    ListTree,
    MessageSquare,
    Save,
    Shield,
    Trophy,
    Vibrate,
    Wrench,
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import type { FullStats, Item, Player, Relic } from '../../types/index.js';
import type { LiveConfig } from '../../types/session.js';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { APP_ID, CONSTANTS } from '../../data/constants';
import { exportToJson } from '../../utils/fileUtils';
import { getTitleColor, getTitleLabel, getTitlePassiveLabel } from '../../utils/gameUtils';
import { ELITE_TITLE_MAPS, splitEliteTitles, sumEliteTitleBonus } from '../../utils/eliteTitles';
import { formatPermanentStatBonus } from '../../utils/permanentStatSources';
import { FeedbackValidator } from '../../systems/FeedbackValidator';
import { trackRuntimeProductEvent } from '../../platform/productEventCoordinator';
import { normalizeProductEventJob } from '../../platform/productEvents';
import { MSG } from '../../data/messages';
import { isHapticsEnabled, isKeyboardShortcutsEnabled } from '../../utils/playerSettings';
import type { GameActions } from '../../hooks/actionDeps';
import type { GameMode } from '../../reducers/gameStates';
import ActionButton from '../ui/ActionButton';
import Chip from '../ui/Chip';
import SettingsDisclosure from './system/SettingsDisclosure';
import SystemLeaderboard from './system/SystemLeaderboard';
import SystemFeedbackForm, { type SystemNotice } from './system/SystemFeedbackForm';
import SystemAdminTools from './system/SystemAdminTools';
import SystemDeviceRecords from './system/SystemDeviceRecords';
import { SystemTitleList } from './system/SystemTitleList';

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

const getQaValueLabel = (value: unknown) => QA_VALUE_LABELS[String(value)] || String(value || QA_VALUE_LABELS.unknown);

/**
 * `navigator.userAgentData`(User-Agent Client Hints)는 DOM lib에 아직 없는 실험적 API라
 * `Navigator`에 선언돼 있지 않다 — `in`으로 존재를 좁혀서 읽는다(미지원 브라우저는
 * `navigator.platform` fallback으로 자연 진행).
 */
const hasUserAgentData = (
    nav: Navigator,
): nav is Navigator & { userAgentData: { platform?: string } } => 'userAgentData' in nav;

/** SystemTab이 실제로 호출하는 액션만 좁혀 받는다 (설정/칭호/순위/관리자). */
type SystemTabActions = Pick<GameActions,
    'leaderboard' | 'setReadabilityMode' | 'setEquipmentDetailMode' | 'setActiveTitle' | 'liveConfig' | 'getUid' | 'isAdmin'
    | 'setHapticsEnabled' | 'setKeyboardShortcutsEnabled'
>;

/** 2026-10-26 소유자 결정 D3 · D23: 켬/끔 두 칸(기본 켬) — 진동 · 한 글자 단축키가 같이 쓴다. */
const TOGGLE_OPTIONS = [
    { value: true, label: MSG.SYSTEM_TOGGLE_ON },
    { value: false, label: MSG.SYSTEM_TOGGLE_OFF },
] as const;

interface SettingToggleRowProps {
    testId: string;
    icon: ReactNode;
    iconTone: string;
    title: string;
    desc: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

const SettingToggleRow = ({ testId, icon, iconTone, title, desc, enabled, onChange }: SettingToggleRowProps) => (
    <div data-testid={testId} className="mt-4 border-t border-ae-ink/7 pt-4">
        <div className="flex items-start gap-3">
            <span className={`ab-icon-well ${iconTone}`} aria-hidden="true">{icon}</span>
            <div className="min-w-0 flex-1">
                <div className="font-readable aether-type-strong text-ae-ink">{title}</div>
                <p className="mt-0.5 font-readable aether-type-meta leading-snug text-ae-ink-3">{desc}</p>
            </div>
            <Chip tone={enabled ? 'ether' : 'neutral'} data-testid={`${testId}-current`} className="shrink-0">
                {MSG.SYSTEM_TOGGLE_STATE(enabled)}
            </Chip>
        </div>
        <div className="ab-segment mt-3 grid-cols-2" role="group" aria-label={title}>
            {TOGGLE_OPTIONS.map((option) => (
                <button
                    key={String(option.value)}
                    type="button"
                    data-testid={`${testId}-${option.value ? 'on' : 'off'}`}
                    aria-pressed={enabled === option.value}
                    onClick={() => onChange(option.value)}
                    className="ab-segment-option font-readable"
                >
                    {option.label}
                </button>
            ))}
        </div>
    </div>
);

/**
 * MobileGameLayout이 만드는 런타임 컨텍스트 — SystemTab이 읽는 필드만 좁혀 받는다.
 * 생산자(`components/app/MobileGameLayout.tsx`)는 이 외에도 필드를 더 얹지만 이 화면은
 * viewport/gameState/syncStatus/isAiThinking만 읽는다(에테르 거울 · 교환소 진입은 2026-10-26 D2로 마을 시설에 있다).
 */
export interface SystemTabRuntime {
    viewport?: string;
    gameState?: GameMode;
    syncStatus?: string;
    isAiThinking?: boolean;
}

interface SystemTabProps {
    player: Player;
    actions?: SystemTabActions;
    stats?: FullStats | null;
    runtime?: SystemTabRuntime;
}

/** 섹션 머리 — 제목 + 한 줄 설명. */
const SectionHead = ({ title, desc }: { title: string; desc?: string }) => (
    <header>
        <h3 className="ab-section-title font-readable">{title}</h3>
        {desc && <p className="mt-1 font-readable aether-type-meta leading-relaxed text-ae-ink-3">{desc}</p>}
    </header>
);

const SystemTab = ({ player, actions, stats, runtime }: SystemTabProps) => {
    const [notice, setNotice] = useState<SystemNotice | null>(null);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState<SystemNotice | null>(null);

    const readabilityMode = player.settings?.readabilityMode === 'high' ? 'high' : 'standard';
    const equipmentDetailPref = player.settings?.equipmentDetailMode;
    const equipmentDetailMode = equipmentDetailPref === 'summary' || equipmentDetailPref === 'full'
        ? equipmentDetailPref
        : 'auto';
    const titles = useMemo(() => player.titles || [], [player.titles]);
    // 2026-10 Wave 72: 정예 목격 칭호(지역마다 하나, 효과는 모은 만큼 합산)는 칭호 바꾸기 목록 안에 묶어서 보인다.
    const titleGroups = useMemo(() => splitEliteTitles(titles), [titles]);
    const eliteTitleTotal = useMemo(() => sumEliteTitleBonus(titles), [titles]);
    const relics = useMemo(() => player.relics || [], [player.relics]);
    const leaderboard = actions?.leaderboard || [];
    const activeTitleLabel = player.activeTitle ? getTitleLabel(player.activeTitle) : MSG.SYSTEM_TITLE_NONE;
    const activeTitlePassive = player.activeTitle ? getTitlePassiveLabel(player.activeTitle) : MSG.SYSTEM_TITLE_NONE_HINT;

    const handleSetReadabilityMode = useCallback((mode: 'standard' | 'high') => {
        actions?.setReadabilityMode?.(mode);
        const label = READABILITY_OPTIONS.find((option) => option.value === mode)?.label || READABILITY_OPTIONS[0].label;
        setNotice({ type: 'success', text: MSG.SYSTEM_READABILITY_CHANGED(label) });
    }, [actions]);

    const handleSetEquipmentDetailMode = useCallback((mode: 'auto' | 'summary' | 'full') => {
        actions?.setEquipmentDetailMode?.(mode);
        const label = EQUIPMENT_DETAIL_OPTIONS.find((option) => option.value === mode)?.label || EQUIPMENT_DETAIL_OPTIONS[0].label;
        setNotice({ type: 'success', text: MSG.SYSTEM_EQUIPMENT_DETAIL_CHANGED(label) });
    }, [actions]);

    const hapticsEnabled = isHapticsEnabled(player);
    const shortcutsEnabled = isKeyboardShortcutsEnabled(player);
    const handleSetHapticsEnabled = useCallback((enabled: boolean) => {
        actions?.setHapticsEnabled?.(enabled);
        setNotice({ type: 'success', text: MSG.SYSTEM_HAPTICS_CHANGED(enabled) });
    }, [actions]);
    const handleSetShortcutsEnabled = useCallback((enabled: boolean) => {
        actions?.setKeyboardShortcutsEnabled?.(enabled);
        setNotice({ type: 'success', text: MSG.SYSTEM_SHORTCUTS_CHANGED(enabled) });
    }, [actions]);

    const handleSetActiveTitle = useCallback((id: string) => {
        const nextTitle = player.activeTitle === id ? null : id;
        actions?.setActiveTitle?.(nextTitle);
        setNotice({
            type: 'success',
            text: nextTitle ? MSG.SYSTEM_TITLE_APPLIED(getTitleLabel(nextTitle)) : MSG.SYSTEM_TITLE_CLEARED,
        });
    }, [actions, player.activeTitle]);

    const qaContext = useMemo(() => {
        const platform = typeof navigator !== 'undefined'
            ? ((hasUserAgentData(navigator) ? navigator.userAgentData.platform : undefined) || navigator.platform || 'unknown')
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
        const inventoryCounts = (player.inv || []).reduce((counts: Record<string, number>, item: Item) => {
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
            relics: relics.map((relic: Relic) => ({ id: relic.id, name: relic.name, rarity: relic.rarity })),
            titles,
            inventoryCounts,
            meta: player.meta || null,
            dailyProtocol: player.stats?.dailyProtocol || null,
        };
    }, [equipmentDetailMode, player, qaContext, readabilityMode, relics, runtime, stats, titles]);

    const copyQaReadout = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(qaReadout);
            setNotice({ type: 'success', text: MSG.SYSTEM_QA_COPIED });
        } catch {
            setNotice({ type: 'error', text: MSG.SYSTEM_QA_COPY_FAILED });
        }
    }, [qaReadout]);

    const exportQaSnapshot = useCallback(() => {
        exportToJson(`aetheria_qa_snapshot_${Date.now()}.json`, qaSnapshot);
        setNotice({ type: 'success', text: MSG.SYSTEM_QA_EXPORTED });
    }, [qaSnapshot]);

    const exportPlayRecord = useCallback(() => {
        exportToJson(`aetheria_log_${Date.now()}.json`, {
            timestamp: new Date().toISOString(),
            summary: { name: player.name, level: player.level, job: player.job, gold: player.gold },
            stats,
            equipment: player.equip,
            history: [...(player.history || [])],
        });
        setNotice({ type: 'success', text: MSG.SYSTEM_PLAY_RECORD_EXPORTED });
    }, [player, stats]);

    const updateLiveConfig = useCallback(async (partialConfig: Partial<LiveConfig>) => {
        // Firebase config 부재 시 이전에도 doc(null, …)이 throw했다 — 같은 실패 경로를 명시한다.
        if (!db) throw new Error('Firebase config missing');
        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
        await setDoc(configRef, { config: partialConfig }, { merge: true });
    }, []);

    const handleSetMultiplier = useCallback(async () => {
        const raw = window.prompt(MSG.SYSTEM_ADMIN_MULTIPLIER_PROMPT, String(actions?.liveConfig?.eventMultiplier || 1));
        if (raw === null) return;

        const value = Number.parseFloat(raw);
        if (!Number.isFinite(value) || value < 1 || value > 5) {
            setNotice({ type: 'error', text: MSG.SYSTEM_ADMIN_MULTIPLIER_RANGE });
            return;
        }

        try {
            await updateLiveConfig({ eventMultiplier: value });
            setNotice({ type: 'success', text: MSG.QA_EVENT_MULTIPLIER_SET(value) });
        } catch {
            setNotice({ type: 'error', text: MSG.SYSTEM_ADMIN_MULTIPLIER_FAILED });
        }
    }, [actions?.liveConfig, updateLiveConfig]);

    const handleBroadcast = useCallback(async () => {
        const raw = window.prompt(MSG.SYSTEM_ADMIN_BROADCAST_PROMPT, actions?.liveConfig?.announcement || '');
        if (raw === null) return;

        const announcement = raw.trim();
        if (!announcement) {
            setNotice({ type: 'error', text: MSG.SYSTEM_ADMIN_BROADCAST_EMPTY });
            return;
        }

        try {
            await updateLiveConfig({ announcement: announcement.slice(0, 100) });
            setNotice({ type: 'success', text: MSG.SYSTEM_ADMIN_BROADCAST_DONE });
        } catch {
            setNotice({ type: 'error', text: MSG.SYSTEM_ADMIN_BROADCAST_FAILED });
        }
    }, [actions?.liveConfig, updateLiveConfig]);

    const submitFeedback = useCallback(async () => {
        const trackFeedbackOutcome = (
            outcome: 'success' | 'validation_failed' | 'transport_failed',
        ) => trackRuntimeProductEvent({
            receipt: `feedback:${Date.now()}:${outcome}`,
            name: 'feedback_submission',
            fields: {
                job: String(player.name || '').trim() ? normalizeProductEventJob(player.job) : 'unknown',
                level: Number(player.level) || 1,
                outcome,
            },
        });
        const validation = FeedbackValidator.validate(feedbackText);
        if (!validation.valid) {
            trackFeedbackOutcome('validation_failed');
            setFeedbackStatus({ type: 'error', text: validation.error ?? '' });
            return;
        }

        try {
            if (!db) throw new Error('Firebase config missing');
            const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
            await addDoc(feedbackCol, {
                uid: actions?.getUid(),
                nickname: player.name,
                message: feedbackText.trim(),
                statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
                timestamp: serverTimestamp(),
            });
            FeedbackValidator.markSubmitted();
            trackFeedbackOutcome('success');
            setFeedbackText('');
            setFeedbackStatus({ type: 'success', text: MSG.SYSTEM_FEEDBACK_SENT });
        } catch {
            trackFeedbackOutcome('transport_failed');
            setFeedbackStatus({ type: 'error', text: MSG.SYSTEM_FEEDBACK_FAILED });
        }
    }, [actions, feedbackText, player]);

    const qaRows = [
        [MSG.SYSTEM_QA_VIEWPORT, getQaValueLabel(runtime?.viewport)],
        [MSG.SYSTEM_QA_STATE, getQaValueLabel(runtime?.gameState)],
        [MSG.SYSTEM_QA_SYNC, getQaValueLabel(runtime?.syncStatus)],
        [MSG.SYSTEM_QA_STORY, getQaValueLabel(runtime?.isAiThinking ? 'thinking' : 'idle')],
    ];

    return (
        <Motion.div
            data-testid="system-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ab-stack p-1.5"
        >
            <section data-testid="system-player-settings" className="ae-card ab-card-pad">
                <SectionHead title="플레이 설정" desc={MSG.SYSTEM_PLAYER_SETTINGS_DESC} />

                <div data-testid="readability-settings" className="mt-4">
                    <div className="flex items-start gap-3">
                        <span className="ab-icon-well is-ether" aria-hidden="true"><Eye size={16} /></span>
                        <div className="min-w-0 flex-1">
                            <div className="font-readable aether-type-strong text-ae-ink">화면 선명도</div>
                            <p className="mt-0.5 font-readable aether-type-meta leading-snug text-ae-ink-3">{MSG.SYSTEM_READABILITY_DESC}</p>
                        </div>
                        <Chip tone="ether" data-testid="readability-mode-current" className="shrink-0">
                            {readabilityMode === 'high' ? READABILITY_OPTIONS[1].label : READABILITY_OPTIONS[0].label}
                        </Chip>
                    </div>
                    <div className="ab-segment mt-3 grid-cols-2" role="group" aria-label="화면 선명도">
                        {READABILITY_OPTIONS.map((option) => {
                            const active = readabilityMode === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    data-testid={`readability-mode-${option.value}`}
                                    aria-pressed={active}
                                    onClick={() => handleSetReadabilityMode(option.value)}
                                    className="ab-segment-option font-readable"
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div data-testid="equipment-detail-settings" className="mt-4 border-t border-ae-ink/7 pt-4">
                    <div className="flex items-start gap-3">
                        <span className="ab-icon-well is-gold" aria-hidden="true"><ListTree size={16} /></span>
                        <div className="min-w-0 flex-1">
                            <div className="font-readable aether-type-strong text-ae-ink">장비 설명</div>
                            <p className="mt-0.5 font-readable aether-type-meta leading-snug text-ae-ink-3">{MSG.SYSTEM_EQUIPMENT_DETAIL_DESC}</p>
                        </div>
                        <Chip tone="gold" data-testid="equipment-detail-mode-current" className="shrink-0">
                            {EQUIPMENT_DETAIL_OPTIONS.find((option) => option.value === equipmentDetailMode)?.label}
                        </Chip>
                    </div>
                    <div className="ab-segment mt-3 grid-cols-3" role="group" aria-label="장비 설명">
                        {EQUIPMENT_DETAIL_OPTIONS.map((option) => {
                            const active = equipmentDetailMode === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    data-testid={`equipment-detail-mode-${option.value}`}
                                    aria-pressed={active}
                                    onClick={() => handleSetEquipmentDetailMode(option.value)}
                                    className="ab-segment-option font-readable"
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <SettingToggleRow
                    testId="haptics-settings"
                    icon={<Vibrate size={16} />}
                    iconTone="is-exp"
                    title={MSG.SYSTEM_HAPTICS_TITLE}
                    desc={MSG.SYSTEM_HAPTICS_DESC}
                    enabled={hapticsEnabled}
                    onChange={handleSetHapticsEnabled}
                />
                <SettingToggleRow
                    testId="keyboard-shortcut-settings"
                    icon={<Keyboard size={16} />}
                    iconTone="is-ether"
                    title={MSG.SYSTEM_SHORTCUTS_TITLE}
                    desc={MSG.SYSTEM_SHORTCUTS_DESC}
                    enabled={shortcutsEnabled}
                    onChange={handleSetShortcutsEnabled}
                />
            </section>

            {notice && (
                <div data-testid="system-notice" role="status" className={`ab-notice font-readable ${notice.type === 'error' ? 'is-threat' : 'is-good'}`}>
                    {notice.text}
                </div>
            )}

            {titles.length > 0 && (
                <section data-testid="system-title-section" className="ae-card ab-card-pad">
                    <SectionHead title="칭호" />
                    <div className="ae-well mt-3 flex items-start gap-3 p-3">
                        <span className="ab-icon-well is-gold" aria-hidden="true"><Crown size={16} /></span>
                        <div className="min-w-0 flex-1">
                            <div className={`font-readable aether-type-strong ${player.activeTitle ? getTitleColor(player.activeTitle) : 'text-ae-ink'}`}>
                                {activeTitleLabel}
                            </div>
                            <p className="mt-1 font-readable aether-type-meta leading-snug text-ae-ink-2">{activeTitlePassive}</p>
                        </div>
                    </div>

                    <details data-testid="system-title-picker" className="mt-2">
                        <summary className="ab-summary">
                            <span className="min-w-0 flex-1 font-readable aether-type-body font-bold text-ae-gold-text">
                                {MSG.SYSTEM_TITLE_PICKER(titles.length)}
                            </span>
                            <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                        </summary>
                        <div className="border-t border-ae-ink/7 pt-1">
                            <SystemTitleList ids={titleGroups.regular} activeTitle={player.activeTitle} onSelect={handleSetActiveTitle} />
                            {titleGroups.elite.length > 0 && (
                                <details data-testid="system-elite-titles" className="border-t border-ae-ink/7">
                                    <summary className="ab-summary flex-wrap !gap-x-2 !gap-y-0.5">
                                        <span className="shrink-0 font-readable aether-type-body font-bold text-ae-gold-text">
                                            {MSG.ELITE_TITLE_GROUP(eliteTitleTotal.count, ELITE_TITLE_MAPS.length)}
                                        </span>
                                        <span data-testid="system-elite-titles-total" className="min-w-0 flex-1 font-readable aether-type-meta text-ae-ink-3">
                                            {MSG.ELITE_TITLE_GROUP_TOTAL(formatPermanentStatBonus(eliteTitleTotal))}
                                        </span>
                                        <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                                    </summary>
                                    <div className="pb-1 pl-2">
                                        <SystemTitleList ids={titleGroups.elite} activeTitle={player.activeTitle} onSelect={handleSetActiveTitle} />
                                    </div>
                                </details>
                            )}
                        </div>
                    </details>
                </section>
            )}

            <section data-testid="system-secondary-tools" className="ae-card is-quiet ab-card-pad">
                <SectionHead title={MSG.SYSTEM_SECONDARY_TITLE} desc={MSG.SYSTEM_SECONDARY_DESC} />
                <div className="ab-rows mt-2">
                    <SettingsDisclosure testId="system-online-records" icon={Trophy} tone="gold" title="명예의 전당" summary={MSG.SYSTEM_LEADERBOARD_DESC}>
                        <SystemLeaderboard entries={leaderboard} playerName={player.name} />
                    </SettingsDisclosure>

                    <SettingsDisclosure testId="system-feedback" icon={MessageSquare} tone="ether" title="의견 보내기" summary={MSG.SYSTEM_FEEDBACK_DESC}>
                        <SystemFeedbackForm value={feedbackText} status={feedbackStatus} onChange={setFeedbackText} onSubmit={submitFeedback} />
                    </SettingsDisclosure>

                    <SettingsDisclosure testId="system-support-tools" icon={Wrench} title="저장과 기기 점검" summary={MSG.SYSTEM_SUPPORT_DESC}>
                        <ActionButton
                            data-testid="system-export-play-record"
                            icon={<Download size={16} />}
                            label="플레이 기록 저장"
                            onClick={exportPlayRecord}
                            className="w-full"
                        />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <ActionButton variant="ghost" data-testid="system-copy-diagnostics" icon={<Copy size={15} />} label={MSG.SYSTEM_QA_COPY} onClick={copyQaReadout} />
                            <ActionButton variant="ghost" data-testid="system-export-diagnostics" icon={<Save size={15} />} label={MSG.SYSTEM_QA_EXPORT} onClick={exportQaSnapshot} />
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-ae-ink/7 py-3 font-readable aether-type-meta">
                            {qaRows.map(([label, value]) => (
                                <div key={label} className="flex flex-wrap gap-x-1.5">
                                    <dt className="text-ae-ink-3">{label}</dt>
                                    <dd className="text-ae-ink">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <SystemDeviceRecords onNotice={setNotice} />
                        <pre className="mt-3 whitespace-pre-wrap break-all font-fira aether-type-label leading-relaxed text-ae-ink-3">{qaReadout}</pre>
                    </SettingsDisclosure>

                    {actions?.isAdmin() && (
                        <SettingsDisclosure testId="system-admin-tools" icon={Shield} tone="threat" title={MSG.SYSTEM_ADMIN_TITLE} summary={MSG.SYSTEM_ADMIN_DESC}>
                            <SystemAdminTools onSetMultiplier={handleSetMultiplier} onBroadcast={handleBroadcast} />
                        </SettingsDisclosure>
                    )}
                </div>
            </section>
        </Motion.div>
    );
};

export default SystemTab;
