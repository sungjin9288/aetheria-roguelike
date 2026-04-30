import React from 'react';
import { getEquipmentOverlayAssetSrc } from '../../utils/itemVisuals.js';
import { getEquipmentTintFilter } from '../../utils/equipmentTint.js';
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

const resolveOffhandLayer = (appearance: any) => {
    const style = appearance?.offhand?.art?.style || appearance?.offhand?.visual || 'none';
    const placement = getOffhandPlacement(style);
    // BACK_LAYER_OFFHAND_STYLES로 일차 결정, 없으면 placement.layer 참조
    if (BACK_LAYER_OFFHAND_STYLES.has(style)) return 'back';
    return placementLayer(placement);
};

const resolveArmorLayer = (appearance: any) => {
    const bodyStyle = appearance?.armor?.art?.bodyStyle || 'none';
    const headgearStyle = appearance?.armor?.art?.headgearStyle || 'none';
    if (BACK_LAYER_ARMOR_STYLES.has(bodyStyle)) return 'back';
    if (BACK_LAYER_HEADGEAR_STYLES.has(headgearStyle)) return 'back';
    return 'front';
};

const AvatarEquipmentOverlay = ({ appearance, className = '', dataTestId = null, layer = 'front' }: any) => {
    const offhandOverlaySrc = getEquipmentOverlayAssetSrc(appearance?.offhand?.item);
    const weaponOverlaySrc = getEquipmentOverlayAssetSrc(appearance?.weapon?.item);
    const armorOverlaySrc = getEquipmentOverlayAssetSrc(appearance?.armor?.item);
    // 비-시그니처 아이템에 per-item 색감 차별화 (cycle 33). 시그니처는 자체 PNG에 색이 들어있어 null 반환.
    const offhandTint = getEquipmentTintFilter(appearance?.offhand?.item);
    const weaponTint = getEquipmentTintFilter(appearance?.weapon?.item);
    const armorTint = getEquipmentTintFilter(appearance?.armor?.item);

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
                        style={armorTint ? { filter: armorTint } : undefined}
                    />
                )}
                {shouldRenderOffhand && (
                    <image
                        href={offhandOverlaySrc || undefined}
                        x="0"
                        y="0"
                        width={OVERLAY_VIEWBOX}
                        height={OVERLAY_VIEWBOX}
                        preserveAspectRatio="xMidYMid meet"
                        transform={offhandTransform || undefined}
                        style={offhandTint ? { filter: offhandTint } : undefined}
                    />
                )}
                {shouldRenderWeapon && (
                    <image
                        href={weaponOverlaySrc || undefined}
                        x="0"
                        y="0"
                        width={OVERLAY_VIEWBOX}
                        height={OVERLAY_VIEWBOX}
                        preserveAspectRatio="xMidYMid meet"
                        transform={weaponTransform || undefined}
                        style={weaponTint ? { filter: weaponTint } : undefined}
                    />
                )}
            </svg>
        </div>
    );
};

export default AvatarEquipmentOverlay;
