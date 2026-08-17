CREATE TABLE `budget_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`budgetId` int NOT NULL,
	`accountId` int NOT NULL,
	`fiscalPeriodId` int NOT NULL,
	`branchId` int,
	`costCenterId` int,
	`amount` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_line_org_unique_scope` UNIQUE(`organizationId`,`budgetId`,`accountId`,`fiscalPeriodId`,`branchId`,`costCenterId`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`fiscalYearId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('draft','approved','closed') NOT NULL DEFAULT 'draft',
	`notes` text,
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_org_year_name_unique` UNIQUE(`organizationId`,`fiscalYearId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `cost_centers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`dimensions` json,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cost_centers_id` PRIMARY KEY(`id`),
	CONSTRAINT `cost_center_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE INDEX `budget_line_org_budget_idx` ON `budget_lines` (`organizationId`,`budgetId`);--> statement-breakpoint
CREATE INDEX `budget_org_year_idx` ON `budgets` (`organizationId`,`fiscalYearId`);--> statement-breakpoint
CREATE INDEX `cost_center_org_branch_idx` ON `cost_centers` (`organizationId`,`branchId`);