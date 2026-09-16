# 🛡️ قواعد أمان Firebase (Firebase Security Rules)

قم بنسخ كل قاعدة ولصقها في القسم المخصص لها في [Firebase Console](https://console.firebase.google.com):

---

## 1. قواعد قاعدة البيانات: Firestore Database Rules
📍 **مكان اللصق**: `Firebase Console` > `Firestore Database` > تبويب `Rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // السماح بالقراءة والكتابة لجميع المجموعات (الحلقات، التأملات، الإعدادات)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
*(بعد اللصق اضغط على زر **Publish**)*

---

## 2. قواعد الملفات الصوتية: Firebase Storage Rules
📍 **مكان اللصق**: `Firebase Console` > `Storage` > تبويب `Rules`

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // السماح برفع وتشغيل التسجيلات الصوتية والملفات الصوتية
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```
*(بعد اللصق اضغط على زر **Publish**)*
