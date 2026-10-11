-- Additive PostgreSQL change. Existing rows retain null receipt metadata.
BEGIN;
ALTER TABLE public."Transaction" ADD COLUMN IF NOT EXISTS "receiptPath" TEXT;
ALTER TABLE public."Transaction" ADD COLUMN IF NOT EXISTS "receiptName" TEXT;
ALTER TABLE public."Transaction" ADD COLUMN IF NOT EXISTS "receiptMime" TEXT;
ALTER TABLE public."Transaction" ADD COLUMN IF NOT EXISTS "receiptBytes" INTEGER;
ALTER TABLE public."Transaction" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;
ALTER TABLE public."Transaction" ADD COLUMN IF NOT EXISTS "requestHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_requestKey_key" ON public."Transaction"("requestKey");
CREATE TABLE IF NOT EXISTS public."InventoryMovement" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "itemId" TEXT NOT NULL REFERENCES public."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "actorId" TEXT NOT NULL,
 "delta" INTEGER NOT NULL,
 "beforeStock" INTEGER NOT NULL,
 "afterStock" INTEGER NOT NULL,
 "reason" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMovement_requestKey_key" ON public."InventoryMovement"("requestKey");
CREATE INDEX IF NOT EXISTS "InventoryMovement_itemId_createdAt_idx" ON public."InventoryMovement"("itemId", "createdAt");
ALTER TABLE public."InventoryMovement" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."InventoryMovement" FROM anon, authenticated;
COMMIT;