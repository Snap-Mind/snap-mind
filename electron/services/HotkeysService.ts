import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import { hotkeys } from '../db/schema.js';
import type { HotkeyMode, HotkeyRow } from '../db/schema.js';

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

function rowToDTO(row: HotkeyRow): HotkeyDTO {
  return {
    id: row.id,
    accelerator: row.accelerator,
    mode: row.mode as HotkeyMode,
    agentId: row.agentId,
    enabled: row.enabled === 1,
  };
}

export class HotkeysService {
  private db: BetterSQLite3Database<typeof schema>;

  constructor(db: BetterSQLite3Database<typeof schema>) {
    this.db = db;
  }

  listSync(): HotkeyDTO[] {
    return this.db
      .select()
      .from(hotkeys)
      .orderBy(asc(hotkeys.sortOrder), asc(hotkeys.id))
      .all()
      .map(rowToDTO);
  }

  async list(): Promise<HotkeyDTO[]> {
    return this.listSync();
  }

  async update(id: number, patch: UpdateHotkeyPatch): Promise<HotkeyDTO> {
    const existing = this.db.select().from(hotkeys).where(eq(hotkeys.id, id)).get();
    if (!existing) throw new Error(`Hotkey ${id} not found`);

    const values: Partial<HotkeyRow> = { updatedAt: Date.now() };
    if (patch.accelerator !== undefined) values.accelerator = patch.accelerator;
    if (patch.agentId !== undefined) values.agentId = patch.agentId ?? null;
    if (patch.enabled !== undefined) values.enabled = patch.enabled ? 1 : 0;

    this.db.update(hotkeys).set(values).where(eq(hotkeys.id, id)).run();
    return rowToDTO(this.db.select().from(hotkeys).where(eq(hotkeys.id, id)).get()!);
  }
}
