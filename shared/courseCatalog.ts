// Presentation fixtures. Only the existing Seoul Forest package is downloadable.
export const themes = ['전체', '트레킹', '자전거', '데이트'] as const;
export type Theme = typeof themes[number];
export type Course = { id:string; name:string; theme:Exclude<Theme,'전체'>; area:string; packageId?:string };
export const courses:Course[] = [
  {id:'seoul-forest-v1',name:'서울숲 주변',theme:'데이트',area:'서울 · 성동구',packageId:'seoul-forest-v1'},
  {id:'demo-trekking',name:'숲길 트레킹',theme:'트레킹',area:'코스 등록 준비 중'},
  {id:'demo-cycle',name:'강변 자전거',theme:'자전거',area:'코스 등록 준비 중'},
  {id:'demo-date',name:'노을 산책',theme:'데이트',area:'코스 등록 준비 중'},
  {id:'demo-walk',name:'주말 둘레길',theme:'트레킹',area:'코스 등록 준비 중'},
];
// Editorial UI preview order, not usage-based ranking. Replace with curated API data.
export const recommendationPreview = courses.slice(0,5);
