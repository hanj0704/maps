const {withAndroidManifest,withInfoPlist}=require('expo/config-plugins');
// LAN HTTP is explicitly enabled only for prototype builds; distribution uses HTTPS.
module.exports=config=>{
  if(process.env.ALLOW_LOCAL_HTTP!=='1')return config;
  config=withAndroidManifest(config,c=>{c.modResults.manifest.application[0].$['android:usesCleartextTraffic']='true';return c;});
  return withInfoPlist(config,c=>{c.modResults.NSAppTransportSecurity={...c.modResults.NSAppTransportSecurity,NSAllowsArbitraryLoads:true};return c;});
};
