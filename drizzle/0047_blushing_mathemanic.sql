CREATE TABLE `organization_recovery_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`action` enum('safety_snapshot_created','restore_completed','restore_failed') NOT NULL,
	`backupChecksum` varchar(64) NOT NULL,
	`snapshotKey` varchar(512),
	`summary` json NOT NULL,
	`actorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_recovery_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `organization_recovery_events_org_created_idx` ON `organization_recovery_events` (`organizationId`,`createdAt`);