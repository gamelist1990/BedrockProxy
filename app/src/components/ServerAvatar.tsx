import React, { useState, useMemo } from 'react';
import { Avatar } from '@mui/material';

function looksLikeImageUrl(url?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(u.pathname);
  } catch (e) {
    return /\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(String(url));
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

  const useImage = useMemo(() => {
    return !!iconUrl && !failed && looksLikeImageUrl(iconUrl);
  }, [iconUrl, failed]);

  if (useImage) {
    return (
      <Avatar
        src={iconUrl ?? undefined}
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
