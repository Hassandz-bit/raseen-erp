CREATE TABLE `b2b_order_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`b2bOrderId` int NOT NULL,
	`b2bOrderItemId` int NOT NULL,
	`requestedQuantity` decimal(15,3) NOT NULL,
	`confirmedQuantity` decimal(15,3) NOT NULL,
	`requestedUnitPrice` decimal(15,2) NOT NULL,
	`confirmedUnitPrice` decimal(15,2) NOT NULL,
	`reason` text NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `b2b_order_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `b2b_order_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`b2bOrderId` int NOT NULL,
	`status` enum('under_review','approved','rejected','converted','cancelled') NOT NULL,
	`reason` text,
	`reviewedByUserId` int NOT NULL,
	`reviewedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `b2b_order_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `b2b_promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`status` enum('draft','active','inactive','expired') NOT NULL DEFAULT 'draft',
	`type` enum('percentage_discount','fixed_discount','special_price','quantity_discount','buy_x_get_y') NOT NULL,
	`productId` int NOT NULL,
	`batchId` int,
	`customerId` int,
	`customerSegment` varchar(96),
	`territoryId` int,
	`minimumQuantity` decimal(15,3) NOT NULL DEFAULT '1',
	`discountPercentage` decimal(8,4),
	`discountAmount` decimal(15,2),
	`specialPrice` decimal(15,2),
	`buyQuantity` decimal(15,3),
	`getQuantity` decimal(15,3),
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`visibleToB2b` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `b2b_promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`salesOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`unit` varchar(32) NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`taxRate` decimal(8,4) NOT NULL DEFAULT '0',
	`lineTotal` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`b2bOrderId` int,
	`customerId` int NOT NULL,
	`orderNumber` varchar(64) NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'manual',
	`status` enum('draft','confirmed','preparing','ready','loaded','in_transit','delivered','partial','cancelled') NOT NULL DEFAULT 'draft',
	`currencyCode` varchar(8) NOT NULL,
	`subtotal` decimal(15,2) NOT NULL DEFAULT '0',
	`taxAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`totalAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`requestedDeliveryDate` timestamp,
	`confirmedDeliveryDate` timestamp,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`confirmedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_order_org_number_unique` UNIQUE(`organizationId`,`orderNumber`),
	CONSTRAINT `sales_order_b2b_order_unique` UNIQUE(`b2bOrderId`)
);
--> statement-breakpoint
CREATE INDEX `b2b_adjustment_org_order_idx` ON `b2b_order_adjustments` (`organizationId`,`b2bOrderId`);--> statement-breakpoint
CREATE INDEX `b2b_review_org_order_idx` ON `b2b_order_reviews` (`organizationId`,`b2bOrderId`);--> statement-breakpoint
CREATE INDEX `b2b_promotion_org_product_status_idx` ON `b2b_promotions` (`organizationId`,`productId`,`status`);--> statement-breakpoint
CREATE INDEX `b2b_promotion_org_target_idx` ON `b2b_promotions` (`organizationId`,`customerId`,`customerSegment`);--> statement-breakpoint
CREATE INDEX `sales_order_item_org_order_idx` ON `sales_order_items` (`organizationId`,`salesOrderId`);--> statement-breakpoint
CREATE INDEX `sales_order_org_customer_idx` ON `sales_orders` (`organizationId`,`customerId`);