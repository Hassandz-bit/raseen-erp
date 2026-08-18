CREATE TABLE `demo_seed_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`datasetVersion` varchar(32) NOT NULL,
	`status` enum('ready','seeding','failed','deleted') NOT NULL DEFAULT 'ready',
	`seededAt` timestamp,
	`resetAt` timestamp,
	`lastActionByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demo_seed_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `demo_seed_run_organization_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
ALTER TABLE `organizations` ADD `isDemo` enum('yes','no') DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `activeOrganizationId` int;--> statement-breakpoint
CREATE INDEX `demo_seed_status_idx` ON `demo_seed_runs` (`status`);--> statement-breakpoint
CREATE INDEX `user_preferences_active_organization_idx` ON `user_preferences` (`activeOrganizationId`);