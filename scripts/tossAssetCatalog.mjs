import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

export const normalizePublicAssetPath = (runtimePath) => {
    if (typeof runtimePath !== 'string' || !runtimePath || runtimePath.includes('\\')) {
        throw new Error('Expected a safe public asset path');
    }

    const relativePath = runtimePath.replace(/^\/+/, '');
    const normalizedPath = path.posix.normalize(relativePath);
    if (
        !relativePath
        || normalizedPath !== relativePath
        || normalizedPath === '.'
        || normalizedPath.startsWith('../')
    ) {
        throw new Error('Expected a safe public asset path');
    }

    return `public/${normalizedPath}`;
};

const listFiles = async (directory, repoRoot) => {
    const entries = await readdir(path.join(repoRoot, directory), { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const relativePath = path.posix.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await listFiles(relativePath, repoRoot));
        else if (entry.isFile()) files.push(relativePath);
    }

    return files;
};

const listTopLevelFiles = async (directory, repoRoot) => (
    (await readdir(path.join(repoRoot, directory), { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => path.posix.join(directory, entry.name))
);

const codePointSort = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export const buildTossAssetCatalog = async ({ repoRoot }) => {
    const characterManifest = await readJson(path.join(repoRoot, 'src/data/characterArtManifest.json'));
    const equipmentManifest = await readJson(path.join(repoRoot, 'src/data/equipmentArtManifest.json'));
    const nonEquipmentManifest = await readJson(path.join(repoRoot, 'src/data/consumableArtManifest.json'));

    const characterFiles = Object.values(characterManifest.entries)
        .map((entry) => normalizePublicAssetPath(entry.runtimePath));
    const equipmentFiles = Object.values(equipmentManifest.entries)
        .map((assetKey) => `public/assets/equipment-exact/${assetKey}.png`);
    const equipmentFamilyFiles = Object.values(equipmentManifest.art.families)
        .map((entry) => normalizePublicAssetPath(entry.runtimePath));
    const signatureOverlayFiles = Object.values(equipmentManifest.art.signatureOverlays)
        .map((entry) => normalizePublicAssetPath(entry.runtimePath));
    const nonEquipmentFiles = Object.values(nonEquipmentManifest.entries)
        .map((assetKey) => `public/assets/items/${assetKey}.png`);
    const genericItemFiles = [
        'potion', 'material', 'ore', 'crystal', 'scale', 'fang',
        'bone', 'core', 'relic', 'herb', 'pouch', 'key',
    ].map((assetKey) => `public/assets/items/${assetKey}.png`);
    const compatibilityAvatarFiles = (await listTopLevelFiles('public/assets/avatars', repoRoot))
        .filter((file) => file.endsWith('.png'));

    const staticDirectories = [
        'public/assets/locations',
        'public/assets/monsters',
        'public/assets/relics',
    ];
    const staticFiles = (await Promise.all(
        staticDirectories.map((directory) => listFiles(directory, repoRoot)),
    )).flat();
    const shellFiles = [
        'public/apple-touch-icon.png',
        'public/icons/icon-192.png',
        'public/icons/icon-512.png',
        'public/manifest.webmanifest',
        'public/assets/intro/aetheria-starting-village.webp',
    ];

    const files = [...new Set([
        ...characterFiles,
        ...equipmentFiles,
        ...equipmentFamilyFiles,
        ...signatureOverlayFiles,
        ...nonEquipmentFiles,
        ...genericItemFiles,
        ...compatibilityAvatarFiles,
        ...staticFiles,
        ...shellFiles,
    ])]
        .filter((file) => file !== 'public/assets/locations/unknown-route.png')
        .sort(codePointSort);

    const missing = [];
    let totalBytes = 0;
    for (const file of files) {
        const absolutePath = path.join(repoRoot, file);
        try {
            const fileStat = await lstat(absolutePath);
            if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error('Not a regular file');
            totalBytes += fileStat.size;
        } catch {
            missing.push(file);
        }
    }

    return {
        version: 1,
        counts: {
            characters: characterFiles.length,
            equipment: equipmentFiles.length,
            equipmentFamilies: equipmentFamilyFiles.length,
            signatureOverlays: signatureOverlayFiles.length,
            nonEquipment: nonEquipmentFiles.length,
            compatibilityAvatars: compatibilityAvatarFiles.length,
        },
        files,
        filesSha256: createHash('sha256').update(files.join('\n')).digest('hex'),
        missing,
        totalBytes,
    };
};

export const stageTossAssets = async ({ repoRoot, outputRoot }) => {
    const catalog = await buildTossAssetCatalog({ repoRoot });
    if (catalog.missing.length > 0) {
        throw new Error(`Missing Toss assets: ${catalog.missing.join(', ')}`);
    }

    for (const file of catalog.files) {
        const relativePath = file.replace(/^public\//, '');
        const destination = path.join(outputRoot, relativePath);
        const source = path.join(repoRoot, normalizePublicAssetPath(`/${relativePath}`));
        const sourceStat = await lstat(source);
        if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
            throw new Error(`Unsafe Toss asset source: ${file}`);
        }
        await mkdir(path.dirname(destination), { recursive: true });
        await copyFile(source, destination);
    }

    return { catalog, copiedFiles: catalog.files.length };
};
