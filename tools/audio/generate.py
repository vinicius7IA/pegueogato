"""
Gera todo o áudio do BAHIA STRETAT em src/assets/audio/ (MP3) + manifesto JSON.

Requisitos: python3 com numpy e scipy, ffmpeg (libmp3lame) e piper-tts com as vozes pt_BR
(faber, cadu e jeff "medium"). Baixe as vozes em https://huggingface.co/rhasspy/piper-voices
(pasta pt/pt_BR) e indique a pasta em VOICES_DIR.

    VOICES_DIR=/caminho/das/vozes python3 tools/audio/generate.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import dsp  # noqa: E402
import music  # noqa: E402
import sfx  # noqa: E402
from dsp import SR, bandpass, fade, highpass, lowpass, normalize, place, reverb  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "src", "assets", "audio")
VOICES = os.environ.get("VOICES_DIR", "/tmp/claude-0/voices")
TMP = tempfile.mkdtemp(prefix="stretat_audio_")
manifest: dict[str, list[str]] = {}

BITRATE = {"music": "80k", "stages": "64k", "default": "80k", "characters": "56k", "announcer": "64k"}


def write_wav(path, x, sr=SR):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def read_wav(path):
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(axis=1)
    if sr != SR:
        # reamostra com ffmpeg para 44.1k
        tmp = os.path.join(TMP, "rs.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ar", str(SR), "-ac", "1", tmp], check=True)
        return read_wav(tmp)
    return data


def export(key, x, peak=0.89):
    """Salva `x` como MP3 em OUT/<key>.mp3 e registra no manifesto (key = 'pasta/nome_variação')."""
    category = key.split("/")[0]
    path = os.path.join(OUT, key + ".mp3")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wav = os.path.join(TMP, "x.wav")
    write_wav(wav, normalize(x, peak))
    br = BITRATE.get(category, BITRATE["default"])
    # loudness por categoria: música e vozes mais "cheias", ambiente como cama de fundo
    loud = {"music": "loudnorm=I=-14:TP=-1.2:LRA=9", "victory": "loudnorm=I=-14:TP=-1.2", "defeat": "loudnorm=I=-15:TP=-1.2",
            "characters": "loudnorm=I=-14:TP=-1.0", "announcer": "loudnorm=I=-13:TP=-1.0", "stages": "loudnorm=I=-18:TP=-1.5"}.get(category)
    af = ["-af", loud] if loud and len(x) > SR * 0.6 else []
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, *af, "-ac", "1", "-ar", "44100" if category == "music" else "32000", "-c:a", "libmp3lame", "-b:a", br, path], check=True)
    group = key.rsplit("_", 1)[0] if key.rsplit("_", 1)[-1].isdigit() else key
    manifest.setdefault(group, []).append(key)
    print("  ", key)


# ------------------------------------------------------------------ vozes (Piper)
def tts(text, voice, length=1.0, noise=0.667):
    model = os.path.join(VOICES, f"pt_BR-{voice}-medium.onnx")
    out = os.path.join(TMP, "tts.wav")
    subprocess.run(
        ["piper", "-m", model, "-f", out, "--length_scale", str(length), "--noise_scale", str(noise), "--sentence_silence", "0.05"],
        input=text.encode("utf-8"),
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


def process_voice(src, pitch=1.0, extra=""):
    """Muda o tom sem mudar a duração e aplica cadeia de efeitos do ffmpeg."""
    out = os.path.join(TMP, "proc.wav")
    filters = f"asetrate=22050*{pitch},aresample=44100,atempo={1 / pitch:.4f}"
    if extra:
        filters += "," + extra
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", filters, "-ac", "1", out], check=True)
    x = read_wav(out)
    # remove silêncio nas pontas
    idx = np.where(np.abs(x) > 0.02)[0]
    if len(idx):
        x = x[max(0, idx[0] - 400) : idx[-1] + 2000]
    return fade(x, 0.005, 0.03)


BETO = dict(voice="faber", pitch=0.84, length=1.05, fx="acompressor=threshold=0.1:ratio=4:attack=5:release=80,bass=g=4,volume=1.4")
MALUCO = dict(voice="jeff", pitch=1.14, length=0.88, fx="acompressor=threshold=0.12:ratio=3:attack=5:release=60,treble=g=3,volume=1.4")
NARRADOR = dict(voice="cadu", pitch=0.9, length=1.12, fx="acompressor=threshold=0.08:ratio=6:attack=3:release=120,bass=g=5,volume=1.8,aecho=0.8:0.6:60|120:0.25|0.12")


def say(key, text, who, shout=False):
    raw = tts(text, who["voice"], who["length"] * (0.92 if shout else 1.0), 0.75 if shout else 0.6)
    x = process_voice(raw, who["pitch"], who["fx"] + (",acrusher=bits=12:mix=0.15" if shout else ""))
    export(key, x)


def chorus(text, voices=("faber", "cadu", "jeff"), pitches=(0.82, 0.9, 1.0, 1.1, 1.22), length=1.1):
    """Coro de torcida: várias vozes, tons e atrasos sobrepostos + burburinho."""
    layers = []
    for v in voices:
        raw = tts(text, v, length, 0.8)
        for p in pitches:
            layers.append(process_voice(raw, p * dsp.rng.uniform(0.97, 1.03)))
    n = max(len(l) for l in layers) + int(0.2 * SR)
    out = np.zeros(n)
    for l in layers:
        place(out, l * dsp.rng.uniform(0.5, 0.9), dsp.rng.uniform(0, 0.09))
    out = bandpass(out, 180, 5000)
    out += sfx.murmur(n / SR, 1.8) * 0.5
    return fade(reverb(out, 1.4, 0.35)[: n + int(0.6 * SR)], 0.02, 0.4)


def megaphone(text, who=MALUCO):
    raw = tts(text, who["voice"], 1.0, 0.7)
    x = process_voice(raw, 1.0, "highpass=f=500,lowpass=f=3200,acrusher=bits=10:mix=0.25,volume=1.6")
    return x


# ------------------------------------------------------------------ geração
def gen_combat():
    print("combate")
    for name, fn, n in [
        ("punch_light", sfx.punch_light, 3), ("punch_heavy", sfx.punch_heavy, 3), ("kick_light", sfx.kick_light, 3),
        ("kick_heavy", sfx.kick_heavy, 3), ("hit_face", sfx.hit_face, 3), ("hit_body", sfx.hit_body, 3),
        ("block", sfx.block, 3), ("dodge", sfx.dodge, 2), ("jump", sfx.jump, 2), ("land", sfx.land, 2),
        ("fall", sfx.fall, 2), ("getup", sfx.getup, 1), ("special_charge", sfx.special_charge, 1),
        ("special_impact", sfx.special_impact, 2), ("special_whoosh", sfx.special_whoosh, 2), ("cat_swarm", sfx.cat_swarm, 1),
        ("combo", sfx.combo, 3), ("ko_impact", sfx.ko_impact, 1), ("round_bell", sfx.round_bell, 1), ("whoosh", lambda v: sfx.whoosh(0.2, 500, 2600, v), 3),
    ]:
        for v in range(n):
            export(f"combat/{name}_{v + 1}", fn(v))


def gen_ui():
    print("interface")
    for name, fn in [("nav", sfx.ui_nav), ("select", sfx.ui_select), ("confirm", sfx.ui_confirm), ("back", sfx.ui_back), ("unlock", sfx.ui_unlock), ("transition", sfx.ui_transition), ("locked", sfx.ui_locked)]:
        export(f"ui/{name}", fn(0))


def gen_characters():
    print("vozes Beto")
    beto = {
        "attack": ["Rá!", "Hã!", "Toma!", "Hup!", "Iá!"],
        "heavy": ["Chuta a porta!", "Impacto!", "Segura essa!"],
        "hurt": ["Ai!", "Ugh!", "Argh!"],
        "fall": ["Uóóó!"],
        "taunt": ["Pode vir, meu irmão.", "Aqui é ordem, viu?", "Tá achando que é bagunça?"],
        "special": ["Soco pesado!", "Contra-ataque!", "Chute tático!"],
        "super": ["Abre que eu tô chegando!", "Impacto chuta-porta!"],
        "victory": ["Porta chutada. Missão cumprida.", "Respeita o colete, rapaz!", "Aqui não passa ninguém."],
        "defeat": ["Hoje não foi meu dia...", "Vou voltar. E vou voltar chutando a porta."],
    }
    for kind, lines in beto.items():
        for i, text in enumerate(lines):
            say(f"characters/beto/{kind}_{i + 1}", text, BETO, shout=kind in ("attack", "heavy", "special", "super", "hurt"))
    # respiração pesada (sintética)
    breath = np.zeros(int(2.4 * SR))
    for k in range(2):
        b = bandpass(dsp.pink(0.7), 400, 2200) * np.sin(np.linspace(0, np.pi, int(0.7 * SR))) ** 2
        place(breath, b * 0.6, k * 1.15)
    export("characters/beto/breath_1", fade(breath))

    print("vozes Maluco")
    maluco = {
        "attack": ["Eita!", "Vai!", "Iá!", "Pá!", "Ó!"],
        "hurt": ["Ui!", "Ai, ai!", "Ôxe!"],
        "fall": ["Ai, minha mãe!"],
        "laugh": ["Rá rá rá rá rá!", "Hê hê hê hê!", "Ká ká ká ká!"],
        "surprise": ["Eita, rapaz!", "Ôxe, véi!", "Oxente!"],
        "taunt": ["Ôxe, cadê você, véi?", "Pega o gato, pai!", "Tá me tirando, é?"],
        "special": ["Pulo do gato!", "Correria!", "Ataque surpresa!"],
        "super": ["Sumido relâmpago!", "Sumi, pai!"],
        "victory": ["Desencana, pai! Ganhei!", "Magrinho, mas é ligeiro, viu?", "O gato sempre cai de pé!"],
        "defeat": ["Ai, minhas costelas...", "Vou ali e já volto, viu?"],
    }
    for kind, lines in maluco.items():
        for i, text in enumerate(lines):
            say(f"characters/maluco/{kind}_{i + 1}", text, MALUCO, shout=kind in ("attack", "special", "super", "hurt", "surprise"))


def gen_announcer():
    print("narrador")
    lines = {
        "round_1": "Round um!", "round_2": "Round dois!", "round_final": "Round final!", "fight": "Lutem!",
        "ko": "Nocaute!", "perfect": "Perfeito!", "time_over": "Tempo esgotado!", "draw": "Empate!",
        "you_win": "Você venceu!", "you_lose": "Você perdeu!", "title": "Bahia Stretat!", "choose": "Escolha o seu lutador!",
        "beto": "Beto Chuta-Porta!", "maluco": "Maluco do Gato!", "farol": "Farol da Barra!", "favela": "Favela!",
        "shopping": "Shopping da Bahia!", "challenger": "Um novo desafiante chegou!", "wins_beto": "Beto Chuta-Porta vence!",
        "wins_maluco": "Maluco do Gato vence!", "final": "Grande final!", "champion": "Temos um campeão!",
    }
    for key, text in lines.items():
        say(f"announcer/{key}", text, NARRADOR, shout=True)


def gen_crowd():
    print("torcida")
    for v in range(3):
        export(f"stages/crowd/cheer_{v + 1}", sfx.crowd_cheer(v))
    for v in range(2):
        export(f"stages/crowd/gasp_{v + 1}", sfx.crowd_gasp(v))
    export("stages/crowd/ooh_1", chorus("Uuuuuuh!", length=1.4))
    export("stages/crowd/ooh_2", chorus("Ôôôôôh!", length=1.4))
    export("stages/crowd/chant_tricolor_1", chorus("Bahêa! Bahêa! Bahêa!"))
    export("stages/crowd/chant_rubronegro_1", chorus("Vitória! Vitória! Vitória!"))
    export("stages/crowd/chant_luta_1", chorus("Luta! Luta! Luta!"))


def ambience_bed(dur, layers):
    out = np.zeros(int(dur * SR))
    for x, gain in layers:
        out[: len(x)] += x[: len(out)] * gain
    # emenda o loop com crossfade
    xf = int(1.5 * SR)
    out[:xf] = out[:xf] * np.linspace(0, 1, xf) + out[-xf:] * np.linspace(1, 0, xf)
    return out[:-xf]


def sprinkle(dur, sounds, every=(3.0, 7.0), gain=0.6):
    out = np.zeros(int(dur * SR))
    t = dsp.rng.uniform(0.5, 2)
    i = 0
    while t < dur - 3:
        s = sounds[i % len(sounds)]
        place(out, s * gain * dsp.rng.uniform(0.6, 1.0), t)
        t += dsp.rng.uniform(*every)
        i += 1
    return out


def gen_stages():
    print("ambientes")
    D = 32.0
    vendors = [megaphone(t) for t in ["Olha a água gelada!", "Olha o picolé!", "Acarajé quentinho!", "Cerveja e refrigerante!"]]
    gulls = [sfx.seagull(v) for v in range(3)]
    farol = ambience_bed(D + 1.5, [
        (sfx.wave_wash(D + 1.5), 0.55), (sfx.wind(D + 1.5), 0.35), (sfx.murmur(D + 1.5, 1.2), 0.5),
        (sprinkle(D + 1.5, gulls, (4, 8)), 0.5), (sprinkle(D + 1.5, [lowpass(v, 2500) for v in vendors], (5, 9)), 0.35),
    ])
    export("stages/farol/ambience", farol, 0.7)
    for i, v in enumerate(vendors):
        export(f"stages/farol/vendor_{i + 1}", v)

    shouts = [megaphone(t, MALUCO) for t in ["Ô, Zé! Desce aqui!", "Bora, bora!", "Olha a briga!"]]
    music_far = lowpass(np.tile(music.stage_favela(), 2)[: int((D + 1.5) * SR)], 900) * 0.4
    favela = ambience_bed(D + 1.5, [
        (sfx.murmur(D + 1.5, 1.4), 0.55), (music_far, 0.5), (sprinkle(D + 1.5, [sfx.dog_bark(v) for v in range(3)], (5, 10)), 0.5),
        (sprinkle(D + 1.5, [sfx.motorbike(0)], (12, 16)), 0.4), (sprinkle(D + 1.5, [lowpass(s, 2200) for s in shouts], (6, 11)), 0.35),
    ])
    export("stages/favela/ambience", favela, 0.7)
    for v in range(3):
        export(f"stages/favela/dog_{v + 1}", sfx.dog_bark(v))

    pa_voice = process_voice(tts("Atenção, senhores clientes. O shopping informa: a luta vai começar!", "cadu", 1.05, 0.5), 1.0, "highpass=f=300,lowpass=f=4000,aecho=0.8:0.7:90|180:0.35|0.2,volume=1.3")
    pa = np.concatenate([sfx.pa_chime(0), pa_voice])
    indoor = reverb(sfx.murmur(D + 1.5, 1.6, 0.9), 1.6, 0.4)[: int((D + 1.5) * SR)]
    shopping = ambience_bed(D + 1.5, [
        (indoor, 0.6), (sfx.footsteps(D + 1.5, 3.0), 0.5), (sprinkle(D + 1.5, [sfx.door_slide(0), sfx.door_slide(1)], (6, 10)), 0.4),
        (sprinkle(D + 1.5, [pa], (14, 18)), 0.35),
    ])
    export("stages/shopping/ambience", shopping, 0.7)
    export("stages/shopping/pa_1", pa)
    export("stages/shopping/door_1", sfx.door_slide(0))


def gen_music():
    print("músicas")
    # gritos do breque do pagode (coro curto)
    music.set_shouts([chorus(t, pitches=(0.9, 1.0, 1.12), length=0.9)[: int(0.9 * SR)] for t in ("Ei! Ei!", "Vai, vai!", "Bora!")])
    export("music/menu_theme", music.menu_theme(), 0.85)
    export("music/select", music.select_theme(), 0.8)
    export("music/stage_farol", music.stage_farol(), 0.8)
    export("music/stage_favela", music.stage_favela(), 0.8)
    export("music/stage_shopping", music.stage_shopping(), 0.8)
    export("victory/victory_jingle", music.victory_jingle(), 0.85)
    export("defeat/defeat_jingle", music.defeat_jingle(), 0.8)


if __name__ == "__main__":
    only = sys.argv[1:] or ["combat", "ui", "characters", "announcer", "crowd", "stages", "music"]
    if "all" in only:
        only = ["combat", "ui", "characters", "announcer", "crowd", "stages", "music"]
    for part in only:
        globals()[f"gen_{part}"]()
    # manifesto mescla com o existente (permite gerar por partes)
    mpath = os.path.join(OUT, "manifest.json")
    old = {}
    if os.path.exists(mpath):
        with open(mpath) as f:
            old = json.load(f)
    old.update({k: sorted(set(v)) for k, v in manifest.items()})
    with open(mpath, "w") as f:
        json.dump(old, f, indent=1, ensure_ascii=False, sort_keys=True)
    shutil.rmtree(TMP, ignore_errors=True)
    print("ok", len(old), "grupos")
