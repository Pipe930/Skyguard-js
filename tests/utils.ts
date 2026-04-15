import { NodeHttpAdapter, HttpMethods, Context } from "../src/http/index";
import { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

type MockIncomingMessage = Omit<IncomingMessage, "socket"> & {
  socket: {
    encrypted?: boolean;
  };
};

export const createRequestMock = async (
  url: string,
  method: HttpMethods,
  body: unknown = null,
): Promise<Context> => {
  const mockReq = new Readable() as IncomingMessage;

  mockReq.url = url;
  mockReq.method = method;
  mockReq.headers = { host: "localhost:3000" };

  (mockReq as MockIncomingMessage).socket = {
    encrypted: false,
  };

  if (body) mockReq.push(JSON.stringify(body));
  mockReq.push(null);

  const mockRes = {
    statusCode: 200,
    setHeader: jest.fn(),
    removeHeader: jest.fn(),
    end: jest.fn(),
  } as unknown as ServerResponse;

  const server = new NodeHttpAdapter(mockReq, mockRes);
  return await server.getContext();
};
