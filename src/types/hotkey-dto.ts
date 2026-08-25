export type HotkeyMode = 'chat' | 'selection';

export interface HotkeyDTO {
  id: number;
  accelerator: string;
  mode: HotkeyMode;
  agentId: number | null;
  enabled: boolean;
}

export interface UpdateHotkeyPatch {
  accelerator?: string;
  agentId?: number | null;
  enabled?: boolean;
}
