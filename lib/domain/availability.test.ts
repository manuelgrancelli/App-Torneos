import { describe, expect, it } from "vitest";
import { groupSlotsByDay, parseEmailList, selectionChanged, summarizeAvailability } from "./availability";

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
