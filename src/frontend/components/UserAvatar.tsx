import { Avatar } from '@mantine/core'
import { useState } from 'react'

export interface UserAvatarUser {
  name?: string | null
  image?: string | null
}

interface UserAvatarProps {
  user?: UserAvatarUser | null
  size?: string | number
  color?: string
  radius?: string | number
}

export function UserAvatar({ user, size = 'sm', color = 'blue', radius = 'xl' }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const src = user?.image && !imgError ? user.image : undefined

  return (
    <Avatar
      src={src}
      name={user?.name ?? undefined}
      color={src ? undefined : color}
      radius={radius}
      size={size}
      imageProps={
        src
          ? {
              referrerPolicy: 'no-referrer',
              onError: () => setImgError(true),
            }
          : undefined
      }
      alt={user?.name ?? undefined}
    />
  )
}
