ALTER TABLE `production_orders` ADD `productionLineId` int;--> statement-breakpoint
CREATE INDEX `production_order_org_line_idx` ON `production_orders` (`organizationId`,`productionLineId`);