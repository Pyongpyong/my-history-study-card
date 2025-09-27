from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import StreamingResponse

from ..oci_storage import OciStorageConfigError, fetch_object, build_object_name, get_bucket_name
from oci.exceptions import ServiceError

router = APIRouter(prefix="/assets", tags=["assets"])

_TEACHER_FILENAME_PATTERN = re.compile(r"^teacher_\d{2}(?:_(?:o|x))?\.(?:png|avif)$")


@router.get("/teachers/{filename}")
async def get_teacher_image(filename: str):
    if not _TEACHER_FILENAME_PATTERN.match(filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    try:
        bucket = get_bucket_name()
        object_name = build_object_name(filename)
        response = fetch_object(bucket, object_name)
    except OciStorageConfigError as exc:  # pragma: no cover - configuration errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ServiceError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found") from exc
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch image from OCI") from exc

    content_type = response.headers.get("Content-Type", "image/avif")
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
