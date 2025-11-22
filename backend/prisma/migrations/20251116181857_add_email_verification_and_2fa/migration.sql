-- AlterTable
ALTER TABLE "users" 
  ALTER COLUMN "email" SET NOT NULL,
  ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verification_token" VARCHAR(255),
  ADD COLUMN "verification_token_expiry" TIMESTAMP(6),
  ADD COLUMN "twofa_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "twofa_codes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twofa_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_users_verification_token" ON "users"("verification_token");

-- CreateIndex
CREATE INDEX "idx_twofa_codes_user_id" ON "twofa_codes"("user_id");

-- CreateIndex
CREATE INDEX "idx_twofa_codes_code" ON "twofa_codes"("code");

-- CreateIndex
CREATE INDEX "idx_twofa_codes_expires_at" ON "twofa_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "twofa_codes" ADD CONSTRAINT "twofa_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;



