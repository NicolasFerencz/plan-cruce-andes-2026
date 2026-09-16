#!/usr/bin/env python3
"""Genera los íconos (dos cumbres) sin dependencias externas."""
import zlib, struct

BG   = (0x1b, 0x4d, 0x6b)
SNOW = (0xf2, 0xf2, 0xee)
HAZE = (0x5f, 0x93, 0xb5)

def png(path, size, scale=1.0):
    cx, cy = 0.5, 0.52
    def tri(px, py, a, b, c):
        def side(p, q, r):
            return (p[0]-r[0])*(q[1]-r[1]) - (q[0]-r[0])*(p[1]-r[1])
        p = (px, py)
        d1, d2, d3 = side(p,a,b), side(p,b,c), side(p,c,a)
        return not (((d1<0) or (d2<0) or (d3<0)) and ((d1>0) or (d2>0) or (d3>0)))
    s = lambda pt: (cx + (pt[0]-cx)*scale, cy + (pt[1]-cy)*scale)
    back  = [s((0.70,0.34)), s((0.40,0.80)), s((1.00,0.80))]
    front = [s((0.36,0.22)), s((0.02,0.80)), s((0.70,0.80))]
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        fy = (y + 0.5) / size
        for x in range(size):
            fx = (x + 0.5) / size
            rows += bytes(SNOW if tri(fx,fy,*front) else HAZE if tri(fx,fy,*back) else BG)
    ch = lambda t,d: struct.pack(">I",len(d)) + t + d + struct.pack(">I", zlib.crc32(t+d) & 0xffffffff)
    open(path,"wb").write(b"\x89PNG\r\n\x1a\n"
        + ch(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + ch(b"IDAT", zlib.compress(bytes(rows), 9)) + ch(b"IEND", b""))
    print(path, size)

png("icon-192.png", 192)
png("icon-512.png", 512)
png("icon-512-maskable.png", 512, scale=0.68)
png("apple-touch-icon.png", 180)
png("favicon-32.png", 32)
