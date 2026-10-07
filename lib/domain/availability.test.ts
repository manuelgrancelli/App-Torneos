import { describe, expect, it } from "vitest";
import {
  groupDaySlotsIntoWindows,
  groupSlotsByDay,
  groupSlotsIntoDayWindows,
  parseEmailList,
  selectionChanged,
  summarizeAvailability,
} from "./availability";

const slot = (id: string, startsAt: string) => ({ id, startsAt, endsAt: startsAt });

describe("groupSlotsByDay", () => {
  it("agrupa por la clave de día y ordena cronológicamente", () => {
    const groups = groupSlotsByDay(
      [slot("c", "2026-10-11T12:00:00Z"), slot("a", "2026-10-10T12:00:00Z"), slot("b", "2026-10-10T15:00:00Z")],
      (s) => s.startsAt.slice(0, 10),
    );
    expect(groups).toEqual([
      { day: "2026-10-10", slots: [slot("a", "2026-10-10T12:00:00Z"), slot("b", "2026-10-10T15:00:00Z")] },
      { day: "2026-10-11", slots: [slot("c", "2026-10-11T12:00:00Z")] },
    ]);
  });

  it("sin franjas no hay grupos", () => {
    expect(groupSlotsByDay([], () => "x")).toEqual([]);
  });
});

describe("groupDaySlotsIntoWindows", () => {
  const slotRange = (id: string, startsAt: string, endsAt: string) => ({ id, startsAt, endsAt });

  it("agrupa turnos consecutivos de 1 hora en una sola franja completa", () => {
    // 09:00 a 13:00 (4 turnos de 1 hora)
    const slots = [
      slotRange("s1", "2026-10-10T09:00:00Z", "2026-10-10T10:00:00Z"),
      slotRange("s2", "2026-10-10T10:00:00Z", "2026-10-10T11:00:00Z"),
      slotRange("s3", "2026-10-10T11:00:00Z", "2026-10-10T12:00:00Z"),
      slotRange("s4", "2026-10-10T12:00:00Z", "2026-10-10T13:00:00Z"),
    ];
    const windows = groupDaySlotsIntoWindows("2026-10-10", slots);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.startsAt).toBe("2026-10-10T09:00:00Z");
    expect(windows[0]?.endsAt).toBe("2026-10-10T13:00:00Z");
    expect(windows[0]?.slotIds).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("separa franjas cuando hay una pausa significativa entre ellas (ej. mañana 9 a 15 y tarde 18 a 22)", () => {
    const slots = [
      // Franja mañana
      slotRange("s1", "2026-10-10T09:00:00Z", "2026-10-10T12:00:00Z"),
      slotRange("s2", "2026-10-10T12:00:00Z", "2026-10-10T15:00:00Z"),
      // Franja tarde
      slotRange("s3", "2026-10-10T18:00:00Z", "2026-10-10T20:00:00Z"),
      slotRange("s4", "2026-10-10T20:00:00Z", "2026-10-10T22:00:00Z"),
    ];
    const windows = groupDaySlotsIntoWindows("2026-10-10", slots);
    expect(windows).toHaveLength(2);
    expect(windows[0]?.startsAt).toBe("2026-10-10T09:00:00Z");
    expect(windows[0]?.endsAt).toBe("2026-10-10T15:00:00Z");
    expect(windows[0]?.slotIds).toEqual(["s1", "s2"]);

    expect(windows[1]?.startsAt).toBe("2026-10-10T18:00:00Z");
    expect(windows[1]?.endsAt).toBe("2026-10-10T22:00:00Z");
    expect(windows[1]?.slotIds).toEqual(["s3", "s4"]);
  });

  it("mantiene turnos en diferentes canchas dentro de la misma franja horaria", () => {
    const slots = [
      slotRange("cancha1-1", "2026-10-10T09:00:00Z", "2026-10-10T10:00:00Z"),
      slotRange("cancha2-1", "2026-10-10T09:00:00Z", "2026-10-10T10:00:00Z"),
      slotRange("cancha1-2", "2026-10-10T10:00:00Z", "2026-10-10T11:00:00Z"),
      slotRange("cancha2-2", "2026-10-10T10:00:00Z", "2026-10-10T11:00:00Z"),
    ];
    const windows = groupDaySlotsIntoWindows("2026-10-10", slots);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.startsAt).toBe("2026-10-10T09:00:00Z");
    expect(windows[0]?.endsAt).toBe("2026-10-10T11:00:00Z");
    expect(windows[0]?.slotIds).toHaveLength(4);
  });
});

describe("summarizeAvailability", () => {
  it("cuenta por franja y por equipo, ignorando ajenos y duplicados", () => {
    const summary = summarizeAvailability(
      ["t1", "t2", "t3"],
      ["s1", "s2", "s3"],
      [
        { teamId: "t1", slotId: "s1" },
        { teamId: "t1", slotId: "s1" },
        { teamId: "t1", slotId: "s2" },
        { teamId: "t2", slotId: "s1" },
        { teamId: "zz", slotId: "s1" },
        { teamId: "t2", slotId: "zz" },
      ],
    );
    expect(Object.fromEntries(summary.bySlot)).toEqual({ s1: 2, s2: 1, s3: 0 });
    expect(Object.fromEntries(summary.byTeam)).toEqual({ t1: 2, t2: 1, t3: 0 });
    expect(summary.teamsWithoutAvailability).toEqual(["t3"]);
    expect(summary.emptySlots).toEqual(["s3"]);
    expect(summary.has("t1", "s2")).toBe(true);
    expect(summary.has("t2", "s2")).toBe(false);
  });
});

describe("selectionChanged / parseEmailList", () => {
  it("detecta cambios de selección", () => {
    expect(selectionChanged(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(false);
    expect(selectionChanged(new Set(["a"]), new Set(["a", "b"]))).toBe(true);
    expect(selectionChanged(new Set(["a", "c"]), new Set(["a", "b"]))).toBe(true);
  });

  it("separa listas pegadas de emails", () => {
    expect(parseEmailList(" A@x.com, b@y.com;\nc@z.com  a@x.com ")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(parseEmailList("   ")).toEqual([]);
  });
});
