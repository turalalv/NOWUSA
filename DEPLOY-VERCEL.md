# No Sweat USA — Vercel + Neon

Kod Vercel üçün hazırlanıb. Canlı Neon bağlantısı, hosting hesabı və Shopify quraşdırılması ayrıca tamamlanmalıdır. Heç bir ödənişli plan avtomatik açılmır.

## Hesablar

- Neon Free verilənlər bazası kimi istifadə oluna bilər; cari saxlama və hesablama limitlərini hesabda yoxlayın. Şəkil ehtiyat nüsxələri də bazada yer tutur.
- No Sweat USA biznes tətbiqidir. Vercel Hobby şəxsi, qeyri-kommersiya istifadə üçündür; bu yerləşdirmə Pro planına və 600 saniyəlik funksiyalara əsaslanır.
- Vercel yalnız tətbiqi host edir. Mağaza Shopify-da qalır.

## 1. Neon bazası

Neon-da bu tətbiq üçün ayrıca boş layihə/baza yaradın. Connection details bölməsindən iki URL götürün:

- `DATABASE_URL`: connection pooling aktiv olan URL. Mövcud query parametrlərini saxlayaraq `&connection_limit=3&pool_timeout=20&connect_timeout=20` əlavə edin.
- `DIRECT_URL`: pooling deaktiv olan birbaşa URL; migration üçün istifadə olunur.

SSL parametrlərini saxlayın. URL-lərdə şifrə var: onları çata və Git-ə göndərməyin. Preview deployment üçün ayrıca test bazası istifadə edin.

## 2. Bazanın hazırlanması

`embedded-app` qovluğundakı Git-dən kənar `.env` faylına iki Neon URL-ni yazın. Sonra həmin qovluqda:

```sh
npm ci
npm run db:generate
npm run db:migrate
```

Bu migration bütün Shopify session, SEO, Google və şəkil cədvəllərini yaradır. PostgreSQL migration-ları `prisma/postgresql/migrations` altındadır. SQLite migration-ları ayrıca saxlanılır; yerli SQLite məlumatı avtomatik Neon-a köçürülmür. Köhnə məlumat varsa, əvvəl ehtiyat nüsxə və ayrıca köçürmə lazımdır.

Model dəyişikliklərinin mənbəyi `prisma/schema.prisma`-dır. `npm run db:generate` PostgreSQL sxemini ondan yaradır; model dəyişərsə ayrıca PostgreSQL migration da əlavə edilməlidir. Build migration işə salmır və production bazasını dəyişmir.

## 3. Vercel layihəsi

Vercel-ə repo-nu import edin; Root Directory olaraq repo kökündən `embedded-app`-a gedən yolu seçin. Bu qovluq repo köküdürsə `.` seçin. Framework **React Router**, Node.js **24.x**, build əmri `npm run build:vercel` olmalıdır. `vercel.json` artıq mövcuddur.

Production environment variables:

| Dəyişən | Dəyər |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `SHOPIFY_API_KEY` | No Sweat SEO tətbiqinin Client ID-si |
| `SHOPIFY_API_SECRET` | Həmin tətbiqin Client Secret-i |
| `SHOPIFY_APP_URL` | Sabit production HTTPS ünvanı, sonda `/` olmadan |
| `SCOPES` | `read_products,write_products,read_files,write_files` |
| `ALLOWED_SHOP` | `iyhxfe-mw.myshopify.com` |
| `INTEGRATION_ENCRYPTION_KEY` | 64 təsadüfi hex simvol, sonradan dəyişməyən açar |
| `CRON_SECRET` | Ən az 32 təsadüfi simvol |

Açarları terminalda lokal yaratmaq üçün `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` istifadə edilə bilər. İki açar üçün əmri ayrı-ayrılıqda çalışdırın və nəticələri secret kimi saxlayın.

Google inteqrasiyası üçün əlavə `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` və Google OAuth-da `https://APP-HOST/google/callback` tələb olunur. Google olmadan kataloq/SEO paneli işləyir.

Production URL Shopify-dan və onun webhook-larından əlçatan olmalıdır; Vercel login qorumasının arxasında qalmamalıdır. Preview-lara production secret-ləri verməyin.

## 4. Shopify quraşdırılması

`shopify.app.toml`-da `application_url`-ı production URL-ə, `redirect_urls`-ı həmin URL + `/auth/callback`-ə dəyişin. Əsas TOML-dakı icazələri saxlayın; boş scopes olan `dashboard` konfiqurasiyasını seçməyin.

```sh
shopify app config validate --config shopify.app.toml --json
shopify app deploy --config shopify.app.toml
```

Deploy tətbiq konfiqurasiyasını Shopify-a göndərir. Daha sonra Dev Dashboard-da custom distribution quraşdırma linki ilə yalnız No Sweat USA mağazasına Install edin. İlk yoxlamada kataloqu oxuyun; canlı SEO dəyişikliklərini tətbiqin ayrıca təsdiq addımı ilə edin.

## Gündəlik işlər və yoxlama

`vercel.json` production üçün 06:00 UTC-də Google, 06:30 UTC-də backlink yoxlamasını çağırır. Vercel `CRON_SECRET`-i Authorization başlığına əlavə edir. App daxilində müvafiq avtomatik yeniləmə seçimi açılmadan bu işlər heç nə yeniləmir. Xarici scheduler üçün əvvəlki POST `/jobs/daily` də işləyir. Gündəlik işlər Shopify məhsullarını dəyişmir.

Şəkil faylları 64 KB hissələrlə ötürülür; orijinallar Neon-da saxlanılır. Tətbiqdə 20 MB/fayl və 10 iş limiti var, buna görə Neon Free storage limitini izləyin.

Yerləşdirmədən əvvəl `npm run typecheck`, `npm test` və Vercel build-i yoxlanmalıdır. Canlı yoxlama: Install/OAuth, kataloq oxunması, draft saxlayıb yenidən açma, başqa instansiyada session davamlılığı, 4.5 MB-dan böyük şəkil önizləməsi və imzasız asset/cron sorğularının rədd edilməsi. Google varsa callback və cron-u da yoxlayın. Yerli testlər canlı Shopify/Neon/Vercel inteqrasiyasını əvəz etmir.

Mənbələr: [React Router on Vercel](https://vercel.com/docs/frameworks/frontend/react-router), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel Cron](https://vercel.com/docs/cron-jobs), [Neon](https://neon.com/pricing).
