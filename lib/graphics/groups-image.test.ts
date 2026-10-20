import { describe, expect, it } from "vitest";
import { type GroupExportData, renderGroupsToCanvas } from "./groups-image";

describe("groups-image Canvas generator", () => {
  const createMockCanvas = (calls: string[], texts: string[] = []) => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockContext,
    } as unknown as HTMLCanvasElement;

    const mockContext = {
      canvas: mockCanvas,
      measureText: (text: string) => ({ width: text.length * 8 }),
      fillRect: () => calls.push("fillRect"),
      fillText: (text: string) => {
        calls.push("fillText");
        texts.push(String(text));
      },
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

  const mockGroups: GroupExportData[] = [
    {
      name: "Zona A",
      teams: ["Pérez / Gómez", "López / Rossi", "Fernández / Díaz"],
    },
    {
      name: "Zona B",
      teams: ["Martínez / Silva", "Torres / Castro"],
    },
  ];

  it("renderiza grupos en formato Story (9:16) con fondo oscuro predeterminado", () => {
    const calls: string[] = [];
    const texts: string[] = [];
    const { mockCanvas } = createMockCanvas(calls, texts);

    renderGroupsToCanvas(mockCanvas, {
      tournamentName: "Torneo Primavera 2026",
      categoryName: "5ta Caballeros",
      sportName: "Pádel",
      groups: mockGroups,
      format: "story",
    });

    expect(mockCanvas.width).toBe(1080);
    expect(mockCanvas.height).toBe(1920);
    expect(calls.filter((c) => c === "fillText").length).toBeGreaterThan(5);
    expect(texts.some((t) => t.includes("LM Torneos"))).toBe(true);
  });

  it("renderiza grupos en formato Story con imagen de fondo personalizada (drawImage)", () => {
    const calls: string[] = [];
    const { mockCanvas } = createMockCanvas(calls);

    const mockImage = {
      naturalWidth: 1080,
      naturalHeight: 1920,
      width: 1080,
      height: 1920,
    } as unknown as CanvasImageSource;

    renderGroupsToCanvas(mockCanvas, {
      tournamentName: "Torneo Pádel Diamante",
      categoryName: "+12 Caballeros",
      sportName: "Pádel",
      groups: mockGroups,
      format: "story",
      backgroundImage: mockImage,
      overlayOpacity: 0.45,
    });

    expect(mockCanvas.width).toBe(1080);
    expect(mockCanvas.height).toBe(1920);
    expect(calls).toContain("drawImage");
  });

  it("renderiza grupos en formato Estándar (1200px) correctamente", () => {
    const calls: string[] = [];
    const texts: string[] = [];
    const { mockCanvas } = createMockCanvas(calls, texts);

    renderGroupsToCanvas(mockCanvas, {
      tournamentName: "Torneo Apertura",
      categoryName: "7ma",
      sportName: "Pádel",
      groups: mockGroups,
      format: "standard",
    });

    expect(mockCanvas.width).toBe(1200);
    expect(mockCanvas.height).toBeGreaterThanOrEqual(860);
    expect(calls.filter((c) => c === "fillText").length).toBeGreaterThan(5);
    expect(texts.some((t) => t.includes("LM Torneos"))).toBe(true);
  });
});
