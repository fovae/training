import { render } from 'preact';
import '@fontsource-variable/manrope/wght.css';
import 'virtual:themes.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/features.css';
import './styles/layout.css';
import './styles/motion.css';

import { App } from './ui/App';
import { initApp } from './state/app';
import { installAudioUnlock } from './features/audio';
import { installWakeLock } from './features/wakelock';
import { initInstallPrompt } from './features/install';
import { initSW } from './features/update';
import { initUndo } from './features/backup';
import { installViewportFix } from './lib/viewportFix';

initInstallPrompt();
// iOS Safari включает :active (отклик нажатия) только при слушателе касаний — пустой пассивный
document.addEventListener('touchstart', () => {}, { passive: true });
installAudioUnlock();
installViewportFix();

render(<App />, document.getElementById('app')!);
void initApp().then(() => {
  installWakeLock();
  void initUndo();
});
void initSW();
