CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branch_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `inventory_count_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`countId` int NOT NULL,
	`productId` int NOT NULL,
	`batchId` int,
	`expectedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`actualQuantity` decimal(15,3),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_count_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`countNumber` varchar(64) NOT NULL,
	`warehouseId` int NOT NULL,
	`scope` enum('full','partial','category','product','location') NOT NULL DEFAULT 'full',
	`movementMode` enum('freeze','reconcile') NOT NULL DEFAULT 'freeze',
	`status` enum('draft','in_progress','review','approved','cancelled') NOT NULL DEFAULT 'draft',
	`startedAt` timestamp,
	`approvedAt` timestamp,
	`responsibleUserId` int,
	`reviewedByUserId` int,
	`approvedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_counts_id` PRIMARY KEY(`id`),
	CONSTRAINT `count_org_number_unique` UNIQUE(`organizationId`,`countNumber`)
);
--> statement-breakpoint
CREATE TABLE `price_list_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`priceListId` int NOT NULL,
	`productId` int NOT NULL,
	`unit` varchar(32),
	`price` decimal(15,2) NOT NULL,
	`minimumQuantity` decimal(15,3) NOT NULL DEFAULT '1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_list_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_list_item_unique` UNIQUE(`organizationId`,`priceListId`,`productId`,`unit`)
);
--> statement-breakpoint
CREATE TABLE `price_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`kind` enum('default','wholesale','retail','customer','segment','region','promotion') NOT NULL DEFAULT 'default',
	`priority` int NOT NULL DEFAULT 100,
	`currencyCode` varchar(8) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_lists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`lotNumber` varchar(96) NOT NULL,
	`sourcePartyId` int,
	`receivedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`currentQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`reservedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`cost` decimal(15,2) NOT NULL DEFAULT '0',
	`manufacturingDate` timestamp,
	`expiryDate` timestamp,
	`status` enum('active','blocked','quarantined','expired') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `batch_org_warehouse_lot_unique` UNIQUE(`organizationId`,`warehouseId`,`lotNumber`)
);
--> statement-breakpoint
CREATE TABLE `product_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_org_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `product_unit_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`fromUnit` varchar(32) NOT NULL,
	`toUnit` varchar(32) NOT NULL,
	`factor` decimal(18,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_unit_conversions_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_unit_conversion_unique` UNIQUE(`organizationId`,`productId`,`fromUnit`,`toUnit`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`batchId` int,
	`movementType` enum('purchase_receipt','sales_issue','sales_return','supplier_return','transfer_out','transfer_in','adjustment','opening_balance','count_adjustment') NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`sourceDocumentType` varchar(64),
	`sourceDocumentId` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`actorUserId` int,
	`auditReference` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfer_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`transferId` int NOT NULL,
	`productId` int NOT NULL,
	`batchId` int,
	`requestedQuantity` decimal(15,3) NOT NULL,
	`receivedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_transfer_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`transferNumber` varchar(64) NOT NULL,
	`sourceWarehouseId` int NOT NULL,
	`destinationWarehouseId` int NOT NULL,
	`status` enum('draft','approved','in_transit','received','cancelled') NOT NULL DEFAULT 'draft',
	`sentAt` timestamp,
	`receivedAt` timestamp,
	`notes` text,
	`createdByUserId` int,
	`approvedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `transfer_org_number_unique` UNIQUE(`organizationId`,`transferNumber`)
);
--> statement-breakpoint
ALTER TABLE `sales_invoices` MODIFY COLUMN `status` enum('draft','issued','partial','paid','overdue','cancelled','returned') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `business_parties` ADD `code` varchar(64);--> statement-breakpoint
ALTER TABLE `business_parties` ADD `tradeName` varchar(220);--> statement-breakpoint
ALTER TABLE `business_parties` ADD `address` text;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `region` varchar(120);--> statement-breakpoint
ALTER TABLE `business_parties` ADD `locationData` json;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `paymentTermsDays` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `preferredCurrencyCode` varchar(8);--> statement-breakpoint
ALTER TABLE `business_parties` ADD `priceListId` int;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `customerSegment` varchar(96);--> statement-breakpoint
ALTER TABLE `business_parties` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `status` enum('active','inactive') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `brandId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `productId` varchar(64);--> statement-breakpoint
ALTER TABLE `products` ADD `nameAr` varchar(220);--> statement-breakpoint
ALTER TABLE `products` ADD `nameFr` varchar(220);--> statement-breakpoint
ALTER TABLE `products` ADD `nameEn` varchar(220);--> statement-breakpoint
ALTER TABLE `products` ADD `description` text;--> statement-breakpoint
ALTER TABLE `products` ADD `productType` enum('standard','food','expiring','manufacturable') DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `baseUnit` varchar(32) DEFAULT 'قطعة' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `purchaseUnit` varchar(32) DEFAULT 'قطعة' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `salesUnit` varchar(32) DEFAULT 'قطعة' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `unitsPerCarton` decimal(15,3) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `netWeight` decimal(15,3);--> statement-breakpoint
ALTER TABLE `products` ADD `grossWeight` decimal(15,3);--> statement-breakpoint
ALTER TABLE `products` ADD `length` decimal(15,3);--> statement-breakpoint
ALTER TABLE `products` ADD `width` decimal(15,3);--> statement-breakpoint
ALTER TABLE `products` ADD `height` decimal(15,3);--> statement-breakpoint
ALTER TABLE `products` ADD `taxRate` decimal(8,4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `minimumStock` decimal(15,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `currencyCode` varchar(8) DEFAULT 'SAR' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `baseCurrencyCode` varchar(8) DEFAULT 'SAR' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `exchangeRateUsed` decimal(18,8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `exchangeRateEffectiveAt` timestamp;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD `currencyCode` varchar(8) DEFAULT 'SAR' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD `baseCurrencyCode` varchar(8) DEFAULT 'SAR' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD `exchangeRateUsed` decimal(18,8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD `exchangeRateEffectiveAt` timestamp;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD `discountAmount` decimal(15,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD `taxAmount` decimal(15,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouses` ADD `branchId` int;--> statement-breakpoint
ALTER TABLE `business_parties` ADD CONSTRAINT `party_org_code_unique` UNIQUE(`organizationId`,`code`);--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `product_org_barcode_unique` UNIQUE(`organizationId`,`barcode`);--> statement-breakpoint
CREATE INDEX `price_list_org_priority_idx` ON `price_lists` (`organizationId`,`priority`);--> statement-breakpoint
CREATE INDEX `batch_fefo_idx` ON `product_batches` (`organizationId`,`productId`,`warehouseId`,`expiryDate`);--> statement-breakpoint
CREATE INDEX `stock_movement_org_warehouse_product_idx` ON `stock_movements` (`organizationId`,`warehouseId`,`productId`,`occurredAt`);
