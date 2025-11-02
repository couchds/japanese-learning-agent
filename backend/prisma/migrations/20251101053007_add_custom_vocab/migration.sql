-- CreateTable
CREATE TABLE "custom_vocabulary" (
    "id" SERIAL NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "word" VARCHAR(255) NOT NULL,
    "reading" VARCHAR(255),
    "meaning" TEXT,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_custom_vocabulary_resource_id" ON "custom_vocabulary"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_vocabulary_resource_id_word_key" ON "custom_vocabulary"("resource_id", "word");

-- AddForeignKey
ALTER TABLE "custom_vocabulary" ADD CONSTRAINT "custom_vocabulary_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
