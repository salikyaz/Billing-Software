import { prisma } from "@/lib/prisma";
import { handleRoute, requireAdmin } from "@/lib/api";
import { serviceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    return prisma.service.findMany({ orderBy: { name: "asc" } });
  });
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = serviceSchema.parse(await req.json());
    return prisma.service.create({ data });
  });
}
