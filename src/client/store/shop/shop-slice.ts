// src/client/store/shopSlice.ts
import { createProducer } from "@rbxts/reflex";

export type SubPageFilterType = "" | "keyword" | "assetType" | "special";
export interface SubPage { filterType: SubPageFilterType; value: string; }

// 👇 Top-level menu pages (KHÁC với `page` bên trong shop)
export type MenuPage = "shop" | "community";

export interface ShopState {
  // ----- Menu-level routing -----
  readonly menuPage: MenuPage;   // 👈 mới: dùng cho Shop ↔ Community
  readonly open: boolean;

  // ----- Shop-level routing -----
  readonly page: string;         // ví dụ: "Featured", "Clothes", ...
  readonly subpage: SubPage;
  readonly searchKeyword: string;
  readonly catalogVisible: boolean;
  readonly specialKey?: string;
  readonly checkout: boolean;
  readonly checkoutSolo: boolean;
}

export const NONE_FILTER: SubPageFilterType = "";

const makeSpecialKey = (page: string, value: string) =>
  `${page.lower()}:${tostring(value).lower()}`;

const initialState: ShopState = {
  // menu
  menuPage: "shop",
  open: false,

  // shop
  page: "Featured",
  subpage: { filterType: NONE_FILTER, value: "" },
  searchKeyword: "",
  catalogVisible: true,
  specialKey: undefined,
  checkout: false,
  checkoutSolo: false,
};

export const shopSlice = createProducer(initialState, {
  // ========== MENU-LEVEL ==========
  setShopOpen: (state, open: boolean): ShopState => ({ ...state, open }),

  setMenuPage: (state, menuPage: MenuPage): ShopState => ({
    ...state,
    menuPage,
    // Khi đổi menuPage, không nhất thiết reset shop-state;
    // nếu bạn muốn reset khi rời Shop, có thể uncomment block dưới:
    // ...(menuPage === "shop"
    //   ? {}
    //   : { subpage: { filterType: "", value: "" }, searchKeyword: "", catalogVisible: true, specialKey: undefined, checkout: false, checkoutSolo: false }),
  }),

  // ========== SHOP-LEVEL ==========
  setPage: (state, page: string): ShopState => ({
    ...state,
    page,
    subpage: { filterType: NONE_FILTER, value: "" },
    searchKeyword: "",
    catalogVisible: true,
    specialKey: undefined,
  }),

  setSubpage: (state, subpage: SubPage): ShopState => {
    const isSpecial = subpage.filterType === "special";
    return {
      ...state,
      subpage,
      catalogVisible: !isSpecial,
      specialKey: isSpecial ? makeSpecialKey(state.page, subpage.value) : undefined,
      searchKeyword: "",
    };
  },

  setKeyword: (state, searchKeyword: string): ShopState => ({ ...state, searchKeyword }),

  setCheckout: (state, checkout: boolean): ShopState => ({
    ...state,
    checkout,
    checkoutSolo: checkout ? state.checkoutSolo : false,
  }),

  setCheckoutSolo: (state, solo: boolean): ShopState => ({ ...state, checkoutSolo: solo }),
});
