CREATE TABLE `allowance_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`calculationType` enum('fixed','percentage') NOT NULL DEFAULT 'fixed',
	`defaultValue` decimal(18,4) NOT NULL DEFAULT '0',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `allowance_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `allowance_type_org_code_unique` UNIQUE(`organizationId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `commission_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`commissionRuleId` int,
	`sourceModule` varchar(64),
	`sourceDocumentType` varchar(64),
	`sourceDocumentId` int,
	`amount` decimal(18,2) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`status` enum('draft','approved','included','cancelled') NOT NULL DEFAULT 'draft',
	`approvedByUserId` int,
	`payrollRunEmployeeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commission_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `commission_source_org_unique` UNIQUE(`organizationId`,`sourceModule`,`sourceDocumentType`,`sourceDocumentId`,`employeeId`)
);
--> statement-breakpoint
CREATE TABLE `commission_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`sourceType` enum('sales','collections','product','customer','target','route_performance') NOT NULL,
	`calculationType` enum('fixed','percentage') NOT NULL,
	`value` decimal(18,4) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commission_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_advances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`recoveredAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`currencyCode` varchar(8) NOT NULL,
	`reason` text NOT NULL,
	`recoveryMethod` enum('one_payroll','multiple_payrolls') NOT NULL,
	`status` enum('draft','approved','paid','recovered','cancelled') NOT NULL DEFAULT 'draft',
	`approvedByUserId` int,
	`journalEntryId` int,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_advances_id` PRIMARY KEY(`id`),
	CONSTRAINT `employee_advance_org_idempotency_unique` UNIQUE(`organizationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `employee_allowances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`allowanceTypeId` int NOT NULL,
	`amount` decimal(18,4) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_allowances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`payrollPeriodId` int,
	`adjustmentType` enum('deduction','bonus','commission','other') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`reason` text NOT NULL,
	`approvedByUserId` int,
	`status` enum('draft','approved','included','cancelled') NOT NULL DEFAULT 'draft',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payroll_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`paymentDate` timestamp,
	`status` enum('draft','calculated','under_review','approved','posted','paid','closed') NOT NULL DEFAULT 'draft',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `payroll_period_org_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `payroll_run_employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`payrollPeriodId` int NOT NULL,
	`employeeId` int NOT NULL,
	`contractId` int,
	`currencyCode` varchar(8) NOT NULL,
	`baseSalary` decimal(18,2) NOT NULL,
	`allowances` decimal(18,2) NOT NULL DEFAULT '0',
	`overtime` decimal(18,2) NOT NULL DEFAULT '0',
	`commissions` decimal(18,2) NOT NULL DEFAULT '0',
	`bonuses` decimal(18,2) NOT NULL DEFAULT '0',
	`deductions` decimal(18,2) NOT NULL DEFAULT '0',
	`absenceDeductions` decimal(18,2) NOT NULL DEFAULT '0',
	`advanceRecovery` decimal(18,2) NOT NULL DEFAULT '0',
	`grossPay` decimal(18,2) NOT NULL,
	`netPay` decimal(18,2) NOT NULL,
	`snapshot` json NOT NULL,
	`status` enum('calculated','approved','posted','paid') NOT NULL DEFAULT 'calculated',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_run_employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `payroll_run_employee_org_period_unique` UNIQUE(`organizationId`,`payrollPeriodId`,`employeeId`)
);
--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`payrollRunEmployeeId` int NOT NULL,
	`employeeId` int NOT NULL,
	`documentNumber` varchar(64) NOT NULL,
	`snapshot` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payslips_id` PRIMARY KEY(`id`),
	CONSTRAINT `payslip_org_run_employee_unique` UNIQUE(`organizationId`,`payrollRunEmployeeId`),
	CONSTRAINT `payslip_org_number_unique` UNIQUE(`organizationId`,`documentNumber`)
);
--> statement-breakpoint
CREATE INDEX `commission_entry_org_employee_idx` ON `commission_entries` (`organizationId`,`employeeId`,`status`);--> statement-breakpoint
CREATE INDEX `commission_rule_org_status_idx` ON `commission_rules` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `employee_advance_org_employee_idx` ON `employee_advances` (`organizationId`,`employeeId`,`status`);--> statement-breakpoint
CREATE INDEX `employee_allowance_org_employee_idx` ON `employee_allowances` (`organizationId`,`employeeId`,`status`);--> statement-breakpoint
CREATE INDEX `payroll_adjustment_org_employee_idx` ON `payroll_adjustments` (`organizationId`,`employeeId`,`status`);--> statement-breakpoint
CREATE INDEX `payroll_period_org_date_idx` ON `payroll_periods` (`organizationId`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `payroll_run_employee_org_status_idx` ON `payroll_run_employees` (`organizationId`,`status`);