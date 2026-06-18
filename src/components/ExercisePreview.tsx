/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Exercise, Stroke } from "../types";

interface ExercisePreviewProps {
  exercise: Exercise;
  activeStep?: { barIndex: number; strokeIndex: number } | null;
  className?: string;
  renderForDownload?: boolean;
}

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 600;
const BG = "#d7dad7";
const BLACK = "#000000";
const ACTIVE = "#2563eb";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function text(x: number, y: number, value: string, size = 36, anchor: "start" | "middle" | "end" = "middle", weight = 400): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${BLACK}">${esc(value)}</text>`;
}

function noteHeadY(syllable: Stroke["syllable"]): number {
  if (syllable === "DUM") return 445; // grave: lower note = longer stem
  if (syllable === "TA") return 390;  // agudo: higher note = shorter stem
  return 405;                          // relleno: x-note in the middle
}

function drawFilledHead(x: number, y: number, color = BLACK): string {
  return `<ellipse cx="${x}" cy="${y}" rx="14" ry="10" transform="rotate(-22 ${x} ${y})" fill="${color}" />`;
}

function drawXHead(x: number, y: number, color = BLACK): string {
  return `
    <g transform="translate(${x} ${y})">
      <line x1="-12" y1="-12" x2="12" y2="12" stroke="${color}" stroke-width="4.8" stroke-linecap="round" />
      <line x1="12" y1="-12" x2="-12" y2="12" stroke="${color}" stroke-width="4.8" stroke-linecap="round" />
    </g>`;
}

function drawLegendSymbol(kind: "DUM" | "TA" | "TI", x: number, y: number): string {
  const stemTop = kind === "DUM" ? y - 95 : y - 70;
  return `
    <g aria-label="${kind}">
      <line x1="${x + 11}" y1="${stemTop}" x2="${x + 11}" y2="${y + 5}" stroke="${BLACK}" stroke-width="3.8" />
      ${kind === "TI" ? drawXHead(x, y) : drawFilledHead(x, y)}
    </g>`;
}

function drawLegend(): string {
  // Three stacked rows, deliberately high and separate from the notation zone.
  const labelX = 510;
  const symbolX = 610;
  const soundX = 695;
  return `
    <g aria-label="Leyenda de sonidos">
      ${text(labelX, 105, "Grave", 37, "end")}
      ${drawLegendSymbol("DUM", symbolX, 105)}
      ${text(soundX, 105, "DUM", 34, "start")}

      ${text(labelX, 205, "Agudo", 37, "end")}
      ${drawLegendSymbol("TA", symbolX, 205)}
      ${text(soundX, 205, "TA", 34, "start")}

      ${text(labelX, 285, "Relleno", 37, "end")}
      ${drawLegendSymbol("TI", symbolX, 285)}
      ${text(soundX, 285, "TI", 34, "start")}
    </g>`;
}

function shouldAccentGroup(group: Stroke[]): boolean {
  return group.some((s) => s.accent);
}

function strokeColor(active: boolean): string {
  return active ? ACTIVE : BLACK;
}

function drawStroke(stroke: Stroke, x: number, beamY: number, syllableY: number, active: boolean): string {
  const color = strokeColor(active);
  const y = noteHeadY(stroke.syllable);
  const stemX = x + 11;
  let out = "";

  if (active) {
    out += `<circle cx="${x}" cy="${y}" r="32" fill="${ACTIVE}" fill-opacity="0.18" />`;
  }

  // Stem length is not uniform by design: DUM is lower (longer stem), TA is higher (shorter stem).
  out += `<line x1="${stemX}" y1="${beamY}" x2="${stemX}" y2="${y}" stroke="${color}" stroke-width="4" stroke-linecap="butt" />`;

  if (stroke.syllable === "TI") out += drawXHead(x, y, color);
  else out += drawFilledHead(x, y, color);

  out += `<text x="${x}" y="${syllableY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="500" fill="${color}">${stroke.syllable}</text>`;
  return out;
}

function drawBeam(noteXs: number[], beamY: number): string {
  if (noteXs.length <= 1) return "";
  const x1 = noteXs[0] + 11;
  const x2 = noteXs[noteXs.length - 1] + 11;
  return `<rect x="${x1}" y="${beamY - 5}" width="${x2 - x1}" height="10" fill="${BLACK}" />`;
}

function groupLayout(exercise: Exercise): { starts: number[]; gap: number; separators: number[]; repeatX: number } {
  if (exercise.meter === "6/8") return { starts: [330, 700], gap: 80, separators: [620], repeatX: 1120 };
  if (exercise.meter === "3/4") return { starts: [300, 530, 760], gap: 80, separators: [475, 705], repeatX: 1120 };
  return { starts: [300, 500, 700, 900], gap: 85, separators: [455, 655, 855], repeatX: 1120 };
}

function drawGroup(exercise: Exercise, group: Stroke[], groupIndex: number, startX: number, activeStep?: { barIndex: number; strokeIndex: number } | null): string {
  const { gap } = groupLayout(exercise);
  const beamY = 350;
  const syllableY = 535;
  const noteXs = group.map((_, i) => startX + i * gap);
  const groupCenter = (noteXs[0] + noteXs[noteXs.length - 1]) / 2;

  let out = "";
  if (shouldAccentGroup(group)) {
    out += `<text x="${groupCenter}" y="302" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="400" fill="${BLACK}">&gt;</text>`;
  }

  out += drawBeam(noteXs, beamY);
  group.forEach((stroke, strokeIndex) => {
    const active = Boolean(activeStep && activeStep.barIndex === groupIndex && activeStep.strokeIndex === strokeIndex);
    out += drawStroke(stroke, noteXs[strokeIndex], beamY, syllableY, active);
  });
  return out;
}

function drawRepeat(x: number): string {
  const dotsX = x - 30;
  const bar1X = x;
  const bar2X = x + 15;
  return `
    <g aria-label="Repetición final">
      <circle cx="${dotsX}" cy="390" r="7" fill="${BLACK}" />
      <circle cx="${dotsX}" cy="455" r="7" fill="${BLACK}" />
      <line x1="${bar1X}" y1="330" x2="${bar1X}" y2="490" stroke="${BLACK}" stroke-width="6" />
      <line x1="${bar2X}" y1="330" x2="${bar2X}" y2="490" stroke="${BLACK}" stroke-width="6" />
    </g>`;
}

export function renderExerciseSVGString(exercise: Exercise, activeStep?: { barIndex: number; strokeIndex: number } | null): string {
  const topNum = exercise.meter === "6/8" ? "6" : exercise.meter === "3/4" ? "3" : "4";
  const bottomNum = exercise.meter === "6/8" ? "8" : "4";
  const layout = groupLayout(exercise);

  let svg = `
    <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${BG}" />
    ${drawLegend()}

    <!-- notation zone: starts below the legend and never overlaps it -->
    ${text(92, 410, topNum, 78, "middle")}
    ${text(92, 492, bottomNum, 78, "middle")}
    <line x1="160" y1="358" x2="160" y2="510" stroke="${BLACK}" stroke-width="9" stroke-linecap="butt" />
  `;

  exercise.bars.forEach((bar, i) => {
    svg += drawGroup(exercise, bar, i, layout.starts[i] ?? layout.starts[layout.starts.length - 1], activeStep);
  });

  layout.separators.forEach((x) => {
    svg += `<line x1="${x}" y1="358" x2="${x}" y2="510" stroke="${BLACK}" stroke-width="3.5" />`;
  });

  svg += drawRepeat(layout.repeatX);
  svg += `<desc>${esc(exercise.patternRaw)}</desc>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="100%" height="100%" role="img" aria-label="Ejercicio ${exercise.number}">${svg}</svg>`;
}

// Convert SVG string to a high-quality PNG Blob in-browser using HTML Canvas
export function svgToPngBlob(svgString: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = window.URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = SVG_WIDTH * scale;
        canvas.height = SVG_HEIGHT * scale;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.drawImage(image, 0, 0, SVG_WIDTH, SVG_HEIGHT);
          canvas.toBlob(
            (blob) => {
              window.URL.revokeObjectURL(blobUrl);
              if (blob) resolve(blob);
              else reject(new Error("No se pudo generar el blob PNG del lienzo canvas"));
            },
            "image/png",
            1.0
          );
        } else {
          window.URL.revokeObjectURL(blobUrl);
          reject(new Error("No se pudo crear el contexto 2d del lienzo canvas"));
        }
      };

      image.onerror = (e) => {
        window.URL.revokeObjectURL(blobUrl);
        reject(new Error("Error al renderizar el SVG " + String(e)));
      };

      image.src = blobUrl;
    } catch (err) {
      reject(err);
    }
  });
}

export function ExercisePreview({ exercise, activeStep, className, renderForDownload }: ExercisePreviewProps) {
  const currentActiveStep = renderForDownload ? null : activeStep;
  const svgMarkup = renderExerciseSVGString(exercise, currentActiveStep);

  return (
    <div
      id={`svg-container-${exercise.id}`}
      className={`relative w-full overflow-hidden bg-transparent flex items-center justify-center ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
