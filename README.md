# BAHIA STRETAT

Jogo mobile de luta em 3D (estilo Street Fighter V: lutadores 3D, jogabilidade lateral) com cenários de Salvador e humor baiano.
Paródia: personagens e nomes são fictícios.

- **Lutadores liberados:** Beto Chuta-Porta e Maluco do Gato (os outros 6 aparecem bloqueados)
- **Cenários liberados:** Farol da Barra, Favela e Shopping da Bahia (o resto do mapa fica bloqueado)
- **Modos:** Arcade, Versus (2 jogadores no mesmo celular), Torneio, Treino, Configurações e Créditos
- **Áudio:** 156 arquivos originais (trilhas, golpes, vozes, narrador, torcida e ambientes)

## Jogar no celular com Expo Go (mais rápido)

1. Instale o app **Expo Go** no celular (Play Store / App Store).
2. No computador (Node 22+):

```bash
cd mobile
```

```bash
npm install
```

```bash
npx expo start
```

3. Leia o QR code com o Expo Go (Android) ou com a câmera (iPhone). O jogo abre deitado, em tela cheia.

O jogo já vem embutido em `mobile/assets/game.html`, então funciona sem internet.

## Baixar o APK Android

A cada push, o GitHub Actions compila o APK (workflow **APK Android (Expo)**).
Abra a aba **Actions** do repositório, entre na última execução e baixe o artefato **bahia-stretat-apk**.
Também dá para rodar manualmente em **Actions → APK Android (Expo) → Run workflow**.

Para compilar localmente (precisa de Android SDK e Java 17):

```bash
npm run expo:bundle
```

```bash
cd mobile && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease
```

## Rodar no navegador (desenvolvimento)

```bash
npm install
```

```bash
npm run dev
```

Abre em `http://localhost:3000` (use `PORT=xxxx` para trocar). Para testar no celular na mesma rede Wi-Fi, abra `http://IP-DO-PC:3000`.

Depois de mudar o jogo, atualize o app Expo com:

```bash
npm run expo:bundle
```

## Controles

- **Celular:** direcional à esquerda; à direita SOCO, CHUTE, DEFESA e ESPECIAL.
  - Direção + SOCO/CHUTE = golpe forte; direção + DEFESA = esquiva
  - ESPECIAL = especial; com direção = segundo especial; barra cheia = SUPER
  - Segurar para a frente = correr
  - No Versus, cada jogador usa metade da tela.
- **Teclado:** setas/WASD para mover, J/K/L/U para golpes, Esc para pausar.

## Estrutura

```
src/
  App.tsx                 navegação entre telas e fluxos de cada modo
  router.ts               rotas por URL (funciona também dentro do app Expo)
  components/             telas: MainMenu, CharacterSelect, StageSelect (mapa), Bracket, Credits, ArenaView, HUD, TouchPad...
  game/arenaScene.ts      motor de luta 3D (Three.js): combate, rounds, IA, torcida, câmera
  game/fighterRig.ts      modelos e animações dos lutadores
  game/fighters.ts        dados dos lutadores e golpes
  game/catalog.ts         arenas, escadas do Arcade e do Torneio, configurações
  game/audio.ts           motor de áudio (eventos do jogo)
  game/soundBank.ts       banco de sons: barramentos música/efeitos/vozes/ambiente
  assets/audio/           music, combat, characters, announcer, stages, ui, victory, defeat
mobile/                   app Expo (WebView com o jogo embutido)
tools/audio/              gerador do áudio (síntese + vozes Piper pt-BR)
.github/workflows/        geração automática do APK
```

## Regerar o áudio

Requer Python 3 com numpy e scipy, ffmpeg e [piper-tts](https://github.com/rhasspy/piper) com as vozes pt_BR `faber`, `cadu` e `jeff` (medium):

```bash
VOICES_DIR=/caminho/das/vozes python3 tools/audio/generate.py all
```
