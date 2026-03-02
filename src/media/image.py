"""Image storage utilities for FastAPI upload, retrieval, and deletion.

This module persists uploaded image files to the local media directory defined
by application settings and returns FastAPI-compatible response types for
serving stored files.
"""

from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from src.settings import settings

_ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",  # iPhone HEIC/HEIF support
}


def _extension_for_upload(file: UploadFile) -> str:
    """Determine and validate the file extension for an uploaded image.

    Supports JPEG, PNG, WEBP, GIF, and HEIC (iPhone) images.

    Args:
        file: The uploaded file object received by a FastAPI endpoint.

    Returns:
        The validated image file extension including the leading dot.

    Raises:
        HTTPException: If the upload content type is not a supported image type.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image content type.",
        )

    original_suffix = Path(file.filename or "").suffix.lower()
    if original_suffix in _ALLOWED_IMAGE_CONTENT_TYPES.values():
        return original_suffix

    return _ALLOWED_IMAGE_CONTENT_TYPES[content_type]


def _resolve_media_file(unique_filename: str) -> Path:
    """Resolve a filename to an absolute path inside the configured media root.

    Args:
        unique_filename: The stored filename identifier.

    Returns:
        An absolute path for the target file.

    Raises:
        HTTPException: If the resolved path escapes the media directory.
    """
    target = settings.media_path / unique_filename
    resolved_target = target.resolve()
    resolved_media_root = settings.media_path.resolve()

    if resolved_media_root not in resolved_target.parents and resolved_target != resolved_media_root:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename.")

    return resolved_target


async def save_image(file: UploadFile) -> str:
    """Save an uploaded image to disk and return its generated unique filename.

    Args:
        file: The uploaded image from a FastAPI endpoint.

    Returns:
        The generated unique filename used for later retrieval or deletion.
    """
    settings.media_path.mkdir(parents=True, exist_ok=True)

    suffix = _extension_for_upload(file)
    unique_filename = f"{uuid4().hex}{suffix}"
    destination = _resolve_media_file(unique_filename)

    data = await file.read()
    destination.write_bytes(data)
    await file.close()

    return unique_filename


def retrieve_image(unique_filename: str) -> FileResponse:
    """Create a FastAPI file response for a previously stored image.

    Args:
        unique_filename: The unique stored filename to retrieve.

    Returns:
        A ``FileResponse`` that FastAPI can return directly from an endpoint.

    Raises:
        HTTPException: If the file does not exist or path validation fails.
    """
    target = _resolve_media_file(unique_filename)

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    return FileResponse(path=target)


def delete_image(unique_filename: str) -> bool:
    """Delete a stored image by unique filename.

    Args:
        unique_filename: The unique stored filename to delete.

    Returns:
        ``True`` when the file was deleted, ``False`` when the file is missing.

    Raises:
        HTTPException: If path validation fails or target is not a file.
    """
    target = _resolve_media_file(unique_filename)

    if not target.exists():
        return False

    if not target.is_file():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image path.")

    target.unlink()
    return True
