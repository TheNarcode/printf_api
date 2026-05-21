import UpiGateway from "upigateway";

const upiGateway = new UpiGateway(process.env.UPI_GATEWAY_TOKEN!);

export { upiGateway };
