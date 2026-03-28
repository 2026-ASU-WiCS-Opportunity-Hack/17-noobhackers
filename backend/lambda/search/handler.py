"""AI semantic search Lambda handler.

Handles cross-lingual coach search and profile embedding via API Gateway
proxy integration:

- GET  /coaches/search              → semantic_search
- POST /coaches/{coachId}/embed     → embed_coach_profile  (internal)
- POST /coaches/{coachId}/re-embed  → re_embed_coach       (internal)

Fallback strategy (per design):
1. LLM query parsing fails → skip structured filters, do pure semantic search
2. Embedding fails → fall back to DynamoDB keyword search
3. OpenSearch fails → fall back to DynamoDB keyword search

Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
"""

from __future__ import annotations

import json
import logging
import os
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
OPENSEARCH_ENDPOINT = os.environ.get("OPENSEARCH_ENDPOINT", "")
OPENSEARCH_INDEX = os.environ.get("OPENSEARCH_INDEX", "coach-profiles")
BEDROCK_EMBEDDING_MODEL = os.environ.get(
    "BEDROCK_EMBEDDING_MODEL", "amazon.titan-embed-text-v2:0"
)
BEDROCK_LLM_MODEL = os.environ.get(
    "BEDROCK_LLM_MODEL", "anthropic.claude-3-haiku-20240307-v1:0"
)
EMBEDDING_DIMENSION = 1024
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# AWS clients — instantiated once per container for connection reuse
dynamodb = boto3.resource("dynamodb")
bedrock_client = boto3.client("bedrock-runtime", region_name=AWS_REGION)

coaches_table = dynamodb.Table(COACHES_TABLE)

# OpenSearch Serverless client (uses SigV4 auth)
# Lazy-initialized to avoid import errors when opensearchpy is not available
_os_client = None


def _get_opensearch_client():
    """Lazy-initialize the OpenSearch client with SigV4 auth."""
    global _os_client
    if _os_client is not None:
        return _os_client

    if not OPENSEARCH_ENDPOINT:
        return None

    try:
        from opensearchpy import OpenSearch, RequestsHttpConnection
        from requests_aws4auth import AWS4Auth

        credentials = boto3.Session().get_credentials()
        aws_auth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            AWS_REGION,
            "aoss",
            session_token=credentials.token,
        )

        # Strip protocol prefix if present
        host = OPENSEARCH_ENDPOINT
        if host.startswith("https://"):
            host = host[len("https://"):]

        _os_client = OpenSearch(
            hosts=[{"host": host, "port": 443}],
            http_auth=aws_auth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection,
        )
        return _os_client
    except ImportError:
        _safe_log("opensearchpy or requests_aws4auth not available; vector search disabled")
        return None
    except Exception as exc:
        _safe_log("Failed to initialize OpenSearch client", {"error": str(exc)})
        return None


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
    """Build an API Gateway proxy-compatible response."""
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=_decimal_default),
    }


def _decimal_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    """Log with PII redaction applied."""
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))


# ---------------------------------------------------------------------------
# Bedrock: Embedding
# ---------------------------------------------------------------------------


def _embed_text(text: str) -> List[float]:
    """Generate a 1024-dimension embedding vector via Bedrock.

    Uses Amazon Titan Embeddings v2 (multilingual).
    Raises on failure so callers can fall back to keyword search.
    """
    try:
        response = bedrock_client.invoke_model(
            modelId=BEDROCK_EMBEDDING_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "inputText": text,
                "dimensions": EMBEDDING_DIMENSION,
            }),
        )
        result = json.loads(response["body"].read())
        embedding = result.get("embedding", [])

        if len(embedding) != EMBEDDING_DIMENSION:
            raise SearchUnavailableError(
                f"Embedding dimension mismatch: expected {EMBEDDING_DIMENSION}, got {len(embedding)}"
            )

        return embedding

    except ClientError as exc:
        _safe_log("Bedrock embedding failed", {"error": str(exc)})
        raise SearchUnavailableError(f"Embedding model unavailable: {exc}") from exc


# ---------------------------------------------------------------------------
# Bedrock: LLM query parsing
# ---------------------------------------------------------------------------


def _parse_query_with_llm(query: str) -> Tuple[Dict[str, str], str]:
    """Use Bedrock LLM to extract structured filters from a natural language query.

    Returns (structured_filters, semantic_portion).
    structured_filters may contain 'location' and/or 'language' keys.
    semantic_portion is the remaining text for vector search.

    On failure, returns empty filters and the original query as semantic portion.
    Requirement: 8.4
    """
    prompt = (
        "You are a search query parser. Given a user query about finding coaches, "
        "extract structured filters and the semantic search portion.\n\n"
        "Extract these filters if present:\n"
        "- location: city, country, or region mentioned\n"
        "- language: spoken language mentioned\n\n"
        "Return ONLY valid JSON with this exact format:\n"
        '{"filters": {"location": "...", "language": "..."}, "semantic": "..."}\n\n'
        "If a filter is not present, omit it from the filters object.\n"
        "The semantic field should contain the remaining meaningful search text.\n\n"
        f"Query: {query}\n\nJSON:"
    )

    try:
        response = bedrock_client.invoke_model(
            modelId=BEDROCK_LLM_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 256,
                "messages": [{"role": "user", "content": prompt}],
            }),
        )
        result = json.loads(response["body"].read())

        # Extract text from Claude response
        content = result.get("content", [])
        text = content[0].get("text", "{}") if content else "{}"

        parsed = json.loads(text)
        filters = parsed.get("filters", {})
        semantic = parsed.get("semantic", query)

        # Ensure semantic portion is non-empty
        if not semantic or not semantic.strip():
            semantic = query

        return filters, semantic

    except Exception as exc:
        _safe_log("LLM query parsing failed, skipping structured filters", {"error": str(exc)})
        return {}, query


# ---------------------------------------------------------------------------
# OpenSearch vector search
# ---------------------------------------------------------------------------


def _vector_search(
    embedding: List[float],
    filters: Dict[str, str],
    chapter_id: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Query OpenSearch Serverless for vector similarity (cosine).

    Merges structured filters (location, language) with knn vector search.
    Returns results ranked by descending relevance score.
    Requirement: 8.3, 8.6
    """
    os_client = _get_opensearch_client()
    if os_client is None:
        raise SearchUnavailableError("OpenSearch client not available")

    # Build knn query
    knn_query: Dict[str, Any] = {
        "embedding": {
            "vector": embedding,
            "k": limit,
        }
    }

    # Build filter clauses for structured filters
    filter_clauses: List[Dict[str, Any]] = []

    if chapter_id:
        filter_clauses.append({"term": {"chapterId": chapter_id}})

    if filters.get("location"):
        filter_clauses.append({"match": {"location": filters["location"]}})

    if filters.get("language"):
        filter_clauses.append({"term": {"languages": filters["language"].lower()}})

    # Construct the search body
    search_body: Dict[str, Any] = {
        "size": limit,
        "_source": {
            "excludes": ["embedding"],
        },
        "query": {
            "knn": knn_query,
        },
    }

    # Add post_filter for structured filters
    if filter_clauses:
        search_body["post_filter"] = {
            "bool": {"must": filter_clauses}
        }

    try:
        response = os_client.search(
            index=OPENSEARCH_INDEX,
            body=search_body,
        )

        hits = response.get("hits", {}).get("hits", [])
        results = []
        for hit in hits:
            source = hit.get("_source", {})
            source["_score"] = hit.get("_score", 0.0)
            results.append(source)

        # Sort by descending score (should already be sorted, but ensure)
        results.sort(key=lambda x: x.get("_score", 0.0), reverse=True)

        return results

    except Exception as exc:
        _safe_log("OpenSearch vector search failed", {"error": str(exc)})
        raise SearchUnavailableError(f"Vector search failed: {exc}") from exc


# ---------------------------------------------------------------------------
# DynamoDB keyword search fallback
# ---------------------------------------------------------------------------


def _keyword_search(
    query: str,
    chapter_id: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Fall back to DynamoDB scan with keyword matching.

    Searches name, bio, and location fields for the query string.
    Requirement: 8.7
    """
    query_lower = query.lower()

    try:
        # Scan all active coaches
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
            response = coaches_table.scan(
                ExclusiveStartKey=response["LastEvaluatedKey"],
                **scan_kwargs,
            )
            items.extend(response.get("Items", []))

        # Filter by keyword match in name, bio, location
        matched = []
        for item in items:
            searchable = " ".join([
                item.get("name", ""),
                item.get("bio", ""),
                item.get("location", ""),
                " ".join(item.get("languages", [])),
            ]).lower()

            if query_lower in searchable:
                matched.append(item)

        return matched[:limit]

    except Exception as exc:
        _safe_log("Keyword search failed", {"error": str(exc)})
        raise SearchUnavailableError(f"Keyword search failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Semantic search — main entry point (Requirement 8.1, 8.3, 8.4, 8.6, 8.7)
# ---------------------------------------------------------------------------


def semantic_search(
    query: str,
    chapter_id: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """AI-powered cross-lingual coach search with multi-level fallback.

    Pipeline:
    1. Send query to Bedrock LLM for structured filter extraction
    2. Embed semantic portion via multilingual embedding model
    3. Query OpenSearch Serverless for vector similarity
    4. Merge structured filters with semantic results
    5. Fall back to keyword search if AI pipeline unavailable

    Fallback chain:
    - LLM parsing fails → skip structured filters, do pure semantic search
    - Embedding fails → fall back to DynamoDB keyword search
    - OpenSearch fails → fall back to DynamoDB keyword search
    """
    fallback = False

    # Step 1: Parse query with LLM (non-fatal on failure)
    structured_filters, semantic_query = _parse_query_with_llm(query)

    # Step 2: Embed the semantic portion
    try:
        embedding = _embed_text(semantic_query)
    except (SearchUnavailableError, Exception) as exc:
        _safe_log("Embedding failed, falling back to keyword search", {"error": str(exc)})
        results = _keyword_search(query, chapter_id=chapter_id, limit=limit)
        return {"results": results, "fallback": True}

    # Step 3 & 4: Vector search with structured filters
    try:
        results = _vector_search(
            embedding=embedding,
            filters=structured_filters,
            chapter_id=chapter_id,
            limit=limit,
        )
    except (SearchUnavailableError, Exception) as exc:
        _safe_log("Vector search failed, falling back to keyword search", {"error": str(exc)})
        results = _keyword_search(query, chapter_id=chapter_id, limit=limit)
        fallback = True

    return {"results": results, "fallback": fallback}


# ---------------------------------------------------------------------------
# Coach profile embedding pipeline (Requirement 8.1, 8.2, 8.5)
# ---------------------------------------------------------------------------


def _build_embedding_text(coach: Dict[str, Any]) -> str:
    """Concatenate coach profile fields into a single text for embedding.

    Combines name + location + bio + languages into a searchable text block.
    """
    parts = [
        coach.get("name", ""),
        coach.get("location", ""),
        coach.get("bio", ""),
    ]
    languages = coach.get("languages", [])
    if languages:
        parts.append(" ".join(languages))

    return " ".join(p for p in parts if p).strip()


def embed_coach_profile(coach_id: str) -> Dict[str, Any]:
    """Embed a coach profile and store the vector in OpenSearch.

    Fetches the coach record from DynamoDB, builds the embedding text,
    calls Bedrock for the embedding, and indexes into OpenSearch.

    Requirement: 8.1, 8.2
    """
    # Fetch coach record
    try:
        response = coaches_table.get_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"}
        )
        coach = response.get("Item")
    except Exception as exc:
        _safe_log("Failed to fetch coach for embedding", {"coachId": coach_id, "error": str(exc)})
        raise ValidationError(f"Failed to fetch coach: {exc}") from exc

    if not coach:
        raise ValidationError(f"Coach {coach_id} not found")

    # Build text and embed
    text = _build_embedding_text(coach)
    if not text:
        raise ValidationError(f"Coach {coach_id} has no embeddable content")

    embedding = _embed_text(text)

    # Index into OpenSearch
    _index_coach_embedding(coach, embedding)

    _safe_log("Coach profile embedded", {"coachId": coach_id})
    return {"coachId": coach_id, "embeddingDimension": len(embedding)}


def re_embed_coach(coach_id: str) -> Dict[str, Any]:
    """Re-embed a coach profile after approval.

    Triggered on profile approval. Increments embeddingVersion check
    and updates the vector store within 5 minutes.

    Requirement: 8.5
    """
    result = embed_coach_profile(coach_id)

    # Verify embeddingVersion was incremented (done by approve_coach_update)
    try:
        response = coaches_table.get_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"}
        )
        coach = response.get("Item", {})
        result["embeddingVersion"] = int(coach.get("embeddingVersion", 0))
    except Exception:
        pass

    _safe_log("Coach profile re-embedded", {"coachId": coach_id})
    return result


def _index_coach_embedding(
    coach: Dict[str, Any],
    embedding: List[float],
) -> None:
    """Index a coach profile with its embedding vector into OpenSearch.

    Creates the index with knn_vector mapping if it doesn't exist.
    """
    os_client = _get_opensearch_client()
    if os_client is None:
        _safe_log("OpenSearch not available, skipping embedding index")
        return

    coach_id = coach.get("coachId", "")

    doc = {
        "coachId": coach_id,
        "chapterId": coach.get("chapterId", ""),
        "name": coach.get("name", ""),
        "certificationLevel": coach.get("certificationLevel", ""),
        "location": coach.get("location", ""),
        "languages": coach.get("languages", []),
        "bio": coach.get("bio", ""),
        "embedding": embedding,
    }

    try:
        # Ensure index exists with correct mapping
        _ensure_index_exists(os_client)

        os_client.index(
            index=OPENSEARCH_INDEX,
            id=coach_id,
            body=doc,
        )
    except Exception as exc:
        _safe_log("Failed to index coach embedding", {"coachId": coach_id, "error": str(exc)})
        raise SearchUnavailableError(f"Failed to index embedding: {exc}") from exc


def _ensure_index_exists(os_client) -> None:
    """Create the coach-profiles index if it doesn't exist."""
    try:
        if os_client.indices.exists(index=OPENSEARCH_INDEX):
            return

        index_body = {
            "settings": {
                "index": {
                    "knn": True,
                }
            },
            "mappings": {
                "properties": {
                    "coachId": {"type": "keyword"},
                    "chapterId": {"type": "keyword"},
                    "name": {"type": "text"},
                    "certificationLevel": {"type": "keyword"},
                    "location": {"type": "text"},
                    "languages": {"type": "keyword"},
                    "bio": {"type": "text"},
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": EMBEDDING_DIMENSION,
                        "method": {
                            "name": "hnsw",
                            "engine": "nmslib",
                            "space_type": "cosinesimil",
                        },
                    },
                }
            },
        }

        os_client.indices.create(index=OPENSEARCH_INDEX, body=index_body)
        _safe_log("OpenSearch index created", {"index": OPENSEARCH_INDEX})

    except Exception as exc:
        # Index may already exist from a concurrent call — not fatal
        _safe_log("Index creation check", {"error": str(exc)})


# ---------------------------------------------------------------------------
# Main handler — API Gateway proxy integration router
# ---------------------------------------------------------------------------


def handler(event: dict, context: Any = None) -> Dict[str, Any]:
    """Route incoming API Gateway events to the appropriate operation."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    coach_id = path_params.get("coachId")

    _safe_log("Incoming request", {"httpMethod": http_method, "path": path})

    try:
        # GET /coaches/search — semantic search
        if http_method == "GET" and "/coaches/search" in path:
            query_params = event.get("queryStringParameters") or {}
            query = query_params.get("q", "")
            if not query:
                raise ValidationError("Query parameter 'q' is required")

            chapter_id = query_params.get("chapter")
            limit = min(int(query_params.get("limit", "20")), 100)

            result = semantic_search(query, chapter_id=chapter_id, limit=limit)
            return _json_response(200, result)

        # POST /coaches/{coachId}/embed — embed coach profile (internal)
        if http_method == "POST" and coach_id and path.endswith("/embed"):
            result = embed_coach_profile(coach_id)
            return _json_response(200, result)

        # POST /coaches/{coachId}/re-embed — re-embed after approval (internal)
        if http_method == "POST" and coach_id and path.endswith("/re-embed"):
            result = re_embed_coach(coach_id)
            return _json_response(200, result)

        return _json_response(400, {"error": {"code": "BAD_REQUEST", "message": "Unsupported method or path"}})

    except ValidationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except SearchUnavailableError as exc:
        # Final fallback: if even keyword search fails, return the error
        _safe_log("Search completely unavailable", {"error": exc.message})
        return _json_response(exc.status_code, exc.to_dict())

    except json.JSONDecodeError:
        return _json_response(400, {"error": {"code": "INVALID_JSON", "message": "Request body is not valid JSON"}})

    except Exception as exc:
        _safe_log("Unexpected error", {"error": str(exc)})
        return _json_response(500, {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})
