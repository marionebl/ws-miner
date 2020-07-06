import * as yargs from "yargs";
import { WsMiner } from "./ws-miner";

const cli = yargs
  .strict()
  .option("downstream", {
    required: true,
    type: "string",
    alias: "d",
    description: "remote address to expose at",
  })
  .option("upstream", {
    required: true,
    type: "string",
    alias: "u",
    description: "local address to expose",
  }).argv;

async function main() {
  const miner = await WsMiner.create({
    upstream: cli.upstream,
    downstream: cli.downstream,
  });

  miner.open();
}

main();
