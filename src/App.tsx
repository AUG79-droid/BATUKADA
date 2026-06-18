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

function stemLength(stroke: Stroke): number {
  if (stroke.syllable === 'DUM') return 120;
  if (stroke.syllable === 'TA') return 80;
  return 95;
}

function renderNoteAt(stroke: Stroke, x: number, y: number, syllableY: number | null, active = false): string {
  const color = active ? '#2563eb' : '#000000';
  const stemX = stroke.syllable === 'TI' ? x + 10 : x + 11;
  const activeGlow = active ? `<circle cx="${x}" cy="${y}" r="34" fill="#2563eb" fill-opacity="0.18" />` : '';
  const stem = `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${y - stemLength(stroke)}" stroke="${color}" stroke-width="${stroke.syllable === 'DUM' ? 5 : 4}" stroke-linecap="butt" />`;
  const head = stroke.syllable === 'TI'
    ? `<g transform="translate(${x} ${y})"><line x1="-13" y1="-13" x2="13" y2="13" stroke="${color}" stroke-width="5" stroke-linecap="round" /><line x1="13" y1="-13" x2="-13" y2="13" stroke="${color}" stroke-width="5" stroke-linecap="round" /></g>`
    : `<ellipse cx="${x}" cy="${y}" rx="${stroke.syllable === 'DUM' ? 18 : 15}" ry="${stroke.syllable === 'DUM' ? 12 : 10}" transform="rotate(-20 ${x} ${y})" fill="${color}" />`;
  const label = syllableY === null ? '' : `<text x="${x}" y="${syllableY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500" fill="${color}">${stroke.syllable}</text>`;
  return `${activeGlow}${stem}${head}${label}`;
}

function renderLegendNote(syllable: Syllable, x: number, y: number): string {
  const stemX = x + 11;
  const stemTopY = syllable === 'DUM' ? 40 : syllable === 'TA' ? 110 : 150;
  const stemWidth = syllable === 'DUM' ? 5 : 4;
  const head = syllable === 'TI'
    ? `<g transform="translate(${x} ${y})"><line x1="-13" y1="-13" x2="13" y2="13" stroke="#000000" stroke-width="5" stroke-linecap="round" /><line x1="13" y1="-13" x2="-13" y2="13" stroke="#000000" stroke-width="5" stroke-linecap="round" /></g>`
    : `<ellipse cx="${x}" cy="${y}" rx="${syllable === 'DUM' ? 18 : 15}" ry="${syllable === 'DUM' ? 12 : 10}" transform="rotate(-20 ${x} ${y})" fill="#000000" />`;

  return `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemTopY}" stroke="#000000" stroke-width="${stemWidth}" stroke-linecap="butt" />${head}`;
}

function renderLegendRow(label: string, syllable: Syllable, rowY: number): string {
  const legendTextX = 470;
  const legendSymbolX = 620;
  const legendLabelX = 710;
  return `
    <g>
      <text x="${legendTextX}" y="${rowY + 9}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="400" fill="#000000">${label}</text>
      ${renderLegendNote(syllable, legendSymbolX, rowY)}
      <text x="${legendLabelX}" y="${rowY + 9}" text-anchor="start" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500" fill="#000000">${syllable}</text>
    </g>
  `;
}

function layoutForExercise(exercise: Exercise): { starts: number[]; noteGap: number; accentOffset: number; barlines: number[] } {
  if (exercise.meter === '6/8') {
    return { starts: [330, 700], noteGap: 80, accentOffset: 80, barlines: [620] };
  }
  if (exercise.meter === '4/4' && exercise.bars.length === 4) {
    return { starts: [300, 500, 700, 900], noteGap: 85, accentOffset: 42, barlines: [455, 655, 855] };
  }
  const starts = exercise.bars.map((_, index) => 300 + index * 200);
  return { starts, noteGap: 85, accentOffset: 42, barlines: starts.slice(1).map((start) => start - 45) };
}

function renderExerciseSVGString(exercise: Exercise, activeStep?: { barIndex: number; strokeIndex: number } | null): string {
  const width = 1200;
  const height = 650;
  const noteheadY = 420;
  const syllableY = 540;
  const beamY = 330;
  const accentY = 295;
  const barlineY1 = 335;
  const barlineY2 = 490;
  const repeatX = 1100;
  const { starts, noteGap, accentOffset, barlines } = layoutForExercise(exercise);
  const top = exercise.meter === '6/8' ? '6' : exercise.meter === '3/4' ? '3' : '4';
  const bottom = exercise.meter === '6/8' ? '8' : '4';

  let svg = `
    <rect width="${width}" height="${height}" fill="#d9dcda" />

    ${renderLegendRow('Grave', 'DUM', 80)}
    ${renderLegendRow('Agudo', 'TA', 140)}
    ${renderLegendRow('Relleno', 'TI', 200)}

    <text x="95" y="375" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="400" fill="#000000">${top}</text>
    <text x="95" y="455" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="400" fill="#000000">${bottom}</text>
    <line x1="175" y1="${barlineY1}" x2="175" y2="${barlineY2}" stroke="#000000" stroke-width="9" stroke-linecap="butt" />
  `;

  exercise.bars.forEach((bar, barIndex) => {
    const start = starts[barIndex] ?? 300 + barIndex * 200;
    const xs = bar.map((_, noteIndex) => start + noteIndex * noteGap);

    if (bar.some((stroke) => stroke.accent)) {
      svg += `<text x="${start + accentOffset}" y="${accentY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="600" fill="#000000">&gt;</text>`;
    }

    if (xs.length > 1) {
      svg += `<line x1="${xs[0] + 11}" y1="${beamY}" x2="${xs[xs.length - 1] + 11}" y2="${beamY}" stroke="#000000" stroke-width="10" stroke-linecap="square" />`;
    }

    bar.forEach((stroke, strokeIndex) => {
      svg += renderNoteAt(stroke, xs[strokeIndex], noteheadY, syllableY, activeStep?.barIndex === barIndex && activeStep?.strokeIndex === strokeIndex);
    });

    if (barIndex < exercise.bars.length - 1 && barlines[barIndex] !== undefined) {
      const x = barlines[barIndex];
      svg += `<line x1="${x}" y1="${barlineY1}" x2="${x}" y2="${barlineY2}" stroke="#000000" stroke-width="3.5" />`;
    }
  });

  svg += `
    <g transform="translate(${repeatX} 412)">
      <circle cx="-40" cy="-28" r="7.5" fill="#000000" />
      <circle cx="-40" cy="28" r="7.5" fill="#000000" />
      <line x1="-18" y1="-77" x2="-18" y2="78" stroke="#000000" stroke-width="4" />
      <line x1="2" y1="-77" x2="2" y2="78" stroke="#000000" stroke-width="12" />
    </g>
    <desc>${esc(exercise.patternRaw)}</desc>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img">${svg}</svg>`;
}

async function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1300;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(image, 0, 0, 2400, 1300);
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
