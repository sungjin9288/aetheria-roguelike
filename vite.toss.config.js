import { mergeConfig } from 'vite';

import baseConfig from './vite.config.js';

export default mergeConfig(baseConfig, {
    publicDir: '.toss/public',
    build: {
        outDir: process.env.AETHERIA_TOSS_BUNDLE_DIR || 'dist-toss',
        emptyOutDir: true,
    },
});
