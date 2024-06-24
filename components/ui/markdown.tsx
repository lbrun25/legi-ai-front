import { FC, memo } from 'react'
import ReactMarkdown, { Options } from 'react-markdown'

type ExtendedOptions = Options & {
  isGenerating?: boolean;
};

export const MemoizedReactMarkdown: FC<ExtendedOptions> = memo(
  (props) => <ReactMarkdown {...props} />,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className &&
    prevProps.isGenerating === nextProps.isGenerating
);
