# Alembic strategy (MVP)

- Maintain a single linear migration chain (one head).
- Always upgrade to head before creating a new migration.
- Do not create merge migrations; resolve conflicts by rebasing the new revision onto the current head.
- If a migration is empty, delete it and fix `down_revision` to keep the chain linear.

Common commands:
- `alembic -c backend/alembic.ini upgrade head`
- `alembic -c backend/alembic.ini revision --autogenerate -m "..."` 
