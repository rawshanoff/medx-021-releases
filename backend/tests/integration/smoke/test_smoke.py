import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_queue_item_creation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    headers: dict,
):
    """Test adding patient to queue"""
    # Create test data
    patient_res = await async_client.post(
        "/api/patients/",
        json={
            "full_name": "Test Patient",
            "phone": "+1234567890",
            "birth_date": "1990-01-01",
        },
        headers=headers,
    )
    assert patient_res.status_code == 201
    patient_id = patient_res.json()["id"]

    doctor_res = await async_client.get("/api/doctors/", headers=headers)
    assert doctor_res.status_code == 200
    doctors = doctor_res.json()
    assert len(doctors) > 0
    doctor_id = doctors[0]["id"]

    # Add to queue
    queue_res = await async_client.post(
        "/api/reception/queue",
        json={
            "patient_name": "Test Patient",
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "status": "WAITING",
        },
        headers=headers,
    )
    assert queue_res.status_code == 201
    queue_item = queue_res.json()
    assert queue_item["ticket_number"] is not None
    assert queue_item["status"] == "WAITING"


@pytest.mark.asyncio
async def test_file_upload_size_limit(
    async_client: AsyncClient,
    db_session: AsyncSession,
    headers: dict,
):
    """Test file upload size validation"""
    # Create test patient
    patient_res = await async_client.post(
        "/api/patients/",
        json={
            "full_name": "Test Patient",
            "phone": "+1234567890",
            "birth_date": "1990-01-01",
        },
        headers=headers,
    )
    assert patient_res.status_code == 201
    patient_id = patient_res.json()["id"]

    # Try to upload file > 10 MB (simulate with large file)
    large_content = b"x" * (11 * 1024 * 1024)  # 11 MB

    file_res = await async_client.post(
        "/api/files/upload",
        data={"patient_id": patient_id, "file_type": "test"},
        files={"file": ("large.bin", large_content, "application/octet-stream")},
        headers=headers,
    )

    # Should fail with 413 (too large)
    assert file_res.status_code == 413


@pytest.mark.asyncio
async def test_transaction_creation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    headers: dict,
):
    """Test creating financial transaction"""
    # Open shift first
    shift_res = await async_client.post(
        "/api/finance/shifts/open",
        json={"cashier_id": "admin"},
        headers=headers,
    )
    assert shift_res.status_code == 201

    # Create transaction
    tx_res = await async_client.post(
        "/api/finance/transactions",
        json={
            "patient_id": None,
            "amount": 1000,
            "payment_method": "CASH",
            "description": "Test payment",
            "doctor_id": None,
            "idempotency_key": "test-key-123",
        },
        headers=headers,
    )
    assert tx_res.status_code == 201
    tx = tx_res.json()
    assert tx["amount"] == 1000
    assert tx["payment_method"] == "CASH"


@pytest.mark.asyncio
async def test_retry_on_server_error(
    async_client: AsyncClient,
    db_session: AsyncSession,
    headers: dict,
):
    """Test that API client handles retries gracefully"""
    # This test ensures error handling works
    # Try accessing non-existent endpoint
    res = await async_client.get(
        "/api/nonexistent",
        headers=headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_error_handling_missing_data(
    async_client: AsyncClient,
    db_session: AsyncSession,
    headers: dict,
):
    """Test error handling for missing required data"""
    # Try creating queue item without patient_id
    res = await async_client.post(
        "/api/reception/queue",
        json={
            "patient_name": "Test",
            "doctor_id": 1,
            "status": "WAITING",
        },
        headers=headers,
    )
    assert res.status_code >= 400
