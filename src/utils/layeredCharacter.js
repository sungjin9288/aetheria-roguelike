/**
 * layeredCharacter.js — cycle 47 Layered Character System.
 *
 * 기존 (cycle 46): sprite 1장으로 캐릭터 표현. 직업이 sprite 결정. 장비는 sprite에
 * 영향 X (오직 stat + 인벤토리 슬롯 시각만).
 *
 * 신규 (cycle 47): 캐릭터를 layer로 분해해 합성.
 *   layer 순서 (back → front):
 *     1. cape (외투 뒤)
 *     2. body (직업별 weaponless naked chibi base)
 *     3. boots
 *     4. armor (가슴/팔/허리)
 *     5. weapon (손에)
 *     6. helmet (머리)
 *
 *   각 layer는 같은 canvas size + transparent background. 같은 anchor에 합성
 *   하면 정확히 fit. imagegen으로 점진 생성된 자산을 manifest에 등록.
 *
 * Asset path:
 *   /assets/avatars/layers/{layerType}/{styleKey}.png
 *
 * 폴백: body가 manifest에 없으면 cycle 46 직업 sprite로 폴백.
 *      각 부분 layer (armor/weapon/etc)가 없으면 그 layer만 skip.
 */

import { JOB_SPRITE_SLUG_MAP } from './avatarSpriteCandidates.js';

/**
 * Layered asset manifest — imagegen으로 생성된 layer가 등록되는 set.
 *
 * 자산이 추가되면 키를 set에 등록하고, scripts/deploy_layered_sprites.mjs가
 * 자동으로 manifest를 갱신함.
 *
 * 처음에는 모두 empty — body가 없으면 layered system 비활성, 폴백 동작.
 */
export const LAYERED_MANIFEST = Object.freeze({
    body:    new Set([
        'adventurer', 'archmage', 'assassin', 'berserker', 'chronomancer', 'grand-mage', 'knight', 'mage', 'paladin', 'ranger', 'rogue', 'shadow-lord', 'warlock', 'warrior',
    ]),    // imagegen 자산 받으면 키 등록
    cape:    new Set([
        'cloak',
    ]),
    armor:   new Set([
        'coat', 'leather', 'plate', 'robe',
    ]),
    boots:   new Set([
        'cloth', 'leather', 'plate',
    ]),
    weapon:  new Set([
        'axe', 'bow', 'dagger', 'spear', 'staff', 'sword',
    ]),
    helmet:  new Set([
        'cap', 'helm', 'hood', 'wizard-hat',
    ]),
});

const LAYER_ORDER = Object.freeze(['cape', 'body', 'boots', 'armor', 'weapon', 'helmet']);

/**
 * 직업 → body key 매핑.
 *
 * @param {string} job - 한글 직업명
 * @returns {string} body asset 키 (jobSlug)
 */
const resolveBodyKey = (job) => {
    const normalized = String(job || '모험가').replace(/\s+/g, '');
    return JOB_SPRITE_SLUG_MAP[normalized] || JOB_SPRITE_SLUG_MAP[job] || 'adventurer';
};

/**
 * armor item → armor layer key.
 * 이름 hint로 종류 추론. items.js 데이터 hand-tuned.
 */
const resolveArmorKey = (armorItem) => {
    if (!armorItem || armorItem.type !== 'armor') return null;
    const name = String(armorItem.name || '');
    // 우선순위: 구체 재질(가죽/판금/로브) > 외투류 > 일반 갑옷
    // 주의: "튜닉"은 매핑 X — body PNG가 이미 흰 튜닉 차림이라
    //       추가 layer 없이 body만 보여주는 게 맞음 (여행자 튜닉 등).
    if (/가죽|경갑|레더|조끼/.test(name)) return 'leather';
    if (/로브|예복|성의|가운/.test(name)) return 'robe';
    if (/판금|중갑|풀플레이트|흉갑/.test(name)) return 'plate';
    if (/외투|망토|클로크|코트/.test(name)) return 'coat';
    if (/갑주|갑옷/.test(name)) return 'plate';  // 일반 갑옷은 마지막
    // 매핑 안 되면 (튜닉, 천옷 등) layer 추가 없이 body만 보여줌
    return null;
};

/**
 * armor item → boots layer key (armor 안에 boots 정보 같이 있다고 가정 또는 별도 슬롯)
 * 현재 게임은 armor 슬롯이 통합 — 부츠는 armor에 포함된 시각.
 * 별도 slot이 생기면 그때 추출. 현재는 armorItem 이름에서 추론.
 */
const resolveBootsKey = (armorItem) => {
    if (!armorItem) return null;
    const name = String(armorItem.name || '');
    if (/장화|부츠/.test(name)) {
        if (/판금|중장/.test(name)) return 'plate';
        if (/가죽|레더/.test(name)) return 'leather';
        return 'cloth';
    }
    return null;  // armor가 부츠 명시 안 하면 layer 없음
};

/**
 * weapon item → weapon layer key.
 */
const resolveWeaponKey = (weaponItem) => {
    if (!weaponItem || weaponItem.type !== 'weapon') return null;
    const name = String(weaponItem.name || '');
    if (/단검|단도|독아|송곳니|표창/.test(name)) return 'dagger';
    if (/대검|양손검|그레이트소드|클레이모어/.test(name)) return 'greatsword';
    if (/검(?!\s*시)|소드|블레이드|칼날|칼/.test(name)) return 'sword';
    if (/대도끼|그레이트액스/.test(name)) return 'greataxe';
    if (/도끼|액스/.test(name)) return 'axe';
    if (/해머|망치|메이스|철퇴/.test(name)) return 'hammer';
    if (/지팡이|로드/.test(name)) return 'staff';
    if (/완드|마법봉|봉/.test(name)) return 'wand';
    if (/장궁|롱보우/.test(name)) return 'longbow';
    if (/활|궁/.test(name)) return 'bow';
    if (/창|랜스/.test(name)) return 'spear';
    if (/낫|사이즈/.test(name)) return 'scythe';
    if (/곤봉/.test(name)) return 'club';
    return 'sword';
};

/**
 * cape — 외투 종류 추론. armor item이 cape 정보를 같이 갖거나 별도 slot.
 * 현재는 armor name에서 추론.
 */
const resolveCapeKey = (armorItem) => {
    if (!armorItem) return null;
    const name = String(armorItem.name || '');
    if (/망토|클로크|cloak/.test(name)) return 'cloak';
    return null;  // 명시적 cape가 아니면 layer 없음
};

/**
 * helmet — 모자/투구 추론. armor name에서 추론 (별도 slot이 없으므로).
 */
const resolveHelmetKey = (armorItem) => {
    if (!armorItem) return null;
    const name = String(armorItem.name || '');
    if (/투구|helm/.test(name)) return 'helm';
    if (/후드|hood/.test(name)) return 'hood';
    if (/모자|hat/.test(name)) {
        if (/짚/.test(name)) return 'straw-hat';
        if (/마법|wizard/.test(name)) return 'wizard-hat';
        return 'cap';
    }
    return null;
};

/**
 * 캐릭터의 현재 player state로부터 layer 합성용 PNG path를 결정.
 *
 * @param {object} player
 * @returns {null | {
 *   body: string,
 *   cape?: string,
 *   armor?: string,
 *   boots?: string,
 *   weapon?: string,
 *   helmet?: string,
 *   layerOrder: string[],
 * }}
 *
 * body가 manifest에 없으면 null 반환 → 폴백 (cycle 46 직업 sprite).
 * 각 부분 layer는 manifest에 있으면만 path 반환.
 */
export const resolveCharacterLayers = (player) => {
    if (!player?.job) return null;

    const bodyKey = resolveBodyKey(player.job);
    if (!LAYERED_MANIFEST.body.has(bodyKey)) {
        return null;  // body 자산 없음 → 폴백
    }

    const layers = {
        body: `/assets/avatars/layers/body/${bodyKey}.png`,
        layerOrder: [],
    };

    // 각 layer를 순서대로 검사 (manifest에 있으면 추가)
    const armorKey = resolveArmorKey(player.equip?.armor);
    if (armorKey && LAYERED_MANIFEST.armor.has(armorKey)) {
        layers.armor = `/assets/avatars/layers/armor/${armorKey}.png`;
    }

    const bootsKey = resolveBootsKey(player.equip?.armor);
    if (bootsKey && LAYERED_MANIFEST.boots.has(bootsKey)) {
        layers.boots = `/assets/avatars/layers/boots/${bootsKey}.png`;
    }

    const weaponKey = resolveWeaponKey(player.equip?.weapon);
    if (weaponKey && LAYERED_MANIFEST.weapon.has(weaponKey)) {
        layers.weapon = `/assets/avatars/layers/weapon/${weaponKey}.png`;
    }

    const capeKey = resolveCapeKey(player.equip?.armor);
    if (capeKey && LAYERED_MANIFEST.cape.has(capeKey)) {
        layers.cape = `/assets/avatars/layers/cape/${capeKey}.png`;
    }

    const helmetKey = resolveHelmetKey(player.equip?.armor);
    if (helmetKey && LAYERED_MANIFEST.helmet.has(helmetKey)) {
        layers.helmet = `/assets/avatars/layers/helmet/${helmetKey}.png`;
    }

    // 합성 순서 (back → front)
    layers.layerOrder = LAYER_ORDER.filter((name) => layers[name]);
    return layers;
};

/**
 * UI 디버그용: 누락된 layer 목록 반환 (resolver는 진행해도 자산 없는 layer 키).
 */
export const getMissingLayers = (player) => {
    if (!player?.job) return [];
    const missing = [];
    const bodyKey = resolveBodyKey(player.job);
    if (!LAYERED_MANIFEST.body.has(bodyKey)) missing.push(`body:${bodyKey}`);

    const armorKey = resolveArmorKey(player.equip?.armor);
    if (armorKey && !LAYERED_MANIFEST.armor.has(armorKey)) missing.push(`armor:${armorKey}`);

    const weaponKey = resolveWeaponKey(player.equip?.weapon);
    if (weaponKey && !LAYERED_MANIFEST.weapon.has(weaponKey)) missing.push(`weapon:${weaponKey}`);

    return missing;
};
