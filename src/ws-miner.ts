import url from "url";
import WebSocket from "ws";
import { nanoid } from "nanoid";
import got from "got";
import { serialize, deserialize } from "./message";

export interface WsMinerOptions {
  downstream: string;
  upstream: string;
}

export class WsMiner {
  private requests = new Map<string, ReturnType<typeof got.stream>>();

  private constructor(
    private readonly socket: WebSocket,
    private readonly options: WsMinerOptions
  ) {
    this.socket.on("message", (raw) => {
      if (typeof raw !== "string") {
        return;
      }

      const [, message] = deserialize<any, any>(raw);

      if (!message) {
        return;
      }

      this.onMessage(message);
    });
  }

  static create(options: WsMinerOptions): Promise<WsMiner> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(options.downstream);
      ws.once("error", reject);
      ws.once("open", () => resolve(new WsMiner(ws, options)));
    });
  }

  public async onMessage(message: any) {
    const type = message.header.type as string;
    const requestId = message.header.requestId;

    switch (type) {
      case "connection": {
        console.log(message.body);
        break;
      }
      case "request-start": {
        const { host } = url.parse(this.options.upstream);
        const headers = { ...message.body.headers, host };

        const request = got.stream({
          url: `${this.options.upstream}${message.body.url}`,
          method: message.body.method,
          headers,
        });

        request.on("data", (data) =>
          this.socket.send(
            serialize({ type: "response-data", requestId }, String(data))
          )
        );

        this.requests.set(message.header.requestId, request);

        const head = await got.head({
          url: `${this.options.upstream}${message.body.url}`,
          headers,
        });

        this.socket.send(
          serialize(
            { type: "response-start", requestId },
            {
              code: head.statusCode,
              status: head.statusMessage,
              headers: head.headers,
            }
          )
        );
        break;
      }
      case "request-data": {
        const request = this.requests.get(message.header.requestId);

        if (request && request.writable && request.end !== request.write) {
          request.write(message.body);
        }
        break;
      }
      case "request-end": {
        const request = this.requests.get(message.header.requestId);

        if (request) {
          request.on("end", () =>
            this.socket.send(serialize({ type: "response-end", requestId }, ""))
          );

          if (request.writable && request.end !== request.write) {
            request.end();
          }
        }

        break;
      }
    }
  }

  public open() {
    const id = nanoid();
    const message = serialize({ type: "open" }, id);
    this.socket.send(message);
  }
}
