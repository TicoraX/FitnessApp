import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoutineDto, RoutineItemDto, UpdateRoutineDto } from './dto/routine.dto';

const CON_ITEMS = { items: { orderBy: { position: 'asc' } } } as const;

type RutinaConItems = Prisma.RoutineGetPayload<{ include: { items: true } }>;

/**
 * Las rutinas son plantillas: la lista de movimientos de un entreno con sus
 * objetivos. Cargarlas en un día es cosa de LogsService, que es el que sabe
 * crear el diario del día; acá solo se administran.
 */
@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rutinas = await this.prisma.routine.findMany({
      where: { userId },
      include: CON_ITEMS,
      orderBy: { name: 'asc' },
    });
    return { status: 'success', data: rutinas.map(detalle) };
  }

  async get(userId: string, id: string) {
    const rutina = await this.prisma.routine.findFirst({
      where: { id, userId },
      include: CON_ITEMS,
    });
    if (!rutina) throw new NotFoundException('La rutina no existe');
    return { status: 'success', data: detalle(rutina) };
  }

  async create(userId: string, dto: CreateRoutineDto) {
    try {
      const rutina = await this.prisma.routine.create({
        data: {
          userId,
          name: dto.name,
          notes: dto.notes ?? null,
          items: { create: itemsParaCrear(dto.items) },
        },
        include: CON_ITEMS,
      });
      return { status: 'success', data: detalle(rutina) };
    } catch (e) {
      throw traducirNombreRepetido(e);
    }
  }

  /**
   * Propiedad en el where del updateMany, no en un SELECT aparte: si el id no
   * es de este usuario, count vuelve en cero y sale el mismo 404 que si no
   * existiera. Mismo patrón que las recetas.
   */
  async update(userId: string, id: string, dto: UpdateRoutineDto) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.routine.updateMany({
          where: { id, userId },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
          },
        });
        if (count === 0) throw new NotFoundException('La rutina no existe');

        if (dto.items) {
          await tx.routineItem.deleteMany({ where: { routineId: id } });
          await tx.routineItem.createMany({
            data: itemsParaCrear(dto.items).map((i) => ({ ...i, routineId: id })),
          });
        }
      });
    } catch (e) {
      throw traducirNombreRepetido(e);
    }

    return this.get(userId, id);
  }

  /**
   * Borra de verdad, no archiva: una rutina cargada en un día ya se copió a
   * strength_entries, así que el historial no la referencia.
   */
  async remove(userId: string, id: string) {
    const { count } = await this.prisma.routine.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('La rutina no existe');
  }
}

const itemsParaCrear = (items: RoutineItemDto[]) =>
  items.map((i, pos) => ({
    name: i.name,
    sets: i.sets,
    reps: i.reps,
    weightKg: i.weight_kg ?? null,
    rpe: i.rpe ?? null,
    position: pos,
  }));

/** El UNIQUE de (user, nombre) sale como 500 si no se traduce. */
function traducirNombreRepetido(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return new ConflictException('Ya tenés una rutina con ese nombre');
  }
  return e;
}

export function detalle(r: RutinaConItems) {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    items: r.items.map((i) => ({
      id: i.id,
      name: i.name,
      sets: i.sets,
      reps: i.reps,
      weight_kg: i.weightKg === null ? null : Number(i.weightKg),
      rpe: i.rpe === null ? null : Number(i.rpe),
    })),
  };
}
