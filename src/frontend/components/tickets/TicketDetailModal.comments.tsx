import { Badge, Button, Card, Group, Stack, Text, Textarea } from '@mantine/core'
import { TbMessagePlus } from 'react-icons/tb'
import type { TicketDetail } from './types'

interface Props {
  comments: TicketDetail['comments']
  commentBody: string
  setCommentBody: (v: string) => void
  isPending: boolean
  onSubmit: (body: string) => void
}

export function CommentSection({ comments, commentBody, setCommentBody, isPending, onSubmit }: Props) {
  return (
    <Card withBorder padding="sm" radius="sm">
      <Text size="xs" c="dimmed" mb={6}>
        Comments ({comments.length})
      </Text>
      <Stack gap="xs">
        {comments.length === 0 && (
          <Text size="xs" c="dimmed">
            No comments yet
          </Text>
        )}
        {comments.map((c) => (
          <Card key={c.id} withBorder padding="xs" radius="xs">
            <Group gap="xs" mb={2}>
              <Badge size="xs" color={c.authorTag === 'CLAUDE' ? 'violet' : c.authorTag === 'QC' ? 'yellow' : 'blue'}>
                {c.authorTag}
              </Badge>
              <Text size="xs" c="dimmed">
                {c.author?.name ?? 'System'}
              </Text>
              <Text size="xs" c="dimmed">
                · {new Date(c.createdAt).toLocaleString()}
              </Text>
            </Group>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {c.body}
            </Text>
          </Card>
        ))}
      </Stack>
      <Group mt="sm" align="flex-end">
        <Textarea
          placeholder="Add a comment…"
          value={commentBody}
          onChange={(e) => setCommentBody(e.currentTarget.value)}
          autosize
          minRows={2}
          style={{ flex: 1 }}
        />
        <Button
          leftSection={<TbMessagePlus size={14} />}
          disabled={!commentBody.trim()}
          loading={isPending}
          onClick={() => onSubmit(commentBody.trim())}
        >
          Send
        </Button>
      </Group>
    </Card>
  )
}
