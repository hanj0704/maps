import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import type { Bundle } from './domain';
export function offlineStyle(bundle:Bundle):StyleSpecification {
  // No external tile, sprite or glyph URLs. Korean annotations use system fonts.
  return {version:8,sources:{local:{type:'geojson',data:bundle.map}},layers:[
    {id:'background',type:'background',paint:{'background-color':'#f5f1e8'}},
    {id:'green',type:'fill',source:'local',filter:['all',['==',['geometry-type'],'Polygon'],['==',['get','kind'],'green']],paint:{'fill-color':'#cddfbc','fill-opacity':0.85}},
    {id:'water',type:'fill',source:'local',filter:['all',['==',['geometry-type'],'Polygon'],['==',['get','kind'],'water']],paint:{'fill-color':'#add5e1'}},
    {id:'buildings',type:'fill',source:'local',filter:['all',['==',['geometry-type'],'Polygon'],['==',['get','kind'],'building']],paint:{'fill-color':'#ded8cb','fill-outline-color':'#c9c1b2'}},
    {id:'water-lines',type:'line',source:'local',filter:['all',['==',['geometry-type'],'LineString'],['==',['get','kind'],'water']],paint:{'line-color':'#add5e1','line-width':3}},
    {id:'road-casing',type:'line',source:'local',filter:['==',['get','kind'],'road'],paint:{'line-color':'#cdc7b9','line-width':['interpolate',['linear'],['zoom'],12,1,17,7]}},
    {id:'roads',type:'line',source:'local',filter:['==',['get','kind'],'road'],paint:{'line-color':'#fffdf7','line-width':['interpolate',['linear'],['zoom'],12,0.5,17,4]}},
  ]};
}
