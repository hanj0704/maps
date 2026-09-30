const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const convert = require('osmtogeojson');
const root = path.resolve(__dirname, '../../..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/seoul-forest.osm.json'), 'utf8'));
if (raw.remark || !raw.elements?.length) throw new Error('Incomplete Overpass response');
const bounds = [127.030, 37.538, 127.049, 37.551];
const map = convert(raw);
map.features = map.features.filter(f => ['Polygon','MultiPolygon','LineString','MultiLineString'].includes(f.geometry?.type)).map(f => {
  const t = f.properties;
  const kind = t.natural === 'water' || t.waterway ? 'water' : t.building ? 'building' : t.highway ? 'road' : 'green';
  return {type:'Feature', id:f.id, properties:{kind, name:t['name:ko'] || t.name || '', highway:t.highway || ''}, geometry:f.geometry};
});
const labels = raw.elements.filter(e => e.type === 'node' && e.tags?.name && e.lon >= bounds[0] && e.lon <= bounds[2] && e.lat >= bounds[1] && e.lat <= bounds[3])
  .slice(0, 16).map(e => ({name:e.tags['name:ko'] || e.tags.name, coordinate:[e.lon,e.lat]}));
labels.unshift({name:'서울숲',coordinate:[127.0378,37.5444]});
// A synthetic fixture, deliberately not marketed as a surveyed walking route.
const points = [[127.036,37.544],[127.037,37.5448],[127.0382,37.5454],[127.0395,37.5452],[127.040,37.5443],[127.0393,37.5436],[127.038,37.5433],[127.0368,37.5435],[127.036,37.544]];
const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="MapsPrototype" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>서울숲 검증용 합성 경로</name><trkseg>${points.map(([lon,lat])=>`<trkpt lat="${lat}" lon="${lon}"/>`).join('')}</trkseg></trk></gpx>`;
const bundle = {schemaVersion:1,id:'seoul-forest-v1',name:'서울숲 주변',bounds,map,labels,gpx,attribution:'© OpenStreetMap contributors · ODbL 1.0',sourceDate:raw.osm3s.timestamp_osm_base};
const text = JSON.stringify(bundle);
fs.mkdirSync(path.join(root,'data'),{recursive:true});
fs.writeFileSync(path.join(root,'data/seoul-forest-v1.json'),text);
fs.writeFileSync(path.join(root,'data/sample.gpx'),gpx);
fs.writeFileSync(path.join(__dirname,'../src/catalog.json'),JSON.stringify({id:bundle.id,name:bundle.name,bounds,filename:'seoul-forest-v1.json',sha256:crypto.createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)},null,2)+'\n');
console.log(`${map.features.length} map features, ${labels.length} labels, ${Buffer.byteLength(text)} bytes`);
