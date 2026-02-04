import React from 'react';

/**
 * EventPanel - Dynamic event choice UI
 * Separated from ControlPanel for cleaner architecture
 */
const EventPanel = ({ currentEvent, actions }) => {
    if (!currentEvent) return null;

    return (
        <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
            <h2 className="text-xl text-purple-500 font-bold mb-4">🔮 운명의 선택</h2>
            <div className="flex-1 flex flex-col justify-center gap-4">
                <button
                    onClick={() => actions.handleEventChoice(0)}
                    className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left"
                >
                    <span className="font-bold text-slate-200">
                        1. {currentEvent.choices?.[0] || "선택지 1"}
                    </span>
                </button>
                <button
                    onClick={() => actions.handleEventChoice(1)}
                    className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left"
                >
                    <span className="font-bold text-slate-200">
                        2. {currentEvent.choices?.[1] || "선택지 2"}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default EventPanel;
