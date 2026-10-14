"""Owned subprocess transport with bounded output and independent exit waiting."""

from __future__ import annotations

import asyncio
from typing import Any, cast


class BridgeProcess(asyncio.SubprocessProtocol):
    """Use public transport APIs to close pipes without waiting for descendants."""

    def __init__(self, loop: asyncio.AbstractEventLoop, limit: int):
        self._loop = loop
        self._limit = limit
        self._transport: asyncio.SubprocessTransport | None = None
        self._buffer = bytearray()
        self._failure: Exception | None = None
        self._eof = False
        self._stdin_closed = False
        self._paused = False
        self._read_ready: asyncio.Future[None] | None = None
        self._write_ready: asyncio.Future[None] | None = None
        self._exited: asyncio.Future[int] = loop.create_future()

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self._transport = cast(asyncio.SubprocessTransport, transport)

    def _wake_reader(self) -> None:
        if self._read_ready is not None and not self._read_ready.done():
            self._read_ready.set_result(None)

    def pipe_data_received(self, fd: int, data: bytes) -> None:
        if fd != 1 or self._failure is not None:
            return
        if len(self._buffer) + len(data) > self._limit:
            self._failure = ValueError("Runtime bridge response exceeds frame limit")
            assert self._transport is not None
            pipe = self._transport.get_pipe_transport(1)
            if pipe is not None:
                pipe.close()
        else:
            self._buffer.extend(data)
        self._wake_reader()

    def pipe_connection_lost(self, fd: int, exc: Exception | None) -> None:
        if fd == 1:
            self._eof = True
            if exc is not None:
                self._failure = OSError("Runtime bridge output failed")
            self._wake_reader()
        elif fd == 0:
            self._stdin_closed = True
            self.resume_writing()

    def process_exited(self) -> None:
        assert self._transport is not None
        code = self._transport.get_returncode()
        if code is not None and not self._exited.done():
            self._exited.set_result(code)

    def pause_writing(self) -> None:
        self._paused = True

    def resume_writing(self) -> None:
        self._paused = False
        if self._write_ready is not None and not self._write_ready.done():
            self._write_ready.set_result(None)

    @property
    def returncode(self) -> int | None:
        return None if self._transport is None else self._transport.get_returncode()

    async def write(self, frame: bytes) -> None:
        assert self._transport is not None
        pipe = cast(asyncio.WriteTransport, self._transport.get_pipe_transport(0))
        if self._stdin_closed or pipe.is_closing():
            raise BrokenPipeError("Runtime bridge input closed")
        pipe.write(frame)
        while self._paused and not self._stdin_closed:
            self._write_ready = self._loop.create_future()
            try:
                await self._write_ready
            finally:
                self._write_ready = None
        if self._stdin_closed:
            raise BrokenPipeError("Runtime bridge input closed")

    async def readline(self) -> bytes:
        while True:
            if self._failure is not None:
                raise self._failure
            newline = self._buffer.find(b"\n")
            if newline >= 0:
                line = bytes(self._buffer[:newline + 1])
                del self._buffer[:newline + 1]
                return line
            if self._eof:
                line = bytes(self._buffer)
                self._buffer.clear()
                return line
            self._read_ready = self._loop.create_future()
            try:
                await self._read_ready
            finally:
                self._read_ready = None

    def end_input(self) -> None:
        assert self._transport is not None
        pipe = self._transport.get_pipe_transport(0)
        if pipe is not None:
            pipe.close()

    async def wait(self) -> int:
        # process_exited establishes child reaping independently of pipe EOF.
        return await asyncio.shield(self._exited)

    def kill(self) -> None:
        assert self._transport is not None
        self._transport.kill()

    def close_transport(self) -> None:
        assert self._transport is not None
        self._transport.close()
        self._buffer.clear()


async def spawn_bridge(command: tuple[str, ...], *, limit: int, **options: Any) -> BridgeProcess:
    loop = asyncio.get_running_loop()
    protocol = BridgeProcess(loop, limit)
    await loop.subprocess_exec(
        lambda: protocol, *command, stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL, **options,
    )
    return protocol
