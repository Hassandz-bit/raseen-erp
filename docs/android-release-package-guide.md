# حزمة Android لـ RASEEN ERP

## محتويات الإصدار

تتضمن حزمة التسليم ملف APK للتثبيت الداخلي وملف AAB لمسار Google Play أو الاختبارات المغلقة، إضافة إلى مشروع المصدر كاملاً وملف مثال لإعداد التوقيع. اسم الحزمة التقني هو `com.nawa.erp` للحفاظ على استمرارية التثبيت السابق، بينما الاسم الظاهر للمستخدم هو **RASEEN ERP**. الإصدار الحالي هو `1.1.0` ورقم الإصدار الداخلي `2`.

> ملفات APK وAAB المسلَّمة من هذا المسار مخصصة للاختبار الداخلي ما لم تُبنَ بمفتاح إصدار المؤسسة ونطاق HTTPS إنتاجي ثابت. لا تستخدم مفتاح Android Debug أو رابط معاينة مؤقت لإطلاق عام أو Google Play.

## رابط التطبيق المطلوب للإنتاج

قبل بناء حزمة عامة، عيّن متغير البيئة التالي إلى نطاق منشور وثابت يملكه المستخدم:

```bash
export NAWA_ANDROID_SERVER_URL="https://erp.example.com"
```

يجب أن يكون النطاق HTTPS، وأن يحافظ على المسار والجلسة المطلوبة للمنصة. لا تضع رابط معاينة مؤقت في إصدار المتجر.

## إنشاء مفتاح الإصدار وحمايته

لا تضع ملف JKS أو كلمات مروره في المشروع أو الرابط العام. احتفظ بنسخة مشفرة منه في خزنة أسرار مؤسسية مع نسخة استعادة منفصلة. استخدم الأوامر التالية محلياً على جهاز موثوق:

```bash
keytool -genkeypair -v \
  -keystore ../secure/raseen-release.jks \
  -alias raseen_release \
  -keyalg RSA -keysize 4096 -validity 10000
cp android/release-signing.properties.example android/release-signing.properties
```

بعد نسخ الملف، استبدل القيم النموذجية باسم ملف JKS وكلمات المرور الفعلية. لا تشارك ملف `release-signing.properties` أو JKS عبر البريد أو رابط تنزيل غير محمي.

## أوامر البناء

```bash
pnpm install --frozen-lockfile
pnpm build
export NAWA_ANDROID_SERVER_URL="https://erp.example.com"
pnpm exec cap sync android
cd android
./gradlew :app:assembleRelease :app:bundleRelease
```

ستكون المخرجات في `android/app/build/outputs/apk/release/` و`android/app/build/outputs/bundle/release/`. للاختبار الداخلي فقط، يمكن استعمال `assembleDebug` و`bundleDebug`؛ وهما لا يحلان محل توقيع المؤسسة.

## فحص الحزم

```bash
sha256sum android/app/build/outputs/apk/release/*.apk
sha256sum android/app/build/outputs/bundle/release/*.aab
apksigner verify --verbose android/app/build/outputs/apk/release/*.apk
bundletool validate --bundle=android/app/build/outputs/bundle/release/*.aab
```

اختبر التثبيت، تسجيل الدخول، الكاميرا، ماسح الباركود، الطباعة، وضع عدم الاتصال، ثم مسار تحديث التطبيق قبل رفع أي AAB إلى Google Play.
