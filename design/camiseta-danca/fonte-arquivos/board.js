const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:1.5,viewport:{width:1600,height:1300}});
for(const v of ['v1','v2','v3']){await p.goto('file:///tmp/mk/board.html?v='+v);await p.waitForSelector('body[data-ok]');
await (await p.$('#c')).screenshot({path:`/home/user/Studio-IA/design/camiseta-danca/foto-modelo-${v.slice(1)}.jpg`,type:'jpeg',quality:90});}await b.close();})();
