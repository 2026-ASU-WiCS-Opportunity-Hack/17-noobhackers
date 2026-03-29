"""AI semantic search Lambda handler — Cohere-powered.

Uses Cohere embed-multilingual-v3.0 for cross-lingual embeddings
and Cohere Command-R for LLM query parsing. Vectors stored in DynamoDB.
Cosine similarity computed in-Lambda.

- GET  /coaches/search              → semantic_search
- POST /coaches/{coachId}/embed     → embed_coach_profile
- POST /coaches/{coachId}/re-embed  → re_embed_coach

Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
"""

from __future__ import annotations

import json
import logging
import math
import os
import urllib.request
import urllib.error
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

from shared.exceptions import SearchUnavailableError, ValidationError
from shared.pii_filter import redact_pii

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

COACHES_TABLE = os.environ.get("COACHES_TABLE", "wial-coaches")
COHERE_SECRET_NAME = os.environ.get("COHERE_SECRET_NAME", "wial/cohere-api-key")
EMBEDDING_DIMENSION = 1024
COHERE_EMBED_MODEL = "embed-multilingual-v3.0"
COHERE_LLM_MODEL = "command-r"

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
coaches_table = dynamodb.Table(COACHES_TABLE)

_cohere_key_cache: Optional[str] = None

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def _json_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {"statusCode": status_code, "headers": CORS_HEADERS,
            "body": json.dumps(body, default=_decimal_default)}


def _decimal_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    raise TypeError(f"Not serializable: {type(obj).__name__}")


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))


def _get_cohere_key() -> str:
    global _cohere_key_cache
    if _cohere_key_cache:
        return _cohere_key_cache
    try:
        resp = secrets_client.get_secret_value(SecretId=COHERE_SECRET_NAME)
        secret = json.loads(resp["SecretString"])
        _cohere_key_cache = secret["apiKey"]
        return _cohere_key_cache
    except Exception as exc:
        _safe_log("Failed to fetch Cohere key", {"error": str(exc)})
        raise SearchUnavailableError("AI search credentials unavailable") from exc


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

# ---------------------------------------------------------------------------
# Cohere Embedding (multilingual)
# ---------------------------------------------------------------------------


def _embed_texts(texts: List[str], input_type: str = "search_document") -> List[List[float]]:
    """Embed texts using Cohere embed-multilingual-v3.0."""
    key = _get_cohere_key()
    body = json.dumps({
        "texts": texts,
        "model": COHERE_EMBED_MODEL,
        "input_type": input_type,
        "truncate": "END",
    }).encode()

    req = urllib.request.Request("https://api.cohere.com/v1/embed", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            return result.get("embeddings", [])
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        _safe_log("Cohere embed failed", {"status": e.code, "body": body_text[:200]})
        raise SearchUnavailableError(f"Embedding failed ({e.code})") from e
    except Exception as exc:
        raise SearchUnavailableError(f"Embedding failed: {exc}") from exc


def _embed_query(text: str) -> List[float]:
    """Embed a single search query."""
    results = _embed_texts([text], input_type="search_query")
    if not results:
        raise SearchUnavailableError("Empty embedding result")
    return results[0]


# ---------------------------------------------------------------------------
# Cohere LLM — query parsing
# ---------------------------------------------------------------------------


def _parse_query_with_llm(query: str) -> Tuple[Dict[str, str], str]:
    """Use Cohere Command-R to extract structured filters from a query."""
    key = _get_cohere_key()
    prompt = (
        "You are a search query parser for a coach directory. "
        "Extract structured filters and the semantic search portion.\n\n"
        "Extract: location (city/country/region), language (spoken language)\n"
        "Return ONLY valid JSON: "
        '{"filters":{"location":"...","language":"..."},"semantic":"..."}\n'
        "Omit filters not present. semantic = remaining meaningful text.\n\n"
        f"Query: {query}\n\nJSON:"
    )

    body = json.dumps({
        "model": COHERE_LLM_MODEL,
        "message": prompt,
        "temperature": 0,
        "max_tokens": 200,
    }).encode()

    req = urllib.request.Request("https://api.cohere.com/v1/chat", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            text = result.get("text", "{}")
            # Extract JSON from response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                parsed = json.loads(text[start:end])
                filters = parsed.get("filters", {})
                semantic = parsed.get("semantic", query)
                return filters, semantic if semantic else query
            return {}, query
    except Exception as exc:
        _safe_log("LLM parsing failed", {"error": str(exc)})
        return {}, query

# ---------------------------------------------------------------------------
# Vector search in DynamoDB
# ---------------------------------------------------------------------------


def _vector_search(
    query_embedding: List[float],
    filters: Dict[str, str],
    chapter_id: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Scan coaches with embeddings, compute cosine similarity."""
    scan_kwargs: Dict[str, Any] = {
        "FilterExpression": "SK = :sk AND #s = :active AND attribute_exists(embedding)",
        "ExpressionAttributeNames": {"#s": "status"},
        "ExpressionAttributeValues": {":sk": "PROFILE", ":active": "active"},
    }
    if chapter_id:
        scan_kwargs["FilterExpression"] += " AND chapterId = :cid"
        scan_kwargs["ExpressionAttributeValues"][":cid"] = chapter_id

    items: List[Dict[str, Any]] = []
    response = coaches_table.scan(**scan_kwargs)
    items.extend(response.get("Items", []))
    while response.get("LastEvaluatedKey"):
        response = coaches_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"], **scan_kwargs)
        items.extend(response.get("Items", []))

    scored = []
    for item in items:
        emb = item.get("embedding", [])
        if not emb:
            continue
        emb_floats = [float(v) for v in emb]
        score = _cosine_similarity(query_embedding, emb_floats)

        if filters.get("location"):
            if filters["location"].lower() not in item.get("location", "").lower():
                continue
        if filters.get("language"):
            langs = [l.lower() for l in item.get("languages", [])]
            if filters["language"].lower() not in langs:
                continue

        result_item = {k: v for k, v in item.items() if k != "embedding"}
        result_item["_score"] = round(score, 4)
        scored.append((score, result_item))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def _keyword_search(query: str, chapter_id: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
    """Fallback keyword search in DynamoDB."""
    q = query.lower()
    scan_kwargs: Dict[str, Any] = {
        "FilterExpression": "SK = :sk AND #s = :active",
        "ExpressionAttributeNames": {"#s": "status"},
        "ExpressionAttributeValues": {":sk": "PROFILE", ":active": "active"},
    }
    if chapter_id:
        scan_kwargs["FilterExpression"] += " AND chapterId = :cid"
        scan_kwargs["ExpressionAttributeValues"][":cid"] = chapter_id

    items: List[Dict[str, Any]] = []
    response = coaches_table.scan(**scan_kwargs)
    items.extend(response.get("Items", []))
    while response.get("LastEvaluatedKey"):
        response = coaches_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"], **scan_kwargs)
        items.extend(response.get("Items", []))

    matched = []
    for item in items:
        text = " ".join([item.get("name", ""), item.get("bio", ""), item.get("location", ""), " ".join(item.get("languages", []))]).lower()
        if q in text:
            result_item = {k: v for k, v in item.items() if k != "embedding"}
            matched.append(result_item)
    return matched[:limit]

# ---------------------------------------------------------------------------
# Semantic search — main entry point
# ---------------------------------------------------------------------------


def semantic_search(query: str, chapter_id: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    """AI-powered cross-lingual coach search with fallback."""
    fallback = False
    filters, semantic_query = _parse_query_with_llm(query)

    try:
        embedding = _embed_query(semantic_query)
    except (SearchUnavailableError, Exception):
        _safe_log("Embedding failed, keyword fallback")
        return {"results": _keyword_search(query, chapter_id, limit), "fallback": True}

    try:
        results = _vector_search(embedding, filters, chapter_id, limit)
    except Exception:
        _safe_log("Vector search failed, keyword fallback")
        results = _keyword_search(query, chapter_id, limit)
        fallback = True

    return {"results": results, "fallback": fallback}


# ---------------------------------------------------------------------------
# Embedding pipeline
# ---------------------------------------------------------------------------


def _build_embedding_text(coach: Dict[str, Any]) -> str:
    parts = [coach.get("name", ""), coach.get("location", ""), coach.get("bio", "")]
    langs = coach.get("languages", [])
    if langs:
        parts.append(" ".join(langs))
    return " ".join(p for p in parts if p).strip()


def embed_coach_profile(coach_id: str) -> Dict[str, Any]:
    """Embed a coach profile and store vector in DynamoDB."""
    try:
        resp = coaches_table.get_item(Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"})
        coach = resp.get("Item")
    except Exception as exc:
        raise ValidationError(f"Failed to fetch coach: {exc}") from exc
    if not coach:
        raise ValidationError(f"Coach {coach_id} not found")

    text = _build_embedding_text(coach)
    if not text:
        raise ValidationError(f"Coach {coach_id} has no embeddable content")

    embeddings = _embed_texts([text], input_type="search_document")
    if not embeddings:
        raise SearchUnavailableError("Empty embedding result")

    decimal_emb = [Decimal(str(round(v, 6))) for v in embeddings[0]]

    try:
        coaches_table.update_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"},
            UpdateExpression="SET embedding = :emb",
            ExpressionAttributeValues={":emb": decimal_emb},
        )
    except Exception as exc:
        raise ValidationError(f"Failed to store embedding: {exc}") from exc

    _safe_log("Coach embedded", {"coachId": coach_id, "dim": len(embeddings[0])})
    return {"coachId": coach_id, "embeddingDimension": len(embeddings[0])}


def re_embed_coach(coach_id: str) -> Dict[str, Any]:
    result = embed_coach_profile(coach_id)
    try:
        resp = coaches_table.get_item(Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"})
        result["embeddingVersion"] = int(resp.get("Item", {}).get("embeddingVersion", 0))
    except Exception:
        pass
    return result

# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------


def handler(event: dict, context: Any = None) -> Dict[str, Any]:
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    coach_id = path_params.get("coachId")

    _safe_log("Search request", {"httpMethod": http_method, "path": path})

    try:
        if http_method == "GET" and "/coaches/search" in path:
            qp = event.get("queryStringParameters") or {}
            q = qp.get("q", "")
            if not q:
                raise ValidationError("Query parameter 'q' is required")
            chapter = qp.get("chapter")
            limit = min(int(qp.get("limit", "20")), 100)
            return _json_response(200, semantic_search(q, chapter, limit))

        if http_method == "POST" and coach_id and path.endswith("/embed"):
            return _json_response(200, embed_coach_profile(coach_id))

        if http_method == "POST" and coach_id and path.endswith("/re-embed"):
            return _json_response(200, re_embed_coach(coach_id))

        return _json_response(400, {"error": {"code": "BAD_REQUEST", "message": "Unsupported"}})

    except ValidationError as exc:
        return _json_response(exc.status_code, exc.to_dict())
    except SearchUnavailableError as exc:
        return _json_response(exc.status_code, exc.to_dict())
    except Exception as exc:
        _safe_log("Unexpected error", {"error": str(exc)})
        return _json_response(500, {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})
