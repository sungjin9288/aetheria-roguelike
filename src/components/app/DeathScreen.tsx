import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Skull } from 'lucide-react';
import { CONSTANTS } from '../../data/constants';
import { MSG } from '../../data/messages';
import type { RunSummary } from '../../reducers/actionTypes';
import type { Player } from '../../types';
import type { MilestoneStoryBeat } from '../../utils/milestoneStory';
import { MOMENT_DUR_PANEL, MOMENT_EASE } from '../moments/momentMotion';

const loadRunSummaryCard = () => import('../RunSummaryCard');
const RunSummaryCard = lazy(loadRunSummaryCard);
const MirrorPanel = lazy(() => import('../MirrorPanel'));

/** 전투가 시작되면 사망 기록 카드를 미리 받아 둔다 — 쓰러진 순간 카드가 늦게 뜨지 않게. */
// eslint-disable-next-line react-refresh/only-export-components
export const preloadDeathScreen = () => {
    void loadRunSummaryCard();
};

interface DeathBeatProps {
    killerName: string | null;
    onDone: () => void;
}

/** 쓰러진 순간 — 잠깐 멈춘 뒤 여정 기록으로 넘어간다. 화면 어디든 누르면 곧바로 넘어간다. */
export const DeathBeat = ({ killerName, onDone }: DeathBeatProps) => {
    useEffect(() => {
        const timer = setTimeout(onDone, CONSTANTS.DEATH_BEAT_MS);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <Motion.button
            type="button"
            data-testid="death-beat"
            onClick={onDone}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: MOMENT_DUR_PANEL, ease: MOMENT_EASE }}
            className="ae-moment-death-beat fixed inset-0 z-50 flex w-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
            <Skull size={40} className="text-ae-threat" aria-hidden="true" />
            <span className="break-keep font-display text-[22px] font-extrabold leading-snug text-ae-ink">
                {killerName ? MSG.DEATH_BEAT_KILLED_BY(killerName) : MSG.DEATH_BEAT_TITLE}
            </span>
            <span className="font-readable text-[12px] text-ae-ink-2">{MSG.DEATH_BEAT_SKIP}</span>
        </Motion.button>
    );
};

interface DeathScreenProps {
    runSummary: RunSummary;
    storyBeat: MilestoneStoryBeat | null;
    player: Player;
    mirrorOpen: boolean;
    onOpenMirror: () => void;
    onCloseMirror: () => void;
    onPurchaseMirror: (nodeId: string) => void;
    onRestart: () => void;
}

/**
 * 사망 화면 — 짧은 순간(누르면 넘어간다, 움직임 줄이기면 없다) 뒤 여정 기록 카드. 카드에서 에테르 거울을 열 수 있다:
 * 게임 화면(GameRoot)은 사망 동안 마운트되지 않으므로 거울도 여기서 마운트한다.
 */
const DeathScreen = ({
    runSummary,
    storyBeat,
    player,
    mirrorOpen,
    onOpenMirror,
    onCloseMirror,
    onPurchaseMirror,
    onRestart,
}: DeathScreenProps) => {
    const reduceMotion = useReducedMotion() === true;
    const [beatDone, setBeatDone] = useState(false);
    const finishBeat = useCallback(() => setBeatDone(true), []);
    const showBeat = !beatDone && !reduceMotion;

    useEffect(() => {
        preloadDeathScreen();
    }, []);

    if (showBeat) return <DeathBeat killerName={runSummary.killer?.name ?? null} onDone={finishBeat} />;

    return (
        <>
            <Suspense fallback={null}>
                <RunSummaryCard
                    runSummary={runSummary}
                    storyBeat={storyBeat}
                    essence={Math.max(0, Number(player.meta?.essence) || 0)}
                    onOpenMirror={onOpenMirror}
                    onRestart={onRestart}
                />
            </Suspense>
            {mirrorOpen && (
                <Suspense fallback={null}>
                    <MirrorPanel player={player} onClose={onCloseMirror} onPurchase={onPurchaseMirror} />
                </Suspense>
            )}
        </>
    );
};

export default DeathScreen;
