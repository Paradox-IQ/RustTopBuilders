#!/usr/bin/env python3
"""Generate the OG share preview image (1200x630) for the Rust Builders site.

Cyrillic glyphs aren't in Syne, so we use DejaVu Sans Bold for the title
text and Space Mono for the monospace line. Star (★) is taken from DejaVu.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630
BG = (13, 13, 13)
SURFACE = (20, 20, 20)
ACCENT = (200, 169, 110)
ACCENT_BRIGHT = (232, 200, 142)
TEXT = (240, 240, 240)
MUTED = (140, 140, 140)
MUTED2 = (190, 190, 190)
BORDER = (45, 45, 45)

# DejaVu Sans Bold supports Cyrillic + ★. Use it for everything that has
# Cyrillic text. Use Space Mono for monospace lines (Latin only there).
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
# Space Mono lacks Cyrillic glyphs; DejaVu Sans Mono is Cyrillic-safe.
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# Subtle grid background
for x in range(0, W, 60):
    d.line([(x, 0), (x, H)], fill=(20, 20, 20), width=1)
for y in range(0, H, 60):
    d.line([(0, y), (W, y)], fill=(20, 20, 20), width=1)

# Soft gold glow on the right
glow = Image.new("RGB", (W, H), BG)
gd = ImageDraw.Draw(glow)
for r in range(420, 0, -10):
    alpha = int(8 * (r / 420))
    gd.ellipse([(W - 320 - r, H // 2 - r), (W - 320 + r, H // 2 + r)],
               fill=(BG[0] + alpha, BG[1] + int(alpha * 0.85), BG[2] + int(alpha * 0.55)))
img = Image.blend(img, glow, 0.45)
d = ImageDraw.Draw(img)

# Top-left tag
mono_sm = ImageFont.truetype(MONO, 18)
d.text((60, 50), "// RUST BUILDER DIRECTORY", font=mono_sm, fill=ACCENT)

# Big title — DejaVu (Cyrillic-safe) at large size
sans_xl = ImageFont.truetype(SANS, 92)
d.text((60, 100), "Кто строит", font=sans_xl, fill=TEXT)
d.text((60, 215), "лучшие базы", font=sans_xl, fill=ACCENT_BRIGHT)

# Subtitle
mono_md = ImageFont.truetype(MONO, 22)
d.text((60, 350), "52 builders · 14 patreon · 11 custom · 0.25★ scale",
       font=mono_md, fill=MUTED2)

# Tier strip — show top 4 tiers as pills
sans_md = ImageFont.truetype(SANS, 28)
mono_xs = ImageFont.truetype(MONO, 13)
y_pill = 410
x_pill = 60
tiers = [
    ("5.0★", "ЛУЧШИЙ",         ACCENT_BRIGHT),
    ("4.5★", "ТОП-УРОВЕНЬ",    ACCENT),
    ("4.0★", "ХОРОШИЕ",        (180, 150, 100)),
    ("3.5★", "ВЫШЕ СРЕДНЕГО",  (140, 120, 80)),
]
pill_w = 250
for label, name, col in tiers:
    d.rounded_rectangle([(x_pill, y_pill), (x_pill + pill_w, y_pill + 80)],
                        radius=6, fill=SURFACE, outline=col, width=2)
    d.text((x_pill + 18, y_pill + 10), label, font=sans_md, fill=col)
    d.text((x_pill + 18, y_pill + 52), name, font=mono_xs, fill=MUTED2)
    x_pill += pill_w + 12

# Bottom URL line
d.line([(60, H - 80), (W - 60, H - 80)], fill=BORDER, width=1)
d.text((60, H - 55),
       "paradox-iq.github.io/RustTopBuilders  ·  обновлено май 2026",
       font=mono_sm, fill=MUTED)

# Right-side ★ stack as decoration
sans_huge = ImageFont.truetype(SANS, 240)
sans_big = ImageFont.truetype(SANS, 140)
sans_mdd = ImageFont.truetype(SANS, 90)
d.text((W - 320, 70), "★", font=sans_huge, fill=(80, 65, 35))
d.text((W - 220, 260), "★", font=sans_big, fill=(120, 95, 50))
d.text((W - 150, 380), "★", font=sans_mdd, fill=ACCENT)

out = "/home/ubuntu/RustTopBuilders/assets/og-preview.png"
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, "PNG", optimize=True)
print(f"saved → {out} ({os.path.getsize(out)} bytes)")
