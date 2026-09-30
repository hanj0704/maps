import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import './style.css';
import { courses, themes, type Theme } from '../../../shared/courseCatalog';
import preview from './preview.json';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="길을 담다 홈"><span class="brand-mark">길</span>길을 담다<span class="beta">PREVIEW</span></a><nav><a href="#explore">코스 둘러보기</a><button class="app-button" id="header-app">앱으로 이어가기 ↗</button></nav></header>
<main id="explore"><section class="intro"><div><p class="eyebrow">A LITTLE WALK, A NEW DISCOVERY</p><h1>오늘은 <span>어느 길로?</span></h1><p class="lead">숲을 따라, 강을 따라, 좋아하는 사람과.<br>마음에 드는 길을 살펴보고 앱에 담아 떠나세요.</p></div><div class="intro-note"><span>01 / EXPLORE</span><p>웹에서 미리 보고<br><strong>앱에서 함께 걷기</strong></p><span class="note-arrow">↘</span></div></section>
<section class="explorer" aria-label="코스 탐색"><aside><div class="list-top"><h2>취향대로 고르는 길</h2><span>대한민국</span></div><div class="filters" role="group" aria-label="코스 테마"></div><label class="search">⌕ <input id="search" type="search" placeholder="코스 이름이나 지역 검색" aria-label="코스 이름이나 지역 검색"></label><p id="count" class="count" aria-live="polite"></p><div id="courses"></div><p class="sample-note">지금은 서비스 미리보기 단계입니다.<br>서울숲은 합성 샘플, 나머지는 미등록 UI 예시입니다.</p></aside>
<div class="detail"><div class="map-wrap"><div id="map" aria-label="서울숲 코스 지도 미리보기"></div><div class="map-label"><span class="live-dot"></span>서울숲 · 코스 미리보기</div><button id="fit" class="fit">코스 전체 보기 ⤢</button><p id="map-error" role="status" hidden>배경 지도를 불러오지 못했습니다. 인터넷 연결을 확인해주세요. <button id="retry">다시 시도</button></p></div><div class="course-detail"><div><div class="tags"><span>데이트</span><span class="sample-tag">검증용 합성 샘플</span></div><h2>서울숲 주변</h2><p class="description">도심 속 초록을 따라 이어지는 동선을 미리 살펴보세요.<br>지도에 표시된 경로는 기능 확인을 위한 합성 데이터입니다.</p></div><div class="facts"><div><span>경로 길이</span><strong>0.89 <small>km</small></strong></div><div><span>코스 형태</span><strong>순환형</strong></div><div><span>지역</span><strong>서울 성동구</strong></div></div><div class="detail-bottom"><p>통행 가능성을 검수한 추천 코스가 아닙니다.<br>지도·경로 저장은 앱에서 진행합니다.</p><button class="primary" id="course-app">앱에서 이 코스 열기 ↗</button></div></div></div></section>
<section class="how"><p class="eyebrow">FROM SCREEN TO TRAIL</p><h2>살펴보고, 담아두고, 떠나세요.</h2><div><article><span>01</span><h3>마음에 드는 테마 찾기</h3><p>트레킹, 자전거, 데이트.<br>오늘의 기분에 맞는 길을 골라보세요.</p></article><article><span>02</span><h3>지도에서 동선 살펴보기</h3><p>어디서 시작해 어떻게 이어지는지.<br>출발 전에 코스를 가볍게 확인하세요.</p></article><article><span>03</span><h3>앱으로 가져가 함께 걷기</h3><p>앱에서 지역 지도와 경로를 저장하면<br>인터넷 없이도 내 위치와 비교할 수 있어요.</p></article></div></section></main>
<footer><span class="brand">길을 담다</span><p>조금 다른 길에서 만나는 일상.</p><span>© 2026 길을 담다 · 서비스 미리보기</span></footer>
<dialog id="app-dialog"><button class="close" aria-label="닫기">×</button><p class="eyebrow">CONTINUE ON YOUR PHONE</p><h2>이 길을 앱으로 가져가세요.</h2><p>길을 담다 테스트 앱이 설치된 휴대폰에서 열어주세요.<br>현재 앱스토어 배포 전이며, 설치된 테스트 앱만 연결됩니다.</p><a class="primary" href="gilmap://course/seoul-forest-v1">설치된 앱에서 열기 ↗</a><p class="dialog-note">앱이 열리지 않으면 테스트 앱 설치를 확인하세요.<br>웹에서는 지도와 동선만 미리 볼 수 있습니다.</p><button id="copy" class="copy">이 코스 웹 링크 복사</button><p id="copy-status" role="status"></p></dialog>`;
let theme:Theme='전체'; let query='';
const filters=document.querySelector<HTMLDivElement>('.filters')!;
for(const t of themes){const b=document.createElement('button');b.textContent=t;b.setAttribute('aria-pressed',String(t===theme));b.onclick=()=>{theme=t;render();};filters.append(b);}
function render(){
  Array.from(filters.children).forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===theme)));
  const filtered=courses.filter(c=>(theme==='전체'||c.theme===theme)&&`${c.name} ${c.area}`.includes(query));
  document.querySelector('#count')!.textContent=`${filtered.length}개 코스 · 미등록 예시 포함`;
  const list=document.querySelector('#courses')!;list.replaceChildren();
  for(const c of filtered){const b=document.createElement('button');b.className=`course ${c.packageId?'active':''}`;b.setAttribute('aria-label',`${c.name}, ${c.theme}, ${c.packageId?'지도 미리보기':'등록 준비 중'}`);
    const icon=document.createElement('span');icon.className='course-icon';icon.textContent=c.theme==='데이트'?'♡':c.theme==='트레킹'?'山':'↗';
    const text=document.createElement('span');text.className='course-text';const title=document.createElement('strong');title.textContent=c.name;const meta=document.createElement('span');meta.textContent=`${c.theme} · ${c.area}`;const sub=document.createElement('small');sub.textContent=c.packageId?'0.89 km · 합성 샘플':'미등록 UI 예시';text.append(title,meta,sub);const arrow=document.createElement('span');arrow.textContent=c.packageId?'↗':'준비 중';arrow.className='course-arrow';b.append(icon,text,arrow);
    b.onclick=()=>{if(c.packageId){fit();history.replaceState(null,'',`?course=${c.id}#explore`);document.querySelector('.detail')!.scrollIntoView({behavior:'smooth',block:'nearest'});}else{b.querySelector('small')!.textContent='경로 등록 후 미리보기가 제공됩니다.';}};list.append(b);
  }
  if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent='일치하는 코스가 없어요. 다른 이름이나 테마를 선택해보세요.';list.append(p);}
}
(document.querySelector('#search') as HTMLInputElement).oninput=e=>{query=(e.target as HTMLInputElement).value.trim();render();};render();
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:[127.038,37.5444],zoom:15.5,attributionControl:{compact:true}});
map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
function fit(){map.fitBounds([[127.0355,37.5429],[127.0405,37.5459]],{padding:65,duration:700});}
map.on('load',()=>{document.querySelector<HTMLParagraphElement>('#map-error')!.hidden=true;map.addSource('course',{type:'geojson',data:preview as maplibregl.GeoJSONSourceSpecification['data']});map.addLayer({id:'route-halo',type:'line',source:'course',paint:{'line-color':'#fff','line-width':9}});map.addLayer({id:'route',type:'line',source:'course',paint:{'line-color':'#d57245','line-width':5},layout:{'line-cap':'round','line-join':'round'}});new maplibregl.Marker({color:'#285e47'}).setLngLat([127.036,37.544]).setPopup(new maplibregl.Popup().setText('시작 · 도착 / 합성 샘플')).addTo(map);fit();});
map.on('error',()=>{document.querySelector<HTMLParagraphElement>('#map-error')!.hidden=false;});
document.querySelector<HTMLButtonElement>('#fit')!.onclick=fit;
document.querySelector<HTMLButtonElement>('#retry')!.onclick=()=>location.reload();
const dialog=document.querySelector<HTMLDialogElement>('#app-dialog')!;
for(const id of ['header-app','course-app'])document.getElementById(id)!.onclick=()=>dialog.showModal();
document.querySelector<HTMLButtonElement>('.close')!.onclick=()=>dialog.close();
document.querySelector<HTMLButtonElement>('#copy')!.onclick=async()=>{try{const url=new URL(location.href);url.search='?course=seoul-forest-v1';url.hash='explore';await navigator.clipboard.writeText(url.href);document.querySelector('#copy-status')!.textContent='웹 링크를 복사했어요.';}catch{document.querySelector('#copy-status')!.textContent='복사 권한이 없습니다. 브라우저 주소를 복사해주세요.';}};
