import * as yargs from "yargs";
import { WsMinerServer } from "./ws-miner-server";

const cli = yargs
  .strict()
  .option("port", {
    type: "number",
    required: true,
    alias: "p",
    description: "port to listen for incoming websocket connections",
  }).argv;

async function main() {
  const minerServer = await WsMinerServer.create({
    port: cli.port,
  });
}

main();
