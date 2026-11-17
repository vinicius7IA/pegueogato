"""Trilhas originais do BAHIA STRETAT: arcade retrô + percussão baiana (samba-reggae, pagode, axé)."""
import numpy as np

from dsp import SR, bandpass, drive, env_adsr, env_exp, glide, highpass, lowpass, noise, note_freq, osc, place, reverb, rng


# ------------------------------------------------------------ instrumentos
def kick():
    d = 0.32
    return drive(osc(glide(160, 42, d), d) * env_exp(d, 0.13), 1.6)


def snare(bright=1.0):
    d = 0.2
    return highpass(noise(d), 900 * bright) * env_exp(d, 0.07) * 0.8 + osc(glide(240, 170, d), d) * env_exp(d, 0.05) * 0.5


def hat(open_=False):
    d = 0.18 if open_ else 0.05
    return highpass(noise(d), 7000) * env_exp(d, 0.08 if open_ else 0.015) * 0.45


def surdo(low=True):
    d = 0.5
    f0, f1 = (95, 52) if low else (125, 70)
    return osc(glide(f0, f1, d), d) * env_exp(d, 0.22) * 1.1 + lowpass(noise(d), 400) * env_exp(d, 0.03) * 0.3


def repique():
    d = 0.12
    return osc(glide(420, 260, d), d) * env_exp(d, 0.04) * 0.6 + bandpass(noise(d), 1500, 5000) * env_exp(d, 0.02) * 0.5


def agogo(high=True):
    d = 0.25
    f = 1180 if high else 880
    return (osc(f, d) + 0.5 * osc(f * 2.76, d)) * env_exp(d, 0.08) * 0.28


def shaker():
    d = 0.07
    return bandpass(noise(d), 4500, 9500) * env_adsr(d, 0.015, 0.02, 0.5, 0.03) * 0.3


def clap():
    d = 0.2
    out = np.zeros(int(d * SR))
    for k in range(3):
        place(out, bandpass(noise(0.04), 900, 4000) * env_exp(0.04, 0.01), k * 0.009)
    place(out, bandpass(noise(0.15), 900, 4000) * env_exp(0.15, 0.05), 0.027)
    return out * 0.7


def bass_note(n, dur, cutoff=700):
    f = note_freq(n)
    x = osc(f, dur, "saw") * 0.6 + osc(f / 2, dur, "square") * 0.3
    return lowpass(x, cutoff) * env_adsr(dur, 0.004, 0.08, 0.7, 0.05)


def lead_note(n, dur, kind="pulse25", vib=True):
    t = np.arange(int(dur * SR)) / SR
    f = note_freq(n) * (1 + (0.006 * np.sin(2 * np.pi * 6 * t) * np.clip((t - 0.12) * 4, 0, 1) if vib else 0))
    x = osc(f, dur, kind) * 0.5 + osc(f * 1.003, dur, "saw") * 0.25
    return lowpass(x, 5200) * env_adsr(dur, 0.006, 0.06, 0.75, min(0.06, dur * 0.3))


def pad_chord(notes, dur):
    x = np.zeros(int(dur * SR))
    for n in notes:
        for det in (-0.004, 0.0, 0.005):
            x += osc(note_freq(n) * (1 + det), dur, "saw")
    return lowpass(x / (len(notes) * 3), 1800) * env_adsr(dur, 0.12, 0.2, 0.8, 0.3) * 0.5


def stab(notes, dur=0.18):
    x = np.zeros(int(dur * SR))
    for n in notes:
        x += osc(note_freq(n), dur, "saw") + osc(note_freq(n) * 1.006, dur, "square") * 0.5
    return bandpass(x / len(notes), 500, 3500) * env_exp(dur, 0.07) * 0.6


# ------------------------------------------------------------ sequenciador
class Song:
    def __init__(self, bpm, bars, swing=0.0):
        self.bpm = bpm
        self.bars = bars
        self.step = 60 / bpm / 4  # semicolcheia
        self.length = bars * 16 * self.step
        self.tail = 2.0
        self.buf = np.zeros(int((self.length + self.tail) * SR))
        self.swing = swing

    def t(self, step):
        s = step * self.step
        if step % 2 == 1:
            s += self.swing * self.step
        return s

    def hit(self, step, sound, gain=1.0):
        place(self.buf, sound * gain, self.t(step))

    def render(self, peak=0.85, verb=0.12):
        x = reverb(self.buf, 1.0, verb)[: len(self.buf)]
        n = int(self.length * SR)
        tail = x[n:]
        loop = x[:n].copy()
        loop[: len(tail)] += tail  # emenda a cauda no começo: loop sem corte
        loop = drive(loop / (np.max(np.abs(loop)) + 1e-9) * 1.1, 1.3)
        return loop / (np.max(np.abs(loop)) + 1e-9) * peak


def chord_notes(root, minor):
    return [root, root + (3 if minor else 4), root + 7]


def arrange_drums_sambareggae(s, bar, intensity=1.0):
    b = bar * 16
    # surdos (assinatura do samba-reggae), caixa nos contratempos, repique e agogô
    s.hit(b + 0, surdo(True), 0.9)
    s.hit(b + 8, surdo(False), 0.8)
    s.hit(b + 6, surdo(True), 0.5)
    s.hit(b + 14, surdo(False), 0.45)
    for k in (2, 6, 10, 14):
        s.hit(b + k, snare(1.2), 0.35 * intensity)
    for k in (3, 7, 11, 13, 15):
        s.hit(b + k, repique(), 0.4 * intensity)
    for k, hi in ((0, True), (3, False), (6, True), (8, True), (11, False), (14, True)):
        s.hit(b + k, agogo(hi), 0.7)
    for k in range(16):
        s.hit(b + k, shaker(), 0.6 if k % 2 else 0.35)


def arrange_drums_arcade(s, bar, fill=False):
    b = bar * 16
    for k in (0, 6, 8, 10):
        s.hit(b + k, kick(), 1.0)
    for k in (4, 12):
        s.hit(b + k, snare(), 0.8)
    for k in range(0, 16, 2):
        s.hit(b + k, hat(k % 4 == 2), 0.6)
    if fill:
        for k in (12, 13, 14, 15):
            s.hit(b + k, snare(1.3), 0.5 + 0.1 * (k - 12))
    s.hit(b + 2, agogo(True), 0.5)
    s.hit(b + 7, agogo(False), 0.4)


def arrange_drums_pagode(s, bar):
    b = bar * 16
    for k in (0, 7, 10):
        s.hit(b + k, kick(), 0.9)
    for k in (4, 12):
        s.hit(b + k, clap(), 0.8)
    for k in range(16):
        s.hit(b + k, shaker(), 0.7 if k % 2 else 0.3)
    for k in (3, 6, 11, 14):
        s.hit(b + k, repique(), 0.5)
    s.hit(b + 0, surdo(True), 0.5)
    s.hit(b + 8, surdo(False), 0.4)


def arrange_drums_axe(s, bar):
    b = bar * 16
    for k in (0, 4, 8, 12):
        s.hit(b + k, kick(), 1.0)
    for k in (4, 12):
        s.hit(b + k, clap(), 0.7)
    for k in range(2, 16, 4):
        s.hit(b + k, hat(True), 0.5)
    for k in (3, 6, 10, 13):
        s.hit(b + k, repique(), 0.45)
    s.hit(b + 0, surdo(True), 0.6)


def play_bass(s, bar, root, pattern, cutoff=700):
    b = bar * 16
    for step, off, length in pattern:
        s.hit(b + step, bass_note(root + off, length * s.step, cutoff), 0.7)


def play_melody(s, start_bar, melody, kind="pulse25", gain=0.5):
    for step, n, length in melody:
        s.hit(start_bar * 16 + step, lead_note(n, length * s.step, kind), gain)


# ------------------------------------------------------------ faixas
def menu_theme():
    """Tema principal: arcade enérgico em Lá menor com percussão baiana."""
    s = Song(150, 24)
    prog = [(57, True), (53, False), (55, False), (52, True)]  # Am F G Em
    bass_pat = [(0, -12, 3), (3, -12, 1), (4, 0, 2), (6, -12, 2), (8, -12, 3), (11, -5, 1), (12, 0, 2), (14, -2, 2)]
    motif_a = [(0, 69, 3), (3, 72, 3), (6, 76, 2), (8, 74, 3), (11, 72, 1), (12, 71, 4)]
    motif_b = [(0, 72, 2), (2, 74, 2), (4, 76, 4), (8, 79, 3), (11, 77, 1), (12, 76, 2), (14, 74, 2)]
    motif_c = [(0, 76, 6), (6, 74, 2), (8, 72, 4), (12, 69, 4)]
    for bar in range(24):
        root, minor = prog[bar % 4]
        arrange_drums_arcade(s, bar, fill=(bar % 8 == 7))
        if bar >= 4:
            arrange_drums_sambareggae(s, bar, 0.6)
        play_bass(s, bar, root - 12, bass_pat)
        s.hit(bar * 16, pad_chord([n + 12 for n in chord_notes(root, minor)], 16 * s.step), 0.5)
        if bar >= 4:
            m = [motif_a, motif_b, motif_a, motif_c][(bar - 4) % 4]
            octave = 12 if 12 <= bar < 20 else 0  # refrão uma oitava acima
            play_melody(s, bar, [(st, n + octave, ln) for st, n, ln in m], gain=0.5 if octave else 0.55)
        if 12 <= bar < 20:
            for k in (0, 3, 6, 10):
                s.hit(bar * 16 + k, stab([n + 12 for n in chord_notes(root, minor)]), 0.5)
    return s.render()


def select_theme():
    s = Song(124, 12)
    prog = [(50, True), (55, False), (57, True), (53, False)]  # Dm G Am F
    arp = [0, 7, 12, 7, 3, 7, 12, 15]
    for bar in range(12):
        root, minor = prog[bar % 4]
        arrange_drums_axe(s, bar)
        play_bass(s, bar, root - 12, [(0, 0, 2), (4, 0, 2), (8, 0, 2), (10, 7, 2), (12, 0, 2), (14, 12, 2)])
        for k in range(16):
            n = root + 12 + (arp[k % 8] if minor else [0, 7, 12, 7, 4, 7, 12, 16][k % 8])
            s.hit(bar * 16 + k, lead_note(n, s.step * 0.9, "square", vib=False), 0.18)
    return s.render(0.8)


def stage_farol():
    """Farol da Barra: samba-reggae ensolarado em Ré maior."""
    s = Song(108, 16)
    prog = [(62, False), (59, True), (55, False), (57, False)]  # D Bm G A
    melody = [
        [(0, 74, 2), (2, 76, 2), (4, 78, 4), (8, 81, 2), (10, 78, 2), (12, 76, 4)],
        [(0, 74, 3), (3, 71, 3), (6, 74, 2), (8, 76, 6), (14, 74, 2)],
        [(0, 79, 2), (2, 78, 2), (4, 76, 2), (6, 74, 2), (8, 76, 4), (12, 71, 4)],
        [(0, 73, 4), (4, 76, 4), (8, 81, 4), (12, 78, 4)],
    ]
    for bar in range(16):
        root, minor = prog[bar % 4]
        arrange_drums_sambareggae(s, bar, 1.0)
        play_bass(s, bar, root - 24, [(0, 0, 3), (3, 7, 1), (6, 0, 2), (8, 12, 2), (10, 7, 2), (14, 5, 2)], 600)
        s.hit(bar * 16, pad_chord([n + 12 for n in chord_notes(root - 12, minor)], 16 * s.step), 0.35)
        if bar >= 4:
            play_melody(s, bar, melody[bar % 4], "tri", 0.6)
    return s.render(0.8)


def stage_favela():
    """Favela: groove de pagode baiano com swing e metais sintéticos, Mi menor."""
    s = Song(128, 20, swing=0.22)
    prog = [(52, True), (52, True), (60, False), (59, False)]  # Em Em C B
    hook = [(0, 76, 1), (2, 76, 1), (3, 79, 2), (6, 76, 1), (8, 74, 2), (10, 71, 2), (12, 74, 3)]
    for bar in range(20):
        root, minor = prog[bar % 4]
        arrange_drums_pagode(s, bar)
        play_bass(s, bar, root - 24, [(0, 0, 2), (3, 0, 1), (6, 12, 1), (7, 10, 1), (8, 7, 2), (11, 0, 1), (14, 3, 2)], 800)
        for k in (2, 6, 10, 14):
            s.hit(bar * 16 + k, stab([n + 12 for n in chord_notes(root, minor)], 0.12), 0.45)
        if bar >= 4 and bar % 2 == 0:
            play_melody(s, bar, hook, "pulse25", 0.5)
    return s.render(0.8, 0.08)


def stage_shopping():
    """Shopping: axé/eletrônico brilhante, Sol maior, quatro no chão."""
    s = Song(126, 18)
    prog = [(55, False), (59, True), (60, False), (62, False)]  # G Bm C D
    lead = [(0, 79, 2), (2, 83, 2), (4, 86, 2), (6, 83, 2), (8, 84, 4), (12, 81, 4)]
    lead2 = [(0, 83, 3), (3, 81, 1), (4, 79, 4), (8, 76, 2), (10, 78, 2), (12, 79, 4)]
    for bar in range(18):
        root, minor = prog[bar % 4]
        arrange_drums_axe(s, bar)
        play_bass(s, bar, root - 24, [(0, 0, 2), (2, 12, 1), (4, 0, 2), (6, 12, 1), (8, 0, 2), (10, 12, 1), (12, 7, 2), (14, 12, 1)], 900)
        s.hit(bar * 16, pad_chord([n + 12 for n in chord_notes(root, minor)], 16 * s.step), 0.4)
        if bar >= 2:
            play_melody(s, bar, lead if bar % 2 == 0 else lead2, "square", 0.42)
    return s.render(0.8)


def victory_jingle():
    s = Song(140, 3)
    seq = [(0, 72, 2), (2, 76, 2), (4, 79, 2), (6, 84, 6), (12, 83, 2), (14, 84, 2), (16, 88, 12)]
    for st, n, ln in seq:
        s.hit(st, lead_note(n, ln * s.step, "pulse25"), 0.6)
        s.hit(st, lead_note(n - 12, ln * s.step, "square", vib=False), 0.25)
    for k in (0, 4, 6, 16):
        s.hit(k, kick(), 0.8)
    s.hit(16, pad_chord([60, 64, 67, 72], 24 * s.step), 0.6)
    s.hit(16, surdo(True), 0.9)
    s.hit(20, agogo(True), 0.7)
    s.hit(22, agogo(False), 0.7)
    return s.render(0.85, 0.2)


def defeat_jingle():
    s = Song(84, 3)
    seq = [(0, 69, 4), (4, 68, 4), (8, 67, 4), (12, 66, 8), (20, 64, 16)]
    for st, n, ln in seq:
        s.hit(st, lead_note(n, ln * s.step, "tri"), 0.6)
    s.hit(0, pad_chord([57, 60, 64], 16 * s.step), 0.4)
    s.hit(16, pad_chord([52, 55, 59], 24 * s.step), 0.45)
    s.hit(20, surdo(True), 0.7)
    return s.render(0.8, 0.3)
