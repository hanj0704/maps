import type { ExpoConfig } from 'expo/config';
const config:ExpoConfig={
  name:'길을 담다',slug:'offline-course-maps',version:'0.1.0',orientation:'portrait',userInterfaceStyle:'light',scheme:'gilmap',
  ios:{bundleIdentifier:'dev.gilmap.prototype',supportsTablet:false,infoPlist:{NSLocalNetworkUsageDescription:'Mac의 개발용 서버에서 지도와 경로를 내려받습니다.',NSAppTransportSecurity:{NSAllowsLocalNetworking:true}}},
  android:{package:'dev.gilmap.prototype'},
  plugins:[
    '@maplibre/maplibre-react-native',
    ['expo-location',{locationWhenInUsePermission:'저장한 코스와 현재 위치를 지도에서 비교합니다.',isIosBackgroundLocationEnabled:false,isAndroidBackgroundLocationEnabled:false,isAndroidForegroundServiceEnabled:false}],
    './plugins/withLocalDevelopment',
  ],
};
export default config;
