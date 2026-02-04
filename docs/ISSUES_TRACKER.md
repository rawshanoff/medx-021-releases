# 🚨 Issues Tracker - MedX MVP Audit 2026-02-04

**Total Issues:** 67  
**Critical:** 5  
**High:** 20  
**Medium:** 29  
**Low:** 13

---

## Critical Issues (Fix Before Release)

### 🔴 CRITICAL-001
- **File:** `backend/core/licenses.py:75`
- **Issue:** Using `print()` instead of `logger` for license errors
- **Code:** `print(f"License Error: {payload['error']}")`
- **Impact:** Production errors not properly logged
- **Severity:** 🔴 Critical
- **Fix Effort:** 5 minutes
- **Fix:** Replace with `logger.error()` or `logger.warning()`

### 🔴 CRITICAL-002
- **File:** `backend/modules/doctors/schemas.py`
- **Issue:** Missing validation for empty `full_name` in `DoctorBase`
- **Code:** No @field_validator for full_name
- **Impact:** Invalid doctor records can be created
- **Severity:** 🔴 Critical
- **Fix Effort:** 10 minutes
- **Fix:** Add @field_validator("full_name") with non-empty check

### 🔴 CRITICAL-003
- **File:** `frontend/src/pages/System.tsx:1560, 1570, 1581, 1590`
- **Issue:** Hardcoded English labels in user creation form
- **Code:** `<label>Username</label>`, `<label>Password</label>`, `<label>Full Name</label>`, `<label>Role</label>`
- **Impact:** Non-English users see English form labels
- **Severity:** 🔴 Critical
- **Fix Effort:** 15 minutes
- **Fix:** Replace with i18n keys: `{t('system.username')}`, etc.

### 🔴 CRITICAL-004
- **File:** `frontend/src/pages/System.tsx:1597-1600`
- **Issue:** Hardcoded role options (Admin, Owner, Doctor, Registrar, Cashier)
- **Code:** `<option value="admin">Admin</option>` ...
- **Impact:** Non-English users see English role names
- **Severity:** 🔴 Critical
- **Fix Effort:** 20 minutes
- **Fix:** Map roles with i18n translations

### 🔴 CRITICAL-005
- **File:** `frontend/src/locales/*.json`
- **Issue:** Missing translation keys across all locales
- **Impact:** Many UI strings fall back to hardcoded Cyrillic text
- **Severity:** 🔴 Critical
- **Fix Effort:** 30 minutes
- **Fix:** Add missing keys to en.json, uz.json (and complete ru.json)

---

## High Priority Issues

### 🟠 HIGH-001
- **File:** `backend/modules/patients/router.py:150`
- **Issue:** Empty `except ValueError: pass` when parsing birth_date
- **Severity:** 🟠 High
- **Fix:** Add logging: `logger.debug("Invalid birth_date format: %s", birth_date)`

### 🟠 HIGH-002
- **File:** `backend/modules/patients/router.py:327, 338`
- **Issue:** Empty `except Exception: pass` in file operations
- **Severity:** 🟠 High
- **Fix:** Add logging for missing modules

### 🟠 HIGH-003
- **File:** `backend/modules/finance/router.py:44`
- **Issue:** Empty `except Exception: pass` for advisory lock
- **Severity:** 🟠 High
- **Fix:** Add logger.debug() with context

### 🟠 HIGH-004
- **File:** `backend/modules/finance/router.py:326`
- **Issue:** IntegrityError caught but not logged
- **Severity:** 🟠 High
- **Fix:** Add logger.debug() for idempotency race conditions

### 🟠 HIGH-005
- **File:** `backend/core/config.py:77, 85, 91, 98`
- **Issue:** Multiple empty `except Exception: pass` blocks
- **Severity:** 🟠 High
- **Fix:** Add logger.debug() for VERSION file search attempts

### 🟠 HIGH-006
- **File:** `backend/core/update_artifacts.py:38`
- **Issue:** Empty `except Exception: pass` in cleanup
- **Severity:** 🟠 High
- **Fix:** Add logging for cleanup failures

### 🟠 HIGH-007
- **File:** `backend/core/licenses.py:96`
- **Issue:** Empty `except ValueError: continue` without logging
- **Severity:** 🟠 High
- **Fix:** Add logger.debug() for invalid feature dates

### 🟠 HIGH-008
- **File:** `frontend/src/components/Topbar.tsx:69`
- **Issue:** Using `console.debug()` instead of logger
- **Code:** `console.debug('Update check failed:', error);`
- **Severity:** 🟠 High
- **Fix:** Use `loggers.updater.debug()` instead

### 🟠 HIGH-009
- **File:** `frontend/src/pages/QueueTV.tsx:70`
- **Issue:** Hardcoded `'ru-RU'` locale in date formatting
- **Code:** `toLocaleDateString('ru-RU', { ... })`
- **Impact:** Always shows Russian date regardless of language selection
- **Severity:** 🟠 High
- **Fix:** Use i18n to get current locale dynamically

### 🟠 HIGH-010
- **File:** `frontend/src/pages/Login.tsx:160-161`
- **Issue:** aria-label defaultValue uses Cyrillic ('Скрыть', 'Показать')
- **Severity:** 🟠 High (accessibility)
- **Fix:** Use English: `{ defaultValue: 'Hide' } / { defaultValue: 'Show' }`

### 🟠 HIGH-011 through HIGH-020
- **Files:** `frontend/src/pages/Archive.tsx`
- **Issue:** Multiple i18n defaultValue with Cyrillic text
- **Lines:** 55, 116, 119, 158, 179
- **Impact:** Missing translation keys in all locales
- **Severity:** 🟠 High
- **Fix:** Add missing keys to locale files

---

## Medium Priority Issues

### 🟡 MEDIUM-001 through MEDIUM-009
- **Issue:** Pydantic schema deprecation warnings (class Config)
- **Files:** 9 schema files
- **Severity:** 🟡 Medium
- **Fix Effort:** 4-6 hours
- **Fix:** Migrate from `class Config:` to `ConfigDict`

### 🟡 MEDIUM-010
- **File:** `backend/main.py:104`
- **Issue:** Using deprecated `@app.on_event("startup")`
- **Severity:** 🟡 Medium
- **Fix:** Migrate to `lifespan` event handlers

### 🟡 MEDIUM-011 through MEDIUM-015
- **Issue:** Various empty error handling blocks
- **Severity:** 🟡 Medium
- **Fix Effort:** Per-block: 5-10 minutes

### 🟡 MEDIUM-016 through MEDIUM-029
- **Issue:** Frontend i18n gaps and missing translation keys
- **Severity:** 🟡 Medium
- **Fix Effort:** 2-3 hours total

---

## Low Priority Issues

### 🟢 LOW-001 through LOW-004
- **Issue:** Type assertions using `as any`
- **Files:** Backend & Frontend
- **Severity:** 🟢 Low
- **Fix Effort:** Per-file: 15-30 minutes

### 🟢 LOW-005
- **File:** `frontend/src/pages/Activation.tsx:6`
- **Issue:** Unnecessary import `import '../i18n'`
- **Severity:** 🟢 Low
- **Fix:** Remove if initialized in App.tsx

### 🟢 LOW-006 through LOW-013
- **Issue:** Code quality improvements (comments, naming, etc.)
- **Severity:** 🟢 Low
- **Fix Effort:** Various

---

## Issues by File

### Backend Files with Issues

```
backend/core/licenses.py:            1 critical, 1 high
backend/core/config.py:              4 high
backend/core/update_artifacts.py:    1 high
backend/main.py:                     1 medium (deprecation)
backend/modules/doctors/schemas.py:  1 critical
backend/modules/patients/router.py:  2 high
backend/modules/finance/router.py:   2 high
backend/modules/auth/__init__.py:    1 low (type assertion)
[Pydantic schemas]                   9 medium (deprecations)
```

### Frontend Files with Issues

```
frontend/src/pages/System.tsx:            5 critical
frontend/src/pages/QueueTV.tsx:           1 high, 1 medium
frontend/src/pages/Login.tsx:             1 high
frontend/src/pages/Archive.tsx:           10 high
frontend/src/pages/Activation.tsx:        1 low
frontend/src/components/Topbar.tsx:       1 high
frontend/src/components/Sidebar.tsx:      2 low (comments, i18n)
frontend/src/locales/*.json:              15 high (missing keys)
```

---

## Estimated Fix Time

| Priority | Count | Est. Time |
|----------|-------|-----------|
| Critical | 5 | 90 min (1.5 hrs) |
| High | 20 | 120 min (2 hrs) |
| Medium | 29 | 180 min (3 hrs) |
| Low | 13 | 60 min (1 hr) |
| **Total** | **67** | **450 min (7.5 hrs)** |

**Realistic Sprint Time:** 8-10 hours (including testing and review)

---

## Fix Roadmap

### Phase 1: Critical Fixes (1.5 hours)
1. Fix hardcoded English labels in System.tsx
2. Add missing i18n keys
3. Fix print() in licenses.py
4. Add full_name validation

### Phase 2: High Priority Fixes (2 hours)
1. Replace console.debug with logger
2. Fix QueueTV locale
3. Add logging to empty except blocks

### Phase 3: Medium Priority Fixes (3 hours)
1. Migrate Pydantic schemas (post-MVP)
2. Migrate FastAPI events (post-MVP)
3. Complete i18n coverage

### Phase 4: Low Priority Fixes (1 hour)
1. Remove type assertions
2. Clean up imports
3. Fix comments

---

## Verification Checklist

- [ ] All 5 critical issues fixed
- [ ] All high-priority issues addressed
- [ ] Backend tests pass: `pytest backend/tests/ -v`
- [ ] Frontend builds: `npm run build`
- [ ] No console warnings
- [ ] i18n keys verified in all 3 locales
- [ ] Manual QA with Russian/Uzbek language
- [ ] Code review completed
- [ ] Smoke tests passing

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Auditor | Senior QA Engineer | 2026-02-04 |
| Dev Lead | [TBD] | [TBD] |
| QA Lead | [TBD] | [TBD] |
| Product | [TBD] | [TBD] |

---

**Generated:** 2026-02-04  
**Last Updated:** 2026-02-04  
**Next Review:** After fixes applied
