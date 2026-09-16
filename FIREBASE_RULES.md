# 🛡️ قواعد أمان Firebase (Firestore Security Rules فقط)

> **ملاحظة مهمة**: تم إلغاء استخدام Firebase Storage بالكامل بناءً على طلبك لتفادي أي اشتراك مدفوع أو طلب بطاقة ائتمان.
> **أنت تحتاج فقط إلى تفعيل قواعد Cloud Firestore المجانية 100%!**

---

## 📍 قواعد Firestore (قاعدة البيانات السحابية المجانية)
اذهب إلى [Firebase Console](https://console.firebase.google.com) > ادخل مشروعك > اضغط **Firestore Database** من القائمة الجانبية > افتح تبويب **Rules**، وضع هذا الكود فقط ثم اضغط **Publish**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // السماح بالقراءة والكتابة المجانية لجميع الحلقات والتأملات
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

### 🎵 كيف يعمل الصوت الآن بدون Firebase Storage؟
1. **روابط الصوت الخارجية (Free Audio URLs)**:
   - يمكنك وضع رابط أي ملف صوتي MP3 مباشر (من Archive.org المجاني تماماً أو Google Drive أو أي استضافة مجانية). يُحفظ الرابط مباشرة في Firestore!
2. **التسجيل الصوتي المباشر بالميكروفون**:
   - يُحفظ التسجيل الصوتي مباشرة في مستند الحلقة داخل **Firestore** دون الحاجة إلى خدمة Storage المدفوعة إطلاقاً.
3. **القارئ الصوتي الآلي المدمج (Web Speech)**:
   - مجاني 100% ولا يحتاج لأي تخزين، يقرأ النص مباشرة باللغة العربية داخل المتصفح.
