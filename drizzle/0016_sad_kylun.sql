CREATE TABLE `b2b_order_item_packaging_refs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`packagingLevelId` int NOT NULL,
	`orderedPackagingQuantity` decimal(18,6) NOT NULL,
	`baseQuantity` decimal(24,9) NOT NULL,
	`barcodeSnapshot` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `b2b_order_item_packaging_refs_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_item_packaging_ref_unique` UNIQUE(`organizationId`,`orderItemId`)
);
--> statement-breakpoint
CREATE TABLE `b2b_promotion_packaging_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`promotionId` int NOT NULL,
	`packagingLevelId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `b2b_promotion_packaging_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_promotion_packaging_target_unique` UNIQUE(`organizationId`,`promotionId`,`packagingLevelId`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_item_packaging_refs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`salesOrderItemId` int NOT NULL,
	`packagingLevelId` int NOT NULL,
	`orderedPackagingQuantity` decimal(18,6) NOT NULL,
	`baseQuantity` decimal(24,9) NOT NULL,
	`barcodeSnapshot` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_order_item_packaging_refs_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_order_item_packaging_ref_unique` UNIQUE(`organizationId`,`salesOrderItemId`)
);
--> statement-breakpoint
CREATE INDEX `b2b_item_packaging_org_level_idx` ON `b2b_order_item_packaging_refs` (`organizationId`,`packagingLevelId`);--> statement-breakpoint
CREATE INDEX `b2b_promotion_packaging_org_level_idx` ON `b2b_promotion_packaging_targets` (`organizationId`,`packagingLevelId`);--> statement-breakpoint
CREATE INDEX `sales_order_item_packaging_org_level_idx` ON `sales_order_item_packaging_refs` (`organizationId`,`packagingLevelId`);