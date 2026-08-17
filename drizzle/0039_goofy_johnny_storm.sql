ALTER TABLE `sales_orders` ADD `deliveryOutletId` int;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `deliveryAddressSnapshot` text;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `deliveryLatitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `deliveryLongitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `deliveryTerritoryId` int;