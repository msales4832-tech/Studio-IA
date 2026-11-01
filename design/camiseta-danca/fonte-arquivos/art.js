const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const id of process.argv.slice(2)){await p.goto('file:///tmp/mk/art.html?id='+id);await p.waitForSelector('body[data-ok]');await p.waitForTimeout(200);
await (await p.$('#s')).screenshot({path:`/tmp/mk/art_${id}.png`,omitBackground:true});}await b.close();})();
