import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Admin -------------------------------------------------------------
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@aitek-solutions.com")
    .toLowerCase()
    .trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!123";
  const name = process.env.SEED_ADMIN_NAME ?? "Aitek Admin";

  const hashed = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, password: hashed, name },
  });
  console.log(`✔ Admin ready: ${admin.email}`);

  // --- Settings singleton ------------------------------------------------
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      companyName: process.env.COMPANY_NAME ?? "Aitek Solutions",
      companyEmail: "billing@aitek-solutions.com",
      companyAddress: "123 Business Ave\nMetro City",
      logoUrl: "/logo.png",
      taxRate: new Prisma.Decimal(0),
      defaultCurrency: "USD",
      billingDay: 1,
      reminderAfterDays: 7,
    },
  });
  console.log("✔ Settings initialized");

  // --- Sample services ---------------------------------------------------
  const services = [
    {
      name: "Managed IT Support",
      description: "Monthly managed IT support and monitoring",
      defaultPrice: new Prisma.Decimal(499),
      unit: "monthly",
    },
    {
      name: "Cloud Hosting",
      description: "Cloud infrastructure hosting",
      defaultPrice: new Prisma.Decimal(199),
      unit: "monthly",
    },
    {
      name: "Software Development",
      description: "Custom software development",
      defaultPrice: new Prisma.Decimal(120),
      unit: "per hour",
    },
    {
      name: "Security Audit",
      description: "One-time security assessment",
      defaultPrice: new Prisma.Decimal(1500),
      unit: "one-time",
    },
  ];

  const createdServices = [];
  for (const s of services) {
    const found = await prisma.service.findFirst({ where: { name: s.name } });
    const svc = found
      ? await prisma.service.update({ where: { id: found.id }, data: s })
      : await prisma.service.create({ data: s });
    createdServices.push(svc);
  }
  console.log(`✔ ${createdServices.length} sample services ready`);

  // --- Sample client + assigned recurring services ----------------------
  const existingClient = await prisma.client.findFirst({
    where: { email: "demo@example.com" },
  });
  const client =
    existingClient ??
    (await prisma.client.create({
      data: {
        name: "Demo Client",
        email: "demo@example.com",
        company: "Demo Corp",
        phone: "+1 555 0100",
        address: "456 Client Road\nMetro City",
        currency: "USD",
      },
    }));

  // Assign two recurring services for the monthly-billing demo
  const recurring = createdServices.filter((s) => s.unit === "monthly");
  for (const svc of recurring) {
    await prisma.clientService.upsert({
      where: {
        clientId_serviceId: { clientId: client.id, serviceId: svc.id },
      },
      update: {},
      create: { clientId: client.id, serviceId: svc.id, quantity: 1 },
    });
  }
  console.log(`✔ Demo client ready with ${recurring.length} recurring services`);

  console.log("\n🎉 Seed complete.");
  console.log(`   Login: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
