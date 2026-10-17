"""Search selection and a Parallel MCP adapter for the research pipeline."""

import asyncio
import json
import os
import uuid
from urllib.parse import urlsplit

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import Implementation
from tavily import AsyncTavilyClient

MCP_URL = "https://search.parallel.ai/mcp"
USER_AGENT = (
    "watsonx-tavily-company-research-agent/1.0 "
    "(+https://github.com/deansaco/watsonx-tavily-company-research-agent)"
)


def resolve_search_provider(api_key=None, provider=None):
    """Preserve configured Tavily access; use Parallel for an unconfigured job."""
    configured = os.getenv("SEARCH_PROVIDER", "auto").strip().lower()
    allowed = {"auto", "parallel", "tavily", "none"}
    if configured not in allowed:
        raise ValueError("SEARCH_PROVIDER must be auto, parallel, tavily or none")
    # A request override cannot bypass a server's disabled-search control.
    if configured == "none":
        raise ValueError("Web search is disabled")
    selected = provider.strip().lower() if provider is not None else configured
    if selected not in allowed:
        raise ValueError("Search provider must be auto, parallel, tavily or none")
    if selected == "none":
        raise ValueError("Web search is disabled")
    if selected == "auto":
        selected = "tavily" if api_key else "parallel"
    if selected == "tavily" and not api_key:
        raise ValueError("Tavily requires an API key")
    return selected


def create_search_client(api_key=None, provider=None):
    selected = resolve_search_provider(api_key, provider)
    if selected == "tavily":
        return AsyncTavilyClient(api_key=api_key)
    return ParallelSearchClient()


def _web_url(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Search and fetch URLs must be HTTP or HTTPS without credentials")
    return value


class ParallelSearchClient:
    """Expose search/extract shapes consumed by the existing research nodes.

    Each call owns and closes its MCP transport. The stable research-session ID
    is shared across search and fetch calls, including concurrent research nodes.
    """

    provider = "parallel"

    def __init__(self, timeout=60):
        self.timeout = timeout
        self.session_id = str(uuid.uuid4())

    def _http_client(self):
        return httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(self.timeout),
        )

    async def _call(self, name, arguments):
        arguments = {**arguments, "session_id": self.session_id}
        async with asyncio.timeout(self.timeout):
            async with self._http_client() as http_client:
                async with streamable_http_client(MCP_URL, http_client=http_client) as (read, write, _):
                    async with ClientSession(
                        read, write,
                        client_info=Implementation(name="watsonx-company-research-agent", version="1.0"),
                    ) as session:
                        await session.initialize()
                        tools = await session.list_tools()
                        if name not in {tool.name for tool in tools.tools}:
                            raise RuntimeError(f"Parallel MCP does not offer {name}")
                        result = await session.call_tool(name, arguments)
        if result.isError:
            message = "\n".join(getattr(block, "text", "") for block in result.content)
            raise RuntimeError(f"Parallel {name} failed: {message}")
        payload = result.structuredContent
        if payload is None:
            for block in result.content:
                if getattr(block, "type", None) == "text":
                    try:
                        payload = json.loads(block.text)
                    except (ValueError, TypeError):
                        continue
                    if isinstance(payload, dict):
                        break
        if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
            raise ValueError(f"Parallel {name} returned no structured results")
        return payload

    async def search(self, query, *, max_results=5, topic=None, **kwargs):
        objective = query
        if topic == "news":
            objective = f"Find recent news: {query}"
        elif topic == "finance":
            objective = f"Find financial information: {query}"
        payload = await self._call("web_search", {"objective": objective, "search_queries": [query]})
        results = []
        for item in payload["results"][:max_results]:
            content = "\n\n".join(item.get("excerpts") or [])
            if not content or not item.get("url"):
                continue
            results.append({
                "url": _web_url(item["url"]),
                "title": item.get("title") or "",
                "content": content,
                "score": None,  # Parallel ranks results but does not return Tavily scores.
                "provider": self.provider,
            })
        return {"results": results}

    async def extract(self, urls, **kwargs):
        urls = [urls] if isinstance(urls, str) else list(urls)
        if not 1 <= len(urls) <= 20:
            raise ValueError("Fetch accepts between 1 and 20 URLs")
        payload = await self._call("web_fetch", {
            "urls": [_web_url(url) for url in urls],
            "full_content": True,  # Grounding and briefing summarize complete pages.
        })
        return {"results": [
            {"url": _web_url(item["url"]), "raw_content": item.get("full_content")
             or "\n\n".join(item.get("excerpts") or [])}
            for item in payload["results"]
        ], "failed_results": payload.get("errors") or []}
