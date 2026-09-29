-- Fix camelCase column names missed in init migration (keep data via rename)
ALTER TABLE `users` CHANGE COLUMN `preferredLocale` `preferred_locale` VARCHAR(5) NOT NULL DEFAULT 'fa';
ALTER TABLE `requests` CHANGE COLUMN `trackingCode` `tracking_code` VARCHAR(20) NOT NULL;
ALTER TABLE `audit_logs` CHANGE COLUMN `entityId` `entity_id` VARCHAR(36) NULL;
