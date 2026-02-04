import json
import os
import time
import uuid
import mimetypes
from datetime import datetime, timedelta, timezone
from urllib import request, parse, error


BASE_URL = os.environ.get("MEDX_API_URL", "http://127.0.0.1:8002/api").rstrip("/")


def _read_json(resp):
    raw = resp.read().decode("utf-8")
    if not raw:
        return None
    return json.loads(raw)


def http_json(method: str, path: str, token: str | None = None, payload: dict | None = None, timeout: int = 10):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, method=method, headers=headers, data=data)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return resp.status, _read_json(resp)
    except error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
            data = json.loads(body) if body else None
        except Exception:
            data = {"raw": body}
        return e.code, data


def http_form(method: str, path: str, form: dict, timeout: int = 10):
    url = f"{BASE_URL}{path}"
    data = parse.urlencode(form).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    req = request.Request(url, method=method, headers=headers, data=data)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return resp.status, _read_json(resp)
    except error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
            data = json.loads(body) if body else None
        except Exception:
            data = {"raw": body}
        return e.code, data


def http_multipart(path: str, token: str, fields: dict, files: list[tuple[str, str, bytes]]):
    """
    files: [(field_name, filename, content_bytes)]
    """
    boundary = "----medx-boundary-" + uuid.uuid4().hex
    lines: list[bytes] = []

    def add_line(b: bytes):
        lines.append(b + b"\r\n")

    for k, v in (fields or {}).items():
        add_line(f"--{boundary}".encode())
        add_line(f'Content-Disposition: form-data; name="{k}"'.encode())
        add_line(b"")
        add_line(str(v).encode())

    for field_name, filename, content in files:
        ctype = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        add_line(f"--{boundary}".encode())
        add_line(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode()
        )
        add_line(f"Content-Type: {ctype}".encode())
        add_line(b"")
        lines.append(content + b"\r\n")

    add_line(f"--{boundary}--".encode())
    body = b"".join(lines)

    url = f"{BASE_URL}{path}"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    req = request.Request(url, method="POST", headers=headers, data=body)
    try:
        with request.urlopen(req, timeout=20) as resp:
            return resp.status, _read_json(resp)
    except error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
            data = json.loads(body) if body else None
        except Exception:
            data = {"raw": body}
        return e.code, data


def assert_ok(name: str, status: int, data):
    if status < 200 or status >= 300:
        raise RuntimeError(f"{name} failed: HTTP {status} -> {data}")


def login(username: str, password: str):
    st, data = http_form("POST", "/auth/login", {"username": username, "password": password})
    assert_ok("login", st, data)
    return data["access_token"], data["user"]


def ensure_user(token: str, username: str, password: str, role: str, full_name: str):
    st, data = http_json(
        "POST",
        "/users/",
        token=token,
        payload={"username": username, "password": password, "role": role, "full_name": full_name},
    )
    if st == 400 and isinstance(data, dict) and "exists" in (data.get("detail") or "").lower():
        return True
    assert_ok(f"create user {username}", st, data)
    return True


def ensure_doctor(token: str):
    st, docs = http_json("GET", "/doctors/", token=token)
    assert_ok("list doctors", st, docs)
    if docs:
        return docs[0]

    st, doc = http_json(
        "POST",
        "/doctors/",
        token=token,
        payload={
            "full_name": "Доктор Тест",
            "specialty": "Терапевт",
            "queue_prefix": "T",
            "is_active": True,
            "services": [],
        },
    )
    assert_ok("create doctor", st, doc)
    doctor_id = doc["id"]

    st, _ = http_json(
        "POST",
        f"/doctors/{doctor_id}/services",
        token=token,
        payload={"name": "Приём", "price": 50000, "priority": 10},
    )
    assert_ok("add service", st, _)

    st, docs = http_json("GET", "/doctors/", token=token)
    assert_ok("list doctors (after create)", st, docs)
    return docs[0]


def find_or_create_patient(token: str, phone: str):
    qs = parse.urlencode({"phone": phone})
    st, res = http_json("GET", f"/patients/?{qs}", token=token)
    assert_ok("search patients", st, res)
    if res:
        return res[0]

    st, patient = http_json(
        "POST",
        "/patients/",
        token=token,
        payload={"full_name": "Пациент Тест", "phone": phone, "birth_date": None},
    )
    assert_ok("create patient", st, patient)
    return patient


def open_shift(token: str, cashier_id: str):
    st, data = http_json("POST", "/finance/shifts/open", token=token, payload={"cashier_id": cashier_id})
    if st == 400:
        # already open
        return None
    assert_ok("open shift", st, data)
    return data


def make_payment(token: str, patient_id: int, doctor_id: str, amount: int):
    st, tx = http_json(
        "POST",
        "/finance/transactions",
        token=token,
        payload={
            "patient_id": patient_id,
            "amount": amount,
            "doctor_id": doctor_id,
            "payment_method": "CASH",
            "cash_amount": 0,
            "card_amount": 0,
            "transfer_amount": 0,
            "description": "Приём",
        },
    )
    assert_ok("payment", st, tx)
    return tx


def add_queue(token: str, patient_name: str, patient_id: int, doctor_id: int):
    st, item = http_json(
        "POST",
        "/reception/queue",
        token=token,
        payload={"patient_name": patient_name, "patient_id": patient_id, "doctor_id": doctor_id, "status": "WAITING"},
    )
    assert_ok("add to queue", st, item)
    return item


def set_queue_status(token: str, item_id: int, status: str):
    st, data = http_json("PATCH", f"/reception/queue/{item_id}", token=token, payload={"status": status})
    assert_ok("update queue", st, data)
    return data


def create_appointment(token: str, patient_id: int, doctor_id: str):
    # Keep appointment strictly within "today" UTC to avoid crossing midnight during late runs
    now = datetime.now(timezone.utc)
    start = now.replace(hour=10, minute=0, second=0, microsecond=0)
    end = start + timedelta(minutes=30)
    st, appt = http_json(
        "POST",
        "/appointments/",
        token=token,
        payload={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "notes": "Тест запись",
            "status": "scheduled",
        },
    )
    # 409 может быть при пересечении — в smoke тесте это не критично
    if st == 409:
        return None
    assert_ok("create appointment", st, appt)
    return appt


def list_appointments(token: str, doctor_id: str | None = None):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    params = {"start": start.isoformat(), "end": end.isoformat()}
    if doctor_id:
        params["doctor_id"] = doctor_id
    qs = parse.urlencode(params)
    st, data = http_json("GET", f"/appointments/v2?{qs}", token=token)
    assert_ok("list appointments", st, data)
    return data


def license_status(token: str):
    st, data = http_json("GET", "/licenses/status", token=token)
    assert_ok("license status", st, data)
    return data


def try_upload_license(token: str):
    path = os.path.join(os.getcwd(), "license.key")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        key = f.read().strip()
    if not key:
        return None
    st, data = http_json("POST", "/licenses/upload", token=token, payload={"token": key})
    assert_ok("license upload", st, data)
    return data


def try_files_flow(token: str, patient_id: int, features: list[str]):
    if "files_results" not in features:
        return "skip (files_results not active)"

    content = f"test-result {time.time()}".encode("utf-8")
    st, uploaded = http_multipart(
        "/files/upload",
        token=token,
        fields={"patient_id": str(patient_id), "description": "Тест файл"},
        files=[("file", "result.txt", content)],
    )
    assert_ok("file upload", st, uploaded)
    file_id = uploaded.get("id") or uploaded.get("file_id")

    st, files = http_json("GET", f"/files/patient/{patient_id}", token=token)
    assert_ok("files list", st, files)
    return {"uploaded_id": file_id, "count": len(files)}


def main():
    print(f"[E2E] BASE_URL={BASE_URL}")
    token, user = login("admin", "admin123")
    print(f"[E2E] login ok: {user['username']} role={user['role']}")

    # roles for UI smoke (create if absent)
    ensure_user(token, "owner1", "owner123", "owner", "Owner One")
    ensure_user(token, "recept1", "recept123", "receptionist", "Reception One")
    ensure_user(token, "cash1", "cash123", "cashier", "Cashier One")
    ensure_user(token, "doc1", "doc123", "doctor", "Doctor One")
    print("[E2E] ensured users (owner/receptionist/cashier/doctor)")

    # Role access checks (API-level)
    owner_token, _ = login("owner1", "owner123")
    recept_token, _ = login("recept1", "recept123")
    cash_token, _ = login("cash1", "cash123")
    doc_token, _ = login("doc1", "doc123")

    st, _ = http_json("GET", "/users/", token=owner_token)
    if st != 200:
        raise RuntimeError(f"[E2E] owner should list users: got {st}")

    st, _ = http_json("GET", "/doctors/", token=recept_token)
    if st != 200:
        raise RuntimeError(f"[E2E] receptionist should list doctors: got {st}")
    st, _ = http_json("GET", "/finance/shifts/active", token=recept_token)
    if st != 403:
        raise RuntimeError(f"[E2E] receptionist should NOT access finance: got {st}")

    st, _ = http_json("GET", "/finance/shifts/active", token=cash_token)
    if st != 200:
        raise RuntimeError(f"[E2E] cashier should access finance: got {st}")
    st, _ = http_json("GET", "/reception/queue", token=cash_token)
    if st != 403:
        raise RuntimeError(f"[E2E] cashier should NOT access reception queue: got {st}")

    st, _ = http_json("GET", "/appointments/v2?start=2026-01-01T00:00:00%2B00:00&end=2026-01-01T23:59:59%2B00:00", token=doc_token)
    if st != 200:
        raise RuntimeError(f"[E2E] doctor should access appointments: got {st}")
    print("[E2E] role access checks: OK")

    doctor = ensure_doctor(token)
    print(f"[E2E] doctor ok: id={doctor['id']} prefix={doctor.get('queue_prefix')}")

    patient = find_or_create_patient(token, phone="+998900000099")
    print(f"[E2E] patient ok: id={patient['id']} phone={patient['phone']}")

    open_shift(token, cashier_id=user["username"])
    print("[E2E] shift open ok (or already open)")

    tx = make_payment(token, patient_id=patient["id"], doctor_id=str(doctor["id"]), amount=50000)
    print(f"[E2E] payment ok: tx_id={tx['id']} amount={tx['amount']}")

    q = add_queue(token, patient_name=patient["full_name"], patient_id=patient["id"], doctor_id=doctor["id"])
    print(f"[E2E] queue ok: ticket={q['ticket_number']} id={q['id']}")
    set_queue_status(token, q["id"], "COMPLETED")
    print("[E2E] queue status -> COMPLETED")

    appt = create_appointment(token, patient_id=patient["id"], doctor_id=str(doctor["id"]))
    if appt:
        print(f"[E2E] appointment created: id={appt['id']}")
    appts = list_appointments(token, doctor_id=str(doctor["id"]))
    print(f"[E2E] appointments list ok: count={len(appts)}")

    lic = license_status(token)
    if lic.get("error"):
        print(f"[E2E] license status: error={lic['error']}")
        uploaded = try_upload_license(token)
        if uploaded:
            lic = uploaded
            print("[E2E] license uploaded from ./license.key")
    else:
        print("[E2E] license status: active")

    features = lic.get("active_features") or []
    print(f"[E2E] active_features={features}")
    files_res = try_files_flow(token, patient_id=patient["id"], features=features)
    print(f"[E2E] files flow: {files_res}")

    print("[E2E] DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

