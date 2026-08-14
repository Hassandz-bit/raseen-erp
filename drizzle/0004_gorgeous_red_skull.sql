CREATE TABLE `organization_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`currencyCode` varchar(8) NOT NULL DEFAULT 'SAR',
	`currencySymbolPosition` enum('before','after') NOT NULL DEFAULT 'after',
	`decimalPlaces` int NOT NULL DEFAULT 2,
	`dateFormat` varchar(24) NOT NULL DEFAULT 'DD/MM/YYYY',
	`timeFormat` enum('12h','24h') NOT NULL DEFAULT '24h',
	`timeZone` varchar(64) NOT NULL DEFAULT 'Africa/Algiers',
	`firstDayOfWeek` enum('monday','sunday','saturday') NOT NULL DEFAULT 'monday',
	`decimalSeparator` enum('dot','comma') NOT NULL DEFAULT 'dot',
	`thousandsSeparator` enum('comma','dot','space') NOT NULL DEFAULT 'comma',
	`documentSettings` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_settings_organization_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`language` enum('ar','fr','en') NOT NULL DEFAULT 'ar',
	`themeMode` enum('light','dark','system') NOT NULL DEFAULT 'system',
	`sidebarMode` enum('expanded','compact','collapsed') NOT NULL DEFAULT 'expanded',
	`density` enum('comfortable','compact') NOT NULL DEFAULT 'comfortable',
	`fontFamily` varchar(64) NOT NULL DEFAULT 'ibm-plex',
	`fontScale` enum('small','normal','large') NOT NULL DEFAULT 'normal',
	`accentColor` varchar(16) NOT NULL DEFAULT 'gold',
	`radiusPreset` enum('soft','rounded','sharp') NOT NULL DEFAULT 'rounded',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_user_unique` UNIQUE(`userId`)
);
