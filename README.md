# 🌟 السيرة النبوية الشريفة ﷺ

> **صَدَقَةٌ جَارِيَةٌ عَن مُحَمَّد هَاشِم ضَيْف الله وعن والديه رحمهما الله تعالى وأسكنهما الفردوس الأعلى من الجنة.**

تطبيق ويب سحابي تفاعلي متطور وفاخر مبني بأحدث معايير الويب باستخدام **Next.js (App Router + React 19 + TypeScript)** ومتصل بسحابة **Firebase (Firestore & Storage)** لتسجيل وعرض ومتابعة رحلة السيرة النبوية العطرة من المولد النبوي الشريف إلى الرفيق الأعلى ﷺ.

---

## ✨ المميزات الرئيسية

1. **سحابي وحي 100% (Realtime Cloud Sync)**:
   - جميع الحلقات، التعديلات، والتأملات مخزنة في **Cloud Firestore**.
   - لا حاجة لتنزيل أي ملفات أو إعادة بناء الموقع؛ أي إضافة من هاتفك أو جهازك تنعكس فوراً وتلقائياً على شاشات جميع الزوار حول العالم لحظياً وبدون Refresh.
2. **تسجيل ومشغل صوتي مباشر**:
   - إمكانية تسجيل الصوت مباشرة من ميكروفون الهاتف أو الحاسوب، ورفعه تلقائياً إلى **Firebase Storage** مع مؤشر تقدم الرفع.
   - دعم رفع الملفات الصوتية الجاهزة (MP3, WAV, M4A).
   - مشغل صوتي يدعم تغيير سرعة القراءة (0.75x, 1.0x, 1.25x, 1.5x, 2.0x).
3. **قارئ صوتي آلي ودمج Gemini**:
   - قارئ صوتي فوري مدمج (Web Speech API) ينطق نص الحلقة باللغة العربية داخل الموقع بنقرة زر.
   - زر نسخ وتجهيز فوري للنص لتطبيقه داخل Google Gemini للقراءة الصوتية المؤثرة.
4. **جماليات ملكية وتجاوب فائق (Desktop & Mobile)**:
   - **على سطح المكتب (Desktop)**: شريط جانبي ثابت لفهرس الحلقات مع البحث والفرز، ومساحة قراءة واسعة ومريحة للعين.
   - **على الهاتف (Mobile)**: تجربة تطبيق ذكي أصيل مع قائمة منزلقة (Drawer)، وشريط سفلي عائم مريح باليد الواحدة، ودعم إيماءات السحب باللمس (Swipe gestures).
5. **نظام طباعة وثيمات فاخر**:
   - 4 ثيمات منسقة بعناية: (كحل ملكي، الذهب والظلال، رملي دافئ، ونهاري نقي).
   - 4 خطوط عربية أصيلة: (الأميري القرآني، الرقعة الشريف، النسخ، وخط كايرو العصري).
   - أزرار تكبير وتصغير حجم الخط.
   - تنسيق مخصص ومميز للآيات القرآنية بأقواس وزخارف مذهبة ﴿ ... ﴾، وللأحاديث الشريفة، والأبيات الشعرية.
6. **تأملات شخصية ومفضلة**:
   - قسم خاص لتدوين الخواطر والفوائد والاستنباطات من كل حلقة مع حفظها سحابياً.
   - إمكانية حفظ الحلقات في المفضلة وتتبع نسبة إنجاز القراءة.
7. **مشاركة سهلة**:
   - مشاركة مقتطفات الحلقات بنقرة واحدة عبر واتساب وتيليجرام وتويتر/X ورابط مباشر.

---

## 🛠️ التقنيات المستخدمة

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19 + TypeScript
- **Icons**: Lucide React
- **Typography**: Google Fonts (Amiri, Aref Ruqaa, Cairo, Noto Naskh Arabic)
- **Cloud Database**: Firebase Cloud Firestore (Modular SDK v10)
- **Cloud Storage**: Firebase Storage
- **Styling**: Vanilla CSS Design System with CSS Custom Properties & Glassmorphism

---

## 🔒 قواعد أمان Firebase (مهم جداً للعمل بدون مشاكل)

لكي يتمكن التطبيق من حفظ وقراءة الحلقات والتسجيلات الصوتية مباشرة، تأكد من ضبط قواعد الأمان في [Firebase Console](https://console.firebase.google.com):

### 1. قواعد Firestore (Firestore Rules)
اذهب إلى **Firestore Database** > تبويب **Rules** وضع الكود التالي:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 2. قواعد التخزين (Storage Rules)
اذهب إلى **Storage** > تبويب **Rules** وضع الكود التالي:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 🚀 التشغيل المحلي (Local Development)

```bash
# تثبيت الحزم
npm install

# تشغيل خادم التطوير
npm run dev
```

افتح المتصفح على: `http://localhost:3000`

---

## 🌐 النشر على GitHub Pages

المشروع مزود بملف سير عمل تلقائي جاهز (`.github/workflows/deploy.yml`):

1. في مستودعك على GitHub، اذهب إلى تبويب **Settings**.
2. من القائمة الجانبية، اختر **Pages**.
3. تحت خيار **Build and deployment**:
   - غيّر **Source** من Deploy from a branch إلى: **GitHub Actions**.
4. بمجرد رفع الكود عبر `git push`، سيقوم GitHub ببناء الموقع ونشره تلقائياً ليكون متاحاً على الرابط:
   `https://mostafayasserdev.github.io/Stories.Prophets/`
