/**
 * layeredCharacter.js — cycle 55 Job-Based Skin System.
 *
 * 진화 경로:
 *   - cycle 46: 직업 sprite 1장 (장비는 sprite에 영향 X)
 *   - cycle 47-53: 6 layer (cape+body+boots+armor+weapon+helmet) 합성 시도
 *     → AI 생성 PNG의 정밀 정합 한계로 "장비가 떠 있는" 모습 빈발
 *   - cycle 54-55 (현재): job-based skin 단일화
 *     → 14 직업 body PNG가 곧 14 스킨. 장비는 슬롯 UI + 스탯 + 세트효과로만 표현.
 *     → AI 한계 우회 + 시각 일관성 확보 + 모든 메이저 모바일 RPG 패턴 일치.
 *
 * Asset path:
 *   /assets/avatars/layers/body/{jobSlug}.png
 *
 * 폴백: body가 manifest에 없으면 cycle 46 직업 sprite로 폴백.
 *      (현재 14 직업 모두 manifest에 있어 폴백 거의 발생 X)
 */

import { JOB_SPRITE_SLUG_MAP } from './avatarSpriteCandidates.js';

/**
 * Layered asset manifest — body만 활성. 다른 layer set은 archive 자산
 * (cycle 47-53에서 만들어둔 PNG는 보존하되 합성에서 제외).
 *
 * 자산이 추가되면 키를 set에 등록하고, scripts/deploy_layered_sprites.mjs가
 * 자동으로 manifest를 갱신함.
 */
export const LAYERED_MANIFEST = Object.freeze({
    body: new Set([
        'adventurer', 'archmage', 'assassin', 'berserker', 'chronomancer', 'grand-mage', 'knight', 'mage', 'paladin', 'ranger', 'rogue', 'shadow-lord', 'warlock', 'warrior',
    ]),
    // cycle 55: 아래 set은 deploy 스크립트 호환을 위해 유지하되 사용 안 함.
    // 합성 로직(resolveCharacterLayers)이 body만 참조.
    cape:    new Set(['cloak']),
    armor:   new Set(['coat', 'leather', 'plate', 'robe']),
    boots:   new Set(['cloth', 'leather', 'plate']),
    weapon:  new Set(['axe', 'bow', 'dagger', 'spear', 'staff', 'sword']),
    helmet:  new Set(['cap', 'helm', 'hood', 'wizard-hat']),
});

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
 * 캐릭터 player state로부터 skin PNG path 결정 (cycle 55: body 단일).
 *
 * @param {object} player
 * @returns {null | { body: string, layerOrder: string[] }}
 *
 * body가 manifest에 없으면 null 반환 → 폴백 (cycle 46 직업 sprite).
 */
export const resolveCharacterLayers = (player) => {
    if (!player?.job) return null;

    const bodyKey = resolveBodyKey(player.job);
    if (!LAYERED_MANIFEST.body.has(bodyKey)) {
        return null;  // body 자산 없음 → 폴백
    }

    return {
        body: `/assets/avatars/layers/body/${bodyKey}.png`,
        layerOrder: ['body'],
    };
};

/**
 * UI 디버그용: 누락된 자산 목록 (cycle 55: body만 검사).
 */
export const getMissingLayers = (player) => {
    if (!player?.job) return [];
    const bodyKey = resolveBodyKey(player.job);
    if (!LAYERED_MANIFEST.body.has(bodyKey)) return [`body:${bodyKey}`];
    return [];
};
