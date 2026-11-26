"""
backend/mcp/__init__.py
=======================
Package for Model Context Protocol (MCP) server and client adapters.
"""

from backend.mcp.server import mcp
from backend.mcp.client_adapter import MCPClientAdapter

__all__ = ["mcp", "MCPClientAdapter"]
