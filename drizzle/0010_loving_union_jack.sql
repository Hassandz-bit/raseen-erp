CREATE TABLE `distribution_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`receiptNumber` varchar(64) NOT NULL,
	`routeId` int NOT NULL,
	`vehicleId` int,
	`customerId` int NOT NULL,
	`salesInvoiceId` int,
	`representativeEmployeeId` int,
	`driverEmployeeId` int,
	`collectionType` enum('cash_sale','current_invoice','previous_debt') NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`exchangeRateUsed` decimal(18,8) NOT NULL DEFAULT '1',
	`paymentMethod` enum('cash','card','transfer','check','other') NOT NULL DEFAULT 'cash',
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	`idempotencyKey` varchar(128) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `distribution_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_collection_org_number_unique` UNIQUE(`organizationId`,`receiptNumber`),
	CONSTRAINT `distribution_collection_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `distribution_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`deliveryNumber` varchar(64) NOT NULL,
	`routeId` int NOT NULL,
	`stopId` int,
	`vehicleId` int NOT NULL,
	`customerId` int NOT NULL,
	`salesInvoiceId` int,
	`status` enum('draft','full','partial','failed','rejected','returned') NOT NULL DEFAULT 'draft',
	`deliveredAt` timestamp,
	`notes` text,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_delivery_org_number_unique` UNIQUE(`organizationId`,`deliveryNumber`),
	CONSTRAINT `distribution_delivery_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `distribution_delivery_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`deliveryId` int NOT NULL,
	`productId` int NOT NULL,
	`vehicleBatchId` int,
	`expectedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`deliveredQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`rejectedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`returnedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`unit` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `distribution_delivery_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `distribution_geofence_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routeId` int NOT NULL,
	`stopId` int,
	`vehicleId` int,
	`eventType` enum('arrival','departure') NOT NULL,
	`distanceMeters` decimal(12,3),
	`recordedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `distribution_geofence_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `distribution_idempotency_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`operation` varchar(64) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`entityType` varchar(64),
	`entityId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `distribution_idempotency_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_idempotency_org_operation_key_unique` UNIQUE(`organizationId`,`operation`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `distribution_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`returnNumber` varchar(64) NOT NULL,
	`routeId` int,
	`vehicleId` int NOT NULL,
	`customerId` int,
	`deliveryId` int,
	`salesInvoiceId` int,
	`productId` int NOT NULL,
	`vehicleBatchId` int,
	`quantity` decimal(15,3) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`reason` varchar(240),
	`condition` enum('resalable','damaged','quarantined') NOT NULL DEFAULT 'resalable',
	`status` enum('recorded','returned_to_warehouse','damaged') NOT NULL DEFAULT 'recorded',
	`idempotencyKey` varchar(128) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `distribution_returns_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_return_org_number_unique` UNIQUE(`organizationId`,`returnNumber`),
	CONSTRAINT `distribution_return_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `distribution_route_closings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routeId` int NOT NULL,
	`status` enum('submitted','reviewed','approved','closed','reopened') NOT NULL DEFAULT 'submitted',
	`loadedValue` decimal(15,2) NOT NULL DEFAULT '0',
	`deliveredValue` decimal(15,2) NOT NULL DEFAULT '0',
	`returnedValue` decimal(15,2) NOT NULL DEFAULT '0',
	`damagedValue` decimal(15,2) NOT NULL DEFAULT '0',
	`expectedCash` decimal(15,2) NOT NULL DEFAULT '0',
	`actualCash` decimal(15,2) NOT NULL DEFAULT '0',
	`cashDifference` decimal(15,2) NOT NULL DEFAULT '0',
	`stockDifference` decimal(15,3) NOT NULL DEFAULT '0',
	`reopenReason` text,
	`submittedByUserId` int,
	`reviewedByUserId` int,
	`approvedByUserId` int,
	`closedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_route_closings_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_closing_org_route_unique` UNIQUE(`organizationId`,`routeId`)
);
--> statement-breakpoint
CREATE TABLE `distribution_route_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routeId` int NOT NULL,
	`vehicleId` int,
	`category` enum('fuel','toll','parking','minor') NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`receiptUrl` varchar(1024),
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `distribution_route_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `distribution_route_stops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routeId` int NOT NULL,
	`customerId` int NOT NULL,
	`salesInvoiceId` int,
	`salesOrderReference` varchar(96),
	`sequence` int NOT NULL,
	`plannedAt` timestamp,
	`arrivedAt` timestamp,
	`deliveryStatus` enum('pending','arrived','delivered','partial','skipped','failed','returned') NOT NULL DEFAULT 'pending',
	`collectionStatus` enum('pending','partial','collected','not_due','failed') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_route_stops_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_stop_org_route_sequence_unique` UNIQUE(`organizationId`,`routeId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `distribution_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routeNumber` varchar(64) NOT NULL,
	`routeDate` timestamp NOT NULL,
	`branchId` int,
	`territoryId` int,
	`vehicleId` int,
	`driverEmployeeId` int,
	`representativeEmployeeId` int,
	`loadOrderId` int,
	`status` enum('planned','prepared','loaded','started','in_progress','returning','closing','closed','cancelled') NOT NULL DEFAULT 'planned',
	`plannedStartAt` timestamp,
	`actualStartAt` timestamp,
	`plannedEndAt` timestamp,
	`actualEndAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_routes_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_route_org_number_unique` UNIQUE(`organizationId`,`routeNumber`)
);
--> statement-breakpoint
CREATE TABLE `distribution_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`overloadPolicy` enum('warning','hard_block','manager_override') NOT NULL DEFAULT 'warning',
	`visitRadiusMeters` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_settings_org_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `distribution_territories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`representativeEmployeeId` int,
	`defaultVehicleId` int,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_territories_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_territory_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `fleet_fuel_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`routeId` int,
	`driverEmployeeId` int,
	`odometer` decimal(15,2) NOT NULL,
	`fuelQuantity` decimal(15,3) NOT NULL,
	`fuelType` varchar(48) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`totalCost` decimal(15,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`vendor` varchar(180),
	`attachmentUrl` varchar(1024),
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fleet_fuel_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_gps_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int,
	`vehicleId` int NOT NULL,
	`routeId` int,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`accuracy` decimal(12,3),
	`recordedAt` timestamp NOT NULL,
	`source` enum('driver_app','vehicle_tracker') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fleet_gps_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_maintenance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`maintenanceType` enum('preventive','corrective','oil','tires','technical_inspection','other') NOT NULL,
	`status` enum('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
	`occurredAt` timestamp NOT NULL,
	`odometer` decimal(15,2),
	`cost` decimal(15,2) NOT NULL DEFAULT '0',
	`currencyCode` varchar(8) NOT NULL,
	`supplierPartyId` int,
	`description` text,
	`nextDueAt` timestamp,
	`nextDueOdometer` decimal(15,2),
	`attachmentUrl` varchar(1024),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleet_maintenance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_vehicle_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`documentType` enum('insurance','technical_inspection','registration','other') NOT NULL,
	`referenceNumber` varchar(96),
	`expiresAt` timestamp,
	`attachmentUrl` varchar(1024),
	`status` enum('valid','expired','pending') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleet_vehicle_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(48) NOT NULL,
	`registrationNumber` varchar(96) NOT NULL,
	`type` varchar(80) NOT NULL,
	`brand` varchar(80),
	`model` varchar(80),
	`modelYear` int,
	`ownerPartyId` int,
	`ownershipType` enum('owned','leased','external') NOT NULL DEFAULT 'owned',
	`driverEmployeeId` int,
	`representativeEmployeeId` int,
	`mobileWarehouseId` int,
	`maximumPayloadWeight` decimal(15,3) NOT NULL DEFAULT '0',
	`maximumVolume` decimal(15,6) NOT NULL DEFAULT '0',
	`palletCapacity` int NOT NULL DEFAULT 0,
	`odometer` decimal(15,2) NOT NULL DEFAULT '0',
	`status` enum('active','inactive','maintenance') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleet_vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `fleet_vehicle_org_code_unique` UNIQUE(`organizationId`,`code`),
	CONSTRAINT `fleet_vehicle_org_registration_unique` UNIQUE(`organizationId`,`registrationNumber`),
	CONSTRAINT `fleet_vehicle_org_mobile_warehouse_unique` UNIQUE(`organizationId`,`mobileWarehouseId`)
);
--> statement-breakpoint
CREATE TABLE `vehicle_load_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`loadOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`sourceBatchId` int,
	`vehicleBatchId` int,
	`quantity` decimal(15,3) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`unitWeight` decimal(15,3) NOT NULL DEFAULT '0',
	`unitVolume` decimal(15,6) NOT NULL DEFAULT '0',
	`packages` decimal(15,3) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vehicle_load_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicle_load_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`loadNumber` varchar(64) NOT NULL,
	`sourceWarehouseId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`routeId` int,
	`driverEmployeeId` int,
	`representativeEmployeeId` int,
	`status` enum('draft','prepared','approved','loading','loaded','dispatched','closed','cancelled') NOT NULL DEFAULT 'draft',
	`totalWeight` decimal(15,3) NOT NULL DEFAULT '0',
	`totalVolume` decimal(15,6) NOT NULL DEFAULT '0',
	`totalPackages` decimal(15,3) NOT NULL DEFAULT '0',
	`payloadUtilization` decimal(8,4) NOT NULL DEFAULT '0',
	`volumeUtilization` decimal(8,4) NOT NULL DEFAULT '0',
	`overloadOverrideReason` text,
	`overloadApprovedByUserId` int,
	`overloadApprovedAt` timestamp,
	`loadDate` timestamp,
	`approvedByUserId` int,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicle_load_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicle_load_org_number_unique` UNIQUE(`organizationId`,`loadNumber`)
);
--> statement-breakpoint
ALTER TABLE `stock_movements` MODIFY COLUMN `movementType` enum('purchase_receipt','sales_issue','sales_return','supplier_return','transfer_out','transfer_in','adjustment','opening_balance','count_adjustment','vehicle_load_out','vehicle_load_in','delivery_issue','vehicle_return','vehicle_damage','route_reconciliation') NOT NULL;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `latitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `business_parties` ADD `longitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `business_parties` ADD `territoryId` int;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `assignedRepresentativeEmployeeId` int;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `deliveryNotes` text;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `visitPriority` enum('low','normal','high','critical') DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_parties` ADD `receivingHours` varchar(180);--> statement-breakpoint
ALTER TABLE `products` ADD `cartonWeight` decimal(15,3);--> statement-breakpoint
ALTER TABLE `products` ADD `volume` decimal(15,6);--> statement-breakpoint
CREATE INDEX `distribution_collection_org_route_idx` ON `distribution_collections` (`organizationId`,`routeId`);--> statement-breakpoint
CREATE INDEX `distribution_delivery_org_route_idx` ON `distribution_deliveries` (`organizationId`,`routeId`);--> statement-breakpoint
CREATE INDEX `distribution_delivery_item_org_delivery_idx` ON `distribution_delivery_items` (`organizationId`,`deliveryId`);--> statement-breakpoint
CREATE INDEX `distribution_geofence_org_route_idx` ON `distribution_geofence_events` (`organizationId`,`routeId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `distribution_return_org_vehicle_idx` ON `distribution_returns` (`organizationId`,`vehicleId`);--> statement-breakpoint
CREATE INDEX `distribution_expense_org_route_idx` ON `distribution_route_expenses` (`organizationId`,`routeId`);--> statement-breakpoint
CREATE INDEX `distribution_stop_org_customer_idx` ON `distribution_route_stops` (`organizationId`,`customerId`);--> statement-breakpoint
CREATE INDEX `distribution_route_org_date_status_idx` ON `distribution_routes` (`organizationId`,`routeDate`,`status`);--> statement-breakpoint
CREATE INDEX `distribution_route_org_vehicle_idx` ON `distribution_routes` (`organizationId`,`vehicleId`);--> statement-breakpoint
CREATE INDEX `distribution_territory_org_branch_idx` ON `distribution_territories` (`organizationId`,`branchId`);--> statement-breakpoint
CREATE INDEX `fleet_fuel_org_vehicle_date_idx` ON `fleet_fuel_logs` (`organizationId`,`vehicleId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `fleet_gps_org_vehicle_recorded_idx` ON `fleet_gps_records` (`organizationId`,`vehicleId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `fleet_maintenance_org_vehicle_due_idx` ON `fleet_maintenance_records` (`organizationId`,`vehicleId`,`nextDueAt`);--> statement-breakpoint
CREATE INDEX `fleet_document_org_vehicle_expiry_idx` ON `fleet_vehicle_documents` (`organizationId`,`vehicleId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `fleet_vehicle_org_branch_idx` ON `fleet_vehicles` (`organizationId`,`branchId`);--> statement-breakpoint
CREATE INDEX `vehicle_load_item_org_load_idx` ON `vehicle_load_items` (`organizationId`,`loadOrderId`);--> statement-breakpoint
CREATE INDEX `vehicle_load_item_org_batch_idx` ON `vehicle_load_items` (`organizationId`,`sourceBatchId`);--> statement-breakpoint
CREATE INDEX `vehicle_load_org_vehicle_status_idx` ON `vehicle_load_orders` (`organizationId`,`vehicleId`,`status`);--> statement-breakpoint
CREATE INDEX `party_org_territory_idx` ON `business_parties` (`organizationId`,`territoryId`);