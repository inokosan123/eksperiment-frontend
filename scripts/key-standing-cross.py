import os
from PIL import Image

SRC = r"C:\Users\User\Downloads\ChatGPT Image Jul 30, 2026, 03_49_22 PM.png"
OUT = "assets/images/prayer/standing-cross.png"

im = Image.open(SRC).convert("RGBA")
px = im.load()
w, h = im.size
kr, kg, kb = px[2, 2][:3]

# ⚠ THE THRESHOLD IS 75% OF THE KEY'S OWN DOMINANCE, NOT 100%.
#
# The flat green is not flat: the generator left compression noise in it,
# so corner pixels come out at (24, 224, 36) against a key of
# (8, 234, 25). At a full-strength divisor those score 0.9 and survive at
# alpha 26 — invisible, and enough to defeat the crop, which would have
# shipped the whole empty margin as transparent pixels the GPU still has
# to composite. Three-quarters saturates every shade of the key while
# staying clear of the wood, which is warm and scores at or below zero.
key_dom = (kg - max(kr, kb)) * 0.75

out = Image.new("RGBA", (w, h))
op = out.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        # How much this pixel is the key: not distance-to-key, which eats
        # the cross's own warm tones at the rim, but how far GREEN stands
        # above the larger of the other two channels. Wood scores at or
        # below zero, the key scores 1, and the antialiased rim in
        # between — which is exactly the alpha it should be given.
        k = max(0.0, min(1.0, (g - max(r, b)) / key_dom))
        alpha = int(round(a * (1.0 - k)))
        if alpha <= 6:
            op[x, y] = (0, 0, 0, 0)
            continue

        # ⚠ SPILL SUPPRESSION, IN TWO PASSES, AND THE SECOND IS NOT
        # OPTIONAL.
        #
        # The first pass removes the key's contribution in proportion to
        # how much key was there. It leaves the outline's own dark rim
        # untouched — and that rim is where the source blended dark wood
        # WITH green before this image ever reached us: pixels around
        # (40, 78, 15) at half alpha, olive rather than green, scoring
        # only 0.25 on the measure above and so barely corrected. Against
        # warm paper a one-pixel olive outline reads as exactly the green
        # fringe all of this exists to prevent.
        #
        # So anything still green-dominant afterwards is flattened
        # outright. Nothing in a brown-and-cream cross is legitimately
        # greener than its own red and blue, so there is nothing here to
        # lose.
        if g > max(r, b):
            g = int(g - (g - max(r, b)) * k)
        if g > max(r, b):
            g = max(r, b)
        op[x, y] = (r, g, b, alpha)

out = out.crop(out.getbbox())

# ⚠ NOT RESIZED. The cross is drawn at most 380 points tall, so this
# covers a 3x screen as it stands. Downscaling RGBA needs premultiplied
# alpha, or the resampler averages the RGB of the pixels this key just
# cleared back into their visible neighbours — a first attempt put 581
# green pixels along the rim. Not resizing is both cheaper and correct.
out.save(OUT, optimize=True)
print("saved", out.size, os.path.getsize(OUT), "bytes")
print("ASPECT (w/h) =", round(out.size[0] / out.size[1], 5))

p = out.load()
worst = 0
for y in range(out.size[1]):
    for x in range(out.size[0]):
        r, g, b, a = p[x, y]
        if a > 0:
            worst = max(worst, g - max(r, b))
print("worst green dominance anywhere visible:", worst)
