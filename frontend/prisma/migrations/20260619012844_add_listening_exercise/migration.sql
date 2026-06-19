-- CreateTable
CREATE TABLE "ListeningExercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passageText" TEXT NOT NULL,
    "topic" TEXT,
    "passageType" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListeningExercise_submissionId_key" ON "ListeningExercise"("submissionId");

-- AddForeignKey
ALTER TABLE "ListeningExercise" ADD CONSTRAINT "ListeningExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningExercise" ADD CONSTRAINT "ListeningExercise_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
