-- CreateTable
CREATE TABLE "SpeakingExercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "scenarioContext" TEXT NOT NULL,
    "transcriptText" TEXT,
    "grading" JSONB,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingExercise_submissionId_key" ON "SpeakingExercise"("submissionId");

-- AddForeignKey
ALTER TABLE "SpeakingExercise" ADD CONSTRAINT "SpeakingExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingExercise" ADD CONSTRAINT "SpeakingExercise_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
