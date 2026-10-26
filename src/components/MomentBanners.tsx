import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Crown, Gem, Skull, Sparkles } from 'lucide-react';
import { MSG } from '../data/messages';
import { MOMENT_DUR_UI, MOMENT_EASE } from './moments/momentMotion';
import { useEncounterBanner, type EncounterBannerMoment } from '../hooks/useEncounterBanner';
import { useRelicAcquisitionMoment, type RelicAcquisitionBannerMoment } from '../hooks/useRelicAcquisitionMoment';
import { getRelicDisplayName } from '../utils/relicPresentation';
import type { Monster, Relic } from '../types/index.js';

interface MomentBannersProps {
    /** 지금 싸우는 적 — 전투가 아니면 null(GameRoot가 넘긴다). */
    enemy?: Monster | null;
    /** 가진 유물 — 새 유물이 들어온 순간을 잡는다. */
    relics?: readonly Relic[] | null;
    presentationEpoch: number;
    /** 레벨 상승 띠가 위쪽 알림 자리에 떠 있다 — 그 아래로 내려 겹치지 않는다. */
    belowLevelUp?: boolean;
}

const BANNER_MOTION = {
    initial: { opacity: 0, y: -12, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: MOMENT_DUR_UI, ease: MOMENT_EASE },
} as const;

/** 2026-10 화면 디자인 3차: 순간 띠는 모두 같은 불투명 유리 알약이다 — 색만 다르다(보스 위협 · 우두머리 금 · 유물 물빛 · 전설 조합 산호). */
const PILL_CLASS = 'ae-moment-pill flex max-w-full items-center gap-3 rounded-ae-lg py-2 pl-2 pr-5 text-left';
const PILL_ICON_CLASS = 'ae-moment-pill-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full';
const PILL_LABEL_CLASS = 'ae-moment-pill-label font-readable text-[11px] font-bold';
const PILL_NAME_CLASS = 'mt-0.5 break-keep font-display text-[18px] font-extrabold leading-tight text-ae-ink';

const EncounterBannerCard = ({ banner }: { banner: EncounterBannerMoment }) => {
    const isChampion = banner.kind === 'champion';
    return (
        <Motion.div
            data-testid="encounter-banner"
            data-encounter-kind={banner.kind}
            {...BANNER_MOTION}
            className={`${PILL_CLASS} ${isChampion ? 'is-gold' : 'is-threat'}`}
        >
            <span className={PILL_ICON_CLASS} aria-hidden="true">
                {isChampion ? <Crown size={20} /> : <Skull size={20} />}
            </span>
            <div className="min-w-0">
                <div className={PILL_LABEL_CLASS}>
                    {isChampion ? MSG.HUNT_CHAMPION_ENTRY_BANNER : MSG.BOSS_ENTRY_BANNER}
                </div>
                <div className={PILL_NAME_CLASS}>
                    {banner.name}
                </div>
            </div>
        </Motion.div>
    );
};

const RELIC_PILL_TONE = Object.freeze({ plain: 'is-ether', pair: 'is-ether', legendary: 'is-legendary' } as const);

const RelicMomentCard = ({ moment }: { moment: RelicAcquisitionBannerMoment }) => {
    const synergy = moment.synergy;
    const kind = !synergy ? 'plain' : synergy.legendary ? 'legendary' : 'pair';
    return (
        <Motion.div
            data-testid="relic-moment-banner"
            data-relic-moment={kind}
            {...BANNER_MOTION}
            className={`${PILL_CLASS} ${RELIC_PILL_TONE[kind]}`}
        >
            <span className={PILL_ICON_CLASS} aria-hidden="true">
                {kind === 'plain' ? <Gem size={20} /> : <Sparkles size={20} />}
            </span>
            <div className="min-w-0">
                <div className={PILL_LABEL_CLASS}>
                    {!synergy
                        ? MSG.RELIC_ACQUIRED_LABEL
                        : synergy.legendary ? MSG.RELIC_SYNERGY_LEGENDARY_COMPLETE : MSG.RELIC_PAIR_COMPLETE_BADGE}
                </div>
                <div className={PILL_NAME_CLASS}>
                    {synergy ? synergy.label : getRelicDisplayName(moment.relicName)}
                </div>
                {synergy?.drawback && (
                    <div data-testid="relic-moment-drawback" className="mt-1 break-keep font-readable text-[11px] font-semibold text-ae-ink-2">
                        {MSG.RELIC_SYNERGY_DRAWBACK_LINE(synergy.drawback)}
                    </div>
                )}
            </div>
        </Motion.div>
    );
};

/**
 * 보상 · 조우의 짧은 순간 띠 — 2026-10 (감사 GF-08 · GF-09). 위쪽 알림 자리(레벨 상승 띠와 같은 줄, 떠 있으면 그 아래)에
 *   보스 · 토벌 의뢰 우두머리가 처음 나타난 순간(1.2초)과 유물을 받은 순간(1.4초, 조합이 켜지면 이름 · 대가와 함께 2초)을 보인다.
 * 판정은 hooks(`useEncounterBanner` · `useRelicAcquisitionMoment`)가, 화면은 누르는 것을 받지 않는다(pointer-events none).
 * 위협 수치 · 권고는 싣지 않는다 — 수치는 기록 줄(BOSS_THREAT)이 말한다(Wave 88 · 111). 기록 줄은 더하지 않는다.
 * 상태 알림 칸(role=status)은 늘 있어 띠가 나타나면 화면 낭독기가 읽는다.
 */
const MomentBanners = ({ enemy, relics, presentationEpoch, belowLevelUp = false }: MomentBannersProps) => {
    const encounter = useEncounterBanner(enemy, presentationEpoch);
    const relicMoment = useRelicAcquisitionMoment(relics, presentationEpoch);
    return (
        <div
            role="status"
            data-testid="moment-banners"
            className={`pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 ${
                belowLevelUp ? 'top-[calc(var(--aether-safe-area-top)+6.25rem)]' : 'top-[calc(var(--aether-safe-area-top)+0.5rem)]'
            }`}
        >
            <AnimatePresence>
                {encounter && <EncounterBannerCard key={`encounter_${encounter.serial}`} banner={encounter} />}
                {relicMoment && <RelicMomentCard key={`relic_${relicMoment.serial}`} moment={relicMoment} />}
            </AnimatePresence>
        </div>
    );
};

export default MomentBanners;
