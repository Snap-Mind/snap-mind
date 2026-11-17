import type { JsonSchema } from '../runtime/types.js';
import type { Risk } from '../permission/modes.js';

export type ToolContext = {
  runId: string;
  toolCallId: string;
  abortSignal: AbortSignal;
};

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  risk: Risk;
  execute(_input: unknown, _ctx: ToolContext): Promise<unknown>;
};

export class ToolRegistry {
  private tools: Map<string, ToolDef> = new Map();

  register(def: ToolDef): void {
    if (def.name === 'invoke_agent') {
      throw new Error('Tool name "invoke_agent" is reserved.');
    }
    if (this.tools.has(def.name)) {
      throw new Error(`Tool "${def.name}" is already registered.`);
    }
    this.tools.set(def.name, def);
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  list(): ToolDef[] {
    return Array.from(this.tools.values());
  }
}
