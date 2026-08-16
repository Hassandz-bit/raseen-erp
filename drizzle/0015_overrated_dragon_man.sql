CREATE TABLE `organization_custom_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`canonicalUomId` int NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_custom_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_package_org_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `product_packaging_levels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`uomId` int,
	`customPackageId` int,
	`code` varchar(64) NOT NULL,
	`displayName` varchar(160),
	`factorToBase` decimal(24,9) NOT NULL,
	`barcode` varchar(96),
	`gtin` varchar(32),
	`internalCode` varchar(96),
	`netWeightKg` decimal(18,6),
	`grossWeightKg` decimal(18,6),
	`lengthMm` decimal(18,3),
	`widthMm` decimal(18,3),
	`heightMm` decimal(18,3),
	`actualVolumeM3` decimal(18,9),
	`cartonsPerPallet` decimal(18,6),
	`unitsPerPallet` decimal(18,6),
	`palletType` varchar(64),
	`allowedPurchase` enum('yes','no') NOT NULL DEFAULT 'no',
	`allowedSales` enum('yes','no') NOT NULL DEFAULT 'no',
	`allowedB2b` enum('yes','no') NOT NULL DEFAULT 'no',
	`allowedDistribution` enum('yes','no') NOT NULL DEFAULT 'no',
	`isDefaultPurchase` enum('yes','no') NOT NULL DEFAULT 'no',
	`isDefaultSales` enum('yes','no') NOT NULL DEFAULT 'no',
	`isDefaultB2b` enum('yes','no') NOT NULL DEFAULT 'no',
	`isDefaultDistribution` enum('yes','no') NOT NULL DEFAULT 'no',
	`logisticsFlags` json,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_packaging_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_packaging_org_product_code_unique` UNIQUE(`organizationId`,`productId`,`code`),
	CONSTRAINT `product_packaging_org_barcode_unique` UNIQUE(`organizationId`,`barcode`)
);
--> statement-breakpoint
CREATE TABLE `uom_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uomId` int NOT NULL,
	`alias` varchar(120) NOT NULL,
	`language` enum('ar','fr','en','local') NOT NULL DEFAULT 'local',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uom_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `uom_alias_unique` UNIQUE(`uomId`,`alias`)
);
--> statement-breakpoint
CREATE TABLE `uom_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(48) NOT NULL,
	`canonicalType` enum('unit','piece','bottle','flacon','box','can','jar','container','tube','cup','tray','pack','packet','bundle','shrink_pack','dozen','pair','bag','sachet','sack','bulk_bag','carton','crate','parcel','bin','display','jerrycan','bucket','drum','roll','reel','pallet','half_pallet','pallet_layer','shipping_container') NOT NULL,
	`nameAr` varchar(120) NOT NULL,
	`nameFr` varchar(120) NOT NULL,
	`nameEn` varchar(120) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uom_catalog_id` PRIMARY KEY(`id`),
	CONSTRAINT `uom_catalog_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE INDEX `product_packaging_org_product_idx` ON `product_packaging_levels` (`organizationId`,`productId`);--> statement-breakpoint
CREATE INDEX `uom_alias_lookup_idx` ON `uom_aliases` (`alias`);--> statement-breakpoint
CREATE INDEX `uom_catalog_type_idx` ON `uom_catalog` (`canonicalType`);