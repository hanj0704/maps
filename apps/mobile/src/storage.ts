import * as FS from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { MAX_BYTES, PackageRepository } from './domain';
import catalog from './catalog.json';

const directory = `${FS.documentDirectory}offline-maps/`;
const destination = `${directory}${catalog.sha256}.json`;
const temporary = `${directory}download.tmp`;
// Immutable content-addressed filename; a failed new download never overwrites a good package.
export const repository = new PackageRepository({
  async read() {
    const info = await FS.getInfoAsync(destination);
    if (!info.exists) return null;
    if (info.size > MAX_BYTES) throw new Error('저장된 지도 크기가 올바르지 않습니다. 삭제 후 다시 받으세요.');
    return FS.readAsStringAsync(destination);
  },
  async writeTemporary(text) { await FS.makeDirectoryAsync(directory,{intermediates:true}); await FS.writeAsStringAsync(temporary,text); },
  async commit() {
    const info=await FS.getInfoAsync(destination);
    if(info.exists) {
      const old=await FS.readAsStringAsync(destination);
      if(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,old)===catalog.sha256) return;
      await FS.deleteAsync(destination,{idempotent:true});
    }
    await FS.moveAsync({from:temporary,to:destination});
  },
  async cleanup() { await FS.deleteAsync(temporary,{idempotent:true}); },
  async remove() { await FS.deleteAsync(destination,{idempotent:true}); await FS.deleteAsync(temporary,{idempotent:true}); },
  digest: text=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,text),
},catalog.id,catalog.sha256);

export async function downloadPackage(baseURL:string, signal:AbortSignal):Promise<string> {
  const base = new URL(baseURL);
  if (!['http:','https:'].includes(base.protocol)) throw new Error('HTTP 또는 HTTPS 서버 주소를 입력하세요.');
  const response=await fetch(new URL(catalog.filename,`${baseURL.replace(/\/+$/,'')}/`).toString(),{signal});
  if(!response.ok) throw new Error(`다운로드 실패 (HTTP ${response.status})`);
  const size=Number(response.headers.get('content-length'));
  if(size > MAX_BYTES) throw new Error('지도 파일이 너무 큽니다.');
  const text=await response.text();
  if(text.length>MAX_BYTES) throw new Error('지도 파일이 너무 큽니다.');
  return text;
}
