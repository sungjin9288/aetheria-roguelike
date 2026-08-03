import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pngInfo = async (path) => {
    const file = await readFile(new URL(path, import.meta.url));
    assert.equal(file.subarray(1, 4).toString('ascii'), 'PNG');
    return {
        width: file.readUInt32BE(16),
        height: file.readUInt32BE(20),
        colorType: file[25],
        bytes: file.length,
    };
};

test('native and web display names use the short Aetheria brand', async () => {
    const capacitor = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
    const infoPlist = await readFile(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
    const launchScreen = await readFile(new URL('../ios/App/App/Base.lproj/LaunchScreen.storyboard', import.meta.url), 'utf8');
    const androidStrings = await readFile(new URL('../android/app/src/main/res/values/strings.xml', import.meta.url), 'utf8');
    const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const aetherMark = await readFile(new URL('../src/components/AetherMark.tsx', import.meta.url), 'utf8');

    assert.equal(capacitor.appName, 'Aetheria');
    assert.equal(capacitor.backgroundColor, '#03070D');
    assert.match(infoPlist, /<key>CFBundleDisplayName<\/key>\s*<string>Aetheria<\/string>/);
    assert.doesNotMatch(launchScreen, /systemBackgroundColor/);
    assert.match(launchScreen, /red="0\.011764705882352941" green="0\.027450980392156862" blue="0\.050980392156862744"/);
    assert.match(launchScreen, /text="AETHERIA"/);
    assert.match(androidStrings, /<string name="app_name">Aetheria<\/string>/);
    assert.match(androidStrings, /<string name="title_activity_main">Aetheria<\/string>/);
    assert.equal(manifest.name, 'Aetheria');
    assert.equal(manifest.short_name, 'Aetheria');
    assert.match(html, /html, body, #root \{ background: #03070d; \}/);
    assert.match(aetherMark, /src="\/icons\/icon-192\.png"/);
});

test('app icon masters have release dimensions and no iOS alpha channel', async () => {
    const ios = await pngInfo('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
    const web512 = await pngInfo('../public/icons/icon-512.png');
    const web192 = await pngInfo('../public/icons/icon-192.png');
    const appleTouch = await pngInfo('../public/apple-touch-icon.png');

    assert.deepEqual([ios.width, ios.height], [1024, 1024]);
    assert.equal(ios.colorType, 2);
    assert.ok(ios.bytes > 100_000);
    assert.deepEqual([web512.width, web512.height], [512, 512]);
    assert.deepEqual([web192.width, web192.height], [192, 192]);
    assert.deepEqual([appleTouch.width, appleTouch.height], [180, 180]);
});

test('Android launcher and native splash assets cover every density', async () => {
    const launcherSizes = {
        mdpi: 48,
        hdpi: 72,
        xhdpi: 96,
        xxhdpi: 144,
        xxxhdpi: 192,
    };

    for (const [density, size] of Object.entries(launcherSizes)) {
        const icon = await pngInfo(`../android/app/src/main/res/mipmap-${density}/ic_launcher.png`);
        const round = await pngInfo(`../android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`);
        assert.deepEqual([icon.width, icon.height], [size, size]);
        assert.deepEqual([round.width, round.height], [size, size]);
    }

    const iosSplash = await pngInfo('../ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png');
    const androidPortrait = await pngInfo('../android/app/src/main/res/drawable-port-xxxhdpi/splash.png');
    assert.deepEqual([iosSplash.width, iosSplash.height], [2732, 2732]);
    assert.deepEqual([androidPortrait.width, androidPortrait.height], [1280, 1920]);
});
