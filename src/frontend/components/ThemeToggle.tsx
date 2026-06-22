import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { TbMoon, TbSun } from 'react-icons/tb'

export function ThemeToggle({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { toggleColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light')
  const isDark = computedColorScheme === 'dark'
  const iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18

  return (
    <Tooltip label={isDark ? 'Light mode' : 'Dark mode'}>
      <ActionIcon variant="default" size={size} onClick={toggleColorScheme} aria-label="Toggle color scheme">
        {isDark ? <TbSun size={iconSize} /> : <TbMoon size={iconSize} />}
      </ActionIcon>
    </Tooltip>
  )
}
