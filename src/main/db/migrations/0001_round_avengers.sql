CREATE TABLE `agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`instructions` text DEFAULT '' NOT NULL,
	`provider_id` integer,
	`model_id` integer,
	`config_json` text,
	`is_builtin` integer DEFAULT 0 NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`model_id`) REFERENCES `provider_models`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `hotkeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accelerator` text NOT NULL,
	`mode` text DEFAULT 'selection' NOT NULL,
	`agent_id` integer,
	`enabled` integer DEFAULT 1 NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO agents (name, description, instructions, provider_id, model_id, config_json, is_builtin, sort_order, created_at, updated_at) VALUES
('Default', 'Used for manual chat', '', NULL, NULL, NULL, 1, 10, 0, 0);
--> statement-breakpoint
INSERT INTO hotkeys (accelerator, mode, agent_id, enabled, sort_order, created_at, updated_at) VALUES
('CommandOrControl+`', 'chat', (SELECT id FROM agents WHERE is_builtin = 1), 1, 10, 0, 0),
('CommandOrControl+Shift+T', 'selection', NULL, 0, 20, 0, 0),
('CommandOrControl+Shift+E', 'selection', NULL, 0, 30, 0, 0),
('CommandOrControl+Shift+S', 'selection', NULL, 0, 40, 0, 0);
