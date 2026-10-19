import { describe, expect, it } from "vitest";
import { type MatchExportData, renderMatchesToCanvas } from "./matches-image";

describe("matches-image Canvas generator", () => {
  const createMockCanvas = (calls: string[]) => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockContext,
    } as unknown as HTMLCanvasElement;

    const mockContext = {
      canvas: mockCanvas,
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
      drawImage: () => calls.push("drawImage"),
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      createRadialGradient: () => ({
        addColorStop: () => {},
      }),
      roundRect: () => calls.push("roundRect"),
    } as unknown as CanvasRenderingContext2D;

    return { mockCanvas, mockContext };
  };

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

  it("renderiza partidos con horarios en formato Estándar (1200px)", () => {
    const calls: string[] = [];
    const { mockCanvas } = createMockCanvas(calls);

    renderMatchesToCanvas(mockCanvas, {
      tournamentName: "Torneo Apertura Pádel 2026",
      categoryName: "5ta Categoría",
      sportName: "Pádel",
      timezone: "America/Argentina/Buenos_Aires",
      matches: mockMatches,
      format: "standard",
    });

    expect(mockCanvas.width).toBe(1200);
    expect(mockCanvas.height).toBeGreaterThanOrEqual(580);
    expect(calls.filter((c) => c === "fillText").length).toBeGreaterThan(10);
  });

  it("renderiza partidos en formato Historia (9:16) con imagen de fondo", () => {
    const calls: string[] = [];
    const { mockCanvas } = createMockCanvas(calls);

    const mockImage = {
      naturalWidth: 1080,
      naturalHeight: 1920,
      width: 1080,
      height: 1920,
    } as unknown as CanvasImageSource;

    renderMatchesToCanvas(mockCanvas, {
      tournamentName: "Torneo Pádel Diamante",
      categoryName: "7ma Caballeros",
      sportName: "Pádel",
      timezone: "America/Argentina/Buenos_Aires",
      matches: mockMatches,
      format: "story",
      backgroundImage: mockImage,
      overlayOpacity: 0.45,
    });

    expect(mockCanvas.width).toBe(1080);
    expect(mockCanvas.height).toBe(1920);
    expect(calls).toContain("drawImage");
    expect(calls.filter((c) => c === "fillText").length).toBeGreaterThan(10);
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
