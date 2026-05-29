import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { clientServiceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    return prisma.clientService.findMany({
      where: { clientId: params.id },
      include: { service: true },
    });
  });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = clientServiceSchema.parse(await req.json());

    return prisma.clientService.upsert({
      where: {
        clientId_serviceId: {
          clientId: params.id,
          serviceId: data.serviceId,
        },
      },
      create: {
        clientId: params.id,
        serviceId: data.serviceId,
        quantity: data.quantity,
        customPrice: data.customPrice ?? null,
      },
      update: {
        quantity: data.quantity,
        customPrice: data.customPrice ?? null,
      },
      include: { service: true },
    });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = (await req.json()) as { serviceId?: string };
    if (!body.serviceId) throw new ApiError("serviceId is required", 400);

    await prisma.clientService.delete({
      where: {
        clientId_serviceId: {
          clientId: params.id,
          serviceId: body.serviceId,
        },
      },
    });
    return { ok: true };
  });
}
