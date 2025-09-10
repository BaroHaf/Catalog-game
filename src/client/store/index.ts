import { combineProducers, InferState } from "@rbxts/reflex";

import { shopSlice } from "./shop";
import { alertSlice } from "./alert";

export type RootStore = typeof store;

export type RootState = InferState<RootStore>;

export function createStore() {
	const store = combineProducers({
		shop: shopSlice,
		alert:alertSlice,
	});

	return store;
}

export const store = createStore();
