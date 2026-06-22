import { Badge, Card, Container, Group, Stack, Table, Text, Title } from '@mantine/core'

const orderStatusColor: Record<string, string> = {
  Completed: 'green',
  Processing: 'blue',
  Pending: 'yellow',
  Cancelled: 'red',
}

const ordersData = [
  { id: '#ORD-001', customer: 'Budi Santoso', amount: 'Rp 1.250.000', status: 'Completed', date: '2 jam lalu' },
  { id: '#ORD-002', customer: 'Siti Rahayu', amount: 'Rp 890.000', status: 'Processing', date: '4 jam lalu' },
  { id: '#ORD-003', customer: 'Andi Pratama', amount: 'Rp 2.100.000', status: 'Pending', date: '6 jam lalu' },
  { id: '#ORD-004', customer: 'Dewi Lestari', amount: 'Rp 560.000', status: 'Completed', date: '1 hari lalu' },
  { id: '#ORD-005', customer: 'Reza Mahendra', amount: 'Rp 1.780.000', status: 'Cancelled', date: '1 hari lalu' },
  { id: '#ORD-006', customer: 'Putri Ayu', amount: 'Rp 3.400.000', status: 'Completed', date: '2 hari lalu' },
  { id: '#ORD-007', customer: 'Hendra Wijaya', amount: 'Rp 720.000', status: 'Processing', date: '2 hari lalu' },
]

export function OrdersPanel() {
  return (
    <Container size="lg" px={{ base: 0, sm: 'md' }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3} fz={{ base: 'lg', sm: 'xl' }}>
            Orders
          </Title>
          <Badge variant="light" size="lg">
            {ordersData.length} orders
          </Badge>
        </Group>

        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={500}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Order ID</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ordersData.map((order) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {order.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{order.customer}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {order.amount}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={orderStatusColor[order.status]} variant="light" size="sm">
                        {order.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="dimmed">
                        {order.date}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    </Container>
  )
}
