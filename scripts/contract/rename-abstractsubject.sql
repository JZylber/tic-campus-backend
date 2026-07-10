-- CONTRACT STEP 4 (final polish) — rename the abstract subject table to `Subject`.
-- Run ONLY after the legacy `Subject` table has been dropped (contract step 3),
-- otherwise the name collides. Data-preserving. After running this, rename the
-- Prisma model AbstractSubject -> Subject and `prisma db push` (a no-op diff).
ALTER TABLE "AbstractSubject" RENAME TO "Subject";
