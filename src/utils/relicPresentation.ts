const relicLanguage: Array<[RegExp, string]> = [
    [/EXP/g, '경험'],
    [/ATK/g, '공격력'],
    [/DEF/g, '방어력'],
    [/저HP에서/g, '생명이 낮을 때'],
    [/저HP/g, '생명이 낮을 때'],
    [/HP/g, '생명'],
    [/MP/g, '기력'],
    [/크리티컬/g, '치명타'],
    [/크리(?![가-힣])/g, '치명타'],
    [/스킬/g, '기술'],
    [/\bCD\b/g, '재사용'],
    [/쿨타임|쿨다운/g, '재사용 대기'],
    [/킬 스택/g, '처치 누적'],
    [/스택/g, '누적'],
    [/드롭률/g, '획득 확률'],
    [/드롭/g, '전리품 획득'],
    [/버프/g, '강화 효과'],
    [/시너지/g, '조합'],
    [/전 스탯/g, '모든 능력치'],
    [/상태이상/g, '상태 이상'],
    [/런당/g, '모험당'],
    [/랜덤/g, '무작위'],
];

export const formatRelicText = (value: unknown) => relicLanguage.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value ?? ''),
);

export const getRelicDisplayName = (name: unknown) => formatRelicText(name);
