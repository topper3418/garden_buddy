"""Common reusable Pydantic response models."""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ListResponse(BaseModel, Generic[T]):
    """Generic list response envelope for consistent API docs."""

    items: list[T]
    limit: int
    offset: int
