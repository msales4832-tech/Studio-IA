import numpy as np, cv2, sys
from scipy.ndimage import gaussian_filter
def comp(base_path, layers, out, k=9, soft=0.7):
    base=cv2.imread(base_path)[...,::-1].astype(np.float32); H,W=base.shape[:2]
    L=base.mean(-1); Lb=gaussian_filter(L,4)
    gy,gx=np.gradient(Lb)
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
    mapx=xx-gx*k/10; mapy=yy-gy*k/10
    res=base.copy()
    for art,cx,top,width in layers:
        a=cv2.imread(art,cv2.IMREAD_UNCHANGED)[...,[2,1,0,3]].astype(np.float32)
        h=int(a.shape[0]*width/a.shape[1]); a=cv2.resize(a,(width,h),interpolation=cv2.INTER_AREA)
        lay=np.zeros((H,W,4),np.float32); x0=int(cx-width/2)
        lay[top:top+h,x0:x0+width]=a
        lay=cv2.remap(lay,mapx,mapy,cv2.INTER_LINEAR)
        if soft: lay=np.dstack([gaussian_filter(lay[...,c],soft) for c in range(4)])
        al=lay[...,3:]/255*0.97
        reg=al[...,0]>0.5
        wl=np.percentile(L[(L>150)],92)
        sh=np.clip(gaussian_filter(L,1.2)/wl,0.5,1.04)[...,None]
        hp=((L-gaussian_filter(L,2))/255)[...,None]
        ink=lay[...,:3]*sh*(1+hp*0.9)
        res=res*(1-al)+ink*al
    cv2.imwrite(out,res.clip(0,255).astype(np.uint8)[...,::-1])
P='/tmp/mk/'
cfg={
 'v1':(('front_base.png',[('art_v1f.png',1005,1060,200)],5,1.1),('back_base.png',[('art_v1b.png',960,610,460)],9,0.6)),
 'v2':(('front_base.png',[('art_v2f.png',790,1035,690)],5,1.1),('back_base.png',[('art_v2b.png',960,640,430)],9,0.6)),
 'v3':(('front_base.png',[('art_v3f.png',1005,1050,170)],5,1.1),('back_base.png',[('art_v3b.png',960,600,450)],9,0.6)),
}
for v,(f,b) in cfg.items():
    for side,(base,lays,k,s) in (('f',f),('b',b)):
        comp(P+base,[(P+a,cx,t,w) for a,cx,t,w in lays],P+f'm_{v}{side}.png',k,s)
