ALTER TABLE `b2b_retailer_orders` ADD `outletId` int;--> statement-breakpoint
ALTER TABLE `b2b_retailer_orders` ADD `clientOperationId` varchar(128);--> statement-breakpoint
ALTER TABLE `b2b_retailer_outlets` ADD `wilaya` varchar(120);--> statement-breakpoint
ALTER TABLE `b2b_retailer_outlets` ADD `commune` varchar(120);--> statement-breakpoint
ALTER TABLE `b2b_retailer_outlets` ADD `deliveryInstructions` text;--> statement-breakpoint
ALTER TABLE `b2b_retailer_orders` ADD CONSTRAINT `b2b_order_access_operation_unique` UNIQUE(`accessId`,`clientOperationId`);--> statement-breakpoint
CREATE INDEX `b2b_order_outlet_idx` ON `b2b_retailer_orders` (`organizationId`,`outletId`);