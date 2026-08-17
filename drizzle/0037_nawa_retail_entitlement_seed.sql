INSERT INTO `organization_modules` (`organizationId`, `moduleKey`, `status`, `effectiveFrom`, `changeSource`)
SELECT DISTINCT `organizationId`, 'nawa_retail', 'active', NOW(), 'b2b_foundation_migration'
FROM (
  SELECT `organizationId` FROM `b2b_retailer_accesses`
  UNION
  SELECT `organizationId` FROM `b2b_retailer_orders`
  UNION
  SELECT `organizationId` FROM `b2b_retailer_outlets`
  UNION
  SELECT `organizationId` FROM `b2b_promotions`
) AS `retail_organizations`
ON DUPLICATE KEY UPDATE `moduleKey` = VALUES(`moduleKey`);
