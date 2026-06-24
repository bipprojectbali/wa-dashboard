# WAV E2E — langkah 3: cek status SETELAH manusia kirim token via WhatsApp.
#
# Langkah 2 (manual, tak bisa diotomatiskan): kirim pesan berisi token WAV-XXXXXXXX
# dari HP ke nomor server (send_to dari start.hurl) via WhatsApp. Listener menangkap
# inbound → match → status VERIFIED.
#
# retry menunggu inbound: interval 3s x 100 ~= 5 menit (= TTL token).
#
# Jalankan manual (request_id dari capture start.hurl):
#   hurl --variable base_url=http://localhost:3111 \
#        --variable api_key=wav_sk_xxx \
#        --variable request_id=<id> \
#        hurl/wa-verify/poll.hurl
GET {{base_url}}/api/verify/{{request_id}}
x-api-key: {{api_key}}
[Options]
retry: 100
retry-interval: 3000

HTTP 200
[Captures]
final_status: jsonpath "$.status"
[Asserts]
jsonpath "$.status" == "VERIFIED"
