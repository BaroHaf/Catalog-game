import { HttpService } from "@rbxts/services";
import { remotes } from "shared/remotes";

/**
 * Dịch vụ: nhận assetId (LeftArm/RightArm/LeftLeg/RightLeg/Torso/Head)
 * -> tra bundleId qua RoProxy -> trả lại client bằng remotes.client.bundleResolved
 *
 * YÊU CẦU: Game Settings -> Security -> Allow HTTP Requests = ON
 */
const ROPROXY_BASE = "https://catalog.roproxy.com";
const CACHE_TTL_SEC = 10 * 60; // 10 phút

type CacheEntry = { t: number; id?: number };
const cache = new Map<number, CacheEntry>();

const now = () => os.time();

function readCache(assetId: number): number | undefined | "miss" {
	const hit = cache.get(assetId);
	if (!hit) return "miss";
	if (now() - hit.t > CACHE_TTL_SEC) {
		cache.delete(assetId);
		return "miss";
	}
	return hit.id;
}

function writeCache(assetId: number, bundleId: number | undefined) {
	cache.set(assetId, { t: now(), id: bundleId });
}

function fetchFirstBundleIdViaRoProxy(assetId: number): number | undefined {
	const url = `${ROPROXY_BASE}/v1/assets/${assetId}/bundles`;
	const [ok, res] = pcall(() => HttpService.GetAsync(url));
	if (!ok) return undefined;

	const [ok2, json] = pcall(() => HttpService.JSONDecode(res as string));
	if (!ok2) return undefined;

	const data = json as unknown as { data?: Array<{ id: string }> };
	if (!data?.data || data.data.size() === 0) return undefined;

	const first = data.data[0]!;
	const n = tonumber(first.id);
	return typeOf(n) === "number" ? (n as number) : undefined;
}

function resolveBundleId(assetId: number): number | undefined {
	const cached = readCache(assetId);
	if (cached !== "miss") return cached;
	const id = fetchFirstBundleIdViaRoProxy(assetId);
	writeCache(assetId, id);
	return id;
}

export function initBundleResolverService() {
	// Client -> Server: chỉ 1 tham số assetId
	remotes.server.resolveBundleFromAssetId.connect((player, assetId) => {
		if (typeOf(assetId) !== "number") return;

		const bundleId = resolveBundleId(assetId);
		// Trả lại client qua remote client-side
		remotes.client.bundleResolved.fire(player, assetId, bundleId);
	});

	print(`[BundleResolver] ready (TTL=${CACHE_TTL_SEC}s, base=${ROPROXY_BASE})`);
}
