import { describe, expect, it } from "vitest";
import { type MatchExportData, renderMatchesToCanvas } from "./matches-image";

describe("matches-image Canvas generator", () => {
  it("renderiza partidos con horarios y enfrentamientos en canvas con dimensiones compactas", () => {
    // Mock simple de CanvasRenderingContext2D para vitest (entorno node/jsdom)
    const calls: string[] = [];
    const mockContext = {
      measureText: (text: string) => ({ width: text.length * 7 }),
      fillRect: () => calls.push("fillRect"),
      fillText: () => calls.push("fillText"),
      strokeRect: () => calls.push("strokeRect"),
      beginPath: () => calls.push("beginPath"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      quadraticCurveTo: () => calls.push("quadraticCurveTo"),
      closePath: () => calls.push("closePath"),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      createRadialGradient: () => ({
        addColorStop: () => {},
      }),
      roundRect: () => calls.push("roundRect"),
    } as unknown as CanvasRenderingContext2D;

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockContext,
    } as unknown as HTMLCanvasElement;

    const mockMatches: MatchExportData[] = [
      {
        id: "m-1",
        homeName: "González / Pérez",
        awayName: "Rodríguez / Silva",
        startsAt: "2026-10-15T14:00:00.000Z",
        endsAt: "2026-10-15T15:30:00.000Z",
        courtName: "Cancha 1",
        section: "Zona A",
        categoryName: "5ta",
        resultText: null,
      },
      {
        id: "m-2",
        homeName: "Martínez / Gómez",
        awayName: "López / Díaz",
        startsAt: "2026-10-15T14:00:00.000Z",
        endsAt: "2026-10-15T15:30:00.000Z",
        courtName: "Cancha 2",
        section: "Zona B",
        categoryName: "5ta",
        resultText: null,
      },
      {
        id: "m-3",
        homeName: "Fernández / Rossi",
        awayName: "Castro / Morales",
        startsAt: null,
        endsAt: null,
        courtName: null,
        section: "Zona A",
        categoryName: "5ta",
        resultText: null,
      },
    ];

    renderMatchesToCanvas(mockCanvas, {
      tournamentName: "Torneo Apertura Pádel 2026",
      categoryName: "5ta Categoría",
      sportName: "Pádel",
      timezone: "America/Argentina/Buenos_Aires",
      matches: mockMatches,
    });

    expect(mockCanvas.width).toBe(1200);
    expect(mockCanvas.height).toBeGreaterThanOrEqual(580);
    expect(calls.length).toBeGreaterThan(20);
  });

  it("no falla si la lista de partidos está vacía", () => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    expect(() => {
      renderMatchesToCanvas(mockCanvas, {
        tournamentName: "Test",
        matches: [],
      });
    }).not.toThrow();
  });
});
