// Sumber kebenaran tunggal untuk teks "kontrak sumpah pengikat" anti-ban WhatsApp.
// Dipakai frontend (tab Aturan Kontrak) dan dokumen docs/WA-POLICY.md.
// Naikkan WA_CONTRACT_VERSION setiap isi kontrak berubah secara material — user
// yang sudah acknowledge versi lama akan diminta acknowledge ulang sebelum bisa kirim.

export const WA_CONTRACT_VERSION = 1

export interface ContractSection {
  title: string
  body: string[]
}

export const WA_CONTRACT: ContractSection[] = [
  {
    title: 'Kenapa kontrak ini ada',
    body: [
      'Dashboard ini mengirim pesan WhatsApp lewat wwebjs-api — klien WhatsApp Web yang TIDAK resmi dan melanggar Terms of Service Meta.',
      'Meta mendeteksi klien tidak resmi lewat fingerprint protokol, sehingga risiko suspend/ban bersifat permanen dan tidak bisa dihilangkan, hanya bisa ditekan.',
      'Kontrak ini adalah aturan perilaku yang ditegakkan oleh kode (rate limit, blokir kirim-duluan, cooldown). Melanggarnya bukan sekadar pelanggaran kebijakan — itu menaikkan peluang nomor diblokir.',
    ],
  },
  {
    title: 'Aturan yang ditegakkan',
    body: [
      'Tidak boleh kirim duluan (first-contact). Tujuan pesan harus sudah pernah chat ke nomor ini, atau tersimpan sebagai kontak. Pengiriman ke nomor asing diblokir (HTTP 403).',
      'Jeda minimum antar pesan. Mengirim lebih cepat dari batas akan ditolak (HTTP 429).',
      'Cooldown per nomor. Nomor yang sama tidak boleh dikirimi berulang dalam waktu singkat (HTTP 429).',
      'Plafon volume per menit, per jam, dan per hari. Melewati salah satu plafon akan menolak pengiriman (HTTP 429).',
      'Wajib acknowledge. Selama aturan ini aktif, kamu harus menyetujui kontrak versi terbaru sebelum boleh mengirim pesan.',
    ],
  },
  {
    title: 'Mode OTP (first-contact) — berisiko tinggi',
    body: [
      'OTP secara definisi adalah kirim-duluan ke nomor baru, jadi melanggar aturan utama. Mode ini MATI secara default.',
      'Hanya SUPER_ADMIN yang bisa menyalakan "Izinkan kirim duluan". Saat aktif, pakai volume serendah mungkin dan nomor yang sudah berumur & aktif dipakai harian.',
      'Menyalakan mode ini adalah keputusan sadar yang tercatat di audit log. Risiko ban naik signifikan.',
    ],
  },
  {
    title: 'Yang tetap tidak bisa dijamin',
    body: [
      'Tidak ada konfigurasi yang membuat risiko ban menjadi nol selama memakai klien tidak resmi.',
      'Penerima yang memblokir atau melaporkan, nomor baru, dan update deteksi Meta tetap di luar kendali dashboard ini.',
      'Untuk kebutuhan produksi berisiko rendah, gunakan WhatsApp Business API resmi via penyedia (BSP).',
    ],
  },
]
