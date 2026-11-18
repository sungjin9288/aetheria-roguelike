import { useMemo } from 'react';
import { ScrollText } from 'lucide-react';
import Chip from '../ui/Chip';
import { DB } from '../../data/db';
import { getTownPanorama } from '../../data/townPanoramas';
import { MSG } from '../../data/messages';
import { deriveCharacterAppearance } from '../../utils/characterAppearance';
import { getAvatarSpriteCandidates } from '../../utils/avatarSpriteCandidates';
import { getVisibleLocationName, getVisibleLocationVisual, getVisibleRegionTheme } from '../../utils/challengeRules';
import { FIELD_MOTE_COUNT, isFirstJourneyIntro } from '../../utils/fieldStage';
import { GS } from '../../reducers/gameStates';
import type { Player } from '../../types/index.js';

/**
 * 2026-11 마을 무대 — 안전지대의 대기 화면은 기록 창 자리의 위쪽이 무대다(필드 무대 A2와 같은 자리 · 같은 컨테이너 쿼리).
 * 마을 그림을 흐린 배경과 선명한 창 하나로 두 번 그리고, 주인공이 그 앞에 선다. 글은 지역 이름과 첫 여정 제목뿐이다
 * (소유자 2026-11-18 "글자의 나열을 최소로"). 표시만 한다 — 판정 · 난수 · 기록 줄은 바꾸지 않는다.
 */

// 입자 자리(가로 %) · 지연 · 길이 — 고정 표라 렌더마다 같다(난수를 쓰지 않는다).
const MOTES = Array.from({ length: FIELD_MOTE_COUNT }, (_, index) => ({
    x: 6 + ((index * 37) % 88),
    delay: (index * 0.9) % 6,
    duration: 6 + ((index * 7) % 4),
}));

interface TownStageProps {
    player: Player;
}

const TownStage = ({ player }: TownStageProps) => {
    const locationName = getVisibleLocationName(player, player.loc) ?? '';
    const visual = getVisibleLocationVisual(player);
    const theme = getVisibleRegionTheme(player, player.loc ? DB.MAPS[player.loc] : null);
    const heroSrc = useMemo(() => getAvatarSpriteCandidates(deriveCharacterAppearance(player))[0], [player]);
    const firstJourney = isFirstJourneyIntro(player, GS.IDLE);
    // 길 잃은 여행이면 지역 그림이 없다(visual null) — 전경 그림도 그리지 않는다.
    const panorama = visual ? getTownPanorama(player.loc) : null;

    return (
        <section
            data-testid="town-stage"
            data-region-theme={theme?.key ?? undefined}
            aria-label={MSG.FIELD_STAGE_ARIA(locationName)}
            data-town-scene={panorama ? 'panorama' : 'window'}
            className="ae-town-stage relative h-full min-h-0 w-full overflow-hidden rounded-ae-lg"
        >
            {panorama ? (
                <img
                    data-testid="town-stage-panorama"
                    src={panorama}
                    alt=""
                    aria-hidden="true"
                    className="ae-town-stage-panorama"
                />
            ) : visual && (
                <img
                    src={visual.src}
                    alt=""
                    aria-hidden="true"
                    className="ae-town-stage-backdrop"
                />
            )}
            {theme && (
                <div aria-hidden="true" className="ae-field-motes">
                    {MOTES.map((mote) => (
                        <span
                            key={mote.x}
                            className="ae-field-mote"
                            style={{ left: `${mote.x}%`, animationDelay: `${mote.delay}s`, animationDuration: `${mote.duration}s` }}
                        />
                    ))}
                </div>
            )}

            <header className="ae-town-stage-title">
                <h2 data-testid="town-stage-location" className="min-w-0 break-words font-display text-[20px] font-bold leading-tight text-ae-ink">
                    {locationName}
                </h2>
                <Chip tone="good">{MSG.FIELD_REGION_KIND.safe}</Chip>
            </header>

            <div className="ae-town-stage-scene" aria-hidden="true">
                {visual && !panorama && (
                    <div className="ae-town-stage-window">
                        <img
                            data-testid="town-stage-art"
                            data-location-visual={visual.key}
                            src={visual.src}
                            alt=""
                            width={96}
                            height={96}
                        />
                    </div>
                )}
                <div className="ae-town-stage-hero">
                    <span className="ae-field-hero-ground" />
                    <img src={heroSrc} alt="" width={96} height={96} className="ae-field-hero-art" />
                </div>
            </div>

            {firstJourney && (
                <p data-testid="town-stage-story" className="ae-town-stage-story">
                    <ScrollText size={14} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 break-words">{MSG.FIRST_JOURNEY_TITLE}</span>
                </p>
            )}
        </section>
    );
};

export default TownStage;
