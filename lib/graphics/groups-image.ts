/**
 * Generador de imagen de grupos en Canvas 2D de alta resolución (1200px),
 * con diseño oscuro neutro (negro/grafito) optimizado para WhatsApp y redes.
 */

export type GroupExportData = {
  name: string;
  teams: string[];
};

export type GenerateGroupsImageOptions = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  groups: GroupExportData[];
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

/**
 * Renderiza el gráfico de zonas/grupos en un elemento HTMLCanvasElement.
 */
export function renderGroupsToCanvas(
  canvas: HTMLCanvasElement,
  options: GenerateGroupsImageOptions,
) {
  const { tournamentName, categoryName, sportName, groups } = options;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = 1200;
  const numGroups = Math.max(groups.length, 1);

  // Columnas según cantidad de grupos
  let cols = 2;
  let cardWidth = 530;
  let gapX = 40;
  const gapY = 28;

  if (numGroups === 1) {
    cols = 1;
    cardWidth = 720;
    gapX = 0;
  } else if (numGroups === 3) {
    cols = 3;
    cardWidth = 354;
    gapX = 24;
  } else if (numGroups >= 5) {
    cols = 3;
    cardWidth = 354;
    gapX = 24;
  }

  const rows = Math.ceil(numGroups / cols);
  const maxTeams = Math.max(...groups.map((g) => g.teams.length), 2);

  const cardHeaderHeight = 54;
  const teamRowHeight = 44;
  const cardPaddingBottom = 16;
  const cardHeight = cardHeaderHeight + maxTeams * teamRowHeight + cardPaddingBottom;

  const headerHeight = 220;
  const footerHeight = 80;
  const totalHeight = headerHeight + rows * cardHeight + (rows - 1) * gapY + footerHeight;
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

  // Iluminación ambiental neutra suave (blanco difuso)
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

  // Línea sutil superior platino/blanca
  const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
  topBarGrad.addColorStop(0, "transparent");
  topBarGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
  topBarGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, width, 2);

  // 2. Encabezado principal
  // Badge "FASE DE GRUPOS"
  const badgeText = "🏆 FASE DE GRUPOS · ZONAS";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 30;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 38;

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

  // Nombre del Torneo en blanco puro de alto contraste
  ctx.font = "900 42px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  const displayTitle = truncateText(ctx, tournamentName.toUpperCase(), width - 120);
  ctx.fillText(displayTitle, width / 2, 108);

  // Subtítulo neutro (Deporte + Categoría)
  const subtitleParts = [
    sportName ? sportName.toUpperCase() : "TORNEO",
    categoryName ? categoryName.toUpperCase() : null,
  ].filter(Boolean);
  const subtitleText = subtitleParts.join(" · ");

  ctx.font = "700 17px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(subtitleText, width / 2, 150);

  // Línea divisoria neutra suave
  const dividerGrad = ctx.createLinearGradient(150, 0, width - 150, 0);
  dividerGrad.addColorStop(0, "transparent");
  dividerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
  dividerGrad.addColorStop(1, "transparent");
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(150, 182, width - 300, 1);

  // 3. Renderizar cada tarjeta de grupo en acabado carbón neutro
  groups.forEach((group, groupIdx) => {
    const row = Math.floor(groupIdx / cols);
    const colInRow = groupIdx % cols;

    const itemsInThisRow = Math.min(cols, numGroups - row * cols);
    const rowContentWidth = itemsInThisRow * cardWidth + (itemsInThisRow - 1) * gapX;
    const startX = (width - rowContentWidth) / 2;

    const cardX = startX + colInRow * (cardWidth + gapX);
    const cardY = headerHeight + row * (cardHeight + gapY);

    // Fondo y borde neutro de la tarjeta
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16);
    ctx.fillStyle = "#111216";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Barra de título del grupo (cabecera con degradado carbón)
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeaderHeight, [16, 16, 0, 0]);
    const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
    headerGrad.addColorStop(0, "#1c1d24");
    headerGrad.addColorStop(1, "#15161c");
    ctx.fillStyle = headerGrad;
    ctx.fill();

    // Línea divisoria bajo el header del grupo
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(cardX, cardY + cardHeaderHeight - 1, cardWidth, 1);

    // Pequeño acento indicador lateral sutil
    drawRoundedRect(ctx, cardX + 16, cardY + (cardHeaderHeight - 18) / 2, 4, 18, 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fill();

    // Texto del nombre del grupo
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(group.name.toUpperCase(), cardX + 28, cardY + cardHeaderHeight / 2);

    // Badge cantidad de parejas en la cabecera
    const teamCountText = `${group.teams.length} ${group.teams.length === 1 ? "pareja" : "parejas"}`;
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    const teamCountWidth = ctx.measureText(teamCountText).width + 16;
    const badgeCountX = cardX + cardWidth - teamCountWidth - 14;
    const badgeCountY = cardY + (cardHeaderHeight - 24) / 2;

    drawRoundedRect(ctx, badgeCountX, badgeCountY, teamCountWidth, 24, 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText(teamCountText, badgeCountX + teamCountWidth / 2, badgeCountY + 12);

    // Filas de los equipos
    const teamStartY = cardY + cardHeaderHeight + 10;
    const rowPadX = 14;
    const teamRowWidth = cardWidth - rowPadX * 2;

    group.teams.forEach((teamName, teamIdx) => {
      const rowY = teamStartY + teamIdx * teamRowHeight;

      // Fondo sutil de fila de equipo
      drawRoundedRect(ctx, cardX + rowPadX, rowY, teamRowWidth, 36, 8);
      ctx.fillStyle = teamIdx % 2 === 0 ? "rgba(255, 255, 255, 0.035)" : "rgba(255, 255, 255, 0.015)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Círculo o pill con el número de posición
      const numX = cardX + rowPadX + 18;
      const numY = rowY + 18;
      drawRoundedRect(ctx, numX - 11, numY - 11, 22, 22, 6);
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fill();

      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(teamIdx + 1), numX, numY);

      // Nombre del equipo
      ctx.font = "600 15px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const maxTeamNameWidth = teamRowWidth - 48;
      const safeTeamName = truncateText(ctx, teamName, maxTeamNameWidth);
      ctx.fillText(safeTeamName, cardX + rowPadX + 36, rowY + 18);
    });
  });

  // 4. Pie de página
  const footerY = height - 42;
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#52525b";
  ctx.textAlign = "left";
  ctx.fillText("⚡ Generado con App Torneos", 60, footerY);

  ctx.textAlign = "right";
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(dateStr, width - 60, footerY);
}
