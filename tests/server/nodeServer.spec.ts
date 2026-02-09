import { NodeServer } from "../../src/server/nodeNativeServer";
import { NodeHttpAdapter } from "../../src/http/nodeNativeHttp";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { App } from "../../src/app";

jest.mock("node:http", () => ({
  createServer: jest.fn(),
}));

jest.mock("../../src/http/nodeNativeHttp", () => ({
  NodeHttpAdapter: jest.fn(),
}));

describe("NodeServerTest", () => {
  it("should create http server and delegate request to App.handle", () => {
    const handleMock = jest.fn();

    const appMock = {
      handle: handleMock,
    } as unknown as App;

    const fakeReq = {} as IncomingMessage;
    const fakeRes = {} as ServerResponse;
    const listenMock = jest.fn();

    (createServer as jest.Mock).mockImplementation(
      (callback: (req: IncomingMessage, res: ServerResponse) => void) => {
        callback(fakeReq, fakeRes);

        return {
          listen: listenMock,
        };
      },
    );

    const server = new NodeServer(appMock);
    server.listen(3000);

    expect(createServer).toHaveBeenCalled();
    expect(NodeHttpAdapter).toHaveBeenCalledWith(fakeReq, fakeRes);
    expect(handleMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledWith(3000);
  });
});
