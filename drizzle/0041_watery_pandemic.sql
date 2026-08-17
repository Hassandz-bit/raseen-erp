CREATE TABLE `b2b_saved_order_list_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`listId` int NOT NULL,
	`productId` int NOT NULL,
	`unit` varchar(32) NOT NULL,
	`quantity` decimal(15,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `b2b_saved_order_list_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `b2b_saved_order_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`accessId` int NOT NULL,
	`customerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `b2b_saved_order_lists_id` PRIMARY KEY(`id`),
	CONSTRAINT `b2b_saved_list_access_name_unique` UNIQUE(`accessId`,`name`)
);
--> statement-breakpoint
CREATE INDEX `b2b_saved_list_item_org_list_idx` ON `b2b_saved_order_list_items` (`organizationId`,`listId`);--> statement-breakpoint
CREATE INDEX `b2b_saved_list_org_access_idx` ON `b2b_saved_order_lists` (`organizationId`,`accessId`);