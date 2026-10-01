import { describe, expect, it } from "vitest";
import {
  type TournamentStatusContext,
  approvedTeamsLabel,
  canDeleteTournament,
  checkTransition,
  isPublished,
  teamNoun,
} from "./tournament-status";

const ctx = (overrides: Partial<TournamentStatusContext> = {}): TournamentStatusContext => ({
  slotCount: 1,
  teamCount: 0,
  approvedTeamCount: 0,
  groupMatchCount: 0,
  pendingGroupMatchCount: 0,
  finalDecided: false,
  ...overrides,
});

describe("checkTransition (mismos mensajes que set_tournament_status)", () => {
  it("borrador → inscripción exige franjas", () => {
    expect(checkTransition("draft", "registration_open", ctx({ slotCount: 0 }))).toEqual({
      ok: false,
      reason: "Cargá al menos una franja horaria antes de abrir la inscripción.",
    });
    expect(checkTransition("draft", "registration_open", ctx())).toEqual({ ok: true });
  });

  it("no se puede saltear estados", () => {
    expect(checkTransition("draft", "group_stage", ctx())).toEqual({
      ok: false,
      reason: 'No se puede pasar de "borrador" a "fase de grupos".',
    });
    expect(checkTransition("finished", "draft", ctx()).ok).toBe(false);
  });

  it("volver a borrador solo sin inscripciones", () => {
    expect(checkTransition("registration_open", "draft", ctx({ teamCount: 1 })).ok).toBe(false);
    expect(checkTransition("registration_open", "draft", ctx())).toEqual({ ok: true });
  });

  it("fase de grupos exige 2 aprobados", () => {
    expect(checkTransition("registration_open", "group_stage", ctx({ approvedTeamCount: 1 })).ok).toBe(false);
    expect(checkTransition("registration_open", "group_stage", ctx({ approvedTeamCount: 2 }))).toEqual({ ok: true });
  });

  it("salir de grupos exige partidos generados y jugados", () => {
    expect(checkTransition("group_stage", "playoffs", ctx())).toEqual({
      ok: false,
      reason: "Todavía no se generaron los partidos de la fase de grupos.",
    });
    expect(checkTransition("group_stage", "finished", ctx({ groupMatchCount: 6, pendingGroupMatchCount: 1 }))).toEqual({
      ok: false,
      reason: "Faltan cargar resultados de la fase de grupos.",
    });
    expect(checkTransition("group_stage", "playoffs", ctx({ groupMatchCount: 6 }))).toEqual({ ok: true });
  });

  it("finalizar playoffs exige la final", () => {
    expect(checkTransition("playoffs", "finished", ctx()).ok).toBe(false);
    expect(checkTransition("playoffs", "finished", ctx({ finalDecided: true }))).toEqual({ ok: true });
    expect(checkTransition("playoffs", "playoffs", ctx())).toEqual({ ok: true });
  });
});

describe("helpers de estado", () => {
  it("publicado y borrable", () => {
    expect(isPublished("draft")).toBe(false);
    expect(isPublished("registration_open")).toBe(true);
    expect(canDeleteTournament("registration_open")).toBe(true);
    expect(canDeleteTournament("group_stage")).toBe(false);
  });

  it("pareja o equipo según el tamaño", () => {
    expect(teamNoun(2)).toBe("pareja");
    expect(teamNoun(2, true)).toBe("parejas");
    expect(teamNoun(11)).toBe("equipo");
    expect(teamNoun(11, true)).toBe("equipos");
    expect(approvedTeamsLabel(2)).toBe("parejas aprobadas");
    expect(approvedTeamsLabel(11)).toBe("equipos aprobados");
  });
});
