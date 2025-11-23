-- CreateTable
CREATE TABLE "resource_images" (
    "id" SERIAL NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "image_path" VARCHAR(1000) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_resource_images_resource_id" ON "resource_images"("resource_id");

-- CreateIndex
CREATE INDEX "idx_resource_images_user_id" ON "resource_images"("user_id");

-- CreateIndex
CREATE INDEX "idx_resource_images_created_at" ON "resource_images"("created_at");

-- AddForeignKey
ALTER TABLE "resource_images" ADD CONSTRAINT "resource_images_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_images" ADD CONSTRAINT "resource_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
