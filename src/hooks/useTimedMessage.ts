import { useCallback, useEffect, useState } from 'react';

export interface TimedMessage {
  id: number; // 同じ文言が続いても表示時間を延長できるよう、表示のたびに変える
  text: string;
}

// 一定時間だけ表示されるメッセージ
export const useTimedMessage = (durationMs: number) => {
  const [message, setMessage] = useState<TimedMessage | null>(null);

  useEffect(() => {
    if (!message) return;
    const timerId = setTimeout(() => setMessage(null), durationMs);
    return () => clearTimeout(timerId);
  }, [message, durationMs]);

  const showMessage = useCallback(
    (text: string) => setMessage(prev => ({ id: (prev?.id ?? 0) + 1, text })),
    [],
  );
  const clearMessage = useCallback(() => setMessage(null), []);

  return { message, showMessage, clearMessage };
};
