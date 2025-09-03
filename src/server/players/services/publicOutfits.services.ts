// src/server/players/services/publicOutfits.services.ts
import { createCollection } from "@rbxts/lapis";
import { Players, RunService } from "@rbxts/services";
import { remotes, type PublicOutfit, BodyColorsData } from "shared/remotes";

/* ===== Collection riêng cho PUBLIC ===== */
type PublicDoc = Record<string, PublicOutfit>;
const publicCollection = createCollection("public_outfits", { defaultData: {} as PublicDoc });

let publicDoc: Awaited<ReturnType<typeof publicCollection.load>>;
let cache: PublicDoc = {};

/* ===== DEV flags ===== */
const CLEAR_PUBLIC_ON_START = true; // đổi về false nếu muốn giữ dữ liệu khi mở Studio
const DEBUG_DUMP = true;

/* ===== Helpers ===== */
const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomBase62(len = 8) {
	const out = new Array<string>();
	for (let i = 0; i < len; i++) {
		const n = math.random(1, BASE62.size());
		out.push(BASE62.sub(n, n));
	}
	return out.join("");
}
function uniqueId(existing: Record<string, unknown>, prefer = 8) {
	let id = randomBase62(prefer), g = 0;
	while (existing[id] !== undefined && g < 500) {
		id = randomBase62(math.clamp(prefer + math.floor(g / 50), 1, 10));
		g++;
	}
	return id;
}
async function ensureDoc() {
	if (publicDoc) return;
	publicDoc = await publicCollection.load("GLOBAL");
	cache = (publicDoc.read() as PublicDoc) ?? {};
}
function dump(tag: string) {
	if (!DEBUG_DUMP) return;
	let c = 0;
	for (const _ of pairs(cache)) c++;
	print(`[Public/${tag}] total=${c}`);
}

/* ===== Init ===== */
export async function initPublicOutfitsService() {
	await ensureDoc();

	if (CLEAR_PUBLIC_ON_START && RunService.IsStudio()) {
		cache = {};
		publicDoc.write(cache);
		dump("CLEARED");
	}

	// gửi full cho người vừa vào
	Players.PlayerAdded.Connect((plr) => {
		remotes.client.publicOutfitsSync.fire(plr, { full: true, data: cache });
	});

	/* ---------- PUBLISH (KHỚP REMOTES: nhận name, assets, snapshotThumb?, colors?) ---------- */
	remotes.server.publishOutfit.connect(async (player, name, assets, snapshotThumb?, colors?: BodyColorsData) => {
		task.spawn(async () => {
			try {
				await ensureDoc();

				// lọc & uniq
				const seen = new Map<number, true>();
				const clean: number[] = [];
				for (const a of assets ?? []) {
					if (typeIs(a, "number") && a > 0 && !seen.get(a)) {
						seen.set(a, true as true);
						clean.push(a);
					}
				}

				// tạo/ghi public
				const id = uniqueId(cache, 8);
				const pub: PublicOutfit = {
					id,
					ownerId: player.UserId,
					ownerName: player.Name,
					name,
					assets: clean,
					snapshotThumb,
					updatedAt: os.time(),
					colors, // LƯU MÀU
				};

				cache = { ...cache, [id]: pub };
				publicDoc.write(cache);

				// sync cho mọi client
				for (const p of Players.GetPlayers()) {
					remotes.client.publicOutfitsSync.fire(p, { patch: { [id]: pub } });
				}

				// === LOG: total counts ===
				let total = 0, ownerTotal = 0;
				for (const [, v] of pairs(cache)) {
					total++;
					if ((v as PublicOutfit).ownerId === player.UserId) ownerTotal++;
				}
				print(
					`[Public] Published "${name}" by ${player.Name} -> ${id} | assets=${clean.size()} | colors=${colors !== undefined} | totalPublic=${total} | ownerPublic=${ownerTotal}`,
				);
			} catch (e) {
				warn(`[Public] publishOutfit error: ${e}`);
			}
		});
	});

	/* ---------- GET FULL ---------- */
	remotes.server.getPublicOutfits.connect((player) => {
		remotes.client.publicOutfitsSync.fire(player, { full: true, data: cache });
	});

	/* ---------- UNPUBLISH ---------- */
	remotes.server.unpublishOutfit.connect(async (player, publicId) => {
		task.spawn(async () => {
			try {
				await ensureDoc();
				const exist = cache[publicId];
				if (!exist) return;

				if (!RunService.IsStudio() && exist.ownerId !== player.UserId) {
					warn(`[Public] ${player.Name} tried to unpublish ${publicId} (not owner)`);
					return;
				}

				const tmp: Record<string, PublicOutfit | undefined> = { ...cache };
				tmp[publicId] = undefined;

				const compact: PublicDoc = {};
				for (const [k, v] of pairs(tmp)) if (v) compact[k] = v as PublicOutfit;

				cache = compact;
				publicDoc.write(cache);

				for (const p of Players.GetPlayers()) {
					remotes.client.publicOutfitsSync.fire(p, { remove: [publicId] });
				}
				print(`[Public] Unpublished ${publicId}`);
				dump("AFTER_UNPUBLISH");
			} catch (e) {
				warn(`[Public] unpublishOutfit error: ${e}`);
			}
		});
	});
}
