CREATE TABLE `bank_reconciliation_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`reconciliationId` int NOT NULL,
	`bankMovementId` int,
	`statementReference` varchar(128),
	`statementDate` timestamp,
	`amount` decimal(18,2) NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`matchStatus` enum('matched','unmatched','excluded') NOT NULL DEFAULT 'unmatched',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_reconciliation_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_reconciliation_line_movement_unique` UNIQUE(`organizationId`,`reconciliationId`,`bankMovementId`)
);
--> statement-breakpoint
CREATE TABLE `bank_reconciliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`bankAccountId` int NOT NULL,
	`statementDate` timestamp NOT NULL,
	`statementEndingBalance` decimal(18,2) NOT NULL,
	`systemBalance` decimal(18,2) NOT NULL,
	`difference` decimal(18,2) NOT NULL,
	`status` enum('draft','reviewed','approved','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_reconciliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_reconciliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cashboxId` int NOT NULL,
	`reconciledAt` timestamp NOT NULL,
	`expectedBalance` decimal(18,2) NOT NULL,
	`actualBalance` decimal(18,2) NOT NULL,
	`difference` decimal(18,2) NOT NULL,
	`reason` text,
	`status` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_reconciliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bank_reconciliation_line_org_reconciliation_idx` ON `bank_reconciliation_lines` (`organizationId`,`reconciliationId`);--> statement-breakpoint
CREATE INDEX `bank_reconciliation_org_bank_date_idx` ON `bank_reconciliations` (`organizationId`,`bankAccountId`,`statementDate`);--> statement-breakpoint
CREATE INDEX `cash_reconciliation_org_cashbox_date_idx` ON `cash_reconciliations` (`organizationId`,`cashboxId`,`reconciledAt`);