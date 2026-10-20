import { describe, expect, it } from "vitest";
import type { BracketCard } from "@/lib/competition-view";
import { renderBracketToCanvas } from "./bracket-image";

describe("bracket-image Canvas generator", () => {
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
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      arc: () => calls.push("arc"),
      ellipse: () => calls.push("ellipse"),
    } as unknown as CanvasRenderingContext2D;

    return { mockCanvas, mockContext };
  };

  const mockCards: BracketCard[] = [
    {
      key: "r1-m1",
      matchId: "m1",
      round: 1,
      position: 1,
      home: { name: "Pareja 1", winner: false, seedBadge: "1A" },
      away: { name: "Pareja 2", winner: false, seedBadge: "2B" },
      resultText: null,
      isThirdPlace: false,
      isBye: false,
      startsAt: null,
      courtName: null,
    },
    {
      key: "r1-m2",
      matchId: "m2",
      round: 1,
      position: 2,
      home: { name: "Pareja 3", winner: false, seedBadge: "1B" },
      away: { name: "Pareja 4", winner: false, seedBadge: "2A" },
      resultText: null,
      isThirdPlace: false,
      isBye: false,
      startsAt: null,
      courtName: null,
    },
    {
      key: "r2-m1",
      matchId: "m3",
      round: 2,
      position: 1,
      home: { name: "TBD", winner: false },
      away: { name: "TBD", winner: false },
      resultText: null,
      isThirdPlace: false,
      isBye: false,
      startsAt: null,
      courtName: null,
    },
  ];

  it("renderiza el cuadro de cruces y contiene el pie con LM Torneos", () => {
    const calls: string[] = [];
    const texts: string[] = [];
    const { mockCanvas } = createMockCanvas(calls, texts);

    renderBracketToCanvas(mockCanvas, {
      tournamentName: "Torneo Apertura 2026",
      categoryName: "5ta Caballeros",
      sportName: "Pádel",
      cards: mockCards,
    });

    expect(mockCanvas.width).toBeGreaterThanOrEqual(1200);
    expect(mockCanvas.height).toBeGreaterThanOrEqual(860);
    expect(calls.filter((c) => c === "fillText").length).toBeGreaterThan(5);
    expect(texts.some((t) => t.includes("LM Torneos"))).toBe(true);
  });
});
