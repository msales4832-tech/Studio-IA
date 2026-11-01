const o=require('/tmp/ot/node_modules/opentype.js'),fs=require('fs');
const F=o.loadSync('/tmp/fontes/Modak-Regular.ttf');
const RED='#c8102e',NAVY='#13294b',GOLD='#f2a900',W='#ffffff';
// texto -> caminho, centrado em cx, ajustado à largura w, com arco vertical (letras em pé)
function word(t,cx,base,w,size,arch=0){
  let adv=F.getAdvanceWidth(t,size); if(adv>w){size*=w/adv;adv=w}
  const p=F.getPath(t,cx-adv/2,base,size), hw=adv/2;
  const f=(x,y)=>[x,y-arch*(1-Math.min(1,((x-cx)/hw)**2))];
  let d='';for(const c of p.commands){
    if(c.type==='Z'){d+='Z';continue}
    const pts=[]; if(c.x1!==undefined)pts.push(f(c.x1,c.y1)); if(c.x2!==undefined)pts.push(f(c.x2,c.y2)); pts.push(f(c.x,c.y));
    d+=c.type+pts.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');}
  return {d,size};
}
// camadas tipo uniforme: contorno externo, filete, preenchimento
const varsity=(d,fill,k=3,outer=NAVY,inner=W,extra='')=>`<g ${extra} stroke-linejoin="round"><path d="${d}" fill="${outer}" stroke="${outer}" stroke-width="${k*2.4}"/><path d="${d}" fill="${inner}" stroke="${inner}" stroke-width="${k*1.2}"/><path d="${d}" fill="${fill}"/></g>`;
const flat=(d,fill,k=1.5,line='#7a0a1c',extra='')=>`<g ${extra}><path d="${d}" fill="${fill}" stroke="${line}" stroke-width="${k}" stroke-linejoin="round"/></g>`;
const lampArt=(c=RED,line=W)=>`<g>
 <path d="M-68,22 C-104,16 -104,-14 -70,-6" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>
 <path d="M-72,8 C-72,-24 36,-30 62,-10 L96,-20 C104,-22 109,-15 102,-8 L72,20 C40,40 -72,40 -72,8 Z" fill="${c}"/>
 <ellipse cx="-8" cy="-16" rx="24" ry="6.5" fill="${line}"/><ellipse cx="-8" cy="-16" rx="16" ry="3.6" fill="${c}"/>
 <path d="M-58,10 C-24,24 30,22 64,2" fill="none" stroke="${line}" stroke-width="3"/>
 <path d="M-52,19 C-20,30 26,28 56,14" fill="none" stroke="${line}" stroke-width="1.6" stroke-dasharray="5 4"/>
 <ellipse cx="-12" cy="36" rx="42" ry="6" fill="${c}"/>
 <path d="M101,-26 C86,-44 98,-64 107,-86 C116,-64 128,-44 113,-26 C109,-22 105,-22 101,-26Z" fill="${GOLD}"/>
 <path d="M104,-30 C98,-40 103,-52 107,-62 C111,-52 115,-40 110,-30Z" fill="${line}"/>
 ${[[-150,30],[-115,34],[-65,34],[-30,30]].map(([a,r])=>{const R=Math.PI/180*a;return `<line x1="${107+Math.cos(R)*r}" y1="${-52+Math.sin(R)*r}" x2="${107+Math.cos(R)*(r+16)}" y2="${-52+Math.sin(R)*(r+16)}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`}).join('')}
</g>`;
const badge=(x,y)=>`<g transform="translate(${x},${y})"><defs><path id="ring" d="M-27,0 A27,27 0 1,1 27,0 A27,27 0 1,1 -27,0"/></defs>
 <circle r="34" fill="${NAVY}"/><circle r="23.5" fill="${W}"/><circle r="21.5" fill="${RED}"/>
 <text font-family="Modak" font-size="7.5" fill="${W}" letter-spacing="1.2" dominant-baseline="central"><textPath href="#ring" startOffset="0">SALMOS 119 • 105 • LUZ • SALMOS 119 • 105 • LUZ •</textPath></text>
 <g transform="translate(-3,5) scale(.16)">${lampArt(W,RED)}</g></g>`;
const serif=(lines,y,size=12.5,col='#2a2a2a')=>lines.map((l,i)=>`<text x="250" y="${y+i*size*1.4}" font-family="Georgia,serif" font-style="italic" font-size="${size}" text-anchor="middle" fill="${col}">${l}</text>`).join('');
const ref=(y,col=NAVY)=>`<text x="250" y="${y}" font-family="Georgia,serif" font-size="10" letter-spacing="3" text-anchor="middle" fill="${col}">SALMOS 119:105</text>`;
const VERSO=['“Lâmpada para os meus pés é tua palavra,','e luz para o meu caminho.”'];

const V={
1:{t:'1 · Clássica Varsity',s:'Fiel à blusa Wildcats: palavra em arco no peito + ilustração da lâmpada no lugar do mascote, com tinta levemente gasta (vintage). Costas: referência e versículo na altura dos ombros.',
 dist:true,
 f:varsity(word('LÂMPADA',250,222,236,90,20).d,RED,2.6)+`<g transform="translate(222,332) scale(1.0)">${lampArt()}</g>`,
 b:varsity(word('SALMOS 119:105',250,128,190,40,10).d,RED,1.6)+serif(VERSO,160,12)},
2:{t:'2 · Bolhas nas Costas',s:'Adaptação da camisa “Dance for Jesus”: frente limpa com selo bordado no peito; costas com letras gordinhas sobrepostas, a palavra do meio “colada” por cima com filete branco, e o versículo completo embaixo.',
 f:badge(322,158),
 b:flat(word('LÂMPADA',250,205,236,90,10).d,RED,1.6,'#7a0a1c','transform="rotate(-4 250 190)"')
  +varsity(word('para os meus',250,236,170,44).d,NAVY,1.8,W,W,'transform="rotate(-6 250 228)"')
  +flat(word('PÉS',250,318,150,104).d,RED,1.6,'#7a0a1c','transform="rotate(3 250 290)"')
  +serif(VERSO,356,12)+ref(392)},
3:{t:'3 · Jersey 119',s:'Uniforme de time de verdade: frase em arco vertical nos ombros, número 119 em camadas (vermelho, filete branco, contorno azul) como letra costurada, e o fim do versículo em curva por baixo. Selo no peito.',
 f:badge(322,158),
 b:varsity(word('LÂMPADA PARA OS MEUS PÉS',250,150,236,40,18).d,RED,1.5)
  +varsity(word('119',250,318,190,190).d,RED,3.4)
  +varsity(word('E LUZ PARA O MEU CAMINHO',250,360,226,34,-10).d,NAVY,1.3,RED,W)
  +ref(400)}
};
const body='M190,40 Q250,58 310,40 L400,70 L480,180 L425,215 L385,175 L380,530 Q250,540 120,530 L115,175 L75,215 L20,180 L100,70 Z';
function shirt(id,front,art,dist){
  const dir=[0.59,-0.81];
  const stripes=(h,sx)=>[16,36].map(o=>{const dx=dir[0]*sx*o,dy=dir[1]*o,a=[h[0][0]+dx,h[0][1]+dy],b=[h[1][0]+dx,h[1][1]+dy],ex=b[0]-a[0],ey=b[1]-a[1];
    return `<line x1="${a[0]-ex*.3}" y1="${a[1]-ey*.3}" x2="${b[0]+ex*.12}" y2="${b[1]+ey*.12}" stroke="${RED}" stroke-width="11"/>`}).join('');
  const neck=front?`<path d="M192,40 L250,114 L308,40" fill="none" stroke="${RED}" stroke-width="13" stroke-linejoin="round"/><path d="M203,43 L250,101 L297,43 Q250,52 203,43Z" fill="#dcdcd8"/><path d="M196,44 L250,110 L304,44" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 2"/>`
    :`<path d="M190,40 Q250,60 310,40" fill="none" stroke="${RED}" stroke-width="11"/><path d="M196,44 Q250,62 304,44" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1" stroke-dasharray="2 2"/>`;
  return `<svg width="500" height="550" viewBox="0 0 500 550"><defs>
  <clipPath id="k${id}"><path d="${body}"/></clipPath>
  <linearGradient id="sd${id}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".10"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient>
  <filter id="bl${id}"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="sh${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-opacity=".22"/></filter>
  <filter id="nz${id}"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer></filter>
  <filter id="sp${id}"><feTurbulence type="fractalNoise" baseFrequency="${dist?.55:1.1}" numOctaves="3" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${dist?'15 0 0 0 -10.2':'15 0 0 0 -12.5'}"/></filter>
  <mask id="ms${id}"><rect width="500" height="550" fill="#fff"/><rect width="500" height="550" filter="url(#sp${id})"/></mask></defs>
  <path d="${body}" fill="#f8f8f6" filter="url(#sh${id})"/>
  <g clip-path="url(#k${id})">
   ${stripes([[20,180],[75,215]],1)}${stripes([[480,180],[425,215]],-1)}
   <g mask="url(#ms${id})" opacity=".96">${art}</g>
   <rect width="500" height="550" fill="url(#sd${id})"/>
   <g filter="url(#bl${id})" stroke="#000" stroke-opacity=".07" stroke-width="9" fill="none">
     <path d="M118,190 Q160,260 150,340"/><path d="M382,190 Q340,250 352,330"/><path d="M160,500 Q250,470 330,505"/><path d="M100,75 Q130,120 118,175"/><path d="M400,75 Q372,120 382,175"/></g>
   <rect width="500" height="550" filter="url(#nz${id})" style="mix-blend-mode:multiply"/>
   <path d="M122,522 Q250,532 378,522" fill="none" stroke="#bbb" stroke-width="1" stroke-dasharray="3 3"/>
  </g>
  <path d="${body}" fill="none" stroke="#cfcfcb" stroke-width="1.5"/>
  <path d="M115,175 L100,70 M385,175 L400,70" stroke="#d5d5d1" stroke-width="1.5" fill="none"/>${neck}</svg>`;
}
const chips=`<div class="chips"><span style="background:${RED}"></span>Vermelho <span style="background:${NAVY}"></span>Azul-marinho <span style="background:${GOLD}"></span>Dourado (chama) <span style="background:#f8f8f6;border:1px solid #ccc"></span>Branco</div>`;
const page=(v)=>`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@font-face{font-family:Modak;src:url(Modak-Regular.ttf)}
body{margin:0;background:#efe9df;font-family:Georgia,serif}
#c{width:1120px;padding:34px 40px 26px;box-sizing:border-box}
.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid ${NAVY};padding-bottom:10px}
h1{font:400 46px Modak;color:${RED};margin:0;line-height:1;letter-spacing:.5px}
.tag{font:bold 12px Arial;letter-spacing:3px;color:${NAVY}}
p{margin:12px 0 0;color:#333;font-size:16px;line-height:1.45;max-width:1000px}
.row{display:flex;justify-content:space-around;margin-top:8px}
.lbl{text-align:center;font:bold 13px Arial;letter-spacing:4px;color:${NAVY};margin-top:-6px}
.foot{display:flex;justify-content:space-between;font:12px Arial;color:#555;border-top:1px solid #cbbfae;padding-top:10px;margin-top:10px}
.chips span{display:inline-block;width:12px;height:12px;border-radius:50%;margin:0 4px 0 12px;vertical-align:-2px}
</style></head><body><div id="c">
<div class="top"><h1>${V[v].t}</h1><div class="tag">MINISTÉRIO DE DANÇA · SALMOS 119:105</div></div><p>${V[v].s}</p>
<div class="row"><div>${shirt('f',true,V[v].f,V[v].dist)}<div class="lbl">FRENTE</div></div><div>${shirt('b',false,V[v].b,V[v].dist)}<div class="lbl">COSTAS</div></div></div>
<div class="foot"><div>Fonte: Modak (Google Fonts, licença livre OFL) · Costas: ~28 × 33 cm, 5 cm abaixo da gola · Selo do peito: ~9 cm</div>${chips}</div>
</div><script>document.fonts.ready.then(()=>document.body.dataset.ok=1)</script></body></html>`;
const out='/home/user/Studio-IA/design/camiseta-danca/';
for(const v of [1,2,3])fs.writeFileSync(out+`pro-${v}.html`,page(v));
