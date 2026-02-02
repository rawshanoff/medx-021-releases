from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AppException(Exception):
    """Unified application error (HTTP-safe).

    Use this for predictable, structured failures (fail-closed where needed).
    """

    status_code: int
    detail: str
    code: str | None = None


def bad_request(detail: str, code: str | None = None) -> AppException:
    return AppException(status_code=400, detail=detail, code=code)


def forbidden(detail: str, code: str | None = None) -> AppException:
    return AppException(status_code=403, detail=detail, code=code)


def not_found(detail: str, code: str | None = None) -> AppException:
    return AppException(status_code=404, detail=detail, code=code)

