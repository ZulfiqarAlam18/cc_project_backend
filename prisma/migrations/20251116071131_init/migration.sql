/*
  Warnings:

  - You are about to drop the column `age` on the `finder_reports` table. All the data in the column will be lost.
  - You are about to drop the column `clothes` on the `finder_reports` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `finder_reports` table. All the data in the column will be lost.
  - You are about to drop the column `age` on the `parent_reports` table. All the data in the column will be lost.
  - You are about to drop the column `clothes` on the `parent_reports` table. All the data in the column will be lost.
  - Added the required column `contactNumber` to the `parent_reports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `emergency` to the `parent_reports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatherName` to the `parent_reports` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "finder_reports" DROP COLUMN "age",
DROP COLUMN "clothes",
DROP COLUMN "state",
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "emergency" TEXT,
ADD COLUMN     "fatherName" TEXT,
ALTER COLUMN "placeFound" DROP NOT NULL,
ALTER COLUMN "foundTime" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "latitude" SET DEFAULT 0.0,
ALTER COLUMN "longitude" SET DEFAULT 0.0;

-- AlterTable
ALTER TABLE "parent_reports" DROP COLUMN "age",
DROP COLUMN "clothes",
ADD COLUMN     "contactNumber" TEXT NOT NULL,
ADD COLUMN     "emergency" TEXT NOT NULL,
ADD COLUMN     "fatherName" TEXT NOT NULL,
ALTER COLUMN "placeLost" DROP NOT NULL,
ALTER COLUMN "latitude" SET DEFAULT 0.0,
ALTER COLUMN "longitude" SET DEFAULT 0.0;
