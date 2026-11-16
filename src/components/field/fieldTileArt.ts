import { fieldColor, type FieldBiomePalette, type FieldMapPalette } from '../../utils/fieldMapPalette';
import type { FieldBiome } from '../../systems/fieldBiome';

/**
 * 2026-11 오버월드 3단계 — 바이옴 8종의 칸 그림(소유자 결정 2026-11-16 "숲처럼 코드로"). 칸 종류는 그대로이고 바탕색 · 무늬만
 * 바이옴마다 다르다. 무늬 자리는 칸 번호로 정한다(난수 없음 — 같은 칸은 언제나 같은 그림). 숲 무늬는 2단계 그대로다.
 */

export interface FieldTileArgs {
    ctx: CanvasRenderingContext2D;
    biome: FieldBiome;
    char: string;
    px: number;
    py: number;
    tile: number;
    index: number;
    base: FieldMapPalette;
    colors: FieldBiomePalette;
}

const SHALLOW_ALPHA = 0.32;
const DEEP_ALPHA = 0.45;

const fillBase = ({ ctx, char, px, py, tile, base, colors, biome }: FieldTileArgs): void => {
    ctx.fillStyle = char === '#' ? fieldColor(base.wall, 1)
        : char === ',' ? fieldColor(colors.shallow, SHALLOW_ALPHA)
            : char === ';' ? fieldColor(colors.deep, DEEP_ALPHA)
                : fieldColor(base.path, 1);
    ctx.fillRect(px, py, tile, tile);
    if (biome !== 'forest' && (char === '#' || char === '.')) {
        // 바이옴의 옅은 빛 — 벽 · 길도 지역마다 조금 다르게 보인다(숲은 2단계 그대로).
        ctx.fillStyle = fieldColor(colors.motif, char === '#' ? 0.07 : 0.05);
        ctx.fillRect(px, py, tile, tile);
    }
};

const drawEdges = ({ ctx, char, px, py, tile, base }: FieldTileArgs): void => {
    if (char === '#') {
        ctx.fillStyle = fieldColor(base.ink, 0.06);
        ctx.fillRect(px, py, tile, 3);
    } else if (char === '.') {
        ctx.strokeStyle = fieldColor(base.ink, 0.05);
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
    }
};

type PatternDrawer = (args: FieldTileArgs, alpha: number, offset: number) => void;

const PATTERNS: Readonly<Record<FieldBiome, PatternDrawer>> = {
    // 풀잎 두 줄기
    forest: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        ctx.fillStyle = fieldColor(colors.shallow, alpha);
        ctx.fillRect(px + 4 + ox, py + tile * 0.55, 2, tile * 0.25);
        ctx.fillRect(px + 9 + ox, py + tile * 0.45, 2, tile * 0.35);
    },
    // 물결 두 줄
    water: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        ctx.strokeStyle = fieldColor(colors.motif, alpha);
        ctx.lineWidth = 1.5;
        for (const row of [0.4, 0.68]) {
            ctx.beginPath();
            ctx.arc(px + 6 + ox, py + tile * row, 3, Math.PI, 0);
            ctx.arc(px + 12 + ox, py + tile * row, 3, Math.PI, 0, true);
            ctx.stroke();
        }
    },
    // 불씨 셋
    ember: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        ctx.fillStyle = fieldColor(colors.motif, alpha);
        ctx.fillRect(px + 4 + ox, py + tile * 0.62, 3, 3);
        ctx.fillRect(px + 10 + ox, py + tile * 0.38, 2, 2);
        ctx.fillRect(px + 7 + ox, py + tile * 0.78, 2, 2);
    },
    // 얼음 결정(작은 십자)
    frost: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        const cx = px + 8 + ox;
        const cy = py + tile * 0.55;
        ctx.strokeStyle = fieldColor(colors.motif, alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy);
        ctx.lineTo(cx + 4, cy);
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx, cy + 4);
        ctx.stroke();
    },
    // 구름 조각
    sky: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        ctx.fillStyle = fieldColor(colors.motif, alpha * 0.6);
        ctx.beginPath();
        ctx.arc(px + 6 + ox, py + tile * 0.6, 3, 0, Math.PI * 2);
        ctx.arc(px + 10 + ox, py + tile * 0.55, 4, 0, Math.PI * 2);
        ctx.arc(px + 14 + ox, py + tile * 0.62, 3, 0, Math.PI * 2);
        ctx.fill();
    },
    // 룬(마름모 테두리)
    arcane: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        const cx = px + 8 + ox;
        const cy = py + tile * 0.55;
        ctx.strokeStyle = fieldColor(colors.motif, alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx, cy + 5);
        ctx.lineTo(cx - 4, cy);
        ctx.closePath();
        ctx.stroke();
    },
    // 공허의 소용돌이(반원 둘)
    abyss: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        const cx = px + 8 + ox;
        const cy = py + tile * 0.55;
        ctx.strokeStyle = fieldColor(colors.motif, alpha * 0.7);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, Math.PI, Math.PI * 2.2);
        ctx.stroke();
    },
    // 돌 조각(작은 사각 둘)
    ruin: ({ ctx, px, py, tile, colors }, alpha, ox) => {
        ctx.strokeStyle = fieldColor(colors.motif, alpha);
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 3.5 + ox, py + tile * 0.5 + 0.5, 6, 4);
        ctx.strokeRect(px + 8.5 + ox, py + tile * 0.7 + 0.5, 5, 3);
    },
};

/** 칸 하나(바탕 · 가장자리 · 풀숲/깊은 곳 무늬) */
export const drawFieldTile = (args: FieldTileArgs): void => {
    fillBase(args);
    drawEdges(args);
    if (args.char === ',' || args.char === ';') {
        const offset = (args.index * 7) % (args.tile - 12);
        PATTERNS[args.biome](args, args.char === ';' ? 0.75 : 0.55, offset);
    }
};

/** 보스 문 — 위험 색 틀 + 아치(지도에서 한 칸, 밝혀지지 않아도 보인다) */
export const drawFieldDoor = (ctx: CanvasRenderingContext2D, px: number, py: number, tile: number, base: FieldMapPalette): void => {
    ctx.fillStyle = fieldColor(base.door, 0.28);
    ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
    ctx.strokeStyle = fieldColor(base.door, 0.95);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + tile * 0.25, py + tile * 0.85);
    ctx.lineTo(px + tile * 0.25, py + tile * 0.45);
    ctx.arc(px + tile / 2, py + tile * 0.45, tile * 0.25, Math.PI, 0);
    ctx.lineTo(px + tile * 0.75, py + tile * 0.85);
    ctx.stroke();
    ctx.fillStyle = fieldColor(base.ink, 0.9);
    ctx.fillRect(px + tile * 0.6, py + tile * 0.62, 2, 2);
};
