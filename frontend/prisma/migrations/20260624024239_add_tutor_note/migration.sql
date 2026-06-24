-- CreateTable
CREATE TABLE "TutorNote" (
    "id" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "homework" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorNote_pkey" PRIMARY KEY ("id")
);
