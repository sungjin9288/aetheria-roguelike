import { useMemo, useState } from 'react';
import Chip from '../ui/Chip';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { deriveCharacterAppearance } from '../../utils/characterAppearance';
import { getAvatarSpriteCandidates } from '../../utils/avatarSpriteCandidates';
import { getVisibleLocationName, getVisibleLocationVisual, getVisibleRegionTheme } from '../../utils/challengeRules';
import { FIELD_MOTE_COUNT, getFieldSceneKind, selectFieldDiscovery } from '../../utils/fieldStage';
import type { Player } from '../../types/index.js';
import type { LogEntry } from '../../types/session.js';

/**
 * 2026-11 디자인 고도화 A2: 휴대폰 필드의 무대 — 기록 창 자리의 위쪽이다(전투 무대 A1과 같은 자리 · 같은 컨테이너 쿼리).
 * 지역 그림(흐린 배경) · 주인공 그림 · 지역 이름과 종류 · 지역별 미세 입자 · 방금 일어난 사건 · 발견 카드 하나.
 * 표시만 한다 — 판정 · 난수 · 기록 줄은 바꾸지 않는다. 전체 기록은 아래 기록 띠와 '모험 기록'이 맡는다.
 */

const SCENE_KIND_TONE = { boss: 'threat', safe: 'good', field: 'ether' } as const;

// 입자 자리(가로 %) · 지연 · 길이 — 고정 표라 렌더마다 같다(난수를 쓰지 않는다).
const MOTES = Array.from({ length: FIELD_MOTE_COUNT }, (_, index) => ({
    x: 6 + ((index * 37) % 88),
    delay: (index * 0.9) % 6,
    duration: 5 + ((index * 7) % 4),
}));

interface FieldStageProps {
    player: Player;
    logs: readonly LogEntry[];
}

const FieldStage = ({ player, logs }: FieldStageProps) => {
    // 무대가 선 순간의 마지막 기록 — 그 뒤의 줄만 발견 카드가 된다(마을 · 전투 · 이벤트 화면의 줄은 그 화면이 이미 보였다).
    const [floorId] = useState<string | null>(() => (logs.length > 0 ? logs[logs.length - 1].id : null));
    const discovery = selectFieldDiscovery(logs, floorId);
    const locationName = getVisibleLocationName(player, player.loc) ?? '';
    const visual = getVisibleLocationVisual(player);
    const theme = getVisibleRegionTheme(player, player.loc ? DB.MAPS[player.loc] : null);
    const sceneKind = getFieldSceneKind(player, player.loc);
    const heroSrc = useMemo(() => getAvatarSpriteCandidates(deriveCharacterAppearance(player))[0], [player]);

    return (
        <section
            data-testid="field-stage"
            data-region-theme={theme?.key ?? undefined}
            aria-label={MSG.FIELD_STAGE_ARIA(locationName)}
            className="ae-field-stage relative h-full min-h-0 w-full overflow-hidden rounded-ae-lg px-3 pb-2.5 pt-2"
        >
            {visual && (
                <img
                    data-testid="field-stage-backdrop"
                    data-location-visual={visual.key}
                    src={visual.src}
                    alt=""
                    aria-hidden="true"
                    className="ae-field-stage-backdrop"
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

            <header className="ae-field-stage-title relative z-[2] flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="sr-only">{MSG.FIELD_REGION_EYEBROW}</span>
                <h2 data-testid="field-stage-location" className="min-w-0 break-words font-display text-[18px] font-bold leading-tight text-ae-ink">
                    {locationName}
                </h2>
                <Chip tone={SCENE_KIND_TONE[sceneKind]}>{MSG.FIELD_REGION_KIND[sceneKind]}</Chip>
            </header>

            <div data-testid="field-stage-arena" className="ae-field-stage-arena relative z-[2] min-h-0">
                <div className="ae-field-hero">
                    <span aria-hidden="true" className="ae-field-hero-ground" />
                    <img
                        data-testid="field-stage-hero"
                        src={heroSrc}
                        alt=""
                        aria-hidden="true"
                        width={96}
                        height={96}
                        className="ae-field-hero-art"
                    />
                </div>
            </div>

            {discovery && (
                <p
                    key={discovery.log.id}
                    data-testid="field-stage-discovery"
                    data-discovery-kind={discovery.kind}
                    className="ae-field-discovery ae-well relative z-[2] flex min-w-0 items-start gap-2 px-2.5 py-1.5 font-readable text-[13px] leading-snug text-ae-ink"
                >
                    <span className={`ae-field-discovery-badge shrink-0 text-[11px] font-semibold is-${discovery.kind}`}>
                        {MSG.FIELD_DISCOVERY_BADGE[discovery.kind]}
                    </span>
                    <span className="min-w-0 break-words">{discovery.log.text}</span>
                </p>
            )}
        </section>
    );
};

export default FieldStage;
