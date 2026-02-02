# Quick i18n Update Script
# Add these lines manually to frontend/src/i18n.ts

## For Russian (ru) section around line 181, REPLACE the auth section with:
```
auth: {
    welcome: "Добро пожаловать в MedX",
    login: "Войти",
    username: "Имя пользователя",
    password: "Пароль",
    username_placeholder: "Введите имя пользователя",
    password_placeholder: "Введите пароль",
    login_failed: "Ошибка входа. Проверьте учетные данные.",
    default_credentials: "Данные по умолчанию:",
    upload_key: "Загрузите лицензионный ключ для активации системы.",
    click_upload: "Нажмите для выбора .key файла",
    activate_btn: "Активировать систему",
    activating: "Активация...",
    invalid_key: "Неверный лицензионный ключ."
},
```

## For Uzbek (uz) section around line 320, REPLACE the auth section with:
```
auth: {
    welcome: "MedX ga xush kelibsiz",
    login: "Kirish",
    username: "Foydalanuvchi nomi",
    password: "Parol",
    username_placeholder: "Foydalanuvchi nomini kiriting",
    password_placeholder: "Parolni kiriting",
    login_failed: "Kirish xatosi. Ma'lumotlarni tekshiring.",
    default_credentials: "Standart ma'lumotlar:",
    upload_key: "Tizimni faollashtirish uchun litsenziya kalitini yuklang.",
    click_upload: ".key faylini tanlash uchun bosing",
    activate_btn: "Tizimni faollashtirish",
    activating: "Faollashtirish...",
    invalid_key: "Noto'g'ri litsenziya kaliti."
},
```

## ALSO add to common section for ALL languages (en, ru, uz):
```
// In English common section (around line 33):
or: "or",
loading: "Loading..."

// In Russian common section (around line 169):
or: "или",
loading: "Загрузка..."

// In Uzbek common section (around line 308):
or: "yoki",
loading: "Yuklanmoqda..."
```

After updating, the login page will show proper text instead of keys!

