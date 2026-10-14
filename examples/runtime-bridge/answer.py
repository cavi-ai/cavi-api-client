"""Run an answer through an explicit trusted RuntimeClient factory."""

import argparse
import asyncio
from pathlib import Path

from cavi_runtime import RuntimeClient


async def answer(args):
    command = ["node", str(Path(args.bridge).resolve()), str(Path(args.factory).resolve())]
    async with await RuntimeClient.connect(command, timeout=args.timeout) as client:
        run = await client.start_run({"input": args.prompt, "model": args.model})
        print(await client.require_run_text(run))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bridge", required=True)
    parser.add_argument("--factory", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("prompt")
    asyncio.run(answer(parser.parse_args()))
