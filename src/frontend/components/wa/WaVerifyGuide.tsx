import { Badge, Card, Code, Divider, Group, List, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { TbArrowRight, TbInfoCircle, TbShieldCheck } from 'react-icons/tb'

const STEPS = [
  {
    title: 'Daftarkan consumer app',
    body: (
      <>
        SUPER_ADMIN membuat consumer di tabel di bawah. Saat dibuat, <b>API key</b> ditampilkan <b>sekali saja</b> —
        salin & simpan di sisi app. Key inilah identitas app; semua request app di-scope ke key ini sehingga satu app
        tak bisa melihat data app lain.
      </>
    ),
  },
  {
    title: 'App memulai verifikasi',
    body: (
      <>
        App memanggil <Code>POST /api/verify/start</Code> dengan header <Code>x-api-key</Code>. Server membalas{' '}
        <Code>{'{ id, token, sendTo, expiresAt }'}</Code>. <Code>token</Code> berformat <Code>WAV-XXXXXXXX</Code>,
        sekali pakai, berlaku 5 menit.
      </>
    ),
  },
  {
    title: 'User mengirim token',
    body: (
      <>
        App menampilkan token + nomor server (<Code>sendTo</Code>) ke user. User <b>mengirim</b> token itu via WhatsApp
        dari nomor yang ingin diverifikasi ke nomor server. Arah masuk (inbound) inilah yang membuatnya aman dari
        kebijakan anti-ban — dashboard tak pernah mengirim duluan.
      </>
    ),
  },
  {
    title: 'Server menangkap & mencocokkan',
    body: (
      <>
        Listener WhatsApp server (selalu aktif) menangkap pesan masuk, mencocokkan token, lalu menandai request{' '}
        <Badge color="green" variant="light" size="sm">
          VERIFIED
        </Badge>{' '}
        dengan nomor pengirim sebagai <Code>matchedPhone</Code>. Token sekali pakai — pengirim pertama yang menang.
      </>
    ),
  },
  {
    title: 'App menerima hasil',
    body: (
      <>
        Dua jalur, app bisa pakai salah satu atau keduanya: <b>polling</b> <Code>GET /api/verify/:id</Code> (sumber
        kebenaran, selalu jalan) atau <b>webhook</b> push ber-tanda-tangan HMAC ke <Code>webhookUrl</Code> consumer
        (best-effort, ada retry + replay). Hasilnya muncul juga di tabel <i>Request Verifikasi</i> di bawah.
      </>
    ),
  },
]

export function WaVerifyGuide() {
  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group gap="xs">
          <ThemeIcon variant="light" color="teal" size="md">
            <TbShieldCheck size={18} />
          </ThemeIcon>
          <Title order={5}>Cara Kerja Verifikasi Nomor</Title>
        </Group>

        <Text size="sm" c="dimmed">
          Verifikasi kepemilikan nomor pola <b>inbound (proof-of-possession)</b>: user membuktikan kepemilikan dengan{' '}
          mengirim token ke nomor server, bukan server yang mengirim OTP keluar. Pola ini di luar jangkauan kebijakan
          anti-ban OTP WhatsApp.
        </Text>

        <List type="ordered" spacing="sm" size="sm" center>
          {STEPS.map((s) => (
            <List.Item
              key={s.title}
              icon={
                <ThemeIcon color="teal" size={22} radius="xl">
                  <TbArrowRight size={14} />
                </ThemeIcon>
              }
            >
              <Text size="sm" fw={600}>
                {s.title}
              </Text>
              <Text size="sm" c="dimmed" component="div">
                {s.body}
              </Text>
            </List.Item>
          ))}
        </List>

        <Divider />

        <Group gap="xs" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" color="blue" size="md">
            <TbInfoCircle size={18} />
          </ThemeIcon>
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Mode Login vs Discovery
            </Text>
            <Text size="sm" c="dimmed">
              Saat memanggil <Code>start</Code>, app boleh menyertakan <Code>expectedPhone</Code>. Diisi = <b>Login</b>{' '}
              (app sudah tahu nomor yang diharapkan, lalu membandingkan sendiri <Code>matchedPhone</Code> vs nomor
              akun). Kosong = <b>Discovery</b> (nomor pengirim token menjadi nomor terverifikasi — cocok untuk
              pendaftaran nomor baru).
            </Text>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed">
          Kontrak teknis lengkap (format token, isolasi, payload & tanda tangan webhook) ada di{' '}
          <Code>docs/WA-VERIFY.md</Code> pada repo.
        </Text>
      </Stack>
    </Card>
  )
}
