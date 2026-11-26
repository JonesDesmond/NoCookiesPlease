#!/usr/bin/env python3
"""Generate the NoCookiesPlease toolbar icons (cookie with a red prohibition
slash) as PNG files using only the standard library. Run from the repo root:

    python3 tools/gen_icons.py
"""

import math
import os
import struct
import zlib

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4

COOKIE = (219, 178, 122, 255)
CHIP = (110, 74, 40, 255)
RED = (198, 40, 40, 255)
TRANSPARENT = (0, 0, 0, 0)

CX = CY = 0.5
COOKIE_R = 0.40
RING_W = 0.055
CHIP_R = 0.055
CHIPS = [(0.40, 0.44), (0.60, 0.38), (0.66, 0.60), (0.46, 0.68), (0.56, 0.54)]
BAR_W = 0.085
AX, AY, BX, BY = 0.24, 0.76, 0.76, 0.24


def dist_seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def pixel(x, y):
    d = math.hypot(x - CX, y - CY)
    if abs(d - COOKIE_R) < RING_W:
        return RED
    if d < COOKIE_R:
        if dist_seg(x, y, AX, AY, BX, BY) < BAR_W:
            return RED
        for chx, chy in CHIPS:
            if math.hypot(x - chx, y - chy) < CHIP_R:
                return CHIP
        return COOKIE
    return TRANSPARENT


def render(size):
    s = SUPERSAMPLE
    rows = []
    for j in range(size):
        row = []
        for i in range(size):
            r = g = b = a = 0
            for sj in range(s):
                for si in range(s):
                    p = pixel((i + (si + 0.5) / s) / size, (j + (sj + 0.5) / s) / size)
                    r += p[0]
                    g += p[1]
                    b += p[2]
                    a += p[3]
            k = s * s
            row.append((r // k, g // k, b // k, a // k))
        rows.append(row)
    return rows


def chunk(tag, data):
    out = struct.pack(">I", len(data)) + tag + data
    out += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return out


def write_png(path, size, rows):
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("4B", *px) for px in row) for row in rows
    )
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs("icons", exist_ok=True)
    for size in SIZES:
        path = f"icons/icon-{size}.png"
        write_png(path, size, render(size))
        print("wrote", path)


if __name__ == "__main__":
    main()
