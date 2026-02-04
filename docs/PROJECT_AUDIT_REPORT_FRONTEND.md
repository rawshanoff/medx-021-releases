# 🕵️‍♂️ Project Audit Report (Extended - Frontend Focus)

**Date:** 2026-02-04  
**Status:** ⚠️ **Warning** (критические проблемы найдены, но система функциональна)

---

## Overview

Этот отчет является расширением основного `PROJECT_AUDIT_REPORT.md` с фокусом на фронтенд части приложения.

---

## 🎨 Frontend & UI Issues (Detailed)

### 1. Hardcoded Strings (i18n Issues)

#### System.tsx - Form Labels (CRITICAL FOR PRODUCTION)

- [x] **`frontend/src/pages/System.tsx`**: устаревшее замечание — страница “System” теперь реэкспортит `SystemSettingsPage` (формы перенесены). Хардкоды в Users‑разделе исправлены.
  ```tsx
  <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
    Username
  </label>
  ```
  **Fix:** `{t('system.username')}`

- [x] См. пункт выше.
  ```tsx
  <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
    Password
  </label>
  ```
  **Fix:** `{t('system.password')}`

- [x] См. пункт выше.
  ```tsx
  <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
    Full Name
  </label>
  ```
  **Fix:** `{t('system.full_name')}`

- [x] См. пункт выше.
  ```tsx
  <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
    Role
  </label>
  ```
  **Fix:** `{t('system.role')}`

- [x] **Роли**: добавлены ключи `roles.*` в `locales/*.json`, выпадающий список использует `tr('roles.*', fallback)`.
  ```tsx
  <option value="admin">Admin</option>
  <option value="owner">Owner</option>
  <option value="doctor">Doctor</option>
  <option value="registrar">Registrar</option>
  <option value="cashier">Cashier</option>
  ```
  **Fix:** Use translated options or map from enum with translations

#### Login.tsx - Password Toggle Label (MINOR)

- [x] **`frontend/src/pages/Login.tsx`**: `common.hide/common.show` добавлены в `locales/*.json`, defaultValue приведён к английскому.
  ```tsx
  aria-label={
    showPassword
      ? t('common.hide', { defaultValue: 'Скрыть' })
      : t('common.show', { defaultValue: 'Показать' })
  }
  ```
  **Issue:** `defaultValue` contains Cyrillic, should be English
  **Fix:** `{ defaultValue: 'Hide' } / { defaultValue: 'Show' }`

#### Archive.tsx - Multiple i18n Fallbacks (WARNING)

- [ ] **`frontend/src/pages/Archive.tsx:116, 119, 158, 179`**: Excessive use of `defaultValue` with Cyrillic strings indicates missing translation keys:
  ```tsx
  {t('archive.title', { defaultValue: 'Архив' })}
  {t('archive.description', { defaultValue: 'Восстановление удалённых записей' })}
  {t('archive.empty', { defaultValue: 'Нет удалённых записей' })}
  {t('archive.restore', { defaultValue: 'Восстановить' })}
  ```
  **Recommendation:** Add these keys to all locale files (en.json, ru.json, uz.json)

- [ ] **`frontend/src/pages/Archive.tsx:55`**: Similar fallback:
  ```tsx
  showToast(t('archive.restored', { defaultValue: 'Восстановлено' }), 'success')
  ```

#### Sidebar.tsx - Comment with Cyrillic (MINOR CODE QUALITY)

- [x] **`frontend/src/components/Sidebar.tsx`**: комментарий приведён к английскому.
  ```tsx
  // Запись/appointments пока отключаем (по просьбе)
  ```
  **Fix:** Use English comments: `// Appointments disabled on request`

#### Sidebar.tsx - i18n Fallback (MINOR)

- [ ] **`frontend/src/components/Sidebar.tsx:55`**: Fallback with Cyrillic:
  ```tsx
  label: t('nav.archive', { defaultValue: 'Архив' }),
  ```

### 2. Console Output in Production Code

- [x] **`frontend/src/components/Topbar.tsx`**: `console.debug()` заменён на `loggers.system.debug(...)`.
  ```typescript
  console.debug('Update check failed:', error);
  ```
  **Fix:** `loggers.updater.debug('Update check failed:', error)`

### 3. Potential Locale Issues

#### QueueTV.tsx - Hardcoded Locale

- [x] **`frontend/src/pages/QueueTV.tsx`**: локаль для даты теперь выбирается динамически из `i18n.language` (ru/uz/en).
  ```typescript
  {new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}
  ```
  **Issue:** Always shows Russian date format, regardless of selected language
  **Fix:** Use i18n to get current locale and format date accordingly

### 4. UI Components with Missing Error States

- [ ] **`frontend/src/pages/Patients.tsx`**: Modal or form validation may not show all errors clearly
  **Recommendation:** Add error boundary and better error messages

- [ ] **`frontend/src/pages/Finance.tsx`**: Payment forms should have better validation feedback

### 5. Type Safety Issues

- [ ] **`frontend/src/pages/Archive.tsx:164`**: Type casting with `as any`:
  ```typescript
  key={`${item.type}-${(item.data as any).id}-${index}`}
  ```
  **Better:** Use proper type guards or ensure types are correct

### 6. Unused Imports & Dead Code

- [ ] **`frontend/src/pages/Activation.tsx:5`**: Conditional import that might not be necessary:
  ```typescript
  import '../i18n'; // Comment says "just in case"
  ```
  **Recommendation:** Remove if i18n is initialized in App.tsx

### 7. Event Handler Validation

✅ **PASS**: All checked pages have proper event handlers:
- Login.tsx: `handleLogin` on form, `onClick` for password toggle
- Archive.tsx: `onClick` for tabs, `onClick` for restore button
- Activation.tsx: `onChange` for file input, `onClick` for activate button
- QueueTV.tsx: Event listeners setup correctly

---

## 🌍 4. Localization (i18n) Gaps (Complete List)

### Missing Translation Keys (Likely)

Based on defaultValue usage, these keys may not exist in all locales:

**ru.json:**
- `archive.title` ✓ (has fallback)
- `archive.description` ✓ (has fallback)
- `archive.empty` ✓ (has fallback)
- `archive.restore` ✓ (has fallback)
- `archive.restored` ✓ (has fallback)
- `archive.tabs.patients` (check if exists)
- `archive.tabs.doctors` (check if exists)
- `archive.tabs.users` (check if exists)
- `common.hide` (used in Login.tsx)
- `common.show` (used in Login.tsx)
- `common.role` (used in Archive.tsx)
- `system.username` (needed - currently hardcoded)
- `system.password` (needed - currently hardcoded)
- `system.full_name` (needed - currently hardcoded)
- `system.role` (needed - currently hardcoded)

**en.json & uz.json:**
- Same keys as above

### Locale Format Issues

- [ ] **`frontend/src/pages/QueueTV.tsx:70`**: Uses hardcoded `'ru-RU'` instead of dynamic locale
  **Affected Locales:** en, uz users will see Russian date format

---

## 🧹 5. Code Quality & Cleanup (Frontend)

### Deprecation Warnings

- [ ] **Multiple files**: Potential styled-components or CSS-in-JS issues
  **Recommendation:** Audit Tailwind configuration

### Code Patterns

✅ **GOOD:**
- Proper use of `useTranslation()` hook in most components
- Good error handling with try-catch blocks
- Proper use of React hooks (useMemo, useCallback, useRef)
- Clean TypeScript type definitions

⚠️ **ISSUES:**
- Some components use `(item as any)` type assertions
- Excessive use of `defaultValue` in i18n calls (indicates missing keys)
- Hardcoded strings in admin forms

### Unused Imports

- [ ] **`frontend/src/pages/Activation.tsx:6`**: Conditional import of `../i18n` - verify if needed

---

## 📊 5a. Component-by-Component Analysis

### Login.tsx
- ✅ Proper form handling with `onSubmit`
- ✅ Error message display
- ✅ Loading states
- ⚠️ Password toggle aria-label has English defaultValue (OK but inconsistent)
- ✅ Proper i18n usage for visible text

### QueueTV.tsx
- ✅ Good use of Web Audio API with error handling
- ✅ Proper React hooks
- ✅ Auto-refresh logic
- ⚠️ Hardcoded `'ru-RU'` locale for date display
- ⚠️ `console.warn()` in catch block (should use logger)

### Archive.tsx
- ✅ Tab switching logic
- ✅ Item restore functionality
- ⚠️ Multiple i18n fallbacks with Cyrillic
- ⚠️ Type casting with `as any`
- ⚠️ No loading spinner visible during refresh

### Activation.tsx
- ✅ File upload handling
- ✅ License verification flow
- ✅ Error display
- ⚠️ Unnecessary i18n import at top level

### Patients.tsx
- ✅ Complex search functionality
- ✅ Patient creation logic
- ✅ File management
- ✅ Proper state management
- ⚠️ Some defaultValue fallbacks

### Sidebar.tsx
- ✅ Role-based navigation
- ✅ Clean nav item structure
- ⚠️ Cyrillic comment
- ⚠️ Archive nav has i18n fallback

### Topbar.tsx
- ✅ Update check functionality
- ⚠️ `console.debug()` instead of logger
- ✅ Proper error handling otherwise

---

## 🔍 Frontend Testing Coverage

Created `frontend/src/test/audit_smoke_test.ts` with checks for:
- ✅ Component imports
- ✅ i18n configuration
- ✅ API client setup
- ✅ Type definitions
- ✅ Utility functions
- ✅ Context providers
- ✅ Code quality patterns
- ✅ Accessibility features
- ✅ Performance patterns

---

## Priority Fixes for Production

### 🔴 Critical (Before Release)
1. Fix hardcoded English labels in `System.tsx` form (Username, Password, Full Name, Role)
2. Ensure all role options are translated
3. Verify all i18n keys exist in all three locales (en, ru, uz)

### 🟡 High (Within Sprint)
1. Fix `QueueTV.tsx` locale hardcoding (should be dynamic)
2. Replace `console.debug()` with logger in `Topbar.tsx`
3. Add missing translation keys identified with defaultValue

### 🟢 Medium (Technical Debt)
1. Remove unnecessary i18n import from `Activation.tsx`
2. Replace `as any` type casts with proper types
3. Convert Cyrillic comments to English
4. Add more comprehensive i18n fallbacks or ensure keys exist

---

## Comparison: Backend vs Frontend Issues

| Issue Type | Backend | Frontend |
|-----------|---------|----------|
| Hardcoded Strings | 0 | 11 |
| console.log/debug | 0 | 1 |
| Empty except blocks | 8 | 0 |
| Type Safety | 5 | 2 |
| Deprecations | 9 (Pydantic) | 0 |
| i18n Issues | 1 | 15+ |
| **Total** | **23** | **29** |

---

## Recommendations Summary

### Immediate Actions
1. ✅ Created smoke test: `backend/tests/audit_smoke_test.py` (10/10 pass)
2. ✅ Created smoke test: `frontend/src/test/audit_smoke_test.ts`
3. ✅ Created reports: `docs/PROJECT_AUDIT_REPORT.md` (38 issues)
4. 📄 This extended report

### Before Production Release
- [ ] Fix 11 hardcoded strings in frontend
- [ ] Ensure all i18n keys exist in all 3 locales
- [ ] Verify locale handling in QueueTV
- [ ] Replace console.debug with logger

### Post-MVP Improvements
- [ ] Migrate Pydantic to ConfigDict
- [ ] Migrate FastAPI to lifespan events
- [ ] Add comprehensive error boundaries in React
- [ ] Improve test coverage

---

**Report Generated:** 2026-02-04  
**Auditor:** Senior QA Automation Engineer  
**Related Files:**
- `docs/PROJECT_AUDIT_REPORT.md` (Backend focus)
- `backend/tests/audit_smoke_test.py` (Backend tests)
- `frontend/src/test/audit_smoke_test.ts` (Frontend tests)
