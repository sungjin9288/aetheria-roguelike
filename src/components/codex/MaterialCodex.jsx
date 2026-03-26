import React, { useMemo } from 'react';
import { Lock, Eye } from 'lucide-react';
import { DB } from '../../data/db';
import { LOOT_TABLE } from '../../data/loot';

const MaterialCodex = ({ codex }) => {
    const materials = DB.ITEMS.materials || [];
    const matCodex = codex.materials || {};
    const discovered = Object.keys(matCodex).length;

    // 각 소재의 획득처 계산
    const matSources = useMemo(() => {
        const sources = {};
        for (const [monster, drops] of Object.entries(LOOT_TABLE)) {
            for (const itemName of drops) {
                if (!sources[itemName]) sources[itemName] = [];
                sources[itemName].push(monster);
            }
        }
        return sources;
    }, []);

    return (
        <div className="space-y-2">
            <div className="text-[10px] font-fira text-slate-500">
                {discovered}/{materials.length} 소재 발견
            </div>

            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto custom-scrollbar">
                {materials.map(mat => {
                    const found = !!matCodex[mat.name];
                    const sources = matSources[mat.name] || [];

                    return (
                        <div
                            key={mat.name}
                            className={`p-2.5 rounded-[0.95rem] border text-xs transition-all
                                ${found
                                    ? 'bg-black/18 border-white/8'
                                    : 'bg-black/10 border-white/6 opacity-25'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {found
                                    ? <Eye size={12} className="text-amber-300 shrink-0" />
                                    : <Lock size={12} className="text-slate-600 shrink-0" />
                                }
                                <span className={`font-rajdhani font-bold truncate ${found ? 'text-white' : 'text-slate-600'}`}>
                                    {found ? mat.name : '???'}
                                </span>
                                {found && (
                                    <span className="ml-auto text-[10px] font-fira text-amber-200">{mat.price}G</span>
                                )}
                            </div>
                            {found && sources.length > 0 && (
                                <div className="mt-1 text-[9px] font-fira text-slate-500 pl-5 truncate">
                                    드롭: {sources.slice(0, 4).join(', ')}{sources.length > 4 ? ` +${sources.length - 4}` : ''}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MaterialCodex;
