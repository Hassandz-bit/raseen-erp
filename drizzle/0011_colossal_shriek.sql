CREATE TABLE `distribution_delivery_proofs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routeId` int NOT NULL,
	`stopId` int NOT NULL,
	`deliveryId` int,
	`customerId` int NOT NULL,
	`photoStorageKey` varchar(1024),
	`photoUrl` varchar(1024),
	`signatureStorageKey` varchar(1024) NOT NULL,
	`signatureUrl` varchar(1024) NOT NULL,
	`signerName` varchar(180) NOT NULL,
	`signedAt` timestamp NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_delivery_proofs_id` PRIMARY KEY(`id`),
	CONSTRAINT `distribution_proof_org_stop_unique` UNIQUE(`organizationId`,`stopId`)
);
--> statement-breakpoint
CREATE INDEX `distribution_proof_org_route_idx` ON `distribution_delivery_proofs` (`organizationId`,`routeId`);