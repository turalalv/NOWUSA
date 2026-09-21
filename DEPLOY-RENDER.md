# NOWUSA — pulsuz Render + Neon quraşdırılması

## Cari yerləşdirmə — 2026-09-21

- Tətbiq: https://nowusa.onrender.com
- Shopify: https://admin.shopify.com/store/iyhxfe-mw/apps/no-sweat-seo/app
- Render Free servis: `srv-daomnomgekts73as900g`, Frankfurt; blueprint `exs-daomma2jnfac73eskj80`.
- Mövcud Neon Free layihəsi: `NOWUSA` / `sweet-bread-44269010`, AWS Ohio; `production` branch. Mövcud bazanın regionu dəyişdirilməyib.
- Shopify-da aktiv versiya: `no-sweat-seo-2`. App URL və `/auth/callback` Render domeninə bağlanıb; mövcud scopes və iki webhook konfiqurasiyası CLI ilə yayımlanıb.
- Build, ilkin PostgreSQL miqrasiyası, `/healthz` (200 / `ok`), Shopify daxilində giriş və kataloq importu (6 məhsul, 2 kolleksiya) uğurludur.
- Google Search Console bağlantısı, gündəlik scheduler, webhook çatdırılması və canlı məhsul/şəkil redaktəsi bu yerləşdirmə yoxlamasına daxil deyil.

Render-də baza bağlantıları və tətbiq secret-i saxlanılıb; onları Git-ə əlavə etməyin. Aşağıdakı addımlar yeni yerləşdirmə üçündür.

Tətbiq **Render Free**, məlumatlar **Neon Free** üzərində yerləşir. Repo-dakı `render.yaml` yalnız bir pulsuz web service yaradır; ödənişli disk, database və cron yaratmır. Render Free fasiləsiz production xidməti üçün tövsiyə edilmir: 15 dəqiqə istifadə olmadıqda dayanır, növbəti açılış təxminən bir dəqiqə çəkə bilər. Əvvəl sınaq edin; Shopify girişinin, webhook-ların və şəkil yeniləməsinin canlı yoxlanması lazımdır.

## 1. Pulsuz Neon bazası

[Neon](https://console.neon.tech)-da Free plan ilə ayrıca `nowusa` layihəsi yaradın. Render blueprint-i Frankfurt regionundan istifadə edir; mümkündürsə bazanı da Frankfurt-da yerləşdirin.

Connect bölməsindən bu iki bağlantını götürün:

- `DATABASE_URL`: connection pooling aktiv olan PostgreSQL URL.
- `DIRECT_URL`: pooling deaktiv olan PostgreSQL URL; migration üçün.

SSL parametrlərini saxlayın. Pooled URL-in mövcud query parametrlərinə `&connection_limit=3&pool_timeout=20&connect_timeout=20` əlavə edin. Bu URL-lər şifrə saxlayır: yalnız Render-in secret sahələrinə daxil edin.

## 2. GitHub-dan Render-ə qoşulma

1. [Render Dashboard](https://dashboard.render.com)-da GitHub ilə daxil olun.
2. **New → Blueprint** seçin və **`turalalv/NOWUSA`** reposuna giriş verin.
3. Branch **main**, Blueprint faylı **render.yaml** olsun.
4. Resurs siyahısında `nowusa` web service-in planının **Free** olduğunu yoxlayın.
5. Soruşulan üç secret-i doldurun:

| Sahə | Mənbə |
| --- | --- |
| `DATABASE_URL` | Neon pooled bağlantısı |
| `DIRECT_URL` | Neon direct bağlantısı |
| `SHOPIFY_API_SECRET` | Shopify Dev Dashboard → No Sweat SEO → Settings → Client Secret |

Client ID, mağaza domeni və scopes hazır konfiqurasiyadadır. Şifrələmə və cron açarlarını Render təsadüfi yaradıb saxlayır. `start:render` şifrələmə açarını eyni baytları saxlayaraq base64-dən hex-ə çevirir; açar restart zamanı yenilənmir. Əvvəlki hostdan köçürürsünüzsə, onun mövcud `INTEGRATION_ENCRYPTION_KEY` dəyərini saxlayın — yeni açar əvvəlki Google tokenlərini oxuya bilməz.

6. **Deploy Blueprint** edin. Build tamamlandıqdan sonra startup Neon cədvəllərini yaradır və serveri açır. Yerli SQLite məlumatı Neon-a avtomatik köçürülmür.

Əl ilə **New → Web Service** istifadə edilərsə: runtime **Node**, plan **Free**, root directory **boş / repo kökü**, build command `npm ci --include=dev && npm run build:render`, start command `npm run start:render`, health check `/healthz`, Node **24** seçilməlidir. Blueprint-dəki bütün environment variables da ayrıca daxil edilməlidir; Blueprint yolu daha az əl işi tələb edir.

## 3. Shopify ilə bağlantı

Render **Live** göstərəndə onun verdiyi real `https://….onrender.com` ünvanını götürün. Proqram bu ünvanı avtomatik `SHOPIFY_APP_URL` kimi istifadə edir; əvvəlcədən domen təxmin etmək lazım deyil.

Shopify tətbiqində:

- App URL: `https://REAL-RENDER-URL.onrender.com`
- Redirect URL: `https://REAL-RENDER-URL.onrender.com/auth/callback`
- Embedded app: aktiv
- Scopes: `read_products,write_products,read_files,write_files`

Bu URL-ləri `shopify.app.toml`-a da yazın. Sonra düzgün əsas config-i validate/deploy edin və No Sweat USA üçün custom distribution quraşdırma linki ilə Install edin. Render hostunu açmaq Shopify-da tətbiqi avtomatik quraşdırmır.

## Pulsuz planla işləmə

- İlk istifadədən əvvəl Render ünvanını açıb servis oyandıqdan sonra Shopify Apps-dən daxil olun. Bu, hər dəfə problemsiz OAuth və webhook çatdırılmasına zəmanət vermir.
- Render və Neon-un aylıq limitlərini izləyin. Limitsiz və ya fasiləsiz pulsuz xidmət vəd edilmir. Render usage limitində xidməti dayandıra bilər; qeyri-adi çox xarici API/database trafiki də məhdudlaşdırıla bilər. Ödəniş məlumatı əlavə etməzdən əvvəl billing/spend parametrlərini yoxlayın.
- Google və backlink yeniləmələrini paneldən əl ilə başladın. `vercel.json` cron-ları Render-də işləmir; bu blueprint avtomatik gündəlik scheduler yaratmır. Ayrı scheduler qurulmadan paneldəki daily seçimləri təkbaşına gündəlik iş başlatmır.
- Google inteqrasiyası istənirsə `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` və Google OAuth-da real Render URL + `/google/callback` əlavə edin.
- Şəkil ehtiyat nüsxələri də Neon storage yerini istifadə edir; vacib orijinalları endirib ayrıca saxlayın. Xüsusən böyük şəkillər üçün Free serverin yaddaş limitini nəzərə alaraq əvvəl kiçik sınaq edin.
- Yeni yerləşdirmədə Render/Neon hesablarına giriş, secret-lərin yazılması və Shopify Install ayrıca tamamlanmalıdır; yuxarıdakı cari yerləşdirmədə bunlar tamamlanıb.

Mənbələr: [Render Free məhdudiyyətləri](https://render.com/docs/free), [Blueprint konfiqurasiyası](https://render.com/docs/blueprint-spec), [Render environment variables](https://render.com/docs/environment-variables), [Neon planları](https://neon.com/pricing).
