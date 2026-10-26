import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { openModalFocusScope } from '../platform/modalFocus';

export type OverlayDialogRole = 'dialog' | 'alertdialog';

export interface OverlayDialogOptions {
    /** 화면 낭독기가 읽는 대화상자 이름(MSG). */
    readonly label: string;
    /** 닫는 길이 있는 대화상자만 넘긴다 — 없으면 Escape를 무시한다(필수 선택 화면). */
    readonly onEscape?: () => void;
    readonly role?: OverlayDialogRole;
}

export interface OverlayDialogProps {
    readonly ref: (node: HTMLElement | null) => (() => void) | undefined;
    readonly role: OverlayDialogRole;
    readonly 'aria-modal': true;
    readonly 'aria-label': string;
    readonly tabIndex: -1;
    readonly 'data-overlay-dialog': 'true';
    readonly style: CSSProperties;
}

// 대화상자 자체는 조작 칸이 아니라 포커스를 받아 두는 자리다 — 전체 화면 테두리 링을 그리지 않는다.
const DIALOG_CONTAINER_STYLE: CSSProperties = { outline: 'none' };

/**
 * 전체 화면 오버레이의 바깥 요소에 펼쳐 쓰는 대화상자 속성.
 * 포커스 가두기 · 배경 `inert` · Escape · 닫힌 뒤 포커스 되돌리기는 `platform/modalFocus.ts`가 소유한다.
 */
export function useOverlayDialog({ label, onEscape, role = 'dialog' }: OverlayDialogOptions): OverlayDialogProps {
    const onEscapeRef = useRef(onEscape);
    useEffect(() => {
        onEscapeRef.current = onEscape;
    }, [onEscape]);

    const ref = useCallback((node: HTMLElement | null) => {
        if (!node) return undefined;
        return openModalFocusScope(node, { getOnEscape: () => onEscapeRef.current });
    }, []);

    return {
        ref,
        role,
        'aria-modal': true,
        'aria-label': label,
        tabIndex: -1,
        'data-overlay-dialog': 'true',
        style: DIALOG_CONTAINER_STYLE,
    };
}
