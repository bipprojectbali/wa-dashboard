# WAV E2E — langkah 1: consumer minta token verifikasi.
#
# Alur lengkap (baca berurutan): start.hurl → manusia kirim token via WhatsApp → poll.hurl
#
# Jalankan manual (semua nilai via --variable, tak ada secret di file):
#   hurl --variable base_url=http://localhost:3111 \
#        --variable api_key=wav_sk_xxx \
#        --variable expected_phone=628123456789 \
#        hurl/wa-verify/start.hurl
#
# expected_phone boleh kosong → mode discovery (nomor pengirim jadi nomor terverifikasi).
POST {{base_url}}/api/verify/start
x-api-key: {{api_key}}
Content-Type: application/json
{ "expectedPhone": "{{expected_phone}}" }

HTTP 200
[Asserts]
jsonpath "$.token" matches /^WAV-[A-HJ-NP-Z2-7]{8}$/
jsonpath "$.id" exists
[Captures]
request_id: jsonpath "$.id"
wav_token: jsonpath "$.token"
send_to: jsonpath "$.sendTo"
