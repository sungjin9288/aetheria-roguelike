import type { Player } from '../types/index.js';

/**
 * 플레이 설정의 켬/끔 판정 — 2026-10-26 소유자 결정 D3(진동) · D23(한 글자 단축키).
 *
 * 둘 다 **기본 켬**인 선택 필드다: 값이 없는 이전 세이브 · 새 캐릭터는 켬이고, 플레이어가 끈 경우(`false`)만 끔이다.
 * 그래서 `DATA_VERSION`을 올리지 않는다(마이그레이션은 settings의 다른 키를 그대로 넘긴다).
 * 화면(기록 탭 설정) · 단축키 처리기 · 진동 훅이 이 두 함수만 읽는다 — 소비처에서 `!== false`를 다시 쓰지 말 것.
 */
type SettingsSource = Pick<Player, 'settings'> | null | undefined;

export const isHapticsEnabled = (player: SettingsSource): boolean => player?.settings?.hapticsEnabled !== false;

export const isKeyboardShortcutsEnabled = (player: SettingsSource): boolean => (
    player?.settings?.keyboardShortcutsEnabled !== false
);
