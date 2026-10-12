/**
 * Generador de imagen de cronograma de partidos y horarios en Canvas 2D de alta resolución (1200px),
 * con diseño oscuro neutro (negro/grafito) y tarjetas de partido ultra compactas
 * optimizadas para WhatsApp y redes, evitando que ocupen espacio excesivo con muchos partidos.
 */

import {
  DEFAULT_TIMEZONE,
  formatDayHeading,
  formatInTimeZone,
  groupByLocalDay,
} from "@/lib/dates";

export type MatchExportData = {
  id: string;
  homeName: string;
  awayName: string;
  startsAt: string | null;
  endsAt: string | null;
  courtName: string | null;
  section: string;
  categoryName?: string | null;
  stage?: "group" | "playoff";
  resultText?: string | null;
  winnerTeamId?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
};

export type GenerateMatchesImageOptions = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  timezone?: string;
  matches: MatchExportData[];
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
  ctx.quadraticCurveTo(x, y, x + height, y + height - bl);
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

/**
 * Renderiza el fixture / cronograma de partidos a un elemento HTMLCanvasElement.
 */
export function renderMatchesToCanvas(
  canvas: HTMLCanvasElement,
  options: GenerateMatchesImageOptions,
) {
  const { tournamentName, categoryName, sportName, matches } = options;
  const ctx = canvas.getContext("2d");
  if (!ctx || matches.length === 0) return;

  const tz = options.timezone || DEFAULT_TIMEZONE;

  // Agrupar partidos por día local
  const dayGroups = groupByLocalDay(matches, () => tz);

  // Dimensiones del canvas
  const width = 1200;
  const marginX = 48;
  const gapX = 20;
  const cardWidth = Math.floor((width - marginX * 2 - gapX) / 2); // ~542px
  const cardHeight = 48; // Ultra compacto (48px de alto por tarjeta)
  const gapY = 8;
  const headerHeight = 175;
  const footerHeight = 55;

  // Calcular altura total requerida
  let totalContentHeight = 0;
  for (const group of dayGroups) {
    const isSingleDay = dayGroups.length === 1 && group.day !== null;
    const dayHeaderHeight = isSingleDay ? 38 : 38;
    const matchCount = group.items.length;
    const rows = Math.ceil(matchCount / 2);
    const gridHeight = rows * cardHeight + Math.max(0, rows - 1) * gapY;
    totalContentHeight += dayHeaderHeight + 10 + gridHeight + 24;
  }

  const height = Math.max(580, headerHeight + totalContentHeight + footerHeight);

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
  const glowTop = ctx.createRadialGradient(width / 2, 80, 20, width / 2, 80, 480);
  glowTop.addColorStop(0, "rgba(255, 255, 255, 0.04)");
  glowTop.addColorStop(1, "transparent");
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, width, 480);

  const glowBottom = ctx.createRadialGradient(width / 2, height - 80, 20, width / 2, height - 80, 400);
  glowBottom.addColorStop(0, "rgba(255, 255, 255, 0.03)");
  glowBottom.addColorStop(1, "transparent");
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, height - 400, width, 400);

  // Barra superior platino decorativa
  const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
  topBarGrad.addColorStop(0, "transparent");
  topBarGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
  topBarGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, width, 2);

  // 2. Encabezado principal
  const badgeText = "⚡ CRONOGRAMA DE PARTIDOS · HORARIOS";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 30;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 32;

  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 26, 13);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, width / 2, badgeY + 13);

  // Nombre del Torneo
  ctx.font = "900 36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  const displayTitle = truncateText(ctx, tournamentName.toUpperCase(), width - 120);
  ctx.fillText(displayTitle, width / 2, 94);

  // Subtítulo (Deporte + Categoría + Cantidad de partidos)
  const subtitleParts = [
    sportName ? sportName.toUpperCase() : "TORNEO",
    categoryName ? categoryName.toUpperCase() : null,
    `${matches.length} ${matches.length === 1 ? "PARTIDO" : "PARTIDOS"}`,
  ].filter(Boolean);
  const subtitleText = subtitleParts.join(" · ");

  ctx.font = "700 15px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(subtitleText, width / 2, 134);

  // Divisor horizontal neutro
  const dividerY = 158;
  const dividerGrad = ctx.createLinearGradient(80, 0, width - 80, 0);
  dividerGrad.addColorStop(0, "transparent");
  dividerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.12)");
  dividerGrad.addColorStop(1, "transparent");
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(80, dividerY, width - 160, 1);

  // 3. Renderizar cada grupo de días y sus partidos
  let currentY = headerHeight;

  for (const group of dayGroups) {
    let dayTitle: string;
    let isUnscheduled = false;

    if (group.day) {
      const formatted = formatDayHeading(group.day);
      dayTitle = `📅 ${formatted.charAt(0).toUpperCase() + formatted.slice(1)}`;
    } else {
      dayTitle = "⏳ POR PROGRAMAR / SIN HORARIO";
      isUnscheduled = true;
    }

    const countLabel = `${group.items.length} ${group.items.length === 1 ? "partido" : "partidos"}`;
    const headerPillText = `${dayTitle} · ${countLabel}`;

    // Dibujar encabezado del día
    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    const pillW = ctx.measureText(headerPillText).width + 32;
    const pillX = (width - pillW) / 2;
    const pillY = currentY + 4;

    // Línea de fondo del subtítulo del día
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(marginX, pillY + 13, width - marginX * 2, 1);

    // Pastilla centrada del día
    drawRoundedRect(ctx, pillX, pillY, pillW, 26, 13);
    ctx.fillStyle = isUnscheduled ? "rgba(245, 158, 11, 0.12)" : "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.strokeStyle = isUnscheduled ? "rgba(245, 158, 11, 0.35)" : "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isUnscheduled ? "#fbbf24" : "#f1f5f9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(headerPillText, width / 2, pillY + 13);

    // Tarjetas de partidos en cuadrícula de 2 columnas
    const startCardsY = currentY + 44;

    for (let i = 0; i < group.items.length; i++) {
      const match = group.items[i];
      if (!match) continue;

      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardX = col === 0 ? marginX : marginX + cardWidth + gapX;
      const cardY = startCardsY + row * (cardHeight + gapY);

      // Fondo de la tarjeta (ultra compacta: 48px)
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Barra vertical indicadora izquierda
      drawRoundedRect(ctx, cardX + 3, cardY + 7, 3, cardHeight - 14, 1.5);
      if (match.resultText) {
        ctx.fillStyle = "#10b981"; // Finalizado con resultado
      } else if (match.startsAt) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)"; // Con horario programado
      } else {
        ctx.fillStyle = "#f59e0b"; // Sin horario
      }
      ctx.fill();

      // LINEA 1: Horario, Cancha y Fase/Categoría
      const line1Y = cardY + 16;

      // Izquierda de línea 1: Horario + Cancha
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      if (match.startsAt) {
        const timeStr = formatInTimeZone(match.startsAt, tz, "HH:mm");
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#f8fafc";
        const timeLabel = `🕐 ${timeStr} hs`;
        ctx.fillText(timeLabel, cardX + 14, line1Y);
        const timeW = ctx.measureText(timeLabel).width;

        if (match.courtName) {
          ctx.font = "600 11px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(` · ${match.courtName}`, cardX + 14 + timeW, line1Y);
        }
      } else {
        ctx.font = "600 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("⏳ Horario a definir", cardX + 14, line1Y);
      }

      // Derecha de línea 1: Fase/Zona y Marcador (si ya se jugó)
      ctx.textAlign = "right";
      let rightOffset = cardX + cardWidth - 14;

      if (match.resultText) {
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#38bdf8";
        const scoreLabel = `[ ${match.resultText} ]`;
        ctx.fillText(scoreLabel, rightOffset, line1Y);
        const scoreW = ctx.measureText(scoreLabel).width;
        rightOffset -= scoreW + 6;
      }

      const stageLabelParts = [match.section, match.categoryName].filter(Boolean);
      const stageLabel = stageLabelParts.join(" · ");
      if (stageLabel) {
        ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#71717a";
        const maxStageW = Math.max(80, rightOffset - (cardX + 220));
        const truncatedStage = truncateText(ctx, stageLabel, maxStageW);
        ctx.fillText(truncatedStage, rightOffset, line1Y);
      }

      // LINEA 2: Enfrentamiento (Equipo 1 vs Equipo 2)
      const line2Y = cardY + 34;

      const homeWon = Boolean(match.winnerTeamId && match.homeTeamId && match.winnerTeamId === match.homeTeamId);
      const awayWon = Boolean(match.winnerTeamId && match.awayTeamId && match.winnerTeamId === match.awayTeamId);
      const hasWinner = homeWon || awayWon;

      const availableMatchupW = cardWidth - 28; // ~514px
      const vsStr = " vs ";
      ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
      const vsW = ctx.measureText(vsStr).width;
      const maxPerTeamW = Math.floor((availableMatchupW - vsW) / 2);

      // Medir y recortar nombres si es necesario
      ctx.font = "bold 12.5px system-ui, -apple-system, sans-serif";
      const homeText = truncateText(ctx, match.homeName, maxPerTeamW);
      const homeW = ctx.measureText(homeText).width;
      const awayText = truncateText(ctx, match.awayName, maxPerTeamW);

      // Dibujar Equipo 1
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hasWinner ? (homeWon ? "#ffffff" : "#71717a") : "#f8fafc";
      ctx.font = homeWon ? "bold 12.5px system-ui, -apple-system, sans-serif" : "600 12.5px system-ui, -apple-system, sans-serif";
      ctx.fillText(homeText, cardX + 14, line2Y);

      // Dibujar 'vs'
      ctx.fillStyle = "#52525b";
      ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
      ctx.fillText(vsStr, cardX + 14 + homeW, line2Y);

      // Dibujar Equipo 2
      ctx.fillStyle = hasWinner ? (awayWon ? "#ffffff" : "#71717a") : "#f8fafc";
      ctx.font = awayWon ? "bold 12.5px system-ui, -apple-system, sans-serif" : "600 12.5px system-ui, -apple-system, sans-serif";
      ctx.fillText(awayText, cardX + 14 + homeW + vsW, line2Y);
    }

    // Avanzar posición Y para el siguiente bloque
    const rows = Math.ceil(group.items.length / 2);
    const gridHeight = rows * cardHeight + Math.max(0, rows - 1) * gapY;
    currentY += 44 + gridHeight + 24;
  }

  // 4. Pie de página decorativo
  const footerY = height - 26;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(marginX, height - 48, width - marginX * 2, 1);

  ctx.font = "600 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("APP TORNEOS · CRONOGRAMA Y FIXTURE OFICIAL", width / 2, footerY);
}
