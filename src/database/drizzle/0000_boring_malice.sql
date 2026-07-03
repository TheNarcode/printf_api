CREATE TABLE `fcm_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fcm_tokens_token_unique` ON `fcm_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`order` text NOT NULL,
	`orientation` text NOT NULL,
	`color` text NOT NULL,
	`copies` text NOT NULL,
	`paper_format` text NOT NULL,
	`page_ranges` text NOT NULL,
	`number_up` text NOT NULL,
	`sides` text NOT NULL,
	`print_scaling` text NOT NULL,
	`document_format` text NOT NULL,
	`printed` integer
);
--> statement-breakpoint
CREATE INDEX `order_idx` ON `files` (`order`);--> statement-breakpoint
CREATE TABLE `metadata` (
	`file_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`pages` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`amount` real NOT NULL,
	`payment_request_id` text NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	`printer_name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_idx` ON `orders` (`email`);