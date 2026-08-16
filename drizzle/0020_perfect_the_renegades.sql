CREATE TABLE `production_quality_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productionOrderId` int NOT NULL,
	`productionOutputId` int NOT NULL,
	`batchId` int NOT NULL,
	`checkType` varchar(120) NOT NULL,
	`result` enum('pass','fail') NOT NULL,
	`numericValue` decimal(18,6),
	`notes` text,
	`inspectorUserId` int NOT NULL,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_quality_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `production_quality_org_order_idx` ON `production_quality_checks` (`organizationId`,`productionOrderId`);--> statement-breakpoint
CREATE INDEX `production_quality_org_batch_idx` ON `production_quality_checks` (`organizationId`,`batchId`);