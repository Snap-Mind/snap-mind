import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const providers = sqliteTable('providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  host: text('host'),
  apiKey: text('api_key'),
  description: text('description'),
  configJson: text('config_json'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const providerModels = sqliteTable(
  'provider_models',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    modelId: text('model_id').notNull(),
    name: text('name').notNull(),
    type: text('type'),
    capabilitiesJson: text('capabilities_json'),
    description: text('description'),
    sortOrder: integer('sort_order').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqPerProvider: uniqueIndex('provider_models_provider_model_unique').on(
      t.providerId,
      t.modelId
    ),
  })
);

export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  instructions: text('instructions').notNull().default(''),
  providerId: integer('provider_id').references(() => providers.id, { onDelete: 'set null' }),
  modelId: integer('model_id').references(() => providerModels.id, { onDelete: 'set null' }),
  configJson: text('config_json'),
  isBuiltin: integer('is_builtin').notNull().default(0),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const hotkeys = sqliteTable('hotkeys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accelerator: text('accelerator').notNull(),
  mode: text('mode').notNull().default('selection'),
  agentId: integer('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  enabled: integer('enabled').notNull().default(1),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type ModelCapability = 'chat' | 'reasoning' | 'vision' | 'tools' | 'image';
export type ProviderRow = typeof providers.$inferSelect;
export type ProviderModelRow = typeof providerModels.$inferSelect;
export type AgentRow = typeof agents.$inferSelect;
export type HotkeyRow = typeof hotkeys.$inferSelect;
export type HotkeyMode = 'chat' | 'selection';
