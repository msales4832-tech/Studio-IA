import numpy as np, cv2
from scipy.ndimage import gaussian_filter
def fill(im,M):
    H,W=M.shape
    white=(im.min(-1)>165)&((im.max(-1)-im.min(-1))<28)
    valid=((~M)&white).astype(np.float32); out=im.copy(); done=np.zeros((H,W),bool)
    for sg in (6,12,24,48,96):
        wv=gaussian_filter(valid,sg); ok=(wv>0.15)&~done
        for c in range(3):
            S=gaussian_filter(im[...,c]*valid,sg)/np.maximum(wv,1e-4)
            out[...,c]=np.where(M&ok,S,out[...,c])
        done|=ok
    g=im.mean(-1); hp=g-gaussian_filter(g,1.5); sd=hp[(~M)&white].std()
    nz=gaussian_filter(np.random.default_rng(1).normal(0,1,M.shape),0.8); nz=nz/nz.std()*sd*0.6
    out+=(M*nz)[...,None]
    a=gaussian_filter(M.astype(np.float32),1.5)[...,None]
    return im*(1-a)+out*a
# ---------- COSTAS ----------
im=cv2.imread('/tmp/cm/back.png',cv2.IMREAD_COLOR)[...,::-1].astype(np.float32)
H,W=im.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
non=(im.min(-1)<215)|((im.max(-1)-im.min(-1))>30)
box=np.zeros((H,W),bool)
for x0,y0,x1,y1 in [(690,750,1215,1015),(470,895,560,950),(1370,870,1445,970)]: box[y0:y1,x0:x1]=True
bright=(im.min(-1)>150)
inside=cv2.morphologyEx(bright.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((41,41),np.uint8)).astype(bool)
inside=cv2.erode(inside.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
bg=((im[...,2]-im[...,0])>8)&(im.max(-1)<110)
near=cv2.dilate(bright.astype(np.uint8),np.ones((15,15),np.uint8)).astype(bool)
sb=np.zeros((H,W),bool); sb[895:950,470:560]=True; sb[870:970,1370:1445]=True
inside|=sb&near&~bg
M=cv2.dilate((non&box&inside).astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)&box&inside
im=fill(im,M)
shirt=(im.min(-1)>150)&((im.max(-1)-im.min(-1))<40)
shirt=cv2.morphologyEx(shirt.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8)).astype(bool)
RED=np.array([200,16,46],np.float32)
wl=np.percentile(im[shirt].mean(-1),90)
def paint(mask):
    a=gaussian_filter(mask.astype(np.float32),1.0)[...,None]
    sh=np.clip(im.mean(-1,keepdims=True)/wl,0,1.08)
    return im*(1-a)+(RED*sh)*a
# gola
ys=543-13*((xx-960)/140.0)**2
col=shirt&(xx>800)&(xx<1120)&(yy<ys)&(yy>470)
im=paint(col)
# listras das mangas
def stripes(p0,p1,side):
    v=np.array(p1,float)-p0; n=np.array([v[1],-v[0]]); n/=np.linalg.norm(n)
    if n[1]>0: n=-n
    d=(xx-p0[0])*n[0]+(yy-p0[1])*n[1]   # distância acima da barra
    m=np.zeros((H,W),bool)
    for o,w in ((20,17),(48,17)): m|=(d>o)&(d<o+w)
    lim=(xx<676) if side=='L' else (xx>1236)
    return m&lim&shirt&(yy>850)
st=stripes((479,1027),(672,1079),'L')|stripes((1236,1067),(1430,1012),'R')
im=paint(st)
cv2.imwrite('/tmp/mk/back_base.png',im.clip(0,255).astype(np.uint8)[...,::-1])
# ---------- FRENTE ----------
f=cv2.imread('/tmp/foto/limpa.png')
f=cv2.resize(f,(f.shape[1]*3,f.shape[0]*3),interpolation=cv2.INTER_LANCZOS4)
cv2.imwrite('/tmp/mk/front_base.png',f)
