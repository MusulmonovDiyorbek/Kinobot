# Kinobot

O‘zbek Telegram kino bot: Node.js 22+, MongoDB, Express va Telegram Bot API.

## Funksiyalar

- `/start`: salomlashish, sozlanadigan GIF va o‘zbekcha menyu.
- Kino kodi, nomi va kichik imlo xatolari bo‘yicha qidiruv.
- `/top`, `/last`, `/rand`, `/saved`, `/vip`, `/help`, `/dev`, `/cancel`.
- Inline rejim: `@bot_username kino` orqali sarlavha/yil kartasi va botga kino havolasi. Ochiq HTTPS poster URL berilgan bo‘lsa, kartada rasm chiqadi.
- Kino yuborish: Telegram video/document `file_id`; katta faylni serverga qayta yuklash talab qilinmaydi.
- Saqlangan kinolar, VIP kinolar va muddati tugaydigan VIP a’zolik.
- Majburiy public/private kanallar, haqiqiy a’zolik va Telegram join-request tekshiruvi.
- Admin panel: kino qo‘shish/o‘chirish, kanallar, statistika, broadcast, GIF, VIP, so‘rovlarni qabul/rad qilish.
- MongoDB’da saqlanadigan 30 daqiqalik admin sessiyalari va davom ettiriladigan broadcast navbati.
- Webhook maxfiy kaliti, update deduplikatsiyasi, per-user ketma-ket ishlov, rate limit va maxfiylikni saqlaydigan loglar.

## Muhim

Avvalgi ochiq repoda `.env` bo‘lgan. BotFather’da eski tokenni `/revoke` qilib almashtiring. `.env`ni yangi koddan olib tashlash eski Git tarixidagi tokenni yo‘q qilmaydi. Eski tokenni ishlatmang.

## Render

`render.yaml` Blueprint tayyor; bot tashqi MongoDB Atlas bazasidan foydalanadi. Render xizmati to‘g‘ridan-to‘g‘ri ham yaratilishi mumkin:

- Runtime: Node; build: `npm ci --omit=dev`; start: `npm start`.
- `BOT_MODE=webhook`, `NODE_ENV=production`.
- `BOT_TOKEN`: yangi BotFather tokeni.
- `ADMIN_IDS`: vergul bilan ajratilgan musbat Telegram user IDlari.
- `MONGODB_URI`: MongoDB Atlas database user ulanish URI; mahalliy `127.0.0.1` ishlamaydi.
- `WEBHOOK_SECRET`: 32–256 ta harf/raqam/`_`/`-`. Blueprint o‘zi generatsiya qiladi.
- `SUPPORT_USERNAME`: yordam/VIP uchun Telegram username, `@`siz (ixtiyoriy).

Render `RENDER_EXTERNAL_URL`ni beradi; `WEBHOOK_URL`ni qo‘lda kiritish shart emas. Boshqa serverda HTTPS manzilni `WEBHOOK_URL`ga yozing.

MongoDB Atlas’da database user yarating, Connect → Drivers orqali URI oling va paroldagi maxsus belgilarni URL-encode qiling. Atlas Network Access’da Render xizmatining outbound IP diapazonlariga ruxsat bering (Render → Connect → Outbound). Atlas saytiga kirish paroli bilan database user paroli boshqa-boshqa.

`/live` — HTTP jarayoni tirikligini tekshiradi. `/health` — MongoDB va Telegram ulanishi tayyor bo‘lsa **200**, aks holda **503**. Secretlar yetishmasa HTTP ochiladi, ammo bot tayyor deb ko‘rsatilmaydi. Env qiymatlari qo‘shilganda xizmatni qayta deploy qiling.

Render bepul web xizmatlari bo‘sh turganda uxlaydi. Webhook uyg‘otishi mumkin, ilk javob kechikadi. Uxlayotgan paytda broadcast navbati ishlamaydi; qayta uyg‘onganda davom etadi. Doimiy, tezkor ishlash uchun doim ishlaydigan xizmat kerak. Faqat bitta instance ishlating.

## BotFather

1. `/setinline` → botni tanlang → `Kino nomi yoki kodini yozing`.
2. Bot username’ini o‘zgartirsangiz xizmatni restart qiling.
3. Buyruqlar ro‘yxati ishga tushganda avtomatik o‘rnatiladi.
4. Botni majburiy kanallarga administrator qiling. Private so‘rovlari uchun **Invite users** huquqini bering.

## Admin

`/admin` faqat `ADMIN_IDS`dagi foydalanuvchi bilan shaxsiy chatda ishlaydi.

**Kino qo‘shish:** nom → kod → `Yil | Til | Janr | free/vip` → tavsif yoki `-` → poster fotosi/HTTPS URL/`-` → video/document → tasdiqlash.

Misol: `2014 | O‘zbek | Fantastika | free`.

**Kanal qo‘shish:**

```text
@public_username | auto | Kanal nomi | public | member
-1001234567890 | auto | Shaxsiy kanal | private | member
-1001234567890 | auto | So‘rovli kanal | private | request
```

`auto` private kanal uchun botning o‘z join-request havolasini yaratadi; shu variant tavsiya etiladi. Qo‘lda link kiritilsa u to‘g‘ri kanalniki va so‘rov yuboradigan link ekanini admin tekshiradi.

- `member`: faqat Telegram tasdiqlagan haqiqiy a’zolik kirish beradi. Admin → Kanal so‘rovlari → Qabul qilish/Rad qilish.
- `request`: haqiqiy `chat_join_request` yuborgan odamga so‘rov kutilayotgan vaqtida 24 soat kirish beradi. Rad etilgan/chiqib ketgan/bloklangan odam o‘tmaydi. “Opened” bosish hech qanday huquq bermaydi.
- Kanalning eski `joinedUsers` ma’lumotlari kirish dalili sifatida ishlatilmaydi.

**VIP:**

```text
/vipgive 123456789 30
/vipremove 123456789
/movievip 101 on
/movievip 101 off
```

Foydalanuvchi oldin `/start` bosgan bo‘lishi kerak. VIP to‘lovi avtomatlashtirilmagan: admin to‘lovni tekshirib muddat beradi.

**Broadcast:** xabar yuborish → preview → tasdiqlash. Navbat MongoDB’da saqlanadi. 429 cheklovlarida qayta uriniladi; botni bloklaganlar belgilanadi. Xizmat restart bo‘lsa taxminan ikki daqiqalik lease tugagach navbat davom etadi. Jarayon Telegramga yuborib, checkpoint saqlash orasida o‘chsa, oxirgi xabar takrorlanishi mumkin (at-least-once).

**Start GIF:** `/admin` → Start GIF → animation/GIF yuboring. Yoki `START_GIF_FILE_ID` environment variable. GIF sozlanmagan bo‘lsa salomlashish matn bilan chiqadi.

## Inline va majburiy obuna

Inline karta chatga kino havolasini yuboradi. Videoning o‘zi shaxsiy bot chatida obuna va VIP tekshiruvidan keyin yuboriladi. Bu format katalogni ulashish orqali obunani chetlab o‘tishni oldini oladi. Telegram’dan olingan video foydalanuvchi tomonidan qayta ulashilishi mumkin; bot DRM emas.

## Linux Mint / Docker

```bash
cp .env.example .env
# .env ichida BOT_TOKEN, ADMIN_IDS, MONGODB_URI qiymatlarini kiriting
npm ci
npm start
```

Docker Compose MongoDB’ni lokal persistent volume bilan yaratadi:

```bash
cp .env.example .env
# BOT_TOKEN va ADMIN_IDS ni kiriting; Compose MongoDB URI ni beradi
docker compose up -d --build
docker compose logs -f bot
```

MongoDB tashqi portga ochilmaydi, HTTP localhost:3000’da. Bitta token uchun polling va Render webhookni bir payt ishlatmang.

## Tekshiruvlar

```bash
npm ci
npm run check
npm test
npm audit --omit=dev
```

Integration testlar MongoDB 7 binary’sini birinchi safar yuklab olib, izolyatsiyalangan test bazasini yaratadi. Haqiqiy Telegram API testlarda mock qilingan: jonli token/baza bilan `/health`, `/start`, inline va kanal so‘rovini alohida sinash kerak.

## Ma’lumotlar va texnik chegaralar

`users`, `movies`, `channels`, `joinrequests`, `sessions`, `broadcasts`, `settings`, `updatereceipts` MongoDB’da saqlanadi. Movie `code` unique. Ma’lum eski matn indeksi kerak bo‘lsa yangilanadi, boshqa indekslar o‘chirib tashlanmaydi. `language` kino metama’lumoti qidiruv stemmeri bilan aralashmaydi.

Katta katalogda xato yozilgan nomlarni fuzzy qidirish 500 ta mashhur nom bilan cheklanadi; kattaroq katalog uchun Atlas Search alohida qo‘shiladi. Telegramga yuborish va MongoDB checkpoint bir atomik tranzaksiya emas; webhook qayta urinishida yoki crashda oxirgi tashqi amal takrorlanishi mumkin. MongoDB Atlas backuplarini sozlang; eski lokal bazadagi kinolar avtomatik ko‘chirilmaydi.
