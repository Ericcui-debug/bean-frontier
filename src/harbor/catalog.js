export const DEFAULT_MAP_ID='harbor';
export const MAP_CATALOG=Object.freeze([Object.freeze({id:'harbor',name:'Harbor',location:'雨后港口',description:'暖色斜阳与冷色海风中的豆豆爆破试点。',tempo:'Tactical',colors:['#dbab72','#426572','#162833']})]);
export const normalizeMapId=()=>DEFAULT_MAP_ID;
export const mapById=()=>MAP_CATALOG[0];
