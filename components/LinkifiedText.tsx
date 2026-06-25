'use client';

import { Fragment } from 'react';

// Matches http(s) URLs, capturing trailing punctuation outside the URL
const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

interface Props {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders plain text with any http(s) URLs converted to clickable <a> tags.
 * All other text renders as-is. Safe — no dangerouslySetInnerHTML.
 */
export function LinkifiedText({ text, className, style }: Props) {
  const parts = text.split(URL_REGEX);

  return (
    <pre className={className} style={style}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // Reset lastIndex after exec/test calls on a sticky regex
          URL_REGEX.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--blue)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                wordBreak: 'break-all',
              }}
            >
              {part}
            </a>
          );
        }
        URL_REGEX.lastIndex = 0;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </pre>
  );
}

/** Extract the first http(s) URL from a string, or null if none found. */
export function extractFirstUrl(text: string): string | null {
  URL_REGEX.lastIndex = 0;
  const m = text.match(URL_REGEX);
  URL_REGEX.lastIndex = 0;
  return m ? m[0] : null;
}
