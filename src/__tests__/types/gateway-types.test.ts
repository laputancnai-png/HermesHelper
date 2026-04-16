import type { GatewayConfig, GatewayStatus } from "../../lib/tauri";
import { Commands } from "../../lib/tauri";

// Type-only smoke tests — if these compile, types are correct.
// If GatewayConfig or GatewayStatus don't exist, tsc will fail.
const _cfg: GatewayConfig = { botToken: "", allowedUsers: "" };
const _status: GatewayStatus = { running: false };
const _fn1: () => Promise<GatewayConfig> = Commands.getGatewayConfig;
const _fn2: (t: string, u: string) => Promise<void> = Commands.saveGatewayConfig;
const _fn3: () => Promise<GatewayStatus> = Commands.getGatewayStatus;
const _fn4: () => Promise<void> = Commands.startGateway;
const _fn5: () => Promise<void> = Commands.stopGateway;

export {};
