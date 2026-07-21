import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { Weekday } from "../../generated/prisma/enums.ts";

const isValidDay = (day: unknown): day is Weekday =>
  typeof day === "string" && (Object.values(Weekday) as string[]).includes(day);
const isValidSlot = (slot: unknown): slot is number =>
  typeof slot === "number" && Number.isInteger(slot) && slot >= 1 && slot <= 6;

export async function addOfferingTimeSlot(
  request: Request<{ offeringId: string }, {}, { day: Weekday; slot: number; classroom?: string }>,
  response: Response,
) {
  const offeringId = Number(request.params.offeringId);
  const { day, slot, classroom } = request.body;

  if (!isValidDay(day)) return response.status(400).send({ error: "Invalid day" });
  if (!isValidSlot(slot)) return response.status(400).send({ error: "Invalid slot" });

  const offering = await prisma.offering.findUnique({ where: { id: offeringId } });
  if (!offering) return response.status(404).send({ error: "Offering not found" });

  const existing = await prisma.offeringTimeSlot.findFirst({ where: { offeringId, day, slot } });
  if (existing) return response.status(409).send({ error: "Slot already assigned for this offering" });

  const created = await prisma.offeringTimeSlot.create({
    data: { offeringId, day, slot, classroom: classroom ?? null },
  });
  return response.status(201).send(created);
}

export async function updateOfferingTimeSlot(
  request: Request<
    { offeringId: string; slotId: string },
    {},
    { day?: Weekday; slot?: number; classroom?: string }
  >,
  response: Response,
) {
  const offeringId = Number(request.params.offeringId);
  const slotId = Number(request.params.slotId);
  const { day, slot, classroom } = request.body;

  if (day !== undefined && !isValidDay(day)) return response.status(400).send({ error: "Invalid day" });
  if (slot !== undefined && !isValidSlot(slot)) return response.status(400).send({ error: "Invalid slot" });

  const existing = await prisma.offeringTimeSlot.findFirst({ where: { id: slotId, offeringId } });
  if (!existing) return response.status(404).send({ error: "Time slot not found" });

  const newDay = day ?? existing.day;
  const newSlot = slot ?? existing.slot;
  if (newDay !== existing.day || newSlot !== existing.slot) {
    const conflict = await prisma.offeringTimeSlot.findFirst({
      where: { offeringId, day: newDay, slot: newSlot, NOT: { id: slotId } },
    });
    if (conflict) return response.status(409).send({ error: "Slot already assigned for this offering" });
  }

  const data = Object.fromEntries(
    Object.entries({ day, slot, classroom }).filter(([, v]) => v !== undefined),
  ) as { day?: Weekday; slot?: number; classroom?: string };

  const updated = await prisma.offeringTimeSlot.update({ where: { id: slotId }, data });
  return response.status(200).send(updated);
}

export async function deleteOfferingTimeSlot(
  request: Request<{ offeringId: string; slotId: string }>,
  response: Response,
) {
  const offeringId = Number(request.params.offeringId);
  const slotId = Number(request.params.slotId);

  const existing = await prisma.offeringTimeSlot.findFirst({ where: { id: slotId, offeringId } });
  if (!existing) return response.status(404).send({ error: "Time slot not found" });

  const deleted = await prisma.offeringTimeSlot.delete({ where: { id: slotId } });
  return response.status(200).send(deleted);
}
