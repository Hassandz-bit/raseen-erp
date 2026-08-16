CREATE TABLE `manufacturing_product_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`manufacturingType` enum('raw_material','packaging_material','semi_finished','finished_good','consumable','by_product') NOT NULL,
	`requiresQualityCheck` enum('yes','no') NOT NULL DEFAULT 'no',
	`defaultShelfLifeDays` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manufacturing_product_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `manufacturing_profile_org_product_unique` UNIQUE(`organizationId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `production_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productionOrderId` int NOT NULL,
	`category` enum('labor','energy','cleaning','setup','other') NOT NULL,
	`amount` decimal(18,6) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`exchangeRateSnapshot` decimal(18,8),
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_line_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE INDEX `production_expense_org_order_idx` ON `production_expenses` (`organizationId`,`productionOrderId`);