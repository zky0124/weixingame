export interface CityCell { col: number; row: number }
export const DEFAULT_FARM: CityCell = { col: 2, row: -2 };
export const CITY_BOUNDS = { min: -4, max: 4 } as const;
export function project(col: number, row: number): { x: number; y: number } {
  return { x: (col - row) * 40, y: (col + row) * 20 };
}
export function unproject(x: number, y: number): CityCell {
  return { col: Math.floor((x / 40 + y / 20) / 2), row: Math.floor((y / 20 - x / 40) / 2) };
}
export function isHall(col: number, row: number): boolean { return col >= -1 && col <= 0 && row >= -1 && row <= 0; }
export function isRoad(col: number, row: number): boolean { return col === 1 || row === 1; }
export function farmPlacementError(cell: CityCell, radius=4, occupied:readonly CityCell[]=[]): string {
  if (!cell || !Number.isInteger(cell.col) || !Number.isInteger(cell.row)) return '请选择有效地块';
  if (cell.col < -radius || cell.row < -radius || cell.col + 1 > radius || cell.row + 1 > radius) return '超出已开放土地';
  if(occupied.some(p=>cell.col<p.col+2&&cell.col+2>p.col&&cell.row<p.row+2&&cell.row+2>p.row))return '与已有建筑占地重叠';
  for (let col = cell.col; col < cell.col + 2; col++) for (let row = cell.row; row < cell.row + 2; row++) {
    if (isHall(col, row)) return '与主城占地重叠';
    if (isRoad(col, row)) return '请保留中央通路';
  }
  return '';
}
export function inFarm(col: number, row: number, cell: CityCell): boolean {
  return col >= cell.col && col < cell.col + 2 && row >= cell.row && row < cell.row + 2;
}
