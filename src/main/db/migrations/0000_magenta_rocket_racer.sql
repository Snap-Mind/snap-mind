CREATE TABLE `provider_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_id` integer NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`capabilities_json` text,
	`description` text,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_models_provider_model_unique` ON `provider_models` (`provider_id`,`model_id`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`host` text,
	`api_key` text,
	`description` text,
	`config_json` text,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO providers (kind, name, host, api_key, description, config_json, sort_order, created_at, updated_at) VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', '', NULL, NULL, 10, 0, 0),
('azure-openai', 'Azure OpenAI', 'https://{your-resource-name}.openai.azure.com', '', 'For Azure OpenAI, provide a base endpoint (e.g., https://{your-resource-name}.openai.azure.com)', '{"apiVersion":""}', 20, 0, 0),
('anthropic', 'Anthropic', 'https://api.anthropic.com', '', NULL, NULL, 30, 0, 0),
('google', 'Google AI', 'https://generativelanguage.googleapis.com/v1beta', '', NULL, '{"config":{"topK":40}}', 40, 0, 0),
('deepseek', 'DeepSeek', 'https://api.deepseek.com', '', NULL, NULL, 50, 0, 0),
('qwen', 'Qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', '', NULL, NULL, 60, 0, 0),
('ollama', 'Ollama (Local)', 'http://localhost:11434/api/chat', '', 'Use local models served by the Ollama runtime', NULL, 70, 0, 0);
