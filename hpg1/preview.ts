import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import type { Point, Segment } from "./types";

// Matches the machine bed size used in commands.ts / index.ts (plotter units, 40 units = 1mm)
const BOUNDS: [number, number] = [10300, 7650];

export function commandsToSegments(hpgl: string): Segment[] {
    const commands = hpgl.split(";").map((c) => c.trim()).filter(Boolean);
    let pos: Point = { x: 0, y: 0 };
    let penDown = false;
    let currentPen = 0;
    const segments: Segment[] = [];

    for (const command of commands) {
        const initial = command.slice(0, 2);
        const rest = command.slice(2).trim();

        if (initial === "PU") {
            penDown = false;
            continue;
        }
        if (initial === "PD") {
            penDown = true;
            continue;
        }
        if (initial === "SP") {
            currentPen = Number(rest) || 0;
            continue;
        }
        if (initial !== "PA" && initial !== "PR") {
            // IN, SC, or any other/unrecognized command - nothing to draw
            continue;
        }

        const relative = initial === "PR";
        const coords = rest.split(",").map(Number);

        // PA/PR can carry multiple coordinate pairs plotted as a connected polyline
        for (let i = 0; i + 1 < coords.length; i += 2) {
            const dx = coords[i];
            const dy = coords[i + 1];
            const prev = { ...pos };
            pos = relative ? { x: pos.x + dx, y: pos.y + dy } : { x: dx, y: dy };
            if (penDown) {
                segments.push({ x1: prev.x, y1: prev.y, x2: pos.x, y2: pos.y, pen: currentPen });
            }
        }
    }
    return segments;
}

export interface SvgOptions {
    bounds?: [number, number]; // plotter units
    unitsPerMM?: number;
    background?: string;
    strokeWidthMM?: number;
    penColors?: Record<number, string>;
    showBounds?: boolean;
}

const DEFAULT_PEN_COLORS: Record<number, string> = {
    0: "#111111",
    1: "#111111",
    2: "#e63946",
    3: "#2a9d8f",
    4: "#264653",
    5: "#f4a261",
    6: "#8338ec",
};

export function hpglToSvg(hpgl: string, options: SvgOptions = {}): string {
    const {
        bounds = BOUNDS,
        unitsPerMM = 40,
        background = "#ffffff",
        strokeWidthMM = 0.3,
        penColors = DEFAULT_PEN_COLORS,
        showBounds = true,
    } = options;

    const segments = commandsToSegments(hpgl);
    const [width, height] = bounds;
    const widthMM = width / unitsPerMM;
    const heightMM = height / unitsPerMM;

    // HPGL origin is bottom-left with Y increasing upward; SVG's is top-left with Y
    // increasing downward, so flip Y to keep the preview oriented like the physical plot.
    const toX = (x: number) => (x / unitsPerMM).toFixed(3);
    const toY = (y: number) => ((height - y) / unitsPerMM).toFixed(3);

    const lines = segments.map(
        (seg) =>
            `<line x1="${toX(seg.x1)}" y1="${toY(seg.y1)}" x2="${toX(seg.x2)}" y2="${toY(seg.y2)}" ` +
            `stroke="${penColors[seg.pen] ?? "#111111"}" stroke-width="${strokeWidthMM}" stroke-linecap="round" />`
    );

    const boundsRect = showBounds
        ? `<rect x="0" y="0" width="${widthMM}" height="${heightMM}" fill="none" stroke="#cccccc" stroke-width="${strokeWidthMM}" stroke-dasharray="2,2" />`
        : "";

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMM}mm" height="${heightMM}mm" viewBox="0 0 ${widthMM} ${heightMM}">`,
        `<rect x="0" y="0" width="${widthMM}" height="${heightMM}" fill="${background}" />`,
        boundsRect,
        ...lines,
        `</svg>`,
    ].join("\n");
}

export function writeSvgPreview(svg: string, filePath: string = path.join(os.tmpdir(), "plot-preview.svg")): string {
    fs.writeFileSync(filePath, svg);
    return filePath;
}

// Wraps the SVG in a bare HTML shell and writes that instead. `.html` files are reliably
// mapped to the user's actual default browser in Launch Services, unlike `.svg` (which is
// often claimed by Preview.app or another image viewer) - so opening this file is the
// robust way to land in "whatever browser the user has set as default."
export function writeHtmlPreview(svg: string, filePath: string = path.join(os.tmpdir(), "plot-preview.html")): string {
    const html = `<!doctype html><meta charset="utf-8"><title>Plot Preview</title><body style="margin:0;background:#f2f2f2;display:flex;justify-content:center;padding:24px;box-sizing:border-box;">${svg}</body>`;
    fs.writeFileSync(filePath, html);
    return filePath;
}

// macOS only - shells out to `open` with no app specified, so Launch Services routes the
// file to its default handler (the default browser, for .html files).
export function openPreview(filePath: string): void {
    execFile("open", [filePath], (err) => {
        if (err) console.error(`Could not open ${filePath}:`, err.message);
    });
}
