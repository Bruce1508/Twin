import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "bruce@twin.local" },
    update: {},
    create: {
      email: "bruce@twin.local",
      name: "Bruce",
      targetLevel: "B2",
    },
  });
  console.log("Seed complete — dev user created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
