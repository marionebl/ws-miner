import http from "http";
import url from "url";
import WebSocket, { Server } from "ws";
import { nanoid } from "nanoid";
import bunyan from "bunyan";
import { deserialize, serialize } from "./message";

export interface WsMinerServerOptions {
  port: number;
}

interface WsMinerServerInit {
  socketServer: Server;
  httpServer: http.Server;
}

export class WsMinerServer {
  private socketServer: Server;
  private httpServer: http.Server;

  private connections = new Map<string, WebSocket>();
  private ids = new WeakMap<WebSocket, string>();
  private log = bunyan.createLogger({
    name: "ws-miner-server",
  });

  private constructor(init: WsMinerServerInit) {
    this.socketServer = init.socketServer;
    this.httpServer = init.httpServer;

    this.httpServer.on(
      "request",
      async (req: http.IncomingMessage, res: http.ServerResponse) => {
        this.log.info(`[%s] %s`, req.method, req.url);

        const fragments = req.url?.split("/") || [];
        const requestId = nanoid();
        const connectionId = fragments.filter(Boolean)[0] || "";
        const connection = this.connections.get(connectionId);

        if (!connection) {
          res.writeHead(404, 'Not Found');
          res.end();
          return;
        }

        const upstreamUrl = req.url!.replace(`/${connectionId}`, "");
        this.log.info(`[%s] %s - %s`, req.method, upstreamUrl, connectionId);

        connection.on('message', (raw) => {
          if (typeof raw !== 'string') {
            return;
          }

          const [, message] = deserialize<any, any>(raw);
          
          if (!message) {
            return;
          }

          this.log.info(message.header);

          if (message.header.requestId !== requestId) {
            return;
          }

          switch (message.header.type) {
            case 'response-start':
              res.writeHead(message.body.code, message.body.status, message.body.headers);
              break;
            case 'response-data':
              res.write(message.body);
              break;
            case 'response-end':
              res.end();
              break;
          }
        });

        connection.send(
          serialize(
            { type: "request-start", requestId },
            { url: upstreamUrl, method: req.method, headers: req.headers }
          )
        );

        req.on("data", (data) =>
          connection.send(
            serialize({ type: "request-data", requestId }, data)
          )
        );

        req.on("end", () =>
          connection.send(serialize({ type: "request-end", requestId }, ""))
        );
      }
    );

    this.socketServer.on("connection", this.onConnection);

    const raw = this.httpServer.address();
    const address = typeof raw === "string" ? raw : raw?.port;
    this.log.info("started server on %s", address);
  }

  private onConnection = (
    connection: WebSocket,
    request: http.IncomingMessage
  ) => {
    const id = nanoid();
    this.connections.set(id, connection);
    this.ids.set(connection, id);

    this.log.info("open connection %s", id);

    const parsed = url.parse("http://" + request.headers.host!);

    const egress = url.format({
      ...parsed,
      protocol: "http",
      pathname: `/${id}/`,
    });

    connection.send(serialize({ type: "connection" }, egress));

    connection.on("message", (raw) => {

    });

    connection.on("close", () => {
      const id = this.ids.get(connection);

      if (id) {
        this.log.info("close connection %s", id);
        this.connections.delete(id);
      } else {
        this.log.warn("close unknown connection %s", id);
      }
    });
  };

  static create(options: WsMinerServerOptions) {
    return new Promise((resolve, reject) => {
      const httpServer = http.createServer();

      const socketServer = new Server({
        server: httpServer,
      });

      socketServer.once("error", reject);
      socketServer.once("listening", () => {
        const minerServer = new WsMinerServer({
          socketServer,
          httpServer,
        });

        resolve(minerServer);
      });

      httpServer.listen(options.port);
    });
  }
}
