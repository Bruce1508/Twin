-- AlterEnum
ALTER TYPE "ErrorCategory" ADD VALUE 'comprehension';

-- CreateTable
CREATE TABLE "ReadingExercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleText" TEXT NOT NULL,
    "topic" TEXT,
    "articleSource" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingExercise_submissionId_key" ON "ReadingExercise"("submissionId");

-- AddForeignKey
ALTER TABLE "ReadingExercise" ADD CONSTRAINT "ReadingExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingExercise" ADD CONSTRAINT "ReadingExercise_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
