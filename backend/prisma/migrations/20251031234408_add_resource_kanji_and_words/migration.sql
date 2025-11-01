-- CreateTable
CREATE TABLE "resource_kanji" (
    "id" SERIAL NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "kanji_id" INTEGER NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_kanji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_words" (
    "id" SERIAL NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_resource_kanji_resource_id" ON "resource_kanji"("resource_id");

-- CreateIndex
CREATE INDEX "idx_resource_kanji_kanji_id" ON "resource_kanji"("kanji_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_kanji_resource_id_kanji_id_key" ON "resource_kanji"("resource_id", "kanji_id");

-- CreateIndex
CREATE INDEX "idx_resource_words_resource_id" ON "resource_words"("resource_id");

-- CreateIndex
CREATE INDEX "idx_resource_words_entry_id" ON "resource_words"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_words_resource_id_entry_id_key" ON "resource_words"("resource_id", "entry_id");

-- AddForeignKey
ALTER TABLE "resource_kanji" ADD CONSTRAINT "resource_kanji_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_kanji" ADD CONSTRAINT "resource_kanji_kanji_id_fkey" FOREIGN KEY ("kanji_id") REFERENCES "kanji"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_words" ADD CONSTRAINT "resource_words_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_words" ADD CONSTRAINT "resource_words_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "dictionary_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
