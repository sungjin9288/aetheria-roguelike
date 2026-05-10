import { useEffect } from 'react';
import { CONSTANTS } from '../data/constants';
import { GS } from '../reducers/gameStates';
import { AT } from '../reducers/actionTypes';
import { getPerfSnapshot, markPerf } from '../utils/performanceMarks';

/**
 * smoke test / dev harness용 window API 등록.
 * engineRef, fullStatsRef, inventorySpotlightRef 는 render 중 동기 갱신된 ref여야 한다.
 */
export const useGameTestApi = (engineRef: any, fullStatsRef: any, inventorySpotlightRef: any) => {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const avatarScenarioMap: Record<string, any> = {
            'paladin-plate': {
                name: '성광 기사',
                job: '팔라딘',
                level: 24,
                loc: '북부 요새',
                equip: {
                    weapon: { id: 'smoke-paladin-blade', name: '성광 롱소드', type: 'weapon', hands: 1, elem: '빛', enhance: 4 },
                    offhand: { id: 'smoke-paladin-shield', name: '축성 방패', type: 'shield', elem: '빛', enhance: 2 },
                    armor: { id: 'smoke-paladin-armor', name: '성기사의 갑주', type: 'armor', elem: '빛', enhance: 3 },
                },
            },
            'archmage-robe': {
                name: '성운 현자',
                job: '아크메이지',
                level: 28,
                loc: '별의 제단',
                equip: {
                    weapon: { id: 'smoke-archmage-staff', name: '혜성의 지팡이', type: 'weapon', hands: 2, elem: '냉기', enhance: 5 },
                    offhand: { id: 'smoke-archmage-focus', name: '시간의 마도서', type: 'shield', subtype: 'focus', elem: '빛', enhance: 2 },
                    armor: { id: 'smoke-archmage-robe', name: '세계수의 로브', type: 'armor', elem: '자연', enhance: 4 },
                },
            },
            'shadow-lord-leather': {
                name: '야영 그림자',
                job: '그림자 주군',
                level: 31,
                loc: '무너진 회랑',
                equip: {
                    weapon: { id: 'smoke-shadow-dagger', name: '균열 단검', type: 'weapon', hands: 1, elem: '어둠', enhance: 6 },
                    offhand: { id: 'smoke-shadow-offhand', name: '밤의 송곳니', type: 'weapon', hands: 1, elem: '어둠', enhance: 5 },
                    armor: { id: 'smoke-shadow-armor', name: '균열 외피갑옷', type: 'armor', elem: '어둠', enhance: 4 },
                },
            },
            'ranger-coat': {
                name: '숲길 추적자',
                job: '레인저',
                level: 22,
                loc: '고요한 숲',
                equip: {
                    weapon: { id: 'smoke-ranger-bow', name: '바람 사냥활', type: 'weapon', hands: 2, elem: '자연', enhance: 3 },
                    offhand: null,
                    armor: { id: 'smoke-ranger-coat', name: '전설의 사냥꾼 외투', type: 'armor', elem: '자연', enhance: 3 },
                },
            },
            'berserker-plate': {
                name: '혈풍 광전사',
                job: '버서커',
                level: 27,
                loc: '붉은 협곡',
                equip: {
                    weapon: { id: 'smoke-berserker-axe', name: '광전사의 도끼', type: 'weapon', hands: 2, elem: '화염', enhance: 5 },
                    offhand: null,
                    armor: { id: 'smoke-berserker-armor', name: '혼돈의 갑주', type: 'armor', elem: '어둠', enhance: 4 },
                },
            },
            'adventurer-straw-hat': {
                name: '들녘 신참',
                job: '모험가',
                level: 6,
                loc: '시작의 마을',
                equip: {
                    weapon: { id: 'smoke-adventurer-dagger', name: '녹슨 단검', type: 'weapon', hands: 1, enhance: 1 },
                    offhand: null,
                    armor: { id: 'smoke-adventurer-hat', name: '짚 모자', type: 'armor', enhance: 0 },
                },
            },
            'adventurer-travel-tunic': {
                name: '길잡이 견습',
                job: '모험가',
                level: 6,
                loc: '시작의 마을',
                equip: {
                    weapon: { id: 'smoke-adventurer-axe', name: '녹슨 도끼', type: 'weapon', hands: 1, enhance: 1 },
                    offhand: { id: 'smoke-adventurer-shield', name: '목재 방패', type: 'shield', enhance: 0 },
                    armor: { id: 'smoke-adventurer-tunic', name: '여행자 튜닉', type: 'armor', enhance: 0 },
                },
            },
            'legendary-loadout': {
                name: '전설 연출',
                job: '팔라딘',
                level: 50,
                loc: '세계의 끝',
                equip: {
                    weapon: { id: 'smoke-legendary-weapon', name: '성검 에테르니아', type: 'weapon', hands: 1, elem: '빛', tier: 5, enhance: 7 },
                    offhand: { id: 'smoke-legendary-offhand', name: '천공 성전', type: 'shield', subtype: 'focus', elem: '빛', tier: 5, enhance: 5 },
                    armor: { id: 'smoke-legendary-armor', name: '드래곤로드 갑주', type: 'armor', elem: '화염', tier: 5, enhance: 6 },
                },
                inv: [
                    { id: 'smoke-legendary-inv-1', name: '마왕의 대낫', type: 'weapon', hands: 2, elem: '어둠', tier: 5, enhance: 6 },
                    { id: 'smoke-legendary-inv-2', name: '라그나로크', type: 'weapon', hands: 2, elem: '화염', tier: 5, enhance: 5 },
                    { id: 'smoke-legendary-inv-3', name: '세계수의 지팡이', type: 'weapon', hands: 2, elem: '자연', tier: 5, enhance: 4 },
                    { id: 'smoke-legendary-inv-4', name: '에테르 그리모어', type: 'shield', subtype: 'focus', elem: '어둠', tier: 6, enhance: 3 },
                    { id: 'smoke-legendary-inv-5', name: '빙결의 왕관검', type: 'weapon', hands: 1, elem: '냉기', tier: 5, enhance: 4 },
                ],
            },
        };

        const safeText = (value: any, fallback: any = '') => {
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (value && typeof value === 'object') {
                for (const key of ['label', 'text', 'id', 'name', 'desc']) {
                    try {
                        const candidate = value[key];
                        if (typeof candidate === 'string') return candidate;
                        if (typeof candidate === 'number' || typeof candidate === 'boolean') return String(candidate);
                    } catch {
                        continue;
                    }
                }
                return fallback;
            }
            return fallback;
        };
        const safeList = (items: any, fallback: any = '[item]') => (
            Array.isArray(items) ? items.map((item: any) => safeText(item, fallback)) : []
        );
        const sanitizeValue = (value: any, depth: any = 0): any => {
            if (depth > 6) return '[max-depth]';
            if (value == null) return value;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
            if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return `[${typeof value}]`;
            if (Array.isArray(value)) return value.map((entry: any) => sanitizeValue(entry, depth + 1));
            if (typeof value !== 'object') return null;

            try {
                const tag = Object.prototype.toString.call(value);
                if (tag === '[object Date]') return value.toISOString();
                if (tag !== '[object Object]') return safeText(value, tag);
            } catch {
                return '[unserializable]';
            }

            const next: Record<string, any> = {};
            for (const key of Object.keys(value)) {
                try {
                    next[key] = sanitizeValue(value[key], depth + 1);
                } catch {
                    next[key] = '[unserializable]';
                }
            }
            return next;
        };

        window.render_game_to_text = () => {
            const e = engineRef.current;
            const fs = fullStatsRef.current;
            const is = inventorySpotlightRef.current;
            return JSON.stringify(sanitizeValue({
                bootStage: e.bootStage,
                mode: e.gameState === GS.DEAD && e.runSummary
                    ? 'run_summary'
                    : !e.player.name
                        ? 'intro'
                        : 'game',
                gameState: e.gameState,
                isAiThinking: e.isAiThinking,
                syncStatus: e.syncStatus,
                player: {
                    name: e.player.name || '',
                    job: e.player.job,
                    level: e.player.level,
                    loc: e.player.loc,
                    hp: e.player.hp,
                    maxHp: fs.maxHp,
                    mp: e.player.mp,
                    maxMp: fs.maxMp,
                    gold: e.player.gold,
                },
                enemy: e.enemy
                    ? {
                        name: e.enemy.name,
                        baseName: e.enemy.baseName || e.enemy.name,
                        hp: e.enemy.hp,
                        maxHp: e.enemy.maxHp,
                        isBoss: Boolean(e.enemy.isBoss),
                        phase2Triggered: Boolean(e.enemy.phase2Triggered),
                    }
                    : null,
                currentEvent: e.currentEvent
                    ? {
                        desc: safeText(e.currentEvent.desc),
                        choices: safeList(e.currentEvent.choices, '[choice]'),
                    }
                    : null,
                pendingRelics: Array.isArray(e.pendingRelics) ? e.pendingRelics.map((r: any) => r.name) : null,
                postCombatResult: e.postCombatResult
                    ? {
                        enemy: safeText(e.postCombatResult.enemy),
                        exp: e.postCombatResult.exp,
                        gold: e.postCombatResult.gold,
                        items: safeList(e.postCombatResult.items),
                    }
                    : null,
                inventorySpotlight: is
                    ? { token: is.token, title: safeText(is.title), names: safeList(is.names) }
                    : null,
                runSummary: e.runSummary
                    ? { level: e.runSummary.level, job: e.runSummary.job, loc: e.runSummary.loc }
                    : null,
                sideTab: e.sideTab,
                logTail: e.logs.slice(-6).map((log: any) => ({ type: log.type, text: log.text })),
            }));
        };

        // cycle 593: window.advanceTime dead method 제거 — 정의만 있고 read
        //   0건 (src/scripts/tests 어디에서도 호출 0건). cycle 329에서 정리한
        //   3 dead methods (getState/clearPostCombat/injectAscensionPreview)
        //   동일 lens 회귀.
        // cycle 329: getState / clearPostCombat / injectAscensionPreview 3 dead methods 제거.
        //   scripts/, tests/, docs 어디에서도 호출 0건. Playwright QA 훅 잔존이었던 것 정리.
        window.__AETHERIA_TEST_API__ = {
            getDomMetrics: () => {
                const rect = (node: any) => {
                    if (!(node instanceof HTMLElement)) return null;
                    const bounds = node.getBoundingClientRect();
                    return {
                        top: Math.round(bounds.top),
                        bottom: Math.round(bounds.bottom),
                        left: Math.round(bounds.left),
                        right: Math.round(bounds.right),
                        width: Math.round(bounds.width),
                        height: Math.round(bounds.height),
                    };
                };

                const panel = document.querySelector('[data-testid="terminal-panel"]');
                const scrollViewport = panel?.querySelector('.custom-scrollbar');
                const firstLog = panel?.querySelector('.aether-panel-muted');
                const archiveButton = document.querySelector('[data-testid="mobile-console-open-archive"]');
                const panelStyle = panel instanceof HTMLElement ? window.getComputedStyle(panel) : null;
                const scrollStyle = scrollViewport instanceof HTMLElement ? window.getComputedStyle(scrollViewport) : null;

                return {
                    panel: rect(panel),
                    scrollViewport: rect(scrollViewport),
                    archiveButton: rect(archiveButton),
                    firstLog: rect(firstLog),
                    panelStyle: panelStyle ? {
                        display: panelStyle.display,
                        flexDirection: panelStyle.flexDirection,
                        justifyContent: panelStyle.justifyContent,
                        alignItems: panelStyle.alignItems,
                        paddingTop: panelStyle.paddingTop,
                        paddingBottom: panelStyle.paddingBottom,
                    } : null,
                    scrollStyle: scrollStyle ? {
                        display: scrollStyle.display,
                        flex: scrollStyle.flex,
                        alignSelf: scrollStyle.alignSelf,
                        marginTop: scrollStyle.marginTop,
                        marginBottom: scrollStyle.marginBottom,
                    } : null,
                    panelChildren: panel instanceof HTMLElement
                        ? Array.from(panel.children).map((child: any) => ({
                            tag: child.tagName,
                            className: child.className,
                            position: window.getComputedStyle(child).position,
                            ...rect(child),
                        }))
                        : [],
                    scrollTop: scrollViewport instanceof HTMLElement ? Math.round(scrollViewport.scrollTop) : null,
                    scrollHeight: scrollViewport instanceof HTMLElement ? Math.round(scrollViewport.scrollHeight) : null,
                    clientHeight: scrollViewport instanceof HTMLElement ? Math.round(scrollViewport.clientHeight) : null,
                };
            },
            getPerfSnapshot: () => getPerfSnapshot(),
            markPerf: (name: any) => markPerf(name),
            resetGame: () => engineRef.current.actions.reset?.(),
            sendCommand: (command: any) => engineRef.current.handleCommand(command),
            setSideTab: (tab: any) => engineRef.current.actions.setSideTab?.(tab),
            seedEnhanceScenario: ({ gold = 500, materialCount = 0, weaponEnhance = 0 }: any = {}) => {
                const er = engineRef.current;
                const preservedInventory = (er.player.inv || []).filter((item: any) => item?.name !== CONSTANTS.ENHANCE_MATERIAL_NAME);
                const seededMaterials = Array.from({ length: materialCount }, (_: any, index: any) => ({
                    id: `smoke-enhance-material-${index}`,
                    name: CONSTANTS.ENHANCE_MATERIAL_NAME,
                    type: 'mat',
                    price: 40,
                    desc: '테스트용 강화 재료',
                    desc_stat: CONSTANTS.ENHANCE_MATERIAL_NAME,
                }));
                const nextWeapon = er.player.equip?.weapon || {
                    name: '테스트 검',
                    type: 'weapon',
                    tier: 1,
                    atk: 4,
                    enhance: 0,
                };

                er.dispatch({
                    type: AT.SET_PLAYER,
                    payload: {
                        gold,
                        inv: [...preservedInventory, ...seededMaterials],
                        equip: {
                            ...er.player.equip,
                            weapon: { ...nextWeapon, enhance: weaponEnhance },
                        },
                    },
                });
                er.dispatch({ type: AT.SET_SIDE_TAB, payload: 'equipment' });
            },
            seedAvatarScenario: (preset: any = 'paladin-plate') => {
                const er = engineRef.current;
                const scenario = avatarScenarioMap[preset];
                if (!scenario) return false;

                const payload: any = {
                    name: scenario.name,
                    job: scenario.job,
                    level: scenario.level,
                    loc: er.player.loc || scenario.loc,
                    hp: er.player.hp,
                    mp: er.player.mp,
                    equip: scenario.equip,
                };
                if (Array.isArray(scenario.inv)) {
                    payload.inv = scenario.inv;
                }
                er.dispatch({ type: AT.SET_PLAYER, payload });
                er.dispatch({ type: AT.SET_SIDE_TAB, payload: 'equipment' });
                return true;
            },
            injectPostCombatResult: () => {
                engineRef.current.dispatch({
                    type: AT.SET_POST_COMBAT_RESULT,
                    payload: {
                        enemy: '테스트 골렘',
                        exp: 22,
                        gold: 18,
                        items: ['룬 마도서', '강철 롱소드'],
                        leveledUp: false,
                        hpLow: false,
                        mpLow: false,
                        invFull: false,
                        upgradeHint: { name: '강철 롱소드', summary: 'ATK +4 / DEF +1' },
                        traitHint: { name: '룬 마도서', summary: '비전 성향과 잘 맞는 전리품입니다.' },
                    },
                });
            },
            injectRelicChoice: () => {
                engineRef.current.dispatch({
                    type: AT.SET_PENDING_RELICS,
                    payload: [
                        { id: 'test_relic_amber', name: '황혼의 파편', desc: '치명타 확률 +3%, 휴식 비용 -10%', rarity: 'epic', effect: 'crit_mp_regen' },
                        { id: 'test_relic_cyan', name: '심해의 매듭', desc: '전투 시작 시 MP 12 회복', rarity: 'uncommon', effect: 'mp_regen_turn' },
                        { id: 'test_relic_violet', name: '균열의 서판', desc: '스킬 피해 18% 증가', rarity: 'rare', effect: 'skill_mult' },
                    ],
                });
            },
            injectRunSummary: () => {
                const er = engineRef.current;
                er.dispatch({
                    type: AT.SET_RUN_SUMMARY,
                    payload: {
                        level: 17, job: '모험가', loc: '북부 요새',
                        kills: 142, bossKills: 3, relicsFound: 5,
                        totalGold: 1842, prestigeRank: 2, activeTitle: 'veteran',
                    },
                });
                er.dispatch({ type: AT.SET_GAME_STATE, payload: GS.DEAD });
            },
            injectEvent: () => {
                const er = engineRef.current;
                er.dispatch({
                    type: AT.SET_EVENT,
                    payload: {
                        desc: '[TEST EVENT] 낡은 봉인이 흔들립니다. 어떻게 대응하시겠습니까?',
                        choices: ['봉인을 조사한다', '안전하게 후퇴한다'],
                        outcomes: [
                            { choiceIndex: 0, gold: 40, log: '[TEST EVENT] 봉인 조각에서 40G를 회수했습니다.' },
                            { choiceIndex: 1, hp: 10, log: '[TEST EVENT] 안전하게 후퇴하며 호흡을 가다듬었습니다.' },
                        ],
                    },
                });
                er.dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
            },
        };

        return () => {
            delete window.render_game_to_text;
            // cycle 593: window.advanceTime delete paired removal (정의 자체 제거됨).
            delete window.__AETHERIA_TEST_API__;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
