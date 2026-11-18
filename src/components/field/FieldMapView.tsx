import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import Chip from '../ui/Chip';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { toCoord } from '../../systems/fieldMapGen';
import { getFieldDangerSignal, getFieldEncounterThreshold, getFieldRevealed } from '../../systems/fieldMapWalk';
import { deriveCharacterAppearance } from '../../utils/characterAppearance';
import { getAvatarSpriteCandidates } from '../../utils/avatarSpriteCandidates';
import { getVisibleLocationName, getVisibleLocationVisual, isBlindMap } from '../../utils/challengeRules';
import { getChapterOf } from '../../utils/chapters';
import { fieldColor, readFieldBiomePalette, readFieldMapPalette } from '../../utils/fieldMapPalette';
import { getFieldBiome } from '../../systems/fieldBiome';
import { getAreaBossName } from '../../utils/bossGauge';
import { DB } from '../../data/db';
import { drawFieldDoor, drawFieldTile } from './fieldTileArt';
import type { FieldMapLayout, FieldMapState } from '../../types/fieldMap';
import type { Player } from '../../types/index.js';

/**
 * 지역 지도(2026-11 지역 지도 걷기, 설계 §8) — `<canvas>` 하나(칸 · 상자 · 출구 · 주인공)와 React 덧씌움(위험 구슬 · 상자 수 ·
 * 처음 들어선 순간의 걷는 법 한 줄). 표시만 한다 — 걷기 · 판정은 리듀서가 소유한다. 색은 디자인 토큰(`--aether-*-rgb`)을 읽는다.
 */

interface FieldMapViewProps {
    player: Player;
    field: FieldMapState;
    layout: FieldMapLayout;
    /** 지금 보이는 보스 문의 칸(오버월드 3단계) — 닫혀 있으면 null */
    door?: number | null;
    /** 칸을 눌렀다(2026-11 화면 B안 — 방향 패드 대신 칸을 눌러 걷는다). 없으면 지도는 누를 수 없다. */
    onTileTap?: (index: number) => void;
    /** 지금 걸어가는 목표 칸 — 테두리로 표시한다 */
    walkTarget?: number | null;
}

/** 카메라 — 칸 크기와 왼쪽 위 모서리(주인공을 언제나 가운데에 둔다). 그리기와 누르기가 같은 값을 쓴다. */
const getFieldCamera = (width: number, height: number, layoutWidth: number, pos: number) => {
    const tile = Math.min(FIELD_MAP_TILE_MAX_PX, Math.max(BALANCE.FIELD_TILE_PX, Math.floor(width / FIELD_MAP_VISIBLE_COLS)));
    const hero = toCoord(layoutWidth, pos);
    return { tile, hero, camX: hero.x * tile + tile / 2 - width / 2, camY: hero.y * tile + tile / 2 - height / 2 };
};

// 2026-11 마을 · 지도 무대: 휴대폰 폭에서 가로로 보이는 칸 수 — 칸 크기는 폭 ÷ 이 수(최소 BALANCE.FIELD_TILE_PX, 최대 아래 상한)다.
//   38px 고정이던 동안 390px 폭에서 칸이 작고 밝혀지지 않은 칸이 화면의 대부분을 검게 남겼다. 표시만 한다(걷기 · 판정 불변).
const FIELD_MAP_VISIBLE_COLS = 8;
const FIELD_MAP_TILE_MAX_PX = 56;
// 밝혀지지 않은 칸 위의 안개 — 그 아래로 지역 그림이 흐리게 비친다. 지역 그림이 없으면(길 잃은 여행) 불투명 배경 그대로다.
const FIELD_MAP_FOG_ALPHA = 0.62;

const useHeroImage = (src: string | undefined) => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    useEffect(() => {
        if (!src || typeof Image === 'undefined') return undefined;
        let alive = true;
        const img = new Image();
        img.onload = () => { if (alive) setImage(img); };
        img.src = src;
        return () => { alive = false; };
    }, [src]);
    return image;
};

const FieldMapView = ({ player, field, layout, door = null, onTileTap, walkTarget = null }: FieldMapViewProps) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const palette = useMemo(() => readFieldMapPalette(), []);
    // 오버월드 3단계: 바이옴(지역 색 테마에서 도출 — 길 잃은 여행이면 중립 폐허)
    const blind = isBlindMap(player);
    const mapData = DB.MAPS[layout.loc];
    const biome = getFieldBiome(layout.loc, mapData, blind);
    const biomeColors = useMemo(() => readFieldBiomePalette(biome), [biome]);
    const heroSrc = useMemo(() => getAvatarSpriteCandidates(deriveCharacterAppearance(player))[0], [player]);
    const heroImage = useHeroImage(heroSrc);
    // 지역 그림(흐린 배경) — 길 잃은 여행이면 없다.
    const backdropSrc = getVisibleLocationVisual(player)?.src ?? null;

    // 마지막으로 걸은 방향 — 왼쪽이면 주인공을 뒤집는다.
    const prevPosRef = useRef(field.pos);
    const [facingLeft, setFacingLeft] = useState(false);
    useEffect(() => {
        const prev = prevPosRef.current;
        if (prev !== field.pos) {
            const dx = toCoord(layout.width, field.pos).x - toCoord(layout.width, prev).x;
            if (dx !== 0) setFacingLeft(dx < 0);
            prevPosRef.current = field.pos;
        }
    }, [field.pos, layout.width]);

    useEffect(() => {
        const node = wrapRef.current;
        if (!node || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize({ width: Math.floor(width), height: Math.floor(height) });
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const revealed = useMemo(() => getFieldRevealed(layout, field.visited), [layout, field.visited]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || size.width <= 0 || size.height <= 0) return;
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
        canvas.width = Math.round(size.width * dpr);
        canvas.height = Math.round(size.height * dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.width, size.height);
        ctx.fillStyle = fieldColor(palette.bg, backdropSrc ? FIELD_MAP_FOG_ALPHA : 1);
        ctx.fillRect(0, 0, size.width, size.height);

        // 카메라는 언제나 주인공을 가운데에 둔다 — 가장자리에서 멈추면 주인공이 위 · 아래 덧씌움(상자 수 · 한 줄 소식) 밑에 숨는다.
        const { tile, hero, camX, camY } = getFieldCamera(size.width, size.height, layout.width, field.pos);
        const exits = new Map(layout.exits.map((exit) => [exit.index, exit]));
        const chests = new Map(layout.chests.map((chest) => [chest.index, chest]));
        const x0 = Math.max(0, Math.floor(camX / tile));
        const y0 = Math.max(0, Math.floor(camY / tile));
        const x1 = Math.min(layout.width - 1, Math.ceil((camX + size.width) / tile));
        const y1 = Math.min(layout.height - 1, Math.ceil((camY + size.height) / tile));

        for (let y = y0; y <= y1; y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                const index = y * layout.width + x;
                const px = x * tile - camX;
                const py = y * tile - camY;
                if (index === door) {
                    // 보스 문은 밝혀지지 않아도 보인다 — 가야 할 곳이 지도 위에 있다.
                    if (revealed.has(index)) drawFieldTile({ ctx, biome, char: layout.tiles[index], px, py, tile, index, base: palette, colors: biomeColors });
                    drawFieldDoor(ctx, px, py, tile, palette);
                    continue;
                }
                if (!revealed.has(index)) continue;
                const char = layout.tiles[index];
                drawFieldTile({ ctx, biome, char, px, py, tile, index, base: palette, colors: biomeColors });
                if (index === layout.entrance) {
                    ctx.strokeStyle = fieldColor(palette.entrance, 0.8);
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px + 4, py + 4, tile - 8, tile - 8);
                }
                if (exits.has(index)) {
                    ctx.fillStyle = fieldColor(palette.exit, 0.55);
                    ctx.fillRect(px + 3, py + 3, tile - 6, tile - 6);
                    ctx.fillStyle = fieldColor(palette.ink, 0.9);
                    ctx.beginPath();
                    ctx.arc(px + tile / 2, py + tile / 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                const chest = chests.get(index);
                if (chest) {
                    const opened = field.openedChests.includes(chest.id);
                    ctx.fillStyle = fieldColor(palette.chest, opened ? 0.25 : 1);
                    ctx.fillRect(px + tile * 0.22, py + tile * 0.32, tile * 0.56, tile * 0.42);
                    ctx.fillStyle = fieldColor(palette.wall, opened ? 0.4 : 0.85);
                    ctx.fillRect(px + tile * 0.22, py + tile * 0.47, tile * 0.56, 2);
                }
            }
        }

        // 걸어가는 목표 칸 — 에테르 테두리
        if (walkTarget !== null && walkTarget !== field.pos) {
            const target = toCoord(layout.width, walkTarget);
            ctx.strokeStyle = fieldColor(palette.entrance, 0.95);
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(target.x * tile - camX + 3, target.y * tile - camY + 3, tile - 6, tile - 6);
            ctx.setLineDash([]);
        }

        // 주인공 — 걸음마다 1px 흔들림(칸 번호 짝수/홀수)
        const hx = hero.x * tile - camX;
        const hy = hero.y * tile - camY - (field.pos % 2 === 0 ? 0 : 1);
        if (heroImage) {
            const s = tile * 1.25;
            ctx.save();
            if (facingLeft) {
                ctx.translate(hx + tile / 2, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(heroImage, -s / 2, hy + tile - s, s, s);
            } else {
                ctx.drawImage(heroImage, hx + tile / 2 - s / 2, hy + tile - s, s, s);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = fieldColor(palette.hero, 1);
            ctx.beginPath();
            ctx.arc(hx + tile / 2, hy + tile / 2, tile * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [size, palette, backdropSrc, biome, biomeColors, door, layout, field.pos, field.openedChests, revealed, heroImage, facingLeft, walkTarget]);

    // 누른 칸 — 밝혀진 칸(또는 보스 문)만 받는다. 안개 속 칸을 누르면 아무 일도 없다.
    const handleTap = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!onTileTap || event.button > 0 || size.width <= 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const { tile, camX, camY } = getFieldCamera(size.width, size.height, layout.width, field.pos);
        const x = Math.floor((event.clientX - rect.left + camX) / tile);
        const y = Math.floor((event.clientY - rect.top + camY) / tile);
        if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) return;
        const index = y * layout.width + x;
        if (layout.tiles[index] === '#' || (!revealed.has(index) && index !== door)) return;
        onTileTap(index);
    };

    const threshold = getFieldEncounterThreshold(player, layout.loc);
    const signal = getFieldDangerSignal(field.danger, threshold);
    const opened = layout.chests.filter((chest) => field.openedChests.includes(chest.id)).length;
    const locationName = getVisibleLocationName(player, player.loc) ?? '';
    // 2026-11 B1 P1: 지금 지역의 장 번호 — 필드 무대(FieldStage)와 같은 칩 · 같은 판정(길 잃은 여행이면 숨긴다).
    const chapter = blind ? null : getChapterOf(player.loc);
    const doorBoss = door !== null ? getAreaBossName(mapData) : null;

    // 2026-11 화면 B안: 방금의 기록은 지도 아래 한 줄 소식(기록 띠)이 보인다 — 지도 위에는 처음 들어선 순간 걷는 법 한 줄만 둔다.
    const showTapHint = Boolean(onTileTap) && field.visited.length <= 1 && !field.pending;
    const encounterFlash = field.pending?.kind === 'encounter' || field.pending?.kind === 'mimic';

    return (
        <section
            data-testid="field-map"
            data-field-pos={field.pos}
            data-field-target={walkTarget ?? undefined}
            data-field-danger={signal}
            data-field-chests={`${opened}/${layout.chests.length}`}
            data-field-biome={biome}
            data-field-door={door ?? undefined}
            aria-label={MSG.FIELD_STAGE_ARIA(locationName)}
            className={`ae-field-map relative h-full min-h-0 w-full overflow-hidden rounded-ae-lg${encounterFlash ? ' is-encounter' : ''}`}
        >
            {backdropSrc && (
                <img data-testid="field-map-backdrop" src={backdropSrc} alt="" aria-hidden="true" className="ae-field-map-backdrop" />
            )}
            <div ref={wrapRef} className="absolute inset-0">
                <canvas
                    ref={canvasRef}
                    data-testid="field-map-canvas"
                    role="img"
                    aria-label={MSG.FIELD_A11Y_MAP}
                    onPointerDown={handleTap}
                    className={`block h-full w-full${onTileTap ? ' cursor-pointer' : ''}`}
                />
            </div>
            <div className="ae-field-map-top">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                    <Chip tone="ether" data-testid="field-map-chests">{MSG.FIELD_CHESTS_LEFT(opened, layout.chests.length)}</Chip>
                    {doorBoss && (
                        <Chip tone="threat" data-testid="field-door-chip">{MSG.FIELD_DOOR_CHIP(doorBoss)}</Chip>
                    )}
                    {chapter !== null && (
                        <Chip data-testid="field-stage-chapter" className="font-fira tabular-nums">{MSG.FIELD_STAGE_CHAPTER_CHIP(chapter)}</Chip>
                    )}
                </div>
                <div data-testid="field-danger-orb" className="ae-field-orb" data-level={signal}>
                    <span className="ae-field-orb-ball" aria-hidden="true" />
                    <span className="aether-type-meta">{MSG.FIELD_DANGER_LABEL[signal]}</span>
                </div>
            </div>
            {showTapHint && (
                <p data-testid="field-map-tap-hint" className="ae-field-map-news aether-type-meta font-readable">
                    {MSG.FIELD_TAP_HINT}
                </p>
            )}
        </section>
    );
};

export default FieldMapView;
