import numpy as np, cv2
from scipy.ndimage import gaussian_filter
im=cv2.imread('wild.jpg')[...,::-1].astype(np.float32)
H,W=im.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
R,G,B=im[...,0],im[...,1],im[...,2]
def fill(im,M,valid,tex=None,feather=2.5):
    out=im.copy(); done=np.zeros(M.shape,bool); v=valid.astype(np.float32)
    for sg in (5,10,20,40,80):
        wv=gaussian_filter(v,sg); ok=(wv>0.15)&~done
        for c in range(3):
            S=gaussian_filter(im[...,c]*v,sg)/np.maximum(wv,1e-4)
            out[...,c]=np.where(M&ok,S,out[...,c])
        done|=ok
    if tex is not None: out+=(M*tex)[...,None]
    a=gaussian_filter(M.astype(np.float32),feather)[...,None]
    return im*(1-a)+out*a
# textura real do tecido (faixa de baixo da blusa, sem estampa), repetida em espelho
g=im.mean(-1); hp=g-gaussian_filter(g,2.0)
patch=hp[560:612,140:400]
tile=np.vstack([patch,patch[::-1]]); tile=np.hstack([tile,tile[:,::-1]])
tex=np.tile(tile,(H//tile.shape[0]+1,W//tile.shape[1]+1))[:H,:W]
# estampa do peito
reg=(xx>=125)&(xx<=405)&(yy>=290)&(yy<=552)
reg&=~((xx>205)&(xx<330)&(yy<336-1.15*np.abs(xx-267)))
red=(R-(G+B)/2)>10
M=cv2.dilate((red&reg).astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)&reg
M=cv2.morphologyEx(M.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8)).astype(bool)&reg
white=(im.min(-1)>110)&((im.max(-1)-im.min(-1))<30)
g0=im.mean(-1); hp0=g0-gaussian_filter(g0,1.5); sd0=hp0[white&~M].std()
nz0=gaussian_filter(np.random.default_rng(1).normal(0,1,(H,W)),0.8); nz0=nz0/nz0.std()*sd0*0.8
im=fill(im,M,(~M)&white,nz0)
# suaviza contornos de média frequência dentro da área da estampa antiga, mantendo dobras grandes e grão fino
trim=cv2.dilate(((R-(G+B)/2)>25).astype(np.uint8)&(~(reg|M)).astype(np.uint8),np.ones((25,25),np.uint8)).astype(bool)
Z=gaussian_filter((cv2.dilate(M.astype(np.uint8),np.ones((15,15),np.uint8)).astype(bool)&~trim).astype(np.float32),4)[...,None]
lo3=np.dstack([gaussian_filter(im[...,c],3) for c in range(3)]); lo14=np.dstack([gaussian_filter(im[...,c],14) for c in range(3)])
lo1=np.dstack([gaussian_filter(im[...,c],1.2) for c in range(3)])
im=im-Z*(lo3-lo14)-Z*0.6*(im-lo1)
# logo do boné
cap=((xx-263)**2+(yy-96)**2)<31**2
capred=(R>140)&(G<90)&(B<90)&~cap
g=im.mean(-1); hp=g-gaussian_filter(g,1.5); sd=hp[capred].std()
nz=gaussian_filter(np.random.default_rng(2).normal(0,1,(H,W)),0.8); nz=nz/nz.std()*sd*0.7
im=fill(im,cap,capred,nz,1.5)
cv2.imwrite('limpa.png',im.clip(0,255).astype(np.uint8)[...,::-1])
