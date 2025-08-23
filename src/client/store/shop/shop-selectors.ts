// src/client/store/shop-selectors.ts
import { RootState } from "..";

export const selectIsShopOpen = (state: RootState) => {
	return state.shop.open;
};

// 👇 Mới thêm cho menuPage
export const selectMenuPage = (state: RootState) => {
	return state.shop.menuPage;
};

export const selectPage = (state: RootState) => {
	return state.shop.page;
};

export const selectSubpage = (state: RootState) => {
	return state.shop.subpage;
};

export const selectSearchKeyword = (state: RootState) => {
	return state.shop.searchKeyword;
};

export const selectCatalogVisible = (state: RootState) => {
	return state.shop.catalogVisible;
};

export const selectSpecialKey = (state: RootState) => {
	return state.shop.specialKey;
};

export const selectCheckout = (state: RootState) => {
	return state.shop.checkout;
};

export const selectCheckoutSolo = (state: RootState) => {
	return state.shop.checkoutSolo;
};
