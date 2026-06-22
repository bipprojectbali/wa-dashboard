import {
  ActionIcon,
  Box,
  Button,
  Card,
  CopyButton,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { useState } from 'react'
import {
  TbApi,
  TbBook,
  TbCheck,
  TbCode,
  TbCopy,
  TbDownload,
  TbExternalLink,
  TbFileCode,
  TbRefresh,
} from 'react-icons/tb'
import { OpenApiJsonViewer } from './ApiDocsPanel.openapi'

export function ApiDocsPanel() {
  const [view, setView] = useState<'swagger' | 'openapi'>('swagger')
  const [refreshKey, setRefreshKey] = useState(0)

  const apiBaseUrl = window.location.origin
  const swaggerUrl = `${apiBaseUrl}/api/docs`
  const openApiUrl = `${apiBaseUrl}/api/docs/json`

  const handleDownloadOpenApi = async () => {
    try {
      const response = await fetch(openApiUrl)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'openapi.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download OpenAPI JSON:', error)
      alert('Failed to download OpenAPI JSON. Please check console for details.')
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Group gap="xs" mb="xs">
            <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'cyan', to: 'blue' }}>
              <TbApi size={20} />
            </ThemeIcon>
            <Title order={2}>API Documentation</Title>
          </Group>
          <Text c="dimmed" size="sm">
            Dokumentasi API lengkap dengan Swagger UI dan OpenAPI JSON Schema
          </Text>
        </Box>
        <Tooltip label="Refresh">
          <ActionIcon variant="light" color="blue" size="lg" onClick={() => setRefreshKey((k) => k + 1)}>
            <TbRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group grow>
        <Card withBorder padding="md" radius="md">
          <Group gap="xs" mb="xs">
            <ThemeIcon size="md" variant="light" color="blue">
              <TbBook size={16} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              Swagger UI
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            Interface interaktif untuk testing API
          </Text>
          <Button
            component="a"
            href={swaggerUrl}
            target="_blank"
            variant="light"
            size="xs"
            fullWidth
            leftSection={<TbExternalLink size={14} />}
          >
            Buka Swagger UI
          </Button>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group gap="xs" mb="xs">
            <ThemeIcon size="md" variant="light" color="grape">
              <TbFileCode size={16} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              OpenAPI JSON
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            Schema definition dalam format OpenAPI
          </Text>
          <Button
            onClick={handleDownloadOpenApi}
            variant="light"
            size="xs"
            fullWidth
            leftSection={<TbDownload size={14} />}
          >
            Download JSON
          </Button>
        </Card>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="md">
          <Text fw={600}>Preview</Text>
          <SegmentedControl
            value={view}
            onChange={(value) => setView(value as 'swagger' | 'openapi')}
            size="xs"
            data={[
              {
                label: (
                  <Group gap={6}>
                    <TbBook size={14} />
                    <span>Swagger UI</span>
                  </Group>
                ),
                value: 'swagger',
              },
              {
                label: (
                  <Group gap={6}>
                    <TbCode size={14} />
                    <span>OpenAPI JSON</span>
                  </Group>
                ),
                value: 'openapi',
              },
            ]}
          />
        </Group>
        {view === 'swagger' ? (
          <Box
            style={{
              position: 'relative',
              width: '100%',
              height: 'calc(100vh - 400px)',
              minHeight: '500px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--mantine-color-default-border)',
            }}
          >
            <iframe
              key={refreshKey}
              src={swaggerUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Swagger UI"
            />
          </Box>
        ) : (
          <OpenApiJsonViewer url={openApiUrl} refreshKey={refreshKey} />
        )}
      </Paper>

      <Card withBorder padding="md" radius="md">
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="blue">
            <TbExternalLink size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Quick Links
          </Text>
        </Group>
        <Stack gap="xs">
          {[
            { label: 'Swagger UI', url: swaggerUrl },
            { label: 'OpenAPI JSON', url: openApiUrl },
          ].map((item, i) => (
            <>
              {i > 0 && <Divider key={`div-${item.label}`} />}
              <Group key={item.label} justify="space-between">
                <Text size="sm" c="dimmed">
                  {item.label}
                </Text>
                <Group gap="xs">
                  <CopyButton value={item.url}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied!' : 'Copy URL'}>
                        <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} size="sm" onClick={copy}>
                          {copied ? <TbCheck size={14} /> : <TbCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  <Button
                    component="a"
                    href={item.url}
                    target="_blank"
                    variant="subtle"
                    size="xs"
                    rightSection={<TbExternalLink size={12} />}
                  >
                    Open
                  </Button>
                </Group>
              </Group>
            </>
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}
