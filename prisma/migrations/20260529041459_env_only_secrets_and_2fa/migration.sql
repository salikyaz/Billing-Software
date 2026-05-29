/*
  Warnings:

  - You are about to drop the column `msClientSecret` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSecretKey` on the `Settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "twoFactorCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "twoFactorCodeHash" TEXT;

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "msClientSecret",
DROP COLUMN "stripeSecretKey",
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
