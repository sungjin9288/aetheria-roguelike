/** 도시 시설은 유지하되, 명시적으로 선택한 조사에서만 조우한다. */
export const canInvestigateTown = (
    location: string | undefined,
    map: { type?: string; monsters?: readonly string[] } | undefined,
) => location === '황금 왕국'
    && map?.type === 'safe'
    && Boolean(map.monsters?.length);
