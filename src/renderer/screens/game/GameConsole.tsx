import { useEffect, useRef } from 'react';
import styles from './GameOverlay.module.css';

const VISIBLE_LINES = 600;

export function GameConsole({ lines }: { lines: string[] }) {
  const container = useRef<HTMLPreElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const element = container.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [lines]);

  return (
    <pre
      ref={container}
      className={styles.console}
      onScroll={(event) => {
        const element = event.currentTarget;
        stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
      }}
    >
      {lines.slice(-VISIBLE_LINES).join('\n')}
    </pre>
  );
}
