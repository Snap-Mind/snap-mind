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

export type ModelCapability = 'chat' | 'reasoning' | 'vision' | 'tools' | 'image';
export type ProviderRow = typeof providers.$inferSelect;
export type ProviderModelRow = typeof providerModels.$inferSelect;
