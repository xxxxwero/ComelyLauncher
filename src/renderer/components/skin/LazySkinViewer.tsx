import { lazy, Suspense, type ComponentProps } from 'react';
import { Spinner } from '../ui/Feedback';
import styles from './SkinStage.module.css';

const SkinViewer3D = lazy(() => import('./SkinViewer3D').then((module) => ({ default: module.SkinViewer3D })));

export function LazySkinViewer(props: ComponentProps<typeof SkinViewer3D>) {
  return (
    <Suspense
      fallback={
        <div className={styles.stage}>
          <div className={styles.placeholder}>
            <Spinner size={30} />
          </div>
        </div>
      }
    >
      <SkinViewer3D {...props} />
    </Suspense>
  );
}
