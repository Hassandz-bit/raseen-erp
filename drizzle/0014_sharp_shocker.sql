ALTER TABLE `b2b_retailer_order_items` ADD `paidQuantity` decimal(15,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `b2b_retailer_order_items` ADD `freeQuantity` decimal(15,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `b2b_retailer_order_items` ADD `promotionId` int;--> statement-breakpoint
ALTER TABLE `sales_order_items` ADD `paidQuantity` decimal(15,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_order_items` ADD `freeQuantity` decimal(15,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_order_items` ADD `promotionId` int;