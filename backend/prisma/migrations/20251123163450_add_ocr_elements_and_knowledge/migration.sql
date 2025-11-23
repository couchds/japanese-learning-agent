-- AlterTable
ALTER TABLE "resource_images" ADD COLUMN     "ocr_processed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ocr_raw_text" TEXT;

-- CreateTable
CREATE TABLE "ocr_elements" (
    "id" SERIAL NOT NULL,
    "resource_image_id" INTEGER NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "element_type" VARCHAR(50) NOT NULL,
    "item_id" INTEGER,
    "confidence" DOUBLE PRECISION,
    "position_x" INTEGER,
    "position_y" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_knowledge" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "item_type" VARCHAR(50) NOT NULL,
    "item_id" INTEGER NOT NULL,
    "proficiency_level" INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "incorrect_count" INTEGER NOT NULL DEFAULT 0,
    "last_reviewed" TIMESTAMP(6),
    "next_review" TIMESTAMP(6),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ocr_elements_image_id" ON "ocr_elements"("resource_image_id");

-- CreateIndex
CREATE INDEX "idx_ocr_elements_type_item" ON "ocr_elements"("element_type", "item_id");

-- CreateIndex
CREATE INDEX "idx_ocr_elements_text" ON "ocr_elements"("text");

-- CreateIndex
CREATE INDEX "idx_user_knowledge_user_id" ON "user_knowledge"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_knowledge_item" ON "user_knowledge"("item_type", "item_id");

-- CreateIndex
CREATE INDEX "idx_user_knowledge_proficiency" ON "user_knowledge"("proficiency_level");

-- CreateIndex
CREATE INDEX "idx_user_knowledge_next_review" ON "user_knowledge"("next_review");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_item" ON "user_knowledge"("user_id", "item_type", "item_id");

-- CreateIndex
CREATE INDEX "idx_resource_images_ocr_processed" ON "resource_images"("ocr_processed");

-- AddForeignKey
ALTER TABLE "ocr_elements" ADD CONSTRAINT "ocr_elements_resource_image_id_fkey" FOREIGN KEY ("resource_image_id") REFERENCES "resource_images"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_knowledge" ADD CONSTRAINT "user_knowledge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
