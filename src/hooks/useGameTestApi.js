import { useEffect } from 'react';
import { GS } from '../reducers/gameStates';
import { getPerfSnapshot, markPerf } from '../utils/performanceMarks';

/**
 * smoke test / dev harness용 window API 등록.
 * engineRef, fullStatsRef, inventorySpotlightRef 는 render 중 동기 갱신된 ref여야 한다.
 */
export const useGameTestApi = (engineRef, fullStatsRef, inventorySpotlightRef) => {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        window.render_game_to_text = () => {
            const e = engineRef.current;
            const fs = fullStatsRef.current;
            const is = inventorySpotlightRef.current;
            return JSON.stringify({
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
                        desc: e.currentEvent.desc || '',
                        choices: Array.isArray(e.currentEvent.choices) ? e.currentEvent.choices : [],
                    }
                    : null,
                pendingRelics: Array.isArray(e.pendingRelics) ? e.pendingRelics.map((r) => r.name) : null,
                postCombatResult: e.postCombatResult
                    ? {
                        enemy: e.postCombatResult.enemy,
                        exp: e.postCombatResult.exp,
                        gold: e.postCombatResult.gold,
                        items: e.postCombatResult.items || [],
                    }
                    : null,
                inventorySpotlight: is
                    ? { token: is.token, title: is.title, names: is.names || [] }
                    : null,
                runSummary: e.runSummary
                    ? { level: e.runSummary.level, job: e.runSummary.job, loc: e.runSummary.loc }
                    : null,
                sideTab: e.sideTab,
                logTail: e.logs.slice(-6).map((log) => ({ type: log.type, text: log.text })),
            });
        };

        window.advanceTime = (ms = 0) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

        window.__AETHERIA_TEST_API__ = {
            getState: () => JSON.parse(window.render_game_to_text()),
            getPerfSnapshot: () => getPerfSnapshot(),
            markPerf: (name) => markPerf(name),
            resetGame: () => engineRef.current.actions.reset?.(),
            sendCommand: (command) => engineRef.current.handleCommand(command),
            clearPostCombat: () => engineRef.current.actions.clearPostCombat?.(),
            setSideTab: (tab) => engineRef.current.actions.setSideTab?.(tab),
            injectPostCombatResult: () => {
                engineRef.current.dispatch({
                    type: 'SET_POST_COMBAT_RESULT',
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
                    type: 'SET_PENDING_RELICS',
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
                    type: 'SET_RUN_SUMMARY',
                    payload: {
                        level: 17, job: '모험가', loc: '북부 요새',
                        kills: 142, bossKills: 3, relicsFound: 5,
                        totalGold: 1842, prestigeRank: 2, activeTitle: 'veteran',
                    },
                });
                er.dispatch({ type: 'SET_GAME_STATE', payload: GS.DEAD });
            },
            injectAscensionPreview: () => {
                const er = engineRef.current;
                er.dispatch({
                    type: 'SET_PLAYER',
                    payload: {
                        meta: {
                            ...(er.player.meta || {}),
                            prestigeRank: 1, bonusAtk: 4, bonusHp: 20, bonusMp: 10, essence: 320,
                        },
                    },
                });
                er.dispatch({ type: 'SET_GAME_STATE', payload: GS.ASCENSION });
            },
            injectEvent: () => {
                const er = engineRef.current;
                er.dispatch({
                    type: 'SET_EVENT',
                    payload: {
                        desc: '[TEST EVENT] 낡은 봉인이 흔들립니다. 어떻게 대응하시겠습니까?',
                        choices: ['봉인을 조사한다', '안전하게 후퇴한다'],
                        outcomes: [
                            { choiceIndex: 0, gold: 40, log: '[TEST EVENT] 봉인 조각에서 40G를 회수했습니다.' },
                            { choiceIndex: 1, hp: 10, log: '[TEST EVENT] 안전하게 후퇴하며 호흡을 가다듬었습니다.' },
                        ],
                    },
                });
                er.dispatch({ type: 'SET_GAME_STATE', payload: GS.EVENT });
            },
        };

        return () => {
            delete window.render_game_to_text;
            delete window.advanceTime;
            delete window.__AETHERIA_TEST_API__;
        };
    }, []);
};
