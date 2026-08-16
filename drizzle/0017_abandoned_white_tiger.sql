CREATE TABLE `manufacturing_bom_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`bomId` int NOT NULL,
	`componentProductId` int NOT NULL,
	`quantity` decimal(18,6) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`baseQuantity` decimal(18,6) NOT NULL,
	`wasteAllowance` decimal(8,4) NOT NULL DEFAULT '0',
	`stageCode` varchar(64),
	`required` enum('yes','no') NOT NULL DEFAULT 'yes',
	`substituteProductIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manufacturing_bom_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manufacturing_boms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`version` varchar(32) NOT NULL,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`outputQuantity` decimal(18,6) NOT NULL,
	`outputUnit` varchar(32) NOT NULL,
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manufacturing_boms_id` PRIMARY KEY(`id`),
	CONSTRAINT `manufacturing_bom_org_code_version_unique` UNIQUE(`organizationId`,`code`,`version`)
);
--> statement-breakpoint
CREATE TABLE `production_material_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productionOrderId` int NOT NULL,
	`bomItemId` int NOT NULL,
	`productId` int NOT NULL,
	`batchId` int,
	`requiredQuantity` decimal(18,6) NOT NULL,
	`availableQuantity` decimal(18,6) NOT NULL,
	`reservedQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`issuedQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`returnedQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`shortageQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`overrideReason` text,
	`overrideByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_material_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`orderNumber` varchar(64) NOT NULL,
	`productId` int NOT NULL,
	`bomId` int NOT NULL,
	`bomVersion` varchar(32) NOT NULL,
	`plannedQuantity` decimal(18,6) NOT NULL,
	`plannedUnit` varchar(32) NOT NULL,
	`baseQuantity` decimal(18,6) NOT NULL,
	`rawMaterialWarehouseId` int NOT NULL,
	`wipWarehouseId` int,
	`finishedGoodsWarehouseId` int NOT NULL,
	`status` enum('draft','planned','approved','materials_reserved','in_production','quality_hold','completed','closed','cancelled') NOT NULL DEFAULT 'draft',
	`shortagePolicy` enum('block','manager_override') NOT NULL DEFAULT 'block',
	`plannedStart` timestamp,
	`plannedEnd` timestamp,
	`actualStart` timestamp,
	`actualEnd` timestamp,
	`responsibleUserId` int,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_order_org_number_unique` UNIQUE(`organizationId`,`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `production_outputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productionOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`batchId` int,
	`goodQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`defectiveQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`reworkQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`scrapQuantity` decimal(18,6) NOT NULL DEFAULT '0',
	`unitCost` decimal(18,6),
	`qualityStatus` enum('pending','passed','failed','quarantined') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_outputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productionOrderId` int NOT NULL,
	`sequence` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`plannedDurationMinutes` int,
	`status` enum('pending','in_progress','completed','blocked','skipped') NOT NULL DEFAULT 'pending',
	`actualStart` timestamp,
	`actualEnd` timestamp,
	`responsibleUserId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_stages_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_stage_org_order_sequence_unique` UNIQUE(`organizationId`,`productionOrderId`,`sequence`)
);
--> statement-breakpoint
CREATE INDEX `manufacturing_bom_item_org_bom_idx` ON `manufacturing_bom_items` (`organizationId`,`bomId`);--> statement-breakpoint
CREATE INDEX `manufacturing_bom_item_org_component_idx` ON `manufacturing_bom_items` (`organizationId`,`componentProductId`);--> statement-breakpoint
CREATE INDEX `manufacturing_bom_org_product_status_idx` ON `manufacturing_boms` (`organizationId`,`productId`,`status`);--> statement-breakpoint
CREATE INDEX `production_reservation_org_order_idx` ON `production_material_reservations` (`organizationId`,`productionOrderId`);--> statement-breakpoint
CREATE INDEX `production_order_org_status_idx` ON `production_orders` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `production_output_org_order_idx` ON `production_outputs` (`organizationId`,`productionOrderId`);