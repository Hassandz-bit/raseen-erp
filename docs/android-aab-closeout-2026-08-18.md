# إغلاق AAB التجريبي لـNawa ERP

تم إنشاء Android App Bundle تجريبي لتطبيق Nawa ERP من غلاف Capacitor. الحزمة مخصصة للتحقق الداخلي ورفعها إلى مسارات اختبار مغلقة فقط بعد استبدال مفتاح debug بمفتاح إصدار المؤسسة.

| عنصر التحقق | النتيجة |
|---|---|
| الملف | `NawaERP-debug.aab` |
| الحجم | 8.6 MB تقريباً |
| SHA-256 | `53b39c4579146016d567e39319014f4841e4faab23edf31385b82fb564f8f185` |
| اسم الحزمة | `com.nawa.erp` |
| الإصدار | `versionCode 1` و`versionName 1.0` |
| الصلاحيات | `INTERNET` و`CAMERA` فقط |
| بنية AAB | `BundleConfig.pb` ووحدة `base` وملف dex موجودة |
| التحقق | اجتاز `bundletool validate` ونجح فحص manifest |

## قيد الإصدار

الحزمة الحالية موقعة بتوقيع **Debug** وتستخدم رابط معاينة HTTPS. لا تصلح للإصدار العام أو Google Play بهذه الحالة. قبل الإصدار الإنتاجي يجب اعتماد نطاق ويب منشور وثابت، تعيين `NAWA_ANDROID_SERVER_URL` إليه، رفع `versionCode`، وبناء `bundleRelease` باستخدام keystore مملوك للمؤسسة ومحفوظ في خدمة أسرار آمنة.

يعتمد التغليف على [Capacitor](https://github.com/ionic-team/capacitor) والتحقق على [Bundletool](https://github.com/google/bundletool). يستحسن دعم المشاريع بنجمة إذا أفادت الفريق.
