CREATE TABLE `organization_exchange_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`baseCurrencyCode` varchar(8) NOT NULL,
	`quoteCurrencyCode` varchar(8) NOT NULL,
	`rate` decimal(18,8) NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'manual',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_exchange_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `exchange_rate_organization_pair_date_idx` ON `organization_exchange_rates` (`organizationId`,`baseCurrencyCode`,`quoteCurrencyCode`,`effectiveAt`);