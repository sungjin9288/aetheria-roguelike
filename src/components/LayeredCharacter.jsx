import React from 'react';

/**
 * LayeredCharacter — cycle 47 캐릭터 합성 컴포넌트.
 *
 * resolveCharacterLayers의 결과(layers 객체)를 받아 각 layer PNG를 같은 frame에
 * 절대 위치로 합성. 모든 layer는 같은 canvas size + transparent background이므로
 * 같은 inset-0 위치에 두면 anchor가 맞음.
 *
 * 자산 출처: scripts/generate_layered_sprite_prompts.mjs로 사용자가 imagegen
 * tool에서 받아 deploy_layered_sprites.mjs로 deploy.
 *
 * 폴백: layers === null이면 부모(PixelCharacterAvatar)에서 직업 sprite를 사용
 * (cycle 46). 본 컴포넌트는 layers !== null일 때만 호출.
 */
const LayeredCharacter = ({ layers, className = '', dataTestId = null }) => {
    if (!layers || !layers.body) return null;

    return (
        <div
            data-testid={dataTestId}
            data-layered="true"
            className={`relative h-full w-full ${className}`.trim()}
        >
            {layers.layerOrder.map((layerName) => (
                <img
                    key={layerName}
                    src={layers[layerName]}
                    alt=""
                    aria-hidden="true"
                    data-layer={layerName}
                    className="pointer-events-none absolute inset-0 h-full w-full object-contain pixelated"
                />
            ))}
        </div>
    );
};

export default LayeredCharacter;
