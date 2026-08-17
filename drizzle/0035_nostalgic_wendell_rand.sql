CREATE TABLE `b2b_retailer_outlets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`address` text,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`territoryId` int,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `b2b_retailer_outlets_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_outlet_org_customer_code_unique` UNIQUE(`organizationId`,`customerId`,`code`)
);
--> statement-breakpoint
CREATE INDEX `b2b_outlet_org_customer_idx` ON `b2b_retailer_outlets` (`organizationId`,`customerId`);