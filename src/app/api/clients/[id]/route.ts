import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { clientSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
        clientServices: { include: { service: true } },
      },
    });
    if (!client) throw new ApiError("Client not found", 404);
    return client;
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = clientSchema.partial().parse(await req.json());
    return prisma.client.update({
      where: { id: params.id },
      data,
    });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();

    const invoiceCount = await prisma.invoice.count({
      where: { clientId: params.id },
    });

    if (invoiceCount > 0) {
      await prisma.client.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return { ok: true, softDeleted: true };
    }

    await prisma.client.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
