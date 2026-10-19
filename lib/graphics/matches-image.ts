/**
 * Generador de imagen de cronograma de partidos y horarios en Canvas 2D de alta resolución (1200px o 1080x1920 Historia),
 * con soporte para fondos temáticos (canchas de pádel, foto propia) y formato Story (WhatsApp/Instagram).
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

export type BackgroundPreset =
  | "dark"
  | "padel-red"
  | "padel-blue"
  | "padel-green"
  | "custom";

export type ImageFormat = "story" | "standard";

export type GenerateMatchesImageOptions = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  timezone?: string;
  matches: MatchExportData[];
  format?: ImageFormat;
  backgroundPreset?: BackgroundPreset;
  backgroundImage?: CanvasImageSource | null;
  overlayOpacity?: number;
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

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
) {
  const imgW = (img as { naturalWidth?: number; videoWidth?: number; width?: number }).naturalWidth ||
    (img as { width?: number }).width || w;
  const imgH = (img as { naturalHeight?: number; videoHeight?: number; height?: number }).naturalHeight ||
    (img as { height?: number }).height || h;

  if (!imgW || !imgH) return;

  const hRatio = w / imgW;
  const vRatio = h / imgH;
  const ratio = Math.max(hRatio, vRatio);
  const centerShiftX = (w - imgW * ratio) / 2;
  const centerShiftY = (h - imgH * ratio) / 2;

  ctx.drawImage(img, 0, 0, imgW, imgH, centerShiftX, centerShiftY, imgW * ratio, imgH * ratio);
}

/**
 * Renderiza el formato Historia 9:16 (1080 x 1920) optimizado para WhatsApp / Instagram
 */
function renderStoryFormat(
  ctx: CanvasRenderingContext2D,
  options: GenerateMatchesImageOptions,
) {
  const {
    tournamentName,
    categoryName,
    sportName,
    matches,
    backgroundImage,
    overlayOpacity = 0.44,
  } = options;

  const width = 1080;
  const height = 1920;
  const tz = options.timezone || DEFAULT_TIMEZONE;

  // 1. Fondo (Imagen con viñeta o degradado oscuro)
  if (backgroundImage) {
    drawImageCover(ctx, backgroundImage, width, height);

    ctx.fillStyle = `rgba(5, 7, 10, ${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);

    const topVignette = ctx.createLinearGradient(0, 0, 0, 360);
    topVignette.addColorStop(0, "rgba(0, 0, 0, 0.72)");
    topVignette.addColorStop(1, "transparent");
    ctx.fillStyle = topVignette;
    ctx.fillRect(0, 0, width, 360);

    const bottomVignette = ctx.createLinearGradient(0, height - 200, 0, height);
    bottomVignette.addColorStop(0, "transparent");
    bottomVignette.addColorStop(1, "rgba(0, 0, 0, 0.75)");
    ctx.fillStyle = bottomVignette;
    ctx.fillRect(0, height - 200, width, 200);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#050608");
    bgGrad.addColorStop(0.5, "#0b0c10");
    bgGrad.addColorStop(1, "#050608");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const glowTop = ctx.createRadialGradient(width / 2, 120, 20, width / 2, 120, 600);
    glowTop.addColorStop(0, "rgba(255, 255, 255, 0.05)");
    glowTop.addColorStop(1, "transparent");
    ctx.fillStyle = glowTop;
    ctx.fillRect(0, 0, width, 600);
  }

  // 2. Encabezado estilo póster deportivo
  const headerContentWidth = 940;
  const headerX = (width - headerContentWidth) / 2;

  const titleBoxY = 85;
  const titleBoxHeight = 84;
  drawRoundedRect(ctx, headerX, titleBoxY, headerContentWidth, titleBoxHeight, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "900 38px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#09090b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const displayTitle = truncateText(ctx, tournamentName.toUpperCase(), headerContentWidth - 40);
  ctx.fillText(displayTitle, width / 2, titleBoxY + titleBoxHeight / 2);

  // Cinta roja de categoría / horarios
  const bannerY = titleBoxY + titleBoxHeight + 14;
  const bannerHeight = 56;
  drawRoundedRect(ctx, headerX, bannerY, headerContentWidth, bannerHeight, 12);
  const bannerGrad = ctx.createLinearGradient(headerX, 0, headerX + headerContentWidth, 0);
  bannerGrad.addColorStop(0, "#dc2626");
  bannerGrad.addColorStop(0.5, "#ef4444");
  bannerGrad.addColorStop(1, "#dc2626");
  ctx.fillStyle = bannerGrad;
  ctx.fill();

  const categoryText = categoryName
    ? `HORARIOS Y PARTIDOS · ${categoryName.toUpperCase()}`
    : "HORARIOS Y CRONOGRAMA DE PARTIDOS";
  ctx.font = "900 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(truncateText(ctx, categoryText, headerContentWidth - 40), width / 2, bannerY + bannerHeight / 2);

  // 3. Partidos
  const dayGroups = groupByLocalDay(matches, () => tz);
  const numMatches = matches.length;

  // Usar 1 columna si hay pocos partidos (<= 6) o 2 columnas si hay más
  const useSingleCol = numMatches <= 6;
  const cols = useSingleCol ? 1 : 2;
  const cardWidth = useSingleCol ? 940 : 455;
  const gapX = useSingleCol ? 0 : 30;
  const gapY = 10;
  const cardHeight = useSingleCol ? 58 : 54;

  let currentY = 275;

  for (const group of dayGroups) {
    if (currentY > 1750) break; // Límite inferior seguro

    let dayTitle: string;
    let isUnscheduled = false;

    if (group.day) {
      const formatted = formatDayHeading(group.day);
      dayTitle = `📅 ${formatted.charAt(0).toUpperCase() + formatted.slice(1)}`;
    } else {
      dayTitle = "⏳ HORARIOS A DEFINIR";
      isUnscheduled = true;
    }

    const countLabel = `${group.items.length} ${group.items.length === 1 ? "partido" : "partidos"}`;
    const headerPillText = `${dayTitle} · ${countLabel}`;

    // Encabezado del día
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    const pillW = ctx.measureText(headerPillText).width + 36;
    const pillX = (width - pillW) / 2;
    const pillY = currentY;

    // Divisor sutil detrás de la pastilla
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(headerX, pillY + 14, headerContentWidth, 1);

    drawRoundedRect(ctx, pillX, pillY, pillW, 28, 14);
    ctx.fillStyle = isUnscheduled ? "rgba(245, 158, 11, 0.2)" : "rgba(20, 22, 28, 0.95)";
    ctx.fill();
    ctx.strokeStyle = isUnscheduled ? "rgba(245, 158, 11, 0.45)" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = isUnscheduled ? "#fbbf24" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(headerPillText, width / 2, pillY + 14);

    const startCardsY = pillY + 38;

    for (let i = 0; i < group.items.length; i++) {
      const match = group.items[i];
      if (!match) continue;

      const col = i % cols;
      const row = Math.floor(i / cols);
      const cardX = headerX + col * (cardWidth + gapX);
      const cardY = startCardsY + row * (cardHeight + gapY);

      if (cardY + cardHeight > 1830) continue; // Evitar solapamiento con footer

      // Fondo de la tarjeta
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 10);
      ctx.fillStyle = backgroundImage ? "rgba(10, 12, 16, 0.88)" : "#101216";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Indicador lateral
      drawRoundedRect(ctx, cardX + 3, cardY + 7, 3.5, cardHeight - 14, 1.5);
      if (match.resultText) {
        ctx.fillStyle = "#10b981";
      } else if (match.startsAt) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      } else {
        ctx.fillStyle = "#f59e0b";
      }
      ctx.fill();

      // LINEA 1: Horario / Cancha y Zona / Resultado
      const line1Y = cardY + 17;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      if (match.startsAt) {
        const timeStr = formatInTimeZone(match.startsAt, tz, "HH:mm");
        ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#f8fafc";
        const timeLabel = `🕐 ${timeStr} hs`;
        ctx.fillText(timeLabel, cardX + 14, line1Y);
        const timeW = ctx.measureText(timeLabel).width;

        if (match.courtName) {
          ctx.font = "600 12px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(` · ${match.courtName}`, cardX + 14 + timeW, line1Y);
        }
      } else {
        ctx.font = "600 12px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("⏳ Horario a definir", cardX + 14, line1Y);
      }

      ctx.textAlign = "right";
      let rightOffset = cardX + cardWidth - 14;

      if (match.resultText) {
        ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#38bdf8";
        const scoreLabel = `[ ${match.resultText} ]`;
        ctx.fillText(scoreLabel, rightOffset, line1Y);
        const scoreW = ctx.measureText(scoreLabel).width;
        rightOffset -= scoreW + 6;
      }

      const stageLabelParts = [match.section, match.categoryName].filter(Boolean);
      const stageLabel = stageLabelParts.join(" · ");
      if (stageLabel) {
        ctx.font = "600 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#94a3b8";
        const maxStageW = Math.max(70, rightOffset - (cardX + 190));
        const truncatedStage = truncateText(ctx, stageLabel, maxStageW);
        ctx.fillText(truncatedStage, rightOffset, line1Y);
      }

      // LINEA 2: Parejas (Equipo 1 vs Equipo 2)
      const line2Y = cardY + 38;
      const homeWon = Boolean(match.winnerTeamId && match.homeTeamId && match.winnerTeamId === match.homeTeamId);
      const awayWon = Boolean(match.winnerTeamId && match.awayTeamId && match.winnerTeamId === match.awayTeamId);
      const hasWinner = homeWon || awayWon;

      const availableMatchupW = cardWidth - 28;
      const vsStr = " vs ";
      ctx.font = "600 11px system-ui, -apple-system, sans-serif";
      const vsW = ctx.measureText(vsStr).width;
      const maxPerTeamW = Math.floor((availableMatchupW - vsW) / 2);

      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      const homeText = truncateText(ctx, match.homeName, maxPerTeamW);
      const homeW = ctx.measureText(homeText).width;
      const awayText = truncateText(ctx, match.awayName, maxPerTeamW);

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hasWinner ? (homeWon ? "#ffffff" : "#71717a") : "#f8fafc";
      ctx.font = homeWon ? "bold 13px system-ui, -apple-system, sans-serif" : "600 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(homeText, cardX + 14, line2Y);

      ctx.fillStyle = "#71717a";
      ctx.font = "600 11px system-ui, -apple-system, sans-serif";
      ctx.fillText(vsStr, cardX + 14 + homeW, line2Y);

      ctx.fillStyle = hasWinner ? (awayWon ? "#ffffff" : "#71717a") : "#f8fafc";
      ctx.font = awayWon ? "bold 13px system-ui, -apple-system, sans-serif" : "600 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(awayText, cardX + 14 + homeW + vsW, line2Y);
    }

    const rows = Math.ceil(group.items.length / cols);
    const gridHeight = rows * cardHeight + Math.max(0, rows - 1) * gapY;
    currentY += 38 + gridHeight + 20;
  }

  // 4. Pie de página
  const footerY = height - 45;
  ctx.font = "600 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(`⚡ App Torneos · ${dateStr}`, width / 2, footerY);
}

/**
 * Renderiza el formato Estándar (apaisado/adaptativo de 1200px)
 */
function renderStandardFormat(
  ctx: CanvasRenderingContext2D,
  options: GenerateMatchesImageOptions,
) {
  const {
    tournamentName,
    categoryName,
    sportName,
    matches,
    backgroundImage,
    overlayOpacity = 0.48,
  } = options;

  const width = 1200;
  const tz = options.timezone || DEFAULT_TIMEZONE;
  const dayGroups = groupByLocalDay(matches, () => tz);

  const marginX = 48;
  const gapX = 20;
  const cardWidth = Math.floor((width - marginX * 2 - gapX) / 2); // ~542px
  const cardHeight = 48;
  const gapY = 8;
  const headerHeight = 175;
  const footerHeight = 55;

  let totalContentHeight = 0;
  for (const group of dayGroups) {
    const isSingleDay = dayGroups.length === 1 && group.day !== null;
    const dayHeaderHeight = isSingleDay ? 38 : 38;
    const matchCount = group.items.length;
    const rows = Math.ceil(matchCount / 2);
    const gridHeight = rows * cardHeight + Math.max(0, rows - 1) * gapY;
    totalContentHeight += dayHeaderHeight + 10 + gridHeight + 24;
  }

  const height = ctx.canvas.height || Math.max(580, headerHeight + totalContentHeight + footerHeight);

  // 1. Fondo
  if (backgroundImage) {
    drawImageCover(ctx, backgroundImage, width, height);

    ctx.fillStyle = `rgba(5, 7, 10, ${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);

    const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
    topGrad.addColorStop(0, "rgba(0, 0, 0, 0.72)");
    topGrad.addColorStop(1, "transparent");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, 240);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#050608");
    bgGrad.addColorStop(0.5, "#0b0c10");
    bgGrad.addColorStop(1, "#050608");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const glowTop = ctx.createRadialGradient(width / 2, 80, 20, width / 2, 80, 480);
    glowTop.addColorStop(0, "rgba(255, 255, 255, 0.04)");
    glowTop.addColorStop(1, "transparent");
    ctx.fillStyle = glowTop;
    ctx.fillRect(0, 0, width, 480);
  }

  // Barra superior decorativa
  const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
  topBarGrad.addColorStop(0, "transparent");
  topBarGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
  topBarGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, width, 2);

  // Badge superior
  const badgeText = "⚡ CRONOGRAMA DE PARTIDOS · HORARIOS";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 30;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 32;

  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 26, 13);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
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

  // Subtítulo
  const subtitleParts = [
    sportName ? sportName.toUpperCase() : "TORNEO",
    categoryName ? categoryName.toUpperCase() : null,
    `${matches.length} ${matches.length === 1 ? "PARTIDO" : "PARTIDOS"}`,
  ].filter(Boolean);
  const subtitleText = subtitleParts.join(" · ");

  ctx.font = "700 15px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(subtitleText, width / 2, 134);

  // Divisor horizontal
  const dividerY = 158;
  const dividerGrad = ctx.createLinearGradient(80, 0, width - 80, 0);
  dividerGrad.addColorStop(0, "transparent");
  dividerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.12)");
  dividerGrad.addColorStop(1, "transparent");
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(80, dividerY, width - 160, 1);

  // 3. Renderizar partidos por día
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

    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    const pillW = ctx.measureText(headerPillText).width + 32;
    const pillX = (width - pillW) / 2;
    const pillY = currentY + 4;

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(marginX, pillY + 13, width - marginX * 2, 1);

    drawRoundedRect(ctx, pillX, pillY, pillW, 26, 13);
    ctx.fillStyle = isUnscheduled ? "rgba(245, 158, 11, 0.16)" : "rgba(20, 22, 28, 0.9)";
    ctx.fill();
    ctx.strokeStyle = isUnscheduled ? "rgba(245, 158, 11, 0.35)" : "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isUnscheduled ? "#fbbf24" : "#f1f5f9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(headerPillText, width / 2, pillY + 13);

    const startCardsY = currentY + 44;

    for (let i = 0; i < group.items.length; i++) {
      const match = group.items[i];
      if (!match) continue;

      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardX = col === 0 ? marginX : marginX + cardWidth + gapX;
      const cardY = startCardsY + row * (cardHeight + gapY);

      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fillStyle = backgroundImage ? "rgba(12, 14, 18, 0.90)" : "rgba(255, 255, 255, 0.035)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      drawRoundedRect(ctx, cardX + 3, cardY + 7, 3, cardHeight - 14, 1.5);
      if (match.resultText) {
        ctx.fillStyle = "#10b981";
      } else if (match.startsAt) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      } else {
        ctx.fillStyle = "#f59e0b";
      }
      ctx.fill();

      // LINEA 1
      const line1Y = cardY + 16;
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
        ctx.fillStyle = "#94a3b8";
        const maxStageW = Math.max(80, rightOffset - (cardX + 220));
        const truncatedStage = truncateText(ctx, stageLabel, maxStageW);
        ctx.fillText(truncatedStage, rightOffset, line1Y);
      }

      // LINEA 2
      const line2Y = cardY + 34;
      const homeWon = Boolean(match.winnerTeamId && match.homeTeamId && match.winnerTeamId === match.homeTeamId);
      const awayWon = Boolean(match.winnerTeamId && match.awayTeamId && match.winnerTeamId === match.awayTeamId);
      const hasWinner = homeWon || awayWon;

      const availableMatchupW = cardWidth - 28;
      const vsStr = " vs ";
      ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
      const vsW = ctx.measureText(vsStr).width;
      const maxPerTeamW = Math.floor((availableMatchupW - vsW) / 2);

      ctx.font = "bold 12.5px system-ui, -apple-system, sans-serif";
      const homeText = truncateText(ctx, match.homeName, maxPerTeamW);
      const homeW = ctx.measureText(homeText).width;
      const awayText = truncateText(ctx, match.awayName, maxPerTeamW);

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hasWinner ? (homeWon ? "#ffffff" : "#71717a") : "#f8fafc";
      ctx.font = homeWon ? "bold 12.5px system-ui, -apple-system, sans-serif" : "600 12.5px system-ui, -apple-system, sans-serif";
      ctx.fillText(homeText, cardX + 14, line2Y);

      ctx.fillStyle = "#71717a";
      ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
      ctx.fillText(vsStr, cardX + 14 + homeW, line2Y);

      ctx.fillStyle = hasWinner ? (awayWon ? "#ffffff" : "#71717a") : "#f8fafc";
      ctx.font = awayWon ? "bold 12.5px system-ui, -apple-system, sans-serif" : "600 12.5px system-ui, -apple-system, sans-serif";
      ctx.fillText(awayText, cardX + 14 + homeW + vsW, line2Y);
    }

    const rows = Math.ceil(group.items.length / 2);
    const gridHeight = rows * cardHeight + Math.max(0, rows - 1) * gapY;
    currentY += 44 + gridHeight + 24;
  }

  // 4. Pie de página
  const footerY = height - 26;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(marginX, height - 48, width - marginX * 2, 1);

  ctx.font = "600 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("APP TORNEOS · CRONOGRAMA Y FIXTURE OFICIAL", width / 2, footerY);
}

/**
 * Renderiza el fixture / cronograma de partidos a un elemento HTMLCanvasElement.
 */
export function renderMatchesToCanvas(
  canvas: HTMLCanvasElement,
  options: GenerateMatchesImageOptions,
) {
  if (options.matches.length === 0) return;

  const format = options.format ?? "story";

  if (format === "story") {
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderStoryFormat(ctx, options);
  } else {
    const tz = options.timezone || DEFAULT_TIMEZONE;
    const dayGroups = groupByLocalDay(options.matches, () => tz);
    let totalContentHeight = 0;
    for (const group of dayGroups) {
      const rows = Math.ceil(group.items.length / 2);
      const gridHeight = rows * 48 + Math.max(0, rows - 1) * 8;
      totalContentHeight += 38 + 10 + gridHeight + 24;
    }
    const height = Math.max(580, 175 + totalContentHeight + 55);
    canvas.width = 1200;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderStandardFormat(ctx, options);
  }
}
