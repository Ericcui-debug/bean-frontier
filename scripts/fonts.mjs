import fs from 'node:fs';
const source=fs.readFileSync('index.html','utf8')+fs.readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync('src/'+f,'utf8')).join('');
const chars=[...new Set([...source.matchAll(/[\u3000-\u9fff]/g)].map(m=>m[0]))].join('');
const url='https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@500;700;900&display=swap&text='+encodeURIComponent(chars);
let css=await (await fetch(url)).text();if(!css.includes('@font-face'))throw new Error('Font CSS missing');for(const u of new Set([...css.matchAll(/url\((https[^)]+)\)/g)].map(m=>m[1]))){const r=await fetch(u);if(!r.ok)throw new Error('Font fetch failed');const data=Buffer.from(await r.arrayBuffer()).toString('base64');css=css.split(u).join('data:font/ttf;base64,'+data);}fs.writeFileSync('src/fonts.css','/* Locally embedded Noto Sans SC, SIL Open Font License. */\n'+css);console.log('Embedded',chars.length,'Chinese glyphs');
