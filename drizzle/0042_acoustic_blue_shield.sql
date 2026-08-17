ALTER TABLE `notifications` ADD `targetUserId` int;--> statement-breakpoint
ALTER TABLE `notifications` ADD `targetRetailerAccessId` int;--> statement-breakpoint
CREATE INDEX `notification_retailer_target_idx` ON `notifications` (`targetUserId`,`targetRetailerAccessId`,`isRead`);