/**
 * 아바타 앵커 포인트 + wearable 배치 규칙 — 단일 진실 원천.
 *
 * 모든 수치는 AvatarEquipmentOverlay의 72×72 viewBox 기준.
 * adventurer.png (기준 아바타)를 측정해서 확정한 앵커이고,
 * 향후 wearable PNG를 재생성할 때 이 앵커에 grip/center가 오도록 정렬하면 offset은 0이 된다.
 *
 * 각 family placement는 raw transform 값을 가진다. 현재 visual output은 그대로 유지하면서,
 * "어느 앵커에 붙는지"가 코드에서 명시되게 하는 것이 1차 목표.
 */

// ──────────────────────────────────────────────────────────────────────────
// Anchor points (72×72 viewBox 좌표)
// ──────────────────────────────────────────────────────────────────────────
// cycle 363: shoulder_l / shoulder_r 2 anchors 제거 — placement 함수에서 anchor로 사용 0건.
//   AVATAR_ANCHORS 정의만 있고 placement 매핑 없음. 활성 anchor 7종 (head_top / head_center /
//   torso_center / back_anchor / hand_front / hand_back / feet)만 유지.
export const AVATAR_ANCHORS = Object.freeze({
    head_top: { x: 30, y: 18 },
    head_center: { x: 30, y: 25 },
    torso_center: { x: 34, y: 45 },
    back_anchor: { x: 34, y: 45 },
    hand_front: { x: 53, y: 46 },
    hand_back: { x: 23, y: 44 },
    feet: { x: 35, y: 54 },
});

// ──────────────────────────────────────────────────────────────────────────
// Layer 순서 (뒤→앞)
//   1. cloak (back half)          — back 레이어
//   2. back weapon (등에 멘 무기)  — back 레이어 (미사용, 확장용)
//   3. base body sprite
//   4. body armor / front cloak    — front 레이어
//   5. offhand (shield / book)     — front 레이어 (shield만 back도 허용)
//   6. main hand weapon            — front 레이어
//   7. headgear                    — front 레이어 (hood는 예외로 back)
// ──────────────────────────────────────────────────────────────────────────
export const BACK_LAYER_ARMOR_STYLES = Object.freeze(new Set(['cloak']));
export const BACK_LAYER_HEADGEAR_STYLES = Object.freeze(new Set(['hood-cloak']));
export const BACK_LAYER_OFFHAND_STYLES = Object.freeze(new Set([
    'shield',
    'tower-shield',
    'kite-shield',
    'buckler',
]));

// ──────────────────────────────────────────────────────────────────────────
// Transform helpers
//
// 현재 렌더링은 SVG `<image>` 요소 위에 `transform` 문자열을 씌우는 방식.
// placement 데이터에서 SVG transform 문자열을 생성한다.
// ──────────────────────────────────────────────────────────────────────────
const toTransformString = ({ translateX, translateY, rotate, rotateX, rotateY, scale }: any) => {
    const parts = [`translate(${translateX} ${translateY})`];
    if (rotate) {
        parts.push(`rotate(${rotate} ${rotateX ?? 0} ${rotateY ?? 0})`);
    }
    if (scale != null) {
        parts.push(`scale(${scale})`);
    }
    return parts.join(' ');
};

const placement = (anchor: any, layer: any, transform: any) => Object.freeze({ anchor, layer, transform: Object.freeze(transform) });

// ──────────────────────────────────────────────────────────────────────────
// Weapon placements (main hand / front hand)
// 모든 weapon은 `hand_front`에 rotate pivot (12, 12) scaled-space 기준으로 배치된다.
// 값은 기존 getWeaponTransform()에서 일관되게 추출한 것 — visual output 동일.
// ──────────────────────────────────────────────────────────────────────────
// cycle 312: export 제거 — getWeaponPlacement / DEFAULT_WEAPON_PLACEMENT 내부 사용만, 외부 0건.
const WEAPON_PLACEMENTS: Record<string, any> = Object.freeze({
    sword: placement('hand_front', 'front', { translateX: 41, translateY: 34, rotate: 10, rotateX: 12, rotateY: 12, scale: 0.26 }),
    rapier: placement('hand_front', 'front', { translateX: 40, translateY: 34, rotate: 12, rotateX: 12, rotateY: 12, scale: 0.27 }),
    saber: placement('hand_front', 'front', { translateX: 40, translateY: 34, rotate: 12, rotateX: 12, rotateY: 12, scale: 0.27 }),
    falchion: placement('hand_front', 'front', { translateX: 40, translateY: 34, rotate: 12, rotateX: 12, rotateY: 12, scale: 0.27 }),
    fork: placement('hand_front', 'front', { translateX: 40, translateY: 34, rotate: 12, rotateX: 12, rotateY: 12, scale: 0.27 }),

    dagger: placement('hand_front', 'front', { translateX: 41, translateY: 35, rotate: 18, rotateX: 12, rotateY: 12, scale: 0.23 }),
    'fang-dagger': placement('hand_front', 'front', { translateX: 41, translateY: 35, rotate: 18, rotateX: 12, rotateY: 12, scale: 0.23 }),
    'throwing-blade': placement('hand_front', 'front', { translateX: 41, translateY: 35, rotate: 18, rotateX: 12, rotateY: 12, scale: 0.23 }),
    twinblade: placement('hand_front', 'front', { translateX: 41, translateY: 35, rotate: 18, rotateX: 12, rotateY: 12, scale: 0.23 }),

    greatsword: placement('hand_front', 'front', { translateX: 34, translateY: 23, rotate: -18, rotateX: 12, rotateY: 12, scale: 0.41 }),
    greataxe: placement('hand_front', 'front', { translateX: 34, translateY: 24, rotate: -14, rotateX: 12, rotateY: 12, scale: 0.41 }),

    axe: placement('hand_front', 'front', { translateX: 36, translateY: 29, rotate: 10, rotateX: 12, rotateY: 12, scale: 0.34 }),
    hammer: placement('hand_front', 'front', { translateX: 36, translateY: 29, rotate: 10, rotateX: 12, rotateY: 12, scale: 0.34 }),
    mace: placement('hand_front', 'front', { translateX: 36, translateY: 29, rotate: 10, rotateX: 12, rotateY: 12, scale: 0.34 }),

    bow: placement('hand_front', 'front', { translateX: 34, translateY: 22, rotate: -10, rotateX: 12, rotateY: 12, scale: 0.39 }),
    longbow: placement('hand_front', 'front', { translateX: 34, translateY: 22, rotate: -10, rotateX: 12, rotateY: 12, scale: 0.39 }),

    staff: placement('hand_front', 'front', { translateX: 35, translateY: 20, rotate: -16, rotateX: 12, rotateY: 12, scale: 0.39 }),
    rod: placement('hand_front', 'front', { translateX: 35, translateY: 20, rotate: -16, rotateX: 12, rotateY: 12, scale: 0.39 }),
    wand: placement('hand_front', 'front', { translateX: 40, translateY: 34, rotate: 18, rotateX: 12, rotateY: 12, scale: 0.27 }),

    spear: placement('hand_front', 'front', { translateX: 35, translateY: 20, rotate: -22, rotateX: 12, rotateY: 12, scale: 0.42 }),
    lance: placement('hand_front', 'front', { translateX: 35, translateY: 20, rotate: -22, rotateX: 12, rotateY: 12, scale: 0.42 }),
    scythe: placement('hand_front', 'front', { translateX: 35, translateY: 20, rotate: -24, rotateX: 12, rotateY: 12, scale: 0.4 }),

    whip: placement('hand_front', 'front', { translateX: 40, translateY: 35, rotate: 10, rotateX: 12, rotateY: 12, scale: 0.31 }),
});

const DEFAULT_WEAPON_PLACEMENT = WEAPON_PLACEMENTS.sword;

// ──────────────────────────────────────────────────────────────────────────
// Offhand placements (back hand)
// ──────────────────────────────────────────────────────────────────────────
// cycle 312: export 제거 — getOffhandPlacement 내부 사용만, 외부 0건.
const OFFHAND_PLACEMENTS: Record<string, any> = Object.freeze({
    shield: placement('hand_back', 'back', { translateX: 11, translateY: 32, rotate: -12, rotateX: 12, rotateY: 12, scale: 0.27 }),
    'tower-shield': placement('hand_back', 'back', { translateX: 11, translateY: 31, rotate: -6, rotateX: 12, rotateY: 12, scale: 0.33 }),
    'kite-shield': placement('hand_back', 'back', { translateX: 11, translateY: 31, rotate: -6, rotateX: 12, rotateY: 12, scale: 0.33 }),
    buckler: placement('hand_back', 'back', { translateX: 13, translateY: 33, rotate: -6, rotateX: 12, rotateY: 12, scale: 0.27 }),

    grimoire: placement('hand_back', 'front', { translateX: 13, translateY: 35, rotate: -10, rotateX: 12, rotateY: 12, scale: 0.23 }),
    tome: placement('hand_back', 'front', { translateX: 13, translateY: 35, rotate: -10, rotateX: 12, rotateY: 12, scale: 0.23 }),
    tablet: placement('hand_back', 'front', { translateX: 12, translateY: 34, rotate: -8, rotateX: 12, rotateY: 12, scale: 0.24 }),
    scroll: placement('hand_back', 'front', { translateX: 13, translateY: 35, rotate: -16, rotateX: 12, rotateY: 12, scale: 0.23 }),

    bow: placement('hand_back', 'front', { translateX: 6, translateY: 19, rotate: -2, rotateX: 12, rotateY: 12, scale: 0.33 }),
    longbow: placement('hand_back', 'front', { translateX: 6, translateY: 19, rotate: -2, rotateX: 12, rotateY: 12, scale: 0.33 }),
    staff: placement('hand_back', 'front', { translateX: 11, translateY: 20, rotate: -24, rotateX: 12, rotateY: 12, scale: 0.34 }),
    rod: placement('hand_back', 'front', { translateX: 11, translateY: 20, rotate: -24, rotateX: 12, rotateY: 12, scale: 0.34 }),
    wand: placement('hand_back', 'front', { translateX: 12, translateY: 31, rotate: -22, rotateX: 12, rotateY: 12, scale: 0.24 }),

    greatsword: placement('hand_back', 'front', { translateX: 9, translateY: 20, rotate: -30, rotateX: 12, rotateY: 12, scale: 0.35 }),
    greataxe: placement('hand_back', 'front', { translateX: 9, translateY: 20, rotate: -30, rotateX: 12, rotateY: 12, scale: 0.35 }),
    lance: placement('hand_back', 'front', { translateX: 9, translateY: 20, rotate: -30, rotateX: 12, rotateY: 12, scale: 0.35 }),
    spear: placement('hand_back', 'front', { translateX: 9, translateY: 20, rotate: -30, rotateX: 12, rotateY: 12, scale: 0.35 }),
    scythe: placement('hand_back', 'front', { translateX: 9, translateY: 20, rotate: -30, rotateX: 12, rotateY: 12, scale: 0.35 }),

    axe: placement('hand_back', 'front', { translateX: 11, translateY: 30, rotate: -16, rotateX: 12, rotateY: 12, scale: 0.3 }),
    hammer: placement('hand_back', 'front', { translateX: 11, translateY: 30, rotate: -16, rotateX: 12, rotateY: 12, scale: 0.3 }),
    mace: placement('hand_back', 'front', { translateX: 11, translateY: 30, rotate: -16, rotateX: 12, rotateY: 12, scale: 0.3 }),

    dagger: placement('hand_back', 'front', { translateX: 11, translateY: 35, rotate: -20, rotateX: 12, rotateY: 12, scale: 0.24 }),
    'fang-dagger': placement('hand_back', 'front', { translateX: 11, translateY: 35, rotate: -20, rotateX: 12, rotateY: 12, scale: 0.24 }),
    'throwing-blade': placement('hand_back', 'front', { translateX: 11, translateY: 35, rotate: -20, rotateX: 12, rotateY: 12, scale: 0.24 }),
    twinblade: placement('hand_back', 'front', { translateX: 11, translateY: 35, rotate: -20, rotateX: 12, rotateY: 12, scale: 0.24 }),

    rapier: placement('hand_back', 'front', { translateX: 11, translateY: 33, rotate: -14, rotateX: 12, rotateY: 12, scale: 0.27 }),
    saber: placement('hand_back', 'front', { translateX: 11, translateY: 33, rotate: -14, rotateX: 12, rotateY: 12, scale: 0.27 }),
    falchion: placement('hand_back', 'front', { translateX: 11, translateY: 33, rotate: -14, rotateX: 12, rotateY: 12, scale: 0.27 }),
    fork: placement('hand_back', 'front', { translateX: 11, translateY: 33, rotate: -14, rotateX: 12, rotateY: 12, scale: 0.27 }),

    sword: placement('hand_back', 'front', { translateX: 11, translateY: 32, rotate: -12, rotateX: 12, rotateY: 12, scale: 0.27 }),
});

const DEFAULT_OFFHAND_PLACEMENT = placement('hand_back', 'back', {
    translateX: 10, translateY: 31, rotate: -6, rotateX: 12, rotateY: 12, scale: 0.35,
});

// ──────────────────────────────────────────────────────────────────────────
// Headgear placements (head top / center)
// rotate 없이 translate + scale만 사용 (sprite center 기준 배치)
// ──────────────────────────────────────────────────────────────────────────
// cycle 408: export 제거 — getHeadgearPlacement 내부 사용만, 외부 0건.
//   cycle 312 WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private downgrade paired completion.
const HEADGEAR_PLACEMENTS: Record<string, any> = Object.freeze({
    'straw-hat': placement('head_top', 'front', { translateX: 12, translateY: 6, scale: 0.48 }),
    'wizard-hat': placement('head_top', 'front', { translateX: 10, translateY: 1, scale: 0.56 }),
    circlet: placement('head_center', 'front', { translateX: 15, translateY: 10, scale: 0.42 }),
    mask: placement('head_center', 'front', { translateX: 15, translateY: 13, scale: 0.38 }),
    hood: placement('head_top', 'front', { translateX: 10, translateY: 6, scale: 0.56 }),
    'hood-cloak': placement('head_top', 'back', { translateX: 9, translateY: 5, scale: 0.58 }),
    helm: placement('head_top', 'front', { translateX: 10, translateY: 7, scale: 0.56 }),
    cap: placement('head_top', 'front', { translateX: 12, translateY: 8, scale: 0.46 }),
});

const DEFAULT_HEADGEAR_PLACEMENT = placement('head_top', 'front', { translateX: 10, translateY: 4, scale: 0.66 });

// ──────────────────────────────────────────────────────────────────────────
// Body armor placements
// ──────────────────────────────────────────────────────────────────────────
// cycle 408: export 제거 — getBodyPlacement 내부 사용만, 외부 0건.
//   cycle 312 paired completion.
const BODY_PLACEMENTS: Record<string, any> = Object.freeze({
    robe: placement('torso_center', 'front', { translateX: 8, translateY: 19, scale: 0.72 }),
    plate: placement('torso_center', 'front', { translateX: 8, translateY: 20, scale: 0.7 }),
    leather: placement('torso_center', 'front', { translateX: 9, translateY: 20, scale: 0.68 }),
    cloak: placement('back_anchor', 'back', { translateX: 7, translateY: 18, scale: 0.74 }),
    tunic: placement('torso_center', 'front', { translateX: 9, translateY: 20, scale: 0.68 }),
    boots: placement('feet', 'front', { translateX: 14, translateY: 33, scale: 0.58 }),
});

const DEFAULT_BODY_PLACEMENT = placement('torso_center', 'front', { translateX: 7, translateY: 18, scale: 0.8 });

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

export const getWeaponPlacement = (style: any) => WEAPON_PLACEMENTS[style] || DEFAULT_WEAPON_PLACEMENT;

export const getOffhandPlacement = (style: any) => OFFHAND_PLACEMENTS[style] || DEFAULT_OFFHAND_PLACEMENT;

export const getHeadgearPlacement = (style: any) => {
    if (!style || style === 'none') return null;
    return HEADGEAR_PLACEMENTS[style] || DEFAULT_HEADGEAR_PLACEMENT;
};

export const getBodyPlacement = (style: any) => {
    if (!style || style === 'none') return null;
    return BODY_PLACEMENTS[style] || DEFAULT_BODY_PLACEMENT;
};

/**
 * 장비 art profile로부터 최종 armor placement 결정.
 * - headgear-only 장비는 headgear placement
 * - body 장비는 body placement (headgear도 있을 경우 별도로 합성)
 */
export const getArmorPlacement = (armorArt: any) => {
    if (!armorArt) return null;
    if (armorArt.isHeadgearOnly && armorArt.headgearStyle && armorArt.headgearStyle !== 'none') {
        return getHeadgearPlacement(armorArt.headgearStyle);
    }
    if (armorArt.bodyStyle && armorArt.bodyStyle !== 'none') {
        return getBodyPlacement(armorArt.bodyStyle);
    }
    if (armorArt.headgearStyle && armorArt.headgearStyle !== 'none') {
        return getHeadgearPlacement(armorArt.headgearStyle);
    }
    return null;
};

export const placementToTransform = (plc: any) => (plc ? toTransformString(plc.transform) : null);

export const placementLayer = (plc: any) => (plc && plc.layer === 'back' ? 'back' : 'front');
