import React from 'react';
import { Sword, Zap, ArrowRight, Map as MapIcon, Home, ShoppingBag, Moon, GraduationCap, ScrollText, Hammer, Ghost, X } from 'lucide-react';
import { DB } from '../data/db';

const ControlPanel = ({ gameState, player, actions, setGameState, shopItems, grave, isAiThinking }) => {
    const mapData = DB.MAPS[player.loc];

    if (gameState === 'combat') {
        return (
            <div className="grid grid-cols-3 gap-2 mt-4">

                <button disabled={isAiThinking} onClick={() => actions.combat('attack')} className="bg-red-900/40 hover:bg-red-800 border border-red-700 p-4 rounded text-red-200 font-bold flex flex-col items-center disabled:opacity-50"><Sword /> 공격</button>
                <button disabled={isAiThinking} onClick={() => actions.combat('skill')} className="bg-blue-900/40 hover:bg-blue-800 border border-blue-700 p-4 rounded text-blue-200 font-bold flex flex-col items-center disabled:opacity-50"><Zap /> 기술 (10MP)</button>
                <button disabled={isAiThinking} onClick={() => actions.combat('escape')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-4 rounded text-slate-300 font-bold flex flex-col items-center disabled:opacity-50"><ArrowRight /> 도망</button>
            </div>
        );
    }

    // EVENT MODE (DynaEvent)
    if (gameState === 'event' && isAiThinking) {
        return <div className="mt-4 p-4 border border-slate-700 rounded bg-slate-900 text-center animate-pulse text-purple-400">운명의 갈림길이 생성되고 있습니다...</div>;
    }
    if (gameState === 'event' && !isAiThinking) {
        // In a real scenario, we'd pass event data here. For now, assuming event description is in logs and we need buttons.
        // But we stored event in state.currentEvent!
        // We need to access it. App -> Panel passes generic props. We need to add 'currentEvent' to ControlPanel props.
        return (
            <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
                <h2 className="text-xl text-purple-500 font-bold mb-4">🔮 운명의 선택</h2>
                <div className="flex-1 flex flex-col justify-center gap-4">
                    <button onClick={() => actions.handleEventChoice(0)} className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left">
                        <span className="font-bold text-slate-200">1. {player.currentEvent?.choices?.[0] || "선택지 1"}</span>
                    </button>
                    <button onClick={() => actions.handleEventChoice(1)} className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left">
                        <span className="font-bold text-slate-200">2. {player.currentEvent?.choices?.[1] || "선택지 2"}</span>
                    </button>
                </div>
            </div>
        );
    }

    // SHOP MODE
    if (gameState === 'shop') {
        const [shopMode, setShopMode] = React.useState('buy');
        const loc = player.loc;

        // Tier Logic
        let maxTier = 1;
        if (loc === '사막 오아시스') maxTier = 2;
        if (loc === '북부 요새') maxTier = 4; // High Tier

        // Trade Logic
        const buyItems = shopItems.filter(i => (i.tier || 1) <= maxTier);
        const sellItems = player.inv.filter(i => !String(i.id).startsWith('starter_')); // Prevent selling starters, safe ID check

        return (
            <div className="absolute inset-x-4 bottom-4 top-20 md:w-2/3 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl text-yellow-500 font-bold">🛒 상점 <span className="text-xs text-slate-500">({loc} - Tier {maxTier})</span></h2>
                    <div className="flex bg-slate-800 rounded p-1">
                        <button onClick={() => setShopMode('buy')} className={`px-3 py-1 text-xs rounded ${shopMode === 'buy' ? 'bg-yellow-600 text-white' : 'text-slate-400'}`}>구매</button>
                        <button onClick={() => setShopMode('sell')} className={`px-3 py-1 text-xs rounded ${shopMode === 'sell' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>판매</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-1 gap-2 custom-scrollbar">
                    {shopMode === 'buy' ? (
                        buyItems.map((item, i) => (
                            <button key={i} onClick={() => actions.market('buy', item)} className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-600 hover:bg-slate-700 group">
                                <div className="text-left">
                                    <div className="font-bold group-hover:text-yellow-200 transaction-colors">{item.name}</div>
                                    <div className="text-xs text-slate-400">{item.desc_stat || item.desc}</div>
                                </div>
                                <span className="text-yellow-400 font-mono">{item.price}G</span>
                            </button>
                        ))
                    ) : (
                        sellItems.length > 0 ? (
                            sellItems.map((item, i) => (
                                <button key={i} onClick={() => actions.market('sell', item)} className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-600 hover:bg-slate-700 group">
                                    <div className="text-left">
                                        <div className="font-bold text-red-300 group-hover:text-red-200">{item.name}</div>
                                        <div className="text-xs text-slate-400">{item.desc_stat || item.desc}</div>
                                    </div>
                                    <span className="text-yellow-400 font-mono">+{Math.floor(item.price * 0.5)}G</span>
                                </button>
                            ))
                        ) : (
                            <div className="text-center text-slate-500 py-4">판매할 아이템이 없습니다.</div>
                        )
                    )}
                </div>
                <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-slate-700 py-3 rounded hover:bg-slate-600">나가기</button>
            </div>
        );
    }

    // JOB CHANGE MODE
    if (gameState === 'job_change') {
        const current = DB.CLASSES[player.job];
        const avail = current.next || [];
        return (
            <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col items-center justify-center">
                <h2 className="text-2xl text-purple-400 font-bold mb-4">전직의 제단</h2>
                <div className="flex gap-2 flex-wrap justify-center">
                    {avail.map(job => (
                        <button key={job} onClick={() => actions.jobChange(job)} disabled={player.level < DB.CLASSES[job].reqLv} className="p-4 bg-slate-800 border border-purple-500 rounded hover:bg-slate-700 disabled:opacity-50">
                            <div className="text-lg font-bold">{job}</div>
                            <div className="text-xs">Lv.{DB.CLASSES[job].reqLv} 필요</div>
                        </button>
                    ))}
                    {avail.length === 0 && <div className="text-slate-500">더 이상 전직할 수 없습니다.</div>}
                </div>
                <button onClick={() => setGameState('idle')} className="mt-4 text-slate-400">나가기</button>
            </div>
        );
    }

    // QUEST BOARD MODE
    if (gameState === 'quest_board') {
        return (
            <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
                <h2 className="text-xl text-indigo-400 font-bold mb-4">📜 의뢰 게시판</h2>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {DB.QUESTS.map(q => (
                        <div key={q.id} className="bg-slate-800 p-3 rounded flex justify-between items-center">
                            <div>
                                <div className="font-bold">{q.title} <span className="text-xs text-slate-500">Lv.{q.minLv}+</span></div>
                                <div className="text-xs text-slate-400">{q.desc}</div>
                            </div>
                            <button onClick={() => actions.acceptQuest(q.id)} disabled={player.quests.some(pq => pq.id === q.id)} className="px-3 py-1 bg-indigo-600 rounded disabled:bg-slate-700 text-xs">
                                {player.quests.some(pq => pq.id === q.id) ? '수락됨' : '수락'}
                            </button>
                        </div>
                    ))}
                </div>
                <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-slate-700 py-3 rounded">나가기</button>
            </div>
        );
    }

    // CRAFTING MODE (Phase 2.2)
    if (gameState === 'crafting') {
        const recipes = DB.ITEMS.recipes || [];
        return (
            <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-amber-700 flex flex-col">
                <h2 className="text-xl text-amber-400 font-bold mb-4">🔨 제작소</h2>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                    {recipes.map(recipe => {
                        const canCraft = player.gold >= recipe.gold && recipe.inputs.every(input => {
                            return player.inv.filter(i => i.name === input.name).length >= input.qty;
                        });
                        return (
                            <div key={recipe.id} className={`bg-slate-800 p-3 rounded border ${canCraft ? 'border-amber-500' : 'border-slate-700'}`}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-amber-200">{recipe.name}</div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            재료: {recipe.inputs.map(i => `${i.name} x${i.qty}`).join(', ')} | {recipe.gold}G
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => actions.craft(recipe.id)}
                                        disabled={!canCraft}
                                        className="px-4 py-2 bg-amber-600 rounded disabled:bg-slate-700 disabled:text-slate-500 text-sm font-bold hover:bg-amber-500"
                                    >
                                        제작
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {recipes.length === 0 && <div className="text-slate-500 text-center py-4">레시피가 없습니다.</div>}
                </div>
                <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-slate-700 py-3 rounded">나가기</button>
            </div>
        );
    }

    // IDLE / MOVING
    return (
        <div className="mt-4">
            {gameState === 'moving' ? (
                <div className="flex flex-wrap gap-2">
                    {mapData.exits.map(exit => (
                        <button key={exit} disabled={isAiThinking} onClick={() => actions.move(exit)} className="px-4 py-3 bg-emerald-900/40 border border-emerald-700 rounded text-emerald-200 flex items-center gap-2 disabled:opacity-50"><MapIcon size={14} /> {exit}</button>
                    ))}
                    {player.loc !== '시작의 마을' && <button disabled={isAiThinking} onClick={() => actions.move('시작의 마을')} className="px-4 py-3 bg-yellow-900/40 border border-yellow-700 rounded text-yellow-200 disabled:opacity-50"><Home size={14} /> 마을로</button>}
                    <button onClick={() => setGameState('idle')} className="px-4 py-3 bg-slate-800 rounded">취소</button>
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    <button disabled={isAiThinking} onClick={actions.explore} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><MapIcon size={16} /> <span className="text-[10px]">탐색</span></button>
                    <button disabled={isAiThinking} onClick={() => setGameState('moving')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><ArrowRight size={16} /> <span className="text-[10px]">이동</span></button>
                    {mapData.type === 'safe' && (
                        <>
                            <button disabled={isAiThinking} onClick={() => { actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]); actions.setGameState('shop'); }} className="bg-yellow-900/30 hover:bg-yellow-800 border border-yellow-700 text-yellow-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><ShoppingBag size={16} /> <span className="text-[10px]">상점</span></button>
                            <button disabled={isAiThinking} onClick={actions.rest} className="bg-emerald-900/30 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><Moon size={16} /> <span className="text-[10px]">휴식</span></button>
                            <button disabled={isAiThinking} onClick={() => setGameState('job_change')} className="bg-purple-900/40 hover:bg-purple-800 border border-purple-700 text-purple-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><GraduationCap size={16} /> <span className="text-[10px]">전직</span></button>
                            <button disabled={isAiThinking} onClick={() => setGameState('quest_board')} className="bg-indigo-900/40 hover:bg-indigo-800 border border-indigo-700 text-indigo-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><ScrollText size={16} /> <span className="text-[10px]">의뢰</span></button>
                            <button disabled={isAiThinking} onClick={() => setGameState('crafting')} className="bg-amber-900/40 hover:bg-amber-800 border border-amber-700 text-amber-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><Hammer size={16} /> <span className="text-[10px]">제작</span></button>
                        </>
                    )}
                    {grave && grave.loc === player.loc && (
                        <button disabled={isAiThinking} onClick={actions.lootGrave} className="bg-slate-700 text-slate-300 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><Ghost size={16} /> <span className="text-[10px]">유해수습</span></button>
                    )}
                    <button disabled={isAiThinking} onClick={actions.reset} className="col-start-4 bg-red-950/30 text-red-500 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><X size={16} /> <span className="text-[10px]">초기화</span></button>
                </div>
            )}
        </div>
    );
};

export default ControlPanel;
