import type { AiFallbackReason, AiRequestKind } from './aiEventPolicy';
import { getRuntimeProductEventContext } from './productEventContext';
import { appendProductEvent } from './localProductEventStore';

// 원문·호출 인자·uid는 이 경계를 통과하지 않는다.
export const recordLocalAiFallback = (requestKind: AiRequestKind, reason: AiFallbackReason): void => {
    try {
        const context = getRuntimeProductEventContext();
        if (!context) return;
        const { releaseId, runtime, os, sessionId } = context;
        appendProductEvent({ name: 'ai_fallback', releaseId, runtime, os, sessionId, requestKind, reason });
    } catch { /* 관측 실패는 폴백 게임 흐름을 중단하지 않는다. */ }
};
