/**
 * Generador de imagen del cuadro de playoffs (cruces) en Canvas 2D de alta resolución,
 * con diseño oscuro neutro (negro/grafito) optimizado para WhatsApp y redes.
 */

import type { BracketCard } from "@/lib/competition-view";
import { roundName } from "@/lib/domain/bracket";

export type GenerateBracketImageOptions = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  cards: BracketCard[];
  champion?: string | null;
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | [number, number, number, number],
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

type CardPosition = {
  x: number;
  y: number;
  centerY: number;
};

/**
 * Renderiza el cuadro de playoffs / cruces en un HTMLCanvasElement.
 */
export function renderBracketToCanvas(
  canvas: HTMLCanvasElement,
  options: GenerateBracketImageOptions,
) {
  const { tournamentName, categoryName, sportName, cards, champion } = options;
  const ctx = canvas.getContext("2d");
  if (!ctx || cards.length === 0) return;

  const main = cards.filter((c) => !c.isThirdPlace);
  const third = cards.find((c) => c.isThirdPlace);
  const totalRounds = main.reduce((max, c) => Math.max(max, c.round), 0);
  if (totalRounds === 0) return;

  // Organizar partidos por ronda
  const columns: BracketCard[][] = Array.from({ length: totalRounds }, (_, i) =>
    main.filter((c) => c.round === i + 1).sort((a, b) => a.position - b.position),
  );

  const r1Matches = columns[0] ?? [];
  const r1Count = Math.max(r1Matches.length, 1);

  const cardWidth = 280;
  const cardHeight = 88;
  const gapX = 48;
  const marginX = 64;

  const width = Math.max(1200, marginX * 2 + totalRounds * cardWidth + (totalRounds - 1) * gapX);

  // Altura base según la primera ronda
  const gapY = Math.max(28, Math.min(60, 380 / r1Count));
  const r1ContentHeight = r1Count * cardHeight + (r1Count - 1) * gapY;

  const headerHeight = champion ? 270 : 220;
  const footerHeight = 80;
  const extraThirdPlace = third ? 120 : 0;

  const totalHeight = headerHeight + Math.max(r1ContentHeight, 460) + extraThirdPlace + footerHeight;
  const height = Math.max(860, totalHeight);

  canvas.width = width;
  canvas.height = height;

  // 1. Fondo negro/grafito profundo neutro
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#050608");
  bgGrad.addColorStop(0.5, "#0b0c10");
  bgGrad.addColorStop(1, "#050608");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Iluminación ambiental neutra suave
  const glowTop = ctx.createRadialGradient(width / 2, 80, 20, width / 2, 80, 500);
  glowTop.addColorStop(0, "rgba(255, 255, 255, 0.04)");
  glowTop.addColorStop(1, "transparent");
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, width, 500);

  const glowBottom = ctx.createRadialGradient(width / 2, height - 100, 20, width / 2, height - 100, 450);
  glowBottom.addColorStop(0, "rgba(255, 255, 255, 0.03)");
  glowBottom.addColorStop(1, "transparent");
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, height - 500, width, 500);

  // Barra superior decorativa platino/blanca sutil
  const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
  topBarGrad.addColorStop(0, "transparent");
  topBarGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
  topBarGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, width, 2);

  // 2. Encabezado principal
  const badgeText = "⚡ CUADRO DE PLAYOFFS · CRUCES";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 30;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 36;

  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 28, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, width / 2, badgeY + 14);

  // Nombre del Torneo
  ctx.font = "900 40px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  const displayTitle = truncateText(ctx, tournamentName.toUpperCase(), width - 120);
  ctx.fillText(displayTitle, width / 2, 104);

  // Subtítulo (Deporte + Categoría) neutro
  const subtitleParts = [
    sportName ? sportName.toUpperCase() : "TORNEO",
    categoryName ? categoryName.toUpperCase() : null,
  ].filter(Boolean);
  const subtitleText = subtitleParts.join(" · ");

  ctx.font = "700 17px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(subtitleText, width / 2, 144);

  // Banner de Campeón si ya está definido
  if (champion) {
    const champY = 172;
    const champText = `🏆 CAMPEÓN: ${champion.toUpperCase()}`;
    ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
    const champWidth = Math.min(width - 160, ctx.measureText(champText).width + 40);
    const champX = (width - champWidth) / 2;

    drawRoundedRect(ctx, champX, champY, champWidth, 34, 17);
    const champGrad = ctx.createLinearGradient(champX, champY, champX + champWidth, champY);
    champGrad.addColorStop(0, "rgba(245, 158, 11, 0.16)");
    champGrad.addColorStop(1, "rgba(251, 191, 36, 0.22)");
    ctx.fillStyle = champGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(champText, width / 2, champY + 17);
  }

  // Divisor horizontal neutro
  const dividerY = headerHeight - 20;
  const dividerGrad = ctx.createLinearGradient(120, 0, width - 120, 0);
  dividerGrad.addColorStop(0, "transparent");
  dividerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
  dividerGrad.addColorStop(1, "transparent");
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(120, dividerY, width - 240, 1);

  // 3. Calcular posiciones de cada partido y guardar mapa para conectores
  const posMap = new Map<string, CardPosition>();

  // Contenido centrado horizontalmente
  const contentWidth = totalRounds * cardWidth + (totalRounds - 1) * gapX;
  const startX = (width - contentWidth) / 2;

  // Ronda 1: ubicaciones base
  const r1Col = columns[0] ?? [];
  r1Col.forEach((card, idx) => {
    const x = startX;
    const y = headerHeight + idx * (cardHeight + gapY);
    posMap.set(card.key, { x, y, centerY: y + cardHeight / 2 });
  });

  // Rondas siguientes: centradas entre los partidos que las alimentan
  for (let r = 2; r <= totalRounds; r++) {
    const colCards = columns[r - 1] ?? [];
    const prevCol = columns[r - 2] ?? [];
    const colX = startX + (r - 1) * (cardWidth + gapX);

    colCards.forEach((card, idx) => {
      const feedA = prevCol[idx * 2];
      const feedB = prevCol[idx * 2 + 1];

      let centerY = headerHeight + idx * (cardHeight + gapY) + cardHeight / 2;

      if (feedA && feedB) {
        const posA = posMap.get(feedA.key);
        const posB = posMap.get(feedB.key);
        if (posA && posB) {
          centerY = (posA.centerY + posB.centerY) / 2;
        }
      } else if (feedA) {
        const posA = posMap.get(feedA.key);
        if (posA) centerY = posA.centerY;
      }

      const y = centerY - cardHeight / 2;
      posMap.set(card.key, { x: colX, y, centerY });
    });
  }

  // 4. Dibujar líneas conectoras del cuadro en plata/zinc neutro (árbol eliminatorio)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let r = 1; r < totalRounds; r++) {
    const nextCol = columns[r] ?? [];
    const currentCol = columns[r - 1] ?? [];

    nextCol.forEach((targetCard, idx) => {
      const feedA = currentCol[idx * 2];
      const feedB = currentCol[idx * 2 + 1];
      const targetPos = posMap.get(targetCard.key);
      if (!targetPos) return;

      const midX = targetPos.x - gapX / 2;

      if (feedA && feedB) {
        const posA = posMap.get(feedA.key);
        const posB = posMap.get(feedB.key);
        if (posA && posB) {
          // Línea horizontal desde A
          ctx.beginPath();
          ctx.moveTo(posA.x + cardWidth, posA.centerY);
          ctx.lineTo(midX, posA.centerY);
          ctx.stroke();

          // Línea horizontal desde B
          ctx.beginPath();
          ctx.moveTo(posB.x + cardWidth, posB.centerY);
          ctx.lineTo(midX, posB.centerY);
          ctx.stroke();

          // Línea vertical que une A y B
          ctx.beginPath();
          ctx.moveTo(midX, posA.centerY);
          ctx.lineTo(midX, posB.centerY);
          ctx.stroke();

          // Línea horizontal hacia el partido destino
          ctx.beginPath();
          ctx.moveTo(midX, targetPos.centerY);
          ctx.lineTo(targetPos.x, targetPos.centerY);
          ctx.stroke();
        }
      } else if (feedA) {
        const posA = posMap.get(feedA.key);
        if (posA) {
          ctx.beginPath();
          ctx.moveTo(posA.x + cardWidth, posA.centerY);
          ctx.lineTo(targetPos.x, targetPos.centerY);
          ctx.stroke();
        }
      }
    });
  }

  // 5. Dibujar títulos de columnas (Rondas) y tarjetas
  columns.forEach((colCards, colIdx) => {
    const roundNumber = colIdx + 1;
    const colX = startX + colIdx * (cardWidth + gapX);
    const rName = roundName(roundNumber, totalRounds);

    // Título de la ronda
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = roundNumber === totalRounds ? "#fbbf24" : "#a1a1aa";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rName.toUpperCase(), colX + cardWidth / 2, headerHeight - 38);

    // Tarjetas de esta ronda
    colCards.forEach((card) => {
      const pos = posMap.get(card.key);
      if (!pos) return;
      drawMatchCard(ctx, pos.x, pos.y, cardWidth, cardHeight, card, roundNumber === totalRounds);
    });
  });

  // 6. Tarjeta de 3er puesto si existe
  if (third) {
    const lastColX = startX + (totalRounds - 1) * (cardWidth + gapX);
    const finalCard = columns[totalRounds - 1]?.[0];
    const finalPos = finalCard ? posMap.get(finalCard.key) : null;
    const thirdY = (finalPos ? finalPos.y + cardHeight + 40 : headerHeight + 200);

    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#a1a1aa";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🥉 3ER PUESTO", lastColX + cardWidth / 2, thirdY - 14);

    drawMatchCard(ctx, lastColX, thirdY, cardWidth, cardHeight, third, false);
  }

  // 7. Pie de página
  const footerY = height - 36;
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#52525b";
  ctx.textAlign = "left";
  ctx.fillText("⚡ Generado con LM Torneos", marginX, footerY);

  ctx.textAlign = "right";
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(dateStr, width - marginX, footerY);
}

function drawMatchCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  card: BracketCard,
  isFinal: boolean,
) {
  // Fondo de la tarjeta en carbón neutro
  drawRoundedRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = isFinal ? "#15161b" : "#111216";
  ctx.fill();
  ctx.strokeStyle = isFinal ? "rgba(245, 158, 11, 0.5)" : "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = isFinal ? 1.6 : 1.2;
  ctx.stroke();

  const halfH = (height - 1) / 2;

  // Línea divisoria entre home y away
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fillRect(x + 10, y + halfH, width - (isFinal ? 54 : 20), 1);

  // Equipo 1 (Home)
  drawTeamSlot(ctx, x, y, width, halfH, card.home, "Por definir", card.resultText, true, isFinal);

  // Equipo 2 (Away)
  drawTeamSlot(
    ctx,
    x,
    y + halfH + 1,
    width,
    halfH,
    card.away,
    card.isBye ? "Libre" : "Por definir",
    card.resultText,
    false,
    isFinal,
  );

  // Si es la final, dibujar medallón de la copa dorada brillante a la derecha
  if (isFinal) {
    const trophySize = 38;
    const trophyX = x + width - trophySize - 10;
    const trophyY = y + (height - trophySize) / 2;
    const centerX = trophyX + trophySize / 2;
    const centerY = trophyY + trophySize / 2;
    const radius = trophySize / 2;

    ctx.save();
    // Resplandor dorado sutil
    ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
    ctx.shadowBlur = 10;

    // Círculo dorado con degradado metálico
    const grad = ctx.createLinearGradient(trophyX, trophyY, trophyX + trophySize, trophyY + trophySize);
    grad.addColorStop(0, "#FDE68A");
    grad.addColorStop(0.5, "#F59E0B");
    grad.addColorStop(1, "#D97706");

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(254, 240, 138, 0.8)";
    ctx.stroke();
    ctx.restore();

    // Silueta de copa en negro
    ctx.save();
    ctx.fillStyle = "#09090b";
    const cupW = 18;
    const cupH = 18;
    const cupX = centerX - cupW / 2;
    const cupY = centerY - cupH / 2;

    // Copa / cáliz
    ctx.beginPath();
    ctx.moveTo(cupX + 3, cupY);
    ctx.lineTo(cupX + cupW - 3, cupY);
    ctx.lineTo(cupX + cupW - 4, cupY + 7);
    ctx.quadraticCurveTo(cupX + cupW / 2, cupY + 12, cupX + 4, cupY + 7);
    ctx.closePath();
    ctx.fill();

    // Asas
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#09090b";
    ctx.beginPath();
    ctx.arc(cupX + 2, cupY + 4, 3, Math.PI * 0.5, Math.PI * 1.5, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cupX + cupW - 2, cupY + 4, 3, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.stroke();

    // Tallo y base
    ctx.fillRect(centerX - 1.5, cupY + 10, 3, 4);
    ctx.beginPath();
    ctx.ellipse(centerX, cupY + 15, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTeamSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  team: BracketCard["home"],
  placeholder: string,
  resultText: string | null,
  isTop: boolean,
  isFinal?: boolean,
) {
  const isWinner = team?.winner ?? false;
  const isProvisional = team?.isProvisional ?? false;

  // Resaltado de ganador sutil
  if (isWinner) {
    drawRoundedRect(ctx, x + 2, y + 2, width - 4, height - 4, isTop ? [10, 10, 0, 0] : [0, 0, 10, 10]);
    ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
    ctx.fill();
  }

  let textX = x + 12;
  const textY = y + height / 2;

  // Seed badge neutro (1°A, 2°B, etc.)
  if (team?.seedBadge) {
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    const badgeText = team.seedBadge;
    const badgeW = ctx.measureText(badgeText).width + 10;
    drawRoundedRect(ctx, textX, textY - 9, badgeW, 18, 4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, textX + badgeW / 2, textY);

    textX += badgeW + 8;
  }

  // Nombre del equipo o placeholder
  const teamName = team?.name || placeholder;
  const isDefined = Boolean(team?.name);

  ctx.font = isWinner
    ? "bold 14px system-ui, -apple-system, sans-serif"
    : isDefined
      ? "600 13px system-ui, -apple-system, sans-serif"
      : "italic 13px system-ui, -apple-system, sans-serif";

  ctx.fillStyle = isWinner
    ? "#34d399"
    : isDefined
      ? isProvisional
        ? "#a1a1aa"
        : "#f1f5f9"
      : "#52525b";

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const maxNameWidth = width - (textX - x) - (isFinal ? 54 : 40);
  const safeName = truncateText(ctx, teamName, maxNameWidth);
  ctx.fillText(safeName, textX, textY);

  // Si es ganador, pequeño check verde (solo si no es final o no choca con el trofeo)
  if (isWinner && !isFinal) {
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "right";
    ctx.fillText("✓", x + width - 12, textY);
  }
}
