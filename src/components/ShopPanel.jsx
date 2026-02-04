import React, { useState } from 'react';
import { DB } from '../data/db';

/**
 * ShopPanel - Separated from ControlPanel to fix React hooks violation
 * Each component manages its own state properly
 */
const ShopPanel = ({ player, actions, shopItems, setGameState }) => {
    const [shopMode, setShopMode] = useState('buy');
    const loc = player.loc;

    // Tier Logic based on location
    let maxTier = 1;
    if (loc === '사막 오아시스') maxTier = 2;
    if (loc === '북부 요새') maxTier = 4;

    // Filter items by tier
    const buyItems = shopItems.filter(i => (i.tier || 1) <= maxTier);
    const sellItems = player.inv.filter(i => !String(i.id).startsWith('starter_'));

    return (
        <div className="absolute inset-x-4 bottom-4 top-20 md:w-2/3 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl text-yellow-500 font-bold">
                    🛒 상점 <span className="text-xs text-slate-500">({loc} - Tier {maxTier})</span>
                </h2>
                <div className="flex bg-slate-800 rounded p-1">
                    <button
                        onClick={() => setShopMode('buy')}
                        className={`px-3 py-1 text-xs rounded ${shopMode === 'buy' ? 'bg-yellow-600 text-white' : 'text-slate-400'}`}
                    >
                        구매
                    </button>
                    <button
                        onClick={() => setShopMode('sell')}
                        className={`px-3 py-1 text-xs rounded ${shopMode === 'sell' ? 'bg-red-600 text-white' : 'text-slate-400'}`}
                    >
                        판매
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 gap-2 custom-scrollbar">
                {shopMode === 'buy' ? (
                    buyItems.map((item, i) => (
                        <button
                            key={i}
                            onClick={() => actions.market('buy', item)}
                            className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-600 hover:bg-slate-700 group"
                        >
                            <div className="text-left">
                                <div className="font-bold group-hover:text-yellow-200 transition-colors">{item.name}</div>
                                <div className="text-xs text-slate-400">{item.desc_stat || item.desc}</div>
                            </div>
                            <span className="text-yellow-400 font-mono">{item.price}G</span>
                        </button>
                    ))
                ) : (
                    sellItems.length > 0 ? (
                        sellItems.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => actions.market('sell', item)}
                                className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-600 hover:bg-slate-700 group"
                            >
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
            <button
                onClick={() => setGameState('idle')}
                className="mt-4 w-full bg-slate-700 py-3 rounded hover:bg-slate-600"
            >
                나가기
            </button>
        </div>
    );
};

export default ShopPanel;
