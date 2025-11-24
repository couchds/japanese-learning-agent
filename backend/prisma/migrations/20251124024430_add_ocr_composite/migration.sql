-- AlterTable
ALTER TABLE "ocr_elements" ADD COLUMN     "composite_id" INTEGER;

-- CreateTable
CREATE TABLE "ocr_composite" (
    "id" SERIAL NOT NULL,
    "resource_image_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "dialogue_text" TEXT NOT NULL,
    "translation" TEXT,
    "breakdown" JSONB,
    "grammar_notes" TEXT,
    "context_notes" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_composite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ocr_composite_image_id" ON "ocr_composite"("resource_image_id");

-- CreateIndex
CREATE INDEX "idx_ocr_composite_user_id" ON "ocr_composite"("user_id");

-- CreateIndex
CREATE INDEX "idx_ocr_composite_processed" ON "ocr_composite"("processed");

-- CreateIndex
CREATE INDEX "idx_ocr_elements_composite_id" ON "ocr_elements"("composite_id");

-- AddForeignKey
ALTER TABLE "ocr_elements" ADD CONSTRAINT "ocr_elements_composite_id_fkey" FOREIGN KEY ("composite_id") REFERENCES "ocr_composite"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocr_composite" ADD CONSTRAINT "ocr_composite_resource_image_id_fkey" FOREIGN KEY ("resource_image_id") REFERENCES "resource_images"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocr_composite" ADD CONSTRAINT "ocr_composite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
