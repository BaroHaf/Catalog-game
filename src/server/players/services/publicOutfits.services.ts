// src/server/players/services/public-outfits.services.ts
import { createCollection } from "@rbxts/lapis";
import { Players, RunService } from "@rbxts/services";
import { remotes, PublicOutfit, BodyColorsData, ScalesData } from "shared/remotes";

type PublicOutfitMap = Record<string, PublicOutfit>;

const publicOutfitsCollection = createCollection("public_outfits", { defaultData: {} as PublicOutfitMap });

let publicOutfitsDoc: Awaited<ReturnType<typeof publicOutfitsCollection.load>>;
let publicOutfitsCache: PublicOutfitMap = {};

const CLEAR_PUBLIC_ON_START = true;
const DEBUG_DUMP = true;

const BASE62_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomBase62(length: number) {
	const chars: string[] = [];
	for (let i = 0; i < length; i++) {
		const index = math.random(1, BASE62_CHARS.size());
		chars.push(BASE62_CHARS.sub(index, index));
	}
	return chars.join("");
}

function countMapKeys(map: Record<string, unknown>): number {
	let count = 0;
	for (const _ of pairs(map)) count++;
	return count;
}

function selectIdLength(existingIds: Record<string, unknown>, maxLength = 10): number {
	const radix = BASE62_CHARS.size();
	const totalExisting = countMapKeys(existingIds);

	for (let length = 1; length <= maxLength; length++) {
		const capacity = math.pow(radix, length);
		if (totalExisting < capacity) return length;
	}

	return maxLength;
}

function generateUniqueId(existingIds: Record<string, unknown>): string {
	const preferredLength = selectIdLength(existingIds);
	let candidate = randomBase62(preferredLength);
	let attempts = 0;

	while (existingIds[candidate] !== undefined && attempts < 500) {
		candidate = randomBase62(preferredLength);
		attempts++;
	}

	if (existingIds[candidate] !== undefined) {
		const longerLength = math.min(preferredLength + 1, 10);
		candidate = randomBase62(longerLength);
	}

	return candidate;
}

async function ensurePublicOutfitsDocLoaded() {
	if (publicOutfitsDoc) return;
	publicOutfitsDoc = await publicOutfitsCollection.load("GLOBAL");
	publicOutfitsCache = (publicOutfitsDoc.read() as PublicOutfitMap) ?? {};
}

function dumpPublicOutfits(tag: string) {
	if (!DEBUG_DUMP) return;
	let count = 0;
	for (const _ of pairs(publicOutfitsCache)) count++;
	print(`[Public/${tag}] total=${count}`);
}

export async function initPublicOutfitsService() {
	await ensurePublicOutfitsDocLoaded();

	if (CLEAR_PUBLIC_ON_START && RunService.IsStudio()) {
		publicOutfitsCache = {};
		publicOutfitsDoc.write(publicOutfitsCache);
		dumpPublicOutfits("CLEARED");
	}

	Players.PlayerAdded.Connect((player) => {
		remotes.client.publicOutfitsSync.fire(player, { full: true, data: publicOutfitsCache });
	});

	remotes.server.publishOutfit.connect(
		async (
			player,
			name,
			assets,
			snapshotThumb?,
			colors?: BodyColorsData,
			scales?: ScalesData,
			accessoryBlob?: string,
		) => {
			task.spawn(async () => {
				try {
					await ensurePublicOutfitsDocLoaded();

					const seenAssetIds = new Map<number, true>();
					const uniqueAssetIds: number[] = [];

					for (const assetId of assets ?? []) {
						if (typeIs(assetId, "number") && assetId > 0 && !seenAssetIds.get(assetId)) {
							seenAssetIds.set(assetId, true as true);
							uniqueAssetIds.push(assetId);
						}
					}

					const publicId = generateUniqueId(publicOutfitsCache);
					const publicOutfit: PublicOutfit = {
						id: publicId,
						ownerId: player.UserId,
						ownerName: player.Name,
						name,
						assets: uniqueAssetIds,
						snapshotThumb,
						updatedAt: os.time(),
						colors,
						scales,
					};

					publicOutfitsCache = { ...publicOutfitsCache, [publicId]: publicOutfit };
					publicOutfitsDoc.write(publicOutfitsCache);

					for (const targetPlayer of Players.GetPlayers()) {
						remotes.client.publicOutfitsSync.fire(targetPlayer, { patch: { [publicId]: publicOutfit } });
					}

					let totalPublicOutfits = 0;
					let ownerPublicOutfits = 0;

					for (const [, value] of pairs(publicOutfitsCache)) {
						totalPublicOutfits++;
						if ((value as PublicOutfit).ownerId === player.UserId) ownerPublicOutfits++;
					}

					print(
						`[Public] Published "${name}" by ${player.Name} -> ${publicId} | assets=${uniqueAssetIds.size()} | colors=${
							colors !== undefined
						} | scales=${scales !== undefined} | blob=${accessoryBlob !== undefined} | totalPublic=${totalPublicOutfits} | ownerPublic=${ownerPublicOutfits}`,
					);
				} catch (error) {
					warn(`[Public] publishOutfit error: ${error}`);
				}
			});
		},
	);

	remotes.server.getPublicOutfits.connect((player) => {
		remotes.client.publicOutfitsSync.fire(player, { full: true, data: publicOutfitsCache });
	});

	remotes.server.unpublishOutfit.connect(async (player, publicId) => {
		task.spawn(async () => {
			try {
				await ensurePublicOutfitsDocLoaded();

				const existingOutfit = publicOutfitsCache[publicId];
				if (!existingOutfit) return;

				if (!RunService.IsStudio() && existingOutfit.ownerId !== player.UserId) {
					warn(`[Public] ${player.Name} tried to unpublish ${publicId} (not owner)`);
					return;
				}

				const tempMap: Record<string, PublicOutfit | undefined> = { ...publicOutfitsCache };
				tempMap[publicId] = undefined;

				const compactMap: PublicOutfitMap = {};
				for (const [key, value] of pairs(tempMap)) {
					if (value) compactMap[key] = value as PublicOutfit;
				}

				publicOutfitsCache = compactMap;
				publicOutfitsDoc.write(publicOutfitsCache);

				for (const targetPlayer of Players.GetPlayers()) {
					remotes.client.publicOutfitsSync.fire(targetPlayer, { remove: [publicId] });
				}

				print(`[Public] Unpublished ${publicId}`);
				dumpPublicOutfits("AFTER_UNPUBLISH");
			} catch (error) {
				warn(`[Public] unpublishOutfit error: ${error}`);
			}
		});
	});
}
