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
const SVG_HEIGHT = 760;
const BG = "#d9ddda";
const BLACK = "#000000";
const ACTIVE = "#2563eb";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function text(x: number, y: number, value: string, size = 36, anchor: "start" | "middle" | "end" = "middle", weight = 400): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${BLACK}">${esc(value)}</text>`;
}

function noteHeadY(syllable: Stroke["syllable"]): number {
  if (syllable === "DUM") return 550; // grave: lower note = longer stem
  if (syllable === "TA") return 515;  // agudo: higher note = shorter stem
  return 535;                          // relleno: x-note in the middle
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

function drawLegend(): string {
  const legendTextX = 330;
  const legendSymbolX = 520;
  const legendStemX = 540;
  const legendLabelX = 615;
  const legendText = (label: string, y: number) => text(legendTextX, y, label, 30, "end");
  const legendLabel = (label: string, y: number) => text(legendLabelX, y, label, 30, "start", 500);

  return `
    <g aria-label="Leyenda de sonidos">
      ${legendText("Grave =", 62)}
      <line x1="${legendStemX}" y1="18" x2="${legendStemX}" y2="62" stroke="${BLACK}" stroke-width="4" />
      ${drawFilledHead(legendSymbolX, 62)}
      ${legendLabel("DUM", 62)}

      ${legendText("Agudo =", 118)}
      <line x1="${legendStemX}" y1="86" x2="${legendStemX}" y2="118" stroke="${BLACK}" stroke-width="4" />
      ${drawFilledHead(legendSymbolX, 118)}
      ${legendLabel("TA", 118)}

      ${legendText("Relleno =", 174)}
      <line x1="${legendStemX}" y1="142" x2="${legendStemX}" y2="174" stroke="${BLACK}" stroke-width="4" />
      ${drawXHead(legendSymbolX, 174)}
      ${legendLabel("TI", 174)}
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

function groupLayout(exercise: Exercise): { starts: number[]; gap: number; separators: number[]; repeatX: number; title: string; explanation: string } {
  if (exercise.meter === "6/8") {
    return {
      starts: [330, 700],
      gap: 72,
      separators: [615],
      repeatX: 1130,
      title: "1 COMPÁS DE 6/8",
      explanation: "Esto es 1 compás de 6/8: 6 pulsos de corchea agrupados 3 + 3."
    };
  }
  if (exercise.meter === "3/4") {
    return {
      starts: [360, 610, 860],
      gap: 78,
      separators: [535, 785],
      repeatX: 1130,
      title: "1 COMPÁS DE 3/4",
      explanation: "Esto es 1 compás de 3/4: 3 pulsos, cada pulso dividido en 2 partes."
    };
  }
  return {
    starts: [305, 500, 695, 890],
    gap: 78,
    separators: [452, 647, 842],
    repeatX: 1130,
    title: "1 COMPÁS DE 4/4",
    explanation: "Esto es 1 compás de 4/4: 4 pulsos, cada pulso dividido en 2 partes."
  };
}

function drawGroup(exercise: Exercise, group: Stroke[], groupIndex: number, startX: number, activeStep?: { barIndex: number; strokeIndex: number } | null): string {
  const { gap } = groupLayout(exercise);
  const beamY = 435;
  const syllableY = 645;
  const countY = 695;
  const pulseLabelY = 325;
  const noteXs = group.map((_, i) => startX + i * gap);
  const groupCenter = (noteXs[0] + noteXs[noteXs.length - 1]) / 2;
  const countOffset = exercise.meter === "6/8" ? groupIndex * 3 : groupIndex * 2;

  let out = text(groupCenter, pulseLabelY, `PULSO ${groupIndex + 1}`, 22, "middle", 700);
  if (shouldAccentGroup(group)) {
    out += `<text x="${groupCenter}" y="372" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="400" fill="${BLACK}">&gt;</text>`;
  }

  out += drawBeam(noteXs, beamY);
  group.forEach((stroke, strokeIndex) => {
    const active = Boolean(activeStep && activeStep.barIndex === groupIndex && activeStep.strokeIndex === strokeIndex);
    out += drawStroke(stroke, noteXs[strokeIndex], beamY, syllableY, active);
    const countLabel = exercise.meter === "6/8" ? String(countOffset + strokeIndex + 1) : strokeIndex === 0 ? String(groupIndex + 1) : "y";
    out += text(noteXs[strokeIndex], countY, countLabel, 28, "middle", 700);
  });
  return out;
}

function drawRepeat(x: number): string {
  const dotsX = x - 30;
  const bar1X = x;
  const bar2X = x + 15;
  return `
    <g aria-label="Repetición final">
      <circle cx="${dotsX}" cy="500" r="7" fill="${BLACK}" />
      <circle cx="${dotsX}" cy="570" r="7" fill="${BLACK}" />
      <line x1="${bar1X}" y1="425" x2="${bar1X}" y2="615" stroke="${BLACK}" stroke-width="6" />
      <line x1="${bar2X}" y1="425" x2="${bar2X}" y2="615" stroke="${BLACK}" stroke-width="6" />
    </g>`;
}

export function renderExerciseSVGString(exercise: Exercise, activeStep?: { barIndex: number; strokeIndex: number } | null): string {
  const topNum = exercise.meter === "6/8" ? "6" : exercise.meter === "3/4" ? "3" : "4";
  const bottomNum = exercise.meter === "6/8" ? "8" : "4";
  const layout = groupLayout(exercise);

  let svg = `
    <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${BG}" />
    ${drawLegend()}

    <!-- One complete measure. Input separators divide pulses, not measures. -->
    ${text(600, 250, layout.title, 42, "middle", 800)}
    ${text(95, 505, topNum, 86, "middle")}
    ${text(95, 585, bottomNum, 86, "middle")}
    <line x1="175" y1="425" x2="175" y2="615" stroke="${BLACK}" stroke-width="8" stroke-linecap="butt" />
  `;

  exercise.bars.forEach((bar, i) => {
    svg += drawGroup(exercise, bar, i, layout.starts[i] ?? layout.starts[layout.starts.length - 1], activeStep);
  });

  layout.separators.forEach((x) => {
    svg += `<line x1="${x}" y1="310" x2="${x}" y2="715" stroke="#5f6662" stroke-width="2.5" stroke-dasharray="10 14" opacity="0.45" />`;
  });

  svg += drawRepeat(layout.repeatX);
  svg += `<rect x="210" y="724" width="780" height="28" rx="8" fill="#eef1ee" opacity="0.9" />`;
  svg += text(600, 739, layout.explanation, 22, "middle", 500);
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
