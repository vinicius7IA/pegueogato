# PEGUE O GATO

Jogo de luta 3D arcade (React + Vite + Three.js) com servidor Express/WebSocket para multiplayer e ranking.

## Rodar

```bash
npm install
npm run dev          # http://localhost:3000 (PORT=xxxx para trocar)
```

Para jogar no celular na mesma rede Wi-Fi, abra `http://IP-DO-PC:3000`.

## Produção

```bash
npm run build
NODE_ENV=production npm start
```

O app é um PWA: ao abrir em HTTPS no celular, use "Adicionar à tela inicial" para jogar em tela cheia.
Hospede em qualquer serviço que rode Node com WebSocket (Render, Railway, Fly.io).
