
import type { InitOptions, Point } from "./types";
// Base comamnds
// IN (initialize),
// SP (select pen),
// PU/PD (pen up/down),
// PA/PR (absolute/relative plot) ?,
// SC (scaling points) ?,

export default class HGPL {
    private commands: string[] = [];
    private currentPosition: { x: number; y: number } = { x: 0, y: 0 };
    private unitsPerMM: number;
    private currentPen: number;
    
    // #1 plotter unit == 0.025 mm 1 / .025 = 40;
    constructor(options: InitOptions = {}) {
        this.unitsPerMM = options.unitsPerMM ?? 40;
        this.currentPen = options.defaultPen ?? 4;
        this.init(options);
  }
  private init(options: InitOptions) {
    this.commands.push('IN');
    this.commands.push(`SP${options.defaultPen ?? 4}`)
  }
  private toPlotterUnits(x: number, y: number): [number, number] {
    return [Math.round(x * this.unitsPerMM), Math.round(y * this.unitsPerMM)];
  }

  // Information
  getPos() {
    return this.currentPosition;
  }

  // Commands

  penUP() {
    this.commands.push('PU')
  }
  penDOWN() {
    this.commands.push('PD')
  }
  selectPen(p: number) { 
    this.commands.push(`SP${p}`)
  }
  set(x: number, y: number) {
    const [px, py] = this.toPlotterUnits(x, y);
    this.currentPosition = { x, y };
    this.commands.push(`PA ${px},${py}`);
  }
  move(x: number, y: number) {
    const [px, py] = this.toPlotterUnits(x, y);
    this.commands.push(`PR ${px},${py}`);
    this.currentPosition = { x: this.currentPosition.x + x, y: this.currentPosition.y + y };
  }
  drawLine(x1: number, y1: number, x2: number, y2: number) {
    this.set(x1, y1);
    this.move(x2, y2);
  }
  drawPoint(x: number, y: number) {
    this.move(x, y);
    this.penDOWN();
    this.penUP();
  }
  polyLine(points: Point[]) {
    this.set(points[0].x, points[0].y)
    this.penDOWN();
    points.forEach((point) => {
      this.set(point.x, point.y)
    })
    this.penUP();
  }
  triangle(points: Point[]) {
    this.set(points[0].x, points[0].y)
    this.penDOWN();
    points.forEach((point, i) => {
      this.set(point.x, point.y)
    })
    this.set(points[0].x, points[0].y)
    this.penUP();
  }
  arc(
    x: number, 
    y: number, 
    r: number, 
    rotation: number, 
    sweep: number = 0, 
    stepSize: number = 40
    ) {
        sweep = Math.min(sweep, 2 * Math.PI)
        const arcLength = Math.abs(sweep * r)
        const steps = Math.max(8, Math.round(arcLength / stepSize))
        const pts: Point[] = []
        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const angle = rotation + t * sweep
            pts.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r});
        }
        this.polyLine(pts)
  }

  // Serialize the commands to a string
  serialize(): string {
    return this.commands.join(';') + ';';
  }
}