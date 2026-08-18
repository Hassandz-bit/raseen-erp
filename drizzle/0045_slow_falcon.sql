ALTER TABLE `sales_invoices` ADD `taxMode` enum('exclusive','inclusive') DEFAULT 'exclusive' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD `netAmount` decimal(15,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE `sales_invoices` SET `netAmount` = GREATEST(`grandTotal` - `taxAmount`, 0) WHERE `netAmount` = 0;
