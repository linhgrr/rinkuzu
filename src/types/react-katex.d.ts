declare module 'react-katex' {
    import { FC } from 'react';

    interface KatexProps {
        math: string;
        errorColor?: string;
        renderError?: (error: Error) => React.ReactNode;
        settings?: object;
    }

    export const InlineMath: FC<KatexProps>;
    export const BlockMath: FC<KatexProps>;
}
