CREATE TABLE `b2b_retailer_accesses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('invited','active','suspended','revoked') NOT NULL DEFAULT 'invited',
	`priceListId` int,
	`customerSegment` varchar(96),
	`territoryId` int,
	`deliveryTrackingPolicy` enum('off','status_only','eta_only','limited_live') NOT NULL DEFAULT 'status_only',
	`availabilityDisclosure` enum('available','low','request') NOT NULL DEFAULT 'available',
	`permissions` json,
	`grantedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `b2b_retailer_accesses_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_access_org_customer_user_unique` UNIQUE(`organizationId`,`customerId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `b2b_retailer_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`accessId` int NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `b2b_retailer_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_favorite_access_product_unique` UNIQUE(`accessId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `b2b_retailer_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`unit` varchar(32) NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`taxRate` decimal(8,4) NOT NULL DEFAULT '0',
	`lineTotal` decimal(15,2) NOT NULL,
	`pricingSource` varchar(64) NOT NULL,
	`promotionLabel` varchar(180),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `b2b_retailer_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `b2b_retailer_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`accessId` int NOT NULL,
	`customerId` int NOT NULL,
	`orderNumber` varchar(64) NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'b2b_retailer_app',
	`status` enum('new','review','confirmed','preparing','ready','loaded','in_transit','arrived','delivered','partial','cancelled','returned') NOT NULL DEFAULT 'new',
	`paymentStatus` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
	`currencyCode` varchar(8) NOT NULL,
	`subtotal` decimal(15,2) NOT NULL DEFAULT '0',
	`taxAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`totalAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`requestedDeliveryDate` timestamp,
	`notes` text,
	`routeId` int,
	`routeStopId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `b2b_retailer_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_order_org_number_unique` UNIQUE(`organizationId`,`orderNumber`)
);
--> statement-breakpoint
CREATE INDEX `b2b_access_user_status_idx` ON `b2b_retailer_accesses` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `b2b_access_org_customer_idx` ON `b2b_retailer_accesses` (`organizationId`,`customerId`);--> statement-breakpoint
CREATE INDEX `b2b_favorite_org_access_idx` ON `b2b_retailer_favorites` (`organizationId`,`accessId`);--> statement-breakpoint
CREATE INDEX `b2b_order_item_org_order_idx` ON `b2b_retailer_order_items` (`organizationId`,`orderId`);--> statement-breakpoint
CREATE INDEX `b2b_order_item_org_product_idx` ON `b2b_retailer_order_items` (`organizationId`,`productId`);--> statement-breakpoint
CREATE INDEX `b2b_order_access_status_idx` ON `b2b_retailer_orders` (`accessId`,`status`);--> statement-breakpoint
CREATE INDEX `b2b_order_org_customer_idx` ON `b2b_retailer_orders` (`organizationId`,`customerId`);