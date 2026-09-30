import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PackageRepository, parseGpx, validateBundle, routeLength, type PackageIO } from '../src/domain';
import { offlineStyle } from '../src/mapStyle';
import catalog from '../src/catalog.json';
const fixture=readFileSync(join(__dirname,'../../../data/seoul-forest-v1.json'),'utf8');
const digest=async(t:string)=>createHash('sha256').update(t).digest('hex');
function memory(initial:string|null=null){
  let committed=initial,temporary:string|null=null;
  const io:PackageIO={read:async()=>committed,writeTemporary:async t=>{temporary=t;},commit:async()=>{committed=temporary;},cleanup:async()=>{temporary=null;},remove:async()=>{committed=null;},digest};
  return {io,repo:new PackageRepository(io,catalog.id,catalog.sha256)};
}
test('real map and GPX package validates with the pinned hash',async()=>{
  assert.equal(await digest(fixture),catalog.sha256);
  const b=validateBundle(fixture,catalog.id);
  assert.ok(b.map.features.length>1000); assert.ok(b.labels.some(l=>l.name==='서울숲'));
  assert.ok(routeLength(b.gpx)>500);
  const style=offlineStyle(b);
  assert.equal(style.glyphs,undefined); assert.equal(style.sprite,undefined);
  for(const source of Object.values(style.sources)){assert.equal(source.type,'geojson');assert.equal(typeof (source as any).data,'object');}
});
test('multiple track segments stay separate, avoiding false straight connections',()=>{
  const route=parseGpx('<gpx><trk><trkseg><trkpt lat="37" lon="127"/><trkpt lat="37.001" lon="127"/></trkseg><trkseg><trkpt lat="38" lon="128"/><trkpt lat="38.001" lon="128"/></trkseg></trk></gpx>');
  assert.equal(route.features[0].geometry.coordinates.length,2);
});
test('namespace and route points supported',()=>{
  assert.equal(parseGpx('<g:gpx xmlns:g="x"><g:rte><g:rtept lat="37" lon="127"/><g:rtept lat="38" lon="128"/></g:rte></g:gpx>').features[0].geometry.coordinates[0].length,2);
});
for(const bad of ['<gpx>','<html/>','<gpx/>','<!DOCTYPE gpx [<!ENTITY a "x">]><gpx/>','<gpx><rte><rtept lat="" lon="127"/><rtept lat="37" lon="127"/></rte></gpx>','<gpx><rte><rtept lat="91" lon="127"/><rtept lat="37" lon="127"/></rte></gpx>']){
  test(`reject malformed/empty/unsafe GPX: ${bad.slice(0,40)}`,()=>assert.throws(()=>parseGpx(bad)));
}
test('reject invalid bounds, missing geometry and out-of-region route',()=>{
  for(const mutate of [(b:any)=>{b.bounds=[128,38,127,37];},(b:any)=>{b.map.features[0].geometry.coordinates=[];},(b:any)=>{b.gpx=b.gpx.replace('127.036','129.036');}]){
    const b=JSON.parse(fixture); mutate(b); assert.throws(()=>validateBundle(JSON.stringify(b),catalog.id));
  }
});
test('download, commit and cold repository restore work without network',async()=>{
  const {io,repo}=memory(); await repo.install(async()=>fixture);
  const restarted=new PackageRepository(io,catalog.id,catalog.sha256);
  assert.equal((await restarted.restore())?.id,catalog.id);
});
test('corrupt and interrupted downloads preserve the previous valid package',async()=>{
  const {repo}=memory(fixture);
  await assert.rejects(repo.install(async()=>fixture+'broken'));
  await assert.rejects(repo.install(async()=>{throw new Error('network disconnected');}));
  assert.equal((await repo.restore())?.id,catalog.id);
});
test('failed disk commit is not reported as ready',async()=>{
  const {io}=memory();io.commit=async()=>{throw new Error('disk full');};
  const repo=new PackageRepository(io,catalog.id,catalog.sha256);
  await assert.rejects(repo.install(async()=>fixture),/disk full/);assert.equal(await repo.restore(),null);
});
test('corrupt saved data is rejected on restart and can be removed',async()=>{
  const {repo}=memory('{}');await assert.rejects(repo.restore());await repo.remove();assert.equal(await repo.restore(),null);
});
test('concurrent download and delete are blocked',async()=>{
  const {repo}=memory();let release!:(v:string)=>void;
  const running=repo.install(()=>new Promise(r=>release=r));
  await assert.rejects(repo.install(async()=>fixture));await assert.rejects(repo.remove());release(fixture);await running;
});
test('real filesystem survives a new repository instance; temporary files do not count',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'maps-test-'));const final=join(dir,'map.json'),temp=join(dir,'tmp');
  const io:PackageIO={read:async()=>{try{return await readFile(final,'utf8');}catch(e:any){if(e.code==='ENOENT')return null;throw e;}},writeTemporary:t=>writeFile(temp,t),commit:()=>rename(temp,final),cleanup:()=>rm(temp,{force:true}),remove:()=>rm(final,{force:true}),digest};
  try{await writeFile(temp,'partial');const first=new PackageRepository(io,catalog.id,catalog.sha256);assert.equal(await first.restore(),null);await first.install(async()=>fixture);assert.equal((await new PackageRepository(io,catalog.id,catalog.sha256).restore())?.id,catalog.id);}finally{await rm(dir,{recursive:true,force:true});}
});

test('cancellation during validation never commits',async()=>{
  const {io}=memory(); const controller=new AbortController();
  io.digest=async text=>{controller.abort();return digest(text);};
  const repo=new PackageRepository(io,catalog.id,catalog.sha256);
  await assert.rejects(repo.install(async()=>fixture,controller.signal),/취소/);
  assert.equal(await repo.restore(),null);
});

test('map style passes the SDK style specification validator',()=>{
  const {createRequire}=require('node:module');
  const sdkRequire=createRequire(require.resolve('@maplibre/maplibre-react-native/package.json'));
  const {validateStyleMin}=sdkRequire('@maplibre/maplibre-gl-style-spec');
  const errors=validateStyleMin(offlineStyle(validateBundle(fixture,catalog.id)));
  assert.deepEqual(errors,[]);
});
