import { useEffect, useRef, useState } from 'react';

export function useDraft<T>(value: T, commit: (value: T) => void, delayMs = 500): [T, (value: T) => void] {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (!timer.current) setDraft(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const update = (next: T): void => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current(next);
    }, delayMs);
  };

  return [draft, update];
}
