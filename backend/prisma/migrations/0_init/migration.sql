-- CreateTable
CREATE TABLE "dictionary_entries" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dictionary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_cross_references" (
    "id" SERIAL NOT NULL,
    "sense_id" INTEGER NOT NULL,
    "xref_text" TEXT NOT NULL,
    "xref_type" VARCHAR(50),

    CONSTRAINT "entry_cross_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_kanji" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "kanji" TEXT NOT NULL,
    "is_common" BOOLEAN DEFAULT false,
    "priority_tags" TEXT[],
    "info" TEXT[],
    "kanji_order" INTEGER NOT NULL,

    CONSTRAINT "entry_kanji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_kanji_characters" (
    "id" SERIAL NOT NULL,
    "entry_kanji_id" INTEGER NOT NULL,
    "kanji_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "entry_kanji_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_readings" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "reading" TEXT NOT NULL,
    "is_common" BOOLEAN DEFAULT false,
    "priority_tags" TEXT[],
    "info" TEXT[],
    "reading_order" INTEGER NOT NULL,

    CONSTRAINT "entry_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_senses" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "sense_order" INTEGER NOT NULL,
    "parts_of_speech" TEXT[],
    "fields" TEXT[],
    "misc" TEXT[],
    "dialects" TEXT[],

    CONSTRAINT "entry_senses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji" (
    "id" SERIAL NOT NULL,
    "literal" VARCHAR(10) NOT NULL,
    "unicode_codepoint" VARCHAR(10),
    "classical_radical" INTEGER,
    "stroke_count" INTEGER NOT NULL,
    "grade" INTEGER,
    "frequency_rank" INTEGER,
    "jlpt_level" INTEGER,
    "on_readings" TEXT[],
    "kun_readings" TEXT[],
    "nanori_readings" TEXT[],
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji_meanings" (
    "id" SERIAL NOT NULL,
    "kanji_id" INTEGER NOT NULL,
    "meaning" TEXT NOT NULL,
    "meaning_order" INTEGER NOT NULL,

    CONSTRAINT "kanji_meanings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'not_started',
    "description" TEXT,
    "image_path" VARCHAR(1000),
    "difficulty_level" VARCHAR(50),
    "tags" TEXT[],
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sense_glosses" (
    "id" SERIAL NOT NULL,
    "sense_id" INTEGER NOT NULL,
    "gloss" TEXT NOT NULL,
    "gloss_type" VARCHAR(50),
    "gloss_order" INTEGER NOT NULL,

    CONSTRAINT "sense_glosses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_entries_entry_id_key" ON "dictionary_entries"("entry_id");

-- CreateIndex
CREATE INDEX "idx_entry_kanji_common" ON "entry_kanji"("is_common");

-- CreateIndex
CREATE INDEX "idx_entry_kanji_entry_id" ON "entry_kanji"("entry_id");

-- CreateIndex
CREATE INDEX "idx_entry_kanji_kanji" ON "entry_kanji"("kanji");

-- CreateIndex
CREATE UNIQUE INDEX "entry_kanji_entry_id_kanji_order_key" ON "entry_kanji"("entry_id", "kanji_order");

-- CreateIndex
CREATE INDEX "idx_entry_kanji_characters_entry_kanji_id" ON "entry_kanji_characters"("entry_kanji_id");

-- CreateIndex
CREATE INDEX "idx_entry_kanji_characters_kanji_id" ON "entry_kanji_characters"("kanji_id");

-- CreateIndex
CREATE UNIQUE INDEX "entry_kanji_characters_entry_kanji_id_position_key" ON "entry_kanji_characters"("entry_kanji_id", "position");

-- CreateIndex
CREATE INDEX "idx_entry_readings_common" ON "entry_readings"("is_common");

-- CreateIndex
CREATE INDEX "idx_entry_readings_entry_id" ON "entry_readings"("entry_id");

-- CreateIndex
CREATE INDEX "idx_entry_readings_reading" ON "entry_readings"("reading");

-- CreateIndex
CREATE UNIQUE INDEX "entry_readings_entry_id_reading_order_key" ON "entry_readings"("entry_id", "reading_order");

-- CreateIndex
CREATE INDEX "idx_entry_senses_entry_id" ON "entry_senses"("entry_id");

-- CreateIndex
CREATE INDEX "idx_entry_senses_pos" ON "entry_senses" USING GIN ("parts_of_speech");

-- CreateIndex
CREATE UNIQUE INDEX "entry_senses_entry_id_sense_order_key" ON "entry_senses"("entry_id", "sense_order");

-- CreateIndex
CREATE UNIQUE INDEX "kanji_literal_key" ON "kanji"("literal");

-- CreateIndex
CREATE INDEX "idx_kanji_frequency" ON "kanji"("frequency_rank");

-- CreateIndex
CREATE INDEX "idx_kanji_grade" ON "kanji"("grade");

-- CreateIndex
CREATE INDEX "idx_kanji_jlpt" ON "kanji"("jlpt_level");

-- CreateIndex
CREATE INDEX "idx_kanji_literal" ON "kanji"("literal");

-- CreateIndex
CREATE INDEX "idx_kanji_radical" ON "kanji"("classical_radical");

-- CreateIndex
CREATE INDEX "idx_kanji_stroke_count" ON "kanji"("stroke_count");

-- CreateIndex
CREATE INDEX "idx_kanji_unicode" ON "kanji"("unicode_codepoint");

-- CreateIndex
CREATE INDEX "idx_kanji_meanings_kanji_id" ON "kanji_meanings"("kanji_id");

-- CreateIndex
CREATE UNIQUE INDEX "kanji_meanings_kanji_id_meaning_order_key" ON "kanji_meanings"("kanji_id", "meaning_order");

-- CreateIndex
CREATE INDEX "idx_resources_difficulty" ON "resources"("difficulty_level");

-- CreateIndex
CREATE INDEX "idx_resources_status" ON "resources"("status");

-- CreateIndex
CREATE INDEX "idx_resources_tags" ON "resources" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "idx_resources_type" ON "resources"("type");

-- CreateIndex
CREATE INDEX "idx_resources_user_id" ON "resources"("user_id");

-- CreateIndex
CREATE INDEX "idx_sense_glosses_sense_id" ON "sense_glosses"("sense_id");

-- CreateIndex
CREATE UNIQUE INDEX "sense_glosses_sense_id_gloss_order_key" ON "sense_glosses"("sense_id", "gloss_order");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_username" ON "users"("username");

-- AddForeignKey
ALTER TABLE "entry_cross_references" ADD CONSTRAINT "entry_cross_references_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "entry_senses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "entry_kanji" ADD CONSTRAINT "entry_kanji_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "dictionary_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "entry_kanji_characters" ADD CONSTRAINT "entry_kanji_characters_entry_kanji_id_fkey" FOREIGN KEY ("entry_kanji_id") REFERENCES "entry_kanji"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "entry_kanji_characters" ADD CONSTRAINT "entry_kanji_characters_kanji_id_fkey" FOREIGN KEY ("kanji_id") REFERENCES "kanji"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "entry_readings" ADD CONSTRAINT "entry_readings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "dictionary_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "entry_senses" ADD CONSTRAINT "entry_senses_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "dictionary_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kanji_meanings" ADD CONSTRAINT "kanji_meanings_kanji_id_fkey" FOREIGN KEY ("kanji_id") REFERENCES "kanji"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sense_glosses" ADD CONSTRAINT "sense_glosses_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "entry_senses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

