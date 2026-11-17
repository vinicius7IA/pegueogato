"""Blocos de síntese sonora (numpy/scipy) usados pelo gerador de áudio do BAHIA STRETAT."""
import numpy as np
from scipy import signal

SR = 44100
rng = np.random.default_rng(7)


def t_axis(dur, sr=SR):
    return np.arange(int(dur * sr)) / sr


def silence(dur):
    return np.zeros(int(dur * SR))


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def pink(dur):
    n = int(dur * SR)
    white = rng.standard_normal(n)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    p = signal.lfilter(b, a, white)
    return p / (np.max(np.abs(p)) + 1e-9)


def osc(freq, dur, kind="sine", phase=0.0):
    """Oscilador com frequência fixa ou array de frequência (glide)."""
    n = int(dur * SR)
    if np.isscalar(freq):
        f = np.full(n, freq, dtype=float)
    else:
        f = np.asarray(freq, dtype=float)[:n]
        if len(f) < n:  # completa arredondamentos de duração
            f = np.concatenate([f, np.full(n - len(f), f[-1] if len(f) else 440.0)])
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    if kind == "sine":
        return np.sin(ph)
    if kind == "square":
        return np.sign(np.sin(ph))
    if kind == "pulse25":
        return np.where((ph / (2 * np.pi)) % 1 < 0.25, 1.0, -1.0)
    if kind == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == "tri":
        return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    raise ValueError(kind)


def glide(f0, f1, dur, curve="exp"):
    n = int(dur * SR)
    if curve == "exp":
        return f0 * (f1 / f0) ** np.linspace(0, 1, n)
    return np.linspace(f0, f1, n)


def env_exp(dur, decay, attack=0.002):
    t = t_axis(dur)
    e = np.exp(-t / max(decay, 1e-4))
    a = np.clip(t / max(attack, 1e-5), 0, 1)
    return e * a


def env_adsr(dur, a=0.01, d=0.05, s=0.7, r=0.1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / max(a, 1e-5)
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-5)
    rel = t > dur - r
    e[rel] *= np.clip((dur - t[rel]) / max(r, 1e-5), 0, 1)
    return e


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, max(fc, 20) / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [max(lo, 20) / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def sweep_bandpass(x, f0, f1, q=4.0, steps=48):
    """Filtro passa-faixa com centro que varre de f0 a f1 (efeito 'whoosh')."""
    out = np.zeros_like(x)
    seg = max(1, len(x) // steps)
    for i in range(steps):
        s, e = i * seg, len(x) if i == steps - 1 else (i + 1) * seg
        fc = f0 * (f1 / f0) ** (i / max(1, steps - 1))
        lo, hi = fc / (1 + 1 / q), fc * (1 + 1 / q)
        b, a = signal.butter(2, [max(lo, 30) / (SR / 2), min(hi, SR / 2 - 200) / (SR / 2)], "band")
        # processa com sobra para evitar estalos
        s0 = max(0, s - 512)
        y = signal.lfilter(b, a, x[s0:e])
        out[s:e] = y[s - s0 :]
    return out


def drive(x, amount=2.0):
    return np.tanh(x * amount) / np.tanh(amount)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def place(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return buf
    end = min(len(buf), i + len(x))
    buf[i:end] += x[: end - i]
    return buf


def reverb(x, size=1.2, wet=0.25, damp=3500):
    """Reverb simples por convolução com cauda de ruído decaindo."""
    ir_len = int(size * SR)
    ir = rng.standard_normal(ir_len) * np.exp(-np.linspace(0, 6, ir_len))
    ir = lowpass(ir, damp)
    ir /= np.sqrt(np.sum(ir**2)) + 1e-9
    w = signal.fftconvolve(x, ir)[: len(x) + ir_len // 2]
    dry = np.concatenate([x, np.zeros(len(w) - len(x))])
    return dry * (1 - wet) + w * wet


def fade(x, fin=0.003, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def normalize(x, peak=0.89):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def pan_stereo(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], axis=1)


def note_freq(n):
    """Nota MIDI -> Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)
