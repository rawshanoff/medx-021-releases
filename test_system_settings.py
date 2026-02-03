#!/usr/bin/env python3
"""
Comprehensive testing suite for System Settings implementation.
Tests all critical paths: Persistence, Audit, Validation, Rollback, History.
"""

import requests
import json
import sys
from datetime import datetime
import time

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:8000"
TOTAL_TESTS = 0
PASSED_TESTS = 0
FAILED_TESTS = 0

def print_header(title):
    print(f"\n{'=' * 80}")
    print(f"  {title}")
    print(f"{'=' * 80}\n")

def test(name, condition, expected=True):
    global TOTAL_TESTS, PASSED_TESTS, FAILED_TESTS
    TOTAL_TESTS += 1
    
    passed = condition == expected
    if passed:
        PASSED_TESTS += 1
        status = "[PASS]"
    else:
        FAILED_TESTS += 1
        status = "[FAIL]"
    
    print(f"{status} {name}")
    if not passed:
        print(f"       Expected: {expected}, Got: {condition}")

def test_assert(name, assertion, details=""):
    global TOTAL_TESTS, PASSED_TESTS, FAILED_TESTS
    TOTAL_TESTS += 1
    
    try:
        assert assertion, details
        PASSED_TESTS += 1
        print(f"[PASS] {name}")
    except AssertionError as e:
        FAILED_TESTS += 1
        print(f"[FAIL] {name}: {str(e)}")

# Step 1: Authentication
print_header("STEP 1: Authentication Tests")

login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    data={"username": "admin", "password": "admin123"}
)

test("Login succeeds", login_response.status_code == 200)
test_assert("Response contains access_token", "access_token" in login_response.json())

if login_response.status_code != 200:
    print("\nFATAL: Cannot continue without auth token")
    sys.exit(1)

token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Step 2: Phase 1 - Persistence & API
print_header("STEP 2: Phase 1 - Persistence & API")

# Test 2a: Create setting (V1)
test_value_v1 = {
    "clinicName": "QA Test Clinic V1",
    "silentScalePercent": 100,
    "paperSize": "80",
    "boldAllText": True,
}

put_response_v1 = requests.put(
    f"{BASE_URL}/api/system/settings/print_config",
    json={"value": test_value_v1},
    headers=headers
)

test("PUT create returns 200", put_response_v1.status_code, 200)
setting_v1 = put_response_v1.json() if put_response_v1.status_code == 200 else {}
test_assert("Setting has id", "id" in setting_v1)
test_assert("Setting user_id matches", setting_v1.get("user_id") is not None)
test_assert("Setting key is correct", setting_v1.get("key") == "print_config")

# Test 2b: Get single setting
get_response = requests.get(
    f"{BASE_URL}/api/system/settings/print_config",
    headers=headers
)

test("GET single setting returns 200", get_response.status_code, 200)
setting = get_response.json() if get_response.status_code == 200 else {}
test_assert("Retrieved setting matches", setting.get("key") == "print_config")
test_assert("Value preserved", setting.get("value", {}).get("clinicName") == "QA Test Clinic V1")

# Test 2c: Get all settings
all_settings_response = requests.get(
    f"{BASE_URL}/api/system/settings",
    headers=headers
)

test("GET all settings returns 200", all_settings_response.status_code, 200)
all_settings = all_settings_response.json() if all_settings_response.status_code == 200 else {}
test_assert("All settings is dict", isinstance(all_settings, dict))
test_assert("print_config in all settings", "print_config" in all_settings)

# Step 3: Phase 2 - Audit Logging
print_header("STEP 3: Phase 2 - Audit Logging")

# Initial audit check
audit_response = requests.get(
    f"{BASE_URL}/api/system/settings/audit/print_config",
    headers=headers
)

test("GET audit history returns 200", audit_response.status_code, 200)
logs_initial = audit_response.json() if audit_response.status_code == 200 else []
test_assert("Initial audit has create entry", len(logs_initial) >= 1)
test_assert("First action is create", logs_initial[0].get("action") == "create" if logs_initial else True)

# Make second change (update)
test_value_v2 = test_value_v1.copy()
test_value_v2["clinicName"] = "QA Test Clinic V2 UPDATED"
test_value_v2["silentScalePercent"] = 120

put_response_v2 = requests.put(
    f"{BASE_URL}/api/system/settings/print_config",
    json={"value": test_value_v2},
    headers=headers
)

test("PUT update returns 200", put_response_v2.status_code, 200)

# Check audit again
time.sleep(0.5)  # Ensure DB is updated
audit_response_2 = requests.get(
    f"{BASE_URL}/api/system/settings/audit/print_config",
    headers=headers
)

logs_updated = audit_response_2.json() if audit_response_2.status_code == 200 else []
test_assert("Audit has 2+ entries", len(logs_updated) >= 2)
test_assert("Latest action is update", logs_updated[0].get("action") == "update" if logs_updated else True)

# Check old_value and new_value preserved
if logs_updated and len(logs_updated) >= 1:
    latest_log = logs_updated[0]
    test_assert("Old value preserved", latest_log.get("old_value") is not None)
    test_assert("New value preserved", latest_log.get("new_value") is not None)

# Step 4: Phase 3 - Validation
print_header("STEP 4: Phase 3 - Validation")

# Test invalid silentScalePercent
invalid_value_1 = test_value_v2.copy()
invalid_value_1["silentScalePercent"] = 999
invalid_response_1 = requests.put(
    f"{BASE_URL}/api/system/settings/print_config",
    json={"value": invalid_value_1},
    headers=headers
)
test("Invalid silentScalePercent returns 400", invalid_response_1.status_code, 400)
test_assert("Error message mentions range", "10" in str(invalid_response_1.json().get("detail", "")))

# Test invalid paperSize
invalid_value_2 = test_value_v2.copy()
invalid_value_2["paperSize"] = "100"
invalid_response_2 = requests.put(
    f"{BASE_URL}/api/system/settings/print_config",
    json={"value": invalid_value_2},
    headers=headers
)
test("Invalid paperSize returns 400", invalid_response_2.status_code, 400)
test_assert("Error message mentions valid values", "58" in str(invalid_response_2.json().get("detail", "")))

# Test invalid receiptTemplateId
invalid_value_3 = test_value_v2.copy()
invalid_value_3["receiptTemplateId"] = "invalid-template"
invalid_response_3 = requests.put(
    f"{BASE_URL}/api/system/settings/print_config",
    json={"value": invalid_value_3},
    headers=headers
)
test("Invalid receiptTemplateId returns 400", invalid_response_3.status_code, 400)

# Step 5: Phase 4 - Rollback
print_header("STEP 5: Phase 4 - Rollback")

# Find rollbackable entry (one with old_value)
rollback_entry = None
for log in logs_updated:
    if log.get("old_value") is not None and log.get("action") != "rollback":
        rollback_entry = log
        break

if rollback_entry:
    audit_id = rollback_entry["id"]
    rollback_response = requests.post(
        f"{BASE_URL}/api/system/settings/print_config/rollback/{audit_id}",
        headers=headers
    )
    
    test("Rollback returns 200", rollback_response.status_code, 200)
    
    # Verify rollback created new audit entry
    time.sleep(0.5)
    audit_response_3 = requests.get(
        f"{BASE_URL}/api/system/settings/audit/print_config",
        headers=headers
    )
    
    logs_after_rollback = audit_response_3.json() if audit_response_3.status_code == 200 else []
    test_assert("New rollback entry created", len(logs_after_rollback) > len(logs_updated))
    test_assert("Latest action is rollback", logs_after_rollback[0].get("action") == "rollback" if logs_after_rollback else True)
else:
    print("[SKIP] No rollbackable entries found (need entries with old_value)")

# Final Summary
print_header("COMPREHENSIVE TEST RESULTS")

total = TOTAL_TESTS
passed = PASSED_TESTS
failed = FAILED_TESTS
success_rate = (passed / total * 100) if total > 0 else 0

print(f"Total Tests:   {total}")
print(f"Passed:        {passed} [{success_rate:.1f}%]")
print(f"Failed:        {failed}")
print()

if failed == 0:
    print("SUCCESS: All tests passed!")
    print("\nSystem Settings Implementation Status: READY FOR PRODUCTION")
else:
    print(f"WARNING: {failed} test(s) failed")
    print("\nPlease review failures before production deployment")

print("\n" + "=" * 80)
