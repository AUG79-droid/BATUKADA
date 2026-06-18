import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { FileAudio, FileImage, FileDown, Music4, Play, Square } from 'lucide-react';
import type { AudioOptions, Exercise, Stroke, Syllable } from './types';

const EXAMPLE_DATA = `Ejercicio 1 — 4/4
> DUM TI | TI TI | > TA TI | TI TI

Ejercicio 2 — 4/4
> DUM DUM | TI TI | > TA TA | TI TI

Ejercicio 3 — 6/8
> DUM TI TI | > TA TI TI`;

type ParseError = { lineIndex: number; text: string; message: string };

function parseExercises(input: string): { exercises: Exercise[]; errors: ParseError[] } {
  const exercises: Exercise[] = [];
  const errors: ParseError[] = [];
  let header: { number: number; meter: Exercise['meter'] } | null = null;

  input.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const meterMatch = line.match(/\b(4\/4|3\/4|6\/8)\b/i);
    const hasSyllable = /\b(DUM|TA|TI)\b/i.test(line);
    const isHeader = !hasSyllable && (line.toLowerCase().includes('ejercicio') || /^\d+[\s.-]+/.test(line) || Boolean(meterMatch));

    if (isHeader) {
      header = {
        number: Number(line.match(/\d+/)?.[0] ?? exercises.length + 1),
        meter: (meterMatch?.[0] as Exercise['meter']) ?? '4/4'
      };
      return;
    }

    const meter = header?.meter ?? '4/4';
    const number = header?.number ?? exercises.length + 1;
    const bars: Stroke[][] = [];
    let hasError = false;

    line.replace(/:\|\|$|^\|\|:|\|\|$/g, '').split('|').forEach((segment) => {
      const strokes: Stroke[] = [];
      let pendingAccent = false;
      segment.trim().split(/\s+/).forEach((token) => {
        if (!token) return;
        let word = token.toUpperCase().trim();
        if (/^>+$/.test(word)) {
          pendingAccent = true;
          return;
        }
        let accent = pendingAccent;
        pendingAccent = false;
        if (word.startsWith('>')) {
          accent = true;
          word = word.replace(/^>+/, '');
        }
        if (word.endsWith('>')) {
          accent = true;
          word = word.replace(/>+$/, '');
        }
        word = word.replace(/[|.,:!]/g, '').trim();
        if (!word) return;
        if (word === 'DUM' || word === 'TA' || word === 'TI') strokes.push({ syllable: word as Syllable, accent });
        else {
          hasError = true;
          errors.push({ lineIndex: index + 1, text: raw, message: `Sílaba inválida "${token}". Usa DUM, TA, TI y > para acentos.` });
        }
      });
      if (pendingAccent) {
        hasError = true;
        errors.push({ lineIndex: index + 1, text: raw, message: 'Hay un acento > sin sílaba después.' });
      }
      if (strokes.length) bars.push(strokes);
    });

    if (!hasError && bars.length) {
      exercises.push({ id: `${number}-${Date.now()}-${Math.random().toString(36).slice(2)}`, number, meter, patternRaw: line, bars });
    }
    header = null;
  });

  return { exercises, errors };
}

function syllableToSpeech(syllable: Syllable): string {
  if (syllable === 'DUM') return 'dúm';
  if (syllable === 'TA') return 'ta';
  return 'ti';
}

function exerciseToSpokenPattern(exercise: Exercise): string {
  return exercise.bars.map((bar) => bar.map((stroke) => syllableToSpeech(stroke.syllable)).join(' ')).join(', ');
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 760;
const SVG_BG = '#d9ddda';
const BLACK = '#000000';
const ACTIVE = '#2563eb';

function svgText(x: number, y: number, value: string, size = 36, anchor: 'start' | 'middle' | 'end' = 'middle', weight = 400): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${BLACK}">${esc(value)}</text>`;
}

function noteHeadY(syllable: Stroke['syllable']): number {
  if (syllable === 'DUM') return 550;
  if (syllable === 'TA') return 515;
  return 535;
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
  const legendText = (label: string, y: number) => svgText(legendTextX, y, label, 30, 'end');
  const legendLabel = (label: string, y: number) => svgText(legendLabelX, y, label, 30, 'start', 500);

  return `
    <g aria-label="Leyenda de sonidos">
      ${legendText('Grave =', 62)}
      <line x1="${legendStemX}" y1="18" x2="${legendStemX}" y2="62" stroke="${BLACK}" stroke-width="4" />
      ${drawFilledHead(legendSymbolX, 62)}
      ${legendLabel('DUM', 62)}

      ${legendText('Agudo =', 118)}
      <line x1="${legendStemX}" y1="86" x2="${legendStemX}" y2="118" stroke="${BLACK}" stroke-width="4" />
      ${drawFilledHead(legendSymbolX, 118)}
      ${legendLabel('TA', 118)}

      ${legendText('Relleno =', 174)}
      <line x1="${legendStemX}" y1="142" x2="${legendStemX}" y2="174" stroke="${BLACK}" stroke-width="4" />
      ${drawXHead(legendSymbolX, 174)}
      ${legendLabel('TI', 174)}
    </g>`;
}

function strokeColor(active: boolean): string {
  return active ? ACTIVE : BLACK;
}

function drawStroke(stroke: Stroke, x: number, beamY: number, syllableY: number, active: boolean): string {
  const color = strokeColor(active);
  const y = noteHeadY(stroke.syllable);
  const stemX = x + 11;
  let out = '';

  if (active) {
    out += `<circle cx="${x}" cy="${y}" r="32" fill="${ACTIVE}" fill-opacity="0.18" />`;
  }

  out += `<line x1="${stemX}" y1="${beamY}" x2="${stemX}" y2="${y}" stroke="${color}" stroke-width="4" stroke-linecap="butt" />`;
  out += stroke.syllable === 'TI' ? drawXHead(x, y, color) : drawFilledHead(x, y, color);
  out += `<text x="${x}" y="${syllableY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="500" fill="${color}">${stroke.syllable}</text>`;
  return out;
}

function drawBeam(noteXs: number[], beamY: number): string {
  if (noteXs.length <= 1) return '';
  const x1 = noteXs[0] + 11;
  const x2 = noteXs[noteXs.length - 1] + 11;
  return `<rect x="${x1}" y="${beamY - 5}" width="${x2 - x1}" height="10" fill="${BLACK}" />`;
}

function groupLayout(exercise: Exercise): { starts: number[]; gap: number; separators: number[]; repeatX: number; title: string; explanation: string } {
  if (exercise.meter === '6/8') {
    return {
      starts: [330, 700],
      gap: 72,
      separators: [615],
      repeatX: 1130,
      title: '1 COMPÁS DE 6/8',
      explanation: 'Esto es 1 compás de 6/8: 6 pulsos de corchea agrupados 3 + 3.'
    };
  }
  if (exercise.meter === '3/4') {
    return {
      starts: [360, 610, 860],
      gap: 78,
      separators: [535, 785],
      repeatX: 1130,
      title: '1 COMPÁS DE 3/4',
      explanation: 'Esto es 1 compás de 3/4: 3 pulsos, cada pulso dividido en 2 partes.'
    };
  }
  return {
    starts: [305, 500, 695, 890],
    gap: 78,
    separators: [452, 647, 842],
    repeatX: 1130,
    title: '1 COMPÁS DE 4/4',
    explanation: 'Esto es 1 compás de 4/4: 4 pulsos, cada pulso dividido en 2 partes.'
  };
}

function drawGroup(exercise: Exercise, group: Stroke[], groupIndex: number, startX: number, activeStep?: { barIndex: number; strokeIndex: number } | null): string {
  const { gap } = groupLayout(exercise);
  const beamY = 435;
  const syllableY = 645;
  const countY = 695;
  const pulseLabelY = 325;
  const noteXs = group.map((_, index) => startX + index * gap);
  const groupCenter = (noteXs[0] + noteXs[noteXs.length - 1]) / 2;
  const countOffset = exercise.meter === '6/8' ? groupIndex * 3 : groupIndex * 2;

  let out = svgText(groupCenter, pulseLabelY, `PULSO ${groupIndex + 1}`, 22, 'middle', 700);
  if (group.some((stroke) => stroke.accent)) {
    out += `<text x="${groupCenter}" y="372" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="400" fill="${BLACK}">&gt;</text>`;
  }

  out += drawBeam(noteXs, beamY);
  group.forEach((stroke, strokeIndex) => {
    const active = Boolean(activeStep && activeStep.barIndex === groupIndex && activeStep.strokeIndex === strokeIndex);
    out += drawStroke(stroke, noteXs[strokeIndex], beamY, syllableY, active);
    const countLabel = exercise.meter === '6/8' ? String(countOffset + strokeIndex + 1) : strokeIndex === 0 ? String(groupIndex + 1) : 'y';
    out += svgText(noteXs[strokeIndex], countY, countLabel, 28, 'middle', 700);
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

function renderExerciseSVGString(exercise: Exercise, activeStep?: { barIndex: number; strokeIndex: number } | null): string {
  const top = exercise.meter === '6/8' ? '6' : exercise.meter === '3/4' ? '3' : '4';
  const bottom = exercise.meter === '6/8' ? '8' : '4';
  const layout = groupLayout(exercise);

  let svg = `
    <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${SVG_BG}" />
    ${drawLegend()}

    ${svgText(600, 250, layout.title, 42, 'middle', 800)}
    ${svgText(95, 505, top, 86, 'middle')}
    ${svgText(95, 585, bottom, 86, 'middle')}
    <line x1="175" y1="425" x2="175" y2="615" stroke="${BLACK}" stroke-width="8" stroke-linecap="butt" />
  `;

  exercise.bars.forEach((bar, index) => {
    svg += drawGroup(exercise, bar, index, layout.starts[index] ?? layout.starts[layout.starts.length - 1], activeStep);
  });

  layout.separators.forEach((x) => {
    svg += `<line x1="${x}" y1="310" x2="${x}" y2="715" stroke="#5f6662" stroke-width="2.5" stroke-dasharray="10 14" opacity="0.45" />`;
  });

  svg += drawRepeat(layout.repeatX);
  svg += `<rect x="210" y="724" width="780" height="28" rx="8" fill="#eef1ee" opacity="0.9" />`;
  svg += svgText(600, 739, layout.explanation, 22, 'middle', 500);
  svg += `<desc>${esc(exercise.patternRaw)}</desc>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="100%" height="100%" role="img">${svg}</svg>`;
}

async function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SVG_WIDTH * 2;
      canvas.height = SVG_HEIGHT * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(image, 0, 0, SVG_WIDTH * 2, SVG_HEIGHT * 2);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        blob ? resolve(blob) : reject(new Error('No PNG blob'));
      }, 'image/png', 1);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function synthStroke(ctx: BaseAudioContext, destination: AudioNode, stroke: Stroke, time: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const freq = stroke.syllable === 'DUM' ? 120 : stroke.syllable === 'TA' ? 240 : 1200;
  osc.type = stroke.syllable === 'TA' ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(stroke.accent ? 0.8 : 0.45, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (stroke.syllable === 'TI' ? 0.04 : 0.22));
  osc.connect(gain);
  gain.connect(destination);
  osc.start(time);
  osc.stop(time + 0.25);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const data = buffer.getChannelData(0);
  const out = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(out);
  let p = 0;
  const u16 = (v: number) => { view.setUint16(p, v, true); p += 2; };
  const u32 = (v: number) => { view.setUint32(p, v, true); p += 4; };
  u32(0x46464952); u32(36 + data.length * 2); u32(0x45564157); u32(0x20746d66); u32(16); u16(1); u16(1); u32(buffer.sampleRate); u32(buffer.sampleRate * 2); u16(2); u16(16); u32(0x61746164); u32(data.length * 2);
  for (const sample of data) { view.setInt16(p, Math.max(-1, Math.min(1, sample)) * 0x7fff, true); p += 2; }
  return new Blob([out], { type: 'audio/wav' });
}

async function generateAudioBlob(exercise: Exercise, options: AudioOptions): Promise<Blob> {
  const pulse = (60 / options.bpm) / 2;
  const totalStrokes = exercise.bars.flat().length;
  const ctx = new OfflineAudioContext(1, Math.ceil((0.5 + totalStrokes * pulse * options.repetitions + 1) * 44100), 44100);
  let t = 0.25;
  for (let rep = 0; rep < options.repetitions; rep++) for (const bar of exercise.bars) for (const stroke of bar) { synthStroke(ctx, ctx.destination, stroke, t); t += pulse; }
  return audioBufferToWav(await ctx.startRendering());
}

function speakExercise(exercise: Exercise, options: AudioOptions) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(exerciseToSpokenPattern(exercise));
  utterance.lang = 'es-ES';
  utterance.rate = Math.max(0.75, Math.min(1.65, options.bpm / 75));
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => v.lang.toLowerCase() === 'es-es') || voices.find((v) => v.lang.toLowerCase().startsWith('es'));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [input, setInput] = useState(EXAMPLE_DATA);
  const [options, setOptions] = useState<AudioOptions>({ bpm: 75, repetitions: 1, countIn: true, introduction: true });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [{ exercises, errors }, setParsed] = useState(() => parseExercises(EXAMPLE_DATA));

  useEffect(() => setParsed(parseExercises(input)), []);
  const total = useMemo(() => exercises.reduce((sum, ex) => sum + ex.bars.flat().length, 0), [exercises]);

  const generate = () => setParsed(parseExercises(input));
  const play = (exercise: Exercise) => { setActiveId(exercise.id); speakExercise(exercise, options); setTimeout(() => setActiveId(null), 2500); };
  const stop = () => { window.speechSynthesis?.cancel(); setActiveId(null); };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const ex of exercises) {
      zip.file(`ejercicio_${String(ex.number).padStart(2, '0')}.png`, await svgToPngBlob(renderExerciseSVGString(ex)));
      zip.file(`ejercicio_${String(ex.number).padStart(2, '0')}.wav`, await generateAudioBlob(ex, options));
    }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `ejercicios_percuvoice_bpm${options.bpm}.zip`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white"><Music4 size={20} /></div><div><h1 className="text-xl font-bold">PercuVoice Trainer</h1><p className="text-xs text-slate-500">Un ejercicio = una imagen + un audio</p></div></div>
          <button onClick={downloadZip} disabled={!exercises.length} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"><FileDown size={16} /> ZIP</button>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-12">
        <section className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Ejercicios escritos</h2><textarea value={input} onChange={(e) => setInput(e.target.value)} className="h-72 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm" /><div className="mt-3 flex gap-3"><button onClick={generate} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Generar imágenes y audios</button><button onClick={() => { setInput(EXAMPLE_DATA); setParsed(parseExercises(EXAMPLE_DATA)); }} className="rounded-xl border px-4 py-2 text-sm">Restaurar</button></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold">Ajustes</h2><label className="block text-sm">BPM: {options.bpm}</label><input type="range" min="40" max="180" value={options.bpm} onChange={(e) => setOptions({ ...options, bpm: Number(e.target.value) })} className="w-full accent-indigo-600" /><label className="mt-4 block text-sm">Repeticiones: {options.repetitions}</label><input type="range" min="1" max="12" value={options.repetitions} onChange={(e) => setOptions({ ...options, repetitions: Number(e.target.value) })} className="w-full accent-indigo-600" /></div>
          {errors.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{errors.map((e) => <p key={`${e.lineIndex}-${e.message}`}>Línea {e.lineIndex}: {e.message}</p>)}</div>}
        </section>
        <section className="lg:col-span-7 space-y-5"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Tarjetas de práctica ({exercises.length})</h2><p className="text-xs text-slate-500">{total} pulsos detectados</p></div>{exercises.map((exercise) => <article key={exercise.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Ejercicio {exercise.number}</h3><span className="rounded bg-slate-100 px-2 py-1 font-mono text-[10px]">{exercise.meter}</span></div><div dangerouslySetInnerHTML={{ __html: renderExerciseSVGString(exercise) }} /><div className="mt-3 rounded-xl bg-slate-50 p-3 font-mono text-xs">{exercise.bars.map((bar) => bar.map((s) => `${s.accent ? '> ' : ''}${s.syllable}`).join(' ')).join(' | ')}</div><div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs"><b>Texto hablado exacto:</b> [{exerciseToSpokenPattern(exercise)}]</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => activeId === exercise.id ? stop() : play(exercise)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white">{activeId === exercise.id ? <Square size={14} /> : <Play size={14} />} {activeId === exercise.id ? 'Detener' : 'Practicar Ritmo'}</button><button onClick={async () => downloadBlob(await svgToPngBlob(renderExerciseSVGString(exercise)), `ejercicio_${String(exercise.number).padStart(2, '0')}.png`)} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"><FileImage size={14} /> PNG</button><button onClick={async () => downloadBlob(await generateAudioBlob(exercise, options), `ejercicio_${String(exercise.number).padStart(2, '0')}.wav`)} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"><FileAudio size={14} /> Audio WAV</button></div></article>)}</section>
      </main>
    </div>
  );
}
