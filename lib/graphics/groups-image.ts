/**
 * Generador de imagen de grupos en Canvas 2D de alta resolución (1200px o 1080x1920 Historia),
 * con soporte para fondos temáticos (canchas de pádel, foto propia) y formato Story (WhatsApp/Instagram).
 */

export type GroupExportData = {
  name: string;
  teams: string[];
};

export type BackgroundPreset =
  | "dark"
  | "padel-red"
  | "padel-blue"
  | "padel-green"
  | "custom";

export type ImageFormat = "story" | "standard";

export type GenerateGroupsImageOptions = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  groups: GroupExportData[];
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
  options: GenerateGroupsImageOptions,
) {
  const {
    tournamentName,
    categoryName,
    groups,
    backgroundImage,
    overlayOpacity = 0.42,
  } = options;

  const width = 1080;
  const height = 1920;

  // 1. Fondo (Imagen con viñeta o degradado oscuro)
  if (backgroundImage) {
    drawImageCover(ctx, backgroundImage, width, height);

    // Oscurecimiento general para asegurar contraste y legibilidad
    ctx.fillStyle = `rgba(5, 7, 10, ${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);

    // Viñetas superior e inferior
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
    // Fondo oscuro grafito profundo
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

  // 2. Encabezado estilo póster deportivo (como en el ejemplo de WhatsApp / Stories)
  const headerContentWidth = 940;
  const headerX = (width - headerContentWidth) / 2;

  // Bloque blanco superior con el nombre del torneo
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

  // Cinta / Banner rojo con la Categoría o Zonas
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
    ? `ZONAS · ${categoryName.toUpperCase()}`
    : "ZONAS · FASE DE GRUPOS";
  ctx.font = "900 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(truncateText(ctx, categoryText, headerContentWidth - 40), width / 2, bannerY + bannerHeight / 2);

  // 3. Tarjetas de grupos en formato Story (distribución en 2 columnas o 1 columna si hay pocos)
  const numGroups = Math.max(groups.length, 1);
  const maxTeams = Math.max(...groups.map((g) => g.teams.length), 2);

  let cols = 2;
  let cardWidth = 450;
  let gapX = 40;

  if (numGroups <= 2) {
    cols = 1;
    cardWidth = 680;
    gapX = 0;
  } else if (numGroups > 8) {
    cols = 3;
    cardWidth = 295;
    gapX = 24;
  }

  const rows = Math.ceil(numGroups / cols);
  const cardHeaderHeight = 52;
  const teamRowHeight = cols === 3 ? 42 : 46;
  const cardPaddingBottom = 12;
  const cardHeight = cardHeaderHeight + maxTeams * teamRowHeight + cardPaddingBottom;

  const availableHeight = 1540; // Desde Y=265 hasta Y=1805
  const gridStartY = 270;
  const totalContentHeight = rows * cardHeight;
  const gapY = rows > 1 ? Math.min(34, Math.max(16, (availableHeight - totalContentHeight) / (rows + 1))) : 24;
  const adjustedStartY = gridStartY + Math.max(0, (availableHeight - (rows * cardHeight + (rows - 1) * gapY)) / 4);

  groups.forEach((group, groupIdx) => {
    const row = Math.floor(groupIdx / cols);
    const colInRow = groupIdx % cols;

    const itemsInThisRow = Math.min(cols, numGroups - row * cols);
    const rowContentWidth = itemsInThisRow * cardWidth + (itemsInThisRow - 1) * gapX;
    const startX = (width - rowContentWidth) / 2;

    const cardX = startX + colInRow * (cardWidth + gapX);
    const cardY = adjustedStartY + row * (cardHeight + gapY);

    // Tarjeta estilo oscuro profundo con esquinas redondeadas
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 18);
    ctx.fillStyle = backgroundImage ? "rgba(10, 12, 16, 0.88)" : "#101216";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Cabecera de la zona (letra/nombre centrada como en el diseño de la foto)
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(group.name.toUpperCase(), cardX + cardWidth / 2, cardY + cardHeaderHeight / 2);

    // Línea divisoria blanca nítida bajo la letra de la zona
    const divPad = 16;
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(cardX + divPad, cardY + cardHeaderHeight, cardWidth - divPad * 2, 1.2);

    // Parejas
    const teamStartY = cardY + cardHeaderHeight + 8;
    group.teams.forEach((teamName, teamIdx) => {
      const rowCenterY = teamStartY + teamIdx * teamRowHeight + teamRowHeight / 2;

      // Texto de la pareja centrada en blanco de alta legibilidad
      ctx.font = cols === 3
        ? "600 14px system-ui, -apple-system, sans-serif"
        : "600 16px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxTextW = cardWidth - divPad * 2 - 8;
      ctx.fillText(truncateText(ctx, teamName, maxTextW), cardX + cardWidth / 2, rowCenterY);

      // Línea divisoria entre parejas
      if (teamIdx < group.teams.length - 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
        ctx.fillRect(
          cardX + divPad,
          teamStartY + (teamIdx + 1) * teamRowHeight,
          cardWidth - divPad * 2,
          1,
        );
      }
    });
  });

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
  ctx.fillText(`⚡ Generado con App Torneos · ${dateStr}`, width / 2, footerY);
}

/**
 * Renderiza el formato Estándar (apaisado/adaptativo de 1200px)
 */
function renderStandardFormat(
  ctx: CanvasRenderingContext2D,
  options: GenerateGroupsImageOptions,
) {
  const {
    tournamentName,
    categoryName,
    sportName,
    groups,
    backgroundImage,
    overlayOpacity = 0.48,
  } = options;

  const width = 1200;
  const numGroups = Math.max(groups.length, 1);

  let cols = 2;
  let cardWidth = 530;
  let gapX = 40;
  const gapY = 28;

  if (numGroups === 1) {
    cols = 1;
    cardWidth = 720;
    gapX = 0;
  } else if (numGroups === 3 || numGroups >= 5) {
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

  // Redimensionar canvas si difiere
  if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
    ctx.canvas.width = width;
    ctx.canvas.height = height;
  }

  // Fondo
  if (backgroundImage) {
    drawImageCover(ctx, backgroundImage, width, height);

    ctx.fillStyle = `rgba(5, 7, 10, ${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);

    const topGrad = ctx.createLinearGradient(0, 0, 0, 260);
    topGrad.addColorStop(0, "rgba(0, 0, 0, 0.7)");
    topGrad.addColorStop(1, "transparent");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, 260);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#050608");
    bgGrad.addColorStop(0.5, "#0b0c10");
    bgGrad.addColorStop(1, "#050608");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const glowTop = ctx.createRadialGradient(width / 2, 80, 20, width / 2, 80, 500);
    glowTop.addColorStop(0, "rgba(255, 255, 255, 0.04)");
    glowTop.addColorStop(1, "transparent");
    ctx.fillStyle = glowTop;
    ctx.fillRect(0, 0, width, 500);
  }

  // Línea sutil superior
  const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
  topBarGrad.addColorStop(0, "transparent");
  topBarGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
  topBarGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, width, 2);

  // Badge "FASE DE GRUPOS"
  const badgeText = "🏆 FASE DE GRUPOS · ZONAS";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 30;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 38;

  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 28, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, width / 2, badgeY + 14);

  // Título del Torneo
  ctx.font = "900 42px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  const displayTitle = truncateText(ctx, tournamentName.toUpperCase(), width - 120);
  ctx.fillText(displayTitle, width / 2, 108);

  // Subtítulo
  const subtitleParts = [
    sportName ? sportName.toUpperCase() : "TORNEO",
    categoryName ? categoryName.toUpperCase() : null,
  ].filter(Boolean);
  const subtitleText = subtitleParts.join(" · ");

  ctx.font = "700 17px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(subtitleText, width / 2, 150);

  // Divisoria suave
  const dividerGrad = ctx.createLinearGradient(150, 0, width - 150, 0);
  dividerGrad.addColorStop(0, "transparent");
  dividerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.12)");
  dividerGrad.addColorStop(1, "transparent");
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(150, 182, width - 300, 1);

  // Tarjetas
  groups.forEach((group, groupIdx) => {
    const row = Math.floor(groupIdx / cols);
    const colInRow = groupIdx % cols;

    const itemsInThisRow = Math.min(cols, numGroups - row * cols);
    const rowContentWidth = itemsInThisRow * cardWidth + (itemsInThisRow - 1) * gapX;
    const startX = (width - rowContentWidth) / 2;

    const cardX = startX + colInRow * (cardWidth + gapX);
    const cardY = headerHeight + row * (cardHeight + gapY);

    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16);
    ctx.fillStyle = backgroundImage ? "rgba(12, 14, 18, 0.90)" : "#111216";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Cabecera tarjeta
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeaderHeight, [16, 16, 0, 0]);
    const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
    headerGrad.addColorStop(0, "#1c1d24");
    headerGrad.addColorStop(1, "#15161c");
    ctx.fillStyle = headerGrad;
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(cardX, cardY + cardHeaderHeight - 1, cardWidth, 1);

    // Indicador lateral
    drawRoundedRect(ctx, cardX + 16, cardY + (cardHeaderHeight - 18) / 2, 4, 18, 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fill();

    // Nombre del grupo
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(group.name.toUpperCase(), cardX + 28, cardY + cardHeaderHeight / 2);

    // Badge cantidad
    const teamCountText = `${group.teams.length} ${group.teams.length === 1 ? "pareja" : "parejas"}`;
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    const teamCountWidth = ctx.measureText(teamCountText).width + 16;
    const badgeCountX = cardX + cardWidth - teamCountWidth - 14;
    const badgeCountY = cardY + (cardHeaderHeight - 24) / 2;

    drawRoundedRect(ctx, badgeCountX, badgeCountY, teamCountWidth, 24, 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText(teamCountText, badgeCountX + teamCountWidth / 2, badgeCountY + 12);

    // Filas equipos
    const teamStartY = cardY + cardHeaderHeight + 10;
    const rowPadX = 14;
    const teamRowWidth = cardWidth - rowPadX * 2;

    group.teams.forEach((teamName, teamIdx) => {
      const rowY = teamStartY + teamIdx * teamRowHeight;

      drawRoundedRect(ctx, cardX + rowPadX, rowY, teamRowWidth, 36, 8);
      ctx.fillStyle = teamIdx % 2 === 0 ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.02)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const numX = cardX + rowPadX + 18;
      const numY = rowY + 18;
      drawRoundedRect(ctx, numX - 11, numY - 11, 22, 22, 6);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();

      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(teamIdx + 1), numX, numY);

      ctx.font = "600 15px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const maxTeamNameWidth = teamRowWidth - 48;
      const safeTeamName = truncateText(ctx, teamName, maxTeamNameWidth);
      ctx.fillText(safeTeamName, cardX + rowPadX + 36, rowY + 18);
    });
  });

  // Footer
  const footerY = height - 42;
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
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

/**
 * Renderiza el gráfico de zonas/grupos en un elemento HTMLCanvasElement.
 */
export function renderGroupsToCanvas(
  canvas: HTMLCanvasElement,
  options: GenerateGroupsImageOptions,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const format = options.format ?? "story";

  if (format === "story") {
    canvas.width = 1080;
    canvas.height = 1920;
    renderStoryFormat(ctx, options);
  } else {
    canvas.width = 1200;
    renderStandardFormat(ctx, options);
  }
}
