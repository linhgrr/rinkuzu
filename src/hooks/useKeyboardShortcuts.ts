import { useEffect } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface ShortcutMap {
    [key: string]: KeyHandler;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const handler = shortcuts[event.key] || shortcuts[event.code];
            if (handler) {
                handler(event);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [shortcuts]);
}
