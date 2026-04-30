import React from 'react';
import { getAvailableCommands } from '../utils/commandSuggestions';

/**
 * CommandAutocomplete — 커맨드 자동완성 드롭다운 (Feature #9)
 */
const CommandAutocomplete = ({ input, gameState, player, onSelect }) => {
    const commands = getAvailableCommands(gameState, player);

    if (!input.trim() || input.length < 1) return null;

    const lower = input.toLowerCase().replace(/^\//, '');
    const filtered = commands.filter(c =>
        c.cmd.toLowerCase().startsWith(lower) && c.cmd.toLowerCase() !== lower
    ).slice(0, 5);

    if (filtered.length === 0) return null;

    return (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-cyber-black/95 border border-cyber-blue/30 rounded-lg overflow-hidden backdrop-blur-xl z-50 shadow-[0_-5px_20px_rgba(0,204,255,0.1)]">
            {filtered.map((item, i) => (
                <button
                    key={i}
                    onMouseDown={(e) => { e.preventDefault(); onSelect(item.cmd); }}
                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-cyber-blue/10 transition-all group"
                >
                    <span className="text-cyber-blue font-fira text-sm">{item.cmd}</span>
                    <span className="text-cyber-blue/40 text-xs font-fira group-hover:text-cyber-blue/60">{item.desc}</span>
                </button>
            ))}
        </div>
    );
};

export default CommandAutocomplete;
