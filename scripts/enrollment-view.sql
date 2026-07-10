-- Membership single-source-of-truth view (Subject -> Offering refactor).
-- MANDATORY membership is derived from StudentCourse x OfferingCourse;
-- OPTIONAL membership is the stored StudentOffering subset.
-- Ops artifact: re-apply after any `prisma db push` (Prisma does not manage views).
CREATE OR REPLACE VIEW enrollment AS
  SELECT sc."studentId", oc."offeringId", oc."courseId"
  FROM "StudentCourse" sc
  JOIN "OfferingCourse" oc ON oc."courseId" = sc."courseId"
  JOIN "Offering" o ON o.id = oc."offeringId"
  WHERE o.kind = 'MANDATORY'
UNION
  SELECT so."studentId", so."offeringId", so."courseId"
  FROM "StudentOffering" so;
