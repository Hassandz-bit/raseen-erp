CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`orderedQuantity` decimal(15,3) NOT NULL,
	`receivedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`unit` varchar(32) NOT NULL,
	`unitCost` decimal(15,2) NOT NULL,
	`lineTotal` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`taxRate` decimal(8,4) NOT NULL DEFAULT '0',
	`lineTotal` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `purchase_order_item_org_order_idx` ON `purchase_order_items` (`organizationId`,`purchaseOrderId`);--> statement-breakpoint
CREATE INDEX `purchase_order_item_org_product_idx` ON `purchase_order_items` (`organizationId`,`productId`);--> statement-breakpoint
CREATE INDEX `sales_invoice_item_org_invoice_idx` ON `sales_invoice_items` (`organizationId`,`invoiceId`);--> statement-breakpoint
CREATE INDEX `sales_invoice_item_org_product_idx` ON `sales_invoice_items` (`organizationId`,`productId`);
