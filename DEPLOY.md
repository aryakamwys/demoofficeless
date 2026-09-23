# Deploy ke VPS (Docker)

## 1. Siapkan VPS (sekali saja)

```bash
# Ubuntu/Debian — install Docker + Compose
curl -fsSL https://get.docker.com | sh
```

## 2. Deploy / Update aplikasi

```bash
git clone https://github.com/aryakamwys/demoofficeless.git
cd demoofficeless

# Buat .env (isi dari Supabase + Kirimi dashboard)
cat > .env <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
KIRIMI_USER_CODE=<user-code>
KIRIMI_SECRET=<secret>
KIRIMI_DEVICE_ID=<device-id>
# Opsional — cache Redis (sangat disarankan di produksi)
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>
EOF

docker compose up -d --build
```

Aplikasi jalan di `http://<ip-vps>:3000`.

Update ke versi terbaru:

```bash
git pull && docker compose up -d --build
```

## 3. Domain + HTTPS (wajib untuk fitur kamera Inventory)

```bash
apt install -y nginx certbot python3-certbot-nginx

# /etc/nginx/sites-available/demoofficeless
# server {
#   server_name app.perkom.co.id;
#   location / {
#     proxy_pass http://127.0.0.1:3000;
#     proxy_set_header Host $host;
#     proxy_set_header X-Forwarded-Proto $scheme;
#   }
# }

ln -s /etc/nginx/sites-available/demoofficeless /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d app.perkom.co.id
```

## Catatan

- `SUPABASE_SERVICE_ROLE_KEY` **wajib diisi** — API employees/inventory/signatures
  memakai service client. Tanpa itu endpoint tersebut error.
- `NEXT_PUBLIC_*` dibake saat build image — kalau ganti nilainya, jalankan
  `docker compose up -d --build` (bukan cuma restart).
- Log aplikasi: `docker compose logs -f app`.
