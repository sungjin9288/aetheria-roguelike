import { useEffect, useMemo, useRef, useState } from 'react';
import Chip from '../ui/Chip';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { toCoord } from '../../systems/fieldMapGen';
import { getFieldDangerSignal, getFieldEncounterThreshold, getFieldRevealed } from '../../systems/fieldMapWalk';
import { deriveCharacterAppearance } from '../../utils/characterAppearance';
import { getAvatarSpriteCandidates } from '../../utils/avatarSpriteCandidates';
import { getVisibleLocationName } from '../../utils/challengeRules';
import { selectFieldNews } from '../../utils/fieldStage';
import { fieldColor, readFieldMapPalette } from '../../utils/fieldMapPalette';
import type { FieldMapLayout, FieldMapState } from '../../types/fieldMap';
import type { Player } from '../../types/index.js';
import type { LogEntry } from '../../types/session.js';

/**
 * 지역 지도(2026-11 지역 지도 걷기, 설계 §8) — `<canvas>` 하나(칸 · 상자 · 출구 · 주인공)와 React 덧씌움(위험 구슬 · 상자 수 ·
 * 한 줄 소식). 표시만 한다 — 걷기 · 판정은 리듀서가 소유한다. 색은 디자인 토큰(`--aether-*-rgb`)을 읽는다.
 */

interface FieldMapViewProps {
    player: Player;
    field: FieldMapState;
    layout: FieldMapLayout;
    logs: readonly LogEntry[];
}

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

const FieldMapView = ({ player, field, layout, logs }: FieldMapViewProps) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const palette = useMemo(() => readFieldMapPalette(), []);
    const heroSrc = useMemo(() => getAvatarSpriteCandidates(deriveCharacterAppearance(player))[0], [player]);
    const heroImage = useHeroImage(heroSrc);

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
        ctx.fillStyle = fieldColor(palette.bg, 1);
        ctx.fillRect(0, 0, size.width, size.height);

        const tile = BALANCE.FIELD_TILE_PX;
        const hero = toCoord(layout.width, field.pos);
        // 카메라는 언제나 주인공을 가운데에 둔다 — 가장자리에서 멈추면 주인공이 위 · 아래 덧씌움(상자 수 · 한 줄 소식) 밑에 숨는다.
        const camX = hero.x * tile + tile / 2 - size.width / 2;
        const camY = hero.y * tile + tile / 2 - size.height / 2;
        const exits = new Map(layout.exits.map((exit) => [exit.index, exit]));
        const chests = new Map(layout.chests.map((chest) => [chest.index, chest]));
        const x0 = Math.max(0, Math.floor(camX / tile));
        const y0 = Math.max(0, Math.floor(camY / tile));
        const x1 = Math.min(layout.width - 1, Math.ceil((camX + size.width) / tile));
        const y1 = Math.min(layout.height - 1, Math.ceil((camY + size.height) / tile));

        for (let y = y0; y <= y1; y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                const index = y * layout.width + x;
                if (!revealed.has(index)) continue;
                const px = x * tile - camX;
                const py = y * tile - camY;
                const char = layout.tiles[index];
                ctx.fillStyle = char === '#' ? fieldColor(palette.wall, 1)
                    : char === ',' ? fieldColor(palette.grass, 0.32)
                        : char === ';' ? fieldColor(palette.deep, 0.45)
                            : fieldColor(palette.path, 1);
                ctx.fillRect(px, py, tile, tile);
                if (char === '#') {
                    // 벽 — 위쪽 가장자리만 밝혀 길과 갈라 보이게 한다.
                    ctx.fillStyle = fieldColor(palette.ink, 0.06);
                    ctx.fillRect(px, py, tile, 3);
                } else if (char === '.') {
                    ctx.strokeStyle = fieldColor(palette.ink, 0.05);
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
                }
                if (char === ',' || char === ';') {
                    // 풀숲 무늬 — 칸 번호로 정한 고정 자리(난수 없음)
                    ctx.fillStyle = fieldColor(palette.grass, char === ';' ? 0.75 : 0.55);
                    const ox = (index * 7) % (tile - 12);
                    ctx.fillRect(px + 4 + ox, py + tile * 0.55, 2, tile * 0.25);
                    ctx.fillRect(px + 9 + ox, py + tile * 0.45, 2, tile * 0.35);
                }
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
    }, [size, palette, layout, field.pos, field.openedChests, revealed, heroImage, facingLeft]);

    const threshold = getFieldEncounterThreshold(player, layout.loc);
    const signal = getFieldDangerSignal(field.danger, threshold);
    const opened = layout.chests.filter((chest) => field.openedChests.includes(chest.id)).length;
    const locationName = getVisibleLocationName(player, player.loc) ?? '';

    // 지도가 선 순간 뒤의 기록 한 줄 — 아무 일 없음 · 작은 발견 · 상자는 화면을 바꾸지 않고 여기서 보인다.
    const [floorId] = useState<string | null>(() => (logs.length > 0 ? logs[logs.length - 1].id : null));
    const news = selectFieldNews(logs, floorId);
    const encounterFlash = field.pending?.kind === 'encounter' || field.pending?.kind === 'mimic';

    return (
        <section
            data-testid="field-map"
            data-field-pos={field.pos}
            data-field-danger={signal}
            data-field-chests={`${opened}/${layout.chests.length}`}
            aria-label={MSG.FIELD_STAGE_ARIA(locationName)}
            className={`ae-field-map relative h-full min-h-0 w-full overflow-hidden rounded-ae-lg${encounterFlash ? ' is-encounter' : ''}`}
        >
            <div ref={wrapRef} className="absolute inset-0">
                <canvas ref={canvasRef} role="img" aria-label={MSG.FIELD_A11Y_MAP} className="block h-full w-full" />
            </div>
            <div className="ae-field-map-top">
                <Chip tone="ether" data-testid="field-map-chests">{MSG.FIELD_CHESTS_LEFT(opened, layout.chests.length)}</Chip>
                <div data-testid="field-danger-orb" className="ae-field-orb" data-level={signal}>
                    <span className="ae-field-orb-ball" aria-hidden="true" />
                    <span className="aether-type-meta">{MSG.FIELD_DANGER_LABEL[signal]}</span>
                </div>
            </div>
            {news && (
                <p key={news.id} data-testid="field-map-news" className="ae-field-map-news aether-type-meta font-readable">
                    {news.text}
                </p>
            )}
        </section>
    );
};

export default FieldMapView;
