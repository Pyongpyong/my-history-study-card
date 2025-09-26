from __future__ import annotations

import os
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import StreamingResponse

from ..oci_storage import OciStorageConfigError, fetch_object
from oci.exceptions import ServiceError

router = APIRouter(prefix="/assets", tags=["assets"])

_TEACHER_FILENAME_PATTERN = re.compile(r"^teacher_\d{2}(?:_(?:o|x))?\.png$")


def _build_object_name(filename: str) -> str:
    prefix = os.getenv("OCI_PREFIX", "").strip()
    if not prefix:
        return filename
    normalized = prefix.strip("/")
    if not normalized:
        return filename
    return f"{normalized}/{filename}"


def _get_bucket_name() -> str:
    bucket = os.getenv("OCI_BUCKETNAME", "").strip()
    if not bucket:
        raise OciStorageConfigError("OCI_BUCKETNAME environment variable is missing")
    return bucket


@router.get("/teachers/{filename}")
async def get_teacher_image(filename: str):
    if not _TEACHER_FILENAME_PATTERN.match(filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    try:
        bucket = _get_bucket_name()
        object_name = _build_object_name(filename)
        response = fetch_object(bucket, object_name)
    except OciStorageConfigError as exc:  # pragma: no cover - configuration errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ServiceError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found") from exc
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch image from OCI") from exc

    content_type = response.headers.get("Content-Type", "image/png")
    content_length = response.headers.get("Content-Length")

    body: Optional[bytes]
    if hasattr(response.data, "content") and response.data.content is not None:
        body = response.data.content
        return Response(content=body, media_type=content_type, headers={
            **({"Content-Length": content_length} if content_length else {}),
            "Cache-Control": "public, max-age=3600",
        })

    stream = response.data.raw
    headers = {"Cache-Control": "public, max-age=3600"}
    if content_length:
        headers["Content-Length"] = content_length
    return StreamingResponse(stream, media_type=content_type, headers=headers)
