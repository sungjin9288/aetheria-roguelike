#!/usr/bin/env node
/**
 * generate_chatgpt_prompts.mjs
 *
 * cycle 47 layered character system을 위한 ChatGPT (DALL-E 3) 친화 prompt 생성.
 *
 * 핵심:
 *   - DALL-E 3는 자연어 prompt 친화적 (Korean OK)
 *   - 짧고 명확한 description 선호
 *   - reference image 첨부 권장 (사용자가 ChatGPT 채팅에 adventurer.png 첨부)
 *
 * 출력:
 *   output/chatgpt-prompts.txt — 사용자가 ChatGPT에 batch로 던질 prompt 명단
 *   output/chatgpt-batch.md — 작업 흐름 가이드 (Markdown)
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'output');
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const STYLE_REF = `chibi pixel art game asset, 256x256 transparent background, soft warm shading, dark outline rgb(42,31,46), warm color palette, mobile RPG style, no shadow ground, no text, no border. Match style of attached reference image.`;

// Tier 1 — 모험가 풀 set (20개)
const TIER_1 = [
    // body
    { layer: 'body', key: 'adventurer', kr: '여행자 모험가', en: 'young adventurer hero, brown short hair, friendly determined face, plain white tunic and brown pants only, no armor no weapon no cape, arms relaxed at sides with open hands, neutral standing pose. Body layer base — other equipment will overlay on top.' },

    // cape
    { layer: 'cape', key: 'cloak', kr: '파란 망토', en: 'ONLY a flowing royal blue cloak, transparent everywhere except the cloak fabric itself, positioned as if worn behind a chibi character (shoulder to ankles), no body, no character, this is the BACK layer.' },

    // armor
    { layer: 'armor', key: 'leather', kr: '가죽 갑옷', en: 'ONLY a leather jerkin armor with belts and pouches, transparent everywhere except the armor pixels, positioned to fit a chibi character chest and torso (covers shoulders to waist), no body underneath, no character.' },
    { layer: 'armor', key: 'plate', kr: '판금 갑옷', en: 'ONLY shiny full plate armor with gold trim, transparent everywhere except the armor, positioned to fit a chibi character chest and torso, no body, no character.' },
    { layer: 'armor', key: 'robe', kr: '마법사 로브', en: 'ONLY a flowing wizard robe with runed sash, purple/blue color, transparent everywhere except the robe fabric, positioned to fit a chibi character body, no character underneath.' },
    { layer: 'armor', key: 'coat', kr: '여행자 외투', en: 'ONLY a brown leather travel coat with belts, transparent everywhere except the coat, positioned to fit a chibi character torso, no body, no character.' },

    // boots
    { layer: 'boots', key: 'leather', kr: '가죽 부츠', en: 'ONLY a pair of sturdy brown leather boots, transparent everywhere except the boots, positioned at the bottom-center as if on a chibi character feet, no legs, no body.' },
    { layer: 'boots', key: 'plate', kr: '판금 부츠', en: 'ONLY a pair of armored steel boots, transparent everywhere except the boots, positioned at bottom-center, no legs, no body.' },
    { layer: 'boots', key: 'cloth', kr: '천 신발', en: 'ONLY a pair of simple cloth shoes, transparent everywhere except the shoes, positioned at bottom-center, no legs, no body.' },

    // weapon
    { layer: 'weapon', key: 'dagger', kr: '단검', en: 'ONLY a single small iron dagger, transparent everywhere except the dagger, positioned in the right-hand area of a chibi character (~70% x, mid-height), held diagonally pointing up-right, no hand, no character.' },
    { layer: 'weapon', key: 'sword', kr: '검', en: 'ONLY a single steel longsword, transparent everywhere except the sword, positioned in right-hand area held diagonally pointing up-right, no hand, no character.' },
    { layer: 'weapon', key: 'staff', kr: '마법 지팡이', en: 'ONLY a single wooden magic staff with glowing blue orb at top, transparent everywhere except the staff, positioned in right-hand area extending from mid-height upward, no hand, no character.' },
    { layer: 'weapon', key: 'bow', kr: '활', en: 'ONLY a single wooden shortbow with a single arrow drawn, transparent everywhere except the bow, positioned in right-hand area, no hand, no character.' },
    { layer: 'weapon', key: 'axe', kr: '도끼', en: 'ONLY a single battle axe, transparent everywhere except the axe, positioned in right-hand area held diagonally, no hand, no character.' },
    { layer: 'weapon', key: 'spear', kr: '창', en: 'ONLY a single iron spear with sharp tip, transparent everywhere except the spear, positioned vertically in right-hand area, no hand, no character.' },

    // helmet
    { layer: 'helmet', key: 'cap', kr: '가죽 모자', en: 'ONLY a simple brown leather cap, transparent everywhere except the cap, positioned at top-center as if on a chibi character head, no head, no face.' },
    { layer: 'helmet', key: 'hood', kr: '천 후드', en: 'ONLY a pulled-up cloth hood (gray or brown), transparent everywhere except the hood, positioned at top-center as if on a chibi character head, no head, no face.' },
    { layer: 'helmet', key: 'helm', kr: '강철 투구', en: 'ONLY a steel knight helm, transparent everywhere except the helm, positioned at top-center as if on a chibi character head, no head, no face.' },
    { layer: 'helmet', key: 'wizard-hat', kr: '마법사 모자', en: 'ONLY a tall pointy purple wizard hat with stars, transparent everywhere except the hat, positioned at top-center, no head.' },
    { layer: 'helmet', key: 'straw-hat', kr: '짚 모자', en: 'ONLY a rustic straw farmer hat, transparent everywhere except the hat, positioned at top-center, no head.' },
];

const buildPrompt = (entry) => `${entry.en}\n\nStyle: ${STYLE_REF}`;

const txtLines = [
    '# ChatGPT (DALL-E 3) batch prompts — Tier 1 모험가 layered set',
    '#',
    '# 작업 방법 (사용자):',
    '#   1. ChatGPT 새 채팅 시작',
    '#   2. 첫 메시지에 reference image 첨부:',
    '#      public/assets/avatars/adventurer.png 또는 adventurer-coat.png 파일',
    '#   3. 아래 prompt를 하나씩 던지기 (또는 batch 메시지로)',
    '#   4. 받은 PNG를 다음 폴더에 저장:',
    '#      output/imagegen/staged-layered-raw/{layerType}/{key}.png',
    '#   5. node scripts/postprocess_chatgpt_outputs.mjs 실행 → 자동 배경 제거 + 정규화',
    '#   6. node scripts/deploy_layered_sprites.mjs 실행 → manifest 갱신 + cap:sync',
    '#',
    '# Tier 1 = 20개 (모험가 풀 set, 30-60분 소요)',
    '#',
];

for (const entry of TIER_1) {
    txtLines.push(`\n## ${entry.layer}/${entry.key} (${entry.kr})`);
    txtLines.push(`save_to: output/imagegen/staged-layered-raw/${entry.layer}/${entry.key}.png`);
    txtLines.push(`prompt:\n${buildPrompt(entry)}`);
    txtLines.push('');
}

writeFileSync(path.join(OUTPUT_DIR, 'chatgpt-prompts.txt'), txtLines.join('\n'));

const md = `# Tier 1 ChatGPT (DALL-E 3) 작업 가이드

## 1. 준비
- ChatGPT 새 채팅 시작 (GPT-4o 모델 사용 — DALL-E 3 통합)
- 첫 메시지에 reference image 첨부:
  - \`public/assets/avatars/adventurer.png\` (모험가 chibi 픽셀 캐릭터)
  - 이걸 보고 같은 스타일/팔레트/품질로 layer 자산 생성하라고 안내

## 2. 첫 메시지 (전체 컨텍스트 부여)
\`\`\`
First, please look at this reference image. I need you to generate 20 character layer
assets in the EXACT same chibi pixel art style — soft warm shading, dark outline,
warm palette, 256x256 size, transparent background.

Each layer is a SEPARATE transparent PNG that will be composited together to make
a full character. Critical rules:

1. Each layer must have ONLY the specific item (no body, no character underneath
   except for the body layer itself)
2. Transparent background everywhere except the actual item pixels
3. 256x256 square canvas, character/item centered with generous padding
4. Match the style of the reference image precisely

I will give you 20 prompts. For each, generate one PNG and tell me to download it.
\`\`\`

## 3. 각 prompt 던지기
\`output/chatgpt-prompts.txt\` 파일의 각 항목을 ChatGPT에 차례대로 입력.
받은 PNG는 \`save_to:\` 경로에 저장.

## 4. 자동 후처리 + deploy
\`\`\`bash
# 후처리 (배경 정리 + 256x256 normalize)
node scripts/postprocess_chatgpt_outputs.mjs

# 자동 deploy + manifest 갱신 + cap:sync
node scripts/deploy_layered_sprites.mjs

# Xcode → Clean Build → Run → 즉시 layered 시각 활성화
\`\`\`

## 5. 검증 포인트
- 모험가 캐릭터: 가죽 갑옷 + 단검 → body + leather + dagger 합성
- 무기 변경 (단검 → 검) → weapon layer만 swap (캐릭터는 같음, 손에 든 무기만 변경)
- armor 변경 (가죽 → 판금) → armor layer만 swap (옷만 갈아입음)
`;

writeFileSync(path.join(OUTPUT_DIR, 'chatgpt-batch.md'), md);

console.log(`Generated ChatGPT prompts:`);
console.log(`  TXT:  output/chatgpt-prompts.txt (${TIER_1.length}개 prompt)`);
console.log(`  GUIDE: output/chatgpt-batch.md`);
