import type { LucideIcon } from 'lucide-react';

/** 조작판의 행동 단추 1건의 정적 서술(descriptor) — 마을 시설 · 빠른 행동 · 원정 도크가 같은 모양을 읽는다. */
export interface ControlButton {
  key: string;
  testId: string;
  icon: LucideIcon;
  label: string;
  mobileLabel?: string;
  onClick: () => void;
  disabled?: boolean;
}
