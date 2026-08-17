CREATE TABLE `bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`bankName` varchar(180) NOT NULL,
	`accountNumberMasked` varchar(64),
	`currencyCode` varchar(8) NOT NULL,
	`accountId` int NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_account_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `bank_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`bankAccountId` int NOT NULL,
	`direction` enum('in','out','transfer_in','transfer_out') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`referenceType` varchar(64),
	`referenceId` int,
	`counterpartyName` varchar(180),
	`notes` text,
	`journalEntryId` int,
	`idempotencyKey` varchar(128),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_movement_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `cash_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`fromType` enum('cashbox','bank') NOT NULL,
	`fromId` int NOT NULL,
	`toType` enum('cashbox','bank') NOT NULL,
	`toId` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`sourceMovementId` int,
	`destinationMovementId` int,
	`journalEntryId` int,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_transfer_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `cashbox_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cashboxId` int NOT NULL,
	`direction` enum('in','out','transfer_in','transfer_out') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`referenceType` varchar(64),
	`referenceId` int,
	`counterpartyName` varchar(180),
	`notes` text,
	`journalEntryId` int,
	`idempotencyKey` varchar(128),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashbox_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `cashbox_movement_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `cashboxes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`accountId` int NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cashboxes_id` PRIMARY KEY(`id`),
	CONSTRAINT `cashbox_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `payable_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`supplierId` int NOT NULL,
	`purchaseOrderId` int,
	`paymentAccountType` enum('cashbox','bank') NOT NULL,
	`paymentAccountId` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`journalEntryId` int,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payable_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payable_payment_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `bank_account_org_branch_idx` ON `bank_accounts` (`organizationId`,`branchId`);--> statement-breakpoint
CREATE INDEX `bank_movement_org_bank_date_idx` ON `bank_movements` (`organizationId`,`bankAccountId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `cash_transfer_org_date_idx` ON `cash_transfers` (`organizationId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `cashbox_movement_org_cashbox_date_idx` ON `cashbox_movements` (`organizationId`,`cashboxId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `cashbox_org_branch_idx` ON `cashboxes` (`organizationId`,`branchId`);--> statement-breakpoint
CREATE INDEX `payable_payment_org_supplier_idx` ON `payable_payments` (`organizationId`,`supplierId`,`occurredAt`);