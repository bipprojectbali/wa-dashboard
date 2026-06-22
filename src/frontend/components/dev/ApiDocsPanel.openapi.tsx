import { Badge, Box, Button, CopyButton, Group, Text, useMantineColorScheme } from '@mantine/core'
import Editor from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import { TbCheck, TbCopy } from 'react-icons/tb'

export function OpenApiJsonViewer({ url, refreshKey }: { url: string; refreshKey: number }) {
  const { colorScheme } = useMantineColorScheme()
  const [jsonData, setJsonData] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        const data = await response.json()
        setJsonData(JSON.stringify(data, null, 2))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [url, refreshKey])

  if (loading) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <Text c="dimmed">Loading OpenAPI JSON...</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <Text c="red">Error: {error}</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Badge variant="light" color="grape">
          OpenAPI 3.x
        </Badge>
        <CopyButton value={jsonData}>
          {({ copied, copy }) => (
            <Button
              variant="light"
              size="xs"
              leftSection={copied ? <TbCheck size={14} /> : <TbCopy size={14} />}
              color={copied ? 'teal' : 'blue'}
              onClick={copy}
            >
              {copied ? 'Copied!' : 'Copy JSON'}
            </Button>
          )}
        </CopyButton>
      </Group>
      <Box
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Editor
          height="calc(100vh - 450px)"
          defaultLanguage="json"
          value={jsonData}
          theme={colorScheme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            folding: true,
            automaticLayout: true,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </Box>
    </Box>
  )
}
