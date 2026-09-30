import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { type Bundle, type Coordinate, inside, parseGpx, routeLength } from './src/domain';
import { offlineStyle } from './src/mapStyle';
import { downloadPackage, repository } from './src/storage';
import catalog from './src/catalog.json';
import { courses, themes, recommendationPreview, type Theme, type Course } from './src/courseCatalog';

function Main() {
  const [theme,setTheme]=useState<Theme>('전체');
  const [debugOpen,setDebugOpen]=useState(false);
  const slides=useRef<ScrollView>(null);
  const [slide,setSlide]=useState(0);
  const [slideWidth,setSlideWidth]=useState(300);
  const [mapMode,setMapMode]=useState<'online'|'offline'>('online');
  const [mapError,setMapError]=useState('');
  const [mapAttempt,setMapAttempt]=useState(0);
  const recenterPending=useRef(false);
  const [tab,setTab]=useState<'map'|'courses'|'saved'>('map');
  const [bundle,setBundle]=useState<Bundle|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [server,setServer]=useState(process.env.EXPO_PUBLIC_PACKAGE_URL || 'http://localhost:8787');
  const [position,setPosition]=useState<Location.LocationObject|null>(null);
  const [locationMessage,setLocationMessage]=useState('현재 위치를 켜면 저장한 경로와 비교할 수 있어요.');
  const [locationEnabled,setLocationEnabled]=useState(false);
  const [appState,setAppState]=useState(AppState.currentState);
  const [now,setNow]=useState(Date.now());
  const camera=useRef<CameraRef>(null);
  const details=useRef<ScrollView>(null);
  const permissionPending=useRef(false);
  const activeDownload=useRef<AbortController|null>(null);
  const operationLock=useRef(false);
  const alive=useRef(true);
  useEffect(()=>{
    alive.current=true;
    repository.restore().then(b=>{if(alive.current){setBundle(b);if(b)setMapMode('offline');}}).catch(e=>{if(alive.current)setError(String(e.message));}).finally(()=>{if(alive.current)setLoading(false);});
    Location.getForegroundPermissionsAsync().then(p=>{if(alive.current && p.granted)setLocationEnabled(true);}).catch(()=>{});
    const sub=AppState.addEventListener('change',setAppState);
    const timer=setInterval(()=>setNow(Date.now()),5000);
    return ()=>{alive.current=false;activeDownload.current?.abort();sub.remove();clearInterval(timer);};
  },[]);
  useEffect(()=>{
    function handleCourseLink(url:string|null){
      if(url!=='gilmap://course/seoul-forest-v1')return;
      setTab('map');setMapMode('offline');setMapError('');
    }
    Linking.getInitialURL().then(handleCourseLink).catch(()=>{});
    const subscription=Linking.addEventListener('url',event=>handleCourseLink(event.url));
    return ()=>subscription.remove();
  },[]);
  useEffect(()=>{
    if(!locationEnabled || appState!=='active') return;
    let disposed=false;
    let watch:Location.LocationSubscription|undefined;
    (async()=>{
      if(!await Location.hasServicesEnabledAsync()) throw new Error('기기의 위치 서비스를 켜주세요.');
      // Lifecycle changes must never open a permission dialog.
      const permission=await Location.getForegroundPermissionsAsync();
      if(permission.status!=='granted') throw new Error('위치 권한이 없습니다. 설정에서 위치 접근을 허용해주세요.');
      if(disposed)return;
      setLocationMessage('GPS 위치를 기다리는 중 · 야외에서 확인해주세요.');
      watch=await Location.watchPositionAsync({accuracy:Location.Accuracy.High,distanceInterval:3,timeInterval:2000},p=>{
        if(!disposed){setPosition(p);setLocationMessage('위치 수신 중');if(recenterPending.current){camera.current?.easeTo({center:[p.coords.longitude,p.coords.latitude],zoom:15,duration:400});recenterPending.current=false;}}
      },message=>{if(!disposed)setLocationMessage(`위치 수신 오류: ${message}`);});
      if(disposed)watch.remove();
    })().catch(e=>{if(!disposed){setLocationMessage(e.message);setLocationEnabled(false);}});
    return ()=>{disposed=true;watch?.remove();};
  },[locationEnabled,appState]);
  useEffect(()=>{details.current?.scrollTo({y:0,animated:false});},[bundle?.id,tab]);
  async function enableLocation(){
    if(permissionPending.current)return;
    permissionPending.current=true;
    try{
      let permission=await Location.getForegroundPermissionsAsync();
      if(!permission.granted)permission=await Location.requestForegroundPermissionsAsync();
      if(!alive.current)return;
      if(permission.granted)setLocationEnabled(true);
      else {recenterPending.current=false;setLocationMessage('위치 권한이 없습니다. 설정에서 위치 접근을 허용해주세요.');}
    }catch(e){if(alive.current)setLocationMessage(e instanceof Error?e.message:String(e));}
    finally{permissionPending.current=false;}
  }
  function changeMap(mode:'online'|'offline'){setMapError('');setMapMode(mode);}
  const style=useMemo(()=>mapMode==='online'?'https://tiles.openfreemap.org/styles/liberty':bundle?offlineStyle(bundle):null,[bundle,mapMode]);
  const route=useMemo(()=>bundle?parseGpx(bundle.gpx):null,[bundle]);
  const length=useMemo(()=>bundle?routeLength(bundle.gpx):0,[bundle]);
  const coordinate:Coordinate|undefined=position?[position.coords.longitude,position.coords.latitude]:undefined;
  const stale=position && (now-position.timestamp>30000 || appState!=='active' || !locationEnabled);
  async function install(){
    if(operationLock.current)return;
    operationLock.current=true;setBusy(true);setError('');
    const controller=new AbortController();activeDownload.current=controller;
    const timer=setTimeout(()=>controller.abort(),60000);
    try{
      const b=await repository.install(async()=>{
        const text=await downloadPackage(server,controller.signal);
        if(controller.signal.aborted)throw new Error('다운로드가 취소되었습니다.');
        return text;
      },controller.signal);
      if(alive.current){setBundle(b);changeMap('offline');}
    }catch(e){if(alive.current)setError(controller.signal.aborted?'다운로드가 취소되었거나 60초를 초과했습니다. 다시 시도하세요.':e instanceof Error?e.message:String(e));}
    finally{clearTimeout(timer);activeDownload.current=null;operationLock.current=false;if(alive.current)setBusy(false);}
  }
  async function remove(){
    if(operationLock.current)return;
    operationLock.current=true;setBusy(true);
    try{await repository.remove();setBundle(null);setError('');}catch(e){setError(String(e));}
    finally{operationLock.current=false;setBusy(false);}
  }
  function goToSlide(index:number){setSlide(index);slides.current?.scrollTo({x:index*(slideWidth+10),animated:true});}
  function openCourse(course:Course){
    if(!course.packageId){Alert.alert(course.name,'추천 화면을 확인하기 위한 예시입니다. 아직 경로와 다운로드 파일이 등록되지 않았습니다.');return;}
    changeMap('offline');setTab('map');
  }
  const visibleCourses=tab==='saved'?courses.filter(c=>!!bundle&&c.packageId===bundle.id):courses.filter(c=>theme==='전체'||c.theme===theme);
  return <SafeAreaView style={s.screen}>
    <StatusBar style="dark"/>
    <View style={s.header}><View><Text style={s.eyebrow}>길을 담다 · OFFLINE FIELD TEST</Text><Text style={s.title}>{tab==='courses'?'취향대로 골라 걷기':tab==='saved'?'내 폰에 담긴 코스':mapMode==='online'?'대한민국을 둘러보세요':'서울숲, 연결 없이'}</Text></View><View style={s.badge}><Text style={s.badgeText}>{bundle?'저장됨':'미저장'}</Text></View></View>
    <View accessibilityRole="tablist" style={s.tabs}>
      {([['map','지도'],['courses','코스 목록'],['saved','저장한 코스']] as const).map(([key,label])=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:tab===key}} style={[s.tab,tab===key&&s.selectedTab]} onPress={()=>setTab(key)}><Text style={[s.tabText,tab===key&&s.selectedTabText]}>{label}</Text></Pressable>)}
    </View>
    {tab!=='map' && <View style={s.listPanel}>
      {tab==='courses'&&<View accessibilityRole="tablist" style={s.filters}>{themes.map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:theme===t}} style={[s.filter,theme===t&&s.selectedTab]} onPress={()=>setTheme(t)}><Text style={theme===t?s.selectedTabText:s.tabText}>{t}</Text></Pressable>)}</View>}
      <Text style={s.muted}>{tab==='saved'?`오프라인 사용 가능 · ${visibleCourses.length}개`:`${theme} · ${visibleCourses.length}개 · 미등록 예시 포함`}</Text>
      <FlatList data={loading?[]:visibleCourses} keyExtractor={c=>c.id} contentContainerStyle={{paddingBottom:20}} ListEmptyComponent={loading?<ActivityIndicator color="#25624b"/>:<View style={s.status}><Text style={s.sectionTitle}>아직 저장한 코스가 없어요</Text><Pressable accessibilityRole="button" style={s.secondary} onPress={()=>setTab('courses')}><Text>코스 목록에서 찾아보기 →</Text></Pressable></View>} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.theme}, ${item.packageId?(bundle?'저장됨':'다운로드 필요'):'미등록 예시'}`} style={s.courseRow} onPress={()=>openCourse(item)}>
        <View style={s.themeIcon}><Text style={s.themeIconText}>{item.theme==='트레킹'?'山':item.theme==='자전거'?'↗':'♡'}</Text></View>
        <View style={{flex:1,gap:3}}><Text style={s.sectionTitle}>{item.name}</Text><Text style={s.muted}>{item.theme} · {item.area}</Text><Text style={s.listMeta}>{item.packageId?`${bundle?(length/1000).toFixed(2)+' km · ':''}581 KB · 합성 샘플`:'미등록 UI 예시 · 다운로드 불가'}</Text></View>
        <Text style={s.listState}>{item.packageId?(bundle?'저장됨':'받기'):'예시'} ›</Text>
      </Pressable>}/>
    </View>}
    {tab==='map'&&<View style={s.modeBar}>
      <Pressable accessibilityRole="button" accessibilityState={{selected:mapMode==='online'}} style={[s.modeButton,mapMode==='online'&&s.selectedTab]} onPress={()=>changeMap('online')}><Text style={mapMode==='online'?s.selectedTabText:s.tabText}>전국 지도 · 온라인</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{selected:mapMode==='offline'}} style={[s.modeButton,mapMode==='offline'&&s.selectedTab]} onPress={()=>changeMap('offline')}><Text style={mapMode==='offline'?s.selectedTabText:s.tabText}>저장 지역 · 오프라인</Text></Pressable>
    </View>}
    <View style={[s.mapFrame,tab!=='map'&&s.hidden]}>
      {!loading && style ? <Map key={`${mapMode}-${mapAttempt}`} style={s.map} mapStyle={style} onDidFailLoadingMap={()=>setMapError(mapMode==='online'?'전국 지도를 불러오지 못했습니다. 인터넷 연결을 확인하거나 저장 지역으로 전환해주세요.':'저장 지도 표시 실패. 다시 시도하거나 파일을 다시 다운로드해주세요.')}>
        <Camera ref={camera} initialViewState={mapMode==='online'?{bounds:[124.5,33,132,38.8],padding:{top:24,right:24,bottom:24,left:24}}:{center:[127.0395,37.5445],zoom:14.8}} minZoom={mapMode==='online'?3:12} maxZoom={19}/>
        {route&&<GeoJSONSource id="route" data={route}><Layer id="route-halo" type="line" paint={{'line-color':'#ffffff','line-width':8}}/><Layer id="route-line" type="line" paint={{'line-color':'#df7149','line-width':4}} layout={{'line-cap':'round','line-join':'round'}}/></GeoJSONSource>}
        {mapMode==='offline'&&bundle?.labels.map((label,i)=><Marker key={i} id={`label-${i}`} lngLat={label.coordinate}><Text style={s.label}>{label.name}</Text></Marker>)}
        {coordinate && <Marker id="current-location" lngLat={coordinate}><View style={[s.locationDot,stale?{backgroundColor:'#929b98'}:{}]}/></Marker>}
      </Map>:<View style={s.empty}>{loading?<ActivityIndicator color="#25624b"/>:<><Text style={s.emptyTitle}>이 지역을 내 폰에 담아두세요</Text><Text style={s.muted}>도로 · 공원 · 건물 · 한글 지명{ '\n' }지도와 경로를 내려받으면 여기 표시됩니다.</Text></>}</View>}
      {style && <View style={s.mapTools}><Pressable accessibilityRole="button" style={s.smallButton} onPress={()=>camera.current?.fitBounds(mapMode==='online'?[124.5,33,132,38.8]:catalog.bounds as [number,number,number,number],{padding:{top:40,right:24,bottom:40,left:24},duration:400})}><Text>{mapMode==='online'?'전국 보기':'전체 영역'}</Text></Pressable><Pressable accessibilityRole="button" style={s.smallButton} onPress={()=>{if(coordinate&&!stale)camera.current?.easeTo({center:coordinate,zoom:15,duration:400});else {recenterPending.current=true;void enableLocation();}}}><Text>내 위치</Text></Pressable></View>}

      <Pressable accessibilityRole="link" style={s.attribution} onPress={()=>void Linking.openURL('https://www.openstreetmap.org/copyright')}><Text style={s.attributionText}>{mapMode==='online'?'OpenFreeMap · © OpenMapTiles · © OpenStreetMap':'© OpenStreetMap contributors · ODbL 1.0'}</Text></Pressable>
    </View>
    {tab==='map'&&mapMode==='online'&&<View style={s.recommendations} onLayout={e=>setSlideWidth(Math.max(200,e.nativeEvent.layout.width-40))}>
      <View style={[s.row,{paddingHorizontal:20}]}><Text style={s.sectionTitle}>추천 코스 TOP 5</Text><View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel="이전 추천 코스" disabled={slide===0} style={[s.slideArrow,slide===0&&s.disabled]} onPress={()=>goToSlide(slide-1)}><Text>‹</Text></Pressable><Text style={s.listMeta}>{slide+1} / 5 · UI 예시</Text><Pressable accessibilityRole="button" accessibilityLabel="다음 추천 코스" disabled={slide===4} style={[s.slideArrow,slide===4&&s.disabled]} onPress={()=>goToSlide(slide+1)}><Text>›</Text></Pressable></View></View>
      <Text style={[s.listMeta,{paddingHorizontal:20,marginTop:3}]}>실제 인기 순위가 아닌 미리보기입니다.</Text>
      <ScrollView ref={slides} horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={slideWidth+10} contentContainerStyle={{paddingHorizontal:20,paddingTop:8,paddingBottom:4,gap:10}} onMomentumScrollEnd={e=>setSlide(Math.min(4,Math.max(0,Math.round(e.nativeEvent.contentOffset.x/(slideWidth+10)))))}>
        {recommendationPreview.map((course,index)=><Pressable key={course.id} accessibilityRole="button" accessibilityLabel={`${index+1}위 예시, ${course.name}`} style={[s.recommendation,{width:slideWidth}]} onPress={()=>openCourse(course)}><Text style={s.rank}>{index+1}</Text><View style={{flex:1,gap:4}}><Text style={s.sectionTitle}>{course.name}</Text><Text style={s.muted}>{course.theme} · {course.packageId?'합성 샘플 코스':'코스 등록 준비 중'}</Text></View><Text style={s.listState}>보기 ›</Text></Pressable>)}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityState={{expanded:debugOpen}} style={s.debugToggle} onPress={()=>setDebugOpen(v=>!v)}><Text style={s.listMeta}>{debugOpen?'− 개발 디버그 접기':'+ 개발 디버그 열기'}</Text></Pressable>
    </View>}
    {tab==='map'&&mapMode==='online'&&!debugOpen&&!!mapError&&<Text accessibilityRole="alert" style={[s.error,{paddingHorizontal:20}]}>{mapError}</Text>}
    <ScrollView ref={details} style={[s.details,(tab!=='map'||(mapMode==='online'&&!debugOpen))&&s.hidden,mapMode==='online'&&{maxHeight:'28%'}]} contentContainerStyle={{padding:20,paddingBottom:24}} keyboardShouldPersistTaps="handled">
      {mapMode==='online'&&<Text style={s.muted}>전국 지도는 인터넷 연결이 필요합니다. 통신 없이 사용할 때는 저장 지역으로 전환하세요.</Text>}
      {!!mapError&&<View><Text accessibilityRole="alert" style={s.error}>{mapError}</Text><Pressable accessibilityRole="button" style={s.secondary} onPress={()=>{setMapError('');setMapAttempt(v=>v+1);}}><Text>지도 다시 불러오기</Text></Pressable></View>}
      <View style={s.row}><Text style={s.sectionTitle}>서울숲 주변 지도 + 샘플 GPX</Text><Text style={s.tag}>기술 검증</Text></View>
      <Text style={s.muted}>{Math.round(catalog.bytes/1024)} KB · {bundle?`${(length/1000).toFixed(2)} km · `:''}검증용 합성 경로, 추천 코스 아님</Text>
      <View style={s.status}><Text style={s.statusTitle}>{bundle?'✓ 지도와 경로 저장 완료':'지도와 경로를 먼저 다운로드하세요'}</Text><Text style={s.muted}>{bundle?'앱을 다시 열어도 기기에 저장한 파일을 읽습니다.':'외부 지도 계정 없이 자체 데이터 서버에서 받습니다.'}</Text>{bundle&&<Text style={s.muted}>원본 기준: {bundle.sourceDate.slice(0,10)} · 오프라인 지도는 저장 영역 안에서 제공합니다.</Text>}</View>
      {!bundle && <><Text style={s.inputLabel}>테스트 데이터 서버 주소</Text><TextInput accessibilityLabel="테스트 데이터 서버 주소" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} editable={!busy}/><Text style={s.hint}>아이폰: 같은 Wi-Fi의 Mac IP · Android 에뮬레이터: http://10.0.2.2:8787</Text></>}
      {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!bundle && <Pressable accessibilityRole="button" disabled={loading||busy} style={[s.primary,(loading||busy)&&s.disabled]} onPress={()=>void install()}><Text style={s.primaryText}>{busy?'다운로드 및 파일 검증 중…':'지도와 경로 다운로드'}</Text></Pressable>}
      {busy && <Pressable style={s.secondary} onPress={()=>activeDownload.current?.abort()}><Text>다운로드 취소</Text></Pressable>}
      <View style={s.locationPanel}><Text style={s.sectionTitle}>현재 위치</Text><Text style={s.muted}>{locationMessage}</Text>{position&&<><Text style={s.muted}>정확도 {position.coords.accuracy == null?'알 수 없음':`±${Math.round(position.coords.accuracy)} m`} · {new Date(position.timestamp).toLocaleTimeString()}</Text>{stale&&<Text style={s.error}>최근 위치 갱신이 없습니다. 회색 점은 마지막 수신 위치입니다.</Text>}{mapMode==='offline'&&bundle&&coordinate&&!inside(coordinate,bundle.bounds)&&<Text style={s.error}>현재 위치가 다운로드한 지도 영역 밖입니다.</Text>}</>}<View style={s.row}><Pressable style={s.secondary} onPress={()=>{if(locationEnabled){setLocationEnabled(false);setLocationMessage('위치 수신을 껐습니다.');}else void enableLocation();}}><Text>{locationEnabled?'위치 끄기':'현재 위치 켜기'}</Text></Pressable><Pressable style={s.secondary} onPress={()=>void Linking.openSettings()}><Text>권한 설정</Text></Pressable></View></View>
      <Pressable disabled={busy||loading} style={s.secondary} onPress={()=>Alert.alert('저장 데이터 삭제','지도와 경로를 삭제할까요?',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>void remove()}])}><Text style={{color:'#8e4a36'}}>저장 데이터 삭제 / 손상 파일 초기화</Text></Pressable>
      <Text style={s.hint}>이번 버전은 앱을 보고 있을 때 위치를 표시합니다. 화면을 끈 상태의 기록·안내는 포함하지 않습니다.</Text>
    </ScrollView>
  </SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><Main/></SafeAreaProvider>;}
const s=StyleSheet.create({
  slideArrow:{minWidth:32,minHeight:32,alignItems:'center',justifyContent:'center'},
  filters:{flexDirection:'row',gap:8,marginBottom:4},filter:{paddingVertical:10,paddingHorizontal:15,borderRadius:18,backgroundColor:'#edf2e8'},courseRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:1,borderColor:'#e3e7dc'},themeIcon:{width:42,height:46,borderRadius:12,backgroundColor:'#e5eddf',alignItems:'center',justifyContent:'center'},themeIconText:{fontSize:24,color:'#497054'},listMeta:{fontSize:11,lineHeight:16,color:'#7d877c'},listState:{fontSize:12,color:'#285e47'},recommendations:{paddingTop:12},recommendation:{flexDirection:'row',alignItems:'center',gap:16,padding:14,backgroundColor:'#edf2e8',borderRadius:14},rank:{fontSize:32,fontWeight:'700',color:'#628467',width:30},debugToggle:{alignItems:'center',paddingVertical:10},
  modeBar:{flexDirection:'row',marginHorizontal:12,marginBottom:10,gap:8},modeButton:{flex:1,padding:10,borderRadius:10,alignItems:'center',backgroundColor:'#edf2e8'},
  hidden:{display:'none'},tabs:{flexDirection:'row',marginHorizontal:20,marginBottom:14,backgroundColor:'#edf2e8',borderRadius:12,padding:4},tab:{flex:1,paddingVertical:11,alignItems:'center',borderRadius:9},selectedTab:{backgroundColor:'#285e47'},tabText:{fontSize:13,color:'#496452',fontWeight:'600'},selectedTabText:{color:'#fff'},listPanel:{flex:1,paddingHorizontal:20,gap:10},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dce5d7',borderRadius:18,padding:18,gap:10,marginTop:12},
  screen:{flex:1,backgroundColor:'#fbfaf6'},header:{paddingHorizontal:20,paddingVertical:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},eyebrow:{fontSize:10,letterSpacing:1.2,color:'#537362',fontWeight:'700'},title:{fontSize:24,fontWeight:'700',color:'#233d32',marginTop:5},badge:{backgroundColor:'#e3eddf',borderRadius:20,padding:10},badgeText:{fontSize:12,color:'#2e604b'},
  mapFrame:{flex:1,minHeight:230,backgroundColor:'#e9ede4',marginHorizontal:12,borderRadius:20,overflow:'hidden'},map:{flex:1},empty:{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:12},emptyTitle:{fontSize:18,fontWeight:'600',color:'#335944'},muted:{fontSize:13,color:'#667568',lineHeight:20},mapTools:{position:'absolute',top:12,right:12,gap:8},smallButton:{padding:10,borderRadius:10,backgroundColor:'#ffffff'},attribution:{position:'absolute',bottom:0,left:0,right:0,padding:4,backgroundColor:'#ffffffde'},attributionText:{fontSize:10,textAlign:'center',color:'#4c6055'},label:{fontSize:10,color:'#3e5646',backgroundColor:'#fffffff0',paddingHorizontal:4,paddingVertical:2,borderRadius:4},locationDot:{width:19,height:19,backgroundColor:'#347cf0',borderColor:'#fff',borderWidth:3,borderRadius:10},
  details:{flexGrow:0,maxHeight:'48%'},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},sectionTitle:{fontSize:15,fontWeight:'700',color:'#2f4438'},tag:{fontSize:10,color:'#916843',backgroundColor:'#f5e8d8',padding:5,borderRadius:5},status:{padding:12,backgroundColor:'#edf2e8',borderRadius:12,marginVertical:12,gap:3},statusTitle:{fontSize:14,color:'#2b634b',fontWeight:'600'},inputLabel:{fontSize:12,fontWeight:'600',marginBottom:6,color:'#425649'},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#d6ded2',borderRadius:10,padding:12,fontSize:14},hint:{fontSize:11,color:'#7d877c',lineHeight:17,marginVertical:7},error:{fontSize:12,color:'#a44332',lineHeight:18,marginVertical:6},primary:{backgroundColor:'#285e47',padding:15,borderRadius:12,alignItems:'center',marginTop:8},primaryText:{color:'#fff',fontSize:15,fontWeight:'600'},disabled:{opacity:0.5},secondary:{paddingVertical:12,paddingHorizontal:8,alignItems:'center'},locationPanel:{marginTop:15,borderTopWidth:1,borderColor:'#e3e7dc',paddingTop:15,gap:5},
});
