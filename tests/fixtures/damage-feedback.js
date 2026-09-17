import React from 'react';
import { createRoot } from 'react-dom/client';
import { useDamageFlash } from '../../src/hooks/useDamageFlash.ts';

const root = createRoot(document.createElement('div'));
window.IS_REACT_ACT_ENVIRONMENT = true;
let feedback;
let renders = [];

function Probe({ hp, epoch }) {
    const { damageFlash, healFlash, damageAmount } = useDamageFlash(hp, epoch);
    feedback = { damageFlash, healFlash, damageAmount };
    renders.push(feedback);
    return null;
}

window.feedbackHarness = {
    async render(hp, epoch) {
        renders = [];
        await React.act(async () => root.render(React.createElement(Probe, { hp, epoch })));
        return { feedback, renders };
    },
    ticking: false,
    async tick(ms) {
        await React.act(() => new Promise((resolve) => {
            setTimeout(resolve, ms);
            window.feedbackHarness.ticking = true;
        }));
        window.feedbackHarness.ticking = false;
    },
    snapshot: () => feedback,
    unmount: () => root.unmount(),
};
