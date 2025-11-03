-- CreateTable
CREATE TABLE "pronunciation_recordings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "audio_path" VARCHAR(1000) NOT NULL,
    "is_reference" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pronunciation_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_pronunciation_recordings_user_id" ON "pronunciation_recordings"("user_id");

-- CreateIndex
CREATE INDEX "idx_pronunciation_recordings_entry_id" ON "pronunciation_recordings"("entry_id");

-- CreateIndex
CREATE INDEX "idx_pronunciation_recordings_is_reference" ON "pronunciation_recordings"("is_reference");

-- AddForeignKey
ALTER TABLE "pronunciation_recordings" ADD CONSTRAINT "pronunciation_recordings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pronunciation_recordings" ADD CONSTRAINT "pronunciation_recordings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "dictionary_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
