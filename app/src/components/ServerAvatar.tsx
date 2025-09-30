import React, { useState, useMemo } from 'react';
import { Avatar } from '@mui/material';

function normalizeSrc(iconUrl?: string | null): string | undefined {
  if (!iconUrl) return undefined;
  const trimmed = iconUrl.trim();
  if (!trimmed) return undefined;

  // Accept data: and blob: directly
  if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;

  // Accept http(s)
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Accept plain base64 or strings that start with 'base64,'
  // e.g. 'iVBORw0KG...' or 'base64,iVBORw0KG...'
  // Prefer to wrap as a data URL. If the caller supplied a mime like 'image/png;base64,...' it should already be a data: URL.
  const base64Only = /^[A-Za-z0-9+/]+={0,2}$/;
  if (/^base64,/i.test(trimmed)) {
    const payload = trimmed.replace(/^base64,?/i, '');
    if (base64Only.test(payload)) return `data:image/png;base64,${payload}`;
  }
  if (base64Only.test(trimmed)) {
    return `data:image/png;base64,${trimmed}`;
  }

  // Windows absolute path like C:\path\to\file.png -> file:///C:/path/to/file.png
  if (/^[A-Za-z]:\\\\|^[A-Za-z]:\\/.test(trimmed) || /^[A-Za-z]:\//.test(trimmed)) {
    let p = trimmed.replace(/\\/g, '/');
    if (!p.startsWith('/')) p = '/' + p; // ensure leading slash for file://
    return encodeURI('file://' + p);
  }

  // If starts with a single slash (absolute posix path), convert to file://
  if (trimmed.startsWith('/')) {
    return encodeURI('file://' + trimmed);
  }

  // Last resort: if it's a valid URL, return it, otherwise return as-is and let the browser try
  try {
    new URL(trimmed);
    return trimmed;
  } catch (e) {
    return trimmed;
  }
}

export default function ServerAvatar({
  iconUrl,
  fallbackEmoji,
  alt,
  className,
}: {
  iconUrl?: string | null;
  fallbackEmoji?: React.ReactNode;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => normalizeSrc(iconUrl), [iconUrl]);

  // If we have a src and it previously failed, avoid retrying repeatedly
  if (src && !failed) {
    return (
      <Avatar
        src={src}
        alt={alt}
        className={className}
        imgProps={{
          onError: () => setFailed(true),
        }}
      />
    );
  }

  return <Avatar className={className}>{fallbackEmoji}</Avatar>;
}
