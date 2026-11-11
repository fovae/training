import { t } from '../../i18n';
import { dismissIosHint, iosHintVisible } from '../../features/install';
import { Icon } from './Icon';

export function IosInstallSteps() {
  return (
    <ol class="steps">
      <li>
        {t('install.step1a')}{' '}
        <span class="kbd">
          <Icon name="share" size={16} /> {t('install.share')}
        </span>{' '}
        {t('install.step1b')}
      </li>
      <li>{t('install.step2')}</li>
      <li>{t('install.step3')}</li>
    </ol>
  );
}

/** Подсказка установки: один раз, только Safari на iOS, только вне standalone */
export function InstallHint() {
  if (!iosHintVisible.value) return null;
  return (
    <aside class="install-hint" aria-label={t('install.iosTitle')}>
      <div class="install-hint-h">
        <b>{t('install.hintTitle')}</b>
        <button type="button" class="icon-btn" aria-label={t('install.dismiss')} onClick={dismissIosHint}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <IosInstallSteps />
    </aside>
  );
}
