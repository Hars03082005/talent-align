"""
backend/mcp/client_adapter.py
=============================
Unified Client Adapter for interacting with the TalentAlign MCP server tools.
Provides programmatic access to all 4 tool groups with type safety and fallback handling.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from backend.mcp.server import mcp

logger = logging.getLogger(__name__)


class MCPClientAdapter:
    """
    Adapter allowing LangGraph agents, FastAPI endpoints, or external MCP consumers
    to list and invoke registered MCP tools directly.
    """

    def __init__(self, mcp_server=mcp):
        self.server = mcp_server

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List all tools registered in the MCP server with schemas."""
        try:
            tools = await self.server.list_tools() if asyncio.iscoroutinefunction(self.server.list_tools) else self.server.list_tools()
            return [
                {
                    "name": t.name,
                    "description": t.description,
                }
                for t in tools
            ]
        except Exception as e:
            logger.error(f"Error listing MCP tools: {e}")
            return []

    async def call_tool(self, tool_name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
        """Call any registered MCP tool by name with arguments."""
        args = arguments or {}
        try:
            if asyncio.iscoroutinefunction(self.server.call_tool):
                res = await self.server.call_tool(tool_name, args)
            else:
                res = self.server.call_tool(tool_name, args)

            # Unpack structured content if FastMCP wrapped
            if hasattr(res, "structured_content") and res.structured_content:
                if "result" in res.structured_content:
                    return res.structured_content["result"]
                return res.structured_content

            if hasattr(res, "content") and res.content:
                text_parts = [c.text for c in res.content if hasattr(c, "text")]
                return "\n".join(text_parts)

            return res
        except Exception as e:
            logger.error(f"Error calling MCP tool '{tool_name}': {e}")
            raise


# Global singleton adapter instance
mcp_client = MCPClientAdapter()
