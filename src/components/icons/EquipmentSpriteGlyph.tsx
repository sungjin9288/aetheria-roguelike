// @ts-nocheck — TODO: cycle 58+ migration (JSDoc 기반 props 보존)
import React from 'react';
import { getEquipmentArtProfile } from '../../utils/equipmentArt.js';

const Block = ({ x, y, w, h, fill, opacity = 1 }) => (
    <rect x={x} y={y} width={w} height={h} fill={fill} opacity={opacity} shapeRendering="crispEdges" />
);

const Poly = ({ points, fill, opacity = 1 }) => (
    <polygon
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill={fill}
        opacity={opacity}
        shapeRendering="crispEdges"
    />
);

const shadowize = (hex, factor = 0.36) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#241d1a';
    const parts = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((entry) => Number.parseInt(entry, 16));
    return `#${parts.map((value) => Math.max(0, Math.min(255, Math.round(value * factor))).toString(16).padStart(2, '0')).join('')}`;
};

const soften = (hex, alpha = 0.72) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return `rgba(255,255,255,${alpha})`;
    const red = Number.parseInt(hex.slice(1, 3), 16);
    const green = Number.parseInt(hex.slice(3, 5), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getInk = (profile) => {
    const accentShadow = shadowize(profile?.palette?.shade || '#2a1f1b', 0.54);
    return {
        outline: '#231816',
        deep: accentShadow,
        low: shadowize(profile?.palette?.base || '#8a725f', 0.62),
        mid: profile?.palette?.base || '#8a725f',
        hi: profile?.palette?.accent || '#e9dcc3',
        trim: profile?.palette?.trim || '#cfa875',
        glow: soften(profile?.palette?.glow || profile?.palette?.accent || '#f6e7c8', 0.82),
        leather: '#6b4427',
        strap: '#8c603b',
        steel: '#dce4ef',
        steelShade: '#7e8795',
        page: '#f4ead7',
    };
};

const renderSwordLikeIcon = ({ bladePoints, edgePoints, shinePoints, guardWidth = 14, gripHeight = 10, ink }) => (
    <>
        <Poly points={bladePoints} fill={ink.outline} />
        <Poly points={edgePoints} fill={ink.steelShade} />
        <Poly points={shinePoints} fill={ink.steel} />
        <Block x={17} y={23} w={guardWidth} h={3} fill={ink.outline} />
        <Block x={19} y={24} w={Math.max(guardWidth - 4, 6)} h={1.5} fill={ink.trim} />
        <Block x={22} y={25} w={4} h={gripHeight} fill={ink.outline} />
        <Block x={23} y={26} w={2} h={Math.max(gripHeight - 2, 5)} fill={ink.leather} />
    </>
);

const renderSwordLikeAvatar = ({ bladePoints, edgePoints, shinePoints, guardX = 8, guardWidth = 9, gripX = 11, gripHeight = 6, ink }) => (
    <>
        <Poly points={bladePoints} fill={ink.outline} />
        <Poly points={edgePoints} fill={ink.steelShade} />
        <Poly points={shinePoints} fill={ink.steel} />
        <Block x={guardX} y={15} w={guardWidth} h={2} fill={ink.outline} />
        <Block x={guardX + 1} y={16} w={Math.max(guardWidth - 2, 4)} h={1} fill={ink.trim} />
        <Block x={gripX} y={17} w={3} h={gripHeight} fill={ink.outline} />
        <Block x={gripX + 1} y={18} w={1} h={Math.max(gripHeight - 2, 2)} fill={ink.leather} />
    </>
);

const WeaponIcon = ({ style, ink }) => {
    switch (style) {
    case 'dagger':
        return renderSwordLikeIcon({
            bladePoints: [[31, 6], [36, 10], [28, 24], [22, 21]],
            edgePoints: [[31, 8], [34, 11], [28, 22], [23, 20]],
            shinePoints: [[31, 9], [33, 11], [28, 20], [25, 19]],
            guardWidth: 10,
            gripHeight: 8,
            ink,
        });
    case 'fang-dagger':
        return renderSwordLikeIcon({
            bladePoints: [[30, 6], [37, 10], [32, 16], [29, 23], [21, 21]],
            edgePoints: [[30, 8], [35, 11], [31, 16], [28, 21], [23, 20]],
            shinePoints: [[30, 9], [34, 11], [31, 15], [28, 19], [24, 18]],
            guardWidth: 10,
            gripHeight: 8,
            ink,
        });
    case 'throwing-blade':
        return (
            <>
                <Poly points={[[24, 6], [28, 14], [39, 17], [31, 21], [28, 32], [24, 24], [13, 21], [21, 17], [24, 6]]} fill={ink.outline} />
                <Poly points={[[24, 9], [27, 15], [35, 17], [29, 20], [27, 27], [24, 22], [21, 27], [19, 20], [13, 17], [21, 15]]} fill={ink.steelShade} />
                <Block x={22} y={16} w={4} h={4} fill={ink.trim} />
            </>
        );
    case 'twinblade':
        return (
            <>
                {renderSwordLikeIcon({
                    bladePoints: [[17, 7], [22, 10], [16, 21], [11, 18]],
                    edgePoints: [[17, 8], [21, 11], [16, 19], [12, 17]],
                    shinePoints: [[17, 9], [20, 11], [16, 18], [13, 16]],
                    guardWidth: 8,
                    gripHeight: 6,
                    ink,
                })}
                {renderSwordLikeIcon({
                    bladePoints: [[31, 7], [36, 10], [29, 21], [24, 18]],
                    edgePoints: [[31, 8], [35, 11], [29, 19], [25, 17]],
                    shinePoints: [[31, 9], [34, 11], [29, 18], [26, 16]],
                    guardWidth: 8,
                    gripHeight: 6,
                    ink,
                })}
            </>
        );
    case 'greatsword':
        return renderSwordLikeIcon({
            bladePoints: [[27, 4], [36, 8], [29, 30], [19, 25]],
            edgePoints: [[27, 6], [34, 9], [29, 27], [21, 23]],
            shinePoints: [[27, 8], [33, 10], [29, 24], [23, 22]],
            guardWidth: 16,
            gripHeight: 12,
            ink,
        });
    case 'rapier':
        return renderSwordLikeIcon({
            bladePoints: [[29, 5], [33, 8], [28, 31], [24, 29]],
            edgePoints: [[29, 7], [32, 9], [28, 28], [25, 27]],
            shinePoints: [[29, 8], [31, 9], [28, 25], [26, 24]],
            guardWidth: 12,
            gripHeight: 10,
            ink,
        });
    case 'saber':
        return renderSwordLikeIcon({
            bladePoints: [[28, 5], [35, 9], [31, 18], [30, 28], [22, 24]],
            edgePoints: [[28, 7], [33, 10], [30, 18], [29, 25], [24, 23]],
            shinePoints: [[28, 8], [32, 10], [30, 17], [29, 23], [25, 22]],
            guardWidth: 14,
            gripHeight: 10,
            ink,
        });
    case 'falchion':
        return renderSwordLikeIcon({
            bladePoints: [[28, 5], [36, 10], [33, 18], [31, 29], [21, 24]],
            edgePoints: [[28, 7], [34, 11], [31, 18], [30, 26], [23, 23]],
            shinePoints: [[28, 8], [33, 11], [31, 17], [29, 24], [24, 22]],
            guardWidth: 14,
            gripHeight: 10,
            ink,
        });
    case 'fork':
        return (
            <>
                <Block x={23} y={8} w={4} h={28} fill={ink.outline} />
                <Block x={24} y={9} w={2} h={27} fill={ink.leather} />
                <Block x={18} y={4} w={2} h={10} fill={ink.outline} />
                <Block x={23} y={2} w={2} h={12} fill={ink.outline} />
                <Block x={28} y={4} w={2} h={10} fill={ink.outline} />
                <Block x={19} y={4} w={1} h={8} fill={ink.steel} />
                <Block x={24} y={2} w={1} h={10} fill={ink.steel} />
                <Block x={29} y={4} w={1} h={8} fill={ink.steel} />
            </>
        );
    case 'staff':
        return (
            <>
                <Block x={22} y={8} w={4} h={30} fill={ink.outline} />
                <Block x={23} y={9} w={2} h={29} fill={ink.leather} />
                <Poly points={[[18, 4], [25, 2], [31, 5], [29, 12], [21, 12]]} fill={ink.outline} />
                <Poly points={[[20, 5], [25, 4], [28, 6], [27, 10], [22, 10]]} fill={ink.mid} />
                <Block x={22} y={6} w={5} h={2} fill={ink.glow} />
                <Block x={20} y={36} w={8} h={2} fill={ink.trim} />
            </>
        );
    case 'rod':
        return (
            <>
                <Block x={22} y={9} w={4} h={28} fill={ink.outline} />
                <Block x={23} y={10} w={2} h={27} fill={ink.leather} />
                <Block x={17} y={4} w={14} h={7} fill={ink.outline} />
                <Block x={19} y={5} w={10} h={5} fill={ink.mid} />
                <Block x={22} y={6} w={4} h={2} fill={ink.glow} />
            </>
        );
    case 'wand':
        return (
            <>
                <Block x={23} y={11} w={3} h={22} fill={ink.outline} />
                <Block x={24} y={12} w={1} h={21} fill={ink.leather} />
                <Poly points={[[20, 7], [24, 4], [29, 7], [27, 12], [21, 12]]} fill={ink.outline} />
                <Poly points={[[22, 8], [24, 6], [27, 8], [26, 10], [22, 10]]} fill={ink.mid} />
                <Block x={23} y={8} w={3} h={2} fill={ink.glow} />
            </>
        );
    case 'bow':
        return (
            <>
                <Poly points={[[16, 7], [20, 10], [17, 24], [12, 37], [14, 39], [21, 25], [24, 11]]} fill={ink.outline} />
                <Poly points={[[31, 7], [27, 10], [30, 24], [35, 37], [33, 39], [26, 25], [23, 11]]} fill={ink.outline} />
                <Poly points={[[18, 9], [20, 11], [18, 24], [15, 34], [20, 24], [22, 12]]} fill={ink.leather} />
                <Poly points={[[29, 9], [27, 11], [29, 24], [32, 34], [27, 24], [25, 12]]} fill={ink.leather} />
                <Block x={22.5} y={10} w={1} h={28} fill={ink.glow} />
            </>
        );
    case 'longbow':
        return (
            <>
                <Poly points={[[15, 5], [20, 9], [17, 24], [10, 40], [12, 42], [21, 26], [24, 10]]} fill={ink.outline} />
                <Poly points={[[33, 5], [28, 9], [31, 24], [38, 40], [36, 42], [27, 26], [24, 10]]} fill={ink.outline} />
                <Poly points={[[17, 7], [20, 10], [18, 24], [13, 37], [20, 25], [22, 11]]} fill={ink.leather} />
                <Poly points={[[31, 7], [28, 10], [30, 24], [35, 37], [28, 25], [26, 11]]} fill={ink.leather} />
                <Block x={22.5} y={9} w={1} h={31} fill={ink.glow} />
            </>
        );
    case 'axe':
        return (
            <>
                <Block x={23} y={7} w={4} h={31} fill={ink.outline} />
                <Block x={24} y={8} w={2} h={30} fill={ink.leather} />
                <Poly points={[[23, 9], [37, 14], [34, 26], [23, 22]]} fill={ink.outline} />
                <Poly points={[[24, 11], [34, 15], [32, 23], [24, 20]]} fill={ink.steelShade} />
                <Poly points={[[25, 12], [31, 16], [30, 21], [25, 19]]} fill={ink.steel} />
            </>
        );
    case 'greataxe':
        return (
            <>
                <Block x={22} y={6} w={4} h={33} fill={ink.outline} />
                <Block x={23} y={7} w={2} h={32} fill={ink.leather} />
                <Poly points={[[22, 8], [39, 14], [36, 30], [22, 24]]} fill={ink.outline} />
                <Poly points={[[23, 10], [35, 15], [33, 26], [23, 21]]} fill={ink.steelShade} />
                <Poly points={[[24, 11], [32, 16], [31, 23], [24, 19]]} fill={ink.steel} />
            </>
        );
    case 'hammer':
        return (
            <>
                <Block x={23} y={10} w={4} h={28} fill={ink.outline} />
                <Block x={24} y={11} w={2} h={27} fill={ink.leather} />
                <Block x={15} y={8} w={20} h={9} fill={ink.outline} />
                <Block x={17} y={10} w={16} h={5} fill={ink.steelShade} />
                <Block x={19} y={11} w={12} h={3} fill={ink.steel} />
            </>
        );
    case 'mace':
        return (
            <>
                <Block x={23} y={11} w={4} h={27} fill={ink.outline} />
                <Block x={24} y={12} w={2} h={26} fill={ink.leather} />
                <Poly points={[[18, 7], [30, 7], [34, 11], [34, 18], [30, 22], [18, 22], [14, 18], [14, 11]]} fill={ink.outline} />
                <Poly points={[[19, 9], [29, 9], [31, 11], [31, 17], [29, 19], [19, 19], [17, 17], [17, 11]]} fill={ink.steelShade} />
                <Block x={20} y={11} w={8} h={6} fill={ink.steel} />
            </>
        );
    case 'spear':
        return (
            <>
                <Block x={23} y={6} w={4} h={33} fill={ink.outline} />
                <Block x={24} y={7} w={2} h={32} fill={ink.leather} />
                <Poly points={[[25, 2], [31, 9], [25, 16], [19, 9]]} fill={ink.outline} />
                <Poly points={[[25, 4], [29, 9], [25, 14], [21, 9]]} fill={ink.steelShade} />
                <Poly points={[[25, 6], [28, 9], [25, 12], [22, 9]]} fill={ink.steel} />
            </>
        );
    case 'lance':
        return (
            <>
                <Block x={23} y={5} w={4} h={35} fill={ink.outline} />
                <Block x={24} y={6} w={2} h={34} fill={ink.leather} />
                <Poly points={[[25, 1], [32, 10], [25, 19], [18, 10]]} fill={ink.outline} />
                <Poly points={[[25, 4], [30, 10], [25, 16], [20, 10]]} fill={ink.steelShade} />
                <Block x={17} y={17} w={15} h={2} fill={ink.trim} />
            </>
        );
    case 'scythe':
        return (
            <>
                <Block x={23} y={5} w={3} h={34} fill={ink.outline} />
                <Block x={23.5} y={6} w={2} h={33} fill={ink.leather} />
                <Poly points={[[12, 8], [29, 8], [24, 17], [14, 18]]} fill={ink.outline} />
                <Poly points={[[15, 9], [27, 9], [23, 16], [16, 16]]} fill={ink.steelShade} />
                <Poly points={[[17, 10], [26, 10], [23, 15], [18, 15]]} fill={ink.steel} />
            </>
        );
    case 'whip':
        return (
            <>
                <Block x={19} y={26} w={8} h={4} fill={ink.outline} />
                <Block x={20} y={27} w={6} h={2} fill={ink.leather} />
                <Block x={27} y={26} w={4} h={3} fill={ink.trim} />
                <Block x={30} y={28} w={5} h={3} fill={ink.mid} />
                <Block x={34} y={30} w={4} h={3} fill={ink.hi} />
                <Block x={37} y={32} w={3} h={2} fill={ink.trim} />
            </>
        );
    default:
        return renderSwordLikeIcon({
            bladePoints: [[28, 5], [35, 10], [28, 29], [20, 25]],
            edgePoints: [[28, 7], [33, 11], [28, 26], [22, 23]],
            shinePoints: [[28, 8], [32, 11], [28, 23], [24, 21]],
            ink,
        });
    }
};

const WeaponAvatar = ({ style, ink }) => {
    switch (style) {
    case 'dagger':
    case 'fang-dagger':
    case 'throwing-blade':
        return renderSwordLikeAvatar({
            bladePoints: [[16, 4], [20, 6], [14, 17], [9, 15]],
            edgePoints: [[16, 5], [19, 7], [14, 16], [10, 14]],
            shinePoints: [[16, 6], [18, 7], [14, 15], [11, 13]],
            guardWidth: 8,
            gripHeight: 5,
            ink,
        });
    case 'twinblade':
        return (
            <>
                {renderSwordLikeAvatar({
                    bladePoints: [[11, 6], [14, 8], [10, 15], [6, 14]],
                    edgePoints: [[11, 7], [13, 8], [10, 14], [7, 13]],
                    shinePoints: [[11, 8], [12, 8], [10, 13], [8, 12]],
                    guardX: 5,
                    guardWidth: 6,
                    gripX: 6,
                    gripHeight: 4,
                    ink,
                })}
                {renderSwordLikeAvatar({
                    bladePoints: [[18, 5], [22, 7], [16, 18], [11, 16]],
                    edgePoints: [[18, 6], [21, 8], [16, 17], [12, 15]],
                    shinePoints: [[18, 7], [20, 8], [16, 16], [13, 14]],
                    guardX: 10,
                    guardWidth: 8,
                    gripX: 12,
                    gripHeight: 5,
                    ink,
                })}
            </>
        );
    case 'rapier':
        return renderSwordLikeAvatar({
            bladePoints: [[17, 2], [20, 5], [15, 21], [12, 19]],
            edgePoints: [[17, 4], [19, 6], [15, 19], [13, 18]],
            shinePoints: [[17, 5], [18, 6], [15, 17], [13.5, 16.5]],
            guardWidth: 9,
            gripHeight: 6,
            ink,
        });
    case 'saber':
    case 'falchion':
    case 'fork':
    case 'sword':
        return renderSwordLikeAvatar({
            bladePoints: [[17, 2], [23, 6], [16, 21], [9, 18]],
            edgePoints: [[17, 4], [22, 7], [16, 18], [10, 16]],
            shinePoints: [[17, 6], [20, 8], [16, 16], [12, 14]],
            ink,
        });
    case 'staff':
    case 'rod':
        return (
            <>
                <Block x={12} y={3} w={3} h={24} fill={ink.outline} />
                <Block x={13} y={4} w={1} h={23} fill={ink.leather} />
                <Poly points={[[8, 1], [15, 0], [19, 3], [17, 9], [10, 9]]} fill={ink.outline} />
                <Poly points={[[10, 2], [15, 2], [17, 4], [16, 7], [11, 7]]} fill={ink.mid} />
                <Block x={11} y={3} w={4} h={2} fill={ink.glow} />
            </>
        );
    case 'wand':
        return (
            <>
                <Block x={13} y={7} w={3} h={19} fill={ink.outline} />
                <Block x={14} y={8} w={1} h={18} fill={ink.leather} />
                <Poly points={[[10, 4], [14, 1], [19, 4], [17, 9], [11, 9]]} fill={ink.outline} />
                <Poly points={[[12, 5], [14, 3], [17, 5], [16, 7], [12, 7]]} fill={ink.mid} />
                <Block x={13} y={5} w={3} h={2} fill={ink.glow} />
            </>
        );
    case 'bow':
    case 'longbow':
        return (
            <>
                <Poly points={[[5, 2], [9, 4], [7, 14], [4, 24], [6, 25], [10, 15], [12, 5]]} fill={ink.outline} />
                <Poly points={[[20, 2], [16, 4], [18, 14], [21, 24], [19, 25], [15, 15], [13, 5]]} fill={ink.outline} />
                <Poly points={[[7, 3], [9, 5], [8, 14], [6, 20], [10, 15], [11, 6]]} fill={ink.leather} />
                <Poly points={[[18, 3], [16, 5], [17, 14], [19, 20], [15, 15], [14, 6]]} fill={ink.leather} />
                <Block x={12.5} y={4} w={1} h={21} fill={ink.glow} />
            </>
        );
    case 'axe':
    case 'greataxe':
        return (
            <>
                <Block x={12} y={4} w={3} h={22} fill={ink.outline} />
                <Block x={13} y={5} w={1} h={21} fill={ink.leather} />
                <Poly points={[[12, 6], [24, 10], [21, 20], [12, 17]]} fill={ink.outline} />
                <Poly points={[[13, 8], [21, 11], [19, 17], [13, 15]]} fill={ink.steelShade} />
                <Poly points={[[14, 9], [19, 12], [18, 15], [14, 14]]} fill={ink.steel} />
            </>
        );
    case 'hammer':
    case 'mace':
        return (
            <>
                <Block x={12} y={8} w={3} h={18} fill={ink.outline} />
                <Block x={13} y={9} w={1} h={17} fill={ink.leather} />
                <Block x={7} y={6} w={13} h={7} fill={ink.outline} />
                <Block x={9} y={7} w={9} h={5} fill={ink.steelShade} />
                <Block x={10} y={8} w={7} h={3} fill={ink.steel} />
            </>
        );
    case 'spear':
    case 'lance':
    case 'scythe':
        return (
            <>
                <Block x={12} y={2} w={3} h={25} fill={ink.outline} />
                <Block x={13} y={3} w={1} h={24} fill={ink.leather} />
                <Poly points={[[13, 0], [19, 7], [13, 13], [7, 7]]} fill={ink.outline} />
                <Poly points={[[13, 2], [17, 7], [13, 11], [9, 7]]} fill={ink.steelShade} />
                {style === 'lance' && <Block x={6} y={11} w={11} h={1.5} fill={ink.trim} />}
            </>
        );
    case 'whip':
        return (
            <>
                <Block x={9} y={17} w={7} h={3} fill={ink.outline} />
                <Block x={10} y={18} w={5} h={1.5} fill={ink.leather} />
                <Block x={15} y={17} w={4} h={2} fill={ink.trim} />
                <Block x={18} y={19} w={4} h={2} fill={ink.mid} />
                <Block x={21} y={20} w={3} h={2} fill={ink.hi} />
            </>
        );
    default:
        return renderSwordLikeAvatar({
            bladePoints: [[17, 2], [23, 6], [16, 21], [9, 18]],
            edgePoints: [[17, 4], [22, 7], [16, 18], [10, 16]],
            shinePoints: [[17, 6], [20, 8], [16, 16], [12, 14]],
            ink,
        });
    }
};

const OffhandIcon = ({ style, ink }) => {
    switch (style) {
    case 'tower-shield':
        return (
            <>
                <Poly points={[[24, 6], [33, 10], [35, 29], [24, 40], [13, 29], [15, 10]]} fill={ink.outline} />
                <Poly points={[[24, 9], [31, 12], [32, 28], [24, 36], [16, 28], [17, 12]]} fill={ink.low} />
                <Poly points={[[24, 12], [28, 14], [29, 27], [24, 31], [19, 27], [20, 14]]} fill={ink.hi} />
                <Block x={23} y={15} w={2} h={12} fill={ink.trim} />
            </>
        );
    case 'buckler':
        return (
            <>
                <Poly points={[[24, 10], [31, 13], [33, 23], [29, 32], [19, 32], [15, 23], [17, 13]]} fill={ink.outline} />
                <Poly points={[[24, 12], [29, 15], [31, 23], [28, 29], [20, 29], [17, 23], [19, 15]]} fill={ink.hi} />
            </>
        );
    case 'tablet':
        return (
            <>
                <Block x={14} y={8} w={20} h={27} fill={ink.outline} />
                <Block x={16} y={10} w={16} h={23} fill={ink.low} />
                <Block x={18} y={12} w={12} h={4} fill={ink.hi} />
                <Block x={18} y={18} w={12} h={2} fill={ink.trim} />
                <Block x={18} y={22} w={12} h={2} fill={ink.trim} />
            </>
        );
    case 'scroll':
        return (
            <>
                <Block x={15} y={9} w={18} h={23} fill={ink.outline} />
                <Block x={18} y={11} w={12} h={19} fill={ink.page} />
                <Block x={14} y={12} w={4} h={17} fill={ink.trim} />
                <Block x={30} y={12} w={4} h={17} fill={ink.trim} />
                <Block x={21} y={16} w={6} h={2} fill={ink.low} />
                <Block x={21} y={21} w={6} h={2} fill={ink.low} />
            </>
        );
    case 'grimoire':
        return (
            <>
                <Block x={13} y={8} w={22} h={26} fill={ink.outline} />
                <Block x={15} y={10} w={18} h={22} fill={ink.deep} />
                <Block x={18} y={12} w={6} h={18} fill={ink.low} />
                <Block x={24} y={12} w={7} h={18} fill={ink.mid} />
                <Block x={23} y={10} w={2} h={22} fill={ink.trim} />
                <Block x={20} y={18} w={8} h={2} fill={ink.glow} />
            </>
        );
    case 'tome':
        return (
            <>
                <Block x={13} y={8} w={22} h={26} fill={ink.outline} />
                <Block x={15} y={10} w={18} h={22} fill={ink.low} />
                <Block x={18} y={12} w={6} h={18} fill={ink.page} />
                <Block x={24} y={12} w={7} h={18} fill={ink.hi} />
                <Block x={23} y={10} w={2} h={22} fill={ink.trim} />
            </>
        );
    default:
        return (
            <>
                <Poly points={[[24, 8], [31, 11], [32, 27], [24, 36], [16, 27], [17, 11]]} fill={ink.outline} />
                <Poly points={[[24, 10], [29, 13], [30, 26], [24, 33], [18, 26], [19, 13]]} fill={ink.low} />
                <Poly points={[[24, 13], [27, 15], [28, 24], [24, 29], [20, 24], [21, 15]]} fill={ink.hi} />
                <Block x={23} y={16} w={2} h={9} fill={ink.trim} />
            </>
        );
    }
};

const OffhandAvatar = ({ style, ink }) => {
    switch (style) {
    case 'tower-shield':
    case 'kite-shield':
        return (
            <>
                <Poly points={[[15, 5], [22, 8], [23, 19], [15, 27], [7, 19], [8, 8]]} fill={ink.outline} />
                <Poly points={[[15, 7], [20, 9], [21, 18], [15, 24], [9, 18], [10, 9]]} fill={ink.low} />
                <Poly points={[[15, 9], [19, 11], [19, 17], [15, 21], [11, 17], [11, 11]]} fill={ink.hi} />
                <Block x={14} y={12} w={2} h={6} fill={ink.trim} />
            </>
        );
    case 'buckler':
        return (
            <>
                <Poly points={[[15, 8], [21, 11], [22, 18], [18, 23], [12, 23], [8, 18], [9, 11]]} fill={ink.outline} />
                <Poly points={[[15, 10], [19, 12], [20, 18], [17, 21], [13, 21], [10, 18], [11, 12]]} fill={ink.hi} />
            </>
        );
    case 'tablet':
        return (
            <>
                <Block x={7} y={8} w={17} h={18} fill={ink.outline} />
                <Block x={9} y={10} w={13} h={14} fill={ink.low} />
                <Block x={11} y={12} w={9} h={3} fill={ink.hi} />
                <Block x={11} y={18} w={9} h={1.5} fill={ink.trim} />
            </>
        );
    case 'scroll':
        return (
            <>
                <Block x={8} y={9} w={15} h={16} fill={ink.outline} />
                <Block x={10} y={11} w={11} h={12} fill={ink.page} />
                <Block x={7} y={12} w={3} h={10} fill={ink.trim} />
                <Block x={21} y={12} w={3} h={10} fill={ink.trim} />
            </>
        );
    case 'grimoire':
    case 'tome':
        return (
            <>
                <Block x={7} y={8} w={18} h={18} fill={ink.outline} />
                <Block x={9} y={10} w={14} h={14} fill={style === 'grimoire' ? ink.deep : ink.low} />
                <Block x={15} y={10} w={2} h={14} fill={ink.trim} />
                <Block x={11} y={14} w={4} h={8} fill={style === 'grimoire' ? ink.low : ink.page} />
                <Block x={17} y={14} w={4} h={8} fill={style === 'grimoire' ? ink.mid : ink.hi} />
            </>
        );
    default:
        return null;
    }
};

const ArmorHeadIcon = ({ style, ink }) => {
    switch (style) {
    case 'straw-hat':
        return (
            <>
                <Poly points={[[8, 26], [16, 20], [32, 20], [40, 26], [37, 31], [11, 31]]} fill={ink.outline} />
                <Poly points={[[11, 24], [17, 21], [31, 21], [37, 24], [35, 29], [13, 29]]} fill={ink.mid} />
                <Block x={17} y={13} w={14} h={9} fill={ink.outline} />
                <Block x={18} y={14} w={12} h={7} fill={ink.hi} />
                <Block x={20} y={17} w={8} h={2} fill={ink.trim} />
            </>
        );
    case 'wizard-hat':
        return (
            <>
                <Poly points={[[14, 26], [23, 7], [29, 12], [33, 25], [40, 28], [11, 28]]} fill={ink.outline} />
                <Poly points={[[17, 25], [24, 11], [28, 14], [31, 24], [36, 26], [14, 26]]} fill={ink.mid} />
                <Block x={16} y={25} w={18} h={3} fill={ink.trim} />
            </>
        );
    case 'circlet':
        return (
            <>
                <Poly points={[[12, 18], [19, 14], [29, 14], [36, 18], [34, 22], [14, 22]]} fill={ink.outline} />
                <Poly points={[[15, 18], [20, 16], [28, 16], [33, 18], [31, 20], [17, 20]]} fill={ink.trim} />
                <Block x={22} y={14} w={4} h={4} fill={ink.glow} />
            </>
        );
    case 'mask':
        return (
            <>
                <Poly points={[[16, 18], [21, 15], [28, 15], [32, 18], [31, 24], [17, 24]]} fill={ink.outline} />
                <Poly points={[[18, 18], [22, 17], [27, 17], [30, 19], [29, 22], [19, 22]]} fill={ink.mid} />
                <Block x={20} y={19} w={2} h={2} fill={ink.hi} />
                <Block x={26} y={19} w={2} h={2} fill={ink.hi} />
            </>
        );
    case 'hood':
    case 'hood-cloak':
        return (
            <>
                <Poly points={[[12, 12], [20, 7], [31, 8], [38, 15], [36, 30], [14, 30], [10, 21]]} fill={ink.outline} />
                <Poly points={[[14, 14], [20, 10], [29, 11], [35, 17], [33, 28], [17, 28], [13, 20]]} fill={ink.mid} />
                <Poly points={[[18, 15], [22, 13], [28, 13], [31, 17], [28, 22], [20, 22], [17, 18]]} fill={ink.hi} />
            </>
        );
    case 'helm':
        return (
            <>
                <Poly points={[[14, 12], [20, 8], [30, 8], [36, 14], [35, 27], [13, 27]]} fill={ink.outline} />
                <Poly points={[[16, 13], [21, 10], [29, 10], [34, 15], [33, 25], [15, 25]]} fill={ink.low} />
                <Block x={19} y={17} w={10} h={2} fill={ink.trim} />
                <Block x={18} y={20} w={3} h={3} fill={ink.hi} />
                <Block x={27} y={20} w={3} h={3} fill={ink.hi} />
            </>
        );
    case 'cap':
        return (
            <>
                <Poly points={[[13, 19], [20, 14], [31, 14], [36, 18], [31, 24], [15, 24]]} fill={ink.outline} />
                <Poly points={[[15, 19], [21, 16], [29, 16], [33, 18], [29, 22], [17, 22]]} fill={ink.mid} />
                <Block x={30} y={20} w={8} h={2} fill={ink.trim} />
            </>
        );
    default:
        return null;
    }
};

const ArmorBodyIcon = ({ style, ink }) => {
    switch (style) {
    case 'robe':
        return (
            <>
                <Poly points={[[16, 8], [32, 8], [38, 17], [35, 40], [13, 40], [10, 17]]} fill={ink.outline} />
                <Poly points={[[18, 10], [30, 10], [35, 18], [33, 37], [15, 37], [13, 18]]} fill={ink.mid} />
                <Poly points={[[21, 12], [27, 12], [31, 18], [29, 33], [19, 33], [17, 18]]} fill={ink.low} />
                <Block x={22} y={11} w={4} h={23} fill={ink.trim} />
                <Block x={18} y={14} w={12} h={3} fill={ink.hi} />
            </>
        );
    case 'plate':
        return (
            <>
                <Poly points={[[14, 10], [18, 7], [31, 7], [35, 10], [38, 31], [32, 40], [17, 40], [11, 31]]} fill={ink.outline} />
                <Poly points={[[16, 11], [19, 9], [30, 9], [33, 11], [35, 30], [31, 37], [18, 37], [14, 30]]} fill={ink.low} />
                <Block x={21} y={10} w={6} h={23} fill={ink.trim} />
                <Block x={16} y={15} w={6} h={14} fill={ink.hi} opacity={0.92} />
                <Block x={26} y={15} w={6} h={14} fill={ink.hi} opacity={0.92} />
            </>
        );
    case 'leather':
        return (
            <>
                <Poly points={[[14, 10], [19, 7], [30, 7], [35, 12], [35, 35], [31, 40], [18, 40], [14, 35]]} fill={ink.outline} />
                <Poly points={[[16, 11], [20, 9], [29, 9], [33, 13], [33, 34], [29, 37], [20, 37], [16, 34]]} fill={ink.mid} />
                <Block x={18} y={18} w={14} h={3} fill={ink.trim} />
                <Block x={20} y={22} w={10} h={11} fill={ink.low} />
                <Block x={19} y={26} w={12} h={2} fill={ink.hi} />
            </>
        );
    case 'boots':
        return (
            <>
                <Block x={11} y={24} w={11} h={14} fill={ink.outline} />
                <Block x={13} y={26} w={7} h={10} fill={ink.mid} />
                <Block x={24} y={24} w={11} h={14} fill={ink.outline} />
                <Block x={26} y={26} w={7} h={10} fill={ink.mid} />
                <Block x={11} y={36} w={12} h={3} fill={ink.trim} />
                <Block x={24} y={36} w={12} h={3} fill={ink.trim} />
            </>
        );
    case 'cloak':
        return (
            <>
                <Poly points={[[12, 10], [19, 7], [31, 7], [37, 15], [35, 40], [14, 40], [10, 24]]} fill={ink.outline} />
                <Poly points={[[14, 11], [19, 9], [30, 9], [35, 16], [33, 37], [16, 37], [12, 24]]} fill={ink.mid} />
                <Poly points={[[18, 11], [24, 10], [30, 16], [28, 30], [21, 33], [17, 19]]} fill={ink.low} />
                <Block x={18} y={12} w={14} h={2} fill={ink.hi} />
                <Block x={18} y={18} w={12} h={2} fill={ink.trim} />
            </>
        );
    case 'tunic':
    default:
        return (
            <>
                <Poly points={[[13, 10], [19, 7], [31, 7], [37, 14], [34, 40], [15, 40], [11, 23]]} fill={ink.outline} />
                <Poly points={[[15, 11], [20, 9], [30, 9], [35, 15], [32, 37], [17, 37], [13, 23]]} fill={ink.mid} />
                <Poly points={[[18, 11], [24, 10], [29, 16], [28, 29], [22, 31], [18, 19]]} fill={ink.low} />
                <Block x={18} y={11} w={14} h={2} fill={ink.hi} />
                <Block x={18} y={18} w={12} h={2} fill={ink.trim} />
                <Block x={19} y={25} w={10} h={2} fill={ink.hi} />
            </>
        );
    }
};

const ArmorHeadAvatar = ({ style, ink }) => {
    switch (style) {
    case 'straw-hat':
        return (
            <>
                <Poly points={[[4, 15], [10, 11], [22, 11], [28, 14], [25, 17], [7, 17]]} fill={ink.outline} />
                <Poly points={[[7, 14], [11, 12], [21, 12], [25, 14], [23, 16], [9, 16]]} fill={ink.mid} />
                <Poly points={[[11, 8], [15, 6], [21, 6], [24, 8], [23, 11], [12, 11]]} fill={ink.outline} />
                <Poly points={[[13, 8], [16, 7], [20, 7], [22, 8], [21, 10], [14, 10]]} fill={ink.hi} />
                <Block x={14} y={9} w={7} h={1.5} fill={ink.trim} />
            </>
        );
    case 'wizard-hat':
        return (
            <>
                <Poly points={[[9, 17], [15, 4], [20, 7], [24, 16], [28, 18], [7, 18]]} fill={ink.outline} />
                <Poly points={[[11, 16], [16, 6], [19, 8], [22, 15], [25, 16], [10, 16]]} fill={ink.mid} />
                <Block x={10} y={16} w={14} h={2} fill={ink.trim} />
            </>
        );
    case 'circlet':
        return (
            <>
                <Poly points={[[10, 13], [14, 11], [21, 11], [24, 13], [23, 16], [11, 16]]} fill={ink.outline} />
                <Poly points={[[11, 13], [15, 12], [20, 12], [23, 13], [22, 15], [12, 15]]} fill={ink.trim} />
                <Block x={16} y={10} w={3} h={3} fill={ink.glow} />
            </>
        );
    case 'mask':
        return (
            <>
                <Poly points={[[12, 14], [16, 12], [21, 12], [24, 14], [23, 18], [13, 18]]} fill={ink.outline} />
                <Poly points={[[14, 14], [17, 13], [20, 13], [22, 14], [21, 17], [15, 17]]} fill={ink.mid} />
                <Block x={16} y={15} w={1.5} h={1.5} fill={ink.hi} />
                <Block x={19} y={15} w={1.5} h={1.5} fill={ink.hi} />
            </>
        );
    case 'hood':
    case 'hood-cloak':
        return (
            <>
                <Poly points={[[7, 6], [12, 3], [21, 4], [26, 8], [25, 18], [9, 18], [5, 12]]} fill={ink.outline} />
                <Poly points={[[9, 7], [13, 5], [20, 5], [24, 9], [23, 16], [11, 16], [8, 11]]} fill={ink.mid} />
            </>
        );
    case 'helm':
        return (
            <>
                <Poly points={[[8, 6], [12, 3], [21, 3], [26, 8], [25, 17], [9, 17]]} fill={ink.outline} />
                <Poly points={[[10, 7], [13, 5], [20, 5], [24, 9], [23, 15], [11, 15]]} fill={ink.low} />
                <Block x={13} y={10} w={7} h={1.5} fill={ink.trim} />
            </>
        );
    case 'cap':
        return (
            <>
                <Poly points={[[10, 14], [15, 11], [22, 11], [25, 13], [21, 17], [12, 17]]} fill={ink.outline} />
                <Poly points={[[12, 14], [16, 12], [21, 12], [23, 13], [20, 15], [14, 15]]} fill={ink.mid} />
                <Block x={21} y={14} w={5} h={1.5} fill={ink.trim} />
            </>
        );
    default:
        return null;
    }
};

const ArmorBodyAvatar = ({ style, ink }) => {
    switch (style) {
    case 'robe':
        return (
            <>
                <Poly points={[[7, 4], [24, 4], [28, 10], [26, 27], [7, 27], [4, 10]]} fill={ink.outline} opacity={0.95} />
                <Poly points={[[8, 5], [23, 5], [26, 10], [24, 25], [9, 25], [6, 10]]} fill={ink.mid} opacity={0.92} />
                <Poly points={[[11, 6], [19, 6], [22, 10], [20, 23], [12, 23], [10, 10]]} fill={ink.low} opacity={0.9} />
                <Block x={14} y={6} w={4} h={17} fill={ink.trim} opacity={0.92} />
                <Block x={11} y={8} w={10} h={2} fill={ink.hi} opacity={0.88} />
            </>
        );
    case 'plate':
        return (
            <>
                <Poly points={[[5, 5], [9, 2], [23, 2], [27, 5], [28, 18], [24, 26], [8, 26], [4, 18]]} fill={ink.outline} opacity={0.96} />
                <Poly points={[[7, 5], [10, 4], [22, 4], [25, 6], [26, 18], [22, 24], [10, 24], [6, 18]]} fill={ink.low} opacity={0.94} />
                <Poly points={[[10, 6], [22, 6], [24, 11], [22, 22], [10, 22], [8, 11]]} fill={ink.mid} opacity={0.92} />
                <Block x={14} y={6} w={4} h={15} fill={ink.trim} opacity={0.94} />
                <Block x={8} y={9} w={4} h={10} fill={ink.hi} opacity={0.88} />
                <Block x={20} y={9} w={4} h={10} fill={ink.hi} opacity={0.88} />
            </>
        );
    case 'leather':
        return (
            <>
                <Poly points={[[6, 5], [10, 3], [22, 3], [26, 6], [26, 22], [22, 26], [10, 26], [6, 22]]} fill={ink.outline} opacity={0.95} />
                <Poly points={[[7, 6], [10, 5], [21, 5], [24, 7], [24, 21], [21, 24], [10, 24], [8, 21]]} fill={ink.mid} opacity={0.92} />
                <Poly points={[[10, 8], [22, 8], [22, 20], [10, 20]]} fill={ink.low} opacity={0.88} />
                <Block x={9} y={10} w={14} h={2} fill={ink.trim} opacity={0.92} />
                <Block x={11} y={14} w={10} h={2} fill={ink.hi} opacity={0.82} />
                <Block x={12} y={18} w={8} h={2} fill={ink.trim} opacity={0.84} />
            </>
        );
    case 'boots':
        return (
            <>
                <Block x={11} y={17} w={7} h={10} fill={ink.outline} opacity={0.96} />
                <Block x={12} y={18} w={5} h={8} fill={ink.mid} opacity={0.9} />
                <Block x={19} y={17} w={7} h={10} fill={ink.outline} opacity={0.96} />
                <Block x={20} y={18} w={5} h={8} fill={ink.mid} opacity={0.9} />
                <Block x={11} y={25} w={8} h={2} fill={ink.trim} opacity={0.9} />
                <Block x={19} y={25} w={8} h={2} fill={ink.trim} opacity={0.9} />
            </>
        );
    case 'cloak':
        return (
            <>
                <Poly points={[[5, 5], [10, 2], [23, 2], [28, 8], [27, 17], [26, 27], [7, 27], [4, 16]]} fill={ink.outline} opacity={0.96} />
                <Poly points={[[7, 5], [11, 4], [22, 4], [26, 8], [25, 16], [24, 25], [9, 25], [6, 16]]} fill={ink.mid} opacity={0.94} />
                <Poly points={[[18, 5], [23, 8], [25, 12], [24, 23], [20, 25], [17, 19]]} fill={ink.hi} opacity={0.74} />
                <Block x={11} y={4} w={12} h={2} fill={ink.hi} opacity={0.94} />
                <Block x={12} y={11} w={10} h={2} fill={ink.trim} opacity={0.9} />
            </>
        );
    case 'tunic':
    default:
        return (
            <>
                <Poly points={[[5, 5], [11, 2], [22, 2], [28, 7], [27, 16], [26, 27], [8, 27], [4, 15]]} fill={ink.outline} opacity={0.96} />
                <Poly points={[[7, 5], [11, 4], [21, 4], [26, 8], [25, 15], [24, 25], [10, 25], [6, 15]]} fill={ink.mid} opacity={0.94} />
                <Poly points={[[9, 7], [18, 7], [21, 10], [20, 20], [13, 21], [8, 13]]} fill={ink.low} opacity={0.9} />
                <Poly points={[[19, 7], [23, 8], [25, 12], [24, 22], [20, 25], [17, 19]]} fill={ink.hi} opacity={0.76} />
                <Block x={11} y={4} w={12} h={2} fill={ink.hi} opacity={0.94} />
                <Block x={12} y={11} w={10} h={2} fill={ink.trim} opacity={0.92} />
                <Block x={12} y={18} w={9} h={2} fill={ink.hi} opacity={0.84} />
            </>
        );
    }
};

const renderWeaponGlyph = (profile, mode) => {
    const ink = getInk(profile);
    if (mode === 'avatar') {
        return <WeaponAvatar style={profile.style} ink={ink} />;
    }
    return (
        <g transform="translate(0 1)">
            <WeaponIcon style={profile.style} ink={ink} />
        </g>
    );
};

const renderArmorGlyph = (profile, part = 'full', mode) => {
    const ink = getInk(profile);
    const head = mode === 'avatar'
        ? <ArmorHeadAvatar style={profile.headgearStyle} ink={ink} />
        : <ArmorHeadIcon style={profile.headgearStyle} ink={ink} />;
    const body = mode === 'avatar'
        ? <ArmorBodyAvatar style={profile.bodyStyle} ink={ink} />
        : <ArmorBodyIcon style={profile.bodyStyle} ink={ink} />;

    if (part === 'headgear') return head;
    if (part === 'body') return body;
    return (
        <>
            {body}
            {head}
        </>
    );
};

const renderOffhandGlyph = (profile, mode) => {
    const ink = getInk(profile);
    if (mode === 'avatar') {
        return <OffhandAvatar style={profile.style} ink={ink} />;
    }
    return (
        <g transform="translate(1 1)">
            <OffhandIcon style={profile.style} ink={ink} />
        </g>
    );
};

export const EquipmentSpriteLayer = ({
    profile,
    part = 'full',
    showShadow = false,
    mode = 'icon',
}) => {
    if (!profile || profile.slot === 'none') return null;

    return (
        <>
            {showShadow && mode === 'icon' && <Block x={10} y={40} w={28} h={3} fill="rgba(9,14,18,0.28)" />}
            {profile.slot === 'weapon' && renderWeaponGlyph(profile, mode)}
            {profile.slot === 'armor' && renderArmorGlyph(profile, part, mode)}
            {profile.slot === 'offhand' && renderOffhandGlyph(profile, mode)}
        </>
    );
};

export const EquipmentSpriteGlyph = ({
    item,
    descriptor = null,
    size = 24,
    className = '',
    mode = 'icon',
}) => {
    const profile = descriptor || getEquipmentArtProfile(item);
    if (!profile || profile.slot === 'none') return null;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            shapeRendering="crispEdges"
            aria-hidden="true"
            className={className}
        >
            <EquipmentSpriteLayer profile={profile} showShadow mode={mode} />
        </svg>
    );
};

export default EquipmentSpriteGlyph;
