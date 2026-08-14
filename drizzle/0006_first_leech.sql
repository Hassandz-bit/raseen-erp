CREATE TABLE `organization_currencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`decimalPlaces` int NOT NULL DEFAULT 2,
	`displayStyle` enum('symbol','code','symbol_and_code') NOT NULL DEFAULT 'symbol',
	`isBase` enum('yes','no') NOT NULL DEFAULT 'no',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_currencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_currency_code_unique` UNIQUE(`organizationId`,`currencyCode`)
);
--> statement-breakpoint
ALTER TABLE `user_preferences` MODIFY COLUMN `fontScale` enum('small','normal','large','extra_large') NOT NULL DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `numeralStyle` enum('western','arabic_indic') DEFAULT 'western' NOT NULL;--> statement-breakpoint
CREATE INDEX `organization_currency_active_idx` ON `organization_currencies` (`organizationId`,`status`);