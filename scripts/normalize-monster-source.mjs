import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const checkOnly = args[0] === '--check';
const [source, destination] = checkOnly ? args.slice(1) : args;
if (!source || args.length !== 2 || (!checkOnly && (!destination || source.startsWith('--')))) {
    throw new Error('Usage: normalize-monster-source.mjs --check source.png | source.png new-export.png');
}
const bytes = await readFile(source);
if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('Monster source must be a PNG');
}
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const result = await page.evaluate(async ({ dataUrl, checkOnly }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        let transparentPixels = 0;
        let visiblePixels = 0;
        for (let offset = 3; offset < pixels.length; offset += 4) {
            if (pixels[offset] === 0) transparentPixels++;
            if (pixels[offset] >= 128) visiblePixels++;
        }
        if (!transparentPixels) throw new Error('Monster source has no transparent background');
        if (!visiblePixels) throw new Error('Monster source has no visible pixels');
        if (checkOnly) return { width: image.width, height: image.height, transparentPixels, visiblePixels };

        canvas.width = canvas.height = 160;
        const scale = 144 / Math.max(image.width, image.height);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        context.imageSmoothingEnabled = false;
        context.drawImage(image, Math.floor((160 - width) / 2), Math.floor((160 - height) / 2), width, height);
        return canvas.toDataURL('image/png').split(',')[1];
    }, { dataUrl: `data:image/png;base64,${bytes.toString('base64')}`, checkOnly });
    if (checkOnly) console.log(JSON.stringify(result));
    else await writeFile(destination, Buffer.from(result, 'base64'), { flag: 'wx' });
} finally {
    await browser.close();
}
