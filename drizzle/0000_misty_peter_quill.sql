CREATE TABLE `request_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`tool` text NOT NULL,
	`outcome` text NOT NULL,
	`duration_ms` integer NOT NULL
);
