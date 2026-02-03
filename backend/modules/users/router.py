import bcrypt
from backend.core.database import get_db
from backend.core.schemas import MessageResponse
from backend.modules.auth import require_roles
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User, UserRole
from .schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/archived", response_model=list[UserResponse])
@router.get("/archived/", response_model=list[UserResponse])
async def list_archived_users(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    stmt = select(User).where(User.deleted_at.is_not(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{user_id}/restore", response_model=MessageResponse)
async def restore_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.deleted_at is None:
        return {"message": "User is already active"}

    user.deleted_at = None
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return {"message": "User restored successfully"}


@router.get("/", response_model=list[UserResponse])
async def list_users(
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    """List all users (admin only)"""
    stmt = select(User)
    if not include_deleted:
        stmt = stmt.where(User.deleted_at.is_(None))
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users


@router.post("/", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    """Create new user (admin only)"""
    # Check if username exists (excluding deleted users)
    result = await db.execute(
        select(User).filter(User.username == data.username, User.deleted_at.is_(None))
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    # Hash password
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

    user = User(
        username=data.username,
        password_hash=password_hash,
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    """Update user (admin only)"""
    result = await db.execute(
        select(User).filter(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.password:
        user.password_hash = bcrypt.hashpw(
            data.password.encode(), bcrypt.gensalt()
        ).decode()
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    """Archive user (admin only)"""
    result = await db.execute(
        select(User).filter(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.soft_delete()
    user.is_active = False
    await db.commit()
    return {"message": "User archived successfully"}
