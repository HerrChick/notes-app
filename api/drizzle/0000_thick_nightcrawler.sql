CREATE TABLE `daily_notes` (
	`date` text PRIMARY KEY NOT NULL,
	`markdown` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_notes_updated_at_idx` ON `daily_notes` (`updated_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `todo_notes` (
	`todo_id` text PRIMARY KEY NOT NULL,
	`markdown` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_date` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`due_at` integer,
	`topic_name` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `todos_daily_date_idx` ON `todos` (`daily_date`);--> statement-breakpoint
CREATE INDEX `todos_status_idx` ON `todos` (`status`);--> statement-breakpoint
CREATE INDEX `todos_due_at_idx` ON `todos` (`due_at`);--> statement-breakpoint
CREATE INDEX `todos_topic_name_idx` ON `todos` (`topic_name`);--> statement-breakpoint
CREATE TABLE `topic_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_name` text NOT NULL,
	`daily_date` text NOT NULL,
	`content_markdown` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`topic_name`) REFERENCES `topics`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topic_entries_topic_name_idx` ON `topic_entries` (`topic_name`);--> statement-breakpoint
CREATE INDEX `topic_entries_daily_date_idx` ON `topic_entries` (`daily_date`);--> statement-breakpoint
CREATE INDEX `topic_entries_topic_daily_idx` ON `topic_entries` (`topic_name`,`daily_date`);--> statement-breakpoint
CREATE TABLE `topics` (
	`name` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);