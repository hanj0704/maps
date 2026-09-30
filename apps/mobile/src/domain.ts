import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { FeatureCollection, MultiLineString } from 'geojson';

export type Coordinate = [number, number];
export type Bounds = [number, number, number, number];
export interface Bundle {
  schemaVersion: 1; id: string; name: string; bounds: Bounds;
  map: FeatureCollection; labels: {name: string; coordinate: Coordinate}[];
  gpx: string; attribution: string; sourceDate: string;
}
export const MAX_BYTES = 8 * 1024 * 1024;
const array = <T,>(x: T | T[] | undefined): T[] => x === undefined ? [] : Array.isArray(x) ? x : [x];
export function isCoordinate(v: unknown): v is Coordinate {
  return Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && Number.isFinite(x)) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;
}
export function inside([lng,lat]: Coordinate, [w,s,e,n]: Bounds) { return lng >= w && lng <= e && lat >= s && lat <= n; }
export function parseGpx(xml: string): FeatureCollection<MultiLineString> {
  if (xml.length > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('유효하지 않은 GPX 파일입니다.');
  const parsed = new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseAttributeValue:false}).parse(xml);
  if (!parsed.gpx) throw new Error('GPX 루트가 없습니다.');
  const rawSegments: any[] = [];
  for (const track of array<any>(parsed.gpx.trk)) for (const seg of array<any>(track.trkseg)) rawSegments.push(array(seg.trkpt));
  if (!rawSegments.length) for (const route of array<any>(parsed.gpx.rte)) rawSegments.push(array(route.rtept));
  let count = 0;
  const segments: Coordinate[][] = rawSegments.map(points => points.map((p: any) => {
    if (++count > 50000) throw new Error('GPX 좌표가 너무 많습니다.');
    const lon = p['@_lon'], lat = p['@_lat'];
    if (typeof lon !== 'string' || typeof lat !== 'string' || !lon.trim() || !lat.trim()) throw new Error('GPX 좌표가 누락되었습니다.');
    const point: Coordinate = [Number(lon),Number(lat)];
    if (!isCoordinate(point)) throw new Error('GPX 좌표 범위가 잘못되었습니다.');
    return point;
  }));
  if (!segments.length || segments.some(s => s.length < 2)) throw new Error('GPX 구간에 두 개 이상의 좌표가 필요합니다.');
  return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:segments}}]};
}
export function validateBundle(text: string, expectedId: string): Bundle {
  if (text.length > MAX_BYTES) throw new Error('지도 파일이 너무 큽니다.');
  const b = JSON.parse(text);
  if (b.schemaVersion !== 1 || b.id !== expectedId || typeof b.name !== 'string' || typeof b.gpx !== 'string' || typeof b.attribution !== 'string' || !b.attribution || typeof b.sourceDate !== 'string') throw new Error('지도 패키지 정보가 올바르지 않습니다.');
  const v = b.bounds;
  if (!Array.isArray(v) || v.length !== 4 || !isCoordinate(v.slice(0,2)) || !isCoordinate(v.slice(2)) || v[0] >= v[2] || v[1] >= v[3]) throw new Error('지도 영역이 잘못되었습니다.');
  if (b.map?.type !== 'FeatureCollection' || !Array.isArray(b.map.features) || !b.map.features.length || b.map.features.length > 20000) throw new Error('지도 데이터가 없습니다.');
  let count = 0;
  const walk = (x: unknown): void => {
    if (++count > 500000) throw new Error('지도 데이터가 너무 큽니다.');
    if (!Array.isArray(x) || !x.length) throw new Error('지도 좌표가 잘못되었습니다.');
    if (typeof x[0] === 'number') { if (!isCoordinate(x)) throw new Error('지도 좌표 범위 오류'); }
    else x.forEach(walk);
  };
  for (const f of b.map.features) {
    if (f.type !== 'Feature' || !['Polygon','MultiPolygon','LineString','MultiLineString'].includes(f.geometry?.type) || !['road','water','green','building'].includes(f.properties?.kind)) throw new Error('지원하지 않는 지도 지형입니다.');
    walk(f.geometry.coordinates);
  }
  if (!Array.isArray(b.labels) || b.labels.length > 30 || b.labels.some((l:any) => typeof l.name !== 'string' || l.name.length > 100 || !isCoordinate(l.coordinate) || !inside(l.coordinate,b.bounds))) throw new Error('지명 정보가 잘못되었습니다.');
  const route = parseGpx(b.gpx);
  if (route.features[0].geometry.coordinates.some(seg => seg.some(p => !inside(p as Coordinate,b.bounds)))) throw new Error('경로가 다운로드 영역을 벗어납니다.');
  return b;
}

export function distanceMeters(a:Coordinate,b:Coordinate) {
  const rad = Math.PI/180, dlat=(b[1]-a[1])*rad, dlon=(b[0]-a[0])*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function routeLength(gpx:string) {
  return parseGpx(gpx).features[0].geometry.coordinates.reduce((total,s)=>total+s.slice(1).reduce((n,p,i)=>n+distanceMeters(s[i] as Coordinate,p as Coordinate),0),0);
}

export interface PackageIO {
  read(): Promise<string | null>;
  writeTemporary(text: string): Promise<void>;
  commit(): Promise<void>;
  cleanup(): Promise<void>;
  remove(): Promise<void>;
  digest(text: string): Promise<string>;
}
export class PackageRepository {
  private busy = false;
  constructor(private io:PackageIO, private id:string, private hash:string) {}
  async verify(text:string) {
    if (await this.io.digest(text) !== this.hash) throw new Error('다운로드 파일의 무결성 검증에 실패했습니다.');
    return validateBundle(text,this.id);
  }
  async restore() { const text = await this.io.read(); return text === null ? null : this.verify(text); }
  async install(download:()=>Promise<string>, signal?:AbortSignal) {
    if (this.busy) throw new Error('다른 저장 작업이 진행 중입니다.');
    this.busy=true;
    try {
      const text=await download(); const bundle=await this.verify(text);
      if(signal?.aborted) throw new Error('다운로드가 취소되었습니다.');
      await this.io.writeTemporary(text);
      if(signal?.aborted) throw new Error('다운로드가 취소되었습니다.');
      await this.io.commit(); return bundle;
    } finally { try { await this.io.cleanup(); } finally { this.busy=false; } }
  }
  async remove() {
    if(this.busy) throw new Error('다운로드 중에는 삭제할 수 없습니다.');
    this.busy=true; try {await this.io.remove();} finally {this.busy=false;}
  }
}
