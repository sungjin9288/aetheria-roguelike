import React from 'react';
import { getEquipmentOverlayAssetSrc } from '../../utils/itemVisuals.js';
import {
    BACK_LAYER_ARMOR_STYLES,
    BACK_LAYER_HEADGEAR_STYLES,
    BACK_LAYER_OFFHAND_STYLES,
    getArmorPlacement,
    getOffhandPlacement,
    getWeaponPlacement,
    placementLayer,
    placementToTransform,
} from '../../utils/anchorPoints.js';

/**
 * Layer 순서 (뒤→앞):
 *   back:  cloak / hood-cloak / shield (뒷손)
 *   front: base sprite → body armor → offhand focus → main weapon → headgear
 */

const OVERLAY_VIEWBOX = 72;

const resolveOffhandLayer = (appearance) => {
    const style = appearance?.offhand?.art?.style || appearance?.offhand?.visual || 'none';
    const placement = getOffhandPlacement(style);
    // BACK_LAYER_OFFHAND_STYLES로 일차 결정, 없으면 placement.layer 참조
    if (BACK_LAYER_OFFHAND_STYLES.has(style)) return 'back';
    return placementLayer(placement);
};

const resolveArmorLayer = (appearance) => {
    const bodyStyle = appearance?.armor?.art?.bodyStyle || 'none';
    const headgearStyle = appearance?.armor?.art?.headgearStyle || 'none';
    if (BACK_LAYER_ARMOR_STYLES.has(bodyStyle)) return 'back';
    if (BACK_LAYER_HEADGEAR_STYLES.has(headgearStyle)) return 'back';
    return 'front';
};

const AvatarEquipmentOverlay = ({ appearance, className = '', dataTestId = null, layer = 'front' }) => {
    const offhandOverlaySrc = getEquipmentOverlayAssetSrc(appearance?.offhand?.item);
    const weaponOverlaySrc = getEquipmentOverlayAssetSrc(appearance?.weapon?.item);
    const armorOverlaySrc = getEquipmentOverlayAssetSrc(appearance?.armor?.item);

    const weaponStyle = appearance?.weapon?.art?.style || appearance?.weapon?.visual || 'none';
    const offhandStyle = appearance?.offhand?.art?.style || appearance?.offhand?.visual || 'none';

    const offhandLayer = resolveOffhandLayer(appearance);
    const armorLayer = resolveArmorLayer(appearance);

    const shouldRenderOffhand = offhandOverlaySrc && offhandLayer === layer;
    const shouldRenderArmor = armorOverlaySrc && armorLayer === layer;
    // weapon은 항상 front 레이어 (현재는 등에 메는 back 모드 미구현)
    const shouldRenderWeapon = layer === 'front' && weaponOverlaySrc;

    if (!shouldRenderOffhand && !shouldRenderWeapon && !shouldRenderArmor) {
        return null;
    }

    const weaponTransform = placementToTransform(getWeaponPlacement(weaponStyle));
    const offhandTransform = placementToTransform(getOffhandPlacement(offhandStyle));
    const armorTransform = placementToTransform(getArmorPlacement(appearance?.armor?.art));

    return (
        <div
            aria-hidden="true"
            data-testid={dataTestId}
            className={`pointer-events-none absolute inset-0 h-full w-full ${className}`.trim()}
        >
            <svg
                aria-hidden="true"
                viewBox={`0 0 ${OVERLAY_VIEWBOX} ${OVERLAY_VIEWBOX}`}
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
            >
                {shouldRenderArmor && (
                    <image
                        href={armorOverlaySrc}
                        x="0"
                        y="0"
                        width={OVERLAY_VIEWBOX}
                        height={OVERLAY_VIEWBOX}
                        preserveAspectRatio="xMidYMid meet"
                        transform={armorTransform || undefined}
                    />
                )}
                {shouldRenderOffhand && (
                    <image
                        href={offhandOverlaySrc}
                        x="0"
                        y="0"
                        width={OVERLAY_VIEWBOX}
                        height={OVERLAY_VIEWBOX}
                        preserveAspectRatio="xMidYMid meet"
                        transform={offhandTransform}
                    />
                )}
                {shouldRenderWeapon && (
                    <image
                        href={weaponOverlaySrc}
                        x="0"
                        y="0"
                        width={OVERLAY_VIEWBOX}
                        height={OVERLAY_VIEWBOX}
                        preserveAspectRatio="xMidYMid meet"
                        transform={weaponTransform}
                    />
                )}
            </svg>
        </div>
    );
};

export default AvatarEquipmentOverlay;
