CREATE TABLE `attendance_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`attendanceDate` timestamp NOT NULL,
	`checkInAt` timestamp,
	`checkOutAt` timestamp,
	`workingMinutes` int NOT NULL DEFAULT 0,
	`lateMinutes` int NOT NULL DEFAULT 0,
	`earlyLeaveMinutes` int NOT NULL DEFAULT 0,
	`overtimeMinutes` int NOT NULL DEFAULT 0,
	`source` enum('manual','supervisor','device_ready','mobile_ready') NOT NULL DEFAULT 'manual',
	`notes` text,
	`approvedByUserId` int,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_details_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_detail_org_employee_date_unique` UNIQUE(`organizationId`,`employeeId`,`attendanceDate`)
);
--> statement-breakpoint
CREATE TABLE `employee_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`workScheduleId` int,
	`contractType` enum('permanent','fixed_term','daily','hourly','service') NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`salaryBasis` enum('monthly','daily','hourly','fixed') NOT NULL,
	`baseSalary` decimal(18,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`probationEndsAt` timestamp,
	`status` enum('draft','active','expired','terminated') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`userId` int,
	`branchId` int,
	`departmentId` int,
	`positionId` int,
	`managerEmployeeId` int,
	`fullNameAr` varchar(180),
	`fullNameLatin` varchar(180),
	`gender` enum('male','female','unspecified'),
	`birthDate` timestamp,
	`nationalIdReference` varchar(128),
	`workLocation` varchar(180),
	`phone` varchar(48),
	`email` varchar(320),
	`address` text,
	`emergencyContact` json,
	`bankAccountReference` varchar(128),
	`payrollCurrency` varchar(8) NOT NULL,
	`notes` text,
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `employee_profile_org_employee_unique` UNIQUE(`organizationId`,`employeeId`),
	CONSTRAINT `employee_profile_org_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `hr_departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`managerEmployeeId` int,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hr_departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `hr_department_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `hr_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`departmentId` int,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hr_positions_id` PRIMARY KEY(`id`),
	CONSTRAINT `hr_position_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `leave_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`fiscalYearId` int,
	`openingDays` decimal(8,2) NOT NULL DEFAULT '0',
	`accruedDays` decimal(8,2) NOT NULL DEFAULT '0',
	`usedDays` decimal(8,2) NOT NULL DEFAULT '0',
	`adjustedDays` decimal(8,2) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_balance_org_employee_type_year_unique` UNIQUE(`organizationId`,`employeeId`,`leaveTypeId`,`fiscalYearId`)
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`days` decimal(8,2) NOT NULL,
	`reason` text,
	`attachmentReference` varchar(256),
	`status` enum('draft','submitted','approved','rejected','cancelled') NOT NULL DEFAULT 'draft',
	`approverUserId` int,
	`approvedAt` timestamp,
	`decisionNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`defaultDays` decimal(8,2) NOT NULL DEFAULT '0',
	`isPaid` enum('yes','no') NOT NULL DEFAULT 'yes',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leave_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_type_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `overtime_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`hours` decimal(8,2) NOT NULL,
	`overtimeType` varchar(64) NOT NULL,
	`multiplier` decimal(8,4) NOT NULL DEFAULT '1',
	`payrollEligible` enum('yes','no') NOT NULL DEFAULT 'yes',
	`status` enum('draft','submitted','approved','rejected','included') NOT NULL DEFAULT 'draft',
	`reason` text,
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `overtime_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`departmentId` int,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`workDays` json NOT NULL,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8) NOT NULL,
	`breakMinutes` int NOT NULL DEFAULT 0,
	`weeklyHours` decimal(8,2),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `work_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_schedule_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE INDEX `attendance_detail_org_date_idx` ON `attendance_details` (`organizationId`,`attendanceDate`);--> statement-breakpoint
CREATE INDEX `employee_contract_org_employee_idx` ON `employee_contracts` (`organizationId`,`employeeId`,`status`);--> statement-breakpoint
CREATE INDEX `employee_profile_org_branch_idx` ON `employee_profiles` (`organizationId`,`branchId`);--> statement-breakpoint
CREATE INDEX `employee_profile_org_department_idx` ON `employee_profiles` (`organizationId`,`departmentId`);--> statement-breakpoint
CREATE INDEX `hr_department_org_branch_idx` ON `hr_departments` (`organizationId`,`branchId`);--> statement-breakpoint
CREATE INDEX `hr_position_org_department_idx` ON `hr_positions` (`organizationId`,`departmentId`);--> statement-breakpoint
CREATE INDEX `leave_request_org_employee_date_idx` ON `leave_requests` (`organizationId`,`employeeId`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `overtime_org_employee_date_idx` ON `overtime_entries` (`organizationId`,`employeeId`,`occurredAt`,`status`);