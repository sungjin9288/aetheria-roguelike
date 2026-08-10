import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
    appName: 'aetheria',
    brand: {
        primaryColor: '#03070d',
    },
    permissions: [],
    webView: {
        bounces: false,
        pullToRefreshEnabled: false,
        overScrollMode: 'never',
        allowsBackForwardNavigationGestures: false,
    },
    webBundleDir: 'dist-toss',
});
