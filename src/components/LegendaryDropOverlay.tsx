import { useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import ItemIcon from './icons/ItemIcon.jsx';
import { getSignatureMetadata } from '../data/signatureItems.js';
import { MSG } from '../data/messages';
import type { Item } from '../types/index.js';
import { MOMENT_DUR_PANEL, MOMENT_DUR_UI, MOMENT_EASE } from './moments/momentMotion';

/**
 * LegendaryDropOverlay — dedicated signature 아이템을 획득한 순간
 * 풀스크린 오버레이로 "와" 모먼트를 연출한다.
 *
 * - framer-motion + SIGNATURE_TONE 글로우로 tone별 색 연출(토큰 색 채널), 패널은 전설 산호색 장식 패널
 * - 3초 auto-dismiss
 * - 탭/클릭 시 즉시 dismiss
 * - 2026-10-26 소유자 결정 D24(감사 A11Y-01): 대화상자가 아니라 **초점을 옮기지 않는 상태 알림**이다 — 저절로 닫히는 화면이
 *   초점을 가져갔다 돌려주면 키보드 · 화면 낭독기 사용자의 자리가 3초마다 흔들린다. 알림 칸(role="status", aria-live polite)은
 *   늘 그려 두고 전설이 뜰 때 문장만 바꾼다(나타나는 순간 생긴 알림 칸은 낭독되지 않는 일이 많다). 그림 연출은 화면 낭독기에서
 *   숨기고(같은 내용을 알림 칸이 말한다) 초점 · 배경 `inert` · Escape를 잡지 않는다
 * - 아이콘은 실제 signature sprite (gold ring + badge 포함)을 그대로 사용
 * - 머리말은 `MSG.SIGNATURE_DROP_LABEL`(전설 각인), 아래 줄은 아이템 설명(Wave 134)
 */

// cycle 358: steel 톤 제거 — signatureRegistry.json / signatureSets.json 어디에도
//   tone='steel' 엔트리 0건이라 unreachable. holy / fire / frost / shadow / arcane /
//   nature / earth / rust 8종만 활성. fallback은 DEFAULT_GLOW (= TONE_GLOW.holy).
// 2026-10 화면 디자인 3차: 원소 빛은 hex가 아니라 디자인 토큰의 색 채널(`rgb(<채널> / 투명도)`)이다.
const TONE_GLOW: Record<string, string> = Object.freeze({
    holy: 'var(--aether-gold-hi-rgb)',
    fire: 'var(--aether-rarity-legendary-rgb)',
    frost: 'var(--aether-will-rgb)',
    shadow: 'var(--aether-exp-rgb)',
    arcane: 'var(--aether-rarity-rare-rgb)',
    nature: 'var(--aether-good-rgb)',
    earth: 'var(--aether-gold-text-rgb)',
    rust: 'var(--aether-gold-lo-rgb)',
});

const DEFAULT_GLOW = TONE_GLOW.holy;

const DROP_DURATION_MS = 3000;
const PARTICLE_COUNT = 12;
const PARTICLE_RADIUS_PX = 110;

interface LegendaryDropOverlayProps {
    item?: Item | null;
    onDismiss?: () => void;
}

const LegendaryDropOverlay = ({ item, onDismiss }: LegendaryDropOverlayProps) => {
    useEffect(() => {
        if (!item) return undefined;
        const timer = setTimeout(() => onDismiss?.(), DROP_DURATION_MS);
        return () => clearTimeout(timer);
    }, [item, onDismiss]);

    const meta = item ? getSignatureMetadata(item) : null;
    const glow = TONE_GLOW[meta?.tone ?? ''] || DEFAULT_GLOW;
    const glowColor = (alpha: number) => `rgb(${glow} / ${alpha})`;

    return (
        <>
        <div data-testid="legendary-drop-status" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {item ? MSG.A11Y_LEGENDARY_STATUS(item.name ?? '', item.desc) : ''}
        </div>
        <AnimatePresence>
            {item && (
                <Motion.div
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: MOMENT_DUR_UI, ease: MOMENT_EASE }}
                    className="ae-moment-legendary-backdrop fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-auto"
                    onClick={onDismiss}
                    data-testid="legendary-drop-overlay"
                    data-legendary-drop={item.name}
                >
                    {/* 배경 원소 빛 — 한 번 퍼지고 사라진다 */}
                    <Motion.div
                        aria-hidden="true"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: [0, 0.65, 0.35, 0], scale: [0.7, 1.2, 1.4, 1.6] }}
                        transition={{ duration: 2.4, ease: 'easeOut' }}
                        className="absolute h-80 w-80 rounded-full blur-3xl"
                        style={{ background: `radial-gradient(circle, ${glowColor(0.35)}, transparent 72%)` }}
                    />

                    {/* 12방향 불꽃 — 단발 */}
                    {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
                        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
                        const dx = Math.cos(angle) * PARTICLE_RADIUS_PX;
                        const dy = Math.sin(angle) * PARTICLE_RADIUS_PX;
                        return (
                            <Motion.div
                                key={i}
                                aria-hidden="true"
                                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                                animate={{ opacity: [0, 1, 0], x: [0, dx], y: [0, dy], scale: [0, 1.4, 0] }}
                                transition={{ duration: 1.4, delay: 0.18 + i * 0.04, ease: 'easeOut' }}
                                className="absolute h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: glowColor(1), boxShadow: `0 0 8px ${glowColor(0.6)}` }}
                            />
                        );
                    })}

                    {/* 감사 VD-09 · VD-14: 전설 획득은 이 화면의 장식 패널 하나 — 전설 등급은 산호색이다(위험 장미색 아님) */}
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.92, 1, 1, 0.98], y: [16, 0, 0, -6] }}
                        // 여러 키프레임에 3차 곡선 배열을 주면 구간별 곡선 목록으로 읽혀 일찍 사라진다 — 기본 곡선을 쓴다.
                        transition={{ duration: DROP_DURATION_MS / 1000, times: [0, 0.12, 0.84, 1] }}
                        className="ae-ornate ae-moment-ornate-legendary relative flex w-full max-w-[20rem] flex-col items-center gap-2.5 px-6 pb-6 pt-5 text-center lg:max-w-[24rem]"
                    >
                        <div className="flex items-center gap-1.5 font-readable text-[12px] font-bold text-ae-rarity-legendary">
                            <Sparkles size={14} aria-hidden="true" />
                            {MSG.SIGNATURE_DROP_LABEL}
                        </div>

                        <Motion.div
                            initial={{ scale: 0.6 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: MOMENT_DUR_PANEL, ease: MOMENT_EASE, delay: 0.08 }}
                            style={{ filter: `drop-shadow(0 0 14px ${glowColor(0.45)})` }}
                        >
                            <ItemIcon item={item} size={96} showBorder />
                        </Motion.div>

                        <div className="break-keep font-display text-[22px] font-extrabold leading-tight text-ae-ink">
                            {item.name}
                        </div>
                        {/* 2026-10 Wave 134(원장 §147): 레지스트리의 artNote는 그림 생성 지시문("plate · 가시 숄더 + 혼돈 Z-crack")이라
                            그리지 않고, 아이템의 설명을 그린다. */}
                        {item.desc && (
                            <div data-testid="legendary-drop-desc" className="break-keep font-readable text-[12px] leading-relaxed text-ae-ink-2">
                                {item.desc}
                            </div>
                        )}
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
        </>
    );
};

export default LegendaryDropOverlay;
