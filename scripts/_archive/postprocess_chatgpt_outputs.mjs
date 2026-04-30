#!/usr/bin/env node
/**
 * postprocess_chatgpt_outputs.mjs
 *
 * 사용자가 ChatGPT/DALL-E 3에서 받은 PNG를 layered system에 맞게 자동 정규화.
 *
 * Input:  output/imagegen/staged-layered-raw/{layerType}/{key}.png
 * Output: output/imagegen/staged-layered/{layerType}/{key}.png
 *
 * 후처리:
 *   1. 흰색/단색 배경 제거 (PIL python — 자동 corner sample → 같은 색을 alpha 0)
 *   2. 256x256 canvas로 normalize (alpha bbox crop + 비율 유지 resize + 중앙 정렬)
 *
 * 그 후 deploy_layered_sprites.mjs를 실행하면 manifest 등록 + cap:sync.
 */

import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(REPO_ROOT, 'output/imagegen/staged-layered-raw');
const STAGED_DIR = path.join(REPO_ROOT, 'output/imagegen/staged-layered');

const LAYER_TYPES = ['body', 'cape', 'armor', 'boots', 'weapon', 'helmet'];

if (!existsSync(RAW_DIR)) {
    for (const t of LAYER_TYPES) mkdirSync(path.join(RAW_DIR, t), { recursive: true });
    console.log(`Raw 디렉토리 생성: ${RAW_DIR}`);
    console.log('\nChatGPT에서 받은 PNG를 다음 위치에 저장:');
    for (const t of LAYER_TYPES) {
        console.log(`  ${RAW_DIR}/${t}/{key}.png`);
    }
    console.log('\n예시:');
    console.log(`  ${RAW_DIR}/body/adventurer.png`);
    console.log(`  ${RAW_DIR}/weapon/dagger.png`);
    process.exit(0);
}

// PIL Python을 통한 후처리 (chunked Python script)
const pythonScript = `
import sys
from pathlib import Path
from PIL import Image
import json

def remove_solid_bg(img: Image.Image, tolerance: int = 30) -> Image.Image:
    """4 코너 픽셀의 평균색을 배경으로 간주하고 그 색에 가까운 픽셀을 alpha=0."""
    img = img.convert('RGBA')
    w, h = img.size
    pixels = img.load()
    # 4 코너 sample
    corners = [pixels[0, 0], pixels[w-1, 0], pixels[0, h-1], pixels[w-1, h-1]]
    # 평균
    avg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    # 픽셀 별 거리 검사 → tolerance 안쪽이면 alpha 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            dist = abs(r - avg[0]) + abs(g - avg[1]) + abs(b - avg[2])
            if dist < tolerance * 3:
                pixels[x, y] = (r, g, b, 0)
    return img

def normalize_to_256(img: Image.Image) -> Image.Image:
    """alpha bbox crop + 비율 유지 resize + 256x256 중앙 정렬."""
    img = img.convert('RGBA')
    bbox = img.getchannel('A').getbbox()
    if bbox:
        img = img.crop(bbox)
    src_w, src_h = img.size
    target_box = 240  # 256 - padding
    scale = min(target_box / src_w, target_box / src_h)
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    cx = (256 - new_w) // 2
    cy = (256 - new_h) // 2
    canvas.alpha_composite(img, (cx, cy))
    return canvas

def main():
    raw_dir = Path(sys.argv[1])
    staged_dir = Path(sys.argv[2])
    processed = []
    for layer_type_dir in raw_dir.iterdir():
        if not layer_type_dir.is_dir(): continue
        layer_type = layer_type_dir.name
        for png in layer_type_dir.glob('*.png'):
            key = png.stem
            try:
                img = Image.open(png)
                img = remove_solid_bg(img)
                img = normalize_to_256(img)
                out_path = staged_dir / layer_type / f'{key}.png'
                out_path.parent.mkdir(parents=True, exist_ok=True)
                img.save(out_path)
                processed.append({'layer': layer_type, 'key': key, 'output': str(out_path)})
                print(f'  ✓ {layer_type}/{key}', file=sys.stderr)
            except Exception as e:
                print(f'  ⚠️ {layer_type}/{key} 실패: {e}', file=sys.stderr)
    print(json.dumps(processed))

if __name__ == '__main__':
    main()
`;

try {
    const result = execSync(
        `python3 -c "${pythonScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}" "${RAW_DIR}" "${STAGED_DIR}"`,
        { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    const processed = JSON.parse(result.trim().split('\n').pop());
    console.log(`\n✓ ${processed.length}개 PNG 후처리 완료`);
    console.log(`  → ${STAGED_DIR}/{layerType}/{key}.png`);
    console.log('\n다음 단계:');
    console.log('  node scripts/deploy_layered_sprites.mjs');
} catch (err) {
    console.error('후처리 실패:', err.message);
    process.exit(1);
}
