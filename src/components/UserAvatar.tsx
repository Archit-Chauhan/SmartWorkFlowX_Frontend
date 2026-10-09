import React, { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import * as notionistsNeutral from '@dicebear/notionists-neutral';

interface UserAvatarProps {
  /** Same seed always gives the same face. Generated in the browser; nothing is sent anywhere. */
  seed: string;
  size?: number;
  className?: string;
}

const tints = ['e6e9fb', 'f1e6fb', 'e6f2fb', 'e6f6ec', 'fbefdc', 'fbe6ea'];

/** Decorative: the name or email is always shown next to it, so the image has no alt text. */
const UserAvatar: React.FC<UserAvatarProps> = ({ seed, size = 32, className = '' }) => {
  const src = useMemo(
    () => createAvatar(notionistsNeutral, { seed, backgroundColor: tints, backgroundType: ['solid'] }).toDataUri(),
    [seed]
  );

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-pill border border-hairline ${className}`}
    />
  );
};

export default UserAvatar;
