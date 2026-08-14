CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_parties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(220) NOT NULL,
	`types` json NOT NULL,
	`contactName` varchar(160),
	`phone` varchar(32),
	`email` varchar(320),
	`taxNumber` varchar(80),
	`creditLimit` decimal(15,2) NOT NULL DEFAULT '0',
	`status` enum('active','inactive','blocked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_parties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`fullName` varchar(180) NOT NULL,
	`employeeNumber` varchar(64) NOT NULL,
	`department` varchar(120),
	`jobTitle` varchar(120),
	`status` enum('active','leave','inactive') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employee_organization_number_unique` UNIQUE(`organizationId`,`employeeNumber`)
);
--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`type` enum('income','expense','transfer','adjustment') NOT NULL,
	`category` varchar(120) NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`referenceType` varchar(64),
	`referenceId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`quantity` decimal(15,3) NOT NULL DEFAULT '0',
	`reservedQuantity` decimal(15,3) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_balance_unique` UNIQUE(`organizationId`,`productId`,`warehouseId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`severity` enum('info','success','warning','critical') NOT NULL DEFAULT 'info',
	`title` varchar(220) NOT NULL,
	`content` text NOT NULL,
	`isRead` enum('yes','no') NOT NULL DEFAULT 'no',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`roleKey` varchar(48) NOT NULL DEFAULT 'member',
	`dataScope` json,
	`status` enum('active','invited','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_organization_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organization_modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`moduleKey` varchar(64) NOT NULL,
	`status` enum('active','suspended','expired') NOT NULL DEFAULT 'active',
	`effectiveFrom` timestamp NOT NULL DEFAULT (now()),
	`effectiveUntil` timestamp,
	`changedByUserId` int,
	`changeSource` varchar(80) NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_module_unique` UNIQUE(`organizationId`,`moduleKey`)
);
--> statement-breakpoint
CREATE TABLE `organization_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`key` varchar(48) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`permissions` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_role_key_unique` UNIQUE(`organizationId`,`key`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`status` enum('active','suspended','trial') NOT NULL DEFAULT 'trial',
	`baseCurrency` varchar(8) NOT NULL DEFAULT 'SAR',
	`locale` varchar(12) NOT NULL DEFAULT 'ar-SA',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#D7B56D',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_organization_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`categoryId` int,
	`name` varchar(220) NOT NULL,
	`sku` varchar(96) NOT NULL,
	`barcode` varchar(96),
	`unit` varchar(32) NOT NULL DEFAULT 'قطعة',
	`purchasePrice` decimal(15,2) NOT NULL DEFAULT '0',
	`salePrice` decimal(15,2) NOT NULL DEFAULT '0',
	`reorderPoint` decimal(15,3) NOT NULL DEFAULT '0',
	`imageUrl` varchar(1024),
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_organization_sku_unique` UNIQUE(`organizationId`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`supplierId` int,
	`orderNumber` varchar(64) NOT NULL,
	`status` enum('draft','sent','partial','received','cancelled') NOT NULL DEFAULT 'draft',
	`grandTotal` decimal(15,2) NOT NULL DEFAULT '0',
	`expectedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_order_organization_number_unique` UNIQUE(`organizationId`,`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `sales_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int,
	`invoiceNumber` varchar(64) NOT NULL,
	`status` enum('draft','issued','partial','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`grandTotal` decimal(15,2) NOT NULL DEFAULT '0',
	`amountPaid` decimal(15,2) NOT NULL DEFAULT '0',
	`dueDate` timestamp,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_organization_number_unique` UNIQUE(`organizationId`,`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(48) NOT NULL,
	`isMobile` enum('yes','no') NOT NULL DEFAULT 'no',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouse_organization_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE INDEX `audit_organization_created_idx` ON `audit_logs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `party_organization_idx` ON `business_parties` (`organizationId`);--> statement-breakpoint
CREATE INDEX `finance_organization_date_idx` ON `financial_transactions` (`organizationId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `inventory_product_idx` ON `inventory_balances` (`organizationId`,`productId`);--> statement-breakpoint
CREATE INDEX `notification_organization_read_idx` ON `notifications` (`organizationId`,`isRead`);--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `organization_memberships` (`userId`);--> statement-breakpoint
CREATE INDEX `product_organization_category_idx` ON `products` (`organizationId`,`categoryId`);--> statement-breakpoint
CREATE INDEX `purchase_order_organization_status_idx` ON `purchase_orders` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `invoice_organization_status_idx` ON `sales_invoices` (`organizationId`,`status`);