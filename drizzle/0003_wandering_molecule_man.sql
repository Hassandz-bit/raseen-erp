CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`attendanceDate` timestamp NOT NULL,
	`status` enum('present','absent','leave','late') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_employee_date_unique` UNIQUE(`organizationId`,`employeeId`,`attendanceDate`)
);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`periodLabel` varchar(32) NOT NULL,
	`status` enum('draft','approved','paid') NOT NULL DEFAULT 'draft',
	`totalAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `payroll_organization_period_unique` UNIQUE(`organizationId`,`periodLabel`)
);
--> statement-breakpoint
CREATE INDEX `attendance_organization_date_idx` ON `attendance_records` (`organizationId`,`attendanceDate`);