from __future__ import annotations

import os
import threading
from typing import Optional, Tuple

import oci
from oci.object_storage import ObjectStorageClient

_client_lock = threading.Lock()
_cached_client: Optional[ObjectStorageClient] = None
_cached_namespace: Optional[str] = None


class OciStorageConfigError(RuntimeError):
    pass


def _load_config() -> Tuple[dict, Optional[str]]:
    config_path = os.getenv("OCI_CONFIG")
    profile = os.getenv("OCI_PROFILE", "DEFAULT") or "DEFAULT"
    if not config_path:
        raise OciStorageConfigError("OCI_CONFIG environment variable is missing")
    expanded_path = os.path.expanduser(config_path)
    if not os.path.exists(expanded_path):
        raise OciStorageConfigError(f"OCI config file not found: {expanded_path}")
    config = oci.config.from_file(file_location=expanded_path, profile_name=profile)
    tenancy_namespace = os.getenv("OCI_NAMESPACE") or None
    return config, tenancy_namespace


def _ensure_client() -> Tuple[ObjectStorageClient, str]:
    global _cached_client, _cached_namespace
    if _cached_client is not None and _cached_namespace is not None:
        return _cached_client, _cached_namespace
    with _client_lock:
        if _cached_client is not None and _cached_namespace is not None:
            return _cached_client, _cached_namespace
        config, explicit_namespace = _load_config()
        client = oci.object_storage.ObjectStorageClient(config)
        namespace = explicit_namespace or client.get_namespace().data
        _cached_client = client
        _cached_namespace = namespace
        return client, namespace


def fetch_object(bucket: str, object_name: str):
    client, namespace = _ensure_client()
    return client.get_object(namespace, bucket, object_name)
