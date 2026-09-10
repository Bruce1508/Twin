-- CreateTable
CREATE TABLE "TagSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "errorTag" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consecutiveImproving" INTEGER NOT NULL DEFAULT 0,
    "lastDrilledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TagSchedule_userId_errorTag_key" ON "TagSchedule"("userId", "errorTag");

-- AddForeignKey
ALTER TABLE "TagSchedule" ADD CONSTRAINT "TagSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
