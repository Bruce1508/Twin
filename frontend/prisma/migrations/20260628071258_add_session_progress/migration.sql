-- CreateTable
CREATE TABLE "SessionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planPosition" INTEGER NOT NULL DEFAULT 1,
    "activeSession" JSONB,
    "startedAt" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),

    CONSTRAINT "SessionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionProgress_userId_key" ON "SessionProgress"("userId");

-- AddForeignKey
ALTER TABLE "SessionProgress" ADD CONSTRAINT "SessionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
