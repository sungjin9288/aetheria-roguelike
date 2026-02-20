import React from 'react';

/**
 * EventPanel - Dynamic event choice UI
 * Separated from ControlPanel for cleaner architecture
 */
const EventPanel = ({ currentEvent, actions }) => {
    if (!currentEvent) return null;
    const choices = Array.isArray(currentEvent.choices) ? currentEvent.choices.slice(0, 3) : [];
    const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';

    return (
        <div className={`${overlayPanelClass} bg-slate-900/95 z-20 p-3 md:p-4 rounded border border-slate-700 flex flex-col`}>
            <h2 className="text-xl text-purple-500 font-bold mb-4">🔮 운명의 선택</h2>
            <div className="flex-1 flex flex-col justify-center gap-4">
                {choices.length > 0 ? choices.map((choice, idx) => (
                    <button
                        key={`${choice}_${idx}`}
                        onClick={() => actions.handleEventChoice(idx)}
                        className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left"
                    >
                        <span className="font-bold text-slate-200">
                            {idx + 1}. {choice}
                        </span>
                    </button>
                )) : (
                    <button
                        onClick={() => actions.setGameState('idle')}
                        className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left font-bold text-slate-200"
                    >
                        이벤트를 종료합니다.
                    </button>
                )}
            </div>
        </div>
    );
};

export default EventPanel;
