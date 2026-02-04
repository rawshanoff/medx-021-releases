import os

import uvicorn

# Import explicitly so PyInstaller includes the package.
from backend.main import app


def main() -> None:
    host = os.getenv("MEDX_HOST", "127.0.0.1")
    port = int(os.getenv("MEDX_PORT", "8000"))
    # No reload in packaged builds
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
