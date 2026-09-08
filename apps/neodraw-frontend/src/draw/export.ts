import type { PersistedShape } from "@repo/shared-types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function shapesToSvg(shapes: PersistedShape[]): string {
  const bounds = computeBounds(shapes);
  const pad = 20;
  const vbX = bounds ? bounds.x - pad : 0;
  const vbY = bounds ? bounds.y - pad : 0;
  const vbW = bounds ? bounds.w + pad * 2 : 640;
  const vbH = bounds ? bounds.h + pad * 2 : 480;

  const elements = shapes.map((shape) => {
    const color = shape.color ?? "#ffffff";
    switch (shape.type) {
      case "rect":
        return `<rect x="${round(shape.x)}" y="${round(shape.y)}" width="${round(shape.width)}" height="${round(shape.height)}" fill="none" stroke="${color}" stroke-width="2"/>`;
      case "circle":
        return `<circle cx="${round(shape.centerX)}" cy="${round(shape.centerY)}" r="${round(shape.radius)}" fill="none" stroke="${color}" stroke-width="2"/>`;
      case "diamond": {
        const points: Array<[number, number]> = [
          [shape.centerX, shape.centerY - shape.height / 2],
          [shape.centerX + shape.width / 2, shape.centerY],
          [shape.centerX, shape.centerY + shape.height / 2],
          [shape.centerX - shape.width / 2, shape.centerY],
        ];
        return `<polygon points="${points.map(([px, py]) => `${round(px)},${round(py)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>`;
      }
      case "pencil":
        return `<line x1="${round(shape.startX)}" y1="${round(shape.startY)}" x2="${round(shape.endX)}" y2="${round(shape.endY)}" stroke="${color}" stroke-width="2"/>`;
      case "text":
        return `<text x="${round(shape.x)}" y="${round(shape.y)}" font-size="${shape.fontSize}" fill="${color}" font-family="system-ui, sans-serif">${escapeXml(shape.text)}</text>`;
    }
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">` +
    `<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#1a1a2e"/>` +
    elements.join("") +
    `</svg>`
  );
}

function computeBounds(shapes: PersistedShape[]): { x: number; y: number; w: number; h: number } | null {
  if (shapes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    const bounds = shapeBounds(shape);
    if (!bounds) continue;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    maxY = Math.max(maxY, bounds.y + bounds.h);
  }

  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function shapeBounds(shape: PersistedShape): { x: number; y: number; w: number; h: number } | null {
  switch (shape.type) {
    case "rect": {
      const x = Math.min(shape.x, shape.x + shape.width);
      const y = Math.min(shape.y, shape.y + shape.height);
      return { x, y, w: Math.abs(shape.width), h: Math.abs(shape.height) };
    }
    case "circle":
      return { x: shape.centerX - shape.radius, y: shape.centerY - shape.radius, w: shape.radius * 2, h: shape.radius * 2 };
    case "diamond":
      return { x: shape.centerX - shape.width / 2, y: shape.centerY - shape.height / 2, w: shape.width, h: shape.height };
    case "pencil":
      return { x: Math.min(shape.startX, shape.endX), y: Math.min(shape.startY, shape.endY), w: Math.abs(shape.endX - shape.startX), h: Math.abs(shape.endY - shape.startY) };
    case "text":
      return { x: shape.x, y: shape.y - shape.fontSize, w: shape.text.length * shape.fontSize * 0.6, h: shape.fontSize };
    default:
      return null;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(shapes: PersistedShape[], roomId: string): void {
  download(`${roomId}.svg`, shapesToSvg(shapes), "image/svg+xml");
}

export function exportPng(canvas: HTMLCanvasElement, roomId: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${roomId}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}