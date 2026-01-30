import React from 'react';
import { Sword, Flame, Snowflake, Leaf, Mountain, Sun, Moon } from 'lucide-react';


export const ELEMENTS = {
    '물리': { icon: <Sword size={12} />, strong: [], weak: [] },
    '화염': { icon: <Flame size={12} className="text-orange-500" />, strong: ['자연', '냉기'], weak: ['대지', '물'] },
    '냉기': { icon: <Snowflake size={12} className="text-cyan-400" />, strong: ['화염', '대지'], weak: ['빛'] },
    '자연': { icon: <Leaf size={12} className="text-green-500" />, strong: ['대지', '물'], weak: ['화염'] },
    '대지': { icon: <Mountain size={12} className="text-amber-700" />, strong: ['냉기'], weak: ['자연'] },
    '빛': { icon: <Sun size={12} className="text-yellow-400" />, strong: ['어둠'], weak: ['자연'] },
    '어둠': { icon: <Moon size={12} className="text-purple-500" />, strong: ['빛'], weak: ['화염'] }
};
