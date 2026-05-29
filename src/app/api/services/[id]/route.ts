import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { serviceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const service = await prisma.service.findUnique({
      where: { id: params.id },
    });
    if (!service) throw new ApiError("Service not found", 404);
    return service;
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = serviceSchema.partial().parse(await req.json());
    return prisma.service.update({
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
    try {
      await prisma.service.delete({ where: { id: params.id } });
      return { ok: true };
    } catch (err) {
      // FK constraint from invoice items -> soft delete instead.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        await prisma.service.update({
          where: { id: params.id },
          data: { isActive: false },
        });
        return { ok: true, softDeleted: true };
      }
      throw err;
    }
  });
}
