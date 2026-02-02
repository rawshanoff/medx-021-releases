# i18n Updates for Phase 2

## Add to `reception` section in ALL languages:

### English (en)
```typescript
reception: {
    // ... existing keys ...
    cash: "Cash",
    card: "Card",
    transfer: "Transfer",
    mixed: "Mixed",
    mixed_payment: "Mixed Payment",
    total_amount: "Total Amount",
    remaining: "Remaining",
    excess: "Excess",
    payment_complete: "Payment Complete!",
    no_results: "No patients found",
    create_new: "Create new patient",
    sample_first_name: "Ulug'bek or Улугбек",
    sample_last_name: "Rahmonov or Рахмонов",
},
```

### Russian (ru)
```typescript
reception: {
    // ... existing keys ...
    cash: "Наличные",
    card: "Карта",
    transfer: "Перевод",
    mixed: "Смешанная",
    mixed_payment: "Смешанная оплата",
    total_amount: "Общая сумма",
    remaining: "Осталось",
    excess: "Излишек",
    payment_complete: "Оплата завершена!",
    no_results: "Пациенты не найдены",
    create_new: "Создать нового пациента",
    sample_first_name: "Улугбек или Ulug'bek",
    sample_last_name: "Рахмонов или Rahmonov",
    date_format: "ДД.ММ.ГГГГ",
},
```

### Uzbek (uz)
```typescript
reception: {
    // ... existing keys ...
    cash: "Naqd",
    card: "Karta",
    transfer: "O'tkazma",
    mixed: "Aralash",
    mixed_payment: "Aralash to'lov",
    total_amount: "Umumiy summa",
    remaining: "Qoldi",
    excess: "Ortiqcha",
    payment_complete: "To'lov tugallandi!",
    no_results: "Bemorlar topilmadi",
    create_new: "Yangi bemor yaratish",
    sample_first_name: "Ulug'bek yoki Улугбек",
    sample_last_name: "Rahmonov yoki Рахмонов",
    date_format: "KK.OO.YYYY",
},
```

## Add to `common` section:

### English
```typescript
common: {
    // ... existing keys ...
    or: "or",
    cancel: "Cancel",
    save: "Save",
    currency: "UZS",
}
```

### Russian
```typescript
common: {
    // ... existing keys ...
    or: "или",
    cancel: "Отмена",
    save: "Сохранить",
    currency: "сум",
}
```

### Uzbek
```typescript
common: {
    // ... existing keys ...
    or: "yoki",
    cancel: "Bekor qilish",
    save: "Saqlash",
    currency: "so'm",
}
```

## Update placeholders in Reception component:

Change:
- `placeholder="Ali"` → `placeholder={t('reception.sample_first_name')}`
- `placeholder="Valiyev"` → `placeholder={t('reception.sample_last_name')}`
