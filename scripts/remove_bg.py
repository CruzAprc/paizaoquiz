#!/usr/bin/env python3
"""Remove o fundo xadrez (gravado em RGB) da foto da landing.
Estratégia: detecta pixels claros/dessaturados (o xadrez) e mantém só os que
estão CONECTADOS às bordas como fundo -> assim tênis branco e pele clara,
que ficam cercados pelo corpo, são preservados. Suaviza a borda e faz autocrop."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "assets/img/carlao-landing.png"
OUT = "assets/img/carlao-landing.png"

img = Image.open(SRC).convert("RGB")
arr = np.asarray(img).astype(np.int16)
R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]
maxc = np.maximum(np.maximum(R, G), B)
minc = np.minimum(np.minimum(R, G), B)
sat = maxc - minc

# candidato a fundo: claro e pouco saturado (os dois tons do xadrez)
candidate = (minc >= 175) & (sat <= 42)

# rotula componentes conectados (8-conn) e mantém os que tocam a borda
lbl, n = ndimage.label(candidate, structure=np.ones((3, 3)))
border = set(np.unique(np.concatenate([
    lbl[0, :], lbl[-1, :], lbl[:, 0], lbl[:, -1]
])))
border.discard(0)
background = np.isin(lbl, list(border))

foreground = ~background
# preenche buraquinhos internos do recorte (ruído)
foreground = ndimage.binary_fill_holes(foreground)
# encolhe 1px pra cortar a franja cinza anti-aliased da borda do xadrez
foreground = ndimage.binary_erosion(foreground, iterations=1)

alpha = foreground.astype(np.float32)
# suaviza a borda
alpha = ndimage.gaussian_filter(alpha, sigma=0.8)
alpha = np.clip(alpha, 0, 1)
alpha_u8 = (alpha * 255).astype(np.uint8)

out = np.dstack([arr.astype(np.uint8), alpha_u8])

# autocrop ao bounding box do alpha (>10) com uma folga
ys, xs = np.where(alpha_u8 > 10)
pad = 12
y0, y1 = max(0, ys.min() - pad), min(out.shape[0], ys.max() + pad)
x0, x1 = max(0, xs.min() - pad), min(out.shape[1], xs.max() + pad)
out = out[y0:y1, x0:x1]

Image.fromarray(out, "RGBA").save(OUT)
print(f"OK -> {OUT}  size={out.shape[1]}x{out.shape[0]}  fg%={100*foreground.mean():.1f}")
