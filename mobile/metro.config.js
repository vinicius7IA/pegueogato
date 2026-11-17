// O jogo inteiro vem num único arquivo HTML (assets/game.html): o Metro precisa tratá-lo como asset.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('html');

module.exports = config;
