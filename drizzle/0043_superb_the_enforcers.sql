CREATE TABLE `b2b_retailer_return_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`accessId` int NOT NULL,
	`customerId` int NOT NULL,
	`outletId` int,
	`b2bOrderId` int NOT NULL,
	`salesOrderId` int,
	`status` enum('requested','under_review','approved','rejected','closed') NOT NULL DEFAULT 'requested',
	`reason` text NOT NULL,
	`requestedByUserId` int NOT NULL,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`resolutionNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `b2b_retailer_return_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_return_request_order_open_unique` UNIQUE(`b2bOrderId`,`status`)
);
--> statement-breakpoint
CREATE INDEX `b2b_return_request_access_idx` ON `b2b_retailer_return_requests` (`organizationId`,`accessId`,`status`);--> statement-breakpoint
CREATE INDEX `b2b_return_request_sales_order_idx` ON `b2b_retailer_return_requests` (`organizationId`,`salesOrderId`);