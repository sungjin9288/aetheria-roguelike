import React from 'react';
import { getSignatureMetadata, hasDedicatedSignatureArt } from '../../data/signatureItems.js';

/**
 * 레전더리 아이템 상단-우측 ✦ 배지.
 *
 * 규칙:
 * - dedicated signature art(Tier S/A)가 있을 때만 렌더. tinted named 아이템은 스킵.
 * - 위치: top-right, 크기는 size에 비례 (최소 8px).
 * - 색: tone에 따라 gold/violet/crimson 등 미세 매핑.
 * - 접근성: aria-label로 tier + category 전달.
 */

const TONE_COLORS = Object.freeze({
    holy: { fill: '#f6e7a2', glow: 'rgba(246,231,162,0.6)', stroke: '#5a4620' },
    fire: { fill: '#ffb48a', glow: 'rgba(255,180,138,0.6)', stroke: '#6a2e16' },
    frost: { fill: '#cce8f5', glow: 'rgba(204,232,245,0.6)', stroke: '#29455a' },
    shadow: { fill: '#c7a4f0', glow: 'rgba(199,164,240,0.6)', stroke: '#2d2144' },
    arcane: { fill: '#c0b0e8', glow: 'rgba(192,176,232,0.6)', stroke: '#31245d' },
    nature: { fill: '#a8d0a0', glow: 'rgba(168,208,160,0.6)', stroke: '#2d4226' },
    earth: { fill: '#d8b878', glow: 'rgba(216,184,120,0.55)', stroke: '#4c3720' },
    steel: { fill: '#e6ecf4', glow: 'rgba(230,236,244,0.5)', stroke: '#334155' },
});

const DEFAULT_TONE_COLOR = TONE_COLORS.holy;

const SignatureBadge = ({ item, size = 10, className = '' }) => {
    if (!item || !hasDedicatedSignatureArt(item)) return null;
    const meta = getSignatureMetadata(item);
    const toneColor = TONE_COLORS[meta?.tone] || DEFAULT_TONE_COLOR;
    const label = `Signature · ${meta?.tier || 'legendary'} · ${meta?.category || ''}`;

    return (
        <div
            className={`pointer-events-none absolute ${className}`.trim()}
            style={{
                top: 2,
                right: 2,
                width: size,
                height: size,
                filter: `drop-shadow(0 0 3px ${toneColor.glow})`,
            }}
            aria-label={label}
            data-signature-badge="true"
            data-signature-tone={meta?.tone || 'holy'}
        >
            <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden="true">
                {/* 4-point star (sparkle) */}
                <path
                    d="M6 1 L7 5 L11 6 L7 7 L6 11 L5 7 L1 6 L5 5 Z"
                    fill={toneColor.fill}
                    stroke={toneColor.stroke}
                    strokeWidth="0.6"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};

export default SignatureBadge;
