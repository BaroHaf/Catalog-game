import { combineProducers, InferState } from "@rbxts/reflex";

import { shopSlice } from "./shop";

export type RootStore = typeof store;

export type RootState = InferState<RootStore>;

export function createStore() {
	const store = combineProducers({
		shop: shopSlice,
	});

	return store;
}

export const store = createStore();
