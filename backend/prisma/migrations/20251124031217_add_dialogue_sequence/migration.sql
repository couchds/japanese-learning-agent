-- AlterTable
ALTER TABLE "ocr_composite" ADD COLUMN     "previous_composite_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_ocr_composite_previous" ON "ocr_composite"("previous_composite_id");

-- AddForeignKey
ALTER TABLE "ocr_composite" ADD CONSTRAINT "ocr_composite_previous_composite_id_fkey" FOREIGN KEY ("previous_composite_id") REFERENCES "ocr_composite"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
