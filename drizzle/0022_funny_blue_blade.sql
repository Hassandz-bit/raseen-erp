CREATE TABLE `accounting_journals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(24) NOT NULL,
	`name` varchar(120) NOT NULL,
	`journalType` enum('sales','purchase','cash','bank','general','inventory','manufacturing') NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_journals_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounting_journal_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `accounting_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`mappingKey` varchar(96) NOT NULL,
	`debitAccountId` int NOT NULL,
	`creditAccountId` int NOT NULL,
	`taxAccountId` int,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounting_mapping_org_key_unique` UNIQUE(`organizationId`,`mappingKey`)
);
--> statement-breakpoint
CREATE TABLE `chart_of_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`nameAr` varchar(180) NOT NULL,
	`nameFr` varchar(180) NOT NULL,
	`nameEn` varchar(180) NOT NULL,
	`accountType` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`parentAccountId` int,
	`level` int NOT NULL DEFAULT 1,
	`allowManualPosting` enum('yes','no') NOT NULL DEFAULT 'yes',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chart_of_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `coa_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`fiscalYearId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('open','closed','locked') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fiscal_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('open','closed','locked') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fiscal_years_id` PRIMARY KEY(`id`),
	CONSTRAINT `fiscal_year_org_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`journalId` int NOT NULL,
	`fiscalPeriodId` int NOT NULL,
	`journalNumber` varchar(64) NOT NULL,
	`entryDate` timestamp NOT NULL,
	`reference` varchar(128),
	`description` text,
	`sourceModule` varchar(64),
	`sourceDocumentType` varchar(64),
	`sourceDocumentId` int,
	`currencyCode` varchar(8) NOT NULL,
	`exchangeRateSnapshot` decimal(18,8) NOT NULL DEFAULT '1',
	`status` enum('draft','posted','reversed','cancelled') NOT NULL DEFAULT 'draft',
	`reversedEntryId` int,
	`postedByUserId` int,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_entry_org_number_unique` UNIQUE(`organizationId`,`journalNumber`),
	CONSTRAINT `journal_entry_source_unique` UNIQUE(`organizationId`,`sourceModule`,`sourceDocumentType`,`sourceDocumentId`)
);
--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`journalEntryId` int NOT NULL,
	`accountId` int NOT NULL,
	`debit` decimal(18,2) NOT NULL DEFAULT '0',
	`credit` decimal(18,2) NOT NULL DEFAULT '0',
	`currencyCode` varchar(8) NOT NULL,
	`baseCurrencyAmount` decimal(18,2) NOT NULL,
	`branchId` int,
	`costCenterId` int,
	`partyId` int,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `coa_org_parent_idx` ON `chart_of_accounts` (`organizationId`,`parentAccountId`);--> statement-breakpoint
CREATE INDEX `fiscal_period_org_date_idx` ON `fiscal_periods` (`organizationId`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `journal_entry_org_period_idx` ON `journal_entries` (`organizationId`,`fiscalPeriodId`,`status`);--> statement-breakpoint
CREATE INDEX `journal_line_org_entry_idx` ON `journal_lines` (`organizationId`,`journalEntryId`);--> statement-breakpoint
CREATE INDEX `journal_line_org_account_idx` ON `journal_lines` (`organizationId`,`accountId`);