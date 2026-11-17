"""Efeitos sonoros originais (síntese). Cada função recebe `v` (variação) para soar diferente."""
import numpy as np

from dsp import (
    SR, bandpass, drive, env_exp, env_adsr, fade, glide, highpass, lowpass, mix, noise, osc, pink, place, reverb,
    silence, sweep_bandpass, rng,
)


def _thump(f0, f1, dur, decay):
    return osc(glide(f0, f1, dur), dur) * env_exp(dur, decay, 0.001)


def whoosh(dur=0.22, f0=500, f1=2600, v=0):
    x = sweep_bandpass(noise(dur), f0 * (1 + 0.08 * v), f1 * (1 - 0.05 * v), q=3)
    e = np.sin(np.linspace(0, np.pi, len(x))) ** 1.5
    return fade(x * e * 1.4)


# ---------------------------------------------------------------- combate
def punch_light(v):
    d = 0.16
    crack = bandpass(noise(d), 1500 + 300 * v, 4800) * env_exp(d, 0.012)
    body = _thump(170 + 15 * v, 75, d, 0.045)
    air = whoosh(0.09, 900, 2400, v) * 0.35
    return fade(mix(air, place(silence(d + 0.05), crack * 0.9 + body * 0.9, 0.04)))


def punch_heavy(v):
    d = 0.38
    boom = _thump(120 + 10 * v, 42, d, 0.11) * 1.2
    crack = highpass(noise(d), 1800) * env_exp(d, 0.02)
    mid = bandpass(noise(d), 300, 1200) * env_exp(d, 0.05)
    air = whoosh(0.16, 400, 2000, v) * 0.45
    hit = drive(boom + crack * 0.7 + mid * 0.6, 2.2)
    return fade(mix(air, place(silence(d + 0.12), hit, 0.1)))


def kick_light(v):
    d = 0.2
    air = whoosh(0.12, 600, 3000, v) * 0.5
    body = _thump(130 + 12 * v, 60, d, 0.06)
    snap = bandpass(noise(d), 900, 3500) * env_exp(d, 0.018)
    return fade(mix(air, place(silence(d + 0.08), body + snap * 0.6, 0.07)))


def kick_heavy(v):
    d = 0.45
    air = whoosh(0.22, 300, 2600, v) * 0.6
    boom = _thump(95 + 8 * v, 35, d, 0.14) * 1.3
    slap = highpass(noise(d), 1200) * env_exp(d, 0.03)
    hit = drive(boom + slap * 0.8, 2.6)
    return fade(mix(air, place(silence(d + 0.18), hit, 0.16)))


def hit_face(v):
    d = 0.22
    smack = highpass(noise(d), 2200 - 200 * v) * env_exp(d, 0.016) * 1.2
    skin = _thump(240 + 20 * v, 120, d, 0.04)
    sting = osc(3200 + 300 * v, d) * env_exp(d, 0.01) * 0.15
    return fade(drive(smack + skin + sting, 1.8))


def hit_body(v):
    d = 0.3
    thud = lowpass(noise(d), 700) * env_exp(d, 0.05) * 1.6
    low = _thump(80 + 6 * v, 45, d, 0.09) * 1.2
    return fade(drive(thud + low, 2.0))


def block(v):
    d = 0.3
    clack = bandpass(noise(d), 700, 2600) * env_exp(d, 0.02)
    ring = (osc(620 + 40 * v, d) + 0.6 * osc(930 + 50 * v, d)) * env_exp(d, 0.07) * 0.35
    low = _thump(150, 90, d, 0.03) * 0.6
    return fade(clack + ring + low)


def dodge(v):
    return whoosh(0.28, 350 + 50 * v, 3200, v) * 1.1


def jump(v):
    up = whoosh(0.2, 300, 1600 + 200 * v, v) * 0.8
    cloth = bandpass(noise(0.2), 1500, 5000) * env_exp(0.2, 0.05) * 0.25
    return fade(mix(up, cloth))


def land(v):
    d = 0.25
    thud = _thump(90 + 10 * v, 50, d, 0.06)
    grit = bandpass(noise(d), 300, 2500) * env_exp(d, 0.04) * 0.5
    return fade(thud + grit)


def fall(v):
    d = 0.7
    slam = drive(_thump(70 + 6 * v, 32, d, 0.18) * 1.4 + lowpass(noise(d), 900) * env_exp(d, 0.08), 2.4)
    bounce = _thump(90, 50, 0.2, 0.05) * 0.5 + lowpass(noise(0.2), 1200) * env_exp(0.2, 0.03) * 0.4
    out = silence(1.0)
    place(out, slam, 0)
    place(out, bounce, 0.28 + 0.02 * v)
    return fade(out)


def getup(v):
    d = 0.5
    rust = bandpass(noise(d), 1200, 5000) * (0.5 + 0.5 * np.sin(np.linspace(0, 9 + v, int(d * SR)))) * env_adsr(d, 0.05, 0.1, 0.6, 0.2)
    step = _thump(110, 70, 0.12, 0.03)
    out = silence(0.6)
    place(out, rust * 0.5, 0)
    place(out, step, 0.38)
    return fade(out)


def special_charge(v):
    d = 0.7
    rise = osc(glide(180, 900 + 100 * v, d), d, "saw") * env_adsr(d, 0.05, 0.1, 0.8, 0.15)
    rise = lowpass(rise, 3500)
    shimmer = highpass(noise(d), 4000) * np.linspace(0.05, 0.4, int(d * SR))
    return fade(rise * 0.5 + shimmer)


def special_impact(v):
    d = 1.1
    boom = _thump(80 + 10 * v, 28, d, 0.3) * 1.5
    blast = lowpass(noise(d), 2500) * env_exp(d, 0.18)
    ring = osc(glide(1200, 300, d), d) * env_exp(d, 0.2) * 0.2
    return fade(reverb(drive(boom + blast + ring, 2.4), 1.0, 0.25)[: int(1.3 * SR)])


def special_whoosh(v):
    return mix(whoosh(0.45, 200, 4000, v) * 1.2, osc(glide(300, 1400, 0.45), 0.45, "tri") * env_exp(0.45, 0.2) * 0.2)


def cat_swarm(v):
    """Miados rápidos e chiados para o poder dos gatos (sons felinos sintéticos)."""
    out = silence(1.2)
    for i in range(7):
        d = 0.22
        f = glide(700 + 90 * ((i + v) % 4), 420, d)
        meow = osc(f, d, "saw")
        meow = bandpass(meow, 600, 3200) * env_adsr(d, 0.02, 0.05, 0.6, 0.1)
        place(out, meow * 0.5, 0.1 * i + rng.uniform(0, 0.03))
    hiss = highpass(noise(1.2), 3000) * env_adsr(1.2, 0.1, 0.2, 0.3, 0.4) * 0.25
    return fade(out + hiss)


def combo(v):
    notes = [72, 76, 79, 84][: 3 + (v % 2)]
    out = silence(0.5)
    for i, n in enumerate(notes):
        f = 440 * 2 ** ((n + v - 69) / 12)
        tone = osc(f, 0.12, "square") * env_exp(0.12, 0.05) * 0.4
        place(out, lowpass(tone, 6000), i * 0.06)
    return fade(out)


def ko_impact(v):
    d = 2.2
    boom = _thump(60, 22, d, 0.6) * 1.6
    crash = lowpass(noise(d), 3000) * env_exp(d, 0.35)
    return fade(reverb(drive(boom + crash, 3.0), 2.2, 0.35)[: int(2.6 * SR)], fout=0.4)


def round_bell(v):
    d = 1.6
    tone = sum(osc(f * (1 + 0.002 * v), d) * a for f, a in [(880, 1), (1760 * 1.01, 0.5), (2640 * 0.99, 0.3), (1320, 0.4)])
    clang = highpass(noise(d), 3000) * env_exp(d, 0.01)
    return fade((tone * env_exp(d, 0.45) + clang * 0.4) * 0.4, fout=0.3)


# ---------------------------------------------------------------- interface
def ui_nav(v):
    return fade(lowpass(osc(880 + 60 * v, 0.05, "square"), 5000) * env_exp(0.05, 0.02) * 0.4)


def ui_select(v):
    out = silence(0.16)
    place(out, osc(660, 0.06, "square") * env_exp(0.06, 0.03) * 0.35, 0)
    place(out, osc(990, 0.08, "square") * env_exp(0.08, 0.04) * 0.35, 0.05)
    return fade(lowpass(out, 6000))


def ui_confirm(v):
    out = silence(0.5)
    for i, n in enumerate([60, 64, 67, 72]):
        place(out, osc(440 * 2 ** ((n + 12 - 69) / 12), 0.14, "pulse25") * env_exp(0.14, 0.07) * 0.3, i * 0.05)
    out += highpass(noise(0.5), 5000) * env_exp(0.5, 0.15) * 0.08
    return fade(lowpass(out, 7000))


def ui_back(v):
    out = silence(0.18)
    place(out, osc(700, 0.07, "square") * env_exp(0.07, 0.03) * 0.3, 0)
    place(out, osc(440, 0.09, "square") * env_exp(0.09, 0.04) * 0.3, 0.06)
    return fade(lowpass(out, 5000))


def ui_unlock(v):
    out = silence(1.0)
    for i, n in enumerate([72, 76, 79, 84, 88, 91]):
        place(out, osc(440 * 2 ** ((n - 69) / 12), 0.3, "tri") * env_exp(0.3, 0.15) * 0.3, i * 0.07)
    out += highpass(noise(1.0), 6000) * env_adsr(1.0, 0.2, 0.2, 0.4, 0.5) * 0.12
    return fade(reverb(out, 0.8, 0.25)[: int(1.4 * SR)])


def ui_transition(v):
    return whoosh(0.4, 200, 5000, v) * 0.9


def ui_locked(v):
    return fade(lowpass(osc(110, 0.22, "square") * env_adsr(0.22, 0.005, 0.05, 0.8, 0.05), 1200) * 0.4)


# ---------------------------------------------------------------- torcida (base sintética)
def murmur(dur, density=1.0, bright=1.0):
    """Burburinho de multidão: muitas 'sílabas' de ruído formantado."""
    out = np.zeros(int(dur * SR))
    n = int(dur * 18 * density)
    for _ in range(n):
        d = rng.uniform(0.08, 0.22)
        f = rng.uniform(350, 1400) * bright
        syl = bandpass(noise(d), f * 0.7, f * 1.5) * np.sin(np.linspace(0, np.pi, int(d * SR))) ** 2
        place(out, syl * rng.uniform(0.2, 0.6), rng.uniform(0, dur - d))
    return lowpass(out, 3500 * bright) * 0.8


def crowd_cheer(v):
    d = 2.6
    swell = env_adsr(d, 0.25, 0.4, 0.75, 1.2)
    roar = bandpass(pink(d), 300, 3500) * swell
    voices = murmur(d, 2.5, 1.2) * swell
    whistle = osc(glide(2200, 2900 + 100 * v, 0.3), 0.3) * env_adsr(0.3, 0.02, 0.05, 0.7, 0.1) * 0.15
    out = roar * 0.8 + voices
    place(out, whistle, 0.4 + 0.2 * v)
    return fade(out, 0.05, 0.6)


def crowd_gasp(v):
    d = 1.0
    shape = env_adsr(d, 0.04, 0.2, 0.4, 0.5)
    return fade(bandpass(pink(d), 500, 2800) * shape * 1.2 + murmur(d, 1.5) * shape, 0.02, 0.3)


def dog_bark(v):
    out = silence(0.8)
    for i in range(2 + v % 2):
        d = 0.16
        f = glide(520 + 40 * v, 300, d)
        bark = bandpass(osc(f, d, "saw") + noise(d) * 0.5, 350, 2400) * env_exp(d, 0.06)
        place(out, drive(bark, 2), 0.22 * i)
    return fade(out)


def motorbike(v):
    d = 3.0
    rpm = glide(55, 85, d / 2, "lin")
    rpm = np.concatenate([rpm, glide(85, 50, d / 2, "lin")])
    eng = osc(rpm, d, "saw") + 0.5 * osc(rpm * 2.01, d, "square")
    amp = np.sin(np.linspace(0, np.pi, int(d * SR)))
    return fade(lowpass(drive(eng, 2), 1800) * amp * 0.5, 0.1, 0.4)


def seagull(v):
    out = silence(0.9)
    for i in range(2 + v % 2):
        d = 0.22
        f = np.concatenate([glide(1400, 2100, d * 0.4), glide(2100, 1200, d * 0.6)])
        call = osc(f, d, "tri") * env_adsr(d, 0.01, 0.05, 0.7, 0.08)
        place(out, bandpass(call, 900, 4000) * 0.4, 0.26 * i)
    return fade(out)


def wave_wash(dur):
    x = lowpass(pink(dur), 1200)
    lfo = 0.55 + 0.45 * np.sin(2 * np.pi * np.arange(len(x)) / SR * 0.12 - np.pi / 2)
    return x * lfo


def wind(dur):
    x = bandpass(pink(dur), 400, 2500)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * np.arange(len(x)) / SR * 0.05)
    return x * lfo * 0.5


def footsteps(dur, rate=2.2):
    out = np.zeros(int(dur * SR))
    t = 0.0
    while t < dur - 0.1:
        d = 0.06
        step = highpass(noise(d), 1500) * env_exp(d, 0.012) * rng.uniform(0.2, 0.5)
        place(out, step, t)
        t += rng.uniform(0.4, 0.9) / rate
    return out


def door_slide(v):
    d = 1.3
    hum = lowpass(osc(glide(90, 140, d), d, "saw"), 600) * env_adsr(d, 0.1, 0.2, 0.6, 0.4) * 0.3
    air = whoosh(1.0, 200, 1500, v) * 0.5
    chime = osc(1568, 0.5) * env_exp(0.5, 0.2) * 0.2
    out = mix(hum, air)
    place(out, chime, 0.05)
    return fade(out)


def pa_chime(v):
    out = silence(1.6)
    for i, f in enumerate([784, 659, 523]):
        tone = (osc(f, 0.6) + 0.3 * osc(f * 2, 0.6)) * env_exp(0.6, 0.35) * 0.35
        place(out, tone, i * 0.35)
    return fade(reverb(out, 1.2, 0.3)[: int(2.0 * SR)])
