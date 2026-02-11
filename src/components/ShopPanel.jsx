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

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 custom-scrollbar p-1">
                {shopMode === 'buy' ? (
                    buyItems.map((item, i) => (
                        <button
                            key={i}
                            onClick={() => actions.market('buy', item)}
                            className="flex flex-col justify-between p-3 bg-slate-800/80 rounded border border-slate-600 hover:bg-slate-700 hover:border-yellow-500/50 hover:shadow-lg transition-all group h-full"
                        >
                            <div className="text-left w-full mb-2">
                                <div className="font-bold text-slate-200 group-hover:text-yellow-300 transition-colors font-rajdhani">{item.name}</div>
                                <div className="text-xs text-slate-400 font-fira line-clamp-2 h-8">{item.desc_stat || item.desc}</div>
                            </div>
                            <div className="w-full flex justify-end border-t border-slate-700/50 pt-2">
                                <span className="text-yellow-400 font-fira font-bold">{item.price} CR</span>
                            </div>
                        </button>
                    ))
                ) : (
                    sellItems.length > 0 ? (
                        sellItems.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => actions.market('sell', item)}
                                className="flex flex-col justify-between p-3 bg-slate-800/80 rounded border border-slate-600 hover:bg-slate-700 hover:border-red-500/50 hover:shadow-lg transition-all group h-full"
                            >
                                <div className="text-left w-full mb-2">
                                    <div className="font-bold text-red-300 group-hover:text-red-200 font-rajdhani">{item.name}</div>
                                    <div className="text-xs text-slate-400 font-fira line-clamp-2 h-8">{item.desc_stat || item.desc}</div>
                                </div>
                                <div className="w-full flex justify-end border-t border-slate-700/50 pt-2">
                                    <span className="text-yellow-400 font-fira font-bold">+{Math.floor(item.price * 0.5)} CR</span>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="col-span-full text-center text-slate-500 py-10 font-rajdhani border border-dashed border-slate-700 rounded">
                            NO ITEMS TO SELL
                        </div>
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
