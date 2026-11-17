import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { type ComponentType, type Ref, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';

// Tipagem da WebView ainda não acompanha o React 19: declara as props explicitamente.
const GameView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

/**
 * BAHIA STRETAT no celular: o jogo (motor 3D, sons e imagens) vem embutido em
 * assets/game.html e roda numa WebView em tela cheia, deitado e sem precisar de internet.
 */
export default function App() {
  useKeepAwake();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    (async () => {
      try {
        const asset = Asset.fromModule(require('./assets/game.html'));
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        setHtml(await FileSystem.readAsStringAsync(uri));
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // Botão "voltar" do Android navega dentro do jogo em vez de fechar o app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      webRef.current?.injectJavaScript('history.back(); true;');
      return true;
    });
    return () => sub.remove();
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Não foi possível carregar o jogo.</Text>
        <Text style={styles.small}>{error}</Text>
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <Text style={styles.title}>BAHIA STRETAT</Text>
        <ActivityIndicator size="large" color="#ffd400" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <GameView
        ref={webRef}
        source={{ html, baseUrl: 'https://bahiastretat.app/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        style={styles.root}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1f8f' },
  center: { flex: 1, backgroundColor: '#0a1f8f', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: '#fff', fontSize: 36, fontWeight: '900', fontStyle: 'italic' },
  text: { color: '#fff', fontSize: 18, fontWeight: '700' },
  small: { color: '#cbd5e1', fontSize: 12, marginTop: 8 },
});
