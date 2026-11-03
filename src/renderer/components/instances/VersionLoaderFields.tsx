import { useEffect, useMemo, useState } from 'react';
import type { InstanceLoader } from '../../../shared/types/instances';
import type { LoaderVersionsState } from '../../hooks/use-loader-versions';
import { useI18n } from '../../i18n/i18n';
import { loadVersions, useVersions } from '../../state/versions-store';
import { cx } from '../../utils/cx';
import { LOADER_NAMES, loaderVersionLabel } from '../../utils/loader-names';
import { Spinner } from '../ui/Feedback';
import { Checkbox, Field, SelectInput } from '../ui/Field';
import { Icon } from '../ui/Icon';
import formStyles from './InstanceForms.module.css';
import { LoaderPicker } from './LoaderPicker';

export interface VersionLoaderValue {
  gameVersion: string;
  loader: InstanceLoader;
}

interface VersionLoaderFieldsProps {
  value: VersionLoaderValue;
  onChange: (value: VersionLoaderValue) => void;
  loaderState: LoaderVersionsState;
}

export function VersionLoaderFields({ value, onChange, loaderState }: VersionLoaderFieldsProps) {
  const { t } = useI18n();
  const versions = useVersions();
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (versions.entries.length === 0) void loadVersions();
  }, [versions.entries.length]);

  const options = useMemo(() => {
    const list = versions.entries.filter((entry) => showAll || entry.type === 'release');
    return list.some((entry) => entry.id === value.gameVersion) || !value.gameVersion ? list : [{ id: value.gameVersion, type: 'release' as const, releaseTime: '', installed: false }, ...list];
  }, [versions.entries, showAll, value.gameVersion]);

  useEffect(() => {
    if (!value.gameVersion && options[0]) onChange({ ...value, gameVersion: options[0].id });
  }, [options, value, onChange]);

  const loaderName = LOADER_NAMES[value.loader.type];
  const unavailable = value.loader.type !== 'vanilla' && loaderState.status === 'ready' && loaderState.versions.length === 0;

  return (
    <>
      <Field label={t('instances.gameVersion')}>
        {(id) => (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <SelectInput
              id={id}
              value={value.gameVersion}
              disabled={versions.loading && versions.entries.length === 0}
              onChange={(event) => onChange({ gameVersion: event.target.value, loader: { type: value.loader.type, version: null } })}
            >
              {options.length === 0 && <option value="">{t('common.loading')}</option>}
              {options.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.type === 'release' ? entry.id : `${entry.id} · ${t(`versionType.${entry.type}`)}`}
                </option>
              ))}
            </SelectInput>
            <Checkbox checked={showAll} onChange={setShowAll} label={t('instances.showSnapshots')} />
          </div>
        )}
      </Field>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{t('instances.loader')}</span>
        <LoaderPicker value={value.loader.type} onChange={(type) => onChange({ ...value, loader: { type, version: null } })} />
        {value.loader.type !== 'vanilla' && (
          <div className={cx(formStyles.loaderStatus, unavailable && formStyles.loaderWarning)}>
            {loaderState.status === 'loading' && (
              <>
                <Spinner size={14} />
                {t('versions.loaderChecking', { loader: loaderName })}
              </>
            )}
            {unavailable && (
              <>
                <Icon name="warning" size={14} />
                {t('versions.loaderUnavailable', { loader: loaderName, version: value.gameVersion })}
              </>
            )}
            {loaderState.status === 'error' && (
              <>
                <Icon name="warning" size={14} />
                {t('errors.network')}
              </>
            )}
          </div>
        )}
      </div>
      {value.loader.type !== 'vanilla' && loaderState.status === 'ready' && loaderState.versions.length > 0 && (
        <Field label={t('instances.loaderVersion')}>
          {(id) => (
            <SelectInput id={id} value={value.loader.version ?? ''} onChange={(event) => onChange({ ...value, loader: { type: value.loader.type, version: event.target.value || null } })}>
              <option value="">{t('instances.loaderLatest')}</option>
              {loaderState.versions.slice(0, 80).map((entry) => (
                <option key={entry.version} value={entry.version}>
                  {loaderVersionLabel(value.loader.type, entry.version, value.gameVersion)}
                  {entry.stable ? '' : ` · ${t('instances.loaderBeta')}`}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      )}
    </>
  );
}
