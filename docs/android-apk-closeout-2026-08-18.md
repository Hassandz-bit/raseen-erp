# إغلاق APK التجريبي لـNawa ERP

تم إنشاء غلاف Android بواسطة Capacitor لتطبيق Nawa ERP. يستعمل الغلاف اسم الحزمة `com.nawa.erp`، اتصال HTTPS فقط، ويقيد التنقل إلى نطاق Nawa المحدد في إعداد البناء. أُضيف إذن الكاميرا كإذن اختياري؛ يطلب Capacitor الإذن عند استدعاء ماسح الباركود من WebView، وليس عند فتح التطبيق.

| تحقق الحزمة | النتيجة |
|---|---|
| نوع الحزمة | APK Debug قابل للتثبيت للاختبار الداخلي |
| المسار | `/home/ubuntu/nawa-erp-release-artifacts/NawaERP-debug.apk` |
| الحجم | 11 MB تقريباً |
| اسم الحزمة | `com.nawa.erp` |
| الصلاحيات | `INTERNET` و`CAMERA` فقط |
| التوقيع | Android Debug، مخطط v2 صالح |
| SHA-256 للملف | `b2f2b1ed672460576cc8e33a4d7c936081c224f8c0f8ae3665e1735dbffb9b83` |

## حدود النسخة الحالية

هذا ملف **اختبار داخلي** موقّع بمفتاح Android Debug. كما أنه يستخدم رابط معاينة Nawa HTTPS في `capacitor.config.ts` كي يمكن اختبار الكاميرا والمسح والطباعة فوراً. قبل الإصدار الفعلي أو Play Store يجب نشر نسخة الويب على نطاق إنتاج ثابت، ثم تعيين `NAWA_ANDROID_SERVER_URL` إلى ذلك النطاق، وتشغيل `cap sync android`، وبناء `assembleRelease` بمفتاح إصدار مملوك للمؤسسة ومحفوظ بأمان. لا تستخدم مفتاح debug أو رابط المعاينة لإصدار عام.

## المصدر المفتوح

تم الاعتماد على [Capacitor](https://github.com/ionic-team/capacitor) لتغليف التطبيق كـAndroid. يستحسن دعم المشروع بنجمة إذا أفاد الفريق.
