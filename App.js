import "@expo/metro-runtime";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert as NativeAlert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable as NativePressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// React Native's Alert buttons are not available in a browser. Use browser
// dialogs on web while keeping the native alert behavior on phones.
const Alert = {
  alert(title, message, buttons) {
    if (Platform.OS !== "web") return NativeAlert.alert(title, message, buttons);

    const dialogText = [title, message].filter(Boolean).join("\n\n");
    const choices = Array.isArray(buttons) ? buttons : [];
    if (!choices.length) {
      window.alert(dialogText);
      return;
    }

    const cancelChoice = choices.find((button) => button.style === "cancel");
    const actionChoices = choices.filter((button) => button !== cancelChoice);
    if (actionChoices.length > 1) {
      const menu = actionChoices.map((button, index) => `${index + 1}. ${button.text || "Continue"}`).join("\n");
      const answer = window.prompt(`${dialogText}\n\n${menu}\n\nEnter a number to choose an action:`, "1");
      const selectedIndex = Number(answer) - 1;
      if (answer !== null && Number.isInteger(selectedIndex) && actionChoices[selectedIndex]) {
        actionChoices[selectedIndex].onPress?.();
      } else {
        cancelChoice?.onPress?.();
      }
      return;
    }

    const action = actionChoices[0];
    if (action && cancelChoice) {
      if (window.confirm(`${dialogText}\n\nChoose OK to ${action.text || "continue"}.`)) action.onPress?.();
      else cancelChoice.onPress?.();
      return;
    }

    window.alert(dialogText);
    action?.onPress?.();
  },
};

const ButtonSoundContext = createContext(null);

function Pressable({ onPress, ...props }) {
  const playButtonSound = useContext(ButtonSoundContext);
  const handlePress = onPress ? (event) => {
    if (playButtonSound) playButtonSound();
    return onPress(event);
  } : undefined;
  return <NativePressable {...props} onPress={handlePress} />;
}

const STORAGE_KEY = "grimms-business-tracker-v1";
const THEME_SPECS = [
  ["Pink and White", "#E83E80", "#C2185B", "#FCE4EC", "#FFF8FB", "#FFFFFF", "#F0C4D4", "#29262D", "#706B73"],
  ["Red and Black", "#C62828", "#111111", "#FBE7E7", "#F7F5F5", "#FFFFFF", "#DED8D8", "#211D1D", "#6E6262"],
  ["Rose and Cream", "#A83E62", "#702640", "#F7E1E8", "#FFF8F5", "#FFFFFF", "#EBD9D5", "#302326", "#79676B"],
  ["Burgundy and Ivory", "#702D3A", "#451A25", "#F2E0E3", "#F9F5EC", "#FFFFFF", "#E3D9CA", "#292322", "#726864"],
  ["Coral and Sand", "#D85F50", "#87392F", "#FBE4DE", "#FBF4EB", "#FFFFFF", "#E9DCCF", "#302622", "#786C63"],
  ["Peach and Plum", "#B65B77", "#66334B", "#F8E4E9", "#FFF7F1", "#FFFFFF", "#EBDDD4", "#30252B", "#796A70"],
  ["Orange and Charcoal", "#D76522", "#462719", "#FBE7D9", "#F8F5F0", "#FFFFFF", "#E5DDD3", "#292521", "#756D65"],
  ["Yellow and Slate", "#A97812", "#3F3A2C", "#F5EBCB", "#F8F7F0", "#FFFFFF", "#E5E0CC", "#292923", "#706F63"],
  ["Gold and Cream", "#A77722", "#5D451E", "#F4E8C9", "#FBF7EB", "#FFFFFF", "#E8DDC6", "#2D2920", "#777064"],
  ["Olive and Linen", "#68713B", "#353D22", "#E9EBD8", "#F7F5EA", "#FFFFFF", "#E1DEC9", "#28291F", "#71705E"],
  ["Forest and Mint", "#286448", "#173B2B", "#DDEFE4", "#F3F8F3", "#FFFFFF", "#D7E5D9", "#202923", "#647269"],
  ["Emerald and White", "#07805B", "#064B38", "#D9F1E8", "#F4FAF7", "#FFFFFF", "#D5E8DE", "#202923", "#627269"],
  ["Sage and Cream", "#718B6C", "#3D5941", "#E5EEE1", "#F7F7EF", "#FFFFFF", "#DFE4D6", "#282A24", "#6C7065"],
  ["Teal and Sand", "#187E83", "#124C54", "#D9EFF0", "#F7F5EC", "#FFFFFF", "#DCE2D8", "#202A2A", "#657170"],
  ["Turquoise and White", "#008C95", "#00535A", "#D9F2F2", "#F3FAF9", "#FFFFFF", "#D6E8E7", "#20292A", "#627071"],
  ["Navy and Gold", "#243D69", "#172744", "#E1E8F4", "#F5F6F8", "#FFFFFF", "#D9DFE8", "#20242C", "#646B78"],
  ["Blue and White", "#2768B2", "#173B68", "#DFEBFA", "#F4F8FD", "#FFFFFF", "#D9E3EF", "#202633", "#626C7A"],
  ["Sky and Cloud", "#398AB6", "#22546C", "#E2F1F8", "#F4FAFC", "#FFFFFF", "#D8E7EC", "#20292C", "#637176"],
  ["Periwinkle and Cream", "#5969B5", "#343D79", "#E6E8F8", "#F8F7F2", "#FFFFFF", "#E0DFE9", "#252631", "#6C6B78"],
  ["Lavender and White", "#7961A8", "#4A376E", "#EEE7F7", "#F9F7FC", "#FFFFFF", "#E5DDED", "#282431", "#6F6877"],
  ["Purple and Silver", "#7447A8", "#452C68", "#EEE4F6", "#F7F6F8", "#FFFFFF", "#E1DCE5", "#28242C", "#6D6872"],
  ["Violet and Pink", "#8B4F9D", "#552E62", "#F2E3F3", "#FBF6FA", "#FFFFFF", "#EADCE8", "#2C242D", "#766875"],
  ["Magenta and White", "#B72B7B", "#6D1949", "#F8E1EF", "#FCF6FA", "#FFFFFF", "#EADBE5", "#2E222A", "#766570"],
  ["Fuchsia and Charcoal", "#C02683", "#42233A", "#F8E2F0", "#F8F5F7", "#FFFFFF", "#E5DCE2", "#29232A", "#706773"],
  ["Black and Gold", "#C49A3A", "#25211A", "#F2E8CE", "#F5F3ED", "#FFFFFF", "#E2DDCF", "#24221D", "#6F6A5D"],
  ["Black and Rose", "#A74359", "#272020", "#F2E1E3", "#F7F4F3", "#FFFFFF", "#E4DADA", "#262020", "#706565"],
  ["Charcoal and Mint", "#3E8D78", "#283B36", "#DCEFE9", "#F4F7F5", "#FFFFFF", "#DCE4DF", "#242B28", "#68716C"],
  ["Slate and Copper", "#A85E3B", "#39434A", "#F2E3DA", "#F4F5F5", "#FFFFFF", "#DCE0E0", "#252A2D", "#687176"],
  ["Brown and Blush", "#795344", "#493329", "#F1E3DE", "#F9F4F0", "#FFFFFF", "#E5D9D1", "#2A2421", "#746A64"],
  ["Chocolate and Cream", "#76503C", "#412D22", "#F0E3D6", "#FAF6EE", "#FFFFFF", "#E8DCCB", "#29231E", "#756B60"],
  ["Cocoa and Rose", "#875465", "#50313C", "#F2E2E5", "#FAF5F3", "#FFFFFF", "#E7D9D8", "#2C2426", "#74686A"],
  ["Stone and Blue", "#55728F", "#33485C", "#E2EAF0", "#F6F6F3", "#FFFFFF", "#DEE1DE", "#252A2D", "#687074"],
  ["Denim and Mustard", "#3C6390", "#263E5A", "#E1EAF2", "#F8F6EC", "#FFFFFF", "#E2DFD1", "#26282A", "#6B6C68"],
  ["Aqua and Coral", "#168B8D", "#175357", "#DDF1EF", "#FBF6F0", "#FFFFFF", "#E4DED5", "#222B2A", "#68716D"],
  ["Seafoam and Navy", "#4C9A8C", "#243F50", "#DFF1EB", "#F3F8F6", "#FFFFFF", "#D9E5E1", "#222A2D", "#667074"],
  ["Pine and Peach", "#3D7056", "#294A39", "#E4EFE4", "#FBF3EC", "#FFFFFF", "#E5DED2", "#252924", "#6B7069"],
  ["Lime and Graphite", "#658A28", "#34411F", "#EAF1D9", "#F6F8F0", "#FFFFFF", "#DFE5D3", "#252921", "#697064"],
  ["Moss and Ivory", "#68784A", "#3F4D30", "#E8ECD9", "#FAF8ED", "#FFFFFF", "#E4E0D0", "#282920", "#706F61"],
  ["Ruby and Pearl", "#B41F43", "#64172D", "#F6DFE5", "#FBF6F6", "#FFFFFF", "#E9DADD", "#2B2225", "#74666A"],
  ["Cherry and Slate", "#BE3546", "#41434A", "#F5E1E2", "#F5F5F5", "#FFFFFF", "#DFDDDE", "#27282B", "#6B6D72"],
  ["Wine and Dusty Blue", "#793C57", "#3C405A", "#F0E3E8", "#F4F5F8", "#FFFFFF", "#DFDFE6", "#29252B", "#6F6A75"],
  ["Plum and Sage", "#714B72", "#414B43", "#EEE6EF", "#F5F7F0", "#FFFFFF", "#DFE3D7", "#29262C", "#6F6B72"],
  ["Orchid and Cream", "#A14F91", "#60345C", "#F3E3F0", "#FBF7F1", "#FFFFFF", "#E9DDD8", "#2C252B", "#746A72"],
  ["Cyan and Midnight", "#138BA6", "#23384C", "#DDF1F4", "#F4F8FA", "#FFFFFF", "#D9E3E7", "#22292D", "#667178"],
  ["Indigo and Peach", "#4E55A4", "#30345F", "#E5E6F5", "#FBF5EF", "#FFFFFF", "#E6DED9", "#262631", "#6C6B78"],
  ["Steel and Coral", "#55717F", "#37464D", "#E2EAED", "#F7F5F2", "#FFFFFF", "#E0DEDA", "#252A2D", "#687074"],
  ["Rust and Cream", "#B35332", "#613321", "#F4E3D9", "#FAF5EB", "#FFFFFF", "#E7DCCB", "#2C2521", "#766B62"],
  ["Terracotta and Sage", "#B65C48", "#4C5946", "#F4E4DC", "#F5F6EE", "#FFFFFF", "#E1E2D6", "#2A2923", "#706F65"],
  ["Mustard and Plum", "#A57A1D", "#573C58", "#F3EACF", "#F8F5EE", "#FFFFFF", "#E4DED2", "#292521", "#716B66"],
  ["Bronze and Teal", "#9B6A31", "#286A69", "#F1E6D7", "#F4F7F3", "#FFFFFF", "#DFE4DA", "#292923", "#6D7066"],
];
const mixHex = (first, second, amount) => {
  const a = first.replace("#", "");
  const b = second.replace("#", "");
  const channel = (index) => Math.round(parseInt(a.slice(index, index + 2), 16) * (1 - amount) + parseInt(b.slice(index, index + 2), 16) * amount).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
};
const contrastText = (hex) => {
  const value = String(hex || "#000000").replace("#", "");
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#21191C" : "#FFF9F1";
};
const validHexColor = (value) => /^#[0-9A-Fa-f]{6}$/.test(String(value || ""));
const CUSTOM_THEME_NAME = "Custom — choose your colors";
const DEFAULT_CUSTOM_THEME = {
  mode: "dark",
  paper: "#101418", card: "#1A2229", soft: "#172027", softAlt: "#202A32",
  ink: "#F5F0F7", muted: "#BDB3C2", accent: "#6985A0",
  line: "#3B4650", softLine: "#34414B", ripple: "#344D60",
};
const CUSTOM_THEME_COLOR_GROUPS = [
  { key: "surfaces", title: "Surfaces & backgrounds", subtitle: "Page, card, and soft container fills", colors: [["paper", "Main page background"], ["card", "Card and form surfaces"], ["soft", "Soft container background"], ["softAlt", "Alternative row background"]] },
  { key: "typography", title: "Text & typography", subtitle: "Primary and secondary text colors", colors: [["ink", "Primary text and headings"], ["muted", "Secondary text and metadata"]] },
  { key: "accents", title: "Accents & buttons", subtitle: "Brand actions and touch feedback", colors: [["accent", "Primary brand and button color"], ["ripple", "Touch feedback and pressed state"]] },
  { key: "borders", title: "Borders & separators", subtitle: "Card borders and subtle dividers", colors: [["line", "Borders and dividers"], ["softLine", "Subtle inner borders"]] },
];
const CUSTOM_THEME_COLOR_KEYS = CUSTOM_THEME_COLOR_GROUPS.flatMap((group) => group.colors.map(([key]) => key));
const customThemeFromColors = (colors, mode) => ({
  mode,
  paper: colors.paper, card: colors.card, line: colors.line, ink: colors.ink, muted: colors.muted,
  accent: colors.wine, soft: colors.soft, softAlt: colors.softAlt, softLine: colors.softLine, ripple: colors.ripple,
});
const CUSTOM_COLOR_SWATCHES = ["#111111", "#FFFFFF", "#D7263D", "#F04455", "#FF7A45", "#E4A800", "#3A9B62", "#168B8D", "#3478D4", "#7552B8", "#D83E91", "#8B6E5A", "#808080", "#F2E8D8"];
const makeThemeColors = (spec, dark = false) => {
  const redBlack = spec[0] === "Red and Black";
  const accent = dark ? (redBlack ? "#E53935" : mixHex(spec[1], "#FFFFFF", 0.12)) : spec[1];
  return ({
  // Dark palettes keep deep surfaces, with a subtle tint from each theme so
  // switching between dark themes changes every screen, not only the accent.
  wine: accent, wineDark: dark ? "#FFF7FA" : spec[7],
  rose: dark ? (redBlack ? "#271416" : mixHex("#222222", spec[1], 0.22)) : spec[3],
  paper: dark ? (redBlack ? "#090909" : mixHex("#101010", spec[1], 0.08)) : spec[4],
  card: dark ? (redBlack ? "#171112" : mixHex("#191919", spec[1], 0.12)) : spec[5],
  line: dark ? (redBlack ? "#4A2023" : mixHex("#333333", spec[1], 0.22)) : spec[6],
  ink: dark ? "#F5F0F7" : spec[7], muted: dark ? "#BDB3C2" : spec[8],
  sage: dark ? "#263C32" : "#E7EFE7", green: dark ? "#8AD7A8" : "#356A4B",
  amber: dark ? "#F2C76E" : "#8B5A16", amberBg: dark ? "#3D321F" : "#F8EEDB",
  red: dark ? "#FF9999" : "#9C3C3C", redBg: dark ? "#44292F" : "#F8E7E5",
  lavender: dark ? mixHex("#222222", spec[1], 0.15) : spec[3], soft: dark ? mixHex("#202020", spec[1], 0.08) : "#F7F3EF",
  softAlt: dark ? mixHex("#292929", spec[1], 0.10) : "#F0ECE8", softLine: dark ? mixHex("#3B3B3B", spec[1], 0.18) : "#E9D7D5",
  placeholder: dark ? "#A99EAE" : "#A79B95", onAccent: contrastText(accent), accentMuted: "#EACBD0", accentSoft: "#F4E6E3",
  ripple: dark ? mixHex("#514252", spec[1], 0.28) : "#F3E7E8",
  });
};
const makeCustomThemeColors = (custom) => {
  const selected = { ...DEFAULT_CUSTOM_THEME, ...(custom || {}) };
  const dark = selected.mode !== "light";
  const base = makeThemeColors(THEME_SPECS[1], dark);
  const pick = (key) => validHexColor(selected[key]) ? selected[key] : DEFAULT_CUSTOM_THEME[key];
  const paper = pick("paper");
  const card = pick("card");
  const accent = pick("accent");
  const soft = pick("soft");
  const softAlt = pick("softAlt");
  return {
    ...base, paper, card, line: pick("line"), ink: pick("ink"), muted: pick("muted"), wine: accent,
    wineDark: pick("ink"),
    rose: softAlt,
    lavender: soft,
    soft,
    softAlt,
    softLine: pick("softLine"),
    ripple: pick("ripple"),
    onAccent: contrastText(accent), accentMuted: mixHex(accent, dark ? card : "#FFFFFF", 0.56),
    accentSoft: mixHex(accent, dark ? paper : "#FFFFFF", 0.82),
  };
};
const THEMES = THEME_SPECS.flatMap((spec) => [
  { name: spec[0] + " — Light Mode", mode: "light", colors: makeThemeColors(spec) },
  { name: spec[0] + " — Dark Mode", mode: "dark", colors: makeThemeColors(spec, true) },
]).concat([{ name: CUSTOM_THEME_NAME, mode: "dark", colors: makeCustomThemeColors(DEFAULT_CUSTOM_THEME) }]);
const DEFAULT_THEME_SPEC = THEME_SPECS.find((spec) => spec[0] === "Stone and Blue") || THEME_SPECS[0];
const DEFAULT_THEME_NAME = DEFAULT_THEME_SPEC[0] + " — Light Mode";
const DEFAULT_THEME = THEMES.find((theme) => theme.name === DEFAULT_THEME_NAME) || THEMES[0];
let COLORS = DEFAULT_THEME.colors;
const setThemeColors = (name, customTheme) => {
  const selected = name === CUSTOM_THEME_NAME ? { colors: makeCustomThemeColors(customTheme) } : THEMES.find((theme) => theme.name === name) || DEFAULT_THEME;
  COLORS = selected.colors;
  styles = makeStyles();
};

const DASHBOARD_WIDGETS = [
  { id: "welcome", label: "Welcome and priorities", description: "Daily overview and fulfillment counts" },
  { id: "sales", label: "Sales and cash", description: "Daily, weekly, monthly, and yearly sales, profit, fees, and expenses" },
  { id: "fulfillment", label: "Order fulfillment", description: "Counts by sale status" },
  { id: "time", label: "Today’s time", description: "Today’s hours and clock status" },
  { id: "attention", label: "Needs your attention", description: "Low stock, open orders, and overdue tasks" },
  { id: "snapshot", label: "Business snapshot", description: "Quick counts for products, materials, orders, and tasks" },
  { id: "quickAdd", label: "Quick add", description: "Shortcuts for common records" },
];
const DEFAULT_DASHBOARD_WIDGET_ORDER = DASHBOARD_WIDGETS.map((widget) => widget.id);
const DASHBOARD_FULFILLMENT_PHASES = [
  { label: "Need to pack", statuses: ["Needs Packaging", "Packaging"] },
  { label: "Ready to ship", statuses: ["Ready to Ship"] },
  { label: "Shipped", statuses: ["Shipped"] },
  { label: "In transit", statuses: ["In Transit"] },
  { label: "Delivered", statuses: ["Delivered to Customer", "Delivered"] },
  { label: "Awaiting review", statuses: ["Awaiting Review"] },
  { label: "Awaiting payment", statuses: ["Awaiting Payment"] },
  { label: "Fulfilled", statuses: ["Fulfilled", "Complete"] },
];
const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "MM/DD/YY", "DD/MM/YYYY", "DD/MM/YY", "YYYY-MM-DD"];
const DEFAULT_DATE_FORMAT = "MM/DD/YYYY";
let CURRENT_DATE_FORMAT = DEFAULT_DATE_FORMAT;
const RECORD_PAGE_SIZE = 60;
const LISTING_ANALYTICS_METRICS = [
  { key: "views", label: "Views", icon: "◉" },
  { key: "clicks", label: "Clicks", icon: "↗" },
  { key: "favorites", label: "Favorites", icon: "♡" },
  { key: "likes", label: "Likes", icon: "♥" },
  { key: "watchers", label: "Watchers", icon: "◎" },
  { key: "offers", label: "Offers", icon: "◇" },
];

const ANNOUNCEMENTS = [
  {
    id: "workspace-refresh-2026-10",
    title: "A more focused business workspace",
    date: "October 18, 2026",
    body: "The tracker has a clearer left navigation, a tighter workspace, a square month calendar, and a What's new inbox. Your saved business records stay in this browser.",
  },
];
const PAGE_ICON_NAMES = {
  Dashboard: "dashboard",
  Components: "components",
  Products: "products",
  Listings: "listings",
  "Listing Analytics": "analytics",
  Orders: "orders",
  Production: "production",
  Reviews: "reviews",
  Finances: "finances",
  Calendar: "calendar",
  Ideas: "ideas",
  Audit: "audit",
  Suppliers: "suppliers",
  "Help & FAQ": "help",
  Settings: "settings",
};
const RECORD_ICON_NAMES = {
  component: "components",
  product: "products",
  listing: "listings",
  order: "orders",
  review: "reviews",
  expense: "finances",
  task: "audit",
  event: "calendar",
  workPlan: "calendar",
  idea: "ideas",
  supplier: "suppliers",
  restock: "components",
};
const ICON_PATHS = {
  dashboard: ["M3 3h8v8H3z", "M13 3h8v5h-8z", "M13 10h8v11h-8z", "M3 13h8v8H3z"],
  components: ["M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z", "M3.5 7.5V17L12 21V12", "M20.5 7.5V17L12 21"],
  products: ["M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z", "M4.5 7.8 12 12l7.5-4.2", "M12 12v9", "M8 5.2l8 4.5"],
  listings: ["M7 3h8l4 4v14H7z", "M15 3v5h4", "M10 12h6", "M10 16h6"],
  analytics: ["M3 3v18h18", "m7 14 4-4 4 4 6-7"],
  orders: ["M5 3h14v18l-3-2-4 2-4-2-3 2V3Z", "M9 8h6", "M9 12h6", "M9 16h3"],
  production: ["M3 21V9l5 3V8l5 4V5h8v16H3Z", "M16 8h2", "M16 12h2", "M7 17h2"],
  reviews: ["m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"],
  finances: ["M12 2v20", "M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  calendar: ["M4 5h16v16H4z", "M8 3v4", "M16 3v4", "M4 9h16", "M8 13h2", "M14 13h2", "M8 17h2"],
  ideas: ["M9 18h6", "M10 22h4", "M8.2 14.5a7 7 0 1 1 7.6 0c-.9.6-1.3 1.2-1.4 2.5h-4.8c-.1-1.3-.5-1.9-1.4-2.5Z"],
  audit: ["M4 4h16v16H4z", "M8 9h8", "M8 13h5", "M8 17h8"],
  suppliers: ["M3 7h11v11H3z", "M14 11h4l3 3v4h-7z", "M7 18.5a1.5 1.5 0 1 0 0 .1", "M18 18.5a1.5 1.5 0 1 0 0 .1"],
  help: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M9.7 9a2.4 2.4 0 1 1 4.5 1.2c-.8 1.1-2.2 1.3-2.2 3", "M12 17h.01"],
  settings: ["M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z", "m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"],
  mail: ["M3 5h18v14H3z", "m3 7 9 6 9-6"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  plus: ["M12 5v14", "M5 12h14"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "m16 16 5 5"],
};
const ICON_FALLBACKS = {
  dashboard: "▦", components: "⬡", products: "□", listings: "▤", analytics: "⌁", orders: "▣",
  production: "⚒", reviews: "☆", finances: "$", calendar: "▦", ideas: "✧", audit: "✓",
  suppliers: "↗", help: "?", settings: "⚙", mail: "✉", menu: "☰", plus: "+", search: "⌕",
};
function AppIcon({ name, size = 18, color = COLORS.muted, strokeWidth = 1.8 }) {
  if (Platform.OS !== "web") return <Text style={{ color, fontSize: size, lineHeight: size + 3 }}>{ICON_FALLBACKS[name] || "•"}</Text>;
  return React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    style: { display: "block", flexShrink: 0 },
  }, (ICON_PATHS[name] || ICON_PATHS.dashboard).map((d, index) => React.createElement("path", { key: index, d })));
}

const EMPTY_DB = {
  version: 10,
  currency: "USD",
  defaultLowStock: 3,
  monthlySalesGoal: 0,
  themeName: DEFAULT_THEME_NAME,
  customTheme: { ...DEFAULT_CUSTOM_THEME },
  sortModes: {},
  dashboardWidgetOrder: DEFAULT_DASHBOARD_WIDGET_ORDER,
  hiddenDashboardWidgets: [],
  dashboardDismissedAttention: [],
  marketplaceFeeRules: {},
  defaultTaskPriority: "Normal",
  defaultEventType: "Deadline",
  dateFormat: DEFAULT_DATE_FORMAT,
  businessName: "",
  businessStartDate: "",
  onboardingCompleted: false,
  buttonSoundsEnabled: false,
  tutorialCompleted: false,
  readAnnouncementIds: [],
  dismissedAnnouncementIds: [],
  components: [],
  products: [],
  listings: [],
  orders: [],
  deletedOrders: [],
  incomes: [],
  reviews: [],
  expenses: [],
  tasks: [],
  events: [],
  ideas: [],
  suppliers: [],
  productions: [],
  componentTransactions: [],
  productTransactions: [],
  purchases: [],
  timeSessions: [],
  timerSessions: [],
  workPlans: [],
  activeShift: null,
  activeTimer: null,
  dropdownOptions: {},
  nextComponentSku: 1,
  nextProductSku: 1,
  nextListingSku: 1,
  nextOrderSku: 1,
};

const RECORD_COLLECTIONS = ["components", "products", "listings", "orders", "deletedOrders", "incomes", "reviews", "expenses", "tasks", "events", "ideas", "suppliers", "productions", "componentTransactions", "productTransactions", "purchases", "timeSessions", "timerSessions", "workPlans"];
const DROPDOWN_ATTRIBUTE_FIELDS = { colors: "colors", materials: "materials", sizes: "sizes", genders: "gender" };

const DROPDOWN_SETS = [
  { key: "componentCategories", label: "Component categories" },
  { key: "componentUnits", label: "Component units" },
  { key: "productCategories", label: "Product categories" },
  { key: "colors", label: "Colors" },
  { key: "materials", label: "Materials" },
  { key: "sizes", label: "Sizes" },
  { key: "genders", label: "Gender or audience" },
  { key: "listingStatuses", label: "Listing statuses" },
  { key: "fulfillmentStatuses", label: "Order fulfillment statuses" },
  { key: "expenseCategories", label: "Expense categories" },
  { key: "taskCategories", label: "Task categories" },
  { key: "taskPriorities", label: "Task priorities" },
  { key: "eventTypes", label: "Calendar event types" },
  { key: "paymentMethods", label: "Payment methods" },
  { key: "shippingMethods", label: "Shipping and delivery methods" },
  { key: "supplierCategories", label: "Supplier categories" },
];

const DEFAULT_DROPDOWN_OPTIONS = {
  componentCategories: ["Packaging", "Findings", "Beads", "Fabric", "Tools", "Other"],
  componentUnits: ["pieces", "pairs", "sets", "grams", "ounces", "yards", "inches", "milliliters"],
  productCategories: ["Necklace", "Earrings", "Bracelet", "Accessory", "Gift set", "Other"],
  colors: ["Black", "White", "Ivory", "Cream", "Red", "Pink", "Orange", "Yellow", "Green", "Sage", "Blue", "Navy", "Purple", "Brown", "Tan", "Gold", "Silver", "Rose gold", "Multicolor", "Other"],
  materials: ["Brass", "Sterling silver", "Stainless steel", "Gold-filled", "Gold-plated", "Glass", "Crystal", "Freshwater pearl", "Acrylic", "Resin", "Wood", "Cotton", "Linen", "Leather", "Wool", "Ceramic", "Polymer clay", "Other"],
  sizes: ["One size", "XS", "S", "M", "L", "XL", "2XL", "3XL", "Petite", "Plus size", "Custom", "Other"],
  genders: ["Women", "Men", "Unisex", "Girls", "Boys", "Kids", "Not applicable", "Other"],
  marketplaces: ["Etsy", "Shopify", "eBay", "Vinted", "Mercari", "Depop", "Poshmark", "Facebook Marketplace", "Amazon", "Amazon Handmade", "TikTok Shop", "In-person", "Direct", "Other"],
  listingStatuses: ["Draft", "Scheduled", "Active", "Paused", "Sold", "Archived"],
  fulfillmentStatuses: ["Needs Packaging", "Packaging", "Ready to Ship", "Shipped", "In Transit", "Delivered to Customer", "Awaiting Review", "Awaiting Payment", "Fulfilled"],
  expenseCategories: ["Supplies", "Packaging", "Shipping", "Marketplace fees", "Marketing", "Subscriptions", "Equipment", "Other"],
  taskCategories: ["Production", "Order fulfillment", "Customer service", "Marketing", "Restock", "Admin", "Other"],
  taskPriorities: ["Low", "Normal", "High", "Urgent"],
  eventTypes: ["Deadline", "Product launch", "Market or event", "Payment due", "Order deadline", "Promotion", "Other"],
  paymentMethods: ["Cash", "Credit or debit card", "Etsy Payments", "Shopify Payments", "PayPal", "Venmo", "Zelle", "Other"],
  shippingMethods: ["USPS Ground Advantage", "USPS Priority Mail", "UPS", "FedEx", "Local pickup", "Digital delivery", "Other"],
  supplierCategories: ["Materials", "Packaging", "Tools and equipment", "Services", "Other"],
};

const NAV_ITEMS = [
  { id: "Dashboard", label: "Dashboard", icon: "DB" },
  { id: "Components", label: "Components", icon: "CM" },
  { id: "Products", label: "Products", icon: "PD" },
  { id: "Listings", label: "Listings", icon: "LS" },
  { id: "Orders", label: "Orders", icon: "OR" },
  { id: "Settings", label: "Settings", icon: "ST" },
];

const MORE_ITEMS = [
  ["Dashboard", "DB", "Daily overview and priorities"],
  ["Components", "CM", "Materials, stock, and restocks"],
  ["Products", "PD", "Product designs, prices, and inventory"],
  ["Listings", "LS", "Manage marketplace pages"],
  ["Listing Analytics", "AN", "Record listing stats and review performance over time"],
  ["Orders", "OR", "Track sales and fulfillment"],
  ["Production", "PR", "Make products and record material usage"],
  ["Reviews", "RV", "Save buyer comments and shop ratings"],
  ["Finances", "FN", "Sales, costs, and expenses"],
  ["Calendar", "CL", "Tasks, events, shifts, and business dates"],
  ["Ideas", "ID", "Product ideas and work stages"],
  ["Audit", "AU", "Review saved changes and inventory history"],
  ["Suppliers", "SP", "Supplier details and notes"],
  ["Help & FAQ", "HQ", "Instructions, common questions, and data help"],
  ["Settings", "ST", "Business profile and data tools"],
];

const SIDEBAR_GROUPS = [
  { label: "WORKSPACE", pages: ["Dashboard", "Components", "Products"] },
  { label: "SALES", pages: ["Listings", "Listing Analytics", "Orders", "Reviews"] },
  { label: "OPERATIONS", pages: ["Production", "Finances", "Calendar", "Ideas", "Audit", "Suppliers"] },
  { label: "SUPPORT", pages: ["Help & FAQ"] },
];

const localDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
const timestampDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? localDateKey(date) : "";
};
let TODAY = localDateKey(new Date());
const parseDateInput = (value) => {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  let year; let month; let day;
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
  else if (/^\d{6}$/.test(text)) {
    const first = Number(text.slice(0, 2)); const second = Number(text.slice(2, 4));
    const dayFirst = CURRENT_DATE_FORMAT.startsWith("DD/");
    month = dayFirst ? second : first;
    day = dayFirst ? first : second;
    year = Number(text.slice(4, 6));
    year += year >= 70 ? 1900 : 2000;
  } else if (/^\d{8}$/.test(text)) {
    if (Number(text.slice(0, 4)) >= 1900) {
      year = Number(text.slice(0, 4)); month = Number(text.slice(4, 6)); day = Number(text.slice(6, 8));
    } else {
      month = Number(text.slice(0, 2)); day = Number(text.slice(2, 4)); year = Number(text.slice(4, 8));
    }
  } else {
    match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/) || text.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (!match) return "";
    const first = Number(match[1]); const second = Number(match[2]);
    const dayFirst = CURRENT_DATE_FORMAT.startsWith("DD/");
    month = dayFirst ? second : first;
    day = dayFirst ? first : second;
    year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
const formatDateInput = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const canonical = dateOnly ? text : parseDateInput(text);
  if (canonical) {
    const year = canonical.slice(0, 4);
    const month = canonical.slice(5, 7);
    const day = canonical.slice(8, 10);
    if (CURRENT_DATE_FORMAT === "YYYY-MM-DD") return canonical;
    const twoDigitYear = CURRENT_DATE_FORMAT === "MM/DD/YY" || CURRENT_DATE_FORMAT === "DD/MM/YY";
    if (CURRENT_DATE_FORMAT.startsWith("DD/")) return `${day}/${month}/${twoDigitYear ? year.slice(2) : year}`;
    return `${month}/${day}/${twoDigitYear ? year.slice(2) : year}`;
  }
  const timestamp = new Date(text);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) && !Number.isNaN(timestamp.getTime()) ? formatDateInput(localDateKey(timestamp)) : text;
};
const nextSkuNumber = (rows, key, prefix) => {
  const pattern = new RegExp("^" + prefix + "([0-9]+)$", "i");
  const maximum = (rows || []).reduce((current, row) => {
    const match = String(row && row[key] || "").trim().match(pattern);
    return match ? Math.max(current, Number(match[1]) || 0) : current;
  }, 0);
  return maximum + 1;
};
const firstAvailableSkuNumber = (rows, key, prefix) => {
  const pattern = new RegExp("^" + prefix + "([0-9]+)$", "i");
  const used = new Set((rows || []).map((row) => {
    const match = String(row && row[key] || "").trim().match(pattern);
    return match ? Number(match[1]) : null;
  }).filter((number) => Number.isSafeInteger(number) && number > 0));
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
};
const productSkuReferences = (data) => [
  ...(data.listings || []).map((item) => ({ sku: item.productSku, productId: item.productId })),
  ...(data.orders || []).flatMap((order) => (order.items || []).map((item) => ({ sku: item.productSku, productId: item.productId }))),
  ...(data.deletedOrders || []).flatMap((order) => (order.items || []).map((item) => ({ sku: item.productSku, productId: item.productId }))),
  ...(data.reviews || []).map((item) => ({ sku: item.productSku || item.sku, productId: item.productId })),
  ...(data.productions || []).map((item) => ({ sku: item.productSku, productId: item.productId })),
].filter((item) => String(item.sku || "").trim());
const firstAvailableProductSkuNumber = (data) => firstAvailableSkuNumber([
  ...(data.products || []), ...productSkuReferences(data),
], "sku", "PROD-");
const normalizeProductSku = (value) => {
  const sku = String(value || "").trim();
  const match = sku.match(/^PROD-([0-9]+)$/i);
  if (!match || Number(match[1]) < 1) return sku;
  return "PROD-" + String(Number(match[1])).padStart(3, "0");
};
const attributeValues = (value) => (Array.isArray(value) ? value : String(value || "").split(/[\n,]+/))
  .map((item) => String(item || "").trim()).filter(Boolean);
const matchesAttributeFilter = (record, key, selected) => selected === "All" || attributeValues(record && record[key]).some((value) => value.toLowerCase() === String(selected).toLowerCase());
const attributeFilterOptions = (rows, optionKey, fieldKey) => Array.from(new Set([
  ...(DEFAULT_DROPDOWN_OPTIONS[optionKey] || []),
  ...(rows || []).flatMap((record) => attributeValues(record && record[fieldKey])),
])).sort((left, right) => left.localeCompare(right));
const withCurrentSkuCounters = (data) => {
  const preservedCounter = (value, rows, key, prefix) => Math.max(
    Number.isFinite(Number(value)) ? Math.max(1, Math.floor(Number(value))) : 1,
    nextSkuNumber(rows, key, prefix),
  );
  return {
    ...data,
    nextComponentSku: preservedCounter(data.nextComponentSku, data.components, "sku", "COMP-"),
    // Product numbers are reusable only when no product record (including archived ones) owns them.
    nextProductSku: firstAvailableProductSkuNumber(data),
    nextListingSku: preservedCounter(data.nextListingSku, data.listings, "listingSku", "LIST-"),
    nextOrderSku: preservedCounter(data.nextOrderSku, data.orders, "orderSku", "ORDER-"),
  };
};
const normalizeDatabase = (saved) => {
  const incoming = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const source = { ...incoming };
  RECORD_COLLECTIONS.forEach((key) => {
    const seenIds = new Set();
    source[key] = (Array.isArray(incoming[key]) ? incoming[key] : [])
      .filter((row) => row && typeof row === "object" && !Array.isArray(row))
      .map((row) => {
        let id = typeof row.id === "string" && row.id.trim() ? row.id : "";
        if (!id || seenIds.has(id)) id = uid(key.slice(0, -1));
        seenIds.add(id);
        return { ...row, id };
      });
  });
  source.activeShift = incoming.activeShift && typeof incoming.activeShift === "object" && !Array.isArray(incoming.activeShift) ? incoming.activeShift : null;
  source.activeTimer = incoming.activeTimer && typeof incoming.activeTimer === "object" && !Array.isArray(incoming.activeTimer) ? incoming.activeTimer : null;
  const savedOptions = source.dropdownOptions && typeof source.dropdownOptions === "object" ? source.dropdownOptions : {};
  const dropdownOptions = {};
  const savedVersion = Number(source.version) || 1;
  DROPDOWN_SETS.concat([{ key: "marketplaces" }]).forEach(({ key }) => {
    let options = Array.isArray(savedOptions[key]) ? savedOptions[key] : DEFAULT_DROPDOWN_OPTIONS[key];
    if (savedVersion < 6 && key === "marketplaces" && Array.isArray(savedOptions[key])) {
      options = Array.from(new Set(options.concat(DEFAULT_DROPDOWN_OPTIONS.marketplaces)));
    }
    if (key === "listingStatuses") options = Array.from(new Set(options.concat(["Scheduled"])));
    dropdownOptions[key] = Array.from(new Set(options.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())));
  });
  source.readAnnouncementIds = Array.isArray(source.readAnnouncementIds) ? source.readAnnouncementIds.filter((id) => typeof id === "string") : [];
  source.dismissedAnnouncementIds = Array.isArray(source.dismissedAnnouncementIds) ? source.dismissedAnnouncementIds.filter((id) => typeof id === "string") : [];
  source.dashboardDismissedAttention = Array.isArray(source.dashboardDismissedAttention)
    ? source.dashboardDismissedAttention.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.id === "string" && entry.id.trim())
    : [];
  const reservedListingSkus = new Set(source.listings.map((listing) => { const product = source.products.find((item) => item.id === listing.productId); const code = String(listing.listingSku || listing.productSku || "").trim(); return code && (!product || code !== product.sku) ? code.toLowerCase() : ""; }).filter(Boolean));
  let nextMigratedListingSku = 1;
  const listings = source.listings.map((listing, index) => {
    const marketplaces = Array.isArray(listing.marketplaces)
      ? listing.marketplaces.filter((item) => typeof item === "string" && item.trim())
      : (listing.marketplace ? String(listing.marketplace).split(",").map((item) => item.trim()).filter(Boolean) : []);
    const legacyDiscount = Number(listing.discountPercent) > 0
      ? [{
        id: uid("discount"),
        percent: Number(listing.discountPercent),
        startDate: listing.discountStartDate || TODAY,
        endDate: listing.discountEndDate || "",
        notes: "Migrated from the previous listing discount fields",
      }]
      : [];
    const discountPlans = Array.isArray(listing.discountPlans) && listing.discountPlans.length
      ? listing.discountPlans
      : legacyDiscount;
    const normalizedDiscountPlans = discountPlans.filter((plan) => plan && typeof plan === "object").map((plan) => ({
      ...plan,
      id: plan.id || uid("discount"),
      percent: Math.min(100, Math.max(0, Number(plan.percent) || 0)),
      startDate: typeof plan.startDate === "string" && plan.startDate ? plan.startDate : TODAY,
      endDate: typeof plan.endDate === "string" ? plan.endDate : "",
      notes: typeof plan.notes === "string" ? plan.notes : "",
    }));
    const activityReports = Array.isArray(listing.activityReports) ? listing.activityReports.filter((report) => report && typeof report === "object").map((report) => {
      const periodStart = parseDateInput(report.periodStart || report.date);
      const periodType = ["day", "week", "month", "year"].includes(report.periodType) ? report.periodType : "day";
      return {
        ...report,
        id: report.id || uid("listing-report"),
        listingId: listing.id,
        periodType,
        periodStart: periodStart || "",
        periodEnd: parseDateInput(report.periodEnd || report.periodStart || report.date) || periodStart || "",
        platform: typeof report.platform === "string" ? report.platform : "",
        metricMode: ["snapshot", "period"].includes(report.metricMode) ? report.metricMode : "unknown",
        metrics: report.metrics && typeof report.metrics === "object" && !Array.isArray(report.metrics)
          ? Object.entries(report.metrics).reduce((result, [key, value]) => { if (Number.isFinite(Number(value)) && Number(value) >= 0) result[key] = Number(value); return result; }, {})
          : {},
        note: typeof report.note === "string" ? report.note : "",
      };
    }) : [];
    const normalizedListing = { ...listing };
    delete normalizedListing.discountPercent;
    delete normalizedListing.discountStartDate;
    delete normalizedListing.discountEndDate;
    const product = source.products.find((item) => item.id === listing.productId);
    const storedListingSku = String(listing.listingSku || listing.productSku || "").trim();
    let listingSku = storedListingSku;
    if (!storedListingSku || (product && storedListingSku === product.sku)) {
      do { listingSku = "LIST-" + String(nextMigratedListingSku++).padStart(3, "0"); } while (reservedListingSkus.has(listingSku.toLowerCase()));
      reservedListingSkus.add(listingSku.toLowerCase());
    }
    return { ...normalizedListing, productSku: product ? product.sku : listing.productSku || "", listingSku, marketplaces, marketplace: marketplaces.join(", "), discountPlans: normalizedDiscountPlans, activityReports };
  });
  const addTaskArrays = (record) => ({
    ...record,
    taskIds: Array.isArray(record.taskIds) ? record.taskIds : (record.taskId ? [record.taskId] : []),
    taskTitles: Array.isArray(record.taskTitles) ? record.taskTitles : (record.taskTitle ? [record.taskTitle] : []),
    workNote: record.workNote || "",
  });
  const timeSessions = source.timeSessions.map(addTaskArrays);
  const timerSessions = source.timerSessions.map(addTaskArrays);
  const activeShift = source.activeShift ? addTaskArrays(source.activeShift) : null;
  const activeTimer = source.activeTimer ? addTaskArrays(source.activeTimer) : null;
  const reservedOrderSkus = new Set(source.orders.map((order) => String(order.orderSku || "").trim().toLowerCase()).filter(Boolean));
  let nextMigratedOrderSku = 1;
  const orders = source.orders.map((order) => {
    let items = Array.isArray(order.items) ? order.items.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
    if (!items.length && (order.productId || order.productName)) {
      const quantity = Math.max(0, Number(order.quantity) || 1);
      const savedTotal = Number(order.total ?? order.saleTotal ?? order.amount);
      const unitPrice = Number(order.unitPrice ?? order.price ?? (Number.isFinite(savedTotal) ? savedTotal / quantity : 0)) || 0;
      items = [{ productId: order.productId || "", productName: order.productName || "Product", productSku: order.productSku || "", quantity, unitPrice, unitCost: Number(order.unitCost) || 0 }];
    }
    const timeline = Array.isArray(order.timeline) ? order.timeline.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) : [];
    let orderSku = String(order.orderSku || "").trim();
    if (!orderSku) {
      do { orderSku = "ORDER-" + String(nextMigratedOrderSku++).padStart(3, "0"); } while (reservedOrderSkus.has(orderSku.toLowerCase()));
      reservedOrderSkus.add(orderSku.toLowerCase());
    }
    return { ...order, orderSku, items, timeline: timeline.length ? timeline : [{ status: order.status || "Sale recorded", date: order.createdAt || order.date || TODAY }] };
  });
  const customTheme = { ...DEFAULT_CUSTOM_THEME, ...(source.customTheme && typeof source.customTheme === "object" ? source.customTheme : {}) };
  customTheme.mode = ["light", "dark"].includes(customTheme.mode) ? customTheme.mode : DEFAULT_CUSTOM_THEME.mode;
  CUSTOM_THEME_COLOR_KEYS.forEach((key) => { if (!validHexColor(customTheme[key])) customTheme[key] = DEFAULT_CUSTOM_THEME[key]; });
  const migratedThemeName = typeof source.themeName === "string" && source.themeName.endsWith(" · Dark")
    ? source.themeName.replace(" · Dark", " — Dark Mode")
    : source.themeName;
  const savedThemeName = THEME_SPECS.some((spec) => spec[0] === migratedThemeName)
    ? migratedThemeName + " — Light Mode"
    : migratedThemeName;
  const themeName = THEMES.some((theme) => theme.name === savedThemeName) ? savedThemeName : DEFAULT_THEME_NAME;
  const dateFormat = DATE_FORMAT_OPTIONS.includes(source.dateFormat) ? source.dateFormat : DEFAULT_DATE_FORMAT;
  const marketplaceFeeRules = { ...(source.marketplaceFeeRules && typeof source.marketplaceFeeRules === "object" ? source.marketplaceFeeRules : {}) };
  dropdownOptions.marketplaces.forEach((marketplace) => {
    const rule = marketplaceFeeRules[marketplace] && typeof marketplaceFeeRules[marketplace] === "object" ? marketplaceFeeRules[marketplace] : {};
    marketplaceFeeRules[marketplace] = {
      percent: Number.isFinite(Number(rule.percent)) ? Math.max(0, Number(rule.percent)) : 0,
      fixed: Number.isFinite(Number(rule.fixed)) ? Math.max(0, Number(rule.fixed)) : 0,
    };
  });
  const validWidgetIds = DEFAULT_DASHBOARD_WIDGET_ORDER;
  const savedWidgetOrder = Array.isArray(source.dashboardWidgetOrder) ? source.dashboardWidgetOrder : validWidgetIds;
  const dashboardWidgetOrder = Array.from(new Set(savedWidgetOrder.filter((id) => validWidgetIds.includes(id)).concat(validWidgetIds)));
  const hiddenDashboardWidgets = Array.isArray(source.hiddenDashboardWidgets)
    ? Array.from(new Set(source.hiddenDashboardWidgets.filter((id) => validWidgetIds.includes(id))))
    : [];
  const sortModes = source.sortModes && typeof source.sortModes === "object" ? source.sortModes : {};
  return {
    ...withCurrentSkuCounters({ ...EMPTY_DB, ...source, version: Math.max(savedVersion, EMPTY_DB.version), businessStartDate: parseDateInput(source.businessStartDate) || "", onboardingCompleted: typeof incoming.onboardingCompleted === "boolean" ? incoming.onboardingCompleted : savedVersion < 7, buttonSoundsEnabled: typeof incoming.buttonSoundsEnabled === "boolean" ? incoming.buttonSoundsEnabled : false, themeName, dateFormat, customTheme, marketplaceFeeRules, dashboardWidgetOrder, hiddenDashboardWidgets, sortModes, listings, dropdownOptions, timeSessions, timerSessions, activeShift, activeTimer, orders }),
    products: source.products.map((product) => ({ ...product, recipe: Array.isArray(product.recipe) ? product.recipe.filter((part) => part && typeof part === "object" && !Array.isArray(part)) : [] })),
    events: source.events.map((event) => ({ ...event, done: !!event.done })),
    workPlans: source.workPlans.map((plan) => ({ ...plan, done: !!plan.done })),
  };
};
const validateTrackerDatabase = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "The backup must contain one tracker object." };
  if (Number(data.version) > EMPTY_DB.version) return { ok: false, error: "This backup was made by a newer tracker version. Update the app before restoring it." };
  const required = ["components", "products", "listings", "orders", "expenses", "tasks"];
  for (const key of required) if (!Array.isArray(data[key])) return { ok: false, error: `The backup is missing its ${key} records.` };
  const numericFields = {
    components: ["quantity", "lowStock", "cost"], products: ["price", "inventory", "packageWeight"],
    listings: ["price", "packageWeight"], orders: ["fees", "shippingCost", "packageWeight", "refundAmount", "actualPayout"],
    deletedOrders: ["fees", "shippingCost", "packageWeight", "refundAmount", "actualPayout"], incomes: ["amount"], expenses: ["amount"], reviews: ["stars"], purchases: ["quantity", "purchaseCost", "shippingCost"],
    componentTransactions: ["quantity"], productTransactions: ["quantity"],
  };
  const counts = {};
  for (const key of RECORD_COLLECTIONS) {
    if (data[key] == null && !required.includes(key)) continue;
    if (!Array.isArray(data[key])) return { ok: false, error: `The ${key} section must be a list.` };
    const seen = new Set();
    for (let index = 0; index < data[key].length; index += 1) {
      const row = data[key][index];
      if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, error: `The ${key} list has an invalid record at item ${index + 1}.` };
      if (typeof row.id !== "string" || !row.id.trim()) return { ok: false, error: `A record in ${key} is missing its ID.` };
      if (seen.has(row.id)) return { ok: false, error: `The ${key} list contains a duplicate record ID.` };
      seen.add(row.id);
      for (const field of numericFields[key] || []) {
        if (row[field] != null && row[field] !== "" && !Number.isFinite(Number(row[field]))) return { ok: false, error: `A ${key} record has an invalid ${field} value.` };
      }
      if (key === "orders" && row.items != null) {
        if (!Array.isArray(row.items)) return { ok: false, error: "An order's products must be saved as a list." };
        for (const item of row.items) {
          if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, error: "An order contains an invalid product line." };
          for (const field of ["quantity", "unitPrice", "unitCost"]) if (item[field] != null && item[field] !== "" && !Number.isFinite(Number(item[field]))) return { ok: false, error: `An order product has an invalid ${field} value.` };
        }
      }
    }
    counts[key] = data[key].length;
  }
  return { ok: true, counts };
};
const parseLocalTracker = (raw) => {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The saved tracker file is not a tracker record.");
  return normalizeDatabase(parsed);
};
const uid = (prefix) =>
  prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
const asNumber = (value, fallback) => {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return fallback;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};
const normalizeTimeInput = (value) => {
  const text = String(value == null ? "" : value).trim().toLowerCase().replace(/\./g, "");
  const match = text.match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] ? match[3][0] : "";
  if (minute > 59 || (meridiem && (hour < 1 || hour > 12)) || (!meridiem && hour > 23)) return "";
  if (meridiem) hour = (hour % 12) + (meridiem === "p" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
const formatTimeForDisplay = (value) => {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return String(value || "");
  const [hourText, minute] = normalized.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
};
const money = (value, currency) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch (_error) {
    return "$" + (Number(value) || 0).toFixed(2);
  }
};
const dateLabel = (value) => {
  if (!value) return "No date";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDateInput(text);
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? formatDateInput(text) : formatDateInput(localDateKey(d));
};
const businessDurationLabel = (startValue, endValue = TODAY) => {
  const startKey = parseDateInput(startValue); const endKey = parseDateInput(endValue);
  if (!startKey || !endKey) return "";
  const future = startKey > endKey;
  const first = new Date((future ? endKey : startKey) + "T12:00:00");
  const last = new Date((future ? startKey : endKey) + "T12:00:00");
  const startYear = first.getFullYear(); const startMonth = first.getMonth(); const startDay = first.getDate();
  let months = (last.getFullYear() - startYear) * 12 + last.getMonth() - startMonth;
  const shiftedDate = (offset) => {
    const monthIndex = startMonth + offset; const year = startYear + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12; const day = Math.min(startDay, new Date(year, month + 1, 0).getDate());
    return new Date(year, month, day, 12);
  };
  if (shiftedDate(months) > last) months -= 1;
  const years = Math.floor(months / 12); const remainingMonths = months % 12;
  const days = Math.max(0, Math.floor((last.getTime() - shiftedDate(months).getTime()) / 86400000));
  if (years === 0 && remainingMonths === 0 && days === 0) return future ? "Starts today" : "Started today";
  const units = years > 0
    ? [years + " year" + (years === 1 ? "" : "s"), remainingMonths ? remainingMonths + " month" + (remainingMonths === 1 ? "" : "s") : ""].filter(Boolean)
    : remainingMonths > 0
      ? [remainingMonths + " month" + (remainingMonths === 1 ? "" : "s"), days ? days + " day" + (days === 1 ? "" : "s") : ""].filter(Boolean)
      : [days + " day" + (days === 1 ? "" : "s")];
  return future ? "Starts in " + units.join(", ") : units.join(", ") + " ago";
};
const listingAgeText = (listing) => {
  const listedOn = parseDateInput(listing && listing.startDate);
  if (!listedOn) return "Listing date not recorded";
  if (listedOn > TODAY) return "Scheduled to list " + dateLabel(listedOn);
  const start = new Date(listedOn + "T12:00:00");
  const end = new Date(TODAY + "T12:00:00");
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const weeks = Math.floor(days / 7);
  const extraDays = days % 7;
  const elapsed = days + " day" + (days === 1 ? "" : "s") + " (" + weeks + " week" + (weeks === 1 ? "" : "s") + (extraDays ? ", " + extraDays + " day" + (extraDays === 1 ? "" : "s") : "") + ")";
  return "Listed " + dateLabel(listedOn) + " · " + elapsed;
};
const periodDateRange = (period, value) => {
  const selected = parseDateInput(value);
  if (!selected) return null;
  const date = new Date(selected + "T12:00:00");
  if (period === "week") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: localDateKey(start), end: localDateKey(end) };
  }
  if (period === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: localDateKey(start), end: localDateKey(end) };
  }
  if (period === "year") return { start: date.getFullYear() + "-01-01", end: date.getFullYear() + "-12-31" };
  return { start: selected, end: selected };
};
const active = (record) => !record.archived;
const totalOrder = (order) => ((order && order.items) || []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0), 0);
const orderRestockedQuantity = (order) => {
  if (order && order.restockedQuantity != null) return Math.max(0, Number(order.restockedQuantity) || 0);
  return ((order && order.refundHistory) || []).reduce((sum, entry) => sum + Math.max(0, Number(entry.restockQuantity) || 0), 0);
};
const orderMaterialCost = (order) => {
  const items = (order && order.items) || [];
  const restocked = items.length === 1 ? Math.min(Math.max(0, Number(items[0].quantity) || 0), orderRestockedQuantity(order)) : 0;
  return items.reduce((sum, item, index) => {
    const soldQuantity = Math.max(0, Number(item.quantity) || 0);
    const returnedToStock = items.length === 1 && index === 0 ? restocked : 0;
    return sum + Math.max(0, soldQuantity - returnedToStock) * Math.max(0, Number(item.unitCost) || 0);
  }, 0);
};
const netOrderPayout = (order) => {
  if (order && order.actualPayout != null && String(order.actualPayout).trim() !== "") return Math.max(0, Number(order.actualPayout) || 0);
  return Math.max(0, totalOrder(order) - (Number(order && order.fees) || 0) - (Number(order && order.refundAmount) || 0));
};
const SORT_OPTIONS = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Name A–Z", value: "nameAsc" },
  { label: "Name Z–A", value: "nameDesc" },
  { label: "Price low to high", value: "priceAsc" },
  { label: "Price high to low", value: "priceDesc" },
];
const sortableDate = (value) => {
  if (!value) return 0;
  const text = String(value);
  const timestamp = new Date(text);
  if (!Number.isNaN(timestamp.getTime()) && (/T/.test(text) || /Z$/.test(text))) return timestamp.getTime();
  const normalized = parseDateInput(text);
  if (normalized) return new Date(normalized + "T12:00:00").getTime();
  return Number.isNaN(timestamp.getTime()) ? 0 : timestamp.getTime();
};
const CONDITION_OPTIONS = ["Handmade", "New", "Used – like new", "Used – good", "Vintage", "Refurbished", "Other"].map((value) => ({ label: value, value }));
const WEIGHT_UNITS = ["oz", "lb", "g", "kg"].map((value) => ({ label: value, value }));
const sortRecords = (records, mode) => records.slice().sort((a, b) => {
  const aName = String(a.name || a.productName || a.description || a.title || a.customer || a.reviewText || (a.items && a.items[0] && a.items[0].productName) || "").toLowerCase();
  const bName = String(b.name || b.productName || b.description || b.title || b.customer || b.reviewText || (b.items && b.items[0] && b.items[0].productName) || "").toLowerCase();
  const aDate = sortableDate(a.date || a.createdAt || a.startDate || a.dueDate);
  const bDate = sortableDate(b.date || b.createdAt || b.startDate || b.dueDate);
  const aPrice = Number(a.price != null ? a.price : a.amount != null ? a.amount : totalOrder(a)) || 0;
  const bPrice = Number(b.price != null ? b.price : b.amount != null ? b.amount : totalOrder(b)) || 0;
  if (mode === "oldest") return aDate - bDate;
  if (mode === "nameAsc") return aName.localeCompare(bName);
  if (mode === "nameDesc") return bName.localeCompare(aName);
  if (mode === "priceAsc") return aPrice - bPrice;
  if (mode === "priceDesc") return bPrice - aPrice;
  return bDate - aDate;
});
const currentRecipeCost = (product, components) => (product.recipe || []).reduce((sum, part) => {
  const component = components.find((item) => item.id === part.componentId);
  return sum + (Number(part.quantity) || 0) * (Number(component ? component.cost : part.unitCost) || 0);
}, 0);
const formatDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m ${String(remainder).padStart(2, "0")}s`;
};
const formatHours = (milliseconds) => `${((Number(milliseconds) || 0) / 3600000).toFixed(1)} hr`;
const clockTimeLabel = (milliseconds) => {
  const date = new Date(Number(milliseconds) || Date.now());
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const buildTimeAnalytics = (sessions, activeShift, now) => {
  const current = new Date(now);
  const today = localDateKey(current);
  const values = {};
  (sessions || []).forEach((session) => { values[session.date] = (values[session.date] || 0) + (Number(session.durationMs) || 0); });
  if (activeShift && activeShift.date) {
    values[activeShift.date] = (values[activeShift.date] || 0) + Math.max(0, now - activeShift.clockIn - (Number(activeShift.breakMs) || 0) - (activeShift.breakStartedAt ? now - activeShift.breakStartedAt : 0));
  }
  const weekStart = new Date(current.getFullYear(), current.getMonth(), current.getDate() - ((current.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_item, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    const key = localDateKey(date);
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), value: values[key] || 0 };
  });
  const monthPrefix = today.slice(0, 7);
  const monthBuckets = Array.from({ length: 5 }, (_item, index) => ({ label: `W${index + 1}`, value: 0 }));
  Object.keys(values).filter((key) => key.slice(0, 7) === monthPrefix).forEach((key) => {
    const bucket = Math.min(4, Math.floor((Number(key.slice(8, 10)) - 1) / 7));
    monthBuckets[bucket].value += values[key];
  });
  const yearPrefix = today.slice(0, 4);
  const year = Array.from({ length: 12 }, (_item, index) => ({ label: new Date(current.getFullYear(), index, 1).toLocaleDateString(undefined, { month: "short" }), value: 0 }));
  Object.keys(values).filter((key) => key.slice(0, 4) === yearPrefix).forEach((key) => { year[Number(key.slice(5, 7)) - 1].value += values[key]; });
  return { week, month: monthBuckets, year, weekTotal: week.reduce((sum, bar) => sum + bar.value, 0), monthTotal: monthBuckets.reduce((sum, bar) => sum + bar.value, 0), yearTotal: year.reduce((sum, bar) => sum + bar.value, 0) };
};

function createFormDefaults(type, record, defaultLowStock, defaults) {
  const base = {};
  if (type === "component") {
    base.quantity = "0";
    base.lowStock = String(defaultLowStock == null ? 3 : defaultLowStock);
  }
  if (type === "restock") { base.quantity = "1"; base.purchaseCost = ""; base.shippingCost = ""; base.date = TODAY; }
  if (type === "product") {
    const skuRows = [
      ...((defaults && defaults.products) || []),
      ...((defaults && defaults.productSkuReferences) || []),
    ];
    base.sku = "PROD-" + String(firstAvailableSkuNumber(skuRows, "sku", "PROD-")).padStart(3, "0");
    base.price = ""; base.inventory = "0"; base.recipe = []; base.condition = "Handmade"; base.packageWeight = ""; base.packageWeightUnit = "oz";
  }
  if (type === "listing") { base.status = "Draft"; base.price = ""; base.marketplaces = []; base.startDate = ""; base.relistDate = ""; base.condition = "Handmade"; base.packageWeight = ""; base.packageWeightUnit = "oz"; }
  if (type === "order") { base.quantity = "1"; base.extraFees = "0"; base.shippingCost = "0"; base.marketplace = "Direct"; base.date = TODAY; base.packageWeight = ""; base.packageWeightUnit = "oz"; }
  if (type === "order") {
    const line = record && Array.isArray(record.items) ? record.items[0] : null;
    base.productId = line ? line.productId : "";
    base.listingId = record ? record.listingId || (line && line.listingId) || "" : "";
    base.quantity = String(line ? line.quantity : 1);
    base.unitPrice = line ? String(line.unitPrice) : "";
    base.actualFees = record && record.feeSource === "actual" ? String(record.fees || 0) : "";
  }
  if (type === "listing") base.listingSku = (record && (record.listingSku || record.productSku)) || "LIST-" + String((defaults && defaults.nextListingSku) || 1).padStart(3, "0");
  if (type === "order") base.orderSku = (record && record.orderSku) || "ORDER-" + String((defaults && defaults.nextOrderSku) || 1).padStart(3, "0");
  if (type === "review") { base.stars = "5"; base.date = TODAY; }
  if (type === "expense") { base.amount = ""; base.date = TODAY; }
  if (type === "income") { base.amount = ""; base.date = TODAY; }
  if (type === "task") { base.priority = (defaults && defaults.defaultTaskPriority) || "Normal"; base.dueDate = TODAY; }
  if (type === "event") { base.date = TODAY; base.kind = (defaults && defaults.defaultEventType) || "Deadline"; }
  if (type === "workPlan") { base.title = "Work block"; base.date = TODAY; base.startTime = "9:00 AM"; base.endTime = "12:00 PM"; }
  const result = { ...base, ...(record || {}) };
  if (type === "order" && record && !result.listingId && record.items && record.items[0]) result.listingId = record.items[0].listingId || "";
  if (type === "product") result.description = Array.from(new Set([record && record.description, record && record.notes].map((value) => String(value || "").trim()).filter(Boolean))).join("\n\n");
  return result;
}

function calculateTotals(db) {
  const orders = db.orders || [];
  const gross = orders.reduce((sum, order) => sum + totalOrder(order), 0);
  const fees = orders.reduce((sum, order) => sum + (Number(order.fees) || 0), 0);
  const shipping = orders.reduce((sum, order) => sum + (Number(order.shippingCost) || 0), 0);
  const expenses = (db.expenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const refunds = orders.reduce((sum, order) => sum + (Number(order.refundAmount) || 0), 0);
  const income = (db.incomes || []).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const payouts = orders.reduce((sum, order) => sum + netOrderPayout(order), 0);
  const materialCosts = orders.reduce((sum, order) => sum + orderMaterialCost(order), 0);
  const netAfterFees = gross - refunds - fees;
  const cashAfterExpenses = payouts + income - shipping - expenses;
  const estimatedProfit = netAfterFees - shipping - expenses - materialCosts;
  return { gross, fees, shipping, expenses, refunds, income, payouts, netAfterFees, materialCosts, cashAfterExpenses, estimatedProfit, orders: orders.length };
}

const FIELD_EXPLANATIONS = {
  name: "The name you will recognize in lists and search. For a component, use the supply name; for a product, use the name buyers see. Example: ‘Gold jump rings’ or ‘Pearl drop earrings.’",
  title: "A short, searchable name for a task, event, idea, or planned work block. Start with the action or subject. Example: ‘Photograph the spring collection.’",
  description: "A plain-language description of the cost or item being recorded. Example: ‘Monthly shop website subscription’ is clearer than ‘Website.’",
  category: "A label for grouping similar records in lists and summaries. Pick the closest existing category; add a new one in Settings if none fit. Example: choose ‘Packaging’ for mailers and tissue paper.",
  quantity: "The number of units in the unit shown nearby. A component quantity is stock on hand; a restock quantity is what you bought; a sale quantity is what the buyer purchased. Example: 24 pieces on hand or 2 items sold.",
  adjustmentNote: "The reason for a manual stock correction. This explanation appears with inventory history. Example: ‘Counted the drawer and found 2 extra clasps.’",
  lowStock: "The stock level at which this component should appear in the low-stock list. The alert turns on when the quantity is this number or lower. Example: enter 5 to be reminded at 5 packs or fewer.",
  unit: "The unit used every time this component quantity is counted. Keep it consistent so recipe amounts make sense. Example: count beads as pieces and fabric as yards.",
  cost: "Your purchase cost for one component unit, used to estimate the material cost of product recipes. Example: if a 100-piece pack costs $4, enter $0.04 per piece.",
  purchaseCost: "The total price paid for the quantity in this restock, before shipping. The app can use it to update the component’s average unit cost. Example: enter $12 for a restock of 3 packs that cost $4 each; leave blank if you do not know the total.",
  supplier: "The seller or company you purchased this supply from. Use the same spelling as the Supplier directory so the records are easy to match. Example: ‘Northside Bead Co.’",
  price: "The amount a buyer pays for one finished item, before any order-level shipping or fees. Example: enter 28.00 if one necklace is listed for $28.",
  unitPrice: "The amount charged for one item in this sale. Quantity is multiplied by this amount to calculate the item subtotal. Example: 2 candles at $18 each gives a $36 subtotal. Leave blank to use the product’s saved price.",
  inventory: "The number of completed units ready to sell now. This is finished stock, not the amount of raw materials. Example: enter 4 if four pairs are made and available.",
  colors: "Choose one or more colors from your saved choices. Add, rename, or remove choices in Settings → Dropdown choices. Older saved color text stays visible when you edit a record.",
  materials: "Choose the materials used in or included with the item. Manage the choices in Settings → Dropdown choices. Product recipe quantities are tracked separately.",
  sizes: "Choose one or more sizes for this item. Add your own size labels in Settings → Dropdown choices.",
  gender: "Optional audience or gender label. Edit the available choices in Settings → Dropdown choices, or leave this blank when it does not apply.",
  condition: "The item type or condition shown in your records, such as handmade, new, vintage, or used. Choose the option that accurately describes this item.",
  packageWeight: "The weight of the complete packed parcel, including the product, box or mailer, and packing material. Use the same unit selected below. Example: a 3 oz item plus packaging might ship at 5 oz.",
  packageWeightUnit: "The unit used for the complete parcel weight above. Choose the same unit your shipping service uses; 8 ounces equals 0.5 pounds.",
  listingSku: "A unique code for this marketplace listing, kept separate from the finished product’s SKU. Use it when one product has several channel pages. Example: product SKU PROD-004 can have listing SKUs LIST-012 and LIST-013.",
  orderSku: "A unique reference for this sale in your tracker. The app suggests the next ORDER number; keep it unless you need to match another system. Example: ORDER-014.",
  trackingNumber: "The tracking code assigned by the shipping carrier after you buy a label. It lets you identify the parcel on the carrier’s site. Example: copy the USPS tracking number exactly as printed on the label.",
  trackingCarrier: "The company transporting the parcel. Example: USPS, UPS, FedEx, or your local delivery service.",
  trackingUrl: "The web address where the buyer or you can follow this specific shipment. Paste the carrier’s tracking-page link, not the shop listing link.",
  productSku: "The internal stock code for a finished product. Use it to distinguish similar products and match listings or sales to stock. Example: PROD-004.",
  productId: "Choose the finished product connected to this listing, sale, or review. Selecting a product may fill in saved details such as its price or package weight.",
  componentId: "Choose the supply whose inventory is increasing in this restock. Example: select ‘Gold jump rings’ before recording a new pack of 100.",
  marketplaces: "Select every sales channel where this particular listing is published or planned. The selection is saved with the listing; it does not publish the item to those services. Example: select Etsy and Shopify if you maintain a page on both.",
  marketplace: "Choose where this sale took place. The tracker uses that channel’s fee settings to estimate fees; selecting it does not import the order. Example: choose Etsy for a sale placed through your Etsy shop.",
  status: "The current stage of a listing or order. Choose the stage that matches what has actually happened so the list reflects what is live or needs action. Example: use ‘Shipped’ only after the parcel has been handed to the carrier.",
  startDate: "For a listing, the day it is first available to buyers. Type the date in your chosen format or select it from the calendar. This records a date; it does not publish the listing.",
  relistDate: "The next day you plan to renew or repost a listing. The tracker can show the date as overdue; it does not renew the listing for you. Example: enter the renewal date shown in your marketplace account.",
  dueDate: "The date you want an open task finished. An unfinished task is marked overdue after this date. Example: set 12/05/2026 for ‘Pack the market order.’",
  date: "The calendar day the purchase, sale, review, event, or work block happened or is planned for. Type the date in your chosen format or select it from the calendar.",
  extraFees: "An additional per-sale estimate for charges not included in the marketplace percentage or fixed order fee. This is added to the estimate for this order only. Example: enter 1.25 for an extra transaction charge you expect on this sale.",
  actualFees: "The total fee amount actually charged for this order, taken from the marketplace’s order details or statement. Entering it replaces the estimated marketplace and extra fees for this sale. Example: if the statement shows $2.14 in fees, enter 2.14; leave blank while you still want the estimate.",
  currency: "Sets the currency symbol and format used to display money. It does not convert existing numbers or fetch exchange rates. If you switch from USD to CAD, a saved 20.00 stays 20.00; only how it is labeled changes.",
  shippingCost: "The postage or delivery charge paid by your business for this parcel or purchase. Enter the amount you paid, not the amount the buyer paid you. Example: enter 4.85 for a label that cost $4.85.",
  stars: "The rating the buyer gave, from one to five stars. Choose the exact rating shown in the review. Example: select 4 stars for a review marked ★★★★☆.",
  reviewText: "The buyer’s review in their own words. Copy it accurately so your saved feedback matches what the buyer posted. Do not include private information that was not part of the review.",
  publicResponse: "The reply you posted publicly to the buyer’s review. Save the response as it appeared; leave this blank if you did not reply.",
  customer: "The buyer’s name or a reference that helps you identify the order. It is optional; use an order number instead if you prefer not to save a person’s name.",
  contact: "A way to contact the supplier, such as a business email address or phone number. Example: ‘orders@example.com’ or ‘(555) 010-1234.’",
  website: "The supplier’s or business’s web address, including https:// when available. Example: https://example.com. Do not paste an account password or private login link.",
  notes: "Context that belongs with this record and helps you act on it later. Use concrete details rather than a second title. Example: ‘Stored in the blue bin; reorder when fewer than 2 packs remain.’",
  url: "Paste the public web link for the live marketplace listing, one link per line if this product has several listings. Example: add the Etsy listing URL here; use the tracking URL field for parcel tracking instead.",
  amount: "The total amount paid for this business expense, in the currency selected in Settings. Example: enter 18.50 for a receipt totaling $18.50.",
  priority: "How urgently you want to handle this task. Use Urgent for work with an immediate consequence, High for the next important item, and Normal for routine work. Example: prioritize a parcel due today above a product photo task.",
  kind: "The type of calendar event, used to distinguish deadlines, launches, markets, and other dates. Example: choose ‘Market or event’ for a craft fair.",
  startTime: "The planned start of the work block. Type a time with AM or PM, such as 9:00 AM, or choose a time and scroll to the exact minute.",
  endTime: "The planned finish of the work block. Type AM or PM or choose a time and scroll to the minute. The finish must be later than the start.",
  percent: "The percentage of the item subtotal to include in a marketplace fee estimate. Example: enter 6.5 for an estimated fee of 6.5% on a $40 subtotal ($2.60), before any fixed fee. Check the marketplace’s current fee schedule; this is your estimate, not an imported rate.",
  fixed: "A fixed fee is the same dollar amount charged once for each order, regardless of how many items are in it. Example: if a channel charges $0.30 per order and a buyer purchases three items, enter 0.30; the estimate adds it once, plus the percentage fee. Enter 0 if there is no fixed charge, and confirm the amount against the channel’s current fee schedule.",
  orderId: "Optionally link this review to the sale it came from. This makes it easier to find the order later; it does not import or post a review. Example: choose ORDER-014 if that is the sale the buyer reviewed.",
  paymentMethod: "How the buyer paid, as shown in your order details. Example: choose the marketplace checkout or card option you use; this is for your records and does not process a payment.",
  shippingMethod: "How the order is being delivered. Example: choose USPS Ground Advantage or Local pickup to remember the fulfillment method; this does not buy postage or notify the carrier.",
  endDate: "The last calendar day the promotion should be active. Leave it blank for a promotion with no planned end date. The tracker records the dates but does not change the marketplace price for you.",
  buttonSoundsEnabled: "Controls brief button feedback. In Snack's web preview, tapping a button plays a short, quiet tone. On Android, it uses a brief vibration. The built-in React Native vibration lasts about 400 milliseconds on iPhone, so this version leaves iPhone taps silent instead of making every tap buzz. This is not a notification or music setting.",
  onboardingCompleted: "Internal setup status for the welcome flow.",
};

const FIELD_LABEL_EXPLANATIONS = {
  "Sort by": "Choose how this page orders its records. For example, choose newest to see recently added items first or name to scan alphabetically.",
  "Choose a component": "Select the supply used by this production run. The tracker subtracts the recipe quantity from this component’s stock when you record production.",
  "Work date": "The calendar day this shift or work session happened. Use the date on the timesheet you are correcting, or select it from the calendar.",
  "Date": "The calendar date for this activity or other record. Type the date in your chosen format or select it from the calendar.",
  "Time (24-hour HH:MM)": "The time associated with this activity entry, using 24-hour HH:MM format. Example: 14:30 is 2:30 PM.",
  "Clock-in time (24-hour HH:MM)": "The time you began work, in 24-hour HH:MM format. Example: 09:00 is 9 AM; 14:30 is 2:30 PM.",
  "Clock-out time (24-hour HH:MM)": "The time you stopped work, in 24-hour HH:MM format. It must be later than clock-in. Example: 17:00 is 5 PM.",
  "Break minutes": "The total unpaid or non-working break time during this shift, in minutes. Example: enter 30 for a half-hour break; enter 0 if you took none.",
  "Tasks worked on (choose all that apply)": "Select every saved task you worked on during this shift. This links your time record to those tasks; it does not mark them done.",
  "Tasks for this shift (choose all that apply)": "Select the saved tasks you are working on during the active shift. You can choose several; selecting them does not complete them.",
  "Tasks for this timer (choose all that apply)": "Select the saved tasks this focus timer should be associated with. This helps you review where time went; it does not complete the tasks.",
  "Work note": "A brief explanation of what you worked on during this shift. Example: ‘Packed orders 104–108 and counted pendant stock.’",
  "Discount (%)": "The percentage reduction you plan to offer from the listing’s normal price. Example: 10 means 10% off; a $30 listing would be advertised at $27 if you apply the promotion on the marketplace. This tracker only schedules and records the plan; it does not change the marketplace price.",
  "Start date": "The first date the planned discount should run. The tracker adds this date to its promotion calendar but does not activate the sale on the marketplace.",
  "End date (optional)": "The last date the discount should run. Leave blank if you have not chosen an end date. The tracker records the date; you still need to set or end the promotion on the marketplace.",
  "Notes (optional)": "A reminder that explains this promotion, such as its campaign name, reason, or where you will activate it. Example: ‘Holiday weekend; set the same 10% discount in Etsy and Shopify.’",
  "Date completed": "The date the order refund or return was processed. Use the date shown in your payment or marketplace record.",
  "Activity": "Choose the kind of listing activity you are recording. Example: choose Views for page visits, Favorites for saves, or Watches for watchers. These numbers are entered manually, not imported.",
  Count: "Enter the count for the selected activity and date. You can record fractional values when they are useful for your tracking.",
  "Note (optional)": "Record where this activity number came from or what changed. Example: ‘Copied from Etsy stats at the end of the day.’",
  Product: "Choose the finished product you are making. The tracker uses its saved recipe to calculate material use and adds the completed quantity to inventory.",
  "Quantity to make": "The number of finished units to add in this production run. Recipe material use is multiplied by this number. Example: making 3 bracelets uses three times each recipe amount.",
  "Sale notes": "A private reminder attached to the sale. Example: ‘Buyer requested gift wrap.’ Do not put payment details or passwords here.",
  "Fulfillment status": "Choose the order’s current shipping stage. Change it when the real-world step occurs; for example, select Shipped after handing the package to the carrier.",
  "Returned units safe to restock": "How many returned units are still unused, complete, and safe to add back to sellable product inventory. This cannot exceed the quantity returned. Example: if 2 items came back and one is scratched, enter 1; enter 0 if neither can be sold again.",
  "Return note (optional)": "Add the reason for the refund or return and anything useful about item condition. Example: ‘One clasp arrived broken; buyer returned the unused pair.’ Keep this note private to the tracker.",
  "What else are you working on?": "A private note for the active shift, such as the main work area or interruption. Example: ‘Cutting fabric for the Saturday market.’",
  "What do you plan to work on?": "A short plan for this shift. Example: ‘Assemble 8 necklaces, then pack 3 orders.’ This is a note, not a scheduled task.",
  "Timer name": "A short label for this focus session so you recognize it in your time history. Example: ‘Pack today’s orders’ or ‘Photograph new stock.’",
  "What are you focusing on?": "A private note about the work covered by this timer. Example: ‘Edit the product photos and update listing images.’",
  "Business name": "The shop or business name displayed in the welcome screen and profile. Example: ‘Northside Studio.’ This is a label only; it does not create a public business page.",
  "Default low-stock level": "The starting alert threshold used when you create a component. A component is flagged when its quantity is at or below this number. Example: enter 3 if you want new supplies to alert at three units remaining.",
  "Monthly sales goal (0 disables the goal bar)": "A target for gross recorded sales during the current calendar month, in your selected currency. Example: enter 1500 to compare sales with a $1,500 target; enter 0 to hide the goal bar. This is not a profit target.",
  "Default task priority": "The priority automatically selected for new tasks. You can still change it on each task. Example: use Normal for routine shop work and raise urgent deadlines individually.",
  "Default calendar event type": "The event type preselected for new calendar records. Choose the type you create most often; you can change it on each event.",
  "Custom appearance": "Choose whether the custom palette uses a light or dark base. This changes background and text defaults while preserving your accent color.",
  "Fee percentage": "The percentage of each order’s item subtotal charged by this channel, if you want the tracker to estimate it. Example: 6.5 means 6.5%; on a $40 item subtotal that part of the estimate is $2.60. Check the channel’s current fee schedule and enter your own rate.",
  "Fixed fee per order": FIELD_EXPLANATIONS.fixed,
};

const explainField = (field) => {
  const label = String(field.label || "");
  if (label.startsWith("Refund amount")) return "Enter the money you are returning to the buyer, up to the remaining amount shown in the label. Partial refunds are allowed. Example: if $28.00 remains and you refund $8.00, enter 8.00. This records the refund; it does not send money to the buyer.";
  if (label.startsWith("Units returned")) return "Enter how many of the sold units the buyer physically returned, up to the limit shown. Enter 0 if the buyer received a refund but kept the item. Example: for an order of 3 items with 1 returned, enter 1.";
  return field.explanation || FIELD_EXPLANATIONS[field.key] || FIELD_LABEL_EXPLANATIONS[label] || (
  field.options
    ? `Choose ${String(field.label || "an option").toLowerCase()} from the available choices. ${field.multiple ? "Select every choice that applies." : "Choose the one that best matches this record."} Example: select the option that matches what actually happened.`
    : field.date
      ? "Enter the calendar date for " + String(field.label || "this record").toLowerCase() + " using your chosen format, or select it from the calendar."
      : field.number
        ? `Enter the numeric ${String(field.label || "amount").toLowerCase()}. Use 0 when there is none; do not include a currency symbol.`
        : field.multiline
          ? `Add the supporting details for ${String(field.label || "this record").toLowerCase()}. Example: include a specific reminder, reference, or context you will need later.`
          : `Enter the ${String(field.label || "detail").toLowerCase()} you want attached to this record. Example: ${field.placeholder || "use the exact name or reference shown in your source record."}`
  );
};

const FORM_INTRO = {
  component: "Track a supply or part, how much you have, and when you want a low-stock reminder.",
  restock: "Record a purchase to add stock and keep the material cost history up to date.",
  product: "Describe a finished item, its price, ready-to-sell quantity, and optional materials recipe.",
  listing: "Create a marketplace page for a product. It receives its own editable LIST SKU, separate from the product code.",
  order: "Record a buyer's purchase. Inventory and the marketplace fee estimate update when you save.",
  review: "Save the buyer's exact words and the star rating they gave your shop.",
  expense: "Save a business cost so it appears in your finance totals.",
  task: "Write down a next step, set a due date, and check it off when it is done.",
  event: "Add an important date such as a market, launch, or payment deadline.",
  idea: "Capture a product idea and its inspiration so you can return to it later.",
  supplier: "Keep a supplier's contact details and buying notes together.",
  workPlan: "Reserve a date and time for a work block, then track it against your timesheet.",
};

const FIELD_GROUPS = [
  { title: "Start here", description: "Name the record and connect it to the right item.", keys: ["name", "title", "description", "productId", "componentId", "orderId", "customer", "contact", "website"] },
  { title: "Price, stock, and shipping", description: "Amounts help the tracker estimate stock, costs, and shipping.", keys: ["quantity", "inventory", "lowStock", "unit", "cost", "purchaseCost", "shippingCost", "price", "unitPrice", "extraFees", "packageWeight", "packageWeightUnit", "amount", "stars"] },
  { title: "Item and sale details", description: "Add the details you will want to see while working or selling.", keys: ["category", "expenseType", "colors", "materials", "sizes", "gender", "condition", "listingSku", "orderSku", "trackingNumber", "trackingCarrier", "marketplaces", "marketplace", "status", "paymentMethod", "shippingMethod", "priority", "kind", "percent", "startTime", "endTime", "date", "dueDate", "startDate", "relistDate", "endDate"] },
  { title: "Notes and links", description: "Keep the useful context close to this record.", keys: ["notes", "reviewText", "publicResponse", "url", "trackingUrl"] },
];
const groupFields = (fields) => {
  const assigned = new Set();
  const groups = FIELD_GROUPS.map((group) => ({ ...group, fields: fields.filter((field) => group.keys.includes(field.key) && !assigned.has(field.key) && assigned.add(field.key)) })).filter((group) => group.fields.length);
  const remaining = fields.filter((field) => !assigned.has(field.key));
  if (remaining.length) groups.push({ title: "More details", description: "Additional information for this record.", fields: remaining });
  return groups;
};

function TimeInput({ value, onChange, placeholder }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState("AM");
  const openPicker = () => {
    const normalized = normalizeTimeInput(value) || "09:00";
    const [hourText, minuteText] = normalized.split(":");
    const hour24 = Number(hourText);
    setHour(hour24 % 12 || 12);
    setMinute(Number(minuteText));
    setPeriod(hour24 >= 12 ? "PM" : "AM");
    setPickerOpen(true);
  };
  const chooseTime = () => {
    const normalized = normalizeTimeInput(`${hour}:${String(minute).padStart(2, "0")} ${period}`);
    onChange(normalized);
    setPickerOpen(false);
  };
  return <>
    <View style={styles.timeInputRow}>
      <TextInput value={String(value == null ? "" : value)} onChangeText={onChange} placeholder={placeholder || "9:30 AM or 21:30"} placeholderTextColor={COLORS.placeholder} keyboardType="default" autoCapitalize="characters" style={[styles.input, styles.timeTextInput]} />
      <Pressable style={styles.timeChooseButton} onPress={openPicker} accessibilityRole="button" accessibilityLabel="Choose a time by scrolling"><Text style={styles.timeChooseButtonText}>Choose</Text></Pressable>
    </View>
    <Text style={styles.fieldHint}>Type AM or PM, or scroll to choose an hour and minute.</Text>
    <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
      <View style={styles.chooserBackdrop}>
        <View style={styles.timePickerCard}>
          <Text style={styles.cardTitle}>Choose a time</Text>
          <View style={styles.timeWheelRow}>
            <View style={styles.timeWheelColumn}><Text style={styles.timeWheelLabel}>Hour</Text><ScrollView style={styles.timeWheelScroll} showsVerticalScrollIndicator>{Array.from({ length: 12 }, (_item, index) => index + 1).map((item) => <Pressable key={item} onPress={() => setHour(item)} style={[styles.timeWheelItem, hour === item && styles.timeWheelItemSelected]}><Text style={[styles.timeWheelText, hour === item && styles.timeWheelTextSelected]}>{item}</Text></Pressable>)}</ScrollView></View>
            <View style={styles.timeWheelColumn}><Text style={styles.timeWheelLabel}>Minute</Text><ScrollView style={styles.timeWheelScroll} showsVerticalScrollIndicator>{Array.from({ length: 60 }, (_item, index) => index).map((item) => <Pressable key={item} onPress={() => setMinute(item)} style={[styles.timeWheelItem, minute === item && styles.timeWheelItemSelected]}><Text style={[styles.timeWheelText, minute === item && styles.timeWheelTextSelected]}>{String(item).padStart(2, "0")}</Text></Pressable>)}</ScrollView></View>
            <View style={styles.timeWheelColumn}><Text style={styles.timeWheelLabel}>AM / PM</Text><View style={styles.timePeriodOptions}>{["AM", "PM"].map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={[styles.timeWheelItem, period === item && styles.timeWheelItemSelected]}><Text style={[styles.timeWheelText, period === item && styles.timeWheelTextSelected]}>{item}</Text></Pressable>)}</View></View>
          </View>
          <Text style={styles.timePickerPreview}>{hour}:{String(minute).padStart(2, "0")} {period}</Text>
          <View style={styles.actionRow}><Action label="Cancel" quiet onPress={() => setPickerOpen(false)} /><Action label="Use this time" onPress={chooseTime} /></View>
        </View>
      </View>
    </Modal>
  </>;
}

function DecimalSettingField({ label, value, onSave, hint }) {
  const [draft, setDraft] = useState(String(value == null ? 0 : value));
  useEffect(() => setDraft(String(value == null ? 0 : value)), [value]);
  const commit = () => {
    const parsed = asNumber(draft, NaN);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSave(parsed);
      setDraft(String(parsed));
    } else {
      setDraft(String(value == null ? 0 : value));
    }
  };
  return <Field field={{ label, number: true, placeholder: "0.0", hint, onBlur: commit }} value={draft} onChange={setDraft} />;
}

function Field({ field, value, onChange, onManageOptions }) {
  const [expanded, setExpanded] = useState(false);
  const [optionSearch, setOptionSearch] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [optionEdit, setOptionEdit] = useState(null);
  const [optionDraft, setOptionDraft] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const optionChoices = field.options || [];
  const openDatePicker = () => {
    const normalized = parseDateInput(value);
    const start = normalized ? new Date(normalized + "T12:00:00") : new Date();
    setDatePickerMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setDatePickerOpen(true);
  };
  const firstCalendarDay = new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth(), 1);
  const calendarStart = new Date(firstCalendarDay.getFullYear(), firstCalendarDay.getMonth(), 1 - firstCalendarDay.getDay());
  const datePickerDays = Array.from({ length: 42 }, (_item, index) => new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index));
  const selectedDateKey = parseDateInput(value);
  const startOptionEdit = (action, index, option) => {
    setOptionDraft(action === "edit" && option ? option.label : "");
    setOptionEdit({ action, index, original: option ? option.value : value });
  };
  const commitOptionEdit = () => {
    if (!optionEdit || !onManageOptions) return;
    if (onManageOptions("save", field.optionSet, optionEdit.index, value, onChange, optionDraft, optionEdit.original)) setOptionEdit(null);
  };
  const selectedValues = field.multiple
    ? (Array.isArray(value) ? value : String(value || "").split(/[,\n]+/).map((item) => item.trim()).filter(Boolean))
    : [];
  const availableOptions = field.multiple
    ? optionChoices.concat(selectedValues.filter((selected) => !optionChoices.some((option) => option.value === selected)).map((selected) => ({ label: selected, value: selected, currentOnly: true })))
    : optionChoices;
  const selectedLabels = field.multiple
    ? availableOptions.filter((option) => selectedValues.includes(option.value)).map((option) => option.label)
    : [];
  const visibleOptions = field.searchable && optionSearch.trim()
    ? availableOptions.filter((option) => String(option.label).toLowerCase().includes(optionSearch.trim().toLowerCase()))
    : availableOptions;
  const toggleOption = (option) => {
    if (!field.multiple) {
      onChange(option.value);
      setExpanded(false);
      setOptionSearch("");
      return;
    }
    const selected = selectedValues;
    onChange(selected.includes(option.value) ? selected.filter((item) => item !== option.value) : selected.concat([option.value]));
  };
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldLabelRow}><Text style={styles.fieldLabel}>{field.label}{field.required ? " *" : ""}</Text><Pressable accessibilityRole="button" accessibilityLabel={"Help for " + field.label} hitSlop={7} onPress={() => setShowExplanation(!showExplanation)}><Text style={styles.fieldHelpToggle}>{showExplanation ? "×" : "?"}</Text></Pressable></View>
      {showExplanation ? <Text style={styles.fieldExplanation}>{explainField(field)}{field.hint ? " " + field.hint : ""}</Text> : null}
      {field.options ? (
        <View>
          <Pressable style={styles.selectBox} onPress={() => setExpanded(!expanded)}>
            <Text style={[styles.inputText, !(field.multiple ? selectedLabels.length : value) && styles.placeholder]}>
              {field.multiple ? (selectedLabels.join(", ") || field.placeholder || "Choose one or more") : ((field.options.find((option) => option.value === value) || {}).label || field.placeholder || "Choose one")}
            </Text>
            <Text style={styles.selectChevron}>{expanded ? "⌃" : "⌄"}</Text>
          </Pressable>
          {expanded && (
            <View style={styles.optionList}>
              {field.searchable ? <TextInput value={optionSearch} onChangeText={setOptionSearch} placeholder={field.searchPlaceholder || "Search choices"} placeholderTextColor={COLORS.placeholder} style={styles.input} returnKeyType="search" /> : null}
              {visibleOptions.map((option) => {
                const index = optionChoices.findIndex((item) => item.value === option.value);
                return field.optionSet && onManageOptions && !option.currentOnly ? (
                <View key={String(option.value)} style={styles.inlineOptionRow}>
                  <Pressable style={styles.inlineOptionSelect} onPress={() => toggleOption(option)}><Text style={styles.optionText}>{field.multiple ? (Array.isArray(value) && value.includes(option.value) ? "✓  " : "○  ") : ""}{option.label}</Text></Pressable>
                  <Pressable hitSlop={8} onPress={() => startOptionEdit("edit", index, option)}><Text style={styles.inlineManageText}>Edit</Text></Pressable>
                  <Pressable onPress={() => onManageOptions("delete", field.optionSet, index, value, onChange)}><Text style={styles.deleteOptionText}>×</Text></Pressable>
                </View>
              ) : (
                <Pressable key={String(option.value)} style={styles.optionItem} onPress={() => toggleOption(option)}>
                  <Text style={styles.optionText}>{option.label}</Text>
                </Pressable>
              );
              })}
              {field.searchable && !visibleOptions.length ? <Text style={styles.fieldHint}>No matches. Try another search.</Text> : null}
              {field.allowBlank && (
                <Pressable style={styles.optionItem} onPress={() => { onChange(""); setExpanded(false); }}>
                  <Text style={styles.optionText}>None</Text>
                </Pressable>
              )}
              {optionEdit ? <View style={styles.inlineEditor}>
                <TextInput value={optionDraft} onChangeText={setOptionDraft} autoFocus placeholder="Option name" placeholderTextColor={COLORS.placeholder} style={styles.input} returnKeyType="done" onSubmitEditing={commitOptionEdit} />
                <View style={styles.actionRow}><Action label="Cancel" quiet onPress={() => setOptionEdit(null)} /><Action label="Save option" onPress={commitOptionEdit} /></View>
              </View> : field.optionSet && onManageOptions ? <Pressable style={styles.inlineAddOption} onPress={() => startOptionEdit("add", null, null)}><Text style={styles.actionText}>＋ Add option</Text></Pressable> : null}
            </View>
          )}
        </View>
      ) : field.date ? (
        <View>
          <View style={styles.dateInputRow}>
            <TextInput
              value={formatDateInput(value)}
              onChangeText={onChange}
              placeholder={field.placeholder || CURRENT_DATE_FORMAT + " (or YYYY-MM-DD)"}
              placeholderTextColor={COLORS.placeholder}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.dateTextInput]}
              selectTextOnFocus={field.selectTextOnFocus}
            />
            <Pressable style={styles.dateCalendarButton} onPress={openDatePicker} accessibilityRole="button" accessibilityLabel={"Choose " + field.label + " from calendar"}>
              <AppIcon name="calendar" size={18} color={COLORS.wine} />
            </Pressable>
          </View>
          <Text style={styles.fieldHint}>Type a date or choose one from the calendar. Your date format is set in Settings.</Text>
          <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
            <View style={styles.chooserBackdrop}>
              <View style={styles.datePickerCard}>
                <View style={styles.monthHeader}>
                  <Pressable style={styles.monthArrow} onPress={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1, 1))}><Text style={styles.monthArrowText}>‹</Text></Pressable>
                  <Text style={styles.monthTitle}>{datePickerMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
                  <Pressable style={styles.monthArrow} onPress={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1, 1))}><Text style={styles.monthArrowText}>›</Text></Pressable>
                </View>
                <View style={styles.calendarWeek}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
                <View style={styles.datePickerGrid}>
                  {datePickerDays.map((day) => {
                    const key = localDateKey(day);
                    const inMonth = day.getMonth() === datePickerMonth.getMonth();
                    return <Pressable key={key} onPress={() => { onChange(key); setDatePickerOpen(false); }} style={[styles.calendarCell, !inMonth && styles.datePickerOutside, key === selectedDateKey && styles.calendarCellSelected]}>
                      <Text style={[styles.calendarDay, !inMonth && styles.calendarDayOutside, key === localDateKey(new Date()) && styles.calendarDayToday, key === selectedDateKey && styles.calendarDayPicked]}>{day.getDate()}</Text>
                    </Pressable>;
                  })}
                </View>
                <View style={styles.actionRow}>
                  <Action label="Clear date" quiet onPress={() => { onChange(""); setDatePickerOpen(false); }} />
                  <Action label="Today" onPress={() => { onChange(localDateKey(new Date())); setDatePickerOpen(false); }} />
                  <Action label="Close" quiet onPress={() => setDatePickerOpen(false)} />
                </View>
              </View>
            </View>
          </Modal>
        </View>
      ) : field.time ? (
        <TimeInput value={value} onChange={onChange} placeholder={field.placeholder} />
      ) : (
        <TextInput
          value={String(value == null ? "" : value)}
          onChangeText={onChange}
          placeholder={field.placeholder || ""}
          placeholderTextColor={COLORS.placeholder}
          keyboardType={field.number ? "numbers-and-punctuation" : "default"}
          autoCapitalize={field.multiline ? "sentences" : field.autoCapitalize || "sentences"}
          multiline={!!field.multiline}
          style={[styles.input, field.multiline && styles.multilineInput]}
          selectTextOnFocus={field.selectTextOnFocus}
          onBlur={field.onBlur}
        />
      )}
      {field.hint ? <Text style={styles.fieldHint}>{field.hint}</Text> : null}
    </View>
  );
}

function SortControl({ value, onChange }) {
  return <Field field={{ label: "Sort by", options: SORT_OPTIONS }} value={value || "newest"} onChange={onChange} />;
}

function ChoiceChips({ label, options, value, onChange }) {
  const normalized = options.map((option) => typeof option === "string" ? { label: option, value: option } : option);
  return <View style={{ marginVertical: 8 }}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 5 }}>
      {normalized.map((option) => {
        const selected = value === option.value;
        return <Pressable key={String(option.value)} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: selected ? COLORS.wine : COLORS.line, backgroundColor: selected ? COLORS.soft : COLORS.card, borderRadius: 18 }}>
          <Text style={{ color: selected ? COLORS.wine : COLORS.ink, fontSize: 12, fontWeight: selected ? "700" : "500" }}>{option.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

function ThemePreview({ theme }) {
  if (!theme) return null;
  const swatches = [
    { label: "Page", color: theme.colors.paper }, { label: "Card", color: theme.colors.card },
    { label: "Soft", color: theme.colors.soft }, { label: "Alt row", color: theme.colors.softAlt },
    { label: "Text", color: theme.colors.ink }, { label: "Muted", color: theme.colors.muted },
    { label: "Accent", color: theme.colors.wine }, { label: "Ripple", color: theme.colors.ripple },
    { label: "Border", color: theme.colors.line }, { label: "Subtle line", color: theme.colors.softLine },
  ];
  return <View style={styles.themePreview}>
    <View style={styles.cardTop}>
      <View style={styles.flex}><Text style={styles.recordTitle}>{theme.name.replace(/ — (Dark|Light) Mode$/, "")}</Text><Text style={styles.recordMeta}>Colors apply throughout the app</Text></View>
      <Pill text={theme.mode === "dark" ? "Dark Mode" : "Light Mode"} tone={theme.mode === "dark" ? "neutral" : "green"} />
    </View>
    <View style={styles.themeSwatches}>{swatches.map((swatch) => <View key={swatch.label} style={styles.themeSwatchWrap}>
      <View style={[styles.themeSwatch, { backgroundColor: swatch.color, borderColor: theme.colors.line }]} />
      <Text style={styles.themeSwatchLabel}>{swatch.label}</Text>
    </View>)}</View>
    <View style={{ marginTop: 11, padding: 10, borderRadius: 12, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.line }}>
      <Text style={{ color: theme.colors.muted, fontSize: 9, fontWeight: "700" }}>PAGE PREVIEW</Text>
      <View style={{ marginTop: 7, padding: 10, borderRadius: 9, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.line }}>
        <Text style={{ color: theme.colors.ink, fontSize: 12, fontWeight: "700" }}>Card text</Text>
        <Text style={{ color: theme.colors.muted, fontSize: 10, marginTop: 3 }}>Secondary information</Text>
      </View>
      <View style={{ alignSelf: "flex-start", marginTop: 7, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: theme.colors.wine }}>
        <Text style={{ color: theme.colors.onAccent, fontSize: 10, fontWeight: "700" }}>Primary button</Text>
      </View>
    </View>
  </View>;
}

function ThemeChooserModal({ visible, currentName, customTheme, onClose, onSelect }) {
  const themeRows = THEMES.map((theme) => theme.name === CUSTOM_THEME_NAME
    ? { ...theme, mode: (customTheme || DEFAULT_CUSTOM_THEME).mode || "dark", colors: makeCustomThemeColors(customTheme) }
    : theme);
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Close</Text></Pressable><Text style={styles.modalTitle}>Choose a theme</Text><View style={styles.modalHeaderSpacer} /></View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.bodyText}>Each palette changes backgrounds, cards, borders, text, and buttons throughout the app. Dark Mode choices use dark surfaces.</Text>
        {themeRows.map((theme) => {
          const selected = theme.name === currentName;
      const swatches = [theme.colors.paper, theme.colors.card, theme.colors.soft, theme.colors.softAlt, theme.colors.wine, theme.colors.ripple, theme.colors.line, theme.colors.softLine, theme.colors.ink, theme.colors.muted];
          return <Pressable key={theme.name} onPress={() => onSelect(theme.name)} style={[styles.themePickerOption, selected && styles.themePickerOptionSelected]}>
            <View style={styles.flex}><Text style={styles.recordTitle}>{theme.name}</Text><Text style={styles.recordMeta}>{theme.mode === "dark" ? "Dark Mode" : "Light Mode"}{selected ? " · Selected" : ""}</Text></View>
            <View style={styles.themePickerSwatches}>{swatches.map((color, index) => <View key={index} style={[styles.themePickerSwatch, { backgroundColor: color, borderColor: theme.colors.line }]} />)}</View>
          </Pressable>;
        })}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
function CustomColorSetting({ label, value, isOpen, onToggle, onChange, onPick }) {
  return <View style={styles.customColorControl}>
    <View style={styles.customColorTop}>
      <View style={styles.flex}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldHint}>Enter a hex color or choose a swatch.</Text></View>
      <View style={[styles.customColorSample, { backgroundColor: validHexColor(value) ? value : COLORS.softAlt }]} />
      <TextInput value={value} onChangeText={onChange} placeholder="#E5394F" placeholderTextColor={COLORS.placeholder} autoCapitalize="none" autoCorrect={false} maxLength={7} style={styles.colorCodeInput} />
    </View>
    <Pressable onPress={onToggle} style={styles.colorPickerToggle}><Text style={styles.colorPickerText}>{isOpen ? "Hide color choices" : "Choose a color"}　›</Text></Pressable>
    {isOpen ? <View style={styles.customSwatchGrid}>{CUSTOM_COLOR_SWATCHES.map((color) => <Pressable key={color} accessibilityLabel={"Choose " + color} onPress={() => onPick(color)} style={[styles.customSwatch, { backgroundColor: color, borderColor: String(value).toLowerCase() === color.toLowerCase() ? COLORS.wine : COLORS.line, borderWidth: String(value).toLowerCase() === color.toLowerCase() ? 3 : 1 }]} />)}</View> : null}
  </View>;
}

function DropdownOptionManager({ set, options, onSave, onDelete }) {
  const [editIndex, setEditIndex] = useState(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const begin = (index) => {
    setEditIndex(index);
    setDraft(index == null ? "" : (options[index] || ""));
    setEditing(true);
  };
  const save = () => {
    if (onSave(set.key, editIndex, draft)) setEditing(false);
  };
  return <Card>
    <View style={styles.cardTop}><Text style={styles.cardTitle}>{set.label}</Text><Action label="＋ Add" onPress={() => begin(null)} /></View>
    {options.map((option, index) => <View key={`${set.key}-${index}`} style={styles.optionManagerRow}>
      <Text style={styles.optionManagerLabel}>{option}</Text>
      <View style={styles.optionManagerActions}><Pressable hitSlop={8} onPress={() => begin(index)}><Text style={styles.actionText}>Edit</Text></Pressable><Pressable hitSlop={8} onPress={() => onDelete(set.key, index)}><Text style={styles.deleteOptionText}>Delete</Text></Pressable></View>
    </View>)}
    {editing ? <View style={styles.inlineEditor}>
      <TextInput value={draft} onChangeText={setDraft} autoFocus placeholder="Option name" placeholderTextColor={COLORS.placeholder} style={styles.input} returnKeyType="done" onSubmitEditing={save} />
      <View style={styles.actionRow}><Action label="Cancel" quiet onPress={() => setEditing(false)} /><Action label="Save option" onPress={save} /></View>
    </View> : null}
  </Card>;
}

function RecipeEditor({ components, recipe, onChange }) {
  const [componentId, setComponentId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const available = components.filter((component) => active(component) && !recipe.some((part) => part.componentId === component.id));
  const categories = Array.from(new Set(available.map((component) => component.category || "Other"))).sort((a, b) => a.localeCompare(b));
  const filteredAvailable = available.filter((component) => categoryFilter === "All" || (component.category || "Other") === categoryFilter);
  const addComponent = () => {
    const component = filteredAvailable.find((item) => item.id === componentId);
    if (!component) return;
    onChange(recipe.concat([{ componentId: component.id, name: component.name, sku: component.sku, unit: component.unit || "pieces", quantity: "1", unitCost: Number(component.cost) || 0 }]));
    setComponentId("");
  };
  return (
    <View style={styles.recipeEditor}>
      <Text style={styles.fieldLabel}>Product recipe</Text>
      <Text style={styles.fieldHint}>Add every component this product uses, then enter the amount of each one per finished item.</Text>
      {available.length ? (
        <>
          <ChoiceChips label="Filter components" options={["All", ...categories]} value={categoryFilter} onChange={(value) => { setCategoryFilter(value); setComponentId(""); }} />
          <Field field={{ label: "Choose a component", searchable: true, searchPlaceholder: "Search components", options: filteredAvailable.map((item) => ({ label: `${item.name} · ${item.sku} · ${item.quantity} ${item.unit || "pieces"} available`, value: item.id })) }} value={componentId} onChange={setComponentId} />
          <Action label="Add component to recipe" onPress={addComponent} />
        </>
      ) : <Text style={styles.bodyText}>{components.some(active) ? "All active components are already in this recipe." : "Add components in Materials before building a product recipe."}</Text>}
      {recipe.map((part) => {
        const current = components.find((item) => item.id === part.componentId);
        const name = current ? current.name : part.name;
        const sku = current ? current.sku : part.sku;
        const unit = current ? current.unit : part.unit;
        return (
          <View key={part.componentId} style={styles.recipeLine}>
            <View style={styles.flex}><Text style={styles.recordTitle}>{name}</Text><Text style={styles.recordMeta}>{sku} · {unit}</Text></View>
            <TextInput value={String(part.quantity == null ? "" : part.quantity)} onChangeText={(quantity) => onChange(recipe.map((item) => item.componentId === part.componentId ? { ...item, quantity } : item))} keyboardType="decimal-pad" style={styles.recipeQuantity} accessibilityLabel={`Quantity of ${name} per product`} />
            <Pressable onPress={() => onChange(recipe.filter((item) => item.componentId !== part.componentId))}><Text style={styles.deleteOptionText}>Remove</Text></Pressable>
          </View>
        );
      })}
    </View>
  );
}

function TimeBarChart({ title, bars }) {
  const max = Math.max(1, ...bars.map((bar) => Number(bar.value) || 0));
  return (
    <Card style={styles.chartCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.chartRow}>{bars.map((bar, index) => {
        const height = Math.max(2, Math.round(((Number(bar.value) || 0) / max) * 92));
        return <View key={bar.label + index} style={styles.chartColumn}>
          <Text style={styles.chartValue}>{bar.value ? formatHours(bar.value) : ""}</Text>
          <View style={styles.chartTrack}><View style={[styles.chartBar, { height }]} /></View>
          <Text style={styles.chartLabel}>{bar.label}</Text>
        </View>;
      })}</View>
    </Card>
  );
}

function TimeEditModal({ visible, mode, session, tasks, onClose, onSave }) {
  const initialValuesJson = JSON.stringify({ mode, session: session || null });
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [taskIds, setTaskIds] = useState([]);
  const [workNote, setWorkNote] = useState("");
  const [timerName, setTimerName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const initial = JSON.parse(initialValuesJson);
    const record = initial.session;
    if (!record) return;
    setDate(record.date || TODAY);
    setStartTime(formatTimeForDisplay(clockTimeLabel(record.clockIn == null ? record.startedAt : record.clockIn)));
    const savedEnd = record.clockOut == null ? record.endedAt : record.clockOut;
    setEndTime(formatTimeForDisplay(savedEnd ? clockTimeLabel(savedEnd) : clockTimeLabel(Date.now())));
    setBreakMinutes(String(Math.round((Number(record.breakMs) || 0) / 60000)));
    setTaskIds(Array.isArray(record.taskIds) ? record.taskIds : (record.taskId ? [record.taskId] : []));
    setWorkNote(record.workNote || "");
    setTimerName(record.label || "");
    setError("");
  }, [initialValuesJson, visible]);
  const submit = () => {
    const normalizedStart = normalizeTimeInput(startTime);
    const normalizedEnd = normalizeTimeInput(endTime);
    const normalizedDate = parseDateInput(date);
    if (!normalizedDate || !normalizedStart || (mode !== "active" && !normalizedEnd)) {
      setError("Enter a valid date and time, such as 9:30 AM or 21:30."); return;
    }
    const clockIn = new Date(`${normalizedDate}T${normalizedStart}:00`).getTime();
    const clockOut = mode !== "active" ? new Date(`${normalizedDate}T${normalizedEnd}:00`).getTime() : null;
    const breaks = mode === "timer" ? 0 : Number(breakMinutes);
      if (!Number.isFinite(breaks) || breaks < 0 || (mode === "active" && clockIn > Date.now()) || (clockOut && (clockOut <= clockIn || breaks * 60000 > clockOut - clockIn))) {
      setError("Check that the end is later than the start and the break is within the shift."); return;
    }
    const taskTitles = taskIds.map((id) => tasks.find((task) => task.id === id)?.title).filter(Boolean);
    onSave({ mode, id: session.id, date: normalizedDate, clockIn, clockOut, breakMs: breaks * 60000, durationMs: clockOut ? clockOut - clockIn - breaks * 60000 : null, taskIds, taskTitles, workNote, label: timerName.trim() });
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>Edit {mode === "active" ? "clock-in time" : mode === "timer" ? "focus timer" : "shift times"}</Text><Pressable onPress={submit}><Text style={styles.modalSave}>Save</Text></Pressable></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Field field={{ label: "Work date", date: true }} value={date} onChange={setDate} />
        {mode === "timer" ? <Field field={{ label: "Timer name" }} value={timerName} onChange={setTimerName} /> : null}
        <Field field={{ label: mode === "timer" ? "Timer started" : "Clock-in time", time: true }} value={startTime} onChange={setStartTime} />
        {mode !== "active" ? <Field field={{ label: mode === "timer" ? "Timer ended" : "Clock-out time", time: true }} value={endTime} onChange={setEndTime} /> : null}
        {mode !== "timer" ? <Field field={{ label: "Break minutes", number: true }} value={breakMinutes} onChange={setBreakMinutes} /> : null}
        <Field field={{ label: "Tasks worked on (choose all that apply)", options: tasks.map((task) => ({ label: task.title, value: task.id })), multiple: true, placeholder: "Choose one or more tasks" }} value={taskIds} onChange={setTaskIds} />
        <Field field={{ label: "Work note", multiline: true, placeholder: "What did you work on during this shift?" }} value={workNote} onChange={setWorkNote} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function DiscountPlanModal({ visible, listing, plan, onClose, onSave }) {
  const initialValuesJson = JSON.stringify({ listingId: listing ? listing.id : "", plan: plan || null });
  const [percent, setPercent] = useState("5");
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const initial = JSON.parse(initialValuesJson);
    const currentPlan = initial.plan;
    setPercent(String(currentPlan ? currentPlan.percent : 5));
    setStartDate(currentPlan ? currentPlan.startDate || TODAY : TODAY);
    setEndDate(currentPlan ? currentPlan.endDate || "" : "");
    setNotes(currentPlan ? currentPlan.notes || "" : "");
    setError("");
  }, [initialValuesJson, visible]);
  const submit = () => {
    const amount = asNumber(percent, NaN);
    const normalizedStart = parseDateInput(startDate);
    const normalizedEnd = endDate ? parseDateInput(endDate) : "";
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) { setError("Enter a discount greater than 0 and no more than 100%."); return; }
    if (!normalizedStart || (endDate && !normalizedEnd)) { setError("Use valid dates in your chosen format or select them from the calendar."); return; }
    if (normalizedEnd && normalizedEnd < normalizedStart) { setError("The end date must be the same as or later than the start date."); return; }
    onSave({ id: plan ? plan.id : uid("discount"), percent: amount, startDate: normalizedStart, endDate: normalizedEnd, notes: notes.trim() });
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{plan ? "Edit discount plan" : "Plan a discount"}</Text><Pressable onPress={submit}><Text style={styles.modalSave}>Save</Text></Pressable></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.cardTitle}>{listing ? listing.productName : "Listing"}</Text>
        <Text style={styles.bodyText}>This saves a dated promotion reminder for the selected listing. It does not change the price or activate a sale in Etsy, Shopify, or another channel. Example: enter 10%, a start date, and an end date here, then set that same 10% promotion in the marketplace yourself.</Text>
        <Field field={{ label: "Discount (%)", number: true, placeholder: "5" }} value={percent} onChange={setPercent} />
        <Field field={{ label: "Start date", date: true }} value={startDate} onChange={setStartDate} />
        <Field field={{ label: "End date (optional)", date: true, placeholder: "Leave blank for no end date" }} value={endDate} onChange={setEndDate} />
        <Field field={{ label: "Notes (optional)", multiline: true, placeholder: "Promotion name, reason, or reminder" }} value={notes} onChange={setNotes} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function RelistModal({ visible, listing, product, onClose, onSave }) {
  const initialJson = JSON.stringify({ listing: listing || null });
  const [price, setPrice] = useState("");
  const [packageWeight, setPackageWeight] = useState("");
  const [packageWeightUnit, setPackageWeightUnit] = useState("oz");
  const [changesNote, setChangesNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const initial = JSON.parse(initialJson).listing;
    setPrice(String(initial ? initial.price : ""));
    setPackageWeight(String(initial ? initial.packageWeight || 0 : ""));
    setPackageWeightUnit(initial ? initial.packageWeightUnit || "oz" : "oz");
    setChangesNote("");
    setConfirmed(false);
    setError("");
  }, [initialJson, visible]);
  const submit = () => {
    const nextPrice = asNumber(price, NaN);
    const nextWeight = asNumber(packageWeight, NaN);
    if (!Number.isFinite(nextPrice) || nextPrice < 0 || !Number.isFinite(nextWeight) || nextWeight < 0) { setError("Enter a valid price and packaged weight."); return; }
    if (!confirmed) { setError("Confirm that you have relisted this item on its marketplace."); return; }
    if (!product || Number(product.inventory) <= 0) { setError("Make or restock at least one finished product before relisting."); return; }
    onSave({ price: nextPrice, packageWeight: nextWeight, packageWeightUnit, changesNote: changesNote.trim() });
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>Relist item</Text><Pressable onPress={submit}><Text style={styles.modalSave}>Save relist</Text></Pressable></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.cardTitle}>{listing ? listing.productName : "Listing"}</Text>
          <Text style={styles.bodyText}>Check the details before relisting. Saving resets the listed-on date to today, so the active days start over. This tracker does not publish the marketplace page for you.</Text>
          <Field field={{ label: "Price to relist at", number: true, required: true }} value={price} onChange={setPrice} />
          <Field field={{ label: "Final packaged weight", number: true, required: true }} value={packageWeight} onChange={setPackageWeight} />
          <Field field={{ label: "Weight unit", options: WEIGHT_UNITS }} value={packageWeightUnit} onChange={setPackageWeightUnit} />
          <Field field={{ label: "Changes made while relisting (optional)", multiline: true, placeholder: "Note changed price, weight, photos, or listing details" }} value={changesNote} onChange={setChangesNote} />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed(!confirmed)} style={styles.actionRow}><View style={styles.checkCircle}><Text style={styles.checkText}>{confirmed ? "✓" : ""}</Text></View><Text style={styles.bodyText}>I relisted this item on its marketplace today</Text></Pressable>
          <Text style={styles.recordMeta}>Product inventory available: {product ? product.inventory : 0}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function DateEditModal({ visible, entry, statuses = [], onClose, onSave }) {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDate(entry ? formatDateInput(entry.date) || formatDateInput(timestampDateKey(entry.date)) : "");
    setStatus(entry && entry.status ? entry.status : "");
    setError("");
  }, [entry, visible]);
  const submit = () => {
    const normalized = parseDateInput(date);
    if (!normalized) { setError("Enter a valid date in your chosen format or use the calendar."); return; }
    onSave(normalized, status);
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>Edit sale status</Text><Pressable onPress={submit}><Text style={styles.modalSave}>Save</Text></Pressable></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Field field={{ label: "Order status", options: statuses.map((item) => ({ label: item, value: item })) }} value={status} onChange={setStatus} />
        <Field field={{ label: "Date for this status", date: true }} value={date} onChange={setDate} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function RefundModal({ visible, order, currency, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [returnedQuantity, setReturnedQuantity] = useState("0");
  const [restockQuantity, setRestockQuantity] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const orderId = order ? order.id : "";
  const priorRefund = order ? Number(order.refundAmount) || 0 : 0;
  const priorReturn = order ? Number(order.returnedQuantity) || 0 : 0;
  const remainingRefund = order ? Math.max(0, totalOrder(order) - priorRefund) : 0;
  const totalQuantity = order ? (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : 0;
  const remainingReturn = Math.max(0, totalQuantity - priorReturn);
  useEffect(() => {
    if (!visible || !order) return;
    setAmount(String(Math.max(0, totalOrder(order) - (Number(order.refundAmount) || 0))));
    setReturnedQuantity("0");
    setRestockQuantity("0");
    setNote("");
    setError("");
  }, [visible, order, orderId, priorRefund, priorReturn]);
  const submit = () => {
    const refund = asNumber(amount, NaN);
    const returned = asNumber(returnedQuantity, NaN);
    const restock = asNumber(restockQuantity, NaN);
    if (!Number.isFinite(refund) || refund <= 0 || refund > remainingRefund + 0.01) { setError(`Enter an amount above zero and no more than ${money(remainingRefund, currency)}.`); return; }
    if (!Number.isFinite(returned) || returned < 0 || returned > remainingReturn) { setError("Enter a return quantity from zero to the remaining number of units."); return; }
    if (!Number.isFinite(restock) || restock < 0 || restock > returned) { setError("Sellable quantity must be between zero and the number returned."); return; }
    onSave({ amount: refund, returnedQuantity: returned, restockQuantity: restock, note: note.trim() });
  };
  if (!order) return null;
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>Record refund or return</Text><Pressable onPress={submit}><Text style={styles.modalSave}>Save</Text></Pressable></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formHero}><Text style={styles.formHeroEyebrow}>SALE CORRECTION</Text><Text style={styles.formHeroTitle}>{(order.items || []).map((item) => item.productName).join(", ") || "Sale"}</Text><Text style={styles.formHeroText}>Refund the amount received, then separately record returned units and what can go back into sellable stock.</Text></View>
        <Field field={{ label: `Refund amount (remaining ${money(remainingRefund, currency)})`, number: true, required: true }} value={amount} onChange={setAmount} />
        <Field field={{ label: `Units returned (up to ${remainingReturn})`, number: true, required: true }} value={returnedQuantity} onChange={(value) => { setReturnedQuantity(value); if (Number(value) < Number(restockQuantity)) setRestockQuantity(value); }} />
        <Field field={{ label: "Returned units safe to restock", number: true, required: true, hint: "Use 0 for damaged, used, or otherwise unsellable returns." }} value={restockQuantity} onChange={setRestockQuantity} />
        <Field field={{ label: "Return note (optional)", multiline: true, placeholder: "Reason, condition, or customer details" }} value={note} onChange={setNote} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView></KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function RecordModal({ visible, type, record, db, prefill, onClose, onSave, onManageOptions }) {
  const typeLabels = {
    component: "Component",
    restock: "Component restock",
    product: "Product",
    listing: "Marketplace listing",
    order: "Record a sale",
    income: "Business income",
    review: "Buyer review",
    expense: "Business expense",
    task: "Business task",
    event: "Calendar event",
    idea: "Product idea",
    supplier: "Supplier",
    workPlan: "Planned work block",
  };
  const optionsFor = (key) => (db.dropdownOptions && db.dropdownOptions[key] || DEFAULT_DROPDOWN_OPTIONS[key] || []).map((value) => ({ label: value, value }));
  const supplierOptions = (db.suppliers || []).filter(active).map((item) => ({ label: item.name, value: item.name }));
  const currentOrderProductId = type === "order" && record && record.items && record.items[0] ? record.items[0].productId : "";
  const productOptions = (db.products || []).filter((p) => active(p) || p.id === currentOrderProductId).map((p) => ({ label: p.name + " (" + p.sku + ")" + (p.archived ? " · archived" : ""), value: p.id }));
  const orderOptions = (db.orders || []).map((order) => ({ label: [order.orderSku, (order.items || []).map((item) => [item.productName, item.productSku, item.listingName, item.listingSku].filter(Boolean).join(" ").trim()).join(", "), order.customer, dateLabel(order.date)].filter(Boolean).join(" · "), value: order.id }));
  const fieldsByType = {
    component: [
      { key: "name", label: "Component name", required: true, placeholder: "Example: Gold jump rings" },
      { key: "category", label: "Category", optionSet: "componentCategories", options: optionsFor("componentCategories") },
      { key: "colors", label: "Colors", optionSet: "colors", options: optionsFor("colors"), multiple: true, searchable: true, placeholder: "Choose colors" },
      { key: "materials", label: "Materials", optionSet: "materials", options: optionsFor("materials"), multiple: true, searchable: true, placeholder: "Choose materials" },
      { key: "sizes", label: "Sizes", optionSet: "sizes", options: optionsFor("sizes"), multiple: true, searchable: true, placeholder: "Choose sizes" },
      { key: "gender", label: "Audience or gender (optional)", optionSet: "genders", options: optionsFor("genders"), allowBlank: true, placeholder: "Choose if it applies" },
      { key: "quantity", label: "Quantity on hand", number: true, required: true, placeholder: "0" },
      { key: "adjustmentNote", label: "Reason for quantity change (optional)", placeholder: "Example: counted stock and found 2 extra" },
      { key: "unit", label: "Unit", optionSet: "componentUnits", options: optionsFor("componentUnits") },
      { key: "lowStock", label: "Low-stock alert at", number: true, placeholder: String(db.defaultLowStock == null ? 3 : db.defaultLowStock) },
      { key: "cost", label: "Cost per unit", number: true, placeholder: "0.00" },
      { key: "supplier", label: "Supplier", optionSet: "suppliers", options: supplierOptions, searchable: true, allowBlank: true, placeholder: "Choose or add a supplier" },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Storage location, color, size..." },
    ],
    restock: [
      { key: "componentId", label: "Component", options: (db.components || []).filter(active).map((item) => ({ label: item.name + " (" + item.sku + ")", value: item.id })), required: true, placeholder: "Choose a component" },
      { key: "quantity", label: "Quantity purchased", number: true, required: true, placeholder: "0" },
      { key: "purchaseCost", label: "Total material cost (optional)", number: true, placeholder: "Leave blank if unknown", hint: "If blank, new units keep the component’s current average cost instead of reducing it to zero." },
      { key: "shippingCost", label: "Shipping cost (optional)", number: true, placeholder: "Leave blank if unknown" },
      { key: "supplier", label: "Supplier", optionSet: "suppliers", options: supplierOptions, searchable: true, allowBlank: true, placeholder: "Choose or add a supplier" },
      { key: "date", label: "Purchase date", date: true, hint: "Choose the actual date you bought these supplies; past dates are supported." },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Receipt details or purchase reference" },
    ],
    product: [
      { key: "name", label: "Product name", required: true, placeholder: "Example: Victorian lace choker" },
      { key: "sku", label: "Product SKU", required: true, placeholder: "PROD-001", hint: "A unique code is suggested automatically. You can replace it with your own SKU." },
      { key: "category", label: "Category", optionSet: "productCategories", options: optionsFor("productCategories") },
      { key: "colors", label: "Colors", optionSet: "colors", options: optionsFor("colors"), multiple: true, searchable: true, placeholder: "Choose one or more colors" },
      { key: "materials", label: "Materials", optionSet: "materials", options: optionsFor("materials"), multiple: true, searchable: true, placeholder: "Choose one or more materials" },
      { key: "sizes", label: "Sizes", optionSet: "sizes", options: optionsFor("sizes"), multiple: true, searchable: true, placeholder: "Choose one or more sizes" },
      { key: "gender", label: "Audience or gender (optional)", optionSet: "genders", options: optionsFor("genders"), allowBlank: true, placeholder: "Choose if it applies" },
      { key: "description", label: "Product description", multiline: true, placeholder: "Describe the finished item, materials, colors, and anything you want to remember" },
      { key: "condition", label: "Condition or item type", options: CONDITION_OPTIONS },
      { key: "price", label: "Selling price", number: true, required: true, placeholder: "0.00" },
      { key: "inventory", label: "Starting finished inventory", number: true, placeholder: "0" },
      { key: "packageWeight", label: "Final packaged weight", number: true, placeholder: "Example: 4.5" },
      { key: "packageWeightUnit", label: "Package weight unit", options: WEIGHT_UNITS },
    ],
    listing: [
      { key: "productId", label: "Product", options: productOptions, searchable: true, searchPlaceholder: "Search products", required: true, placeholder: "Choose a product" },
      { key: "listingSku", label: "Listing SKU", required: true, placeholder: "Example: LIST-001" },
      { key: "marketplaces", label: "Sales channels (choose all that apply)", optionSet: "marketplaces", options: optionsFor("marketplaces"), multiple: true, required: true, placeholder: "Choose one or more channels" },
      { key: "status", label: "Status", optionSet: "listingStatuses", options: optionsFor("listingStatuses"), placeholder: "Choose status" },
      { key: "price", label: "Listing price", number: true, placeholder: "0.00" },
      { key: "colors", label: "Colors", optionSet: "colors", options: optionsFor("colors"), multiple: true, searchable: true, placeholder: "Choose one or more colors" },
      { key: "materials", label: "Materials", optionSet: "materials", options: optionsFor("materials"), multiple: true, searchable: true, placeholder: "Choose one or more materials" },
      { key: "sizes", label: "Sizes", optionSet: "sizes", options: optionsFor("sizes"), multiple: true, searchable: true, placeholder: "Choose one or more sizes" },
      { key: "gender", label: "Audience or gender (optional)", optionSet: "genders", options: optionsFor("genders"), allowBlank: true, placeholder: "Choose if it applies" },
      { key: "condition", label: "Condition or item type", options: CONDITION_OPTIONS },
      { key: "packageWeight", label: "Final packaged weight", number: true, placeholder: "Example: 4.5" },
      { key: "packageWeightUnit", label: "Package weight unit", options: WEIGHT_UNITS },
      { key: "startDate", label: "Listing start date (when it goes live)", date: true },
      { key: "relistDate", label: "Next relisting date", date: true },
      { key: "url", label: "Listing links (one per line)", multiline: true, placeholder: "Paste a URL for each marketplace listing" },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Listing details, promotion plan, renewal notes..." },
    ],
    order: [
      { key: "orderSku", label: "Order SKU", required: true, placeholder: "Example: ORDER-001" },
      { key: "productId", label: "Product sold", options: productOptions, searchable: true, searchPlaceholder: "Search products", required: true, placeholder: "Choose a product" },
      { key: "quantity", label: "Quantity sold", number: true, required: true, placeholder: "1" },
      { key: "marketplace", label: "Sales platform", optionSet: "marketplaces", options: optionsFor("marketplaces") },
      { key: "unitPrice", label: "Price per item", number: true, placeholder: "Leave blank to use product price" },
      { key: "extraFees", label: "Additional estimated fees", number: true, placeholder: "0.00", hint: "Added on top of the marketplace fee estimate." },
      { key: "actualFees", label: "Actual fees paid (optional)", number: true, placeholder: "Leave blank to use estimate", hint: "If entered, this replaces the estimated marketplace and extra fees for this sale." },
      { key: "shippingCost", label: "Shipping cost paid by you", number: true, placeholder: "0.00" },
      { key: "paymentMethod", label: "Payment method", optionSet: "paymentMethods", options: optionsFor("paymentMethods") },
      { key: "shippingMethod", label: "Shipping or delivery method", optionSet: "shippingMethods", options: optionsFor("shippingMethods") },
      { key: "packageWeight", label: "Final packaged weight", number: true, placeholder: "Example: 4.5" },
      { key: "packageWeightUnit", label: "Package weight unit", options: WEIGHT_UNITS },
      { key: "customer", label: "Customer (optional)", placeholder: "Name or order reference" },
      { key: "trackingNumber", label: "Tracking ID or number", placeholder: "Paste the carrier tracking number" },
      { key: "trackingCarrier", label: "Shipping carrier", placeholder: "Example: USPS, UPS, FedEx" },
      { key: "trackingUrl", label: "Tracking link", placeholder: "Paste the tracking page URL" },
      { key: "date", label: "Sale date", date: true },
      { key: "notes", label: "Sale notes", multiline: true, placeholder: "Order details, customer request, or fee notes" },
      { key: "actualPayout", label: "Final payout received (optional)", number: true, placeholder: "Leave blank to calculate from sale minus fees", hint: "Use the amount that actually reached your account if the marketplace statement differs from the estimate." },
    ],
    review: [
      { key: "customer", label: "Buyer name or order reference", placeholder: "Optional; you can keep the buyer anonymous" },
      { key: "orderId", label: "Link to a sale", options: orderOptions, searchable: true, searchPlaceholder: "Search order, product, SKU, buyer", allowBlank: true, placeholder: "Optional: choose an order" },
      { key: "platform", label: "Platform", options: optionsFor("marketplaces"), placeholder: "Choose the review platform" },
      { key: "stars", label: "Stars received", options: [1, 2, 3, 4, 5].map((stars) => ({ label: "★".repeat(stars) + "  " + stars + " star" + (stars === 1 ? "" : "s"), value: String(stars) })) },
      { key: "date", label: "Review date", date: true },
      { key: "reviewText", label: "What the buyer wrote", multiline: true, required: true, placeholder: "Paste or type the buyer's review" },
      { key: "publicResponse", label: "Your public reply (optional)", multiline: true, placeholder: "What you replied to the buyer, if anything" },
      { key: "notes", label: "Private notes (optional)", multiline: true, placeholder: "Follow-up or context for you only" },
    ],
    expense: [
      { key: "description", label: "Expense", required: true, placeholder: "Example: Packaging supplies" },
      { key: "amount", label: "Amount", number: true, required: true, placeholder: "0.00" },
      { key: "category", label: "Category", optionSet: "expenseCategories", options: optionsFor("expenseCategories") },
      { key: "expenseType", label: "How was it paid?", required: true, options: [{ label: "Out of pocket", value: "outOfPocket" }, { label: "Deducted from sale payout", value: "salesDeduction" }], hint: "Choose whether you paid this yourself or it was taken from a sale payout. Do not enter a fee here if it is already recorded on the order." },
      { key: "date", label: "Date", date: true },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Optional details" },
    ],
    income: [
      { key: "description", label: "Income source", required: true, placeholder: "Example: craft market payout" },
      { key: "amount", label: "Amount received", number: true, required: true, placeholder: "0.00" },
      { key: "category", label: "Category", placeholder: "Example: market sales, reimbursement, other" },
      { key: "date", label: "Date received", date: true },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Optional details" },
    ],
    task: [
      { key: "title", label: "Task", required: true, placeholder: "What needs to get done?" },
      { key: "category", label: "Category", optionSet: "taskCategories", options: optionsFor("taskCategories") },
      { key: "dueDate", label: "Due date", date: true },
      { key: "priority", label: "Priority", optionSet: "taskPriorities", options: optionsFor("taskPriorities"), placeholder: "Normal" },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Break it into a small next step..." },
    ],
    event: [
      { key: "title", label: "Event", required: true, placeholder: "Order deadline, launch, market..." },
      { key: "date", label: "Date", date: true, required: true },
      { key: "kind", label: "Type", optionSet: "eventTypes", options: optionsFor("eventTypes") },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Optional details" },
    ],
    idea: [
      { key: "title", label: "Idea", required: true, placeholder: "What could you make?" },
      { key: "category", label: "Collection or category", placeholder: "Optional" },
      { key: "status", label: "Board column", options: ["Ideas", "To make", "In progress", "Done"].map((value) => ({ label: value, value })) },
      { key: "notes", label: "Idea notes", multiline: true, placeholder: "Colors, materials, inspiration..." },
    ],
    supplier: [
      { key: "name", label: "Supplier name", required: true, placeholder: "Supplier or shop name" },
      { key: "category", label: "Supplier category", optionSet: "supplierCategories", options: optionsFor("supplierCategories") },
      { key: "contact", label: "Contact information", placeholder: "Email or phone" },
      { key: "website", label: "Website", placeholder: "https://..." },
      { key: "notes", label: "Notes", multiline: true, placeholder: "Typical prices, minimum order, shipping..." },
    ],
    workPlan: [
      { key: "title", label: "Work block", required: true, placeholder: "Example: Make and photograph new stock" },
      { key: "date", label: "Date", date: true, required: true },
      { key: "startTime", label: "Start time", time: true, required: true },
      { key: "endTime", label: "End time", time: true, required: true },
      { key: "notes", label: "Notes", multiline: true, placeholder: "What you plan to work on" },
    ],
  };
  const fields = (fieldsByType[type] || []).filter((field) => !(type === "product" && record && field.key === "inventory"));
  const formSections = groupFields(fields);
  const initialValuesJson = JSON.stringify({ type, record: record || null, defaultLowStock: db.defaultLowStock, defaultTaskPriority: db.defaultTaskPriority, defaultEventType: db.defaultEventType, nextProductSku: db.nextProductSku, products: db.products, productSkuReferences: productSkuReferences(db), nextListingSku: db.nextListingSku, nextOrderSku: db.nextOrderSku, prefill: prefill || null });
  const [values, setValues] = useState(() => {
    const initial = JSON.parse(initialValuesJson);
    return { ...createFormDefaults(initial.type, initial.record, initial.defaultLowStock, initial), ...(initial.prefill || {}) };
  });
  const [error, setError] = useState("");
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const selectedOrderProduct = type === "order" ? db.products.find((item) => item.id === values.productId) : null;
  const selectedSaleListing = type === "order" ? db.listings.find((item) => item.id === values.listingId && item.productId === values.productId) : null;
  const saleUnitPrice = values.unitPrice === "" ? Number(selectedOrderProduct && selectedOrderProduct.price) || 0 : Math.max(0, asNumber(values.unitPrice, 0));
  const saleSubtotal = saleUnitPrice * Math.max(0, asNumber(values.quantity, 0));
  const feeRule = (db.marketplaceFeeRules || {})[values.marketplace] || {};
  const marketplaceFeeEstimate = Number((saleSubtotal * Math.max(0, asNumber(feeRule.percent, 0)) / 100 + Math.max(0, asNumber(feeRule.fixed, 0))).toFixed(2));
  const extraFeeEstimate = Math.max(0, asNumber(values.extraFees, 0));
  const hasActualFees = String(values.actualFees == null ? "" : values.actualFees).trim() !== "";
  const displayedFees = hasActualFees ? Math.max(0, asNumber(values.actualFees, 0)) : marketplaceFeeEstimate + extraFeeEstimate;
  const actualPayoutEntered = String(values.actualPayout == null ? "" : values.actualPayout).trim() !== "";
  const estimatedSalePayout = Math.max(0, saleSubtotal - displayedFees);
  useEffect(() => {
    const initial = JSON.parse(initialValuesJson);
    setValues({ ...createFormDefaults(initial.type, initial.record, initial.defaultLowStock, initial), ...(initial.prefill || {}) });
    setError("");
    setSubmitting(false);
    submitLock.current = false;
  }, [initialValuesJson, visible]);
  const submit = () => {
    if (submitLock.current) return;
    const missing = fields.find((field) => field.required && !String(values[field.key] || "").trim());
    if (missing) { setError("Please fill in " + missing.label.toLowerCase() + "."); return; }
    const invalidNumber = fields.find((field) => field.number && String(values[field.key] || "").trim() !== "" && (!Number.isFinite(asNumber(values[field.key], NaN)) || asNumber(values[field.key], NaN) < 0));
    if (invalidNumber) { setError("Enter a valid amount of zero or more for " + invalidNumber.label.toLowerCase() + "."); return; }
    const invalidDate = fields.find((field) => {
      const value = String(values[field.key] || "").trim();
      if (!field.date || !value) return false;
      return !parseDateInput(value);
    });
    if (invalidDate) { setError(invalidDate.label + " must be a valid calendar date. You can type it in the format selected in Settings or use the calendar button."); return; }
    const normalizedStartTime = type === "workPlan" ? normalizeTimeInput(values.startTime) : "";
    const normalizedEndTime = type === "workPlan" ? normalizeTimeInput(values.endTime) : "";
    if (type === "workPlan" && (!normalizedStartTime || !normalizedEndTime || normalizedEndTime <= normalizedStartTime)) {
      setError("Enter valid times, such as 9:00 AM or 14:30, and make the end later than the start."); return;
    }
    if (type === "product" && (values.recipe || []).some((part) => !db.components.some((component) => component.id === part.componentId && active(component)) || asNumber(part.quantity, 0) <= 0)) {
      setError("Each recipe component needs a valid component and an amount above zero."); return;
    }
    submitLock.current = true;
    setSubmitting(true);
    const normalizedValues = { ...values };
    fields.filter((field) => field.date).forEach((field) => { normalizedValues[field.key] = parseDateInput(values[field.key]) || ""; });
    fields.filter((field) => field.multiple && ["colors", "materials", "sizes"].includes(field.key)).forEach((field) => {
      const selected = Array.isArray(values[field.key]) ? values[field.key] : String(values[field.key] || "").split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
      normalizedValues[field.key] = Array.from(new Set(selected)).join(", ");
    });
    if (type === "workPlan") {
      normalizedValues.startTime = normalizedStartTime;
      normalizedValues.endTime = normalizedEndTime;
    }
    if (onSave(type, normalizedValues, record) === false) {
      submitLock.current = false;
      setSubmitting(false);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable>
          <Text style={styles.modalTitle}>{record ? "Edit " : "Add "}{typeLabels[type] || "Record"}</Text>
          <Pressable onPress={submit} disabled={submitting}><Text style={[styles.modalSave, submitting && styles.disabledText]}>{submitting ? "Saving..." : "Save"}</Text></Pressable>
        </View>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.formHero}><Text style={styles.formHeroEyebrow}>{record ? "UPDATE YOUR RECORD" : "ADD SOMETHING NEW"}</Text><Text style={styles.formHeroTitle}>{record ? "Edit " : "Create "}{typeLabels[type] || "Record"}</Text><Text style={styles.formHeroText}>{FORM_INTRO[type] || "Add the details you want to keep with this record. You can come back and edit it anytime."}</Text></View>
          {formSections.map((section) => <View key={section.title} style={styles.formSection}>
            <View style={styles.formSectionHeading}><View style={styles.formSectionMark} /><View style={styles.flex}><Text style={styles.formSectionTitle}>{section.title}</Text><Text style={styles.formSectionText}>{section.description}</Text></View></View>
          {section.fields.map((field) => (
            <Field key={field.key} field={field} value={values[field.key]} onChange={(value) => setValues((old) => {
              const next = { ...old, [field.key]: value };
              if ((type === "listing" || type === "order") && field.key === "productId") {
                const selected = db.products.find((item) => item.id === value);
                if (selected) {
                  next.packageWeight = String(selected.packageWeight || "");
                  next.packageWeightUnit = selected.packageWeightUnit || "oz";
                  if (type === "listing") {
                    if (!next.listingSku) next.listingSku = selected.sku || "";
                    next.colors = selected.colors || "";
                    next.materials = selected.materials || "";
                    next.sizes = selected.sizes || "";
                    next.gender = selected.gender || "";
                    next.condition = selected.condition || "Handmade";
                    if (!next.price) next.price = String(selected.price || "");
                  }
                }
                if (type === "order") {
                  const candidates = db.listings.filter((item) => active(item) && item.productId === value);
                  const selectedListing = candidates.find((item) => (item.marketplaces || (item.marketplace ? String(item.marketplace).split(",").map((channel) => channel.trim()) : [])).includes(next.marketplace)) || null;
                  next.listingId = selectedListing ? selectedListing.id : "";
                  if (selected) next.unitPrice = String(selectedListing && selectedListing.price != null ? selectedListing.price : selected.price || "");
                }
              }
              if (type === "order" && field.key === "marketplace") {
                const candidates = db.listings.filter((item) => active(item) && item.productId === next.productId);
                const selectedListing = candidates.find((item) => (item.marketplaces || (item.marketplace ? String(item.marketplace).split(",").map((channel) => channel.trim()) : [])).includes(value)) || null;
                next.listingId = selectedListing ? selectedListing.id : "";
                const selectedProduct = db.products.find((item) => item.id === next.productId);
                if (selectedProduct) next.unitPrice = String(selectedListing && selectedListing.price != null ? selectedListing.price : selectedProduct.price || "");
              }
              if (type === "review" && field.key === "orderId") {
                const linkedOrder = db.orders.find((item) => item.id === value);
                next.customer = linkedOrder ? linkedOrder.customer || "" : "";
              }
              return next;
            })} onManageOptions={onManageOptions} />
          ))}</View>)}
          {type === "order" ? <View style={styles.recipePreview}><Text style={styles.fieldLabel}>{actualPayoutEntered ? "Final payout received" : "Estimated payout after fees"}</Text><Text style={styles.orderPayoutEstimate}>{money(actualPayoutEntered ? asNumber(values.actualPayout, 0) : estimatedSalePayout, db.currency)}</Text><Text style={styles.bodyText}>{actualPayoutEntered ? "Final payout entered" : `${values.marketplace || "Direct"}: ${money(displayedFees, db.currency)} ${hasActualFees ? "actual fees" : "estimated fees"} · ${money(saleSubtotal, db.currency)} sale total`}</Text>{selectedSaleListing ? <Text style={styles.fieldHint}>Automatically linked listing: {selectedSaleListing.listingSku || selectedSaleListing.productName}</Text> : <Text style={styles.fieldHint}>No matching listing for this product and sales platform. The sale can still be saved without a listing link.</Text>}<Text style={styles.fieldHint}>Fee estimates use your optional marketplace rates in Settings. Enter actual fees or the final payout above when your statement is available.</Text></View> : null}
          {type === "product" ? <RecipeEditor components={db.components} recipe={values.recipe || []} onChange={(recipe) => setValues((old) => ({ ...old, recipe }))} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.formFootnote}>Your records are saved on this device. Back up your data from Settings.</Text>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const HELP_COPY = {
  Dashboard: ["This is your business overview, not a separate accounting ledger. Sales, order stages, low-stock materials, tasks, and time blocks are calculated from records you enter elsewhere. Change the Sales and cash view to daily, weekly, monthly, or yearly; tap a fulfillment status to open its product list. Use Settings to set a monthly gross-sales target or rearrange dashboard cards.", "Example: tap Ready to Ship to see only products in that status. Set a $1,500 monthly sales goal in Settings to see recorded gross sales progress; the goal measures sales, not profit."],
  Components: ["A component is a raw material or supply you keep in stock, such as beads, fabric, clasps, or mailers. Add one record per supply, choose a consistent unit, set the quantity you physically have, and optionally record cost, supplier, and a low-stock threshold. Restocks add units and preserve purchase history; a manual quantity correction asks for a reason. Search and sorting only change how you find records.", "Example: create ‘Brass lobster clasps,’ unit ‘pieces,’ quantity 40, cost per unit 0.18, and alert at 10. When a 100-piece order arrives, use Restock with quantity 100 and its actual purchase total; do not replace the old 40 with 100."],
  Products: ["A product is a completed item you intend to sell. Add its buyer-facing name, normal price, ready-to-sell count, colors, materials, condition, and the weight of the fully packed parcel. The recipe is optional: it lists how much of each component one finished unit consumes, so Production can update stock. Descriptive materials text and recipe quantities are separate fields.", "Example: add ‘Pearl drop earrings,’ price 28.00, inventory 3, colors ‘ivory, brass.’ In the recipe, assign 2 hooks and 4 pearls per pair. Recording production of 2 pairs then uses 4 hooks and 8 pearls."],
  Listings: ["A listing is your record of a product page on one or more sales channels. Create the product first, then select the channels where you maintain a page, add each listing’s price, status, live date, renewal date, and public URL. Selecting a channel or entering a date does not publish, renew, or edit anything on that marketplace. Use ‘Add discount plan’ to plan a dated promotion for the selected channels; the tracker records its dates and percentage but does not change the marketplace price. Use the promotion calendar here to review upcoming discount starts/ends and relists.", "Example: create a listing for ‘Pearl drop earrings,’ select Etsy and Shopify, and paste the two public page links. To plan 10% off from 12/02/2026 through 12/05/2026, add a discount plan with 10, start date 12/02/2026, end date 12/05/2026, then separately set that sale in Etsy and Shopify. The calendar reminds you of the planned dates."],
  "Listing Analytics": ["Record the current totals shown by a marketplace for a listing and channel. Each recording is saved as a timestamped snapshot; the first one is a baseline, and later snapshots show increases between checks. Marketplace totals are entered manually and are not imported. Leave metrics blank when a channel does not provide them. Date filters assign a snapshot increase to the later check and do not fill in days with no recordings.", "Example: record 100 views on Monday and 125 on Tuesday for the same Etsy listing. The dashboard counts 25 observed additional views on Tuesday, not 225 total views. Record Depop separately even if the same product is listed there."],
  Orders: ["An order is a sale you enter manually; the app does not import orders or take payment. Choose the product, quantity, sale channel, price, date, and any shipping or fee details. Saving a sale reduces the product’s finished inventory. Move its fulfillment status forward only when that step has happened; Details keeps the timeline, refund history, and corrections together. Enter actual fees from the marketplace when available; otherwise the saved fee rule is an estimate.", "Example: record one necklace at 28.00 sold through Etsy on 12/02/2026. The product inventory drops by one. Set ‘Needs Packaging’ while it is waiting, ‘Ready to Ship’ after packing, and ‘Shipped’ only after giving it to the carrier; then enter the tracking number."],
  Reviews: ["This is a private log of feedback you enter; it does not fetch, post, or reply to marketplace reviews. Save the buyer’s wording, rating, date, and optional public response. Link a review to a product or order when you can identify it. Keep any notes private to your tracker and avoid adding sensitive buyer information.", "Example: save the exact text ‘Beautifully made and arrived quickly,’ choose five stars, enter the posted date, link the earrings product, and paste your actual public reply if you wrote one."],
  Finances: ["This page summarizes recorded sales, refunds, marketplace fees, shipping, other income, and business expenses. Profit is an estimate based on the records you enter; it does not include labor, taxes, or unrecorded costs. Add expenses from receipts and enter actual order fees or final payouts when known. Compare totals with your marketplace statements.", "Example: record a $4.85 shipping label as an expense in ‘Shipping’ if you want it in business-expense totals. The order’s Shipping cost field also records shipping paid for that sale, so avoid entering the same cost twice."],
  Tasks: ["Tasks are action items with a category, priority, due date, and optional notes. Mark a task done only after the work is complete; change the due date if plans change. Open tasks past their due date are flagged as overdue. A task is not a calendar event or a work-time record, although the Calendar and Time pages can reference tasks.", "Example: add ‘Photograph the new earrings,’ category ‘Product work,’ priority Normal, due 12/02/2026. Add the smaller next step ‘Take front and detail photos’ in notes, then check it off after uploading the photos."],
  Calendar: ["The calendar automatically shows sale status history, discount start/end dates, and relisting plans. Filter sale stages such as Ready to Ship or Shipped, then filter discounts and relists by Planned or Done. Tasks, events, and work blocks you add are grouped under Schedules. Select a date to edit or remove its entries; the day schedule and Next up sections can be collapsed.", "Example: change an order to Shipped, edit that status date if needed, and the sale status appears on the chosen calendar date. Plan a discount and relisting on Listings; their start, end, and relist dates appear here and can be edited or removed."],
  Time: ["Clock in and out to keep a shift record, or run the focus timer for a single task. Add break minutes to subtract breaks from worked time. You may link one or more saved tasks and add a private note; linking a task does not complete it. Edit a saved session if you need to correct its date or times. Time is tracked on this device and is not a payroll system.", "Example: clock in at 09:00, link ‘Pack customer orders,’ take a 30-minute break, and clock out at 13:00. The recorded work time is 3.5 hours."],
  Production: ["Production turns a saved product recipe into an inventory transaction. Choose a product and enter a positive quantity; decimals are supported for items tracked by weight or volume. The app multiplies every recipe amount by that number, subtracts those component quantities, and adds the finished quantity to product inventory. Check the recipe units and available component stock first; this tracker does not place purchase orders for shortages.", "Example: one candle recipe uses 200 g wax and one wick. Recording 3 candles subtracts 600 g wax and 3 wicks, then adds 3 candles to finished inventory."],
  Reports: ["Reports summarize only the sales, inventory, fees, expenses, and other activity entered in this tracker. They are not connected to your shops, bank, tax service, or accounting software. Compare figures with source statements and correct missing or duplicated records before relying on a total. Profit uses saved product recipe costs and entered expenses; it does not estimate labor or taxes.", "Example: if the report says 12 orders and your marketplace statement says 13, find the missing sale in Orders before using the total in your monthly review."],
  Suppliers: ["Use this directory for the supplier or shop name, contact method, website, category, and your purchasing notes. Reuse the same supplier name on component and restock records so you can recognize the relationship. Notes can hold useful buying details such as minimum order, package size, or typical delivery time; this is not a purchase-order system.", "Example: add ‘Northside Bead Co.’ with its order email and website, then note ‘Minimum order $25; brass chain usually ships in 3–5 days.’ Use that same name when recording a clasp restock."],
  Settings: ["Business profile stores the shop name, display currency, and defaults. Theme and colors affect appearance; marketplace options control the channel choices in listings and orders. Fee rules are estimates: the percent applies to the item subtotal and the fixed amount is added once per order. Data and backups lets you copy backup text, restore it, clear business records, or perform a full factory reset. Records stay in this browser on this device; there is no login or cloud sync yet.", "Example: for an illustrative 6.5% fee plus $0.30 per order on a $40 sale, the estimate is $2.90 ($2.60 + $0.30), before any extra fee. These are sample numbers only, not a marketplace’s actual rates. Check the channel’s current fee schedule and enter its real rules."],
  "Help & FAQ": ["Search the guide for setup steps, supplier choices, purchase dates, backup and restore instructions, and answers about how tracker data is stored. Use the page links to jump straight to a feature.", "Example: search for ‘purchase date’ to learn how to enter the date on a restock, or search for ‘backup’ to copy a text backup and restore it later."],
  More: ["All pages lists every part of the business tracker. On a wide screen, the organized side panel keeps these pages visible; on a smaller screen, open Pages in the header. The page descriptions tell you what records each tool uses.", "Example: open Suppliers to save a supplier’s email, or choose Settings to change your profile, fee estimates, backups, and reset options."],
};

const FAQ_ITEMS = [
  { question: "Where is my information saved?", answer: "The tracker saves automatically in this browser on this device. It does not currently create an online account or sync records between browsers. A private window, browser reset, or different device may not have the same records.", tags: "data storage device browser account login sync" },
  { question: "How do I make a backup I can paste later?", answer: "Open Settings → Data and backups → Export backup. The app shows your backup as text. Choose Copy backup text and keep the copied text somewhere private that you can find again. You can also select and copy all the text in the box.", tags: "backup export copy text save paste" },
  { question: "How do I restore a text backup?", answer: "Open Settings → Data and backups → Restore backup, paste the complete backup text, and choose Restore. Review the confirmation first. The app saves a local recovery copy of the current tracker before replacing it.", tags: "restore import paste backup recovery" },
  { question: "Can I sign in and see the same data on another computer?", answer: "Not yet. A real sign-in needs a secure account and database service; GitHub Pages only hosts the website. Until cloud sync is connected, use the copyable backup text to move a copy between devices. Never put passwords or private records in the public code repository.", tags: "login sign in cloud sync another device account" },
  { question: "How do I add or change a supplier?", answer: "Open Components and add or edit a component or restock. Open its Supplier dropdown to choose a saved supplier, edit a supplier name, add one, or remove it from the choices. You can also manage contact details and notes on the Suppliers page.", tags: "supplier dropdown add edit delete components" },
  { question: "Can I enter the original date I bought supplies?", answer: "Yes. From Components, choose Restock and use Purchase date to select the actual date of that purchase. It can be an earlier date; it does not have to be today. The purchase history keeps that date.", tags: "purchase date restock bought earlier date" },
  { question: "Why did component inventory change after a sale?", answer: "Saving a restock increases component stock. Recording production uses the component quantities in the product recipe and increases finished product inventory. Recording a sale decreases finished product inventory. Review the Audit page and record details to see the history.", tags: "inventory stock materials production sale audit" },
  { question: "Does the tracker import orders or change my shop listings?", answer: "No. Enter sales and marketplace statistics manually. The tracker does not connect to Etsy, Shopify, or other stores, take payment, publish listings, buy shipping labels, or change prices on those sites.", tags: "orders marketplace imports payment etsy shopify listings" },
  { question: "Are profit and fee numbers exact?", answer: "They are estimates based on the records and fee rules you enter. They may not include labor, taxes, missing costs, or a marketplace's latest fees. Compare them with your statements and receipts.", tags: "profit fees finance taxes estimates" },
  { question: "What should I do before clearing or resetting the tracker?", answer: "Export and keep a text backup first. Clear business records keeps app preferences and makes a recovery copy. Factory reset removes local records and recovery copies from this browser, so only use it when you intend to start over.", tags: "clear reset delete recovery backup" },
  { question: "Why can’t I see the same data after switching browsers?", answer: "Each browser has its own local storage. The site address, browser profile, and device you used before matter. Open the old browser and export a backup, then paste it into Restore backup on the new one.", tags: "missing records browser profile computer local" },
  { question: "How do I find a page?", answer: "On a computer, use the organized side panel. On a smaller screen, choose Pages in the top bar. Help & FAQ is in the Support group, and the search field at the top of the page can find records within most sections.", tags: "navigation pages search help" },
];

function HelpModal({ visible, screen, onClose }) {
  const [instructions, example] = HELP_COPY[screen] || HELP_COPY.More;
  return <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <View style={styles.chooserBackdrop}><View style={styles.helpCard}>
      <View style={styles.cardTop}><Text style={styles.cardTitle}>{screen} help</Text><Pressable onPress={onClose}><Text style={styles.modalCancel}>Close</Text></Pressable></View>
      <Text style={styles.bodyText}>{instructions}</Text>
      <View style={styles.helpExample}><Text style={styles.fieldLabel}>Example</Text><Text style={styles.bodyText}>{example}</Text></View>
      <Action label="Got it" onPress={onClose} />
    </View></View>
  </Modal>;
}

const TUTORIAL_STEPS = [
  ["GRIMMS Business Tracker", "A practical workspace for handmade and small businesses. Keep materials, products, listings, sales, schedules, suppliers, and business finances organized in one place.", "Your saved records stay in this browser on this device. The guided tour and profile setup do not erase them. If you moved to a new phone or browser, choose Restore saved data and paste the backup text you kept."],
  ["Set up your shop profile", "Your business name, display currency, sales channels, and supplier names make the tracker match the way you work. You can change these later in Settings. The currency setting changes display only; it never converts saved amounts.", "Example: enter ‘Northside Studio,’ choose USD, add Etsy and In-person as channels, then add ‘Northside Bead Co.’ as a supplier. Keep each name consistent when recording listings and purchases."],
  ["Add supplies you actually have", "Create a Component for each raw material or supply. Enter the physical quantity, a consistent unit such as pieces or grams, your cost per unit when known, and the level that should trigger a low-stock reminder. Record new purchases with Restock so old and new quantities are combined correctly.", "Example: record 40 brass clasps on hand, unit ‘pieces,’ cost 0.18 each, and low-stock alert 10. When a pack of 100 arrives, add 100 with Restock; do not overwrite the count with 100."],
  ["Build a finished product and its recipe", "Create a Product for something ready to sell. Add the normal selling price, finished inventory, buyer-facing colors/materials, and packed parcel weight. If you want the app to track materials used during production, add each component and the amount needed for one unit to the recipe.", "Example: one bracelet uses 12 beads and 1 clasp. Set those recipe amounts, then record a production run of 3 bracelets; the tracker subtracts 36 beads and 3 clasps and adds 3 finished bracelets."],
  ["Record listings and promotions", "A Listing records the product page you maintain on one or more channels. Add the public URLs, status, price, and your planned live or relist dates. Add discount plans to see start/end reminders in the promotion calendar. These entries never publish the listing or change a sale on the marketplace; you must do those steps there.", "Example: select Etsy and Shopify for the listing, then plan 10% off from 12/02/2026 to 12/05/2026. Add the same discount in each marketplace yourself; the tracker keeps the dates and reminder."],
  ["Enter sales and fulfill them", "Orders are entered by you; they are not imported and the app does not take payment. Saving a sale reduces finished inventory. Fee estimates use your Settings rules until you enter the actual fee from the marketplace. Move fulfillment status as each real step is completed, and add tracking after buying a shipping label.", "Example: record one $28 necklace sold on Etsy. Pack it, move the status to Ready to Ship, purchase a label, add the carrier and tracking number, then mark Shipped after handing it over."],
  ["Review your records and protect them", "The dashboard highlights work that may need attention. Search and sort help find a record; Details shows its history. Reports and profit are estimates based on what you entered, so compare them against source statements. Export a backup regularly: this version stores unencrypted local records on this device and does not sync to an account or another device.", "Example: compare recorded monthly sales and fees with your Etsy statement, correct any missing order, then export a backup from Settings → Data and backups. Use the ? on any page for its step-by-step explanation."],
];

function TutorialModal({ visible, onClose, onOpenSettings, onRestoreBackup }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (visible) setStep(0); }, [visible]);
  const current = TUTORIAL_STEPS[step] || TUTORIAL_STEPS[0];
  const last = step === TUTORIAL_STEPS.length - 1;
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Skip</Text></Pressable><Text style={styles.modalTitle}>How to use the tracker</Text><Text style={styles.tutorialProgress}>{step + 1} of {TUTORIAL_STEPS.length}</Text></View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formHero}><Text style={styles.formHeroEyebrow}>GRIMMS BUSINESS TRACKER · PRACTICAL WALKTHROUGH</Text><Text style={styles.formHeroTitle}>{current[0]}</Text><Text style={styles.formHeroText}>{current[1]}</Text></View>
        <View style={styles.helpExample}><Text style={styles.fieldLabel}>Example</Text><Text style={styles.bodyText}>{current[2]}</Text></View>
        {step === 0 ? <View style={styles.onboardingPrivacy}><Text style={styles.fieldLabel}>Already have saved backup text?</Text><Text style={styles.bodyText}>Restore it here if you switched devices. Restoring first saves the tracker currently on this device as a recovery copy.</Text><View style={styles.actionRow}><Action label="Restore saved data" quiet onPress={onRestoreBackup} /></View></View> : null}
        <View style={styles.tutorialDots}>{TUTORIAL_STEPS.map((item, index) => <View key={item[0]} style={[styles.tutorialDot, index === step && styles.tutorialDotSelected]} />)}</View>
        <View style={styles.actionRow}>
          {step > 0 ? <Action label="Back" quiet onPress={() => setStep((value) => Math.max(0, value - 1))} /> : null}
          <Action label={last ? "Finish tour" : "Next"} onPress={() => last ? onClose() : setStep((value) => Math.min(TUTORIAL_STEPS.length - 1, value + 1))} />
        </View>
        {last ? <View style={styles.actionRow}><Action label="Open business settings" quiet onPress={onOpenSettings} /></View> : null}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

function useWelcomeEntrance(visible) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return undefined;
    progress.setValue(0);
    const animation = Animated.spring(progress, { toValue: 1, speed: 16, bounciness: 5, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [visible, progress]);
  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };
}

function splitSetupNames(value) {
  const names = String(value || "").split(/[\n,]+/).map((name) => name.trim()).filter(Boolean);
  return Array.from(new Map(names.map((name) => [name.toLocaleLowerCase(), name])).values());
}

function WelcomeSetupModal({ visible, db, onFinish, onSkip, onRestoreBackup }) {
  const animationStyle = useWelcomeEntrance(visible);
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [marketplaces, setMarketplaces] = useState("");
  const [supplierNames, setSupplierNames] = useState("");
  const [setupFeeRules, setSetupFeeRules] = useState({});
  const [showFeeSetup, setShowFeeSetup] = useState(false);
  const [feeSetupEnabled, setFeeSetupEnabled] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setBusinessName(db.businessName || "");
    setCurrency(db.currency || "USD");
    const isAlreadyConfigured = !!db.onboardingCompleted;
    setMarketplaces(isAlreadyConfigured ? ((db.dropdownOptions && db.dropdownOptions.marketplaces) || []).join("\n") : "");
    setSupplierNames(isAlreadyConfigured ? (db.suppliers || []).filter(active).map((supplier) => supplier.name).join("\n") : "");
    setSetupFeeRules(db.marketplaceFeeRules || {});
    setShowFeeSetup(false);
    setFeeSetupEnabled(false);
  }, [visible, db]);
  const profile = () => ({
    businessName: businessName.trim(),
    currency,
    marketplaces: splitSetupNames(marketplaces),
    supplierNames: splitSetupNames(supplierNames),
    marketplaceFeeRules: feeSetupEnabled ? setupFeeRules : {},
  });
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onSkip}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><View style={styles.modalHeaderSpacer} /><Text style={styles.modalTitle}>Welcome</Text><Pressable onPress={onSkip}><Text style={styles.modalCancel}>Skip</Text></Pressable></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.formHero, styles.onboardingHero, animationStyle]}>
            <Text style={styles.formHeroEyebrow}>WELCOME · FIRST SETUP</Text>
            <Text style={styles.formHeroTitle}>GRIMMS Business Tracker</Text>
            <Text style={styles.formHeroText}>A business workspace for handmade shops. Organize materials, products, listings, orders, finances, suppliers, and schedules in one place. Add a few names now; you can adjust every choice later in Settings.</Text>
          </Animated.View>
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Set up your shop</Text>
            <Text style={styles.formSectionText}>You can skip anything and change these details later.</Text>
            <Text style={styles.fieldLabel}>Your business profile</Text>
            <Field field={{ label: "Business name (optional)", placeholder: "Example: Northside Studio", explanation: "The shop name shown in your welcome screen and business profile. Example: ‘Northside Studio.’ This does not register a business or create a public shop page." }} value={businessName} onChange={setBusinessName} />
            <Field field={{ key: "currency", label: "Currency for displayed amounts", options: ["USD", "CAD", "GBP", "EUR", "AUD", "NZD", "MXN", "JPY", "INR"].map((code) => ({ label: code, value: code })) }} value={currency} onChange={setCurrency} />
          </View>
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Where do you sell?</Text>
            <Text style={styles.formSectionText}>Add one marketplace, shop, or sales channel per line. These names fill the channel choices on Listings and Orders; they do not connect or publish to those services. Example: Etsy, Shopify, In-person.</Text>
            <Field field={{ label: "Sales channels you use (optional)", multiline: true, placeholder: "Etsy\nShopify\nIn-person", explanation: "Enter each place where you sell on a separate line. You can include online marketplaces, your own site, local markets, or direct sales. Example: ‘Etsy’ and ‘In-person.’ The tracker only saves these names as choices; it does not link to your seller accounts." }} value={marketplaces} onChange={setMarketplaces} />
            <View style={styles.optionalFeeSetup}>
              <Text style={styles.fieldLabel}>Marketplace fee estimates (optional)</Text>
              <Text style={styles.fieldHint}>Add your percentage and flat order fee now to estimate take-home payouts. You can skip this and set it up later in Settings → Business profile → Marketplaces and fees.</Text>
              <View style={styles.actionRow}><Action label={showFeeSetup ? "Hide fee setup" : "Set fees now"} quiet onPress={() => { setShowFeeSetup(!showFeeSetup); setFeeSetupEnabled(true); }} /><Action label="Do this later" quiet onPress={() => { setShowFeeSetup(false); setFeeSetupEnabled(false); }} /></View>
              {showFeeSetup ? splitSetupNames(marketplaces).map((marketplace) => {
                const rule = setupFeeRules[marketplace] || {};
                return <View key={marketplace} style={styles.optionalFeeRow}><Text style={styles.recordTitle}>{marketplace}</Text><Field field={{ label: "Fee percentage", number: true, placeholder: "0" }} value={String(rule.percent == null ? "" : rule.percent)} onChange={(value) => setSetupFeeRules((old) => ({ ...old, [marketplace]: { ...(old[marketplace] || {}), percent: value } }))} /><Field field={{ label: "Flat fee per order", number: true, placeholder: "0.00" }} value={String(rule.fixed == null ? "" : rule.fixed)} onChange={(value) => setSetupFeeRules((old) => ({ ...old, [marketplace]: { ...(old[marketplace] || {}), fixed: value } }))} /></View>;
              }) : null}
            </View>
          </View>
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Who supplies your materials?</Text>
            <Text style={styles.formSectionText}>Supplier names are optional for now. You can add an email, website, minimum order, and purchasing notes later in Suppliers.</Text>
            <Field field={{ label: "Supplier names (optional)", multiline: true, placeholder: "Northside Bead Co.\nLocal fabric shop", explanation: "Enter one supplier or shop name per line. These create simple entries in your supplier directory, without contact details. Example: ‘Northside Bead Co.’ Add its email, website, and ordering notes later from Suppliers." }} value={supplierNames} onChange={setSupplierNames} />
          </View>
          <View style={styles.onboardingPrivacy}><Text style={styles.fieldLabel}>Your saved data stays safe</Text><Text style={styles.bodyText}>Profile setup and the tutorial do not erase saved records. This version keeps data in this browser on this device. If you switched phones or browsers, paste your saved backup text below; before replacing anything, GRIMMS saves the current tracker as a recovery copy.</Text><View style={styles.actionRow}><Action label="Restore saved data" quiet onPress={onRestoreBackup} /></View></View>
          <Action label="Save profile and open dashboard" onPress={() => onFinish(profile(), false)} />
          <View style={styles.actionRow}><Action label="Save profile and take the guided tour" quiet onPress={() => onFinish(profile(), true)} /><Action label="Skip setup for now" quiet onPress={onSkip} /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function WelcomeBackModal({ visible, db, onContinue, onRestoreBackup }) {
  const animationStyle = useWelcomeEntrance(visible);
  const openOrders = (db.orders || []).filter((order) => !order.refundedAt && !["Shipped", "In Transit", "Delivered to Customer", "Fulfilled"].includes(order.status)).length;
  const lowStockCount = (db.components || []).filter((item) => active(item) && Number(item.quantity) <= Number(item.lowStock)).length;
  const openTaskCount = (db.tasks || []).filter((task) => active(task) && !task.done).length;
  const businessName = String(db.businessName || "").trim();
  return <Modal visible={visible} animationType="fade" onRequestClose={onContinue}>
    <SafeAreaView style={styles.welcomeBackScreen}>
      <Animated.View style={[styles.welcomeBackCard, animationStyle]}>
        <View style={styles.welcomeBackMark}><Text style={styles.welcomeBackMarkText}>G</Text></View>
        <Text style={styles.formHeroEyebrow}>GRIMMS BUSINESS TRACKER</Text>
        <Text style={styles.welcomeBackTitle}>Welcome back{businessName ? ", " + businessName : ""}.</Text>
        <Text style={styles.bodyText}>Your tracker is ready on this device. Here’s a quick look at items that may need your attention.</Text>
        <View style={styles.welcomeBackStats}>
          <View style={styles.welcomeBackStat}><Text style={styles.welcomeBackNumber}>{openOrders}</Text><Text style={styles.welcomeBackLabel}>orders in progress</Text></View>
          <View style={styles.welcomeBackStat}><Text style={styles.welcomeBackNumber}>{lowStockCount}</Text><Text style={styles.welcomeBackLabel}>materials low</Text></View>
          <View style={styles.welcomeBackStat}><Text style={styles.welcomeBackNumber}>{openTaskCount}</Text><Text style={styles.welcomeBackLabel}>open tasks</Text></View>
        </View>
        <Text style={styles.fieldHint}>These counts come from records saved in this tracker; they are not live marketplace updates.</Text>
        <View style={styles.actionRow}><Action label="Restore saved data" quiet onPress={onRestoreBackup} /></View>
        <Pressable style={styles.primaryButtonFull} onPress={onContinue}><Text style={styles.primaryButtonFullText}>Continue to my dashboard</Text></Pressable>
      </Animated.View>
    </SafeAreaView>
  </Modal>;
}

function RecordDetailModal({ visible, type, record, currency, inventoryHistory = [], onClose, onEdit }) {
  if (!record) return null;
  const title = type === "order" ? (record.items || []).map((item) => item.productName).join(", ") || "Sale" : record.name || record.productName || record.title || "Record";
  const weight = record.packageWeight ? record.packageWeight + " " + (record.packageWeightUnit || "oz") : "";
  const details = [
    ["SKU", record.orderSku || record.listingSku || record.sku || (record.items || []).map((item) => item.productSku).filter(Boolean).join(", ")],
    ["Category", record.category], ["Colors", Array.isArray(record.colors) ? record.colors.join(", ") : record.colors],
    ["Materials", Array.isArray(record.materials) ? record.materials.join(", ") : record.materials],
    ["Sizes", Array.isArray(record.sizes) ? record.sizes.join(", ") : record.sizes], ["Audience or gender", record.gender],
    ["Product description", record.description || (!record.colors && !record.sizes && !record.gender ? record.materials : "")], ["Condition", record.condition],
    ["Price", record.price != null ? money(record.price, currency) : type === "order" ? money(totalOrder(record), currency) : ""],
    ["Inventory", record.inventory != null ? String(record.inventory) : ""], ["Final packaged weight", weight],
    ["Marketplace", record.marketplace || (record.marketplaces || []).join(", ")], ["Status", record.status],
    ["Listing live date", record.startDate ? dateLabel(record.startDate) : ""], ["Date", record.date ? dateLabel(record.date) : ""],
    ["Next relisting date", record.relistDate ? dateLabel(record.relistDate) : ""],
    ["Supplier", record.supplier], ["Listing URL", record.url],
    ["Recipe", (record.recipe || []).map((part) => part.quantity + " " + part.unit + " " + part.name).join(" · ")],
    ["Discount plans", (record.discountPlans || []).map((plan) => plan.percent + "% · " + dateLabel(plan.startDate)).join(" · ")],
    ["Unit cost", record.cost != null ? money(record.cost, currency) : ""],
    [record.feeSource === "actual" ? "Actual fees paid" : "Estimated fees", record.fees != null ? money(record.fees, currency) : ""],
    ["Extra fee estimate", record.extraFees != null ? money(record.extraFees, currency) : ""],
    ["Shipping paid", record.shippingCost != null ? money(record.shippingCost, currency) : ""],
    ["Payment / shipping", [record.paymentMethod, record.shippingMethod].filter(Boolean).join(" · ")], ["Tracking ID", record.trackingNumber], ["Carrier", record.trackingCarrier], ["Tracking link", record.trackingUrl],
  ].filter(([, value]) => value);
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.modalCancel}>Close</Text></Pressable><Text style={styles.modalTitle}>Details</Text>{type !== "order" || (!record.refundedAt && !(Number(record.refundAmount) > 0) && (record.items || []).length <= 1) ? <Pressable onPress={onEdit}><Text style={styles.modalSave}>Edit</Text></Pressable> : <View style={styles.modalHeaderSpacer} />}</View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.cardTitle}>{title}</Text>
        {details.map(([label, value]) => <View key={label} style={styles.detailLine}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
        {record.notes ? <View style={styles.helpExample}><Text style={styles.fieldLabel}>Notes and description</Text><Text style={styles.bodyText}>{record.notes}</Text></View> : null}
        {inventoryHistory.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Inventory change history</Text>{inventoryHistory.map((entry) => <View key={entry.id} style={styles.discountPlanRow}><View style={styles.flex}><Text style={styles.recordTitle}>{entry.kind} · {entry.quantity > 0 ? "+" : ""}{entry.quantity}{type === "component" ? ` ${record.unit || "units"}` : " units"}</Text><Text style={styles.recordMeta}>{dateLabel(entry.date)}{entry.note ? ` · ${entry.note}` : ""}</Text></View></View>)}</View> : null}
        {type === "order" && (record.timeline || []).length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Sale progress</Text>{record.timeline.map((step, index) => <View key={step.status + index} style={styles.discountPlanRow}><View style={styles.flex}><Text style={styles.recordTitle}>✓ {step.status}</Text><Text style={styles.recordMeta}>{dateLabel(step.date)}</Text></View></View>)}</View> : null}
        {type === "order" && record.refundHistory && record.refundHistory.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Refund and return history</Text>{record.refundHistory.map((entry) => <Text key={entry.id} style={styles.recordMeta}>{money(entry.amount, currency)} · {entry.returnedQuantity || 0} returned · {entry.restockQuantity || 0} restocked · {dateLabel(entry.date)}{entry.note ? ` · ${entry.note}` : ""}</Text>)}</View> : null}
        {type === "order" && record.auditLog && record.auditLog.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Corrections</Text>{record.auditLog.map((entry) => <Text key={entry.id} style={styles.recordMeta}>{entry.action} · {dateLabel(entry.date)}{entry.note ? ` · ${entry.note}` : ""}</Text>)}</View> : null}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SettingsAccordion({ title, subtitle, expanded, onPress, children }) {
  return <View style={styles.settingsAccordion}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.settingsAccordionHeader, pressed && styles.pressedState]}>
      <View style={styles.flex}><Text style={styles.settingsAccordionTitle}>{title}</Text>{subtitle ? <Text style={styles.settingsAccordionSubtitle}>{subtitle}</Text> : null}</View>
      <Text style={styles.settingsAccordionChevron}>{expanded ? "−" : "+"}</Text>
    </Pressable>
    {expanded ? <View style={styles.settingsAccordionContent}>{children}</View> : null}
  </View>;
}

function Pill({ text, tone }) {
  const colorStyle = tone === "green" ? styles.pillGreen : tone === "amber" ? styles.pillAmber : tone === "red" ? styles.pillRed : styles.pillNeutral;
  return <View style={[styles.pill, colorStyle]}><Text style={styles.pillText}>{text}</Text></View>;
}

function Action({ label, onPress, quiet }) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: COLORS.ripple }} style={({ pressed }) => [styles.actionButton, quiet && styles.actionQuiet, pressed && styles.pressedState]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, sub, color, compact }) {
  return (
    <View style={[styles.metric, compact && styles.metricCompact]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function ScreenDashboardHeader({ title, description, metrics = [], actions = [] }) {
  const { width } = useWindowDimensions();
  const compactMetrics = Platform.OS === "web" && width >= 900;
  return <Card style={styles.screenDashboardHeader}>
    <Text style={styles.screenDashboardTitle}>{title}</Text>
    {description ? <Text style={styles.bodyText}>{description}</Text> : null}
    {metrics.length ? <View style={[styles.metricGrid, compactMetrics && styles.metricGridCompact]}>{metrics.map((metric) => <Metric key={metric.label} {...metric} compact={compactMetrics} />)}</View> : null}
    {actions.length ? <View style={styles.actionRow}>{actions.map((action) => <Action key={action.label} label={action.label} onPress={action.onPress} quiet={action.quiet} />)}</View> : null}
  </Card>;
}

export default function App() {
  const { width: viewportWidth } = useWindowDimensions();
  const wideLayout = Platform.OS === "web" && viewportWidth >= 960;
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return undefined;
    const layoutStyle = document.createElement("style");
    layoutStyle.textContent = "html, body, #root { min-height: 100%; } html, body { margin: 0; } body { min-height: 100vh; } #root { display: flex; flex: 1; min-height: 100vh; }";
    document.head.appendChild(layoutStyle);
    return () => layoutStyle.remove();
  }, []);

  const [db, setDb] = useState(() => normalizeDatabase(EMPTY_DB));
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState("Dashboard");
  const [navigationStack, setNavigationStack] = useState(["Dashboard"]);
  const [modalType, setModalType] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [formPrefill, setFormPrefill] = useState(null);
  const [detailSelection, setDetailSelection] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [helpSearch, setHelpSearch] = useState("");
  const [helpExpandedFaq, setHelpExpandedFaq] = useState(0);
  const [helpExpandedGuide, setHelpExpandedGuide] = useState("");
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [expandedComponentIds, setExpandedComponentIds] = useState([]);
  const [expandedProductIds, setExpandedProductIds] = useState([]);
  const [expandedListingIds, setExpandedListingIds] = useState([]);
  const [showArchivedComponents, setShowArchivedComponents] = useState(false);
  const [showArchivedProducts, setShowArchivedProducts] = useState(false);
  const [showArchivedListings, setShowArchivedListings] = useState(false);
  const [componentCategoryFilter, setComponentCategoryFilter] = useState("All");
  const [productCategoryFilter, setProductCategoryFilter] = useState("All");
  const [attributeFilters, setAttributeFilters] = useState({ components: {}, products: {}, listings: {} });
  const [expandedAttributeFilters, setExpandedAttributeFilters] = useState({});
  const [listingStatusFilter, setListingStatusFilter] = useState("All");
  const [listingChannelFilter, setListingChannelFilter] = useState("All");
  const [analyticsRange, setAnalyticsRange] = useState("30 days");
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState(TODAY);
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState(TODAY);
  const [analyticsMarketplaceFilter, setAnalyticsMarketplaceFilter] = useState("All");
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState("All");
  const [analyticsStatusFilter, setAnalyticsStatusFilter] = useState("Active");
  const [analyticsRankMetric, setAnalyticsRankMetric] = useState("views");
  const [analyticsChartMetric, setAnalyticsChartMetric] = useState("views");
  const [analyticsExpandedListingId, setAnalyticsExpandedListingId] = useState("");
  const [analyticsEntryMode, setAnalyticsEntryMode] = useState("");
  const [analyticsEntryListingId, setAnalyticsEntryListingId] = useState("");
  const [analyticsEntryMarketplace, setAnalyticsEntryMarketplace] = useState("");
  const [analyticsEntryDate, setAnalyticsEntryDate] = useState(TODAY);
  const [analyticsEntryTime, setAnalyticsEntryTime] = useState(() => { const now = new Date(); return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"); });
  const [analyticsEntryMetrics, setAnalyticsEntryMetrics] = useState({});
  const [analyticsEntryNote, setAnalyticsEntryNote] = useState("");
  const [analyticsBulkRows, setAnalyticsBulkRows] = useState({});
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [inventoryHistoryExpanded, setInventoryHistoryExpanded] = useState(false);
  const [shiftTaskCreationMode, setShiftTaskCreationMode] = useState(false);
  const [financePeriod, setFinancePeriod] = useState("month");
  const [financeAnchor, setFinanceAnchor] = useState(TODAY);
  const [dashboardPeriod, setDashboardPeriod] = useState("month");
  const [dashboardAnchor, setDashboardAnchor] = useState(TODAY);
  const [auditType, setAuditType] = useState("Orders");
  const [expandedDashboardAttention, setExpandedDashboardAttention] = useState([]);
  const [expandedIdeaStatuses, setExpandedIdeaStatuses] = useState([]);
  const [showDismissedAttention, setShowDismissedAttention] = useState(false);
  const [search, setSearch] = useState("");
  const [recordPageLimits, setRecordPageLimits] = useState({});
  const [productionProduct, setProductionProduct] = useState("");
  const [productionQty, setProductionQty] = useState("1");
  const [backupText, setBackupText] = useState("");
  const [backupMode, setBackupMode] = useState("restore");
  const [backupPreview, setBackupPreview] = useState(null);
  const [backupFeedback, setBackupFeedback] = useState(null);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [backupRestoreComplete, setBackupRestoreComplete] = useState(false);
  const [customColorPicker, setCustomColorPicker] = useState("");
  const [customThemeSections, setCustomThemeSections] = useState({ surfaces: true, typography: false, accents: false, borders: false });
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [settingsSections, setSettingsSections] = useState({ profile: true, appearance: true, marketplaces: true, fees: false, widgets: false, options: false, data: false, archive: false, announcements: false });
  const [backupOpen, setBackupOpen] = useState(false);
  const [pendingRecordConfirmation, setPendingRecordConfirmation] = useState(null);
  const [recordActionNotice, setRecordActionNotice] = useState("");
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [factoryResetOpen, setFactoryResetOpen] = useState(false);
  const [factoryResetConfirmText, setFactoryResetConfirmText] = useState("");
  const [factoryResetting, setFactoryResetting] = useState(false);
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [retrySaveCount, setRetrySaveCount] = useState(0);
  const [storageLoadError, setStorageLoadError] = useState("");
  const [storageLoadNotice, setStorageLoadNotice] = useState("");
  const [storageRecoveryRaw, setStorageRecoveryRaw] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [currentDay, setCurrentDay] = useState(TODAY);
  const activeShiftId = db.activeShift ? db.activeShift.id : null;
  const activeTimerId = db.activeTimer ? db.activeTimer.id : null;
  useEffect(() => {
    setExpandedComponentIds([]);
    setExpandedProductIds([]);
    setExpandedListingIds([]);
    setExpandedOrderIds([]);
    setExpandedDashboardAttention([]);
    setExpandedIdeaStatuses(screen === "Ideas" ? ["Ideas"] : []);
    setInventoryHistoryExpanded(false);
    setShowDismissedAttention(false);
    setSettingsSections({ profile: screen === "Settings", appearance: false, marketplaces: false, fees: false, widgets: false, options: false, data: false, archive: false, announcements: false });
  }, [screen]);
  const navigateToScreen = (target) => {
    if (!target || target === screen) return;
    setNavigationStack((old) => old.concat([target]));
    setScreen(target);
  };
  const navigateBack = () => {
    if (navigationStack.length <= 1) return;
    const next = navigationStack.slice(0, -1);
    setNavigationStack(next);
    setScreen(next[next.length - 1] || "Dashboard");
  };
  const navigateRoot = (target) => {
    setNavigationStack([target]);
    setScreen(target);
  };
  const navigateToFulfillment = (status, viewType = "status") => {
    setShowArchivedOrders(false);
    setSearch("");
    navigateToScreen("Fulfillment:" + viewType + ":" + status);
  };
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [nextUpExpanded, setNextUpExpanded] = useState(false);
  const [selectedDateExpanded, setSelectedDateExpanded] = useState(true);
  const [calendarFiltersExpanded, setCalendarFiltersExpanded] = useState(false);
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState("All");
  const [calendarStatusFilter, setCalendarStatusFilter] = useState("All");
  const [calendarPlanStateFilter, setCalendarPlanStateFilter] = useState("All");
  const [timerLabel, setTimerLabel] = useState("");
  const [timerTaskIds, setTimerTaskIds] = useState([]);
  const [timerWorkNote, setTimerWorkNote] = useState("");
  const [shiftTaskIds, setShiftTaskIds] = useState([]);
  const [shiftWorkNote, setShiftWorkNote] = useState("");
  const [planRange, setPlanRange] = useState("week");
  const [planAnchor, setPlanAnchor] = useState(() => new Date());
  const [timeEdit, setTimeEdit] = useState(null);
  const [discountEditor, setDiscountEditor] = useState(null);
  const [relistEditor, setRelistEditor] = useState(null);
  const [timelineEditor, setTimelineEditor] = useState(null);
  const [refundEditor, setRefundEditor] = useState(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeBackOpen, setWelcomeBackOpen] = useState(false);
  const productionLock = useRef(false);
  const [productionSaving, setProductionSaving] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const saveRevisionRef = useRef(0);
  const saveTimerRef = useRef(null);
  const lastPersistedSnapshotRef = useRef(null);
  const lastRecoveryCheckpointAtRef = useRef(0);
  const skipInitialSaveRef = useRef(false);
  CURRENT_DATE_FORMAT = db.dateFormat || DEFAULT_DATE_FORMAT;
  const playButtonSound = useCallback(() => {}, []);

  useEffect(() => {
    let previousDay = TODAY;
    const refreshDay = () => {
      const todayKey = localDateKey(new Date());
      if (todayKey === previousDay) return;
      TODAY = todayKey;
      setCurrentDay(todayKey);
      setSelectedDay((selected) => selected === previousDay ? todayKey : selected);
      setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      setClockNow(Date.now());
      previousDay = todayKey;
    };
    const interval = setInterval(refreshDay, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    setReady(false);
    setStorageLoadError("");
    setStorageLoadNotice("");
    const openSavedTracker = async () => {
      let raw = null;
      try {
        raw = await AsyncStorage.getItem(STORAGE_KEY);
        let loaded = null;
        let recovered = false;
        if (raw) {
          try {
            // App-owned storage is normalized and migrated automatically. Strict
            // validation is reserved for imported backups, not everyday startup.
            loaded = parseLocalTracker(raw);
          } catch (primaryError) {
            try { await AsyncStorage.setItem(STORAGE_KEY + ".corrupt", raw); } catch (_error) { /* keep trying the recovery copy */ }
            const recoveryRaw = await AsyncStorage.getItem(STORAGE_KEY + ".recovery");
            if (!recoveryRaw) throw primaryError;
            loaded = parseLocalTracker(recoveryRaw);
            recovered = true;
            try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loaded)); } catch (_error) { /* show the recovered data even if storage is temporarily full */ }
          }
        } else {
          const recoveryRaw = await AsyncStorage.getItem(STORAGE_KEY + ".recovery");
          if (recoveryRaw) {
            try {
              loaded = parseLocalTracker(recoveryRaw);
              recovered = true;
              try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loaded)); } catch (_error) { /* the in-memory copy remains usable */ }
            } catch (_error) { loaded = null; }
          }
          if (!loaded) {
            loaded = normalizeDatabase(EMPTY_DB);
          }
        }
        if (!mounted) return;
        lastPersistedSnapshotRef.current = raw || null;
        lastRecoveryCheckpointAtRef.current = 0;
        skipInitialSaveRef.current = true;
        setStorageRecoveryRaw(recovered ? null : (raw || null));
        setThemeColors(loaded.themeName, loaded.customTheme);
        setDb(loaded);
        if (!loaded.onboardingCompleted) {
          setWelcomeOpen(true);
          setWelcomeBackOpen(false);
        } else if (raw || recovered) {
          setWelcomeBackOpen(true);
        }
        if (recovered) setStorageLoadNotice("Your tracker was reopened from its on-device recovery copy.");
      } catch (error) {
        if (!mounted) return;
        setStorageRecoveryRaw(raw);
        setStorageLoadError(error && error.message ? error.message : "The app could not read its saved tracker or its on-device recovery copy.");
      } finally {
        if (mounted) setReady(true);
      }
    };
    openSavedTracker();
    return () => { mounted = false; };
  }, [loadAttempt]);

  useEffect(() => {
    setClockNow(Date.now());
    const hasRunningClock = !!(activeShiftId || activeTimerId);
    const refreshMs = screen === "Time" ? (hasRunningClock ? 1000 : 60000)
      : screen === "Calendar" ? (hasRunningClock ? 5000 : 60000)
        : screen === "Dashboard" && hasRunningClock ? 15000
          : hasRunningClock ? 30000 : 60000;
    if (!hasRunningClock && screen !== "Time" && screen !== "Calendar") return undefined;
    const tick = setInterval(() => setClockNow(Date.now()), refreshMs);
    return () => clearInterval(tick);
  }, [screen, activeShiftId, activeTimerId]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const isEditable = (element) => !!(element && element.matches && element.matches("input, textarea, [contenteditable='true']"));
      const onFocusIn = (event) => {
        if (isEditable(event.target)) setKeyboardVisible(true);
      };
      const onFocusOut = () => {
        window.requestAnimationFrame(() => setKeyboardVisible(isEditable(document.activeElement)));
      };
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("focusout", onFocusOut);
      return () => {
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("focusout", onFocusOut);
      };
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);

  useEffect(() => {
    if (!ready || storageLoadError) return;
    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }
    const revision = ++saveRevisionRef.current;
    setSaving(true);
    setSaveError("");
    const timer = setTimeout(() => {
      saveTimerRef.current = null;
      let snapshot;
      try { snapshot = JSON.stringify(db); }
      catch (_error) {
        if (revision === saveRevisionRef.current) {
          setSaving(false);
          setSaveError("Could not prepare data for saving. Tap to retry.");
        }
        return;
      }
      const write = saveQueueRef.current.catch(() => {}).then(async () => {
        const previous = lastPersistedSnapshotRef.current;
        if (previous && previous !== snapshot && Date.now() - lastRecoveryCheckpointAtRef.current >= 5 * 60 * 1000) {
          let copyKey = STORAGE_KEY + ".corrupt";
          try {
            const parsed = JSON.parse(previous);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) copyKey = STORAGE_KEY + ".recovery";
          } catch (_error) { /* keep malformed bytes separate from the last good copy */ }
          try { await AsyncStorage.setItem(copyKey, previous); lastRecoveryCheckpointAtRef.current = Date.now(); } catch (_error) { /* saving the current tracker still takes priority */ }
        }
        await AsyncStorage.setItem(STORAGE_KEY, snapshot);
        lastPersistedSnapshotRef.current = snapshot;
      });
      saveQueueRef.current = write;
      write.then(() => {
        if (revision !== saveRevisionRef.current) return;
        setSaving(false);
        setSaveError("");
        setLastSavedAt(new Date());
      }).catch(() => {
        if (revision !== saveRevisionRef.current) return;
        setSaving(false);
        setSaveError("Could not save. Tap to retry.");
      });
    }, 350);
    saveTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (saveTimerRef.current === timer) saveTimerRef.current = null;
    };
  }, [db, ready, storageLoadError, retrySaveCount]);

  const totals = useMemo(() => calculateTotals(db), [db]);
  const lowStock = useMemo(() => db.components.filter((item) => active(item) && Number(item.quantity) <= Number(item.lowStock)), [db.components]);
  const openTasks = useMemo(() => db.tasks.filter((task) => active(task) && !task.done), [db.tasks]);
  const overdueTasks = useMemo(() => openTasks.filter((task) => task.dueDate && task.dueDate < currentDay), [openTasks, currentDay]);
  const fulfillmentStatuses = db.dropdownOptions && db.dropdownOptions.fulfillmentStatuses || DEFAULT_DROPDOWN_OPTIONS.fulfillmentStatuses;
  const timelineStatuses = useMemo(() => Array.from(new Set([
    ...fulfillmentStatuses,
    ...db.orders.flatMap((order) => (order.timeline || []).map((step) => step.status)),
    ...db.orders.map((order) => order.status),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [fulfillmentStatuses, db.orders]);
  const orderNeedsAttention = useMemo(() => db.orders.filter((order) => !order.archived && !order.refundedAt && order.status !== "Fulfilled" && order.status !== "Complete"), [db.orders]);
  const visibleProducts = useMemo(() => db.products.filter(active), [db.products]);
  const pageRows = (key, rows) => rows.slice(0, recordPageLimits[key] || RECORD_PAGE_SIZE);
  const showMoreRows = (key) => setRecordPageLimits((old) => ({ ...old, [key]: (old[key] || RECORD_PAGE_SIZE) + RECORD_PAGE_SIZE }));
  const setAttributeFilter = (group, key, value) => setAttributeFilters((old) => ({ ...old, [group]: { ...(old[group] || {}), [key]: value } }));
  const clearAttributeFilters = (group) => setAttributeFilters((old) => ({ ...old, [group]: {} }));
  const toggleAttributeFilters = (group) => setExpandedAttributeFilters((old) => ({ ...old, [group]: !old[group] }));
  const attributeFilterCount = (group) => Object.values(attributeFilters[group] || {}).filter((value) => value && value !== "All").length;

  const beginAdd = (type, prefill) => { setEditingRecord(null); setFormPrefill(prefill || null); setModalType(type); };
  const beginCreateShiftTask = () => { setShiftTaskCreationMode(true); beginAdd("task", { dueDate: db.activeShift ? db.activeShift.date : TODAY }); };
  const beginEdit = (type, record) => { setEditingRecord(record); setFormPrefill(null); setModalType(type); };
  const duplicateRecord = (type, record) => {
    const prefill = {
      ...record,
      name: "Copy of " + (record.name || "record"),
    };
    delete prefill.id;
    delete prefill.sku;
    delete prefill.createdAt;
    delete prefill.updatedAt;
    if (type === "component") {
      prefill.quantity = "0";
      prefill.lowStock = String(record.lowStock == null ? db.defaultLowStock : record.lowStock);
      prefill.cost = String(record.cost == null ? 0 : record.cost);
    } else if (type === "listing") {
      prefill.listingSku = "LIST-" + String(db.nextListingSku || 1).padStart(3, "0");
      prefill.status = "Draft";
      prefill.startDate = "";
      prefill.relistDate = "";
      prefill.discountPlans = [];
      prefill.archived = false;
      prefill.needsArchive = false;
    } else {
      prefill.inventory = "0";
      prefill.price = String(record.price == null ? 0 : record.price);
      prefill.recipe = (record.recipe || []).map((part) => ({ ...part, quantity: String(part.quantity) }));
      prefill.description = Array.from(new Set([record.description, record.notes].map((value) => String(value || "").trim()).filter(Boolean))).join("\n\n");
    }
    navigateToScreen(type === "component" ? "Components" : type === "listing" ? "Listings" : "Products");
    beginAdd(type, prefill);
  };
  const openDetails = (type, record) => setDetailSelection({ type, id: record.id, record });
  const toggleOrderExpanded = (orderId) => setExpandedOrderIds((old) => old.includes(orderId) ? old.filter((id) => id !== orderId) : old.concat(orderId));
  const closeForm = () => { setModalType(""); setEditingRecord(null); setFormPrefill(null); setShiftTaskCreationMode(false); };
  const setData = (recipe) => setDb((old) => {
    const updated = recipe(old);
    return updated && updated !== old ? updated : updated || old;
  });
  const requestRecordConfirmation = (confirmation) => setPendingRecordConfirmation(confirmation);
  const finishRecordConfirmation = () => {
    const confirmation = pendingRecordConfirmation;
    if (!confirmation) return;
    setPendingRecordConfirmation(null);
    try {
      confirmation.onConfirm();
      setRecordActionNotice(confirmation.successMessage || "Your change was applied. Check the save status in the top bar.");
    } catch (_error) {
      setRecordActionNotice("The change could not be completed. Your saved data was left as it was.");
    }
  };
  useEffect(() => {
    if (!recordActionNotice) return undefined;
    const timer = setTimeout(() => setRecordActionNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [recordActionNotice]);
  const readAnnouncementIds = Array.isArray(db.readAnnouncementIds) ? db.readAnnouncementIds : [];
  const dismissedAnnouncementIds = Array.isArray(db.dismissedAnnouncementIds) ? db.dismissedAnnouncementIds : [];
  const visibleAnnouncements = ANNOUNCEMENTS.filter((message) => !dismissedAnnouncementIds.includes(message.id));
  const unreadAnnouncementCount = visibleAnnouncements.filter((message) => !readAnnouncementIds.includes(message.id)).length;
  const markAnnouncementRead = (messageId) => setData((old) => ({
    ...old,
    readAnnouncementIds: Array.from(new Set((Array.isArray(old.readAnnouncementIds) ? old.readAnnouncementIds : []).concat(messageId))),
  }));
  const dismissAnnouncement = (messageId) => setData((old) => ({
    ...old,
    dismissedAnnouncementIds: Array.from(new Set((Array.isArray(old.dismissedAnnouncementIds) ? old.dismissedAnnouncementIds : []).concat(messageId))),
    readAnnouncementIds: Array.from(new Set((Array.isArray(old.readAnnouncementIds) ? old.readAnnouncementIds : []).concat(messageId))),
  }));
  const dismissAllAnnouncements = () => setData((old) => ({
    ...old,
    dismissedAnnouncementIds: Array.from(new Set((Array.isArray(old.dismissedAnnouncementIds) ? old.dismissedAnnouncementIds : []).concat(ANNOUNCEMENTS.map((message) => message.id)))),
    readAnnouncementIds: Array.from(new Set((Array.isArray(old.readAnnouncementIds) ? old.readAnnouncementIds : []).concat(ANNOUNCEMENTS.map((message) => message.id)))),
  }));
  const restoreAllAnnouncements = () => setData((old) => ({
    ...old,
    dismissedAnnouncementIds: [],
    readAnnouncementIds: (Array.isArray(old.readAnnouncementIds) ? old.readAnnouncementIds : []).filter((id) => !ANNOUNCEMENTS.some((message) => message.id === id)),
  }));
  const saveSortMode = (key, value) => setData((old) => ({ ...old, sortModes: { ...(old.sortModes || {}), [key]: value } }));
  const saveRecord = (type, values, record) => {
    const today = TODAY;
    const newRecordId = record ? record.id : uid(type);
    const attachTaskToShift = type === "task" && !record && shiftTaskCreationMode;
    let parsedRecipe = [];
    let productSku = "";
    let saleProduct = null;
    let saleListing = null;
    let saleQty = 0;
    if (type === "product") {
      productSku = normalizeProductSku(values.sku);
      if (!productSku) {
        Alert.alert("Product SKU required", "Enter a product SKU, or keep the suggested code.");
        return false;
      }
      const skuKey = productSku.toLowerCase();
      if (db.products.some((item) => item.id !== (record && record.id) && String(item.sku || "").trim().toLowerCase() === skuKey)) {
        Alert.alert("Product SKU already in use", "Each product needs a unique SKU. Choose a different code and save again.");
        return false;
      }
      const currentProduct = record && db.products.find((item) => item.id === record.id);
      const keepingCurrentSku = currentProduct && String(currentProduct.sku || "").trim().toLowerCase() === skuKey;
      if (!keepingCurrentSku && productSkuReferences(db).some((item) => String(item.sku || "").trim().toLowerCase() === skuKey && (!record || item.productId !== record.id))) {
        Alert.alert("Product SKU is reserved", "That SKU is still saved in a listing, sale, review, or production history. Use another code so those records stay connected.");
        return false;
      }
      parsedRecipe = (values.recipe || []).map((part) => {
        const component = db.components.find((item) => item.id === part.componentId && active(item));
        return component ? { componentId: component.id, sku: component.sku, name: component.name, quantity: asNumber(part.quantity, 0), unit: component.unit || "pieces", unitCost: Number(component.cost) || 0 } : null;
      });
      if (parsedRecipe.some((part) => !part || part.quantity <= 0)) { Alert.alert("Check the recipe", "Each recipe component needs an amount above zero."); return false; }
      const combinedRecipe = new Map();
      parsedRecipe.forEach((part) => {
        const existing = combinedRecipe.get(part.componentId);
        combinedRecipe.set(part.componentId, existing ? { ...existing, quantity: existing.quantity + part.quantity } : part);
      });
      parsedRecipe = Array.from(combinedRecipe.values());
      const previousRecipe = record ? (db.products.find((item) => item.id === record.id) || {}).recipe || [] : [];
      const recipeShortage = parsedRecipe.find((part) => {
        const previousQuantity = previousRecipe.filter((item) => item.componentId === part.componentId).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const component = db.components.find((item) => item.id === part.componentId && active(item));
        return component && part.quantity !== previousQuantity && part.quantity > (Number(component.quantity) || 0);
      });
      if (recipeShortage) {
        const component = db.components.find((item) => item.id === recipeShortage.componentId);
        Alert.alert("Not enough component stock for this recipe", "Each finished " + String(values.name || "product").trim() + " uses " + recipeShortage.quantity + " " + recipeShortage.unit + " of " + recipeShortage.name + ", but only " + (Number(component && component.quantity) || 0) + " " + recipeShortage.unit + " are in stock. Reduce the recipe amount or restock this component first.");
        return false;
      }
    }
    if (type === "restock") {
      const component = db.components.find((item) => item.id === values.componentId && active(item));
      const quantity = asNumber(values.quantity, 0);
      if (!component || quantity <= 0) { Alert.alert("Check this restock", "Choose a component and enter a quantity above zero."); return false; }
    }
    if (type === "listing") {
      const selected = db.products.find((x) => x.id === values.productId);
      if (!selected) { Alert.alert("Check this listing", "Choose an existing product for this listing."); return false; }
      if (!Array.isArray(values.marketplaces) || values.marketplaces.length === 0) { Alert.alert("Choose sales channels", "Select at least one place where you sell this listing."); return false; }
      const listingSku = String(values.listingSku || "").trim().toLowerCase();
      if (!listingSku || db.listings.some((item) => item.id !== (record && record.id) && String(item.listingSku || "").trim().toLowerCase() === listingSku)) { Alert.alert("Choose a unique listing SKU", "Each marketplace listing needs its own SKU. Check the code and try again."); return false; }
    }
    if (type === "order") {
      if (record && (record.items || []).length > 1) { Alert.alert("This sale has multiple products", "This version can safely edit one-product sales. Keep this order unchanged so its product lines and inventory history are preserved."); return false; }
      if (record && (record.refundedAt || Number(record.refundAmount) > 0)) { Alert.alert("This sale has a refund", "A sale with a recorded refund cannot be edited. Add another correction note or review the refund history instead."); return false; }
      const orderSku = String(values.orderSku || "").trim().toLowerCase();
      if (!orderSku || db.orders.some((item) => item.id !== record?.id && String(item.orderSku || "").trim().toLowerCase() === orderSku)) { Alert.alert("Choose a unique order SKU", "Each sale needs its own order code. Check the code and try again."); return false; }
      saleProduct = db.products.find((x) => x.id === values.productId && (active(x) || !!record));
      saleListing = values.listingId ? db.listings.find((item) => item.id === values.listingId && item.productId === values.productId) : null;
      if (values.listingId && !saleListing) { Alert.alert("Check the listing", "Choose a listing connected to the product in this sale, or clear the listing field."); return false; }
      const enteredQuantity = asNumber(values.quantity, 0);
      if (!Number.isFinite(enteredQuantity)) { Alert.alert("Check the sale quantity", "Enter a valid number for the quantity."); return false; }
      saleQty = enteredQuantity;
      if (!saleProduct || saleQty <= 0) { Alert.alert("Check this sale", "Choose an active product and enter a quantity above zero."); return false; }
      const quantityAlreadyOnThisSale = record ? (record.items || []).filter((item) => item.productId === saleProduct.id).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : 0;
      const availableForEdit = (Number(saleProduct.inventory) || 0) + quantityAlreadyOnThisSale;
      if (availableForEdit < saleQty) {
        Alert.alert("Not enough finished inventory", "There are " + availableForEdit + " available after accounting for the current sale. Record production or adjust inventory before saving.");
        return false;
      }
    }
    setDb((old) => {
      const next = { ...old };
      const isNew = !record;
      const update = (key, item) => {
        const list = (old[key] || []).slice();
        const index = list.findIndex((entry) => entry.id === (record && record.id));
        const timestamp = new Date().toISOString();
        if (index >= 0) {
          const before = list[index];
          const changes = Object.keys(item).filter((field) => field !== "auditLog" && JSON.stringify(before[field]) !== JSON.stringify(item[field])).map((field) => ({ field, from: before[field] == null ? null : before[field], to: item[field] == null ? null : item[field] }));
          const auditLog = (before.auditLog || []).concat(changes.length ? [{ id: uid("audit"), action: "Record updated", date: timestamp, changes }] : []);
          list[index] = { ...before, ...item, updatedAt: timestamp, auditLog };
        } else list.unshift({ id: newRecordId, createdAt: timestamp, auditLog: [{ id: uid("audit"), action: "Record created", date: timestamp, changes: [] }], ...item });
        next[key] = list;
      };
      if (type === "component") {
        const name = String(values.name || "").trim();
        const quantity = asNumber(values.quantity, 0);
        const cost = asNumber(values.cost, 0);
        const sku = record ? record.sku : "COMP-" + String(old.nextComponentSku || 1).padStart(3, "0");
        const componentId = record ? record.id : uid("component");
        if (isNew) next.nextComponentSku = (old.nextComponentSku || 1) + 1;
        const item = {
          id: componentId,
          name, sku, category: values.category || "Other", quantity: Math.max(0, quantity),
          unit: values.unit || "pieces", lowStock: Math.max(0, asNumber(values.lowStock, old.defaultLowStock || 3)),
          cost: Math.max(0, cost), supplier: values.supplier || "", notes: values.notes || "",
          colors: values.colors || "", materials: values.materials || "", sizes: values.sizes || "", gender: values.gender || "",
          images: record && record.images || [],
          archived: record ? !!record.archived : false,
        };
        const existing = record ? old.components.find((x) => x.id === record.id) : null;
        if (existing && Number(existing.quantity) !== item.quantity) {
          const delta = item.quantity - Number(existing.quantity);
          next.componentTransactions = (old.componentTransactions || []).concat([{
            id: uid("adjustment"), componentId: existing.id, quantity: delta, kind: "Manual adjustment",
            date: new Date().toISOString(), note: String(values.adjustmentNote || "Quantity changed while editing component").trim(),
          }]);
        } else if (!existing && item.quantity > 0) {
          next.componentTransactions = (old.componentTransactions || []).concat([{
            id: uid("opening"), componentId, quantity: item.quantity, kind: "Opening balance",
            date: new Date().toISOString(), note: "Starting component quantity",
          }]);
        }
        update("components", item);
      } else if (type === "restock") {
        const component = old.components.find((item) => item.id === values.componentId);
        const quantity = asNumber(values.quantity, 0);
        const hasPurchaseCost = String(values.purchaseCost == null ? "" : values.purchaseCost).trim() !== "";
        const hasShippingCost = String(values.shippingCost == null ? "" : values.shippingCost).trim() !== "";
        const purchaseCost = hasPurchaseCost ? Math.max(0, asNumber(values.purchaseCost, 0)) : null;
        const shippingCost = hasShippingCost ? Math.max(0, asNumber(values.shippingCost, 0)) : 0;
        const oldQuantity = Number(component.quantity) || 0;
        const oldUnitCost = Number(component.cost) || 0;
        const newQuantity = oldQuantity + quantity;
        const newUnitCost = newQuantity > 0
          ? ((oldQuantity * oldUnitCost) + (purchaseCost == null ? quantity * oldUnitCost : purchaseCost) + shippingCost) / newQuantity
          : oldUnitCost;
        next.components = old.components.map((item) => item.id === component.id
          ? { ...item, quantity: newQuantity, cost: Number(newUnitCost.toFixed(4)), supplier: values.supplier || item.supplier }
          : item);
        const purchaseId = uid("purchase");
        next.purchases = (old.purchases || []).concat([{
          id: purchaseId, componentId: component.id, componentName: component.name,
          quantity, purchaseCost, shippingCost, supplier: values.supplier || component.supplier || "",
          date: values.date || today, notes: values.notes || "", createdAt: new Date().toISOString(),
        }]);
        next.componentTransactions = (old.componentTransactions || []).concat([{
          id: uid("inventory"), componentId: component.id, quantity, kind: "Restock",
          date: new Date().toISOString(), note: "Purchase " + purchaseId,
        }]);
      } else if (type === "product") {
        const sku = record ? (productSku || record.sku) : (productSku || "PROD-" + String(firstAvailableProductSkuNumber(old)).padStart(3, "0"));
        const productId = record ? record.id : uid("product");
        const startingInventory = record ? Number((old.products.find((x) => x.id === record.id) || {}).inventory) || 0 : Math.max(0, asNumber(values.inventory, 0));
        update("products", {
          id: productId,
          name: String(values.name || "").trim(), sku, category: values.category || "Other",
          price: Math.max(0, asNumber(values.price, 0)),
          inventory: startingInventory,
          recipe: parsedRecipe, colors: values.colors || "", materials: values.materials || "", sizes: values.sizes || "", gender: values.gender || "",
          description: String(values.description || "").trim(), condition: values.condition || "Handmade",
          packageWeight: Math.max(0, asNumber(values.packageWeight, 0)), packageWeightUnit: values.packageWeightUnit || "oz",
          notes: String(values.description || "").trim(), images: record && record.images || [], archived: record ? !!record.archived : false,
          status: record ? record.status : "Available",
        });
        if (isNew && startingInventory > 0) next.productTransactions = (old.productTransactions || []).concat([{
          id: uid("opening"), productId, quantity: startingInventory, kind: "Opening balance", date: new Date().toISOString(), note: "Starting finished inventory",
        }]);
      } else if (type === "listing") {
        const product = old.products.find((x) => x.id === values.productId);
        const marketplaces = Array.isArray(values.marketplaces) ? values.marketplaces : (values.marketplace ? [values.marketplace] : []);
        const listingSku = String(values.listingSku || (record && record.listingSku) || ("LIST-" + String(old.nextListingSku || 1).padStart(3, "0"))).trim();
        const listingSkuMatch = listingSku.match(/^LIST-(\d+)$/i);
        next.nextListingSku = Math.max((old.nextListingSku || 1) + (record ? 0 : 1), listingSkuMatch ? Number(listingSkuMatch[1]) + 1 : 1);
        const requestedStatus = values.status || "Draft";
        const startDate = values.startDate || "";
        const listingStatus = requestedStatus === "Paused" ? "Paused" : startDate ? (startDate > today ? "Scheduled" : "Active") : requestedStatus;
        update("listings", {
          productId: product.id, productName: product.name, productSku: product.sku, listingSku,
          marketplaces, marketplace: marketplaces.join(", "), status: listingStatus, startDate,
          price: Math.max(0, asNumber(values.price, product.price)),
          colors: values.colors || "", materials: values.materials || "", sizes: values.sizes || "", gender: values.gender || "", condition: values.condition || "Handmade",
          packageWeight: Math.max(0, asNumber(values.packageWeight, product.packageWeight || 0)), packageWeightUnit: values.packageWeightUnit || product.packageWeightUnit || "oz",
          discountPlans: record ? (record.discountPlans || []) : [],
          relistDate: values.relistDate || "", relistDone: record && record.relistDate === (values.relistDate || "") ? !!record.relistDone : false,
          url: values.url || "",
          notes: values.notes || "", images: record && record.images || [], archived: record ? !!record.archived : false,
        });
      } else if (type === "review") {
        const product = old.products.find((item) => item.id === values.productId);
        const linkedOrder = old.orders.find((item) => item.id === values.orderId);
        update("reviews", {
          customer: String((linkedOrder && linkedOrder.customer) || values.customer || "").trim(), orderId: linkedOrder ? linkedOrder.id : "",
          orderReference: linkedOrder ? [linkedOrder.orderSku, (linkedOrder.items || []).map((item) => [item.productName, item.productSku, item.listingName, item.listingSku].filter(Boolean).join(" ").trim()).join(", "), linkedOrder.customer, dateLabel(linkedOrder.date)].filter(Boolean).join(" · ") : "",
          productId: product ? product.id : "", productName: product ? product.name : "",
          stars: Math.max(1, Math.min(5, Math.round(asNumber(values.stars, 5)))), platform: String(values.platform || "").trim(), date: values.date || today,
          reviewText: String(values.reviewText || "").trim(), publicResponse: String(values.publicResponse || "").trim(),
          notes: String(values.notes || "").trim(),
        });
      } else if (type === "order") {
        const product = saleProduct;
        const quantity = saleQty;
        const unitPrice = values.unitPrice === "" ? Number(saleListing && saleListing.price != null ? saleListing.price : product.price) || 0 : Math.max(0, asNumber(values.unitPrice, 0));
        const productCost = currentRecipeCost(product, old.components);
        const subtotal = unitPrice * quantity;
        const orderFeeRule = (old.marketplaceFeeRules || {})[values.marketplace || "Direct"] || {};
        const estimatedMarketplaceFees = Number((subtotal * Math.max(0, asNumber(orderFeeRule.percent, 0)) / 100 + Math.max(0, asNumber(orderFeeRule.fixed, 0))).toFixed(2));
        const extraFees = Math.max(0, asNumber(values.extraFees, 0));
        const hasActualFees = String(values.actualFees == null ? "" : values.actualFees).trim() !== "";
        const fees = hasActualFees ? Math.max(0, asNumber(values.actualFees, 0)) : estimatedMarketplaceFees + extraFees;
        const originalPrice = Number(saleListing && saleListing.price != null ? saleListing.price : product.price) || 0;
        const discountPercent = originalPrice > 0 ? Math.max(0, (originalPrice - unitPrice) / originalPrice * 100) : 0;
        const line = { productId: product.id, productName: product.name, productSku: product.sku, listingId: saleListing ? saleListing.id : "", listingName: saleListing ? saleListing.productName : "", listingSku: saleListing ? saleListing.listingSku : "", quantity, unitPrice, originalPrice, discountPercent, unitCost: productCost };
        const orderId = record ? record.id : uid("order");
        const previousQuantities = {};
        (record && record.items || []).forEach((item) => { previousQuantities[item.productId] = (previousQuantities[item.productId] || 0) + (Number(item.quantity) || 0); });
        const inventoryChanges = { ...previousQuantities, [product.id]: (previousQuantities[product.id] || 0) - quantity };
        const enteredOrderSku = String(values.orderSku || (record && record.orderSku) || ("ORDER-" + String(old.nextOrderSku || 1).padStart(3, "0"))).trim();
        const orderSkuMatch = enteredOrderSku.match(/^ORDER-(\d+)$/i);
        next.nextOrderSku = Math.max((old.nextOrderSku || 1) + (record ? 0 : 1), orderSkuMatch ? Number(orderSkuMatch[1]) + 1 : 1);
        const enteredAt = new Date().toISOString();
        const order = {
          ...(record || {}), id: orderId, orderSku: enteredOrderSku, createdAt: record ? record.createdAt : enteredAt, updatedAt: record ? enteredAt : null, date: values.date || today,
          items: [line], fees, feeSource: hasActualFees ? "actual" : "estimated", estimatedMarketplaceFees, extraFees,
          listingId: saleListing ? saleListing.id : "", listingName: saleListing ? saleListing.productName : "", listingSku: saleListing ? saleListing.listingSku : "",
          shippingCost: Math.max(0, asNumber(values.shippingCost, 0)),
          packageWeight: Math.max(0, asNumber(values.packageWeight, product.packageWeight || 0)), packageWeightUnit: values.packageWeightUnit || product.packageWeightUnit || "oz",
          marketplace: values.marketplace || "Direct", customer: values.customer || "",
          trackingNumber: String(values.trackingNumber || "").trim(), trackingCarrier: String(values.trackingCarrier || "").trim(), trackingUrl: String(values.trackingUrl || "").trim(),
          paymentMethod: values.paymentMethod || "", shippingMethod: values.shippingMethod || "", notes: values.notes || "",
          status: record ? record.status : old.dropdownOptions?.fulfillmentStatuses?.[0] || "Needs Packaging",
          timeline: record ? record.timeline || [] : [{ status: old.dropdownOptions?.fulfillmentStatuses?.[0] || "Needs Packaging", date: values.date || today, enteredAt }],
          auditLog: record ? record.auditLog || [] : [],
          refundedAt: record ? record.refundedAt || null : null, refundAmount: record ? Number(record.refundAmount) || 0 : 0,
          actualPayout: String(values.actualPayout == null ? "" : values.actualPayout).trim() === "" ? null : Math.max(0, asNumber(values.actualPayout, 0)),
        };
        if (record) {
          const changes = Object.keys(order).filter((field) => !["auditLog", "createdAt", "updatedAt"].includes(field) && JSON.stringify(record[field]) !== JSON.stringify(order[field])).map((field) => ({ field, from: record[field] == null ? null : record[field], to: order[field] == null ? null : order[field] }));
          if (changes.length) order.auditLog = (record.auditLog || []).concat([{ id: uid("edit"), action: "Sale details edited", date: new Date().toISOString(), changes }]);
        }
        next.orders = record ? old.orders.map((item) => item.id === order.id ? order : item) : [order, ...old.orders];
        next.products = old.products.map((item) => inventoryChanges[item.id]
          ? { ...item, inventory: (Number(item.inventory) || 0) + inventoryChanges[item.id] }
          : item);
        const remainingProductStock = (Number(product.inventory) || 0) + (inventoryChanges[product.id] || 0);
        if (saleQty > 0) {
          const now = new Date().toISOString();
          next.listings = old.listings.map((listing) => {
            if (listing.productId !== product.id || !active(listing)) return listing;
            if (remainingProductStock <= 0) {
              if (listing.needsArchive && listing.status === "Sold" && listing.soldOutOrderId === order.id) return listing;
              const previousStatus = listing.needsArchive ? listing.soldOutPreviousStatus || "Active" : listing.status || "Active";
              return { ...listing, status: "Sold", needsArchive: true, soldOutAt: today, soldOutOrderId: order.id, soldOutPreviousStatus: previousStatus, auditLog: (listing.auditLog || []).concat([{ id: uid("audit"), action: "Listing sold out", date: now, changes: [{ field: "status", from: listing.status || "Active", to: "Sold" }, { field: "needsArchive", from: !!listing.needsArchive, to: true }], note: "Finished inventory reached zero after " + order.orderSku }]) };
            }
            if (listing.soldOutOrderId === order.id) return { ...listing, status: listing.soldOutPreviousStatus || "Active", needsArchive: false, soldOutAt: null, soldOutOrderId: null, soldOutPreviousStatus: null, auditLog: (listing.auditLog || []).concat([{ id: uid("audit"), action: "Sold-out status cleared after sale correction", date: now, changes: [{ field: "status", from: "Sold", to: listing.soldOutPreviousStatus || "Active" }, { field: "needsArchive", from: true, to: false }] }]) };
            return listing;
          });
        }
        const inventoryTransaction = Object.entries(inventoryChanges).filter(([, amount]) => amount !== 0).map(([productId, amount]) => ({
          id: uid(record ? "saleedit" : "sale"), productId, quantity: amount, kind: record ? "Sale correction" : "Sale", orderId: order.id, date: new Date().toISOString(), note: order.marketplace,
        }));
        next.productTransactions = (old.productTransactions || []).concat(inventoryTransaction);
      } else if (type === "expense") {
        update("expenses", {
          description: String(values.description || "").trim(),
          amount: Math.max(0, asNumber(values.amount, 0)), category: values.category || "Other",
          expenseType: values.expenseType || "outOfPocket", date: values.date || today, notes: values.notes || "",
        });
      } else if (type === "income") {
        update("incomes", { description: String(values.description || "").trim(), amount: Math.max(0, asNumber(values.amount, 0)), category: String(values.category || "Other").trim(), date: values.date || today, notes: values.notes || "" });
      } else if (type === "task") {
        update("tasks", {
          title: String(values.title || "").trim(), dueDate: values.dueDate || today,
          category: values.category || "Other", priority: values.priority || "Normal", notes: values.notes || "",
          done: record ? !!record.done : false, completedAt: record ? record.completedAt || null : null, archived: record ? !!record.archived : false,
        });
      } else if (type === "event") {
        update("events", { title: String(values.title || "").trim(), date: values.date || today, kind: values.kind || "Business event", notes: values.notes || "", done: record ? !!record.done : false, completedAt: record ? record.completedAt || null : null, archived: record ? !!record.archived : false });
      } else if (type === "idea") {
        update("ideas", { title: String(values.title || "").trim(), category: values.category || "", status: values.status || "Ideas", notes: values.notes || "", archived: record ? !!record.archived : false });
      } else if (type === "supplier") {
        update("suppliers", { name: String(values.name || "").trim(), category: values.category || "Other", contact: values.contact || "", website: values.website || "", notes: values.notes || "", archived: record ? !!record.archived : false });
      } else if (type === "workPlan") {
        update("workPlans", { title: String(values.title || "").trim(), date: values.date || today, startTime: values.startTime, endTime: values.endTime, notes: values.notes || "", done: record ? !!record.done : false, completedAt: record ? record.completedAt || null : null });
      }
      return withCurrentSkuCounters(next);
    });
    if (attachTaskToShift) {
      if (db.activeShift) {
        setData((old) => {
          if (!old.activeShift) return old;
          const taskIds = Array.from(new Set([...(old.activeShift.taskIds || []), newRecordId]));
          return { ...old, activeShift: { ...old.activeShift, taskIds, taskTitles: taskTitlesFor(taskIds, old.tasks) } };
        });
      } else {
        setShiftTaskIds((old) => Array.from(new Set(old.concat([newRecordId]))));
      }
      setShiftTaskCreationMode(false);
    }
    closeForm();
    return true;
  };

  const archiveRecord = (key, record, label, alreadyConfirmed = false) => {
    const activeListings = key === "products" ? db.listings.filter((item) => item.productId === record.id && active(item)).length : 0;
    const recipeProducts = key === "components" ? db.products.filter((item) => active(item) && (item.recipe || []).some((part) => part.componentId === record.id)) : [];
    const message = activeListings
      ? "This keeps history, returns materials for any unsold finished units to component stock, and archives " + activeListings + " related listing" + (activeListings === 1 ? "" : "s") + ". Restoring the product will use those materials again."
      : key === "products" ? "This keeps history, returns materials for unsold finished units to component stock, and sets finished stock to zero. Restoring the product will use those materials again."
        : recipeProducts.length ? "This keeps its history and hides it from active lists. It is used by " + recipeProducts.map((item) => item.name).join(", ") + ". Production for those products will need this component restored or replaced in the recipe."
          : "This keeps its history and hides it from active lists.";
    const applyArchive = () => setData((old) => {
        if (key !== "products") {
          const now = new Date().toISOString();
          return { ...old, [key]: old[key].map((item) => item.id === record.id ? { ...item, archived: true, archivedAt: now, auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Record archived", date: now, changes: [{ field: "archived", from: !!item.archived, to: true }] }]) } : item) };
        }
        const product = old.products.find((item) => item.id === record.id);
        if (!product) return old;
        const unsoldUnits = Math.max(0, Number(product.inventory) || 0);
        const recipe = (product.recipe || []).map((part) => ({ ...part }));
        const restoredByComponent = {};
        recipe.forEach((part) => { restoredByComponent[part.componentId] = (restoredByComponent[part.componentId] || 0) + (Number(part.quantity) || 0) * unsoldUnits; });
        const now = new Date().toISOString();
        const components = old.components.map((component) => restoredByComponent[component.id]
          ? { ...component, quantity: (Number(component.quantity) || 0) + restoredByComponent[component.id] }
          : component);
        const componentTransactions = Object.entries(restoredByComponent).filter(([, quantity]) => quantity > 0).map(([componentId, quantity]) => ({ id: uid("archive-return"), componentId, quantity, kind: "Materials returned from archived product", productId: product.id, date: now, note: unsoldUnits + " unsold finished units returned to component stock" }));
        const listings = old.listings.map((listing) => listing.productId === product.id && active(listing)
          ? { ...listing, archived: true, archivedByProductId: product.id, archivedAt: now, auditLog: (listing.auditLog || []).concat([{ id: uid("audit"), action: "Listing archived with product", date: now, changes: [{ field: "archived", from: false, to: true }] }]) }
          : listing);
        return {
          ...old,
          components,
          listings,
          products: old.products.map((item) => item.id === product.id ? { ...item, archived: true, archivedAt: now, archivedInventory: unsoldUnits, archiveRecipeSnapshot: recipe, inventory: 0, auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Product archived", date: now, changes: [{ field: "archived", from: false, to: true }, { field: "inventory", from: unsoldUnits, to: 0 }] }]) } : item),
          componentTransactions: (old.componentTransactions || []).concat(componentTransactions),
          productTransactions: unsoldUnits > 0 ? (old.productTransactions || []).concat([{ id: uid("product-archive"), productId: product.id, quantity: -unsoldUnits, kind: "Product archived", date: now, note: "Returned unsold product materials to component stock" }]) : old.productTransactions || [],
        };
      });
    if (alreadyConfirmed) {
      applyArchive();
      return;
    }
    requestRecordConfirmation({
      title: "Archive " + label + "?",
      message,
      confirmLabel: "Archive",
      successMessage: label + " archived. You can restore it in Settings → Archived records.",
      onConfirm: applyArchive,
    });
  };

  const restoreRecord = (key, record) => {
    if (key !== "products") {
      const now = new Date().toISOString();
      setData((old) => ({ ...old, [key]: old[key].map((item) => item.id === record.id ? { ...item, archived: false, archivedAt: null, auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Record restored", date: now, changes: [{ field: "archived", from: true, to: false }] }]) } : item) }));
      return;
    }
    const archivedProduct = db.products.find((item) => item.id === record.id);
    if (!archivedProduct) return;
    const units = Math.max(0, Number(archivedProduct.archivedInventory) || 0);
    const recipe = archivedProduct.archiveRecipeSnapshot || archivedProduct.recipe || [];
    const needed = {};
    recipe.forEach((part) => { needed[part.componentId] = (needed[part.componentId] || 0) + (Number(part.quantity) || 0) * units; });
    const shortage = Object.entries(needed).find(([componentId, quantity]) => {
      const component = db.components.find((item) => item.id === componentId && active(item));
      return !component || (Number(component.quantity) || 0) < quantity;
    });
    if (shortage) {
      const component = db.components.find((item) => item.id === shortage[0]);
      const name = component ? component.name : "a required component";
      const available = component ? Number(component.quantity) || 0 : 0;
      Alert.alert("Not enough materials to restore", "Restoring " + archivedProduct.name + " needs " + shortage[1] + " units of " + name + ", but only " + available + " are available. Restock the component first.");
      return;
    }
    const now = new Date().toISOString();
    setData((old) => ({
      ...old,
      components: old.components.map((component) => needed[component.id] ? { ...component, quantity: (Number(component.quantity) || 0) - needed[component.id] } : component),
      products: old.products.map((item) => {
        if (item.id !== record.id) return item;
         const restored = { ...item, archived: false, archivedAt: null, inventory: units, auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Product restored", date: now, changes: [{ field: "archived", from: true, to: false }, { field: "inventory", from: 0, to: units }] }]) };
        delete restored.archivedInventory;
        delete restored.archiveRecipeSnapshot;
        return restored;
      }),
      listings: old.listings.map((listing) => listing.archivedByProductId === record.id ? { ...listing, archived: false, archivedAt: null, archivedByProductId: null, auditLog: (listing.auditLog || []).concat([{ id: uid("audit"), action: "Listing restored with product", date: now, changes: [{ field: "archived", from: true, to: false }] }]) } : listing),
      componentTransactions: (old.componentTransactions || []).concat(Object.entries(needed).filter(([, quantity]) => quantity > 0).map(([componentId, quantity]) => ({ id: uid("archive-use"), componentId, quantity: -quantity, kind: "Materials used to restore archived product", productId: record.id, date: now, note: units + " finished units restored" }))),
      productTransactions: units > 0 ? (old.productTransactions || []).concat([{ id: uid("product-restore"), productId: record.id, quantity: units, kind: "Product restored", date: now, note: "Materials deducted from component stock" }]) : old.productTransactions || [],
    }));
  };

  const permanentlyDeleteRecord = (key, record, label) => {
    if (key === "orders") {
      requestRecordConfirmation({
        title: "Delete this sale?",
        message: "This removes its income from totals, restores the units that were still deducted for this sale, and keeps a deleted copy in the audit history.",
        confirmLabel: "Delete sale",
        successMessage: "Sale deleted. Its history is still available on the Audit page.",
        onConfirm: () => setData((old) => {
          const order = old.orders.find((item) => item.id === record.id);
          if (!order) return old;
          const soldByProduct = {};
          (order.items || []).forEach((line) => { soldByProduct[line.productId] = (soldByProduct[line.productId] || 0) + (Number(line.quantity) || 0); });
          const alreadyRestocked = Number(order.restockedQuantity) || 0;
          const productIds = Object.keys(soldByProduct);
          if (productIds.length === 1) soldByProduct[productIds[0]] = Math.max(0, soldByProduct[productIds[0]] - alreadyRestocked);
          const now = new Date().toISOString();
          return {
            ...old,
            orders: old.orders.filter((item) => item.id !== order.id),
            deletedOrders: (old.deletedOrders || []).concat([{ ...order, deletedAt: now, deletionReason: "Deleted from Orders" }]),
            products: old.products.map((product) => soldByProduct[product.id] ? { ...product, inventory: (Number(product.inventory) || 0) + soldByProduct[product.id] } : product),
            listings: old.listings.map((listing) => listing.soldOutOrderId === order.id ? { ...listing, status: listing.soldOutPreviousStatus || "Active", needsArchive: false, soldOutAt: null, soldOutOrderId: null, soldOutPreviousStatus: null, auditLog: (listing.auditLog || []).concat([{ id: uid("audit"), action: "Sold-out status cleared after sale deletion", date: now, changes: [{ field: "status", from: "Sold", to: listing.soldOutPreviousStatus || "Active" }, { field: "needsArchive", from: true, to: false }] }]) } : listing),
            productTransactions: (old.productTransactions || []).concat(Object.entries(soldByProduct).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ id: uid("sale-delete"), productId, quantity, kind: "Sale deleted · inventory returned", orderId: order.id, date: now, note: order.orderSku || order.marketplace || "" }))),
          };
        }),
      });
      return;
    }
    const references = key === "products" ? [
      db.listings.some((item) => item.productId === record.id) && "marketplace listings",
      db.orders.some((order) => (order.items || []).some((item) => item.productId === record.id)) && "sale history",
      db.reviews.some((review) => review.productId === record.id) && "buyer reviews",
      db.productions.some((batch) => batch.productId === record.id) && "production batches",
    ].filter(Boolean) : key === "components" ? (() => {
      const sameSku = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
      const linkedByIdOrSku = (entry) => {
        const referenceSku = String(entry.componentSku || entry.sku || "").trim();
        return referenceSku ? sameSku(referenceSku, record.sku) : entry.componentId === record.id;
      };
      return [
        db.products.some((product) => (product.recipe || []).some((part) => linkedByIdOrSku(part))) && "product recipes",
        (db.componentTransactions || []).some((entry) => entry.kind !== "Opening balance" && linkedByIdOrSku(entry)) && "inventory history",
        (db.purchases || []).some((purchase) => linkedByIdOrSku(purchase)) && "purchase history",
      ].filter(Boolean);
    })() : [];
    if (references.length) {
      requestRecordConfirmation({
        title: "Archive this record instead?",
        message: `This ${label.toLowerCase()} is connected to ${references.join(", ")}. It cannot be permanently deleted without breaking those records. Archive it to hide it and keep its history.`,
        confirmLabel: "Archive",
        successMessage: label + " archived because it is linked to other records. You can restore it in Settings → Archived records.",
        onConfirm: () => archiveRecord(key, record, label, true),
      });
      return;
    }
    requestRecordConfirmation({
      title: "Permanently delete this " + label.toLowerCase() + "?",
      message: "This removes the record from this device and cannot be undone. Archived records can be restored until you delete them.",
      confirmLabel: "Delete permanently",
      successMessage: label + " deleted from this browser.",
      onConfirm: () => setData((old) => ({
        ...old,
        [key]: (old[key] || []).filter((item) => item.id !== record.id),
        ...(key === "components" ? {
          componentTransactions: (old.componentTransactions || []).filter((entry) => {
            const referenceSku = String(entry.componentSku || entry.sku || "").trim();
            const matchesComponent = referenceSku
              ? referenceSku.toLowerCase() === String(record.sku || "").trim().toLowerCase()
              : entry.componentId === record.id;
            return !(entry.kind === "Opening balance" && matchesComponent);
          }),
        } : {}),
      })),
    });
  };

  const completeTask = (task) => setData((old) => ({
    ...old, tasks: old.tasks.map((item) => item.id === task.id ? { ...item, done: !item.done, completedAt: item.done ? null : TODAY } : item),
  }));
  const completeWorkPlan = (plan) => setData((old) => ({
    ...old, workPlans: (old.workPlans || []).map((item) => item.id === plan.id ? { ...item, done: !item.done, completedAt: item.done ? null : TODAY } : item),
  }));
  const completeEvent = (event) => setData((old) => ({
    ...old, events: (old.events || []).map((item) => item.id === event.id ? { ...item, done: !item.done, completedAt: item.done ? null : TODAY } : item),
  }));

  const makeProduction = () => {
    if (productionLock.current) return;
    const enteredQuantity = asNumber(productionQty, 0);
    if (!Number.isFinite(enteredQuantity)) { Alert.alert("Check the batch quantity", "Enter a valid number for the quantity."); return; }
    const quantity = enteredQuantity;
    const product = db.products.find((item) => item.id === productionProduct && active(item));
    if (!product || quantity <= 0) { Alert.alert("Choose a product", "Select a product and enter a quantity above zero."); return; }
    const requirementsByComponent = new Map();
    (product.recipe || []).forEach((part) => {
      const component = db.components.find((item) => item.id === part.componentId);
      const existing = requirementsByComponent.get(part.componentId);
      const required = Number(part.quantity) * quantity;
      requirementsByComponent.set(part.componentId, existing
        ? { ...existing, required: existing.required + required }
        : { ...part, unitCost: Number(component ? component.cost : part.unitCost) || 0, required });
    });
    const requirements = Array.from(requirementsByComponent.values());
    const unavailable = requirements.find((part) => {
      const component = db.components.find((item) => item.id === part.componentId && active(item));
      return !component || Number(component.quantity) < part.required;
    });
    if (unavailable) {
      const component = db.components.find((item) => item.id === unavailable.componentId);
      Alert.alert("Not enough materials", "You need " + unavailable.required + " " + unavailable.unit + " of " + unavailable.name + " for this batch, but only " + (Number(component && component.quantity) || 0) + " are in stock. Restock this component or lower the batch quantity.");
      return;
    }
    productionLock.current = true;
    setProductionSaving(true);
    setDb((old) => {
      const batchId = uid("batch");
      const updatedComponents = old.components.map((component) => {
        const needed = requirements.find((part) => part.componentId === component.id);
        return needed ? { ...component, quantity: Number(component.quantity) - needed.required } : component;
      });
      const updatedProducts = old.products.map((item) => item.id === product.id ? { ...item, inventory: (Number(item.inventory) || 0) + quantity } : item);
      const transactions = requirements.map((part) => ({
        id: uid("usage"), batchId, componentId: part.componentId, quantity: -part.required,
        kind: "Production usage", date: new Date().toISOString(), productName: product.name,
      }));
      return {
        ...old, components: updatedComponents, products: updatedProducts,
        componentTransactions: (old.componentTransactions || []).concat(transactions),
        productTransactions: (old.productTransactions || []).concat([{
          id: uid("production"), productId: product.id, quantity, kind: "Production", date: new Date().toISOString(), note: "Batch " + batchId,
        }]),
        productions: [{ id: batchId, productId: product.id, productName: product.name, productSku: product.sku, quantity, date: new Date().toISOString(), recipeSnapshot: requirements }, ...old.productions],
      };
    });
    setProductionQty("1");
    setTimeout(() => { productionLock.current = false; setProductionSaving(false); }, 500);
    Alert.alert("Production recorded", quantity + " " + product.name + (quantity === 1 ? " added" : "s added") + " to finished inventory.");
  };

  const updateOrderStatus = (order) => {
    const current = fulfillmentStatuses.indexOf(order.status);
    const nextIndex = current < 0 ? 0 : current + 1;
    if (nextIndex >= fulfillmentStatuses.length) return;
    const nextStatus = fulfillmentStatuses[nextIndex];
    const enteredAt = new Date().toISOString();
    setData((old) => ({ ...old, orders: old.orders.map((item) => item.id === order.id ? { ...item, updatedAt: enteredAt, status: nextStatus, timeline: (item.timeline || []).concat([{ status: nextStatus, date: localDateKey(new Date(enteredAt)), enteredAt }]) } : item) }));
  };

  const setOrderStatus = (order, status) => {
    if (!status || status === order.status) return;
    const enteredAt = new Date().toISOString();
    setData((old) => ({ ...old, orders: old.orders.map((item) => item.id === order.id ? { ...item, updatedAt: enteredAt, status, timeline: (item.timeline || []).concat([{ status, date: localDateKey(new Date(enteredAt)), enteredAt }]) } : item) }));
  };

  const saveOrderNotes = (order, notes) => setData((old) => ({
    ...old, orders: old.orders.map((item) => item.id === order.id ? { ...item, notes } : item),
  }));

  const saveTimelineDate = (date, status) => {
    if (!timelineEditor) return;
    const { orderId, index } = timelineEditor;
    const normalizedDate = parseDateInput(date) || date;
    setData((old) => ({
      ...old,
      orders: old.orders.map((order) => order.id !== orderId ? order : {
        ...order,
        ...(index === (order.timeline || []).length - 1 ? { status: status || order.status, updatedAt: new Date().toISOString() } : {}),
        timeline: (order.timeline || []).map((step, stepIndex) => stepIndex === index ? { ...step, status: status || step.status, date: normalizedDate } : step),
      }),
    }));
    setSelectedDay(normalizedDate);
    const dateParts = normalizedDate.split("-").map(Number);
    if (dateParts.length === 3 && dateParts.every(Number.isFinite)) setCalendarMonth(new Date(dateParts[0], dateParts[1] - 1, 1));
    setTimelineEditor(null);
  };

  const saveOrderRefund = (order, values) => {
    const target = db.orders.find((item) => item.id === order.id);
    if (!target || target.refundedAt) { setRefundEditor(null); return; }
    const total = totalOrder(target);
    const currentRefund = Number(target.refundAmount) || 0;
    const refundAmount = Math.max(0, asNumber(values.amount, 0));
    const returnQuantity = Math.max(0, asNumber(values.returnedQuantity, 0));
    const restockQuantity = Math.max(0, asNumber(values.restockQuantity, 0));
    const totalQuantity = (target.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    if (refundAmount <= 0 || refundAmount > total - currentRefund + 0.01 || !Number.isFinite(returnQuantity) || returnQuantity > totalQuantity - (Number(target.returnedQuantity) || 0) || !Number.isFinite(restockQuantity) || restockQuantity > returnQuantity) {
      Alert.alert("Check refund details", "The amount or item quantities are outside the remaining sale balance.");
      return;
    }
    const productIds = Array.from(new Set((target.items || []).map((item) => item.productId).filter(Boolean)));
    if (restockQuantity > 0 && productIds.length !== 1) {
      Alert.alert("Choose a product for stock", "This sale contains more than one product. Record its refund first, then adjust each returned product's stock from its own inventory record.");
      return;
    }
    const productId = productIds[0];
    if (restockQuantity > 0 && !db.products.some((product) => product.id === productId)) {
      Alert.alert("Product not found", "The sale's product is no longer available, so the returned stock was not changed.");
      return;
    }
    const now = new Date().toISOString();
    const cumulativeRefund = currentRefund + refundAmount;
    const fullyRefunded = cumulativeRefund >= total - 0.01;
    const historyEntry = { id: uid("refund"), amount: refundAmount, returnedQuantity: returnQuantity, restockQuantity, note: values.note || "", date: now };
    setData((old) => ({
      ...old,
      products: restockQuantity ? old.products.map((product) => product.id === productId ? { ...product, inventory: (Number(product.inventory) || 0) + restockQuantity } : product) : old.products,
      listings: restockQuantity ? old.listings.map((listing) => listing.soldOutOrderId === target.id ? { ...listing, status: listing.soldOutPreviousStatus || "Active", needsArchive: false, soldOutAt: null, soldOutOrderId: null, soldOutPreviousStatus: null, auditLog: (listing.auditLog || []).concat([{ id: uid("audit"), action: "Listing stock restored after customer return", date: now, changes: [{ field: "status", from: "Sold", to: listing.soldOutPreviousStatus || "Active" }, { field: "needsArchive", from: true, to: false }] }]) } : listing) : old.listings,
      productTransactions: restockQuantity ? (old.productTransactions || []).concat([{
        id: uid("return"), productId, quantity: restockQuantity, kind: "Refund return", orderId: target.id, date: now, note: values.note || "Returned units marked safe to resell",
      }]) : old.productTransactions || [],
      orders: old.orders.map((item) => item.id !== target.id ? item : {
        ...item, status: fullyRefunded ? "Refunded" : "Partially refunded", refundedAt: fullyRefunded ? now : null,
        refundAmount: cumulativeRefund, returnedQuantity: (Number(item.returnedQuantity) || 0) + returnQuantity,
        restockedQuantity: (Number(item.restockedQuantity) || 0) + restockQuantity,
        refundHistory: (item.refundHistory || []).concat([historyEntry]),
        auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: fullyRefunded ? "Full refund recorded" : "Partial refund recorded", date: now, note: values.note || "" }]),
        updatedAt: now,
        timeline: (item.timeline || []).concat([{ status: fullyRefunded ? "Refunded" : "Partially refunded", date: localDateKey(new Date(now)), enteredAt: now }]),
      }),
    }));
    setRefundEditor(null);
  };

  const taskTitlesFor = (ids, tasks) => ids.map((id) => (tasks || db.tasks).find((task) => task.id === id)?.title).filter(Boolean);

  const updateActiveShiftTasks = (taskIds) => setData((old) => old.activeShift
    ? { ...old, activeShift: { ...old.activeShift, taskIds, taskTitles: taskTitlesFor(taskIds, old.tasks) } }
    : old);

  const clockIn = () => {
    setClockNow(Date.now());
    setData((old) => old.activeShift ? old : ({
      ...old,
      activeShift: {
        id: uid("shift"), clockIn: Date.now(), date: localDateKey(new Date()), breakMs: 0, breakStartedAt: null,
        taskIds: shiftTaskIds.slice(), taskTitles: taskTitlesFor(shiftTaskIds, old.tasks), workNote: shiftWorkNote.trim(),
      },
    }));
    setShiftTaskIds([]);
    setShiftWorkNote("");
  };

  const startBreak = () => setData((old) => old.activeShift && !old.activeShift.breakStartedAt
    ? { ...old, activeShift: { ...old.activeShift, breakStartedAt: Date.now() } }
    : old);

  const endBreak = () => setData((old) => {
    if (!old.activeShift || !old.activeShift.breakStartedAt) return old;
    return { ...old, activeShift: { ...old.activeShift, breakMs: (Number(old.activeShift.breakMs) || 0) + Date.now() - old.activeShift.breakStartedAt, breakStartedAt: null } };
  });

  const clockOut = () => setData((old) => {
    if (!old.activeShift) return old;
    const endedAt = Date.now();
    const breakMs = (Number(old.activeShift.breakMs) || 0) + (old.activeShift.breakStartedAt ? endedAt - old.activeShift.breakStartedAt : 0);
    const session = { ...old.activeShift, clockOut: endedAt, breakMs, durationMs: Math.max(0, endedAt - old.activeShift.clockIn - breakMs) };
    return { ...old, activeShift: null, timeSessions: [session, ...(old.timeSessions || [])] };
  });

  const startTimer = () => {
    if (db.activeTimer) { Alert.alert("A timer is already running", "Stop the active timer before starting another."); return; }
    const taskTitles = taskTitlesFor(timerTaskIds, db.tasks.filter(active));
    const label = String(timerLabel || taskTitles.join(", ") || "Focus session").trim();
    setData((old) => old.activeTimer ? old : ({ ...old, activeTimer: { id: uid("timer"), label, taskIds: timerTaskIds.slice(), taskTitles, workNote: timerWorkNote.trim(), startedAt: Date.now(), date: localDateKey(new Date()) } }));
    setTimerLabel("");
    setTimerTaskIds([]);
    setTimerWorkNote("");
  };

  const stopTimer = () => setData((old) => {
    if (!old.activeTimer) return old;
    const endedAt = Date.now();
    const session = { ...old.activeTimer, endedAt, durationMs: Math.max(0, endedAt - old.activeTimer.startedAt) };
    return { ...old, activeTimer: null, timerSessions: [session, ...(old.timerSessions || [])] };
  });

  const openTimeEditor = (mode, session) => setTimeEdit({ mode, session });

  const saveEditedTime = (updated) => {
    setData((old) => {
      if (updated.mode === "active") {
        if (!old.activeShift || old.activeShift.id !== updated.id) return old;
        return { ...old, activeShift: { ...old.activeShift, date: updated.date, clockIn: updated.clockIn, breakMs: updated.breakMs, taskIds: updated.taskIds, taskTitles: updated.taskTitles, workNote: updated.workNote } };
      }
      if (updated.mode === "timer") return { ...old, timerSessions: (old.timerSessions || []).map((session) => session.id === updated.id ? { ...session, date: updated.date, startedAt: updated.clockIn, endedAt: updated.clockOut, durationMs: updated.durationMs, taskIds: updated.taskIds, taskTitles: updated.taskTitles, workNote: updated.workNote, label: updated.label || "Focus session", editedAt: new Date().toISOString() } : session) };
      return { ...old, timeSessions: (old.timeSessions || []).map((session) => session.id === updated.id ? { ...session, date: updated.date, clockIn: updated.clockIn, clockOut: updated.clockOut, breakMs: updated.breakMs, durationMs: updated.durationMs, taskIds: updated.taskIds, taskTitles: updated.taskTitles, workNote: updated.workNote, editedAt: new Date().toISOString() } : session) };
    });
    setTimeEdit(null);
  };

  const deleteShiftSession = (session) => requestRecordConfirmation({
    title: "Delete this shift?", message: "The saved work time will be removed from your shift history and totals.", confirmLabel: "Delete shift", successMessage: "Shift deleted from your history.",
    onConfirm: () => setData((old) => ({ ...old, timeSessions: (old.timeSessions || []).filter((item) => item.id !== session.id) })),
  });
  const discardActiveShift = () => requestRecordConfirmation({
    title: "Delete this active shift?", message: "This discards the running shift without saving it to history.", confirmLabel: "Delete shift", successMessage: "The active shift was discarded.",
    onConfirm: () => setData((old) => old.activeShift ? { ...old, activeShift: null } : old),
  });
  const deleteTimerSession = (session) => requestRecordConfirmation({
    title: "Delete this timer record?", message: "The saved focus time will be removed from your history and totals.", confirmLabel: "Delete timer", successMessage: "Timer record deleted from your history.",
    onConfirm: () => setData((old) => ({ ...old, timerSessions: (old.timerSessions || []).filter((item) => item.id !== session.id) })),
  });
  const discardActiveTimer = () => requestRecordConfirmation({
    title: "Discard this running timer?", message: "The active timer will stop without saving a focus session.", confirmLabel: "Discard timer", successMessage: "The active timer was discarded.",
    onConfirm: () => setData((old) => ({ ...old, activeTimer: null })),
  });

  const openDiscountEditor = (listing, plan) => setDiscountEditor({ listingId: listing.id, plan: plan || null });

  const saveDiscountPlan = (plan) => {
    if (!discountEditor) return;
    const { listingId } = discountEditor;
    setData((old) => ({
      ...old,
      listings: old.listings.map((listing) => {
        if (listing.id !== listingId) return listing;
        const currentPlans = listing.discountPlans || [];
        const previous = currentPlans.find((item) => item.id === plan.id);
        const exists = !!previous;
        const changes = Object.keys(plan).filter((field) => JSON.stringify(previous && previous[field]) !== JSON.stringify(plan[field])).map((field) => ({ field: "discount " + field, from: previous ? previous[field] : null, to: plan[field] }));
        const now = new Date().toISOString();
        const savedPlan = { ...(previous || {}), ...plan, startDone: previous ? !!previous.startDone : false, endDone: previous ? !!previous.endDone : false };
        return { ...listing, discountPlans: exists ? currentPlans.map((item) => item.id === plan.id ? savedPlan : item) : currentPlans.concat([savedPlan]), auditLog: (listing.auditLog || []).concat([{ id: uid("audit"), action: exists ? "Discount plan updated" : "Discount plan added", date: now, changes }]) };
      }),
    }));
    setDiscountEditor(null);
  };

  const saveRelist = (values) => {
    if (!relistEditor) return;
    const listing = db.listings.find((item) => item.id === relistEditor.id);
    if (!listing) { setRelistEditor(null); return; }
    const now = new Date().toISOString();
    setData((old) => ({
      ...old,
      listings: old.listings.map((item) => item.id !== listing.id ? item : {
        ...item,
        price: values.price,
        packageWeight: values.packageWeight,
        packageWeightUnit: values.packageWeightUnit,
        startDate: TODAY,
        status: "Active",
        relistDate: "", relistDone: false,
        needsArchive: false,
        soldOutAt: null,
        soldOutOrderId: null,
        soldOutPreviousStatus: null,
         relistHistory: (item.relistHistory || []).concat([{ id: uid("relist"), date: TODAY, previousStartDate: item.startDate || "", previousPrice: item.price, newPrice: values.price, packageWeight: values.packageWeight, packageWeightUnit: values.packageWeightUnit, note: values.changesNote || "", timestamp: now }]),
         auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Listing relisted", date: now, note: values.changesNote || "", changes: [{ field: "startDate", from: item.startDate || "", to: TODAY }, { field: "price", from: item.price, to: values.price }, { field: "packageWeight", from: item.packageWeight, to: values.packageWeight }, { field: "packageWeightUnit", from: item.packageWeightUnit, to: values.packageWeightUnit }] }]),
      }),
    }));
    setRelistEditor(null);
    Alert.alert("Relist saved", "The listing’s active days have restarted from today. Keep marketplace inventory and listing details in sync there too.");
  };

  const deleteDiscountPlan = (listing, plan) => requestRecordConfirmation({
    title: "Delete this discount plan?", message: "The saved promotion dates and discount will be removed.", confirmLabel: "Delete plan", successMessage: "Discount plan deleted.",
    onConfirm: () => setData((old) => {
      const now = new Date().toISOString();
      return { ...old, listings: old.listings.map((item) => item.id === listing.id ? { ...item, discountPlans: (item.discountPlans || []).filter((current) => current.id !== plan.id), auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Discount plan deleted", date: now, changes: [{ field: "discount plan", from: plan, to: null }] }]) } : item) };
    }),
  });

  const clearRelistDate = (listing) => requestRecordConfirmation({
    title: "Delete this planned relisting?", message: "Only the reminder date will be removed. The listing and its relisting history will stay saved.", confirmLabel: "Delete relisting", successMessage: "Relisting reminder deleted. The listing remains saved.",
    onConfirm: () => setData((old) => ({ ...old, listings: old.listings.map((item) => item.id === listing.id ? { ...item, relistDate: "", relistDone: false, auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Relisting plan deleted", date: new Date().toISOString(), changes: [{ field: "relistDate", from: item.relistDate || "", to: "" }] }]) } : item) })),
  });

  const deleteRelistHistoryEntry = (listing, entry) => requestRecordConfirmation({
    title: "Delete this relisting record?", message: "This removes the selected relisting from this listing’s history.", confirmLabel: "Delete relisting", successMessage: "Relisting history entry deleted.",
    onConfirm: () => setData((old) => ({ ...old, listings: old.listings.map((item) => item.id === listing.id ? { ...item, relistHistory: (item.relistHistory || []).filter((saved) => saved.id !== entry.id), auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Relisting history entry deleted", date: new Date().toISOString(), note: dateLabel(entry.date) }]) } : item) })),
  });

  const deleteOrderTimelineStep = (order, index) => requestRecordConfirmation({
    title: "Delete this order history entry?", message: "The order’s current status will follow the last remaining history entry.", confirmLabel: "Delete entry", successMessage: "Order history entry deleted.",
    onConfirm: () => setData((old) => ({ ...old, orders: old.orders.map((item) => {
      if (item.id !== order.id) return item;
      const timeline = (item.timeline || []).filter((_step, stepIndex) => stepIndex !== index);
      const latest = timeline[timeline.length - 1];
      return { ...item, timeline, status: latest ? latest.status : (old.dropdownOptions?.fulfillmentStatuses?.[0] || "Needs Packaging") };
    }) })),
  });

  const saveDropdownOption = (key, index, draft, selectedValue, onChange, originalValue) => {
    const value = String(draft || "").trim();
    if (!value) { Alert.alert("Add an option name", "Dropdown options cannot be blank."); return false; }
    const options = db.dropdownOptions[key] || [];
    if (options.some((item, optionIndex) => item.toLowerCase() === value.toLowerCase() && optionIndex !== index)) {
      Alert.alert("That option already exists", "Use a different name for each dropdown option."); return false;
    }
    const updated = options.slice();
    if (index == null) updated.push(value);
    else updated[index] = value;
    setData((old) => {
      const renameMarketplace = key === "marketplaces" && index != null && options[index] !== value;
      const attributeField = DROPDOWN_ATTRIBUTE_FIELDS[key];
      const renameAttribute = !!attributeField && index != null && options[index] !== value;
      const marketplaceFeeRules = { ...(old.marketplaceFeeRules || {}) };
      if (renameMarketplace) {
        if (!marketplaceFeeRules[value]) marketplaceFeeRules[value] = marketplaceFeeRules[options[index]] || { percent: 0, fixed: 0 };
        delete marketplaceFeeRules[options[index]];
      } else if (key === "marketplaces" && !marketplaceFeeRules[value]) {
        marketplaceFeeRules[value] = { percent: 0, fixed: 0 };
      }
      const renamedListings = renameMarketplace ? old.listings.map((listing) => {
        const originalChannels = listing.marketplaces || (listing.marketplace ? [listing.marketplace] : []);
        if (!originalChannels.includes(options[index])) return listing;
        const channels = originalChannels.map((channel) => channel === options[index] ? value : channel);
        return { ...listing, marketplaces: channels, marketplace: channels.join(", ") };
      }) : old.listings;
      const renamedOrders = renameMarketplace ? old.orders.map((order) => order.marketplace === options[index] ? { ...order, marketplace: value } : order) : old.orders;
      const renameSavedAttribute = (rows) => (rows || []).map((record) => {
        const original = record[attributeField];
        const selected = Array.isArray(original) ? original : String(original || "").split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
        if (!selected.includes(options[index])) return record;
        const renamed = selected.map((item) => item === options[index] ? value : item);
        return { ...record, [attributeField]: Array.isArray(original) ? Array.from(new Set(renamed)) : Array.from(new Set(renamed)).join(", ") };
      });
      return { ...old, dropdownOptions: { ...old.dropdownOptions, [key]: updated },
        ...(key === "marketplaces" ? { marketplaceFeeRules } : {}),
        ...(renameMarketplace ? { listings: renamedListings, orders: renamedOrders } : {}),
        ...(renameAttribute ? { components: renameSavedAttribute(old.components), products: renameSavedAttribute(old.products), listings: renameSavedAttribute(old.listings) } : {}),
        ...(key === "taskPriorities" && index != null && old.defaultTaskPriority === options[index] ? { defaultTaskPriority: value } : {}),
        ...(key === "eventTypes" && index != null && old.defaultEventType === options[index] ? { defaultEventType: value } : {}),
      };
    });
    if (onChange && Array.isArray(selectedValue)) {
      const oldValue = originalValue === undefined ? options[index] : originalValue;
      const nextSelection = index == null
        ? Array.from(new Set(selectedValue.concat([value])))
        : selectedValue.map((item) => item === oldValue ? value : item);
      onChange(nextSelection);
    } else if (onChange && (index == null || options[index] === selectedValue)) {
      onChange(value);
    }
    return true;
  };

  const deleteDropdownOption = (key, index, selectedValue, onChange) => {
    const options = db.dropdownOptions[key] || [];
    if (options.length <= 1) { Alert.alert("Keep one option", "Each dropdown needs at least one choice."); return false; }
    const updated = options.filter((_item, itemIndex) => itemIndex !== index);
    requestRecordConfirmation({
      title: "Remove this dropdown choice?",
      message: "“" + options[index] + "” will no longer be offered in forms. Existing records keep their saved value.",
      confirmLabel: "Remove choice",
      successMessage: "Dropdown choice removed. Existing records were kept.",
      onConfirm: () => {
        setData((old) => {
          const marketplaceFeeRules = { ...(old.marketplaceFeeRules || {}) };
          if (key === "marketplaces") delete marketplaceFeeRules[options[index]];
          return { ...old, dropdownOptions: { ...old.dropdownOptions, [key]: updated },
            ...(key === "marketplaces" ? { marketplaceFeeRules } : {}),
            ...(key === "taskPriorities" && old.defaultTaskPriority === options[index] ? { defaultTaskPriority: updated[0] } : {}),
            ...(key === "eventTypes" && old.defaultEventType === options[index] ? { defaultEventType: updated[0] } : {}),
          };
        });
        if (onChange && Array.isArray(selectedValue)) onChange(selectedValue.filter((item) => item !== options[index]));
        else if (onChange && options[index] === selectedValue) onChange(updated[0] || "");
      },
    });
    return true;
  };

  const manageDropdownFromField = (action, key, index, selectedValue, onChange, draft, originalValue) => {
    if (key === "suppliers") {
      const suppliers = (db.suppliers || []).filter(active);
      const supplier = index == null ? null : suppliers[index];
      if (action === "save") {
        const value = String(draft || "").trim();
        if (!value) { Alert.alert("Add a supplier name", "Supplier names cannot be blank."); return false; }
        if (suppliers.some((item, itemIndex) => item.name.toLowerCase() === value.toLowerCase() && itemIndex !== index)) {
          Alert.alert("That supplier already exists", "Choose a different name or edit the existing supplier."); return false;
        }
        const oldName = supplier ? supplier.name : "";
        setData((old) => ({
          ...old,
          suppliers: supplier
            ? old.suppliers.map((item) => item.id === supplier.id ? { ...item, name: value, updatedAt: new Date().toISOString() } : item)
            : [{ id: uid("supplier"), name: value, category: "Other", contact: "", website: "", notes: "", archived: false, createdAt: new Date().toISOString() }, ...old.suppliers],
          ...(supplier && oldName !== value ? {
            components: old.components.map((item) => item.supplier === oldName ? { ...item, supplier: value } : item),
            purchases: (old.purchases || []).map((item) => item.supplier === oldName ? { ...item, supplier: value } : item),
          } : {}),
        }));
        if (onChange && (index == null || selectedValue === oldName)) onChange(value);
        return true;
      }
      if (action === "delete" && supplier) {
        requestRecordConfirmation({
          title: "Remove this supplier?",
          message: "The supplier will be removed from dropdown choices. Existing component and purchase records keep the supplier name.",
          confirmLabel: "Remove supplier",
          successMessage: supplier.name + " removed from supplier choices. Existing records are kept.",
          onConfirm: () => {
            setData((old) => ({ ...old, suppliers: old.suppliers.filter((item) => item.id !== supplier.id) }));
            if (onChange && selectedValue === supplier.name) onChange("");
          },
        });
        return true;
      }
      return false;
    }
    if (action === "save") return saveDropdownOption(key, index, draft, selectedValue, onChange, originalValue);
    if (action === "delete") {
      return deleteDropdownOption(key, index, selectedValue, onChange);
    }
    return false;
  };

  const deleteWorkPlan = (plan) => requestRecordConfirmation({
    title: "Delete this work block?", message: "This removes the planned work block from your schedule.", confirmLabel: "Delete work block", successMessage: "Work block deleted from your schedule.",
    onConfirm: () => setData((old) => ({ ...old, workPlans: (old.workPlans || []).filter((item) => item.id !== plan.id) })),
  });

  const saveSettings = (key, value) => setData((old) => ({ ...old, [key]: value }));
  const saveMarketplaceFeeRule = (marketplace, field, value) => setData((old) => ({
    ...old,
    marketplaceFeeRules: {
      ...(old.marketplaceFeeRules || {}),
      [marketplace]: { ...((old.marketplaceFeeRules || {})[marketplace] || {}), [field]: Math.max(0, asNumber(value, 0)) },
    },
  }));
  const chooseTheme = (name) => {
    if (name === CUSTOM_THEME_NAME) {
  const activeTheme = db.themeName === CUSTOM_THEME_NAME ? null : THEMES.find((theme) => theme.name === db.themeName) || DEFAULT_THEME;
      const sourceColors = activeTheme ? activeTheme.colors : makeCustomThemeColors(db.customTheme);
      const customTheme = customThemeFromColors(sourceColors, activeTheme ? activeTheme.mode : (db.customTheme || DEFAULT_CUSTOM_THEME).mode || "dark");
      setThemeColors(CUSTOM_THEME_NAME, customTheme);
      setData((old) => ({ ...old, themeName: CUSTOM_THEME_NAME, customTheme }));
      return;
    }
    setThemeColors(name, db.customTheme);
    saveSettings("themeName", name);
  };
  const saveCustomThemeColor = (key, value) => {
    let customTheme = { ...DEFAULT_CUSTOM_THEME, ...(db.customTheme || {}), [key]: value };
    if (key === "mode") {
      // Changing the base mode also resets the surface/text defaults so a dark
      // palette cannot accidentally leave white text on a white background.
      const base = makeThemeColors(DEFAULT_THEME_SPEC, value === "dark");
      customTheme = { ...customTheme, ...customThemeFromColors(base, value), mode: value, accent: customTheme.accent };
    }
    setThemeColors(CUSTOM_THEME_NAME, customTheme);
    setData((old) => ({ ...old, themeName: CUSTOM_THEME_NAME, customTheme: { ...DEFAULT_CUSTOM_THEME, ...(old.customTheme || {}), ...customTheme } }));
  };
  const applyCustomPreset = (specIndex, mode) => {
    const spec = THEME_SPECS[specIndex];
    if (!spec) return;
    const colors = makeThemeColors(spec, mode === "dark");
    const customTheme = customThemeFromColors({ ...colors, wine: mode === "dark" && spec[0] === "Red and Black" ? "#E53935" : spec[1] }, mode);
    setThemeColors(CUSTOM_THEME_NAME, customTheme);
    setData((old) => ({ ...old, themeName: CUSTOM_THEME_NAME, customTheme }));
  };
  const moveDashboardWidget = (widgetId, direction) => setData((old) => {
    const order = (old.dashboardWidgetOrder || DEFAULT_DASHBOARD_WIDGET_ORDER).slice();
    const index = order.indexOf(widgetId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return old;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    return { ...old, dashboardWidgetOrder: order };
  });
  const toggleDashboardWidget = (widgetId) => setData((old) => {
    const hidden = old.hiddenDashboardWidgets || [];
    return {
      ...old,
      hiddenDashboardWidgets: hidden.includes(widgetId)
        ? hidden.filter((id) => id !== widgetId)
        : hidden.concat(widgetId),
    };
  });
  const resetDashboardWidgets = () => setData((old) => ({
    ...old,
    dashboardWidgetOrder: DEFAULT_DASHBOARD_WIDGET_ORDER.slice(),
    hiddenDashboardWidgets: [],
  }));

  const showBackup = () => {
    setBackupMode("restore");
    setBackupText("");
    setBackupPreview(null);
    setBackupFeedback(null);
    setBackupRestoreComplete(false);
    setBackupOpen(true);
  };

  const openSavedBackupRestore = () => {
    setTutorialOpen(false);
    setWelcomeOpen(false);
    setWelcomeBackOpen(false);
    showBackup();
  };

  const exportBackup = async () => {
    setBackupMode("export");
    setBackupText(JSON.stringify(db, null, 2));
    setBackupPreview(null);
    setBackupFeedback(null);
    setBackupRestoreComplete(false);
    setBackupOpen(true);
  };

  const copyBackup = async () => {
    try {
      if (Platform.OS === "web" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(backupText);
        Alert.alert("Backup copied", "Your backup text is copied. Keep it somewhere private so you can paste it back later.");
        return;
      }
      if (Platform.OS !== "web") {
        await Share.share({ title: "GRIMMS business tracker backup", message: backupText });
        return;
      }
      Alert.alert("Copy the backup text", "Click inside the backup box, select all text, then copy it. Keep the text somewhere private.");
    } catch (_error) {
      Alert.alert("Could not copy automatically", "Click inside the backup box, select all text, then copy it. Keep the text somewhere private.");
    }
  };

  const checkBackupText = () => {
    const rawBackup = String(backupText || "").trim();
    setBackupPreview(null);
    setBackupRestoreComplete(false);
    if (!rawBackup) {
      setBackupFeedback({ type: "error", text: "Paste the full backup text into the box first." });
      return;
    }
    try {
      const parsed = JSON.parse(rawBackup);
      const validation = validateTrackerDatabase(parsed);
      if (!validation.ok) {
        setBackupFeedback({ type: "error", text: "This backup could not be checked: " + validation.error });
        return;
      }
      const summary = Object.entries(validation.counts).filter(([, count]) => count > 0).map(([key, count]) => `${count} ${key}`).join(", ") || "an empty tracker";
      setBackupPreview({ parsed, summary });
      setBackupFeedback({ type: "success", text: "Backup checked. Review its contents below, then choose Restore backup. Your current tracker will be saved first." });
    } catch (_error) {
      setBackupFeedback({ type: "error", text: "The pasted text is not complete backup JSON. Copy the entire backup text again, then paste it here." });
    }
  };

  const restoreCheckedBackup = async () => {
    if (!backupPreview || backupRestoring || backupRestoreComplete) return;
    setBackupRestoring(true);
    setBackupFeedback({ type: "info", text: "Saving a recovery copy of your current tracker before restoring…" });
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      saveRevisionRef.current += 1;
      await saveQueueRef.current.catch(() => {});

      // Capture the latest in-memory tracker, not the older raw snapshot from page load.
      const currentSnapshot = JSON.stringify(db);
      const parsed = backupPreview.parsed;
      const componentMax = (parsed.components || []).reduce((max, item) => Math.max(max, Number(String(item.sku || "").match(/(\d+)$/)?.[1]) || 0), 0);
      const productMax = (parsed.products || []).reduce((max, item) => Math.max(max, Number(String(item.sku || "").match(/(\d+)$/)?.[1]) || 0), 0);
      const restored = normalizeDatabase({
        ...parsed, version: Number(parsed.version) || 1,
        nextComponentSku: Math.max(Number(parsed.nextComponentSku) || 1, componentMax + 1),
        nextProductSku: Math.max(Number(parsed.nextProductSku) || 1, productMax + 1),
      });
      const restoredSnapshot = JSON.stringify(restored);

      await AsyncStorage.setItem(STORAGE_KEY + ".recovery", currentSnapshot);
      await AsyncStorage.setItem(STORAGE_KEY, restoredSnapshot);
      lastPersistedSnapshotRef.current = restoredSnapshot;
      lastRecoveryCheckpointAtRef.current = Date.now();
      setThemeColors(restored.themeName, restored.customTheme);
      setStorageLoadError("");
      setStorageLoadNotice("Your backup was restored. The tracker that was on this device is saved in its recovery copy.");
      setStorageRecoveryRaw(null);
      setSaveError("");
      setSaving(false);
      setLastSavedAt(new Date());
      setReady(true);
      setDb(restored);
      setBackupRestoreComplete(true);
      setBackupFeedback({ type: "success", text: "Backup restored and saved successfully. Your previous tracker is stored in the recovery copy on this device. Choose Done to close." });
      setBackupOpen(true);
    } catch (_error) {
      setBackupFeedback({ type: "error", text: "Restore did not finish. Your current tracker was left in place. Check that browser storage is available, then try again." });
    } finally {
      setBackupRestoring(false);
    }
  };

  const finishTutorial = (openSettings = false) => {
    setTutorialOpen(false);
    setData((old) => ({ ...old, tutorialCompleted: true }));
    if (openSettings) navigateToScreen("Settings");
  };
  const finishWelcomeSetup = (profile, startTour = false) => {
    const requestedMarkets = profile.marketplaces || [];
    const requestedSuppliers = profile.supplierNames || [];
    setData((old) => {
      const marketplaceNames = requestedMarkets.length ? requestedMarkets : (old.dropdownOptions.marketplaces || DEFAULT_DROPDOWN_OPTIONS.marketplaces);
      const marketplaceFeeRules = { ...(old.marketplaceFeeRules || {}) };
      marketplaceNames.forEach((marketplace) => {
        const entered = (profile.marketplaceFeeRules || {})[marketplace] || {};
        const existing = marketplaceFeeRules[marketplace] || {};
        const nextRule = { ...existing };
        if (String(entered.percent == null ? "" : entered.percent).trim() !== "") nextRule.percent = Math.max(0, asNumber(entered.percent, 0));
        if (String(entered.fixed == null ? "" : entered.fixed).trim() !== "") nextRule.fixed = Math.max(0, asNumber(entered.fixed, 0));
        if (Object.keys(nextRule).length) marketplaceFeeRules[marketplace] = nextRule;
      });
      const existingSupplierNames = new Set((old.suppliers || []).map((supplier) => String(supplier.name || "").trim().toLocaleLowerCase()));
      const newSuppliers = requestedSuppliers.filter((name) => !existingSupplierNames.has(name.toLocaleLowerCase())).map((name) => ({
        id: uid("supplier"), name, category: "Other", contact: "", website: "", notes: "", createdAt: new Date().toISOString(),
      }));
      return {
        ...old,
        onboardingCompleted: true,
        businessName: profile.businessName,
        currency: profile.currency || old.currency,
        dropdownOptions: { ...old.dropdownOptions, marketplaces: marketplaceNames },
        marketplaceFeeRules,
        suppliers: newSuppliers.concat(old.suppliers || []),
      };
    });
    setWelcomeOpen(false);
    setWelcomeBackOpen(false);
    if (startTour) setTutorialOpen(true);
  };
  const skipWelcomeSetup = () => {
    setData((old) => ({ ...old, onboardingCompleted: true }));
    setWelcomeOpen(false);
    setWelcomeBackOpen(false);
  };
  const retryStorageLoad = () => { setStorageLoadError(""); setReady(false); setLoadAttempt((value) => value + 1); };
  const continueWithNewTracker = () => Alert.alert(
    "Open a new tracker?",
    "The app could not read the saved file or its recovery copy. It will keep the unreadable file on this device and open a fresh tracker. This cannot restore records that are damaged beyond reading.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Keep file and continue", style: "destructive", onPress: async () => {
        try {
          const damaged = storageRecoveryRaw || await AsyncStorage.getItem(STORAGE_KEY);
          if (damaged) await AsyncStorage.setItem(STORAGE_KEY + ".corrupt", damaged);
          const fresh = normalizeDatabase(EMPTY_DB);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
          setThemeColors(fresh.themeName, fresh.customTheme);
          setStorageLoadError("");
          setStorageRecoveryRaw(null);
          setStorageLoadNotice(damaged ? "The unreadable saved file was kept in local recovery storage." : "A new local tracker is ready.");
          setDb(fresh);
          setReady(true);
          setWelcomeOpen(true);
          setWelcomeBackOpen(false);
        } catch (_error) {
          Alert.alert("Could not open a new tracker", "The saved file was left unchanged. Check available storage and try again.");
        }
      } },
    ],
  );
  const retrySave = () => { setSaving(true); setRetrySaveCount((value) => value + 1); };
  const restoreLocalRecovery = async () => {
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      saveRevisionRef.current += 1;
      await saveQueueRef.current.catch(() => {});
      setSaving(false);
      const saved = await AsyncStorage.getItem(STORAGE_KEY + ".recovery");
      if (!saved) { Alert.alert("No earlier copy yet", "The tracker keeps an on-device recovery copy after a previous save is replaced. Continue working and the app will create one automatically."); return; }
      const recovered = parseLocalTracker(saved);
      const current = await AsyncStorage.getItem(STORAGE_KEY);
      if (current && current !== saved) { try { await AsyncStorage.setItem(STORAGE_KEY + ".corrupt", current); } catch (_error) { /* keep the known-good recovery copy usable */ } }
      const recoveredSnapshot = JSON.stringify(recovered);
      await AsyncStorage.setItem(STORAGE_KEY, recoveredSnapshot);
      lastPersistedSnapshotRef.current = recoveredSnapshot;
      setThemeColors(recovered.themeName, recovered.customTheme);
      setDb(recovered);
      setStorageLoadError("");
      setStorageRecoveryRaw(null);
      setStorageLoadNotice("Your tracker was restored from its on-device recovery copy.");
      setReady(true);
    } catch (_error) {
      Alert.alert("Could not open recovery copy", "The local recovery data could not be read.");
    }
  };
  const clearBusinessData = async () => {
    if (clearConfirmText.trim() !== "DELETE") { Alert.alert("Confirmation does not match", "Type DELETE exactly to clear business records."); return; }
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      saveRevisionRef.current += 1;
      await saveQueueRef.current.catch(() => {});
      const previousSnapshot = JSON.stringify(db);
      await AsyncStorage.setItem(STORAGE_KEY + ".recovery", previousSnapshot);
      lastPersistedSnapshotRef.current = previousSnapshot;
      const cleared = normalizeDatabase({
        ...EMPTY_DB,
        currency: db.currency,
        themeName: db.themeName,
        customTheme: db.customTheme,
        defaultLowStock: db.defaultLowStock,
        buttonSoundsEnabled: db.buttonSoundsEnabled,
        onboardingCompleted: true,
        dashboardWidgetOrder: db.dashboardWidgetOrder,
        hiddenDashboardWidgets: db.hiddenDashboardWidgets,
        marketplaceFeeRules: db.marketplaceFeeRules,
        dropdownOptions: db.dropdownOptions,
      });
      setThemeColors(cleared.themeName, cleared.customTheme);
      setDb(cleared);
      setClearDataOpen(false);
      setClearConfirmText("");
      Alert.alert("Business records cleared", "A recovery copy of the previous tracker was saved on this device. Your appearance and app preferences were kept.");
    } catch (_error) {
      Alert.alert("Could not clear records", "A recovery copy could not be saved, so the tracker was left unchanged.");
    }
  };
  const resetAppToFactoryDefaults = async () => {
    if (factoryResetting) return;
    if (factoryResetConfirmText.trim() !== "RESET") {
      Alert.alert("Confirmation does not match", "Type RESET exactly to remove all saved app data.");
      return;
    }
    setFactoryResetting(true);
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      await saveQueueRef.current.catch(() => {});
      saveRevisionRef.current += 1;
      const storageKeys = [STORAGE_KEY, STORAGE_KEY + ".recovery", STORAGE_KEY + ".corrupt"];
      const savedEntries = (await AsyncStorage.multiGet(storageKeys)).filter(([, value]) => value !== null);
      try {
        await AsyncStorage.multiRemove(storageKeys);
      } catch (removeError) {
        if (savedEntries.length) await AsyncStorage.multiSet(savedEntries);
        throw removeError;
      }

      lastPersistedSnapshotRef.current = null;
      const fresh = normalizeDatabase(EMPTY_DB);
      setThemeColors(fresh.themeName, fresh.customTheme);
      setDb(fresh);
      navigateRoot("Dashboard");
      setModalType("");
      setEditingRecord(null);
      setFormPrefill(null);
      setDetailSelection(null);
      setActivityEditor(null);
      setHelpOpen(false);
      setTutorialOpen(false);
      setExpandedOrderIds([]);
      setSearch("");
      setProductionProduct("");
      setProductionQty("1");
      setBackupText("");
      setCustomColorPicker("");
      setThemePickerOpen(false);
      setSettingsSections({ profile: true, appearance: true, marketplaces: true, fees: false, widgets: false, options: false, data: false, archive: false, announcements: false });
      setBackupOpen(false);
      setClearDataOpen(false);
      setClearConfirmText("");
      setFactoryResetOpen(false);
      setFactoryResetConfirmText("");
      setAddChooserOpen(false);
      setStorageLoadError("");
      setStorageLoadNotice("");
      setStorageRecoveryRaw(null);
      setSaveError("");
      setSaving(false);
      setLastSavedAt(null);
      setRetrySaveCount(0);
      setSelectedDay(TODAY);
      setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      setTimerLabel("");
      setTimerTaskIds([]);
      setTimerWorkNote("");
      setShiftTaskIds([]);
      setShiftWorkNote("");
      setPlanRange("week");
      setPlanAnchor(new Date());
      setTimeEdit(null);
      setDiscountEditor(null);
      setTimelineEditor(null);
      setRefundEditor(null);
      setProductionSaving(false);
      productionLock.current = false;
      setReady(true);
      setWelcomeOpen(true);
      setWelcomeBackOpen(false);
    } catch (_error) {
      setSaving(false);
      Alert.alert("Could not finish the reset", "The app could not remove all saved files. Your tracker remains open; review its saved data before trying again.");
    } finally {
      setFactoryResetting(false);
    }
  };

  const orderMatchesSelectedPhase = (order) => {
    if (orderStatusFilter === "All") return true;
    const phase = DASHBOARD_FULFILLMENT_PHASES.find((item) => item.label === orderStatusFilter);
    return phase ? phase.statuses.includes(order.status) : order.status === orderStatusFilter;
  };
  const visibleOrders = sortRecords(db.orders.filter((order) => showArchivedOrders ? !!order.archived : !order.archived).filter(orderMatchesSelectedPhase).filter((order) => {
    const query = search.toLowerCase();
    return !query || [order.orderSku, order.marketplace, order.customer, order.status, order.paymentMethod, order.shippingMethod, ...(order.items || []).flatMap((item) => [item.productName, item.productSku])].join(" ").toLowerCase().includes(query);
  }), db.sortModes.orders);
  const detailStorageKey = detailSelection && (detailSelection.type === "component" ? "components" : detailSelection.type === "product" ? "products" : detailSelection.type === "listing" ? "listings" : "orders");
  const detailRecord = detailSelection ? (db[detailStorageKey] || []).find((record) => record.id === detailSelection.id) || null : null;
  const visibleTasks = openTasks.filter((task) => !search || [task.title, task.category, task.priority, task.notes].join(" ").toLowerCase().includes(search.toLowerCase()));
  const visibleExpenses = db.expenses.filter((expense) => !search || [expense.description, expense.category, expense.notes].join(" ").toLowerCase().includes(search.toLowerCase()));

  const renderDashboard = () => {
    const todayWorkMs = (db.timeSessions || []).filter((session) => session.date === TODAY).reduce((sum, session) => sum + (Number(session.durationMs) || 0), 0);
    const activeWorkMs = db.activeShift ? Math.max(0, clockNow - db.activeShift.clockIn - (Number(db.activeShift.breakMs) || 0) - (db.activeShift.breakStartedAt ? clockNow - db.activeShift.breakStartedAt : 0)) : 0;
    const dashboardRange = periodDateRange(dashboardPeriod, dashboardAnchor) || { start: TODAY, end: TODAY };
    const inDashboardPeriod = (record) => {
      const date = parseDateInput(record.date) || String(record.date || "").slice(0, 10);
      return date && date >= dashboardRange.start && date <= dashboardRange.end;
    };
    const dashboardPeriodLabel = dashboardRange.start === dashboardRange.end
      ? dateLabel(dashboardRange.start)
      : dateLabel(dashboardRange.start) + " – " + dateLabel(dashboardRange.end);
    const periodTotals = calculateTotals({
      ...db,
      orders: db.orders.filter(inDashboardPeriod),
      expenses: db.expenses.filter(inDashboardPeriod),
      incomes: db.incomes.filter(inDashboardPeriod),
    });
    const periodIsCurrentMonth = dashboardPeriod === "month" && dashboardRange.start.slice(0, 7) === TODAY.slice(0, 7);
    const dashboardResetLabel = ({ day: "Today", week: "This week", month: "This month", year: "This year" })[dashboardPeriod] || "Today";
    const monthSales = periodTotals.gross;
    const salesGoal = Math.max(0, Number(db.monthlySalesGoal) || 0);
    const salesProgress = periodIsCurrentMonth && salesGoal > 0 ? Math.min(100, Math.round((monthSales / salesGoal) * 100)) : 0;
    const readyToShip = db.orders.filter((order) => !order.archived && !order.refundedAt && ["Needs Packaging", "Packaging"].includes(order.status)).length;
    const shippedOrders = db.orders.filter((order) => !order.archived && !order.refundedAt && order.status === "Shipped").length;
    const todayTasks = openTasks.filter((task) => task.dueDate === TODAY).length;
    const activeListings = db.listings.filter((item) => active(item));
    const soldListingsNeedArchive = activeListings.filter((item) => item.needsArchive);
    const shopReviews = db.reviews || [];
    const averageStars = shopReviews.length ? (shopReviews.reduce((sum, item) => sum + (Number(item.stars) || 0), 0) / shopReviews.length).toFixed(1) : "—";
    const dashboardStatuses = Array.from(new Set([...(fulfillmentStatuses || []), ...db.orders.map((order) => order.status).filter(Boolean)]));
    const shiftDashboardPeriod = (delta) => {
      const date = new Date(dashboardAnchor + "T12:00:00");
      if (dashboardPeriod === "day") date.setDate(date.getDate() + delta);
      else if (dashboardPeriod === "week") date.setDate(date.getDate() + delta * 7);
      else {
        const day = date.getDate();
        const month = date.getMonth();
        date.setDate(1);
        if (dashboardPeriod === "month") date.setMonth(month + delta);
        else date.setFullYear(date.getFullYear() + delta);
        date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      }
      setDashboardAnchor(localDateKey(date));
    };
    const allAttentionItems = [
      ...lowStock.map((item) => ({ id: "component:" + item.id, icon: "◈", title: item.name + " is low", detail: "Only " + item.quantity + " " + (item.unit || "pieces") + " on hand · alert at " + item.lowStock, screen: "Components" })),
      ...orderNeedsAttention.map((item) => ({ id: "order:" + item.id, icon: "▣", title: (item.orderSku || "Sale") + " needs attention", detail: (item.items || []).map((line) => line.productName + " × " + line.quantity).join(", ") + " · " + (item.status || "Status not set") + " · " + dateLabel(item.date), screen: "Orders" })),
      ...overdueTasks.map((item) => ({ id: "task:" + item.id, icon: "✓", title: "Overdue: " + item.title, detail: (item.category || "Task") + " · Due " + dateLabel(item.dueDate) + (item.notes ? " · " + item.notes : ""), screen: "Calendar" })),
      ...soldListingsNeedArchive.map((item) => ({ id: "listing:" + item.id, icon: "▤", title: item.productName + " sold out", detail: (item.listingSku || "Listing SKU") + " · archive the listing or relist after making more stock", screen: "Listings" })),
    ];
    const savedDismissals = db.dashboardDismissedAttention || [];
    const attentionItems = allAttentionItems.filter((item) => !savedDismissals.some((dismissed) => dismissed.id === item.id));
    const dismissedAttentionItems = savedDismissals.slice().reverse().map((dismissed) => ({ dismissed, item: dismissed.item || allAttentionItems.find((item) => item.id === dismissed.id) || null }));
    const dismissAttention = (item) => setData((old) => {
      const previous = old.dashboardDismissedAttention || [];
      if (previous.some((dismissed) => dismissed.id === item.id)) return old;
      return { ...old, dashboardDismissedAttention: previous.concat([{ id: item.id, date: TODAY, item }]) };
    });
    const dismissAllAttention = () => setData((old) => {
      const previous = old.dashboardDismissedAttention || [];
      const alreadyDismissed = new Set(previous.map((entry) => entry.id));
      const nextDismissals = attentionItems.filter((item) => !alreadyDismissed.has(item.id)).map((item) => ({ id: item.id, date: TODAY, item }));
      return nextDismissals.length ? { ...old, dashboardDismissedAttention: previous.concat(nextDismissals) } : old;
    });
    const restoreAllAttention = () => setData((old) => old.dashboardDismissedAttention && old.dashboardDismissedAttention.length
      ? { ...old, dashboardDismissedAttention: [] }
      : old);
    const widgetContent = {
      welcome: (
        <View style={styles.welcomeBox}>
          <View pointerEvents="none" style={styles.heroOrbOne} /><View pointerEvents="none" style={styles.heroOrbTwo} />
          <View style={styles.heroTopline}><Text style={styles.eyebrow}>YOUR BUSINESS, AT A GLANCE</Text><Text style={styles.heroDate}>{dateLabel(TODAY)}</Text></View>
          <Text style={styles.welcomeTitle}>{db.businessName ? "Welcome back, " + db.businessName : "A calmer way to run your business"}</Text>
          <Text style={styles.welcomeText}>Keep your next move clear. Here’s what’s happening across your shop.</Text>
          {db.businessStartDate
            ? <Text style={{ color: "rgba(255,255,255,0.84)", fontSize: 12, lineHeight: 17, marginTop: 5 }}>Business started {dateLabel(db.businessStartDate)} · {businessDurationLabel(db.businessStartDate)}</Text>
            : <Pressable onPress={() => navigateToScreen("Settings")} style={{ alignSelf: "flex-start", marginTop: 5 }}><Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, textDecorationLine: "underline" }}>Add your business start date in Settings</Text></Pressable>}
          <View style={styles.heroStats}>
            <Pressable android_ripple={{ color: "rgba(255,255,255,0.14)" }} onPress={() => navigateToFulfillment("Need to pack", "phase")} style={styles.heroStat}><Text style={styles.heroStatValue}>{readyToShip}</Text><Text style={styles.heroStatLabel}>need to pack</Text></Pressable>
            <View style={styles.heroDivider} />
            <Pressable android_ripple={{ color: "rgba(255,255,255,0.14)" }} onPress={() => navigateToFulfillment("Shipped")} style={styles.heroStat}><Text style={styles.heroStatValue}>{shippedOrders}</Text><Text style={styles.heroStatLabel}>shipped</Text></Pressable>
            <View style={styles.heroDivider} />
            <Pressable android_ripple={{ color: "rgba(255,255,255,0.14)" }} onPress={() => navigateToScreen("Calendar")} style={styles.heroStat}><Text style={styles.heroStatValue}>{todayTasks}</Text><Text style={styles.heroStatLabel}>due today</Text></Pressable>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => navigateToScreen("Calendar")}><Text style={styles.primaryButtonText}>See today's priorities</Text></Pressable>
        </View>
      ),
      sales: (
        <>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Sales &amp; cash</Text></View>
          <ChoiceChips label="Dashboard view" options={[{ label: "Daily", value: "day" }, { label: "Weekly", value: "week" }, { label: "Monthly", value: "month" }, { label: "Yearly", value: "year" }]} value={dashboardPeriod} onChange={setDashboardPeriod} />
          <View style={styles.planningPeriodNav}><Pressable onPress={() => shiftDashboardPeriod(-1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable><Text style={styles.planningPeriodText}>{dashboardPeriodLabel}</Text><Pressable onPress={() => shiftDashboardPeriod(1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>›</Text></Pressable><Action label={dashboardResetLabel} quiet onPress={() => setDashboardAnchor(TODAY)} /></View>
          <Card style={styles.salesGoalCard}>
            <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.salesGoalLabel}>SALES FOR THIS PERIOD</Text><Text style={styles.salesGoalValue}>{money(monthSales, db.currency)}</Text></View><View style={styles.salesIcon}><Text style={styles.salesIconText}>↗</Text></View></View>
            {periodIsCurrentMonth && salesGoal > 0 ? <><View style={styles.salesGoalTrack}><View style={[styles.salesGoalFill, { width: String(salesProgress) + "%" }]} /></View><Text style={styles.recordMeta}>{salesProgress}% of {money(salesGoal, db.currency)} monthly goal</Text></> : <Text style={styles.recordMeta}>{periodTotals.orders} order{periodTotals.orders === 1 ? "" : "s"} · {dashboardPeriodLabel}</Text>}
          </Card>
          <View style={styles.metricGrid}>
            <Metric label="Gross sales" value={money(periodTotals.gross, db.currency)} />
            <Metric label="Estimated profit" value={money(periodTotals.estimatedProfit, db.currency)} color={periodTotals.estimatedProfit < 0 ? COLORS.red : COLORS.green} />
            <Metric label="Fees + shipping" value={money(periodTotals.fees + periodTotals.shipping, db.currency)} />
            <Metric label="Expenses" value={money(periodTotals.expenses, db.currency)} />
          </View>
          <View style={styles.dashboardCashSummary}><Text style={styles.dashboardCashSummaryText}>Payout after fees <Text style={styles.dashboardCashSummaryValue}>{money(periodTotals.payouts, db.currency)}</Text>  ·  Other income <Text style={styles.dashboardCashSummaryValue}>{money(periodTotals.income, db.currency)}</Text>  ·  Refunds <Text style={styles.dashboardCashSummaryValue}>{money(periodTotals.refunds, db.currency)}</Text></Text></View>
          <Text style={styles.metricNote}>Estimates use the fees, shipping, income, and expenses saved in your records. Compare them with your marketplace statements.</Text>
        </>
      ),
      fulfillment: (
        <>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Order fulfillment</Text><Pressable hitSlop={8} onPress={() => navigateToScreen("Orders")}><Text style={styles.actionText}>Open orders ›</Text></Pressable></View>
        <View style={styles.fulfillmentList}>{dashboardStatuses.map((status, index) => {
            const count = db.orders.filter((order) => !order.archived && !order.refundedAt && order.status === status).length;
            return <Pressable key={status} accessibilityRole="button" accessibilityLabel={`${status}: ${count} orders. Open products in this status.`} android_ripple={{ color: COLORS.ripple }} onPress={() => navigateToFulfillment(status)} style={({ pressed }) => [styles.fulfillmentListRow, index === dashboardStatuses.length - 1 && styles.fulfillmentListRowLast, pressed && styles.pressedState]}><Text style={styles.fulfillmentListCount}>{count}</Text><Text style={styles.fulfillmentListLabel}>{status}</Text><Text style={styles.fulfillmentListArrow}>›</Text></Pressable>;
          })}</View>
        </>
      ),
      time: (
        <>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Today’s work shift</Text><Pressable onPress={() => navigateToScreen("Calendar")}><Text style={styles.actionText}>Open calendar ›</Text></Pressable></View>
          <Card><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{db.activeShift ? "You are clocked in" : "Work time recorded"}</Text><Text style={styles.recordMeta}>{db.activeShift && db.activeShift.breakStartedAt ? "On break · " : db.activeShift ? "Shift in progress · " : "Today · "}{formatDuration(todayWorkMs + activeWorkMs)}</Text></View><Pill text={db.activeShift ? (db.activeShift.breakStartedAt ? "On break" : "Clocked in") : "Clocked out"} tone={db.activeShift ? "green" : "neutral"} /></View><View style={styles.actionRow}><Action label={db.activeShift ? "Open shift tools" : "Clock in"} onPress={() => { if (!db.activeShift) clockIn(); else navigateToScreen("Calendar"); }} /></View></Card>
        </>
      ),
      attention: (
        <>
          <View style={styles.sectionHeadingRow}><View style={styles.flex}><Text style={styles.sectionTitle}>Needs your attention</Text><Text style={styles.subtle}>{attentionItems.length} open</Text></View>{attentionItems.length ? <Action label="Dismiss all" quiet onPress={dismissAllAttention} /> : null}</View>
          {attentionItems.length === 0 ? <Card><Text style={styles.emptyTitle}>Nothing urgent right now</Text><Text style={styles.bodyText}>There are no open inventory, order, listing, or task alerts today.</Text></Card> : attentionItems.map((item) => {
            const expanded = expandedDashboardAttention.includes(item.id);
            return <Card key={item.id}><View style={styles.cardTop}><Pressable style={styles.flex} onPress={() => setExpandedDashboardAttention((old) => old.includes(item.id) ? old.filter((id) => id !== item.id) : old.concat([item.id]))}><Text style={styles.recordTitle}>{item.icon}  {item.title}</Text>{expanded ? <Text style={styles.bodyText}>{item.detail}</Text> : <Text style={styles.recordMeta}>Tap to see details</Text>}</Pressable><View style={{ alignItems: "flex-end", gap: 6 }}><Action label="Open" quiet onPress={() => navigateToScreen(item.screen)} /><Pressable onPress={() => dismissAttention(item)}><Text style={styles.deleteOptionText}>Dismiss</Text></Pressable></View></View></Card>;
          })}
        </>
      ),
      snapshot: (
        <>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Your business snapshot</Text></View>
          <View style={styles.summaryGrid}>
            <Pressable android_ripple={{ color: COLORS.ripple }} onPress={() => navigateToScreen("Components")} style={({ pressed }) => [styles.summaryTile, pressed && styles.pressedState]}><Text style={styles.summaryNumber}>{db.components.filter(active).length}</Text><Text style={styles.summaryLabel}>Components</Text><Text style={styles.summarySub}>{lowStock.length} low stock</Text></Pressable>
            <Pressable android_ripple={{ color: COLORS.ripple }} onPress={() => navigateToScreen("Products")} style={({ pressed }) => [styles.summaryTile, pressed && styles.pressedState]}><Text style={styles.summaryNumber}>{visibleProducts.length}</Text><Text style={styles.summaryLabel}>Products</Text><Text style={styles.summarySub}>{visibleProducts.reduce((sum, x) => sum + (Number(x.inventory) || 0), 0)} ready to sell</Text></Pressable>
            <Pressable android_ripple={{ color: COLORS.ripple }} onPress={() => navigateToScreen("Orders")} style={({ pressed }) => [styles.summaryTile, pressed && styles.pressedState]}><Text style={styles.summaryNumber}>{totals.orders}</Text><Text style={styles.summaryLabel}>Orders</Text><Text style={styles.summarySub}>{orderNeedsAttention.length} in progress</Text></Pressable>
            <Pressable android_ripple={{ color: COLORS.ripple }} onPress={() => navigateToScreen("Listings")} style={({ pressed }) => [styles.summaryTile, pressed && styles.pressedState]}><Text style={styles.summaryNumber}>{activeListings.length}</Text><Text style={styles.summaryLabel}>Listings</Text><Text style={styles.summarySub}>{soldListingsNeedArchive.length} sold out to archive</Text></Pressable>
            <Pressable android_ripple={{ color: COLORS.ripple }} onPress={() => navigateToScreen("Reviews")} style={({ pressed }) => [styles.summaryTile, pressed && styles.pressedState]}><Text style={styles.summaryNumber}>{averageStars}</Text><Text style={styles.summaryLabel}>Shop rating</Text><Text style={styles.summarySub}>{shopReviews.length} reviews saved</Text></Pressable>
            <Pressable android_ripple={{ color: COLORS.ripple }} onPress={() => navigateToScreen("Calendar")} style={({ pressed }) => [styles.summaryTile, pressed && styles.pressedState]}><Text style={styles.summaryNumber}>{openTasks.length}</Text><Text style={styles.summaryLabel}>Open tasks</Text><Text style={styles.summarySub}>{overdueTasks.length} overdue</Text></Pressable>
          </View>
        </>
      ),
      quickAdd: (
        <>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Quick add</Text></View>
          <View style={styles.quickAddRow}>
            {[["component", "＋ Material"], ["product", "＋ Product"], ["order", "＋ Sale"], ["task", "＋ Task"]].map(([type, label]) => (
              <Pressable key={type} android_ripple={{ color: COLORS.ripple }} style={({ pressed }) => [styles.quickAddButton, pressed && styles.pressedState]} onPress={() => beginAdd(type)}><Text style={styles.quickAddText}>{label}</Text></Pressable>
            ))}
          </View>
        </>
      ),
    };
    const hiddenWidgets = db.hiddenDashboardWidgets || [];
    const widgetOrder = db.dashboardWidgetOrder || DEFAULT_DASHBOARD_WIDGET_ORDER;
    return <>
      {!hiddenWidgets.includes("welcome") ? <React.Fragment key="welcome">{widgetContent.welcome}</React.Fragment> : null}
      {widgetContent.fulfillment}
      {widgetOrder.filter((id) => id !== "welcome" && id !== "fulfillment" && !hiddenWidgets.includes(id)).map((id) => <React.Fragment key={id}>{widgetContent[id]}</React.Fragment>)}
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Dismissed alerts</Text><View style={styles.actionRow}>{dismissedAttentionItems.length ? <Action label="Restore all" quiet onPress={restoreAllAttention} /> : null}<Action label={showDismissedAttention ? "Hide dismissed" : `See dismissed (${dismissedAttentionItems.length})`} quiet onPress={() => setShowDismissedAttention(!showDismissedAttention)} /></View></View>
        {showDismissedAttention ? dismissedAttentionItems.length ? dismissedAttentionItems.map((item) => <Card key={item.dismissed.id + item.dismissed.date}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{item.item ? `${item.item.icon}  ${item.item.title}` : item.dismissed.id}</Text><Text style={styles.recordMeta}>Dismissed {dateLabel(item.dismissed.date)}</Text>{item.item ? <Text style={styles.bodyText}>{item.item.detail}</Text> : null}</View><Action label="Restore alert" onPress={() => setData((old) => ({ ...old, dashboardDismissedAttention: (old.dashboardDismissedAttention || []).filter((entry) => entry.id !== item.dismissed.id) }))} /></View></Card>) : <Text style={styles.bodyText}>There are no dismissed alerts to restore.</Text> : null}
    </>;
  };
  const renderComponents = () => {
    const categories = Array.from(new Set(db.components.map((item) => item.category || "Other"))).sort((a, b) => a.localeCompare(b));
    const records = db.components.filter((item) => showArchivedComponents ? !active(item) : active(item));
    const filters = attributeFilters.components || {};
    const list = sortRecords(records.filter((item) =>
      (componentCategoryFilter === "All" || (item.category || "Other") === componentCategoryFilter) &&
      matchesAttributeFilter(item, "colors", filters.colors || "All") &&
      matchesAttributeFilter(item, "materials", filters.materials || "All") &&
      matchesAttributeFilter(item, "sizes", filters.sizes || "All") &&
      matchesAttributeFilter(item, "gender", filters.gender || "All") &&
      (!search || [item.name, item.sku, item.category, item.supplier, item.colors, item.materials, item.sizes, item.gender, item.notes].join(" ").toLowerCase().includes(search.toLowerCase()))
    ), db.sortModes.components);
    const pagedComponents = pageRows("components", list);
    const history = (db.componentTransactions || []).slice().sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
    const activeComponents = db.components.filter(active);
    const totalValue = activeComponents.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.cost) || 0), 0);
    return (
      <>
        <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Materials inventory</Text><Text style={styles.infoBannerText}>Component stock is shared with product recipes, production, and sales. Record purchases through Restock so your quantities and costs stay in sync.</Text><View style={styles.actionRow}><Action label="＋ Add component" onPress={() => beginAdd("component")} /><Action label="＋ Restock" quiet onPress={() => beginAdd("restock")} /></View></View>
        <View style={styles.metricGrid}><Metric label="Active components" value={String(activeComponents.length)} /><Metric label="Low or out of stock" value={String(lowStock.length)} /><Metric label="Units tracked" value={String(activeComponents.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0))} /><Metric label="Stock value at cost" value={money(totalValue, db.currency)} /></View>
        <ChoiceChips label="Filter components" options={["All", ...categories]} value={componentCategoryFilter} onChange={setComponentCategoryFilter} />
        <View style={styles.actionRow}><Action label={expandedAttributeFilters.components ? "Hide attribute filters" : "Filter by color, material, size, or audience" + (attributeFilterCount("components") ? " · " + attributeFilterCount("components") + " active" : "")} quiet onPress={() => toggleAttributeFilters("components")} />{attributeFilterCount("components") ? <Action label="Clear filters" quiet onPress={() => clearAttributeFilters("components")} /> : null}</View>
        {expandedAttributeFilters.components ? <>
          <ChoiceChips label="Color" options={["All", ...attributeFilterOptions(db.components, "colors", "colors")]} value={filters.colors || "All"} onChange={(value) => setAttributeFilter("components", "colors", value)} />
          <ChoiceChips label="Material" options={["All", ...attributeFilterOptions(db.components, "materials", "materials")]} value={filters.materials || "All"} onChange={(value) => setAttributeFilter("components", "materials", value)} />
          <ChoiceChips label="Size" options={["All", ...attributeFilterOptions(db.components, "sizes", "sizes")]} value={filters.sizes || "All"} onChange={(value) => setAttributeFilter("components", "sizes", value)} />
          <ChoiceChips label="Audience" options={["All", ...attributeFilterOptions(db.components, "genders", "gender")]} value={filters.gender || "All"} onChange={(value) => setAttributeFilter("components", "gender", value)} />
        </> : null}
        <View style={styles.actionRow}><Action label={showArchivedComponents ? "Show active components" : "Show archived components (" + (db.components.length - activeComponents.length) + ")"} quiet onPress={() => setShowArchivedComponents(!showArchivedComponents)} /></View>
        <SortControl value={db.sortModes.components} onChange={(value) => saveSortMode("components", value)} />
        {pagedComponents.length ? pagedComponents.map((item) => {
          const low = Number(item.quantity) <= Number(item.lowStock);
          const expanded = expandedComponentIds.includes(item.id);
          const toggleExpanded = () => setExpandedComponentIds((old) => old.includes(item.id) ? old.filter((id) => id !== item.id) : old.concat([item.id]));
          return (
            <Card key={item.id} style={styles.compactComponentCard}>
              <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle} numberOfLines={2}>{item.name}</Text><Text style={styles.recordMeta}>{item.sku} · {item.category || "Other"} · {item.quantity} {item.unit || "pieces"} on hand</Text><Text style={styles.recordMeta}>{money(item.cost, db.currency)} per unit · {money((Number(item.quantity) || 0) * (Number(item.cost) || 0), db.currency)} stock value</Text></View><Pill text={item.archived ? "Archived" : Number(item.quantity) <= 0 ? "Out of stock" : low ? "Low stock" : "In stock"} tone={item.archived ? "neutral" : Number(item.quantity) <= 0 ? "red" : low ? "amber" : "green"} /></View>
              <View style={styles.componentCardActions}><Action label={expanded ? "Hide details" : "Details"} quiet onPress={toggleExpanded} />{expanded && !item.archived ? <Action label="Restock" onPress={() => beginAdd("restock", { componentId: item.id })} /> : null}<Action label="Duplicate" quiet onPress={() => duplicateRecord("component", item)} /><Action label="Edit" quiet onPress={() => beginEdit("component", { ...item, cost: String(item.cost), quantity: String(item.quantity), lowStock: String(item.lowStock) })} /></View>
              {expanded ? <>
                <View style={styles.detailLine}><Text style={styles.detailLabel}>Low-stock alert</Text><Text style={styles.detailValue}>{item.lowStock} {item.unit || "pieces"}</Text></View>
                <View style={styles.detailLine}><Text style={styles.detailLabel}>Supplier</Text><Text style={styles.detailValue}>{item.supplier || "Not saved"}</Text></View>
                {item.notes ? <Text style={styles.bodyText}>{item.notes}</Text> : null}
                {item.archived ? <Action label="Restore component" onPress={() => restoreRecord("components", item)} /> : <View style={styles.actionRow}><Action label="Archive" quiet onPress={() => archiveRecord("components", item, "component")} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("components", item, "component")} /></View>}
              </> : null}
            </Card>
          );
        }) : <EmptyState title="No components yet" body="Add the materials you use to make your products. Stock and costs will connect to production." action="Add a component" onPress={() => beginAdd("component")} />}
        {pagedComponents.length < list.length ? <View style={styles.actionRow}><Action label={"Show 60 more components · " + (list.length - pagedComponents.length) + " remaining"} quiet onPress={() => showMoreRows("components")} /></View> : null}
        {history.length > 0 && <><View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Inventory history</Text><Action label={inventoryHistoryExpanded ? "Hide history" : "Show all history (" + history.length + ")"} quiet onPress={() => setInventoryHistoryExpanded(!inventoryHistoryExpanded)} /></View>{inventoryHistoryExpanded ? history.map((entry) => {
          const component = db.components.find((x) => x.id === entry.componentId);
          return <Card key={entry.id} style={styles.historyCard}><Text style={styles.recordTitle}>{entry.kind}: {component ? component.name : "Component"}</Text><Text style={styles.recordMeta}>{entry.quantity > 0 ? "+" : ""}{entry.quantity} · {dateLabel(entry.date)}</Text></Card>;
        }) : null}</>}
      </>
    );
  };

  const renderProducts = () => {
    const categories = Array.from(new Set(db.products.map((item) => item.category || "Other"))).sort((a, b) => a.localeCompare(b));
    const activeProducts = db.products.filter(active);
    const records = showArchivedProducts ? db.products.filter((item) => !active(item)) : activeProducts;
    const filters = attributeFilters.products || {};
    const list = sortRecords(records.filter((item) =>
      (productCategoryFilter === "All" || (item.category || "Other") === productCategoryFilter) &&
      matchesAttributeFilter(item, "colors", filters.colors || "All") &&
      matchesAttributeFilter(item, "materials", filters.materials || "All") &&
      matchesAttributeFilter(item, "sizes", filters.sizes || "All") &&
      matchesAttributeFilter(item, "gender", filters.gender || "All") &&
      (!search || [item.name, item.sku, item.category, item.colors, item.description, item.materials, item.sizes, item.gender, item.condition, item.notes].join(" ").toLowerCase().includes(search.toLowerCase()))
    ), db.sortModes.products);
    const pagedProducts = pageRows("products", list);
    const inventoryValue = activeProducts.reduce((sum, item) => sum + (Number(item.inventory) || 0) * (Number(item.price) || 0), 0);
    return (
      <>
        <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Your product catalog</Text><Text style={styles.infoBannerText}>Products share finished stock with orders and listing availability. Production checks each saved recipe against component stock.</Text><View style={styles.actionRow}><Action label="＋ Add product" onPress={() => beginAdd("product")} /><Action label="＋ Make products" quiet onPress={() => navigateToScreen("Production")} /></View></View>
        <View style={styles.metricGrid}><Metric label="Active products" value={String(activeProducts.length)} /><Metric label="Finished units" value={String(activeProducts.reduce((sum, item) => sum + (Number(item.inventory) || 0), 0))} /><Metric label="Out of stock" value={String(activeProducts.filter((item) => Number(item.inventory) <= 0).length)} /><Metric label="Retail value on hand" value={money(inventoryValue, db.currency)} /></View>
        <ChoiceChips label="Filter products" options={["All", ...categories]} value={productCategoryFilter} onChange={setProductCategoryFilter} />
        <View style={styles.actionRow}><Action label={expandedAttributeFilters.products ? "Hide attribute filters" : "Filter by color, material, size, or audience" + (attributeFilterCount("products") ? " · " + attributeFilterCount("products") + " active" : "")} quiet onPress={() => toggleAttributeFilters("products")} />{attributeFilterCount("products") ? <Action label="Clear filters" quiet onPress={() => clearAttributeFilters("products")} /> : null}</View>
        {expandedAttributeFilters.products ? <>
          <ChoiceChips label="Color" options={["All", ...attributeFilterOptions(db.products, "colors", "colors")]} value={filters.colors || "All"} onChange={(value) => setAttributeFilter("products", "colors", value)} />
          <ChoiceChips label="Material" options={["All", ...attributeFilterOptions(db.products, "materials", "materials")]} value={filters.materials || "All"} onChange={(value) => setAttributeFilter("products", "materials", value)} />
          <ChoiceChips label="Size" options={["All", ...attributeFilterOptions(db.products, "sizes", "sizes")]} value={filters.sizes || "All"} onChange={(value) => setAttributeFilter("products", "sizes", value)} />
          <ChoiceChips label="Audience" options={["All", ...attributeFilterOptions(db.products, "genders", "gender")]} value={filters.gender || "All"} onChange={(value) => setAttributeFilter("products", "gender", value)} />
        </> : null}
        <View style={styles.actionRow}><Action label={showArchivedProducts ? "Show active products" : "Show archived products (" + (db.products.length - activeProducts.length) + ")"} quiet onPress={() => setShowArchivedProducts(!showArchivedProducts)} /></View>
        <SortControl value={db.sortModes.products} onChange={(value) => saveSortMode("products", value)} />
        {pagedProducts.length ? pagedProducts.map((item) => {
          const recipes = item.recipe || [];
          const expanded = expandedProductIds.includes(item.id);
          const toggleExpanded = () => setExpandedProductIds((old) => old.includes(item.id) ? old.filter((id) => id !== item.id) : old.concat([item.id]));
          return (
            <Card key={item.id}>
              <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{item.name}</Text><Text style={styles.recordMeta}>{item.sku} · {item.category || "Other"} · {item.inventory} ready to sell</Text><Text style={styles.recordMeta}>{money(item.price, db.currency)} each · {money((Number(item.inventory) || 0) * (Number(item.price) || 0), db.currency)} retail value</Text></View><View style={{ alignItems: "flex-end", gap: 6 }}><Pill text={item.archived ? "Archived" : Number(item.inventory) > 0 ? "In stock" : "Out of stock"} tone={item.archived ? "neutral" : Number(item.inventory) > 0 ? "green" : "amber"} /><Action label="Duplicate" quiet onPress={() => duplicateRecord("product", item)} /><Action label="Edit" quiet onPress={() => beginEdit("product", { ...item, price: String(item.price), inventory: String(item.inventory), recipe: recipes.map((part) => ({ ...part, quantity: String(part.quantity) })) })} /></View></View>
              <View style={styles.actionRow}><Action label={expanded ? "Hide details" : "Show details"} quiet onPress={toggleExpanded} />{expanded && recipes.length > 0 && !item.archived ? <Action label="Make" quiet onPress={() => { setProductionProduct(item.id); navigateToScreen("Production"); }} /> : null}</View>
              {expanded ? <>
                {item.description || item.materials || item.notes ? <Text style={styles.bodyText}>{item.description || item.materials || item.notes}</Text> : null}
                {recipes.length ? <View style={styles.recipePreview}><Text style={styles.fieldLabel}>Product recipe · component stock</Text>{recipes.map((part) => { const component = db.components.find((row) => row.id === part.componentId); return <Text key={part.componentId} style={styles.bodyText}>{part.quantity} {part.unit} {part.name} · {component ? component.quantity + " " + (component.unit || "pieces") + " available" : "component archived or missing"}</Text>; })}</View> : <Text style={styles.bodyText}>No component recipe saved.</Text>}
                {item.archived ? <Action label="Restore product" onPress={() => restoreRecord("products", item)} /> : <View style={styles.actionRow}><Action label="Archive" quiet onPress={() => archiveRecord("products", item, "product")} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("products", item, "product")} /></View>}
              </> : null}
            </Card>
          );
        }) : <EmptyState title="Your catalog starts here" body="Create a product, add its selling price and optional recipe, then build finished inventory." action="Add a product" onPress={() => beginAdd("product")} />}
        {pagedProducts.length < list.length ? <View style={styles.actionRow}><Action label={"Show 60 more products · " + (list.length - pagedProducts.length) + " remaining"} quiet onPress={() => showMoreRows("products")} /></View> : null}
      </>
    );
  };

  const renderProduction = () => (
    <>
      <ScreenDashboardHeader title="Production" description="Turn raw materials into finished stock. Recipe usage is checked before a batch is saved." metrics={[
        { label: "Active products", value: String(visibleProducts.length) },
        { label: "Batches recorded", value: String(db.productions.length) },
        { label: "Low-stock materials", value: String(lowStock.length) },
      ]} actions={[
        { label: "＋ Add product", onPress: () => beginAdd("product") },
        { label: "Open components", onPress: () => navigateToScreen("Components"), quiet: true },
      ]} />
      <Card>
        <Text style={styles.cardTitle}>Record a production batch</Text>
        {visibleProducts.length === 0 ? <Text style={styles.bodyText}>Create a product first. Add its recipe to track material usage automatically.</Text> : (
          <>
            <Field field={{ label: "Product", options: visibleProducts.map((item) => ({ label: item.name + " (" + item.sku + ")", value: item.id })) }} value={productionProduct} onChange={setProductionProduct} />
            <Field field={{ label: "Quantity to make", number: true }} value={productionQty} onChange={setProductionQty} />
            {(() => {
              const selected = visibleProducts.find((item) => item.id === productionProduct);
              return selected ? <View style={styles.recipePreview}><Text style={styles.fieldLabel}>Materials needed</Text>{(selected.recipe || []).length ? selected.recipe.map((part) => { const component = db.components.find((item) => item.id === part.componentId); const needed = Number(part.quantity) * asNumber(productionQty, 0); const available = Number(component && component.quantity) || 0; return <Text key={part.componentId} style={[styles.bodyText, needed > available && { color: COLORS.red, fontWeight: "700" }]}>• {part.name}: need {needed} {part.unit} · {available} available{part.sku ? " · " + part.sku : ""}</Text>; }) : <Text style={styles.bodyText}>This product has no material recipe. Production will add finished units without deducting materials.</Text>}</View> : null;
            })()}
            <Pressable disabled={productionSaving} style={[styles.primaryButtonFull, productionSaving && styles.disabledButton]} onPress={makeProduction}><Text style={styles.primaryButtonFullText}>{productionSaving ? "Saving batch..." : "Complete production"}</Text></Pressable>
          </>
        )}
      </Card>
      <Text style={styles.sectionTitle}>Recent batches</Text>
      {db.productions.length ? db.productions.slice(0, 12).map((batch) => <Card key={batch.id} style={styles.historyCard}><Text style={styles.recordTitle}>{batch.quantity} × {batch.productName}</Text><Text style={styles.recordMeta}>{batch.productSku} · {dateLabel(batch.date)}</Text></Card>) : <Text style={styles.bodyText}>Your completed batches will appear here.</Text>}
    </>
  );

  const renderListings = () => {
    const activeListings = db.listings.filter(active);
    const source = showArchivedListings ? db.listings.filter((item) => !active(item)) : activeListings;
    const filters = attributeFilters.listings || {};
    const matchesListingAttribute = (item, key, selected) => {
      const product = db.products.find((row) => row.id === item.productId);
      return matchesAttributeFilter({ [key]: item[key] || (product && product[key]) || "" }, key, selected);
    };
    const list = sortRecords(
      source.filter((item) =>
        (listingStatusFilter === "All" || item.status === listingStatusFilter) &&
        (listingChannelFilter === "All" || (item.marketplaces || (item.marketplace ? String(item.marketplace).split(",").map((channel) => channel.trim()) : [])).includes(listingChannelFilter)) &&
        matchesListingAttribute(item, "colors", filters.colors || "All") &&
        matchesListingAttribute(item, "materials", filters.materials || "All") &&
        matchesListingAttribute(item, "sizes", filters.sizes || "All") &&
        matchesListingAttribute(item, "gender", filters.gender || "All") &&
        (!search || [item.productName, item.productSku, item.listingSku, ...(item.marketplaces || (item.marketplace ? [item.marketplace] : [])), item.status, item.startDate, item.colors, item.materials, item.condition, item.notes, ...(item.discountPlans || []).flatMap((plan) => [plan.percent, plan.startDate, plan.endDate, plan.notes])].join(" ").toLowerCase().includes(search.toLowerCase()))
      ),
      db.sortModes.listings
    );
    const pagedListings = pageRows("listings", list);
    const plans = activeListings.flatMap((listing) => [
      ...(listing.discountPlans || []).flatMap((discountPlan) => [
        { listing, discountPlan, date: discountPlan.startDate, kind: `${discountPlan.percent}% discount starts` },
        discountPlan.endDate ? { listing, discountPlan, date: discountPlan.endDate, kind: `${discountPlan.percent}% discount ends` } : null,
      ]),
      listing.relistDate ? { listing, date: listing.relistDate, kind: "Relist listing" } : null,
    ]).filter((plan) => plan && plan.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
    const scheduledDiscounts = activeListings.reduce((sum, item) => sum + (item.discountPlans || []).filter((plan) => plan.startDate && plan.startDate > TODAY).length, 0);
    const relistsDue = activeListings.filter((item) => item.relistDate && item.relistDate >= TODAY).length;
    const needsArchive = activeListings.filter((item) => item.needsArchive).length;
    const actualListings = activeListings.filter((item) => item.status === "Active" && !item.needsArchive && (!item.startDate || item.startDate <= TODAY)).length;
    const listingChannels = new Set(activeListings.flatMap((item) => item.marketplaces || (item.marketplace ? String(item.marketplace).split(",").map((channel) => channel.trim()) : [])).filter(Boolean));
    const representedProducts = new Set(activeListings.map((item) => item.productId).filter(Boolean));
    const combinedAskingPrices = activeListings.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const channelsForListing = (item) => Array.isArray(item.marketplaces) ? item.marketplaces : (item.marketplace ? String(item.marketplace).split(",").map((channel) => channel.trim()).filter(Boolean) : []);
    const payoutEstimatesForListing = (item, price) => channelsForListing(item).map((channel) => {
      const rule = (db.marketplaceFeeRules || {})[channel] || {};
      const fee = price * Math.max(0, asNumber(rule.percent, 0)) / 100 + Math.max(0, asNumber(rule.fixed, 0));
      return { channel, payout: Math.max(0, price - fee), configured: Number(rule.percent) > 0 || Number(rule.fixed) > 0 };
    });
    const editListing = (item) => beginEdit("listing", { ...item, price: String(item.price), marketplaces: item.marketplaces || (item.marketplace ? [item.marketplace] : []) });
    return (
      <>
        <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Listings, promotion plans, and relists</Text><Text style={styles.infoBannerText}>Search and filter your marketplace listings. Sold-out products are flagged here so you can archive a listing or relist it after making more stock.</Text><View style={styles.actionRow}><Action label="＋ Add listing" onPress={() => beginAdd("listing")} /><Action label="Listing analytics" quiet onPress={() => navigateToScreen("Listing Analytics")} /></View></View>
        <View style={styles.metricGrid}><Metric label="Live now" value={String(actualListings)} /><Metric label="Need archiving" value={String(needsArchive)} /><Metric label="Discounts planned" value={String(scheduledDiscounts)} /><Metric label="Relists coming up" value={String(relistsDue)} /></View>
        <View style={styles.metricGrid}><Metric label="Sales channels" value={String(listingChannels.size)} /><Metric label="Products represented" value={String(representedProducts.size)} /><Metric label="Combined asking prices" value={money(combinedAskingPrices, db.currency)} /></View>
         {needsArchive ? <Card><Text style={styles.cardTitle}>Sold-out listings need attention</Text>{activeListings.filter((item) => item.needsArchive).map((item) => {
           const product = db.products.find((entry) => entry.id === item.productId);
           return <View key={item.id} style={styles.soldOutListingRow}><View style={styles.soldOutListingInfo}><Text style={styles.recordTitle} numberOfLines={2}>{item.productName}</Text><Text style={styles.recordMeta}>{item.listingSku} · {item.marketplace || (item.marketplaces || []).join(", ") || "Marketplace not saved"} · out of stock</Text></View><View style={styles.soldOutListingActions}><Action label="Review" quiet onPress={() => openDetails("listing", item)} />{product && Number(product.inventory) > 0 ? <Action label="Relist now" onPress={() => setRelistEditor(item)} /> : product ? <Action label="Make more" quiet onPress={() => { setProductionProduct(product.id); navigateToScreen("Production"); }} /> : null}<Action label="Archive" quiet onPress={() => archiveRecord("listings", item, "listing")} /></View></View>;
         })}</Card> : null}
         <ChoiceChips label="Listings" options={[{ label: `Active · ${activeListings.length}`, value: false }, { label: `Archived · ${db.listings.length - activeListings.length}`, value: true }]} value={showArchivedListings} onChange={(showArchived) => { setShowArchivedListings(showArchived); setListingStatusFilter("All"); setListingChannelFilter("All"); }} />
         <ChoiceChips label="Listing status" options={["All", ...Array.from(new Set(source.map((item) => item.status || "Draft"))).sort()]} value={listingStatusFilter} onChange={setListingStatusFilter} />
         <ChoiceChips label="Sales channel" options={["All", ...Array.from(new Set(source.flatMap((item) => item.marketplaces || (item.marketplace ? String(item.marketplace).split(",").map((channel) => channel.trim()) : [])))).filter(Boolean).sort()]} value={listingChannelFilter} onChange={setListingChannelFilter} />
         <View style={styles.actionRow}><Action label={expandedAttributeFilters.listings ? "Hide attribute filters" : "Filter by color, material, size, or audience" + (attributeFilterCount("listings") ? " · " + attributeFilterCount("listings") + " active" : "")} quiet onPress={() => toggleAttributeFilters("listings")} />{attributeFilterCount("listings") ? <Action label="Clear filters" quiet onPress={() => clearAttributeFilters("listings")} /> : null}</View>
         {expandedAttributeFilters.listings ? <>
           <ChoiceChips label="Color" options={["All", ...attributeFilterOptions([...db.listings, ...db.products], "colors", "colors")]} value={filters.colors || "All"} onChange={(value) => setAttributeFilter("listings", "colors", value)} />
           <ChoiceChips label="Material" options={["All", ...attributeFilterOptions([...db.listings, ...db.products], "materials", "materials")]} value={filters.materials || "All"} onChange={(value) => setAttributeFilter("listings", "materials", value)} />
           <ChoiceChips label="Size" options={["All", ...attributeFilterOptions([...db.listings, ...db.products], "sizes", "sizes")]} value={filters.sizes || "All"} onChange={(value) => setAttributeFilter("listings", "sizes", value)} />
           <ChoiceChips label="Audience" options={["All", ...attributeFilterOptions([...db.listings, ...db.products], "genders", "gender")]} value={filters.gender || "All"} onChange={(value) => setAttributeFilter("listings", "gender", value)} />
         </> : null}
         <SortControl value={db.sortModes.listings} onChange={(value) => saveSortMode("listings", value)} />
        {plans.length ? <>
          <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Promotion &amp; relisting calendar</Text><Text style={styles.subtle}>{plans.length} upcoming</Text></View>
           {plans.slice(0, 12).map((plan, index) => <Card key={plan.listing.id + plan.kind + (plan.discountPlan ? plan.discountPlan.id : index)} style={styles.historyCard}>
             <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{plan.kind} · {plan.listing.productName}</Text><Text style={styles.recordMeta}>{dateLabel(plan.date)} · {(plan.listing.marketplaces || []).join(", ") || plan.listing.marketplace}</Text></View></View><View style={styles.actionRow}><Action label={plan.discountPlan ? "Edit discount" : "Edit relisting"} quiet onPress={() => plan.discountPlan ? openDiscountEditor(plan.listing, plan.discountPlan) : editListing(plan.listing)} /><Action label={plan.discountPlan ? "Delete discount" : "Delete relisting"} quiet onPress={() => plan.discountPlan ? deleteDiscountPlan(plan.listing, plan.discountPlan) : clearRelistDate(plan.listing)} /></View>
          </Card>)}
        </> : null}
        <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>{showArchivedListings ? "Archived listings" : "Your marketplace listings"}</Text></View>
        {pagedListings.length ? pagedListings.map((item) => (
          <Card key={item.id}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{item.productName}</Text><Text style={styles.recordMeta}>{item.listingSku || "LIST SKU missing"} · Product {item.productSku || "SKU not saved"}</Text><Text style={styles.recordMeta}>{item.marketplace || "Marketplace not saved"} · {item.price != null ? money(item.price, db.currency) : "Price not saved"} · {listingAgeText(item)}</Text>{(() => { const plans = item.discountPlans || []; const activePlan = plans.filter((plan) => plan.startDate <= TODAY && (!plan.endDate || plan.endDate >= TODAY)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0]; const price = Math.max(0, asNumber(item.price, 0)) * (activePlan ? 1 - Number(activePlan.percent) / 100 : 1); const estimates = payoutEstimatesForListing(item, price); return estimates.some((estimate) => estimate.configured) ? <Text numberOfLines={2} style={styles.recordMeta}>Est. after fees: {estimates.map((estimate) => estimate.channel + " " + money(estimate.payout, db.currency)).join(" · ")}</Text> : null; })()}</View><View style={{ alignItems: "flex-end", gap: 6 }}><Pill text={item.archived ? "Archived" : item.needsArchive ? "Sold · archive this listing" : item.status === "Paused" ? "Paused" : item.startDate && item.startDate > TODAY ? "Planned" : item.status || "Draft"} tone={item.needsArchive ? "red" : item.archived ? "neutral" : item.status === "Active" ? "green" : "amber"} /><Action label="Duplicate" quiet onPress={() => duplicateRecord("listing", item)} /><Action label="Edit" quiet onPress={() => editListing(item)} /></View></View>
            <View style={styles.actionRow}><Action label={expandedListingIds.includes(item.id) ? "Hide details" : "Show details"} quiet onPress={() => setExpandedListingIds((old) => old.includes(item.id) ? old.filter((id) => id !== item.id) : old.concat([item.id]))} /></View>
            {expandedListingIds.includes(item.id) ? <>
            {(() => {
              const discountPlans = item.discountPlans || [];
              const currentPlan = discountPlans.filter((plan) => plan.startDate <= TODAY && (!plan.endDate || plan.endDate >= TODAY)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
              const channels = channelsForListing(item);
              const currentPrice = Math.max(0, asNumber(item.price, 0)) * (currentPlan ? 1 - Number(currentPlan.percent) / 100 : 1);
              const payoutEstimates = payoutEstimatesForListing(item, currentPrice);
              const hasFeeEstimate = payoutEstimates.some((estimate) => estimate.configured);
              return <>
                <View style={styles.channelChipRow}>{channels.map((channel) => <View key={channel} style={styles.channelChip}><Text style={styles.channelChipText}>{channel}</Text></View>)}</View>
                <View style={styles.detailRow}><Text style={styles.detailText}>List price {money(item.price, db.currency)}</Text><Pill text={currentPlan ? `${currentPlan.percent}% off now` : `${discountPlans.length} discount plan${discountPlans.length === 1 ? "" : "s"}`} tone={currentPlan ? "green" : "neutral"} /></View>
                {currentPlan ? <Text style={styles.bodyText}>Current sale price: {money(Number(item.price) * (1 - Number(currentPlan.percent) / 100), db.currency)} · through {currentPlan.endDate ? dateLabel(currentPlan.endDate) : "no end date"}</Text> : null}
                <View style={styles.listingPayoutEstimate}><Text style={styles.fieldLabel}>Estimated payout after platform fees</Text>{hasFeeEstimate ? payoutEstimates.map((estimate) => <View key={estimate.channel} style={styles.listingPayoutRow}><Text style={styles.listingPayoutChannel}>{estimate.channel}</Text><Text style={styles.listingPayoutValue}>{money(estimate.payout, db.currency)}</Text></View>) : <Text style={styles.fieldHint}>Add optional fee rates in Settings → Business profile → Marketplaces and fees to see your estimated payout for each channel.</Text>}</View>
                <Text style={styles.recordMeta}>{listingAgeText(item)}</Text>
                {item.relistDate ? <Card style={styles.historyCard}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.fieldLabel}>Planned relisting</Text><Text style={styles.recordTitle}>{dateLabel(item.relistDate)}</Text></View>{item.relistDate < TODAY ? <Pill text="Late" tone="red" /> : <Pill text="Planned" tone="neutral" />}</View><View style={styles.actionRow}><Action label="Edit relist date" quiet onPress={() => editListing(item)} /><Action label="Delete relist plan" quiet onPress={() => clearRelistDate(item)} />{item.relistDate <= TODAY ? <Action label="Relist now" onPress={() => setRelistEditor(item)} /> : null}</View></Card> : null}
                 {item.relistHistory && item.relistHistory.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Relisting history</Text>{item.relistHistory.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).map((entry) => <View key={entry.id} style={styles.discountPlanRow}><View style={styles.flex}><Text style={styles.recordTitle}>Relisted {dateLabel(entry.date)} · {money(entry.newPrice, db.currency)}</Text><Text style={styles.recordMeta}>Active days restarted · {entry.packageWeight} {entry.packageWeightUnit || "oz"}</Text>{entry.note ? <Text style={styles.fieldHint}>{entry.note}</Text> : null}</View><Action label="Delete record" quiet onPress={() => deleteRelistHistoryEntry(item, entry)} /></View>)}</View> : null}
                {item.url ? <Text style={styles.recordMeta}>Listing link saved</Text> : null}
                {discountPlans.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Discount plans</Text><Text style={styles.fieldHint}>Each plan shows the total discount for its dates; overlapping percentages do not add together.</Text>{discountPlans.slice().sort((a, b) => a.startDate.localeCompare(b.startDate)).map((plan) => {
                  const isUpcoming = plan.startDate > TODAY;
                  const isEnded = plan.endDate && plan.endDate < TODAY;
                  const salePrice = Number(item.price) * (1 - Number(plan.percent) / 100);
                  return <View key={plan.id} style={styles.discountPlanRow}>
                    <View style={styles.flex}><Text style={styles.recordTitle}>{plan.percent}% off · {isEnded ? "Ended" : isUpcoming ? "Planned" : "Active now"}</Text><Text style={styles.recordMeta}>{dateLabel(plan.startDate)}{plan.endDate ? ` – ${dateLabel(plan.endDate)}` : " onward"} · {money(salePrice, db.currency)}</Text>{plan.notes ? <Text style={styles.fieldHint}>{plan.notes}</Text> : null}</View>
                     <Action label="Edit" quiet onPress={() => openDiscountEditor(item, plan)} />
                     <Action label="Delete" quiet onPress={() => deleteDiscountPlan(item, plan)} />
                  </View>;
                })}</View> : null}
              </>;
            })()}
             <View style={styles.actionRow}>{!item.archived ? <><Action label="＋ Add discount plan" onPress={() => openDiscountEditor(item, null)} /><Action label="Plan relist" quiet onPress={() => editListing(item)} />{item.needsArchive ? <>{Number((db.products.find((product) => product.id === item.productId) || {}).inventory) > 0 ? <Action label="Relist now" onPress={() => setRelistEditor(item)} /> : <Action label="Make more first" quiet onPress={() => { const product = db.products.find((entry) => entry.id === item.productId); if (product) { setProductionProduct(product.id); navigateToScreen("Production"); } }} />}<Action label="Archive sold listing" onPress={() => archiveRecord("listings", item, "listing")} /></> : null}<Action label="Archive" quiet onPress={() => archiveRecord("listings", item, "listing")} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("listings", item, "listing")} /></> : <Action label="Restore listing" onPress={() => restoreRecord("listings", item)} />}</View>
            </> : null}
          </Card>
        )) : <EmptyState title={showArchivedListings ? "No archived listings" : "No listings match this filter"} body="Change the status or search, or add a new listing." action={showArchivedListings ? undefined : "Create a listing"} onPress={showArchivedListings ? undefined : () => beginAdd("listing")} />}
        {pagedListings.length < list.length ? <View style={styles.actionRow}><Action label={"Show 60 more listings · " + (list.length - pagedListings.length) + " remaining"} quiet onPress={() => showMoreRows("listings")} /></View> : null}
      </>
    );
  };

  const listingAnalyticsChannels = (listing) => Array.from(new Set((Array.isArray(listing && listing.marketplaces) ? listing.marketplaces : String(listing && listing.marketplace || "").split(",")).map((channel) => String(channel || "").trim()).filter(Boolean)));
  const listingAnalyticsIsActive = (listing) => !!listing && active(listing) && listing.status === "Active" && !listing.needsArchive && (!listing.startDate || listing.startDate <= TODAY);
  const openAnalyticsEntry = (mode, listing, marketplace) => {
    const candidates = db.listings.filter(listingAnalyticsIsActive);
    if (!candidates.length) {
      Alert.alert("Add a listing first", "Create a marketplace listing before recording its statistics.");
      return;
    }
    const selected = listing || candidates[0];
    const channels = listingAnalyticsChannels(selected);
    const chosenMarketplace = marketplace || (analyticsMarketplaceFilter !== "All" && channels.includes(analyticsMarketplaceFilter) ? analyticsMarketplaceFilter : channels[0] || "");
    const now = new Date();
    setAnalyticsEntryMode(mode);
    setAnalyticsEntryListingId(selected.id);
    setAnalyticsEntryMarketplace(chosenMarketplace);
    setAnalyticsEntryDate(TODAY);
    setAnalyticsEntryTime(String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"));
    setAnalyticsEntryMetrics({});
    setAnalyticsEntryNote("");
    setAnalyticsBulkRows({});
  };
  const persistListingAnalyticsReports = (reports) => {
    if (!reports.length) return;
    setDb((old) => {
      const grouped = new Map();
      reports.forEach((report) => {
        if (!grouped.has(report.listingId)) grouped.set(report.listingId, []);
        grouped.get(report.listingId).push(report);
      });
      return {
        ...old,
        listings: old.listings.map((listing) => {
          const added = grouped.get(listing.id);
          if (!added) return listing;
          return {
            ...listing,
            activityReports: (listing.activityReports || []).concat(added),
            updatedAt: new Date().toISOString(),
            auditLog: (listing.auditLog || []).concat(added.map((report) => ({ id: uid("audit"), action: "Listing metrics recorded", date: report.createdAt, note: report.platform + " · " + Object.keys(report.metrics).length + " metrics" }))),
          };
        }),
      };
    });
  };
  const buildAnalyticsReport = (listingId, platform, date, time, metrics, note) => {
    const localMoment = new Date(date + "T" + time + ":00");
    return {
      id: uid("listing-report"), listingId, platform,
      periodType: "day", periodStart: date, periodEnd: date,
      metricMode: "snapshot", metrics,
      recordedAt: Number.isFinite(localMoment.getTime()) ? localMoment.toISOString() : new Date().toISOString(),
      note: String(note || "").trim(), createdAt: new Date().toISOString(),
    };
  };
  const saveAnalyticsEntry = () => {
    const date = parseDateInput(analyticsEntryDate);
    if (!date) { Alert.alert("Check the recording date", "Enter a valid date for when you checked the marketplace."); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(analyticsEntryTime || ""))) { Alert.alert("Check the recording time", "Enter a time in 24-hour HH:MM format, such as 14:30."); return; }
    const metricKeys = ["views", "clicks", "favorites", "likes", "watchers", "offers"];
    const reports = [];
    if (analyticsEntryMode === "single") {
      const listing = db.listings.find((item) => item.id === analyticsEntryListingId && listingAnalyticsIsActive(item));
      if (!listing || !listingAnalyticsChannels(listing).includes(analyticsEntryMarketplace)) { Alert.alert("Choose a listing and marketplace", "Select a saved listing and one of its marketplaces."); return; }
      const metrics = {};
      for (const key of metricKeys) {
        const raw = String(analyticsEntryMetrics[key] == null ? "" : analyticsEntryMetrics[key]).trim();
        if (!raw) continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) { Alert.alert("Check the metric values", "Enter zero or a positive whole number for each metric."); return; }
        metrics[key] = Math.floor(value);
      }
      if (!Object.keys(metrics).length) { Alert.alert("Enter at least one metric", "Leave unsupported metrics blank and enter the counts shown by the marketplace."); return; }
      reports.push(buildAnalyticsReport(listing.id, analyticsEntryMarketplace, date, analyticsEntryTime, metrics, analyticsEntryNote));
    } else {
      const listings = db.listings.filter((item) => listingAnalyticsIsActive(item) && listingAnalyticsChannels(item).includes(analyticsEntryMarketplace));
      for (const listing of listings) {
        const row = analyticsBulkRows[listing.id] || {};
        const metrics = {};
        for (const key of metricKeys) {
          const raw = String(row[key] == null ? "" : row[key]).trim();
          if (!raw) continue;
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0) { Alert.alert("Check the metric values", "Enter zero or a positive whole number for each metric. The listing " + listing.productName + " has an invalid value."); return; }
          metrics[key] = Math.floor(value);
        }
        if (Object.keys(metrics).length) reports.push(buildAnalyticsReport(listing.id, analyticsEntryMarketplace, date, analyticsEntryTime, metrics, analyticsEntryNote));
      }
      if (!reports.length) { Alert.alert("Nothing to save", "Enter at least one metric for a listing in this marketplace."); return; }
    }
    persistListingAnalyticsReports(reports);
    setAnalyticsEntryMode("");
  };

  const renderListingAnalytics = () => {
    const metricSpecs = LISTING_ANALYTICS_METRICS;
    const allListings = db.listings || [];
    const productsById = new Map((db.products || []).map((product) => [product.id, product]));
    const allReports = allListings.flatMap((listing) => (listing.activityReports || []).map((report) => ({ ...report, listingId: report.listingId || listing.id, listing })));
    const channelNames = Array.from(new Set(allListings.flatMap(listingAnalyticsChannels).concat(allReports.map((report) => report.platform).filter(Boolean)))).sort((a, b) => a.localeCompare(b));
    const categoryNames = Array.from(new Set(allListings.map((listing) => {
      const product = productsById.get(listing.productId);
      return product && product.category || "";
    }).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const todayDate = new Date(TODAY + "T12:00:00");
    let rangeStart = "";
    let rangeEnd = TODAY;
    if (analyticsRange === "7 days" || analyticsRange === "30 days") {
      const days = analyticsRange === "7 days" ? 6 : 29;
      const start = new Date(todayDate);
      start.setDate(start.getDate() - days);
      rangeStart = localDateKey(start);
    } else if (analyticsRange === "This month") {
      rangeStart = localDateKey(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
    } else if (analyticsRange === "Last month") {
      rangeStart = localDateKey(new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1));
      rangeEnd = localDateKey(new Date(todayDate.getFullYear(), todayDate.getMonth(), 0));
    } else if (analyticsRange === "Custom") {
      const customStart = parseDateInput(analyticsCustomStart) || TODAY;
      const customEnd = parseDateInput(analyticsCustomEnd) || TODAY;
      rangeStart = customStart <= customEnd ? customStart : customEnd;
      rangeEnd = customStart <= customEnd ? customEnd : customStart;
    }
    const inRange = (date) => !!date && (!rangeStart || date >= rangeStart) && date <= rangeEnd;
    const listingState = (listing) => listing.archived ? "Archived" : listing.needsArchive || listing.status === "Sold" ? "Sold" : listing.status || "Draft";
    const visibleListings = allListings.filter((listing) => {
      const product = productsById.get(listing.productId);
      const state = listingState(listing);
      const stateMatches = analyticsStatusFilter === "All"
        ? true
        : analyticsStatusFilter === "Active"
          ? active(listing) && state === "Active" && (!listing.startDate || listing.startDate <= TODAY)
          : state === analyticsStatusFilter;
      const categoryMatches = analyticsCategoryFilter === "All" || (product && product.category || "Other") === analyticsCategoryFilter;
      const marketplaceMatches = analyticsMarketplaceFilter === "All" || listingAnalyticsChannels(listing).includes(analyticsMarketplaceFilter) || (listing.activityReports || []).some((report) => report.platform === analyticsMarketplaceFilter);
      const searchMatches = !search || [listing.productName, listing.productSku, listing.listingSku, listing.marketplace, product && product.category].join(" ").toLowerCase().includes(search.toLowerCase());
      return stateMatches && categoryMatches && marketplaceMatches && searchMatches;
    });
    const visibleListingIds = new Set(visibleListings.map((listing) => listing.id));
    const filteredReports = allReports.filter((report) => visibleListingIds.has(report.listingId) && (analyticsMarketplaceFilter === "All" || report.platform === analyticsMarketplaceFilter));
    const reportsByListing = new Map();
    filteredReports.forEach((report) => {
      if (!reportsByListing.has(report.listingId)) reportsByListing.set(report.listingId, []);
      reportsByListing.get(report.listingId).push(report);
    });
    const metricHasComparable = new Set();
    const deltaEntries = [];
    const reportsByScope = new Map();
    filteredReports.forEach((report) => {
      const platform = report.platform || listingAnalyticsChannels(report.listing)[0] || "Marketplace not saved";
      const key = report.listingId + "::" + platform;
      if (!reportsByScope.has(key)) reportsByScope.set(key, []);
      reportsByScope.get(key).push({ ...report, platform, reportDate: report.recordedAt ? timestampDateKey(report.recordedAt) : parseDateInput(report.periodEnd || report.periodStart || report.date) });
    });
    reportsByScope.forEach((scopeReports) => {
      scopeReports.sort((a, b) => String(a.recordedAt || a.periodEnd || a.periodStart || "").localeCompare(String(b.recordedAt || b.periodEnd || b.periodStart || "")));
      const previousByMetric = {};
      scopeReports.forEach((report) => {
        metricSpecs.forEach(({ key }) => {
          const raw = report.metrics && report.metrics[key];
          if (!Number.isFinite(Number(raw)) || raw == null) return;
          const current = Math.max(0, Number(raw));
          if (report.metricMode === "period") {
            const periodDate = parseDateInput(report.periodEnd || report.periodStart || report.reportDate);
            if (inRange(periodDate)) {
              metricHasComparable.add(key);
              deltaEntries.push({ listing: report.listing, listingId: report.listingId, platform: report.platform, key, value: current, date: periodDate, report });
            }
          } else {
            const previous = previousByMetric[key];
            if (previous != null) {
              const delta = current >= previous.value ? current - previous.value : current;
              if (inRange(report.reportDate)) {
                metricHasComparable.add(key);
                deltaEntries.push({ listing: report.listing, listingId: report.listingId, platform: report.platform, key, value: delta, date: report.reportDate, report, reset: current < previous.value });
              }
            }
            previousByMetric[key] = { value: current, date: report.reportDate };
          }
        });
      });
    });
    const metricTotals = Object.fromEntries(metricSpecs.map(({ key }) => [key, deltaEntries.filter((entry) => entry.key === key).reduce((sum, entry) => sum + entry.value, 0)]));
    const latestReport = (listing, platform) => {
      const scopePlatform = platform || listingAnalyticsChannels(listing)[0] || "Marketplace not saved";
      const scopeReports = reportsByScope.get(listing.id + "::" + scopePlatform);
      return scopeReports && scopeReports.length ? scopeReports[scopeReports.length - 1] : null;
    };
    const rankGroups = new Map();
    deltaEntries.filter((entry) => entry.key === analyticsRankMetric).forEach((entry) => {
      const id = entry.listingId + "::" + entry.platform;
      const current = rankGroups.get(id) || { listing: entry.listing, platform: entry.platform, value: 0 };
      current.value += entry.value;
      rankGroups.set(id, current);
    });
    const topPerformers = Array.from(rankGroups.values()).sort((a, b) => b.value - a.value).slice(0, 5);
    const chartGroups = new Map();
    deltaEntries.filter((entry) => entry.key === analyticsChartMetric).forEach((entry) => chartGroups.set(entry.date, (chartGroups.get(entry.date) || 0) + entry.value));
    const chartPoints = Array.from(chartGroups.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
    const chartMax = Math.max(1, ...chartPoints.map((entry) => entry[1]));
    const recentReports = filteredReports.slice().sort((a, b) => String(b.recordedAt || b.periodEnd || b.periodStart || "").localeCompare(String(a.recordedAt || a.periodEnd || a.periodStart || ""))).slice(0, 10);
    const needsCheck = visibleListings.filter(listingAnalyticsIsActive).flatMap((listing) => {
      const channels = analyticsMarketplaceFilter === "All" ? listingAnalyticsChannels(listing) : [analyticsMarketplaceFilter];
      return channels.filter((platform) => {
        const latest = latestReport(listing, platform);
        if (!latest) return true;
        const lastDate = latest.recordedAt ? timestampDateKey(latest.recordedAt) : parseDateInput(latest.periodEnd || latest.periodStart);
        if (!lastDate) return true;
        const daysSince = Math.floor((todayDate.getTime() - new Date(lastDate + "T12:00:00").getTime()) / 86400000);
        return daysSince >= 14;
      }).map((platform) => ({ listing, platform, latest: latestReport(listing, platform) }));
    }).slice(0, 10);
    const analyticsSales = (db.orders || []).filter((order) => !order.archived && inRange(parseDateInput(order.date)) && (analyticsMarketplaceFilter === "All" || order.marketplace === analyticsMarketplaceFilter)).reduce((sum, order) => sum + (order.items || []).filter((item) => visibleListingIds.has(item.listingId || order.listingId)).reduce((subtotal, item) => subtotal + (Number(item.quantity) || 0), 0), 0);
    const analyticsPageSize = 12;
    const pagedAnalyticsListings = visibleListings.slice(0, recordPageLimits.listingAnalytics || analyticsPageSize);
    return <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Understand which listings are getting attention</Text><Text style={styles.infoBannerText}>Enter the totals shown by each marketplace. GRIMMS keeps every check and calculates changes between snapshots, so the first check becomes a starting point instead of being counted as new activity.</Text><View style={styles.actionRow}><Action label="＋ Record metrics" onPress={() => openAnalyticsEntry("single")} /><Action label="▤ Bulk record" quiet onPress={() => openAnalyticsEntry("bulk")} /></View></View>
      <ChoiceChips label="Reporting period" options={["7 days", "30 days", "This month", "Last month", "Custom", "All time"]} value={analyticsRange} onChange={setAnalyticsRange} />
      {analyticsRange === "Custom" ? <View style={styles.analyticsDateRange}><View style={styles.flex}><Field field={{ label: "From", date: true }} value={analyticsCustomStart} onChange={setAnalyticsCustomStart} /></View><View style={styles.flex}><Field field={{ label: "Through", date: true }} value={analyticsCustomEnd} onChange={setAnalyticsCustomEnd} /></View></View> : null}
      <ChoiceChips label="Marketplace" options={["All", ...channelNames]} value={analyticsMarketplaceFilter} onChange={setAnalyticsMarketplaceFilter} />
      <ChoiceChips label="Category" options={["All", ...categoryNames]} value={analyticsCategoryFilter} onChange={setAnalyticsCategoryFilter} />
      <ChoiceChips label="Listing status" options={["Active", "All", "Paused", "Sold", "Archived"]} value={analyticsStatusFilter} onChange={setAnalyticsStatusFilter} />
      <Text style={styles.fieldHint}>Range: {rangeStart ? dateLabel(rangeStart) : "all recorded history"} – {dateLabel(rangeEnd)}. Snapshot increases are assigned to the later check; gaps are not filled in.</Text>
      <View style={styles.metricGrid}>{metricSpecs.map((metric) => <Metric key={metric.key} label={metric.label} value={metricHasComparable.has(metric.key) ? String(metricTotals[metric.key]) : "—"} sub={metricHasComparable.has(metric.key) ? "increase between checks" : filteredReports.some((report) => report.metrics && report.metrics[metric.key] != null) ? "record another check" : "not recorded"} />)}</View>
      <View style={styles.metricGrid}><Metric label="Sales linked to listings" value={String(analyticsSales)} sub="units in selected period" /><Metric label="Listings shown" value={String(visibleListings.length)} sub="match the selected filters" /></View>
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Listing engagement over time</Text></View>
      <Card style={styles.chartCard}>
        <ChoiceChips label="Metric" options={metricSpecs.map((metric) => ({ label: metric.label, value: metric.key }))} value={analyticsChartMetric} onChange={setAnalyticsChartMetric} />
        {chartPoints.length ? <View style={styles.chartRow}>{chartPoints.map(([date, value]) => <View key={date} style={styles.chartColumn}><Text style={styles.chartValue}>{value}</Text><View style={styles.chartTrack}><View style={[styles.chartBar, { height: Math.max(4, Math.round(82 * value / chartMax)) }]} /></View><Text style={styles.chartLabel}>{date.slice(5)}</Text></View>)}</View> : <Text style={styles.bodyText}>Two checks are needed before a snapshot trend can be calculated. Period totals you enter are shown as recorded.</Text>}
      </Card>
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Top performers</Text></View>
      <ChoiceChips label="Rank by" options={metricSpecs.map((metric) => ({ label: metric.label, value: metric.key }))} value={analyticsRankMetric} onChange={setAnalyticsRankMetric} />
      {topPerformers.length ? topPerformers.map((entry, index) => <Card key={entry.listing.id + entry.platform} style={styles.historyCard}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{index + 1}. {entry.listing.productName}</Text><Text style={styles.recordMeta}>{entry.listing.listingSku || "Listing"} · {entry.platform} · {money(entry.listing.price, db.currency)}</Text></View><Pill text={String(entry.value) + " " + (metricSpecs.find((metric) => metric.key === analyticsRankMetric) || {}).label.toLowerCase()} tone="green" /></View><Action label="View listing history" quiet onPress={() => setAnalyticsExpandedListingId(analyticsExpandedListingId === entry.listing.id ? "" : entry.listing.id)} /></Card>) : <Text style={styles.bodyText}>No comparable increases for this metric and period yet. Add a second check to establish a trend.</Text>}
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>All product analytics</Text><Text style={styles.subtle}>{visibleListings.length} listings</Text></View>
      {visibleListings.length ? pagedAnalyticsListings.map((listing) => {
        const reports = reportsByListing.get(listing.id) || [];
        const platforms = analyticsMarketplaceFilter === "All" ? Array.from(new Set(listingAnalyticsChannels(listing).concat(reports.map((report) => report.platform).filter(Boolean)))) : [analyticsMarketplaceFilter];
        const product = productsById.get(listing.productId);
        const expanded = analyticsExpandedListingId === listing.id;
        return <Card key={listing.id}>
          <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{listing.productName}</Text><Text style={styles.recordMeta}>{listing.listingSku || "Listing SKU not saved"} · {product && product.category || "Uncategorized"} · {money(listing.price, db.currency)}</Text></View><Pill text={listingState(listing)} tone={listingState(listing) === "Active" ? "green" : "neutral"} /></View>
          {platforms.length ? platforms.map((platform) => {
            const latest = latestReport(listing, platform);
            const recordedAt = latest && (latest.recordedAt || latest.periodEnd || latest.periodStart);
            return <View key={platform} style={styles.analyticsPlatformBlock}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.listingPayoutChannel}>{platform}</Text><Text style={styles.recordMeta}>{recordedAt ? "Last checked " + dateLabel(timestampDateKey(recordedAt) || recordedAt) : "No metrics recorded yet"}</Text></View>{listingAnalyticsIsActive(listing) ? <Action label="＋ Record" quiet onPress={() => openAnalyticsEntry("single", listing, platform)} /> : null}</View><View style={styles.analyticsMiniGrid}>{metricSpecs.map((metric) => <View key={metric.key} style={styles.analyticsMiniMetric}><Text style={styles.analyticsMiniValue}>{latest && latest.metrics && latest.metrics[metric.key] != null ? String(latest.metrics[metric.key]) : "—"}</Text><Text style={styles.analyticsMiniLabel}>{metric.label}</Text></View>)}</View></View>;
          }) : <Text style={styles.bodyText}>No marketplace is attached to this listing yet.</Text>}
          <View style={styles.actionRow}><Action label={expanded ? "Hide recording history" : "Show recording history"} quiet onPress={() => setAnalyticsExpandedListingId(expanded ? "" : listing.id)} /><Action label="Open listing details" quiet onPress={() => openDetails("listing", listing)} /></View>
          {expanded ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Recording history</Text>{reports.length ? reports.slice().sort((a, b) => String(b.recordedAt || b.periodEnd || b.periodStart || "").localeCompare(String(a.recordedAt || a.periodEnd || a.periodStart || ""))).map((report) => <View key={report.id} style={styles.analyticsHistoryRow}><View style={styles.flex}><Text style={styles.recordTitle}>{report.platform || "Marketplace"} · {report.recordedAt ? new Date(report.recordedAt).toLocaleString() : dateLabel(report.periodEnd || report.periodStart)}</Text><Text style={styles.recordMeta}>{metricSpecs.filter((metric) => report.metrics && report.metrics[metric.key] != null).map((metric) => metric.label + " " + report.metrics[metric.key]).join(" · ") || "No values entered"}</Text>{deltaEntries.some((entry) => entry.report.id === report.id && entry.reset) ? <Text style={styles.fieldHint}>A counter decreased since the previous check. Its new value is treated as activity after the reset.</Text> : null}{report.note ? <Text style={styles.fieldHint}>{report.note}</Text> : null}</View></View>) : <Text style={styles.bodyText}>No checks saved for this listing yet.</Text>}</View> : null}
        </Card>;
      }) : <EmptyState title="No listings match these filters" body="Add a listing or adjust the marketplace, category, status, or search filters." action="Add a listing" onPress={() => beginAdd("listing")} />}
      {pagedAnalyticsListings.length < visibleListings.length ? <View style={styles.actionRow}><Action label={"Show 12 more listings · " + (visibleListings.length - pagedAnalyticsListings.length) + " remaining"} quiet onPress={() => setRecordPageLimits((old) => ({ ...old, listingAnalytics: (old.listingAnalytics || analyticsPageSize) + analyticsPageSize }))} /></View> : null}
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Needs a check</Text><Text style={styles.subtle}>No check in 14+ days</Text></View>
      {needsCheck.length ? needsCheck.map(({ listing, platform, latest }) => <Card key={listing.id + "::" + platform} style={styles.historyCard}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{listing.productName}</Text><Text style={styles.recordMeta}>{platform} · {latest ? "Last checked " + dateLabel(timestampDateKey(latest.recordedAt) || latest.periodEnd || latest.periodStart) : "Never checked"}</Text></View><Action label="＋ Record" quiet onPress={() => openAnalyticsEntry("single", listing, platform)} /></View></Card>) : <Text style={styles.bodyText}>All visible active listings have a recent check.</Text>}
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Recent recordings</Text></View>
      {recentReports.length ? recentReports.map((report) => <Card key={report.id} style={styles.historyCard}><Text style={styles.recordTitle}>{report.listing && report.listing.productName || "Listing"} · {report.platform || "Marketplace"}</Text><Text style={styles.recordMeta}>{report.recordedAt ? new Date(report.recordedAt).toLocaleString() : dateLabel(report.periodEnd || report.periodStart)} · {metricSpecs.filter((metric) => report.metrics && report.metrics[metric.key] != null).map((metric) => metric.label + " " + report.metrics[metric.key]).join(" · ")}</Text></Card>) : <Text style={styles.bodyText}>Your saved metric checks will appear here.</Text>}
    </>;
  };

  const renderOrders = () => {
    const activeOrders = db.orders.filter((order) => !order.archived);
    const orderScope = db.orders.filter((order) => showArchivedOrders ? !!order.archived : !order.archived).filter(orderMatchesSelectedPhase);
    const payoutTotal = orderScope.reduce((sum, order) => sum + netOrderPayout(order), 0);
    const scopedOrderIds = new Set(orderScope.map((order) => order.id));
    const mappedStatuses = new Set(DASHBOARD_FULFILLMENT_PHASES.flatMap((phase) => phase.statuses));
    const customStatuses = Array.from(new Set(activeOrders.map((order) => order.status || "Needs Packaging"))).filter((status) => !mappedStatuses.has(status)).sort();
    const statusOptions = [{ label: "All statuses", value: "All" }, ...DASHBOARD_FULFILLMENT_PHASES.map((phase) => ({ label: phase.label, value: phase.label })), ...customStatuses.map((status) => ({ label: status, value: status }))];
    const pagedOrders = pageRows("orders", visibleOrders);
    return (
    <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>{orderStatusFilter === "All" ? "Orders and fulfillment" : `Showing only: ${orderStatusFilter}`}</Text><Text style={styles.infoBannerText}>{orderStatusFilter === "All" ? "Each saved sale reduces finished inventory. Expand an order for price discounts, payouts, shipping, refunds, and its complete history." : "These orders match only this fulfillment phase. Each card shows the date it entered the current phase."}</Text><View style={styles.actionRow}><Action label="＋ Record sale" onPress={() => beginAdd("order")} />{orderStatusFilter !== "All" ? <><Action label="← Back to dashboard" quiet onPress={() => { setOrderStatusFilter("All"); navigateRoot("Dashboard"); }} /><Action label="Show all statuses" quiet onPress={() => setOrderStatusFilter("All")} /></> : null}</View></View>
      <View style={styles.metricGrid}><Metric label="Sales recorded" value={String(orderScope.length)} /><Metric label="Need attention" value={String(orderNeedsAttention.filter((order) => scopedOrderIds.has(order.id)).length)} /><Metric label="Gross sales" value={money(orderScope.reduce((sum, order) => sum + totalOrder(order), 0), db.currency)} /><Metric label="Refunds" value={money(orderScope.reduce((sum, order) => sum + (Number(order.refundAmount) || 0), 0), db.currency)} /></View>
        <View style={styles.metricGrid}><Metric label="Payout after fees" value={money(payoutTotal, db.currency)} sub="Actual where entered; otherwise estimated" /><Metric label="Fees" value={money(orderScope.reduce((sum, order) => sum + (Number(order.fees) || 0), 0), db.currency)} /><Metric label="Shipping paid" value={money(orderScope.reduce((sum, order) => sum + (Number(order.shippingCost) || 0), 0), db.currency)} /><Metric label="Units sold" value={String(orderScope.reduce((sum, order) => sum + (order.items || []).reduce((lineSum, item) => lineSum + (Number(item.quantity) || 0), 0), 0))} /></View>
      <ChoiceChips label="Fulfillment status" options={statusOptions} value={orderStatusFilter} onChange={setOrderStatusFilter} />
      <ChoiceChips label="Order list" options={[{ label: `Active (${activeOrders.length})`, value: false }, { label: `Archived (${db.orders.filter((order) => order.archived).length})`, value: true }]} value={showArchivedOrders} onChange={(value) => { setShowArchivedOrders(value); setOrderStatusFilter("All"); }} />
      <SortControl value={db.sortModes.orders} onChange={(value) => saveSortMode("orders", value)} />
      {pagedOrders.length ? pagedOrders.map((order) => {
        const expanded = expandedOrderIds.includes(order.id);
        const currentIndex = fulfillmentStatuses.indexOf(order.status);
        const nextStatus = fulfillmentStatuses[Math.max(0, currentIndex + 1)] || "Fulfilled";
        const statusEntered = (order.timeline || []).slice().reverse().find((step) => step.status === order.status);
        const statusEnteredDate = statusEntered && (parseDateInput(statusEntered.date) || timestampDateKey(statusEntered.date) || timestampDateKey(statusEntered.enteredAt)) || timestampDateKey(order.updatedAt) || timestampDateKey(order.createdAt) || parseDateInput(order.date) || order.date;
        const items = order.items || [];
        return <Card key={order.id} style={styles.compactOrderCard}>
          <View style={styles.cardTop}>
            <Pressable style={styles.flex} onPress={() => toggleOrderExpanded(order.id)}>
              <Text style={styles.recordTitle}>{items.map((item) => item.productName).join(", ") || "Sale"}</Text>
              <Text style={styles.recordMeta}>{order.orderSku || "ORDER SKU missing"} · {items.map((item) => item.productSku).filter(Boolean).join(", ") || "Product SKU not saved"} · {order.marketplace || "Direct"} · {dateLabel(order.date)}</Text>
              <Text style={styles.recordMeta}>Entered {order.status || "current phase"} {dateLabel(statusEnteredDate)}</Text>
            </Pressable>
            <Pill text={order.status} tone={order.refundedAt ? "red" : ["Fulfilled", "Complete"].includes(order.status) ? "green" : "amber"} />
          </View>
            <View style={styles.detailRow}><Text style={styles.detailText}>{money(totalOrder(order), db.currency)} gross</Text><Text style={styles.detailText}>{money(netOrderPayout(order), db.currency)} after fees and refunds</Text></View>
          <View style={styles.actionRow}>
            <Action label={expanded ? "Hide details" : "Show details"} quiet onPress={() => toggleOrderExpanded(order.id)} />
            <Action label="Full view" quiet onPress={() => openDetails("order", order)} />
            {!order.refundedAt && !["Fulfilled", "Complete"].includes(order.status) ? <Action label={"Next: " + nextStatus} onPress={() => updateOrderStatus(order)} /> : null}
          </View>
          {expanded ? <>
            <View style={styles.detailLine}><Text style={styles.detailLabel}>Customer</Text><Text style={styles.detailValue}>{order.customer || "Not saved"}</Text></View>
            <View style={styles.detailLine}><Text style={styles.detailLabel}>Tracking ID</Text><Text style={styles.detailValue}>{order.trackingNumber || "Not saved"}</Text></View>
            <View style={styles.detailLine}><Text style={styles.detailLabel}>Carrier</Text><Text style={styles.detailValue}>{order.trackingCarrier || "Not saved"}</Text></View>
            <View style={styles.detailLine}><Text style={styles.detailLabel}>Tracking link</Text><Text style={styles.detailValue}>{order.trackingUrl || "Not saved"}</Text></View>
            <View style={styles.detailLine}><Text style={styles.detailLabel}>Payment / delivery</Text><Text style={styles.detailValue}>{[order.paymentMethod, order.shippingMethod].filter(Boolean).join(" · ") || "Not saved"}</Text></View>
            <View style={styles.detailLine}><Text style={styles.detailLabel}>Final packaged weight</Text><Text style={styles.detailValue}>{order.packageWeight ? order.packageWeight + " " + (order.packageWeightUnit || "oz") : "Not entered"}</Text></View>
            {items.map((item, index) => <View key={item.productId + index} style={styles.detailLine}><Text style={styles.detailLabel}>{item.quantity} × {item.productName} · {item.productSku}{Number(item.discountPercent) > 0 ? " · " + Number(item.discountPercent).toFixed(2) + "% off" : ""}{item.listingSku ? " · Listing " + item.listingSku : ""}</Text><Text style={styles.detailValue}>{money(item.unitPrice, db.currency)} each{item.originalPrice != null && Number(item.originalPrice) > Number(item.unitPrice) ? " · was " + money(item.originalPrice, db.currency) : ""}</Text></View>)}
            <Text style={styles.recordMeta}>{order.feeSource === "actual" ? "Actual fees" : "Estimated fees"} {money(order.fees || 0, db.currency)} · Marketplace estimate {money(order.estimatedMarketplaceFees || 0, db.currency)} · Extra estimate {money(order.extraFees || 0, db.currency)} · Shipping paid {money(order.shippingCost || 0, db.currency)}</Text>
            <Text style={styles.recordMeta}>{order.actualPayout != null ? "Actual payout entered: " + money(order.actualPayout, db.currency) : "Estimated payout after fees and refunds: " + money(netOrderPayout(order), db.currency)}</Text>
            {Number(order.refundAmount) > 0 ? <Text style={styles.recordMeta}>Refunded {money(order.refundAmount, db.currency)}{order.returnedQuantity ? ` · ${order.returnedQuantity} returned` : ""}{order.restockedQuantity ? ` · ${order.restockedQuantity} restocked` : ""}</Text> : null}
            <View style={styles.actionRow}>{!order.archived && !order.refundedAt && !(Number(order.refundAmount) > 0) && items.length <= 1 ? <Action label="Edit sale" quiet onPress={() => beginEdit("order", order)} /> : null}{!order.archived && !order.refundedAt ? <Action label="Record refund or return" onPress={() => setRefundEditor(order)} /> : null}{order.archived ? <Action label="Restore order" onPress={() => restoreRecord("orders", order)} /> : <Action label="Archive order" quiet onPress={() => archiveRecord("orders", order, "order")} />}<Action label="Delete accidental sale" quiet onPress={() => permanentlyDeleteRecord("orders", order, "order")} /></View>
            {order.refundHistory && order.refundHistory.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Refund and return history</Text>{order.refundHistory.map((entry) => <View key={entry.id} style={styles.discountPlanRow}><View style={styles.flex}><Text style={styles.recordTitle}>{money(entry.amount, db.currency)} refunded · {entry.returnedQuantity || 0} returned · {entry.restockQuantity || 0} restocked</Text><Text style={styles.recordMeta}>{dateLabel(entry.date)}{entry.note ? ` · ${entry.note}` : ""}</Text></View></View>)}</View> : null}
            <Field field={{ label: "Sale notes", multiline: true, placeholder: "Example: gift wrap requested" }} value={order.notes || ""} onChange={(notes) => saveOrderNotes(order, notes)} />
            <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Progress history · shown on Calendar</Text>{(order.timeline || []).map((step, index) => { const stepDate = parseDateInput(step.date) || timestampDateKey(step.date) || timestampDateKey(step.enteredAt) || timestampDateKey(order.updatedAt) || timestampDateKey(order.createdAt) || parseDateInput(order.date) || order.date; return <View key={step.status + index} style={styles.discountPlanRow}><View style={styles.flex}><Text style={styles.recordTitle}>✓ {step.status}</Text><Pressable accessibilityRole="button" accessibilityLabel={"Edit date and status for " + step.status} onPress={() => setTimelineEditor({ orderId: order.id, index, date: stepDate, status: step.status })}><Text style={styles.actionText}>Edit status/date · {dateLabel(stepDate)}</Text></Pressable></View><View style={styles.actionRow}><Action label="Delete entry" quiet onPress={() => deleteOrderTimelineStep(order, index)} /></View></View>; })}</View>
            {!order.refundedAt ? <Field field={{ label: "Fulfillment status", optionSet: "fulfillmentStatuses", options: fulfillmentStatuses.map((status) => ({ label: status, value: status })) }} value={order.status} onChange={(status) => setOrderStatus(order, status)} onManageOptions={manageDropdownFromField} /> : <Text style={styles.bodyText}>Refund recorded {dateLabel(order.refundedAt)}</Text>}
            {order.auditLog && order.auditLog.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>Corrections</Text>{order.auditLog.map((entry) => <Text key={entry.id} style={styles.recordMeta}>{entry.action} · {dateLabel(entry.date)}{entry.note ? ` · ${entry.note}` : ""}</Text>)}</View> : null}
          </> : null}
        </Card>;
      }) : <EmptyState title={showArchivedOrders ? "No archived orders" : "No orders match this filter"} body="Change the status filter or record a sale to update inventory, revenue, and the order timeline." action={showArchivedOrders ? undefined : "Record a sale"} onPress={showArchivedOrders ? undefined : () => beginAdd("order")} />}
      {pagedOrders.length < visibleOrders.length ? <View style={styles.actionRow}><Action label={"Show 60 more orders · " + (visibleOrders.length - pagedOrders.length) + " remaining"} quiet onPress={() => showMoreRows("orders")} /></View> : null}
    </>
    );
  };
  const renderFulfillmentStatus = (viewType, label) => {
    const phase = viewType === "phase" ? DASHBOARD_FULFILLMENT_PHASES.find((item) => item.label === label) : null;
    const statuses = phase ? phase.statuses : [label];
    const query = search.trim().toLowerCase();
    const orders = sortRecords(db.orders.filter((order) => !order.archived && !order.refundedAt && statuses.includes(order.status)).filter((order) => {
      if (!query) return true;
      return [order.orderSku, order.status, order.marketplace, order.customer, ...(order.items || []).flatMap((item) => [item.productName, item.productSku])].join(" ").toLowerCase().includes(query);
    }), db.sortModes.orders);
    const productRows = orders.flatMap((order) => (order.items || []).map((item, index) => ({ order, item, index })));
    const unitCount = productRows.reduce((sum, row) => sum + (Number(row.item.quantity) || 0), 0);
    return <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>{label} products</Text><Text style={styles.infoBannerText}>Only products attached to active, unrefunded sales in {label.toLowerCase()} appear here. Each row is one product, with its sale reference for context.</Text><View style={styles.actionRow}><Action label="← Dashboard" quiet onPress={() => navigateRoot("Dashboard")} /><Action label="All orders" quiet onPress={() => { setOrderStatusFilter("All"); setSearch(""); navigateToScreen("Orders"); }} /></View></View>
      <View style={styles.metricGrid}><Metric label="Orders" value={String(orders.length)} /><Metric label="Products" value={String(productRows.length)} /><Metric label="Units" value={String(unitCount)} /><Metric label="Order value" value={money(orders.reduce((sum, order) => sum + totalOrder(order), 0), db.currency)} /></View>
      {productRows.length ? productRows.map(({ order, item, index }) => {
        const statusEntered = (order.timeline || []).slice().reverse().find((step) => step.status === order.status);
        const currentIndex = fulfillmentStatuses.indexOf(order.status);
        const nextStatus = fulfillmentStatuses[Math.max(0, currentIndex + 1)] || "Fulfilled";
        return <Card key={order.id + ":" + item.productId + ":" + index} style={styles.compactOrderCard}>
          <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{item.productName || "Product"}</Text><Text style={styles.recordMeta}>{item.productSku || "Product SKU not saved"}{item.listingSku ? " · Listing " + item.listingSku : ""} · Quantity {item.quantity}</Text><Text style={styles.recordMeta}>{order.orderSku || "ORDER SKU missing"} · {order.marketplace || "Direct"} · {dateLabel(order.date)}</Text><Text style={styles.recordMeta}>In {order.status} since {dateLabel(statusEntered ? statusEntered.date : order.date)}</Text></View><Pill text={order.status} tone="amber" /></View>
          <View style={styles.detailRow}><Text style={styles.detailText}>{money((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0), db.currency)} product total</Text><Text style={styles.detailText}>{order.trackingNumber ? "Tracking saved" : "No tracking saved"}</Text></View>
          <View style={styles.actionRow}><Action label="Order details" quiet onPress={() => openDetails("order", order)} />{!order.refundedAt && !["Fulfilled", "Complete"].includes(order.status) ? <Action label={"Next: " + nextStatus} onPress={() => updateOrderStatus(order)} /> : null}</View>
        </Card>;
      }) : <EmptyState title={query ? "No products match this search" : "No products in this status"} body={query ? "Clear the search to see all products in this status." : "Orders will appear here when their fulfillment status changes to " + label + "."} />}
    </>;
  };
  const renderFinances = () => {
    const bounds = financePeriod === "all" ? null : periodDateRange(financePeriod, financeAnchor);
    const withinRange = (date) => financePeriod === "all" || (!!date && !!bounds && date >= bounds.start && date <= bounds.end);
    const orders = db.orders.filter((order) => withinRange(order.date));
    const incomes = (db.incomes || []).filter((income) => withinRange(income.date));
    const expenses = db.expenses.filter((expense) => withinRange(expense.date));
    const gross = orders.reduce((sum, order) => sum + totalOrder(order), 0);
    const refunds = orders.reduce((sum, order) => sum + (Number(order.refundAmount) || 0), 0);
    const fees = orders.reduce((sum, order) => sum + (Number(order.fees) || 0), 0);
    const shipping = orders.reduce((sum, order) => sum + (Number(order.shippingCost) || 0), 0);
    const materialCosts = orders.reduce((sum, order) => sum + orderMaterialCost(order), 0);
    const otherIncome = incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const salesDeductionExpenses = expenses.filter((item) => item.expenseType === "salesDeduction");
    const outOfPocketExpenses = expenses.filter((item) => item.expenseType !== "salesDeduction");
    const salesDeductionExpenseTotal = salesDeductionExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const outOfPocketExpenseTotal = outOfPocketExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const payout = orders.reduce((sum, order) => sum + netOrderPayout(order), 0);
    const netAfterFees = gross - refunds - fees;
    const estimatedProfit = netAfterFees - shipping - salesDeductionExpenseTotal - outOfPocketExpenseTotal - materialCosts;
    const periodLabel = financePeriod === "all" ? "All time" : financePeriod === "day" ? dateLabel(financeAnchor) : bounds ? dateLabel(bounds.start) + " – " + dateLabel(bounds.end) : "Choose a date";
    const shiftPeriod = (delta) => {
      const date = new Date(financeAnchor + "T12:00:00");
      if (financePeriod === "day") date.setDate(date.getDate() + delta);
      else if (financePeriod === "week") date.setDate(date.getDate() + delta * 7);
      else if (financePeriod === "month") date.setMonth(date.getMonth() + delta);
      else date.setFullYear(date.getFullYear() + delta);
      setFinanceAnchor(localDateKey(date));
    };
    const query = search.trim().toLowerCase();
    const visibleExpenseRows = sortRecords(expenses.filter((item) => !query || [item.description, item.category, item.notes].join(" ").toLowerCase().includes(query)), db.sortModes.expenses);
    const visibleIncomeRows = sortRecords(incomes.filter((item) => !query || [item.description, item.category, item.notes].join(" ").toLowerCase().includes(query)), db.sortModes.incomes || "newest");
    const financeRows = (rows) => rows.map(([label, amount, hint]) => <View key={label} style={styles.financeBreakdownRow}><View style={styles.flex}><Text style={styles.financeBreakdownLabel}>{label}</Text>{hint ? <Text style={styles.financeBreakdownHint}>{hint}</Text> : null}</View><Text style={styles.financeBreakdownValue}>{money(amount, db.currency)}</Text></View>);
    return <>
      <ScreenDashboardHeader title="Finances" description="Review gross sales, fees, refunds, shipping, business expenses, and saved recipe costs for the selected period." metrics={[
        { label: "Gross sales", value: money(gross, db.currency) },
        { label: "Fees and refunds", value: money(fees + refunds, db.currency) },
        { label: "Material costs", value: money(materialCosts, db.currency) },
        { label: "Estimated profit", value: money(estimatedProfit, db.currency), color: estimatedProfit < 0 ? COLORS.red : COLORS.green },
      ]} actions={[
        { label: "＋ Add expense", onPress: () => beginAdd("expense", { date: financePeriod === "all" ? TODAY : financeAnchor }) },
        { label: "＋ Add income", onPress: () => beginAdd("income", { date: financePeriod === "all" ? TODAY : financeAnchor }), quiet: true },
      ]} />
      <ChoiceChips label="Reporting period" options={[{ label: "Daily", value: "day" }, { label: "Weekly", value: "week" }, { label: "Monthly", value: "month" }, { label: "Yearly", value: "year" }, { label: "All time", value: "all" }]} value={financePeriod} onChange={setFinancePeriod} />
      {financePeriod !== "all" ? <View style={styles.planningPeriodNav}><Pressable onPress={() => shiftPeriod(-1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable><Text style={styles.planningPeriodText}>{periodLabel}</Text><Pressable onPress={() => shiftPeriod(1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>›</Text></Pressable></View> : <Text style={styles.fieldHint}>All saved dates</Text>}
      <Card style={styles.financeSummaryCard}><Text style={styles.profitLabel}>ESTIMATED PROFIT</Text><Text style={styles.financeSummaryValue}>{money(estimatedProfit, db.currency)}</Text><Text style={styles.financeSummaryCaption}>Gross sales less refunds, marketplace fees, business-paid shipping, recorded expenses, and recipe material costs. Actual payouts are shown separately; labor and taxes are not included.</Text></Card>
      <Card style={styles.financeBreakdownCard}><Text style={styles.cardTitle}>Money received</Text>{financeRows([["Gross sales", gross], ["Payout after fees, refunds, and sale deductions", payout - salesDeductionExpenseTotal, "Order fees and refunds are already deducted; this also subtracts any other costs marked as taken from the sale payout."], ["Other income", otherIncome]])}</Card>
      <Card style={styles.financeBreakdownCard}><Text style={styles.cardTitle}>Taken from sales</Text>{financeRows([["Refunds", refunds], ["Marketplace fees withheld", fees, "These reduce your sales payout; they are not out-of-pocket costs."], ["Other deductions from sale payout", salesDeductionExpenseTotal], ["Payout received or estimated", payout, "Actual entered payout is used as-is. Otherwise this is gross sales less fees and refunds."]])}</Card>
      <Card style={styles.financeBreakdownCard}><Text style={styles.cardTitle}>Costs included in estimated profit</Text>{financeRows([["Shipping paid by you", shipping], ["Business expenses", salesDeductionExpenseTotal + outOfPocketExpenseTotal], ["Recipe material costs for units not returned to stock", materialCosts]])}</Card>
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Income · {periodLabel}</Text></View>
      {visibleIncomeRows.length ? visibleIncomeRows.map((item) => <Card key={item.id}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{item.description}</Text><Text style={styles.recordMeta}>{item.category || "Other"} · {dateLabel(item.date)}</Text>{item.notes ? <Text style={styles.bodyText}>{item.notes}</Text> : null}</View><Text style={styles.detailText}>+{money(item.amount, db.currency)}</Text></View><View style={styles.actionRow}><Action label="Edit" quiet onPress={() => beginEdit("income", { ...item, amount: String(item.amount) })} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("incomes", item, "income")} /></View></Card>) : <Text style={styles.bodyText}>No separate income records in this period. Recorded sales are shown above.</Text>}
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Expenses · {periodLabel}</Text></View>
      <SortControl value={db.sortModes.expenses} onChange={(value) => saveSortMode("expenses", value)} />
      {visibleExpenseRows.length ? visibleExpenseRows.map((item) => <Card key={item.id}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{item.description}</Text><Text style={styles.recordMeta}>{item.category || "Other"} · {dateLabel(item.date)} · {item.expenseType === "salesDeduction" ? "Taken from sale payout" : "Out of pocket"}</Text>{item.notes ? <Text style={styles.bodyText}>{item.notes}</Text> : null}</View><Text style={styles.expenseAmount}>−{money(item.amount, db.currency)}</Text></View><View style={styles.actionRow}><Action label="Edit" quiet onPress={() => beginEdit("expense", { ...item, amount: String(item.amount), expenseType: item.expenseType || "outOfPocket" })} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("expenses", item, "expense")} /></View></Card>) : <Text style={styles.bodyText}>No expenses in this period. Mark each record as out-of-pocket or deducted from a sale payout.</Text>}
    </>;
  };

  const renderTasks = () => (
    <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Keep the next step visible</Text><Text style={styles.infoBannerText}>Tasks are sorted by due date. Mark a task done when it is off your mind.</Text></View>
      <SortControl value={db.sortModes.tasks || "oldest"} onChange={(value) => saveSortMode("tasks", value)} />
      {visibleTasks.length ? sortRecords(visibleTasks, db.sortModes.tasks || "oldest").map((task) => (
        <Card key={task.id} style={styles.taskCard}>
          <Pressable accessibilityLabel="Mark task done" onPress={() => completeTask(task)} style={styles.checkCircle}><Text style={styles.checkText}>□</Text></Pressable>
          <View style={styles.flex}><Text style={styles.recordTitle}>{task.title}</Text><Text style={styles.recordMeta}>{task.category || "Other"} · {task.dueDate ? "Due " + dateLabel(task.dueDate) : "No due date"} · {task.priority || "Normal"}</Text>{task.dueDate && task.dueDate < TODAY ? <Pill text="Late" tone="red" /> : <Pill text="Planned" tone="neutral" />}{task.notes ? <Text style={styles.bodyText}>{task.notes}</Text> : null}<View style={styles.actionRow}><Action label="Edit task" quiet onPress={() => beginEdit("task", task)} /><Action label="✓ Mark done" quiet onPress={() => completeTask(task)} /><Action label="Archive" quiet onPress={() => archiveRecord("tasks", task, "task")} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("tasks", task, "task")} /></View></View>
          <Pressable onPress={() => beginEdit("task", task)}><Text style={styles.rowArrow}>···</Text></Pressable>
        </Card>
      )) : <EmptyState title="A clear task list" body="Capture the next small business step here so you can return to it later." action="Add a task" onPress={() => beginAdd("task")} />}
      {db.tasks.some((task) => task.done) && <><Text style={styles.sectionTitle}>Recently completed</Text>{db.tasks.filter((task) => task.done).slice(0, 5).map((task) => <Card key={task.id} style={styles.taskDone}><Pressable onPress={() => completeTask(task)}><Text style={styles.doneMark}>✓</Text></Pressable><View style={styles.flex}><Text style={styles.doneTitle}>{task.title}</Text><Text style={styles.recordMeta}>Done {dateLabel(task.completedAt)}</Text></View><View style={styles.actionRow}><Action label="Edit task" quiet onPress={() => beginEdit("task", task)} /><Action label="Undo done" quiet onPress={() => completeTask(task)} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("tasks", task, "task")} /></View></Card>)}</>}
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Upcoming calendar events</Text><Action label="Add event" onPress={() => beginAdd("event")} /></View>
      {db.events.filter(active).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 4).map((event) => <Card key={event.id}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{event.title}</Text><Text style={styles.recordMeta}>{dateLabel(event.date)} · {event.kind}</Text>{event.done ? <Pill text="Done" tone="green" /> : event.date < TODAY ? <Pill text="Late" tone="red" /> : <Pill text="Planned" tone="neutral" />}{event.done && event.completedAt ? <Text style={styles.recordMeta}>Done {dateLabel(event.completedAt)}</Text> : null}{event.notes ? <Text style={styles.bodyText}>{event.notes}</Text> : null}</View></View><View style={styles.actionRow}><Action label={event.done ? "Undo done" : "✓ Mark done"} onPress={() => completeEvent(event)} /><Action label="Edit event" quiet onPress={() => beginEdit("event", event)} /><Action label="Archive" quiet onPress={() => archiveRecord("events", event, "event")} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("events", event, "event")} /></View></Card>)}
    </>
  );

  const renderCalendar = () => {
    const orderStatusOptions = [{ label: "All statuses", value: "All" }, ...timelineStatuses.map((status) => ({ label: status, value: status }))];
    const categoryOptions = [
      { label: "Everything", value: "All" },
      { label: "Sale statuses", value: "Sale statuses" },
      { label: "Discount plans", value: "Discount plans" },
      { label: "Relisting plans", value: "Relisting plans" },
      { label: "Schedules", value: "Schedules" },
    ];
    const planStateOptions = [{ label: "Planned and done", value: "All" }, { label: "Planned", value: "Planned" }, { label: "Done", value: "Done" }];
    const dateKey = (value) => parseDateInput(value) || timestampDateKey(value) || "";
    const calendarItems = [
      ...db.events.filter(active).map((item) => ({ ...item, itemType: "Event", due: dateKey(item.date) })),
      ...db.tasks.filter((item) => active(item) && ((!item.done && item.dueDate) || (item.done && item.completedAt))).map((item) => ({ ...item, itemType: "Task", due: dateKey(item.done ? item.completedAt : item.dueDate) })),
      ...(db.workPlans || []).filter((item) => item.date).map((item) => ({ ...item, itemType: "Work plan", due: dateKey(item.date) })),
      ...db.orders.filter((item) => !item.archived).flatMap((item) => {
        const orderTitle = (item.orderSku || "Sale") + " · " + ((item.items || []).map((line) => line.productName).join(", ") || "Order");
        const saleDay = dateKey(item.date) || dateKey(item.createdAt);
        return (item.timeline || []).map((step, timelineIndex) => ({
          ...item,
          itemType: "Order update",
          orderId: item.id,
          timelineIndex,
          progressStatus: step.status || item.status || "Status update",
          due: dateKey(step.date) || dateKey(step.enteredAt) || dateKey(item.updatedAt) || dateKey(item.createdAt) || saleDay,
          title: (step.status || item.status || "Status update") + " · " + orderTitle,
        }));
      }),
      ...db.listings.filter(active).flatMap((listing) => [
        ...(listing.discountPlans || []).flatMap((plan) => [
          plan.startDate ? { ...listing, itemType: "Listing plan", planId: plan.id, discountPlan: plan, done: !!plan.startDone, planLabel: "Discount begins", due: dateKey(plan.startDate), title: plan.percent + "% discount · " + listing.productName } : null,
          plan.endDate ? { ...listing, itemType: "Listing plan", planId: plan.id, discountPlan: plan, done: !!plan.endDone, planLabel: "Discount ends", due: dateKey(plan.endDate), title: plan.percent + "% discount ends · " + listing.productName } : null,
        ]),
        listing.relistDate ? { ...listing, itemType: "Listing plan", done: !!listing.relistDone, planLabel: "Relist listing", due: dateKey(listing.relistDate), title: "Relist · " + listing.productName } : null,
      ]).filter(Boolean),
    ].filter((item) => item.due).sort((a, b) => String(a.due).localeCompare(String(b.due)));
    const itemCategory = (item) => item.itemType === "Order update" ? "Sale statuses"
      : item.itemType === "Listing plan" ? (item.discountPlan ? "Discount plans" : "Relisting plans")
        : ["Task", "Event", "Work plan"].includes(item.itemType) ? "Schedules" : "Other";
    const visibleCalendarItems = calendarItems.filter((item) => {
      const category = itemCategory(item);
      if (calendarCategoryFilter !== "All" && category !== calendarCategoryFilter) return false;
      if (category === "Sale statuses" && calendarStatusFilter !== "All" && item.progressStatus !== calendarStatusFilter) return false;
      if ((category === "Discount plans" || category === "Relisting plans") && calendarPlanStateFilter !== "All" && (item.done ? "Done" : "Planned") !== calendarPlanStateFilter) return false;
      return true;
    });
    const calendarDayKeys = new Set(visibleCalendarItems.map((item) => item.due));
    const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1 - firstOfMonth.getDay());
    const cells = Array.from({ length: 42 }, (_item, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = localDateKey(date);
      return { date, key, inMonth: date.getMonth() === calendarMonth.getMonth(), hasItems: calendarDayKeys.has(key) };
    });
    const dayItems = visibleCalendarItems.filter((item) => item.due === selectedDay);
    const upcomingItems = visibleCalendarItems.filter((item) => item.due >= TODAY && item.due !== selectedDay);
    const nextUpItems = upcomingItems.slice(0, 10);
    const toggleListingPlanDone = (item) => setData((old) => ({
      ...old,
      listings: old.listings.map((listing) => {
        if (listing.id !== item.id) return listing;
        if (item.discountPlan) {
          const doneKey = item.planLabel === "Discount begins" ? "startDone" : "endDone";
          return { ...listing, discountPlans: (listing.discountPlans || []).map((plan) => plan.id === item.planId ? { ...plan, [doneKey]: !plan[doneKey] } : plan) };
        }
        return { ...listing, relistDone: !listing.relistDone };
      }),
    }));
    const openOrder = (item) => {
      setOrderStatusFilter("All");
      setShowArchivedOrders(false);
      setSearch(item.orderSku || "");
      navigateToScreen("Orders");
    };
    const changeMonth = (delta) => {
      const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
      setCalendarMonth(next);
      setSelectedDay(localDateKey(next));
    };
    const renderCalendarItem = (item, upcoming) => {
      const isPlan = item.itemType === "Listing plan";
      const isOrderUpdate = item.itemType === "Order update";
      const itemMeta = item.itemType === "Task" ? "Task · " + (item.category || "Other") + " · " + (item.priority || "Normal")
        : item.itemType === "Work plan" ? "Work block · " + formatTimeForDisplay(item.startTime) + "–" + formatTimeForDisplay(item.endTime)
          : item.itemType === "Event" ? "Event · " + (item.kind || "Business event")
        : isPlan ? (item.discountPlan ? "Discount plan · " : "Relisting plan · ") + item.planLabel + (item.marketplace || (item.marketplaces || []).length ? " · " + (item.marketplace || (item.marketplaces || []).join(", ")) : "")
              : "Sale status · " + (item.marketplace || "Direct");
      const listingEditorRecord = { ...item, price: String(item.price), marketplaces: item.marketplaces || (item.marketplace ? [item.marketplace] : []) };
      const selectDate = () => {
        const date = new Date(item.due + "T12:00:00");
        setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        setSelectedDay(item.due);
      };
      const itemActions = isOrderUpdate ? <>
        <Action label="Change status" quiet onPress={() => openOrder(item)} />
        <Action label="Edit update" quiet onPress={() => setTimelineEditor({ orderId: item.orderId, index: item.timelineIndex, date: item.due, status: item.progressStatus })} />
        <Action label="Delete update" quiet onPress={() => deleteOrderTimelineStep(item, item.timelineIndex)} />
      </> : isPlan ? <>
        <Action label={item.done ? "✓ Done · undo" : "□ Mark done"} quiet onPress={() => toggleListingPlanDone(item)} />
        <Action label={item.discountPlan ? "Edit discount" : "Edit relisting"} quiet onPress={() => item.discountPlan ? openDiscountEditor(item, item.discountPlan) : beginEdit("listing", listingEditorRecord)} />
        <Action label={item.discountPlan ? "Delete discount" : "Delete relisting"} quiet onPress={() => item.discountPlan ? deleteDiscountPlan(item, item.discountPlan) : clearRelistDate(item)} />
      </> : item.itemType === "Task" ? <>
        <Action label={item.done ? "✓ Done · undo" : "□ Mark done"} quiet onPress={() => completeTask(item)} />
        <Action label="Edit task" quiet onPress={() => beginEdit("task", item)} />
        <Action label="Delete task" quiet onPress={() => permanentlyDeleteRecord("tasks", item, "task")} />
      </> : item.itemType === "Work plan" ? <>
        <Action label={item.done ? "✓ Done · undo" : "□ Mark done"} quiet onPress={() => completeWorkPlan(item)} />
        <Action label="Edit work block" quiet onPress={() => beginEdit("workPlan", item)} />
        <Action label="Delete work block" quiet onPress={() => deleteWorkPlan(item)} />
      </> : <>
        <Action label={item.done ? "✓ Done · undo" : "□ Mark done"} quiet onPress={() => completeEvent(item)} />
        <Action label="Edit event" quiet onPress={() => beginEdit("event", item)} />
        <Action label="Delete event" quiet onPress={() => permanentlyDeleteRecord("events", item, "event")} />
      </>;
      const itemKey = item.itemType + item.id + item.due + (item.timelineIndex == null ? "" : item.timelineIndex) + (item.planId || "");
      return <Card key={(upcoming ? "upcoming-" : "day-") + itemKey} style={[styles.historyCard, isPlan && styles.compactCalendarPlanCard]}>
        <View style={styles.calendarItemHeader}>
          <Pressable style={styles.calendarItemText} onPress={upcoming ? selectDate : isOrderUpdate ? () => openOrder(item) : undefined}>
            <Text style={isPlan ? styles.calendarPlanTitle : styles.recordTitle}>{item.done ? "✓ " : ""}{item.title}</Text>
            <Text style={styles.recordMeta}>{itemMeta}</Text>
            {isOrderUpdate && item.trackingNumber ? <Text style={styles.recordMeta}>Tracking {item.trackingNumber}{item.trackingCarrier ? " · " + item.trackingCarrier : ""}</Text> : null}
            {item.notes ? <Text style={styles.bodyText}>{item.notes}</Text> : null}
          </Pressable>
          <View style={styles.calendarItemPills}>
            <Pill text={dateLabel(item.due)} tone="neutral" />
            {isPlan ? <Pill text={item.done ? "Done" : "Planned"} tone={item.done ? "green" : "amber"} /> : null}
          </View>
        </View>
        <View style={styles.actionRow}>{itemActions}</View>
      </Card>;
    };
    const selectedStatusLabel = calendarStatusFilter === "All" ? "All sale statuses" : calendarStatusFilter;
    const selectedPlanLabel = calendarPlanStateFilter === "All" ? "Planned and done plans" : calendarPlanStateFilter + " plans";
    const filterSummary = categoryOptions.find((option) => option.value === calendarCategoryFilter)?.label || "Everything";
    const filterSummaryParts = [filterSummary];
    if (calendarCategoryFilter === "All" || calendarCategoryFilter === "Sale statuses") filterSummaryParts.push(selectedStatusLabel);
    if (calendarCategoryFilter === "All" || calendarCategoryFilter === "Discount plans" || calendarCategoryFilter === "Relisting plans") filterSummaryParts.push(selectedPlanLabel);
    return <>
      <ScreenDashboardHeader title="Calendar" description="Order status changes, discount start and end dates, and relisting plans update automatically. Add tasks, events, and work blocks for your own schedule." metrics={[
        { label: "Sale statuses", value: String(calendarItems.filter((item) => item.itemType === "Order update").length) },
        { label: "Discount dates", value: String(calendarItems.filter((item) => item.discountPlan).length) },
        { label: "Relist plans", value: String(calendarItems.filter((item) => item.itemType === "Listing plan" && !item.discountPlan).length) },
      ]} actions={[
        { label: "＋ Event", onPress: () => beginAdd("event", { date: selectedDay }) },
        { label: "＋ Task", onPress: () => beginAdd("task", { dueDate: selectedDay }), quiet: true },
        { label: "＋ Work block", onPress: () => beginAdd("workPlan", { date: selectedDay }), quiet: true },
        { label: "Open time tracking", onPress: () => navigateToScreen("Time"), quiet: true },
      ]} />
      <View style={[styles.calendarWorkspace, wideLayout && styles.calendarWorkspaceWide]}>
      <View style={[styles.calendarMain, wideLayout && styles.calendarMainWide]}>
      <SettingsAccordion title="Calendar filters" subtitle={filterSummaryParts.join(" · ")} expanded={calendarFiltersExpanded} onPress={() => setCalendarFiltersExpanded((expanded) => !expanded)}>
        <Field field={{ label: "Show", options: categoryOptions }} value={calendarCategoryFilter} onChange={setCalendarCategoryFilter} />
        {calendarCategoryFilter === "All" || calendarCategoryFilter === "Sale statuses" ? <Field field={{ label: "Sale status", options: orderStatusOptions }} value={calendarStatusFilter} onChange={setCalendarStatusFilter} /> : null}
        {calendarCategoryFilter === "All" || calendarCategoryFilter === "Discount plans" || calendarCategoryFilter === "Relisting plans" ? <Field field={{ label: "Plan status", options: planStateOptions }} value={calendarPlanStateFilter} onChange={setCalendarPlanStateFilter} /> : null}
        <Text style={styles.fieldHint}>Sale status filters show each matching order timeline entry. Plan status filters show planned or completed discount and relisting dates.</Text>
      </SettingsAccordion>
      <Card style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable style={styles.monthArrow} onPress={() => changeMonth(-1)}><Text style={styles.monthArrowText}>‹</Text></Pressable>
          <Text style={styles.monthTitle}>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
          <Pressable style={styles.monthArrow} onPress={() => changeMonth(1)}><Text style={styles.monthArrowText}>›</Text></Pressable>
        </View>
        <Pressable onPress={() => { const now = new Date(); setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(TODAY); }} style={styles.todayButton}><Text style={styles.actionText}>Today</Text></Pressable>
        <View style={styles.calendarWeek}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
        {Array.from({ length: 6 }, (_week, week) => <View key={week} style={styles.calendarWeek}>{cells.slice(week * 7, week * 7 + 7).map((cell) => (
          <Pressable key={cell.key} onPress={() => { if (!cell.inMonth) setCalendarMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)); setSelectedDay(cell.key); }} style={[styles.calendarCell, cell.key === selectedDay && styles.calendarCellSelected]}>
            <Text style={[styles.calendarDay, !cell.inMonth && styles.calendarDayOutside, cell.key === TODAY && styles.calendarDayToday, cell.key === selectedDay && styles.calendarDayPicked]}>{cell.date.getDate()}</Text>
            <View style={[styles.calendarDot, cell.hasItems && styles.calendarDotActive]} />
          </Pressable>
        ))}</View>)}
      </Card>
      </View>
      <View style={[styles.calendarAgenda, wideLayout && styles.calendarAgendaWide]}>
      <SettingsAccordion title={dateLabel(selectedDay) + " · Day schedule"} subtitle={dayItems.length + " calendar item" + (dayItems.length === 1 ? "" : "s")} expanded={selectedDateExpanded} onPress={() => setSelectedDateExpanded((expanded) => !expanded)}>
        {dayItems.length ? dayItems.map((item) => renderCalendarItem(item, false)) : <><Text style={styles.emptyTitle}>Nothing scheduled for this date</Text><Text style={styles.bodyText}>Sale status changes, discount dates, and relisting plans appear automatically. Add a task, event, or work block to plan this day.</Text></>}
        <View style={styles.actionRow}>
          <Action label="＋ Event" onPress={() => beginAdd("event", { date: selectedDay })} />
          <Action label="＋ Task" quiet onPress={() => beginAdd("task", { dueDate: selectedDay })} />
          <Action label="＋ Work block" quiet onPress={() => beginAdd("workPlan", { date: selectedDay })} />
        </View>
      </SettingsAccordion>
      <SettingsAccordion title="Next up" subtitle={upcomingItems.length + " upcoming item" + (upcomingItems.length === 1 ? "" : "s") + " · first " + nextUpItems.length} expanded={nextUpExpanded} onPress={() => setNextUpExpanded((expanded) => !expanded)}>
        {nextUpItems.length ? nextUpItems.map((item) => renderCalendarItem(item, true)) : <><Text style={styles.bodyText}>Nothing upcoming matches these filters. Add a task, event, or work block, or change the calendar filters.</Text><View style={styles.actionRow}><Action label="＋ Add task" onPress={() => beginAdd("task", { dueDate: TODAY })} /><Action label="＋ Add event" quiet onPress={() => beginAdd("event", { date: TODAY })} /><Action label="＋ Work block" quiet onPress={() => beginAdd("workPlan", { date: TODAY })} /></View></>}
        {upcomingItems.length > nextUpItems.length ? <Text style={styles.fieldHint}>Showing the first 10 upcoming items. Change the date or filters to browse more.</Text> : null}
      </SettingsAccordion>
      </View>
      </View>
    </>;
  };

  const renderTime = () => {
    const todaySessions = (db.timeSessions || []).filter((session) => session.date === TODAY).sort((a, b) => b.clockIn - a.clockIn);
    const todayRecordedMs = todaySessions.reduce((sum, session) => sum + (Number(session.durationMs) || 0), 0);
    const todayBreakMs = todaySessions.reduce((sum, session) => sum + (Number(session.breakMs) || 0), 0) + (db.activeShift && db.activeShift.date === TODAY ? (Number(db.activeShift.breakMs) || 0) + (db.activeShift.breakStartedAt ? Math.max(0, clockNow - db.activeShift.breakStartedAt) : 0) : 0);
    const averageShiftMs = todaySessions.length ? Math.round(todayRecordedMs / todaySessions.length) : 0;
    const recentSessions = (db.timeSessions || []).slice().sort((a, b) => Number(b.clockIn) - Number(a.clockIn)).slice(0, 12);
    const activeShiftMs = db.activeShift ? Math.max(0, clockNow - db.activeShift.clockIn - (Number(db.activeShift.breakMs) || 0) - (db.activeShift.breakStartedAt ? clockNow - db.activeShift.breakStartedAt : 0)) : 0;
    const todayActiveMs = db.activeShift && db.activeShift.date === TODAY ? activeShiftMs : 0;
    const tasksForTime = db.tasks.filter(active);
    const openTasksForTimer = tasksForTime.filter((task) => !task.done);
    const analytics = buildTimeAnalytics(db.timeSessions, db.activeShift, clockNow);
    const anchor = planAnchor;
    const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - ((anchor.getDay() + 6) % 7));
    const planStart = planRange === "week" ? monday : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const planEnd = planRange === "week" ? new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const planStartKey = localDateKey(planStart);
    const planEndKey = localDateKey(planEnd);
     const periodPlans = (db.workPlans || []).filter((plan) => plan.date >= planStartKey && plan.date <= planEndKey);
     const visiblePlans = (db.workPlans || []).filter((plan) => (plan.date >= planStartKey && plan.date <= planEndKey) || (!plan.done && plan.date < TODAY)).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
     const plannedMs = periodPlans.reduce((sum, plan) => {
      const start = new Date(`${plan.date}T${plan.startTime}:00`).getTime();
      const end = new Date(`${plan.date}T${plan.endTime}:00`).getTime();
      return sum + Math.max(0, end - start);
    }, 0);
    const periodWorkedMs = (db.timeSessions || []).filter((session) => session.date >= planStartKey && session.date <= planEndKey).reduce((sum, session) => sum + (Number(session.durationMs) || 0), 0)
      + (db.activeShift && db.activeShift.date >= planStartKey && db.activeShift.date <= planEndKey ? activeShiftMs : 0);
    const planDifferenceMs = periodWorkedMs - plannedMs;
    const defaultPlanDate = TODAY < planStartKey ? planStartKey : TODAY > planEndKey ? planEndKey : TODAY;
    const planPeriodLabel = planRange === "week" ? `${dateLabel(planStartKey)} – ${dateLabel(planEndKey)}` : planStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const shiftPlanPeriod = (delta) => setPlanAnchor(planRange === "week"
      ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + delta * 7)
      : new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
    return <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Timesheet and focus timers</Text><Text style={styles.infoBannerText}>Clock times and timers are saved on this device. Keep the app available while tracking a session.</Text></View>
      <Text style={styles.sectionTitle}>Today at a glance</Text>
      <View style={styles.metricGrid}><Metric label="Worked today" value={formatDuration(todayRecordedMs + todayActiveMs)} sub="Breaks excluded" /><Metric label="Completed shifts" value={String(todaySessions.length)} sub="Today" /><Metric label="Average shift" value={todaySessions.length ? formatDuration(averageShiftMs) : "—"} sub="Completed shifts today" /><Metric label="Break time" value={formatDuration(todayBreakMs)} sub="Today" /></View>
      <Text style={styles.sectionTitle}>Work time results</Text>
      <Text style={styles.fieldHint}>Totals exclude break time. The current shift is included in the week, month, and year totals while it is running.</Text>
      <View style={styles.metricGrid}><Metric label="This week" value={formatHours(analytics.weekTotal)} /><Metric label="This month" value={formatHours(analytics.monthTotal)} /><Metric label="This year" value={formatHours(analytics.yearTotal)} /></View>
      <TimeBarChart title="This week · hours by day" bars={analytics.week} />
      <TimeBarChart title="This month · hours by week" bars={analytics.month} />
      <TimeBarChart title="This year · hours by month" bars={analytics.year} />
      <Card>
        <Text style={styles.cardTitle}>Work shift</Text>
        {db.activeShift ? <>
          <Text style={styles.timeDisplay}>{formatDuration(activeShiftMs)}</Text>
          <Text style={styles.recordMeta}>{dateLabel(db.activeShift.date)} · Clocked in {new Date(db.activeShift.clockIn).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{db.activeShift.breakStartedAt ? " · On break" : ""}</Text>
          <View style={styles.sectionHeadingRow}><Text style={styles.fieldLabel}>Tasks for this shift</Text><Action label="＋ Create task" quiet onPress={beginCreateShiftTask} /></View>
          <Field field={{ label: "Choose saved tasks", options: tasksForTime.map((task) => ({ label: task.title, value: task.id })), multiple: true, placeholder: "Choose one or more tasks" }} value={db.activeShift.taskIds || []} onChange={updateActiveShiftTasks} />
          <Field field={{ label: "What else are you working on?", multiline: true, placeholder: "Add a note about this shift" }} value={db.activeShift.workNote || ""} onChange={(workNote) => setData((old) => old.activeShift ? { ...old, activeShift: { ...old.activeShift, workNote } } : old)} />
          <View style={styles.actionRow}>
            {db.activeShift.breakStartedAt ? <Action label="End break" onPress={endBreak} /> : <Action label="Start break" onPress={startBreak} />}
            <Action label="Edit clock-in" quiet onPress={() => openTimeEditor("active", db.activeShift)} />
            <Action label="End shift" quiet onPress={clockOut} />
            <Action label="Delete shift" quiet onPress={discardActiveShift} />
          </View>
        </> : <>
          <Text style={styles.bodyText}>Start a shift to keep a record of your work time.</Text>
          <View style={styles.sectionHeadingRow}><Text style={styles.fieldLabel}>Tasks for this shift</Text><Action label="＋ Create task" quiet onPress={beginCreateShiftTask} /></View>
          <Field field={{ label: "Choose saved tasks", options: tasksForTime.map((task) => ({ label: task.title, value: task.id })), multiple: true, placeholder: "Choose one or more tasks" }} value={shiftTaskIds} onChange={setShiftTaskIds} />
          <Field field={{ label: "What do you plan to work on?", multiline: true, placeholder: "Optional shift note" }} value={shiftWorkNote} onChange={setShiftWorkNote} />
          <Pressable style={styles.primaryButtonFull} onPress={clockIn}><Text style={styles.primaryButtonFullText}>Clock in</Text></Pressable>
        </>}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Focus timer</Text>
        {db.activeTimer ? <>
          <Text style={styles.recordTitle}>{db.activeTimer.label}</Text>
          {(db.activeTimer.taskTitles || (db.activeTimer.taskTitle ? [db.activeTimer.taskTitle] : [])).length ? <Text style={styles.recordMeta}>Tasks: {(db.activeTimer.taskTitles || [db.activeTimer.taskTitle]).join(", ")}</Text> : null}
          {db.activeTimer.workNote ? <Text style={styles.bodyText}>{db.activeTimer.workNote}</Text> : null}
          <Text style={styles.timeDisplay}>{formatDuration(clockNow - db.activeTimer.startedAt)}</Text>
          <View style={styles.actionRow}><Action label="Stop and save timer" onPress={stopTimer} /><Action label="Discard timer" quiet onPress={discardActiveTimer} /></View>
        </> : <>
          <Field field={{ label: "Timer name", placeholder: "Example: Pack today’s orders" }} value={timerLabel} onChange={setTimerLabel} />
          <Field field={{ label: "Tasks for this timer (choose all that apply)", options: openTasksForTimer.map((task) => ({ label: task.title, value: task.id })), multiple: true, placeholder: "Choose one or more tasks" }} value={timerTaskIds} onChange={setTimerTaskIds} />
          <Field field={{ label: "What are you focusing on?", multiline: true, placeholder: "Optional work note" }} value={timerWorkNote} onChange={setTimerWorkNote} />
          <Pressable style={styles.primaryButtonFull} onPress={startTimer}><Text style={styles.primaryButtonFullText}>Start timer</Text></Pressable>
        </>}
      </Card>
      <Text style={styles.sectionTitle}>Recent shifts</Text>
       {recentSessions.length ? recentSessions.map((session) => <Card key={session.id} style={styles.historyCard}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{dateLabel(session.date)} · {new Date(session.clockIn).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–{new Date(session.clockOut).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text><Text style={styles.recordMeta}>Breaks: {formatDuration(session.breakMs || 0)} · Worked {formatDuration(session.durationMs)}</Text>{session.taskTitles && session.taskTitles.length ? <Text style={styles.bodyText}>Tasks: {session.taskTitles.join(", ")}</Text> : null}{session.workNote ? <Text style={styles.bodyText}>{session.workNote}</Text> : null}</View></View><View style={styles.actionRow}><Action label="Edit shift" onPress={() => openTimeEditor("session", session)} /><Action label="Delete shift" quiet onPress={() => deleteShiftSession(session)} /></View></Card>) : <Text style={styles.bodyText}>Completed shifts will appear here.</Text>}
      <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Plan your work</Text><Text style={styles.subtle}>{planPeriodLabel} · {formatHours(plannedMs)} planned</Text></View><Action label="＋ Plan work" onPress={() => beginAdd("workPlan", { date: defaultPlanDate })} /></View>
      <View style={styles.rangeSwitch}><Pressable onPress={() => { setPlanRange("week"); setPlanAnchor(new Date()); }} style={[styles.rangeButton, planRange === "week" && styles.rangeButtonSelected]}><Text style={[styles.rangeButtonText, planRange === "week" && styles.rangeButtonTextSelected]}>Week</Text></Pressable><Pressable onPress={() => { setPlanRange("month"); setPlanAnchor(new Date()); }} style={[styles.rangeButton, planRange === "month" && styles.rangeButtonSelected]}><Text style={[styles.rangeButtonText, planRange === "month" && styles.rangeButtonTextSelected]}>Month</Text></Pressable></View>
      <View style={styles.planningPeriodNav}><Pressable onPress={() => shiftPlanPeriod(-1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable><Text style={styles.planningPeriodText}>{planPeriodLabel}</Text><Pressable onPress={() => shiftPlanPeriod(1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>›</Text></Pressable></View>
      <View style={styles.metricGrid}><Metric label="Planned work" value={formatHours(plannedMs)} sub={planPeriodLabel} /><Metric label="Logged work" value={formatHours(periodWorkedMs)} sub="Breaks excluded" /><Metric label={planDifferenceMs >= 0 ? "Over plan" : "Still to plan"} value={formatHours(Math.abs(planDifferenceMs))} sub={planDifferenceMs >= 0 ? "More time logged than planned" : "Planned hours not logged yet"} /></View>
       {visiblePlans.length ? visiblePlans.map((plan) => <Card key={plan.id}><View style={styles.cardTop}><Pressable onPress={() => completeWorkPlan(plan)} style={styles.checkCircle}><Text style={styles.checkText}>{plan.done ? "✓" : ""}</Text></Pressable><View style={styles.flex}><Text style={styles.recordTitle}>{plan.title}</Text><Text style={styles.recordMeta}>{dateLabel(plan.date)} · {formatTimeForDisplay(plan.startTime)}–{formatTimeForDisplay(plan.endTime)}</Text>{plan.done ? <Pill text="Done" tone="green" /> : plan.date < TODAY ? <Pill text="Late" tone="red" /> : <Pill text="Planned" tone="neutral" />}{plan.done && plan.completedAt ? <Text style={styles.recordMeta}>Done {dateLabel(plan.completedAt)}</Text> : null}{plan.notes ? <Text style={styles.bodyText}>{plan.notes}</Text> : null}</View></View><View style={styles.actionRow}><Action label={plan.date < TODAY && !plan.done ? "Reschedule" : "Edit"} onPress={() => beginEdit("workPlan", plan)} /><Action label={plan.done ? "Undo done" : "✓ Mark done"} quiet onPress={() => completeWorkPlan(plan)} /><Action label="Delete" quiet onPress={() => deleteWorkPlan(plan)} /></View></Card>) : <Card><Text style={styles.emptyTitle}>No work blocks planned</Text><Text style={styles.bodyText}>Add the hours and focus blocks you want to protect for this {planRange}.</Text></Card>}
      <Text style={styles.sectionTitle}>Recent timers</Text>
      {(db.timerSessions || []).slice().sort((a, b) => Number(b.startedAt) - Number(a.startedAt)).map((session) => <Card key={session.id} style={styles.historyCard}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{session.label}</Text><Text style={styles.recordMeta}>{(session.taskTitles || (session.taskTitle ? [session.taskTitle] : [])).join(", ") ? (session.taskTitles || [session.taskTitle]).join(", ") + " · " : ""}{dateLabel(session.date)}</Text>{session.workNote ? <Text style={styles.bodyText}>{session.workNote}</Text> : null}</View><Text style={styles.detailText}>{formatDuration(session.durationMs)}</Text></View><View style={styles.actionRow}><Action label="Edit timer" quiet onPress={() => openTimeEditor("timer", session)} /><Action label="Delete timer" quiet onPress={() => deleteTimerSession(session)} /></View></Card>)}
      {!db.timerSessions.length ? <Text style={styles.bodyText}>Saved focus sessions will appear here.</Text> : null}
    </>;
  };

  const renderReports = () => {
    const marketplaceTotals = {};
    const paidOrders = db.orders.filter((order) => !order.refundedAt);
    paidOrders.forEach((order) => {
      const key = order.marketplace || "Direct";
      const row = marketplaceTotals[key] || { gross: 0, orders: 0, units: 0, fees: 0 };
      row.gross += totalOrder(order); row.orders += 1;
      row.units += (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      row.fees += Number(order.fees) || 0; marketplaceTotals[key] = row;
    });
    const productTotals = {};
    paidOrders.forEach((order) => (order.items || []).forEach((item) => {
      const row = productTotals[item.productName] || { units: 0, revenue: 0 };
      row.units += Number(item.quantity) || 0;
      row.revenue += (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      productTotals[item.productName] = row;
    }));
    const best = Object.entries(productTotals).sort((a, b) => b[1].units - a[1].units).slice(0, 5);
    const averageOrder = paidOrders.length ? paidOrders.reduce((sum, order) => sum + totalOrder(order), 0) / paidOrders.length : 0;
    const recentOrders = db.orders.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 8);
    return <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>What these reports count</Text><Text style={styles.infoBannerText}>All-time totals from sales and expenses saved in this tracker. Fully refunded orders are excluded from marketplace and product rankings. Profit is estimated from the costs and fees you entered.</Text></View>
      <View style={styles.metricGrid}><Metric label="Orders recorded" value={String(db.orders.length)} /><Metric label="Units sold" value={String(Object.values(productTotals).reduce((sum, row) => sum + row.units, 0))} /><Metric label="Average order" value={money(averageOrder, db.currency)} sub="Refunded orders excluded" /><Metric label="Estimated profit" value={money(totals.estimatedProfit, db.currency)} /></View>
      <View style={styles.metricGrid}><Metric label="Fees recorded" value={money(totals.fees, db.currency)} /><Metric label="Shipping paid" value={money(totals.shipping, db.currency)} /><Metric label="Business expenses" value={money(totals.expenses, db.currency)} /><Metric label="Open tasks" value={String(openTasks.length)} /></View>
      <Text style={styles.sectionTitle}>Sales by marketplace</Text>
      {Object.keys(marketplaceTotals).length ? Object.entries(marketplaceTotals).sort((a, b) => b[1].gross - a[1].gross).map(([name, row]) => <Card key={name}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{name}</Text><Text style={styles.recordMeta}>{row.orders} order{row.orders === 1 ? "" : "s"} · {row.units} item{row.units === 1 ? "" : "s"} · fees {money(row.fees, db.currency)}</Text></View><Text style={styles.detailText}>{money(row.gross, db.currency)}</Text></View></Card>) : <Text style={styles.bodyText}>Marketplace totals will appear after you record a sale.</Text>}
      <Text style={styles.sectionTitle}>Best-selling products</Text>
      {best.length ? best.map(([name, row], index) => <Card key={name}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{index + 1}. {name}</Text><Text style={styles.recordMeta}>{money(row.revenue, db.currency)} gross item revenue</Text></View><Text style={styles.detailText}>{row.units} sold</Text></View></Card>) : <Text style={styles.bodyText}>No product units have been sold yet. Record sales to compare products.</Text>}
      <Text style={styles.sectionTitle}>Recent sales</Text>
      {recentOrders.length ? recentOrders.map((order) => <Card key={order.id} style={styles.historyCard}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{order.orderSku || "Order"} · {(order.items || []).map((item) => item.productName).join(", ") || "Sale"}</Text><Text style={styles.recordMeta}>{dateLabel(order.date)} · {order.marketplace || "Direct"} · {order.status || "Status not set"}{order.refundedAt ? " · refunded" : ""}</Text></View><Text style={styles.detailText}>{money(totalOrder(order), db.currency)}</Text></View></Card>) : <Text style={styles.bodyText}>Your recent orders will appear here after the first sale.</Text>}
    </>;
  };

  const renderReviews = () => {
    const query = search.trim().toLowerCase();
    const reviews = sortRecords((db.reviews || []).filter((review) => !query || [review.customer, review.platform, review.productName, review.orderReference, review.reviewText, review.publicResponse, review.notes, review.stars].join(" ").toLowerCase().includes(query)), db.sortModes.reviews || "newest");
    const totalStars = reviews.reduce((sum, review) => sum + Math.max(1, Math.min(5, Number(review.stars) || 0)), 0);
    const average = reviews.length ? (totalStars / reviews.length).toFixed(1) : "—";
    const platformStats = reviews.reduce((result, review) => {
      const platform = review.platform || "Platform not recorded";
      if (!result[platform]) result[platform] = { count: 0, stars: 0 };
      result[platform].count += 1;
      result[platform].stars += Math.max(1, Math.min(5, Number(review.stars) || 0));
      return result;
    }, {});
    return <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Your shop's buyer feedback</Text><Text style={styles.infoBannerText}>Save each buyer's wording and rating here. Reviews are entered by you; the app does not import them from marketplaces.</Text></View>
      <View style={styles.metricGrid}><Metric label="Reviews saved" value={String(reviews.length)} /><Metric label="Overall shop rating" value={reviews.length ? `${average} / 5` : "—"} sub={reviews.length ? "★".repeat(Math.round(Number(average))) : "Add your first review"} /><Metric label="Total stars received" value={String(totalStars)} /><Metric label="Platforms" value={String(Object.keys(platformStats).length)} /></View>
      {Object.keys(platformStats).length ? <><Text style={styles.sectionTitle}>Rating by platform</Text><View style={styles.metricGrid}>{Object.entries(platformStats).sort((a, b) => b[1].count - a[1].count).map(([platform, stats]) => <Metric key={platform} label={platform} value={(stats.stars / stats.count).toFixed(1) + " / 5"} sub={stats.count + " review" + (stats.count === 1 ? "" : "s")} />)}</View></> : null}
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Buyer reviews</Text><Action label="＋ Add review" onPress={() => beginAdd("review")} /></View>
      <SortControl value={db.sortModes.reviews || "newest"} onChange={(value) => saveSortMode("reviews", value)} />
      {reviews.length ? reviews.map((review) => <Card key={review.id} style={styles.reviewCard}>
        <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.reviewStars}>{"★".repeat(Math.max(1, Math.min(5, Number(review.stars) || 0)))}<Text style={styles.reviewStarsEmpty}>{"☆".repeat(5 - Math.max(1, Math.min(5, Number(review.stars) || 0)))}</Text></Text><Text style={styles.recordMeta}>{dateLabel(review.date)}{review.customer ? ` · ${review.customer}` : " · Buyer name not saved"}</Text></View><Pill text={`${review.stars} / 5`} tone={Number(review.stars) >= 4 ? "green" : Number(review.stars) <= 2 ? "red" : "neutral"} /></View>
        <Text style={styles.reviewQuote}>“{review.reviewText}”</Text>
        {review.platform ? <Text style={styles.recordMeta}>Platform: {review.platform}</Text> : null}
        {review.orderReference ? <Text style={styles.recordMeta}>Sale: {review.orderReference}</Text> : review.productName ? <Text style={styles.recordMeta}>Sale link not saved · older product record: {review.productName}</Text> : null}
        {review.publicResponse ? <View style={styles.reviewResponse}><Text style={styles.fieldLabel}>Your public reply</Text><Text style={styles.bodyText}>{review.publicResponse}</Text></View> : null}
        {review.notes ? <Text style={styles.fieldHint}>Private note: {review.notes}</Text> : null}
        <View style={styles.actionRow}><Action label="Edit review" onPress={() => beginEdit("review", { ...review, stars: String(review.stars) })} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("reviews", review, "review")} /></View>
      </Card>) : <EmptyState title="Save your first review" body="Keep buyer feedback and shop ratings in one place. You can link each review to a sale or product." action="Add a review" onPress={() => beginAdd("review")} />}
    </>;
  };

  const renderIdeas = () => {
    const statuses = ["Ideas", "To make", "In progress", "Done"];
    const ideas = db.ideas.filter(active).filter((idea) => !search || [idea.title, idea.category, idea.notes, idea.status].join(" ").toLowerCase().includes(search.toLowerCase()));
    const moveIdea = (idea, delta) => {
      const currentIndex = Math.max(0, statuses.indexOf(idea.status || "Ideas"));
      const nextStatus = statuses[Math.max(0, Math.min(statuses.length - 1, currentIndex + delta))];
      setData((old) => ({ ...old, ideas: old.ideas.map((item) => item.id === idea.id ? { ...item, status: nextStatus, auditLog: (item.auditLog || []).concat([{ id: uid("audit"), action: "Idea moved to " + nextStatus, date: new Date().toISOString(), changes: [{ field: "status", from: item.status || "Ideas", to: nextStatus }] }]) } : item) }));
    };
    return <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Product ideas</Text><Text style={styles.infoBannerText}>Capture ideas, then move them through the stages as you make and finish them.</Text></View>
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Your ideas</Text><Action label="＋ New idea" onPress={() => beginAdd("idea")} /></View>
      {statuses.map((status, index) => {
        const column = ideas.filter((idea) => (idea.status || "Ideas") === status);
        const expanded = expandedIdeaStatuses.includes(status);
        return <Card key={status} style={styles.ideaLane}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedIdeaStatuses((old) => expanded ? old.filter((item) => item !== status) : old.concat([status]))} style={styles.ideaLaneHeader}><View style={styles.flex}><Text style={styles.ideaLaneTitle}>{status}</Text><Text style={styles.subtle}>{column.length} {column.length === 1 ? "idea" : "ideas"}</Text></View><Text style={styles.ideaLaneChevron}>{expanded ? "−" : "+"}</Text></Pressable>
          {expanded ? column.length ? column.map((idea) => <View key={idea.id} style={styles.ideaNote}><Text style={styles.recordTitle}>{idea.title}</Text><Text style={styles.recordMeta}>{idea.category || "Product idea"}</Text>{idea.notes ? <Text style={styles.bodyText}>{idea.notes}</Text> : null}<View style={styles.actionRow}><Action label="Edit idea" quiet onPress={() => beginEdit("idea", { ...idea, status: idea.status || "Ideas" })} />{index > 0 ? <Action label="← Move back" quiet onPress={() => moveIdea(idea, -1)} /> : null}{index < statuses.length - 1 ? <Action label="Move forward →" onPress={() => moveIdea(idea, 1)} /> : null}<Action label="Delete idea" quiet onPress={() => permanentlyDeleteRecord("ideas", idea, "idea")} /></View></View>) : <View style={styles.ideaLaneEmpty}><Text style={styles.ideaLaneEmptyText}>No ideas in this stage yet</Text><Text style={styles.ideaLaneEmptyHint}>Add a new idea or move one here when it is ready.</Text>{status === "Ideas" ? <Action label="＋ Add your first idea" onPress={() => beginAdd("idea")} /> : null}</View> : null}
        </Card>;
      })}
    </>;
  };

  const renderAudit = () => {
    const sourceByType = {
      Orders: db.orders.concat((db.deletedOrders || []).map((order) => ({ ...order, auditDeleted: true }))),
      Listings: db.listings,
      Products: db.products,
      Components: db.components,
      Suppliers: db.suppliers,
      Income: db.incomes || [],
      Expenses: db.expenses,
      Reviews: db.reviews,
    };
    const sourceLabels = { Listings: "Listing", Products: "Product", Components: "Component", Suppliers: "Supplier", Income: "Income", Expenses: "Expense", Reviews: "Review" };
    const sourceForRecord = (record) => auditType === "Orders" ? record.auditDeleted ? "Deleted sale" : "Sale" : sourceLabels[auditType] || auditType;
    const records = sortRecords((sourceByType[auditType] || []).filter((record) => !search || [record.name, record.productName, record.productSku, record.listingSku, record.orderSku, record.sku, record.customer, record.marketplace, record.description, record.title, record.status, record.category].join(" ").toLowerCase().includes(search.toLowerCase())), "newest");
    const titleForRecord = (record) => record.orderSku || record.listingSku || record.sku || record.name || record.productName || record.description || record.title || record.customer || "Saved record";
    const inventoryEvents = (record) => auditType === "Components"
      ? (db.componentTransactions || []).filter((entry) => entry.componentId === record.id)
      : auditType === "Products" ? (db.productTransactions || []).filter((entry) => entry.productId === record.id) : [];
    const relatedEvents = (record) => {
      const events = (record.auditLog || []).map((entry) => ({ ...entry, eventKind: "Change" }));
      inventoryEvents(record).forEach((entry) => events.push({ ...entry, date: entry.date, action: entry.kind + " · " + (entry.quantity > 0 ? "+" : "") + entry.quantity, note: [entry.note, entry.orderId ? "Sale " + entry.orderId : ""].filter(Boolean).join(" · "), eventKind: "Inventory" }));
      if (auditType === "Orders") {
        (record.timeline || []).forEach((entry) => events.push({ ...entry, action: "Order status: " + entry.status, eventKind: "Order status" }));
        (record.refundHistory || []).forEach((entry) => events.push({ ...entry, action: "Refund " + money(entry.amount, db.currency), note: (entry.returnedQuantity || 0) + " returned · " + (entry.restockQuantity || 0) + " restocked" + (entry.note ? " · " + entry.note : ""), eventKind: "Refund" }));
        if (record.deletedAt) events.push({ id: "deleted-" + record.id, date: record.deletedAt, action: "Sale deleted", note: record.deletionReason || "Deleted sale retained for audit", eventKind: "Deleted" });
      }
      if (auditType === "Listings") {
        (record.relistHistory || []).forEach((entry) => events.push({ ...entry, action: "Listing relisted · " + money(entry.newPrice, db.currency), note: "Active days restarted" + (entry.packageWeight != null ? " · " + entry.packageWeight + " " + entry.packageWeightUnit : ""), eventKind: "Relist" }));
        (record.discountPlans || []).forEach((entry) => events.push({ ...entry, date: entry.startDate, action: "Discount planned · " + entry.percent + "%", note: dateLabel(entry.startDate) + (entry.endDate ? " – " + dateLabel(entry.endDate) : " onward") + (entry.notes ? " · " + entry.notes : ""), eventKind: "Discount plan" }));
      }
      return events.sort((a, b) => String(b.date || b.timestamp || "").localeCompare(String(a.date || a.timestamp || "")));
    };
    return <>
      <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Business audit trail</Text><Text style={styles.infoBannerText}>Choose a record type to review saved dates, inventory movements, sale stages, refunds, discount plans, relists, and edits. New edits are recorded with the field changes; older records show the history already saved with them.</Text></View>
      <ChoiceChips label="Choose what to audit" options={Object.keys(sourceByType)} value={auditType} onChange={setAuditType} />
      <View style={styles.metricGrid}><Metric label="Records in this audit" value={String(records.length)} /><Metric label="Deleted sales kept" value={auditType === "Orders" ? String((db.deletedOrders || []).length) : "—"} /></View>
      {records.length ? records.map((record) => {
        const events = relatedEvents(record);
        const detailType = auditType === "Orders" ? "order" : auditType === "Listings" ? "listing" : auditType === "Products" ? "product" : auditType === "Components" ? "component" : "";
        return <Card key={record.id}>
          <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{titleForRecord(record)}</Text><Text style={styles.recordMeta}>{sourceForRecord(record)}{record.createdAt ? " · Created " + dateLabel(record.createdAt) : " · Creation date not recorded"}{record.updatedAt ? " · Updated " + dateLabel(record.updatedAt) : ""}</Text><Text style={styles.recordMeta}>{record.status || record.category || record.marketplace || record.supplier || ""}{record.archived ? " · Archived" : ""}{record.auditDeleted ? " · Deleted" : ""}</Text></View>{detailType ? <Action label="Full record" quiet onPress={() => openDetails(detailType, record)} /> : null}</View>
          {auditType === "Orders" ? <Text style={styles.bodyText}>{(record.items || []).map((item) => item.quantity + " × " + item.productName + " · " + item.productSku).join("\n")}{"\n"}{dateLabel(record.date)} · {record.marketplace || "Direct"} · Gross {money(totalOrder(record), db.currency)} · Fees {money(record.fees || 0, db.currency)} · Refunds {money(record.refundAmount || 0, db.currency)}</Text> : null}
          {auditType === "Listings" ? <Text style={styles.bodyText}>{record.productName} · Product SKU {record.productSku || "not saved"} · {record.marketplace || "Marketplace not saved"} · Listed {dateLabel(record.startDate)} · {listingAgeText(record)}</Text> : null}
          {events.length ? <View style={styles.discountPlanList}><Text style={styles.fieldLabel}>History · newest first</Text>{events.map((entry, index) => <View key={entry.id || entry.timestamp || entry.date + index} style={styles.discountPlanRow}><View style={styles.flex}><Text style={styles.recordTitle}>{entry.action || entry.status || entry.kind || "Updated"}</Text><Text style={styles.recordMeta}>{dateLabel(entry.date || entry.timestamp)} · {entry.eventKind || "Change"}</Text>{entry.changes && entry.changes.length ? entry.changes.map((change, changeIndex) => <Text key={change.field + changeIndex} style={styles.fieldHint}>{change.field}: {change.from == null ? "blank" : typeof change.from === "object" ? JSON.stringify(change.from) : String(change.from)} → {change.to == null ? "blank" : typeof change.to === "object" ? JSON.stringify(change.to) : String(change.to)}</Text>) : null}{entry.note ? <Text style={styles.bodyText}>{entry.note}</Text> : null}</View></View>)}</View> : <Text style={styles.fieldHint}>No detailed edits were saved for this record yet.</Text>}
        </Card>;
      }) : <EmptyState title="No records to audit" body="Try another record type or change the search." />}
    </>;
  };

  const renderSuppliers = () => {
    const suppliers = sortRecords(db.suppliers.filter(active).filter((item) => !search || [item.name, item.contact, item.website, item.category, item.notes].join(" ").toLowerCase().includes(search.toLowerCase())), db.sortModes.suppliers);
    const pagedSuppliers = pageRows("suppliers", suppliers);
    const linkedComponents = db.components.filter((item) => active(item) && String(item.supplier || "").trim());
    return <>
      <ScreenDashboardHeader title="Suppliers" description="Keep supplier contacts, web addresses, purchase relationships, and notes together." metrics={[
        { label: "Active suppliers", value: String(suppliers.length) },
        { label: "Components linked", value: String(linkedComponents.length) },
        { label: "Components without supplier", value: String(db.components.filter((item) => active(item) && !String(item.supplier || "").trim()).length) },
      ]} actions={[{ label: "＋ Add supplier", onPress: () => beginAdd("supplier") }]} />
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Supplier directory</Text></View>
      <SortControl value={db.sortModes.suppliers} onChange={(value) => saveSortMode("suppliers", value)} />
      {pagedSuppliers.length ? pagedSuppliers.map((supplier) => {
        const materials = db.components.filter((item) => active(item) && String(item.supplier || "").toLowerCase() === supplier.name.toLowerCase());
        return <Card key={supplier.id}>
          <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{supplier.name}</Text><Text style={styles.recordMeta}>{supplier.category || "Other"} · {supplier.contact || "No contact saved"}</Text></View></View>
          {supplier.website ? <Text style={styles.bodyText}>{supplier.website}</Text> : null}
          {materials.length ? <Text style={styles.bodyText}>Materials: {materials.map((item) => item.name).join(", ")}</Text> : null}
          {supplier.notes ? <Text style={styles.bodyText}>{supplier.notes}</Text> : null}
          <View style={styles.actionRow}><Action label="Edit" onPress={() => beginEdit("supplier", supplier)} /><Action label="Archive" quiet onPress={() => archiveRecord("suppliers", supplier, "supplier")} /><Action label="Delete" quiet onPress={() => permanentlyDeleteRecord("suppliers", supplier, "supplier")} /></View>
        </Card>;
      }) : <EmptyState title="Keep supplier details handy" body="Save contact details, websites, minimum orders, and notes in one place." action="Add a supplier" onPress={() => beginAdd("supplier")} />}
      {pagedSuppliers.length < suppliers.length ? <View style={styles.actionRow}><Action label={"Show 60 more suppliers · " + (suppliers.length - pagedSuppliers.length) + " remaining"} quiet onPress={() => showMoreRows("suppliers")} /></View> : null}
      <Text style={styles.fieldHint}>Purchase history is recorded when you restock a component.</Text>
    </>;
  };

  const renderSettings = () => {
    const selectedTheme = db.themeName === CUSTOM_THEME_NAME
      ? { name: CUSTOM_THEME_NAME, mode: (db.customTheme || DEFAULT_CUSTOM_THEME).mode || "dark", colors: makeCustomThemeColors(db.customTheme) }
      : THEMES.find((theme) => theme.name === db.themeName) || DEFAULT_THEME;
    const archived = [
      ...db.components.filter((x) => x.archived).map((x) => ({ ...x, group: "components", label: "Component" })),
      ...db.products.filter((x) => x.archived).map((x) => ({ ...x, group: "products", label: "Product" })),
      ...db.listings.filter((x) => x.archived).map((x) => ({ ...x, group: "listings", label: "Listing" })),
      ...db.tasks.filter((x) => x.archived).map((x) => ({ ...x, group: "tasks", label: "Task" })),
      ...db.events.filter((x) => x.archived).map((x) => ({ ...x, group: "events", label: "Event" })),
      ...db.suppliers.filter((x) => x.archived).map((x) => ({ ...x, group: "suppliers", label: "Supplier" })),
    ];
    const toggleSection = (key) => setSettingsSections((old) => ({ ...old, [key]: !old[key] }));
    const toggleCustomThemeSection = (key) => setCustomThemeSections((old) => ({ ...old, [key]: !old[key] }));
    return <>
      <ScreenDashboardHeader title="Settings" description="Set up your shop profile, marketplace fees, appearance, and data safeguards." metrics={[
        { label: "Products", value: String(db.products.filter(active).length) },
        { label: "Components", value: String(db.components.filter(active).length) },
        { label: "Sales channels", value: String(((db.dropdownOptions && db.dropdownOptions.marketplaces) || []).length) },
        { label: "Orders", value: String(db.orders.length) },
      ]} actions={[
        { label: "＋ Add business record", onPress: () => setAddChooserOpen(true) },
        { label: "Export backup", onPress: exportBackup, quiet: true },
      ]} />
      <SettingsAccordion title="What’s new messages" subtitle={ANNOUNCEMENTS.length + " published message" + (ANNOUNCEMENTS.length === 1 ? "" : "s")} expanded={settingsSections.announcements} onPress={() => toggleSection("announcements")}>
        <Text style={styles.bodyText}>These messages appear in the mailbox for every visitor after you publish the website. GitHub Pages is a static website, so messages for everyone are added to the ANNOUNCEMENTS list near the top of App.js, then published to GitHub. Each visitor’s read count is saved in their own browser.</Text>
        {ANNOUNCEMENTS.map((message) => <View key={message.id} style={styles.announcementSettingsRow}><Text style={styles.fieldLabel}>{message.title}</Text><Text style={styles.recordMeta}>{message.date}</Text><Text style={styles.bodyText}>{message.body}</Text></View>)}
      </SettingsAccordion>
      <SettingsAccordion title="Business profile" subtitle="Shop details, marketplaces, fee rules, currency, and defaults" expanded={settingsSections.profile} onPress={() => toggleSection("profile")}>
        <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Your tracker saves automatically</Text><Text style={styles.infoBannerText}>Changes are saved on this device as you make them. You can export a backup in Data and backups.</Text></View>
        <Field field={{ label: "Business name", placeholder: "Your shop name" }} value={db.businessName} onChange={(value) => saveSettings("businessName", value)} />
        <Field field={{ key: "businessStartDate", label: "Business start date", date: true }} value={db.businessStartDate || ""} onChange={(value) => saveSettings("businessStartDate", value)} />
        <Text style={styles.fieldHint}>This date appears on your dashboard with the time since your business started.</Text>
        <Field field={{ key: "currency", label: "Currency", options: ["USD", "CAD", "GBP", "EUR", "AUD", "NZD", "MXN", "JPY", "INR"].map((x) => ({ label: x, value: x })) }} value={db.currency} onChange={(value) => saveSettings("currency", value)} />
        <Field field={{ key: "dateFormat", label: "Date format", options: DATE_FORMAT_OPTIONS.map((format) => ({ label: format, value: format })) }} value={db.dateFormat || DEFAULT_DATE_FORMAT} onChange={(value) => saveSettings("dateFormat", value)} />
        <Text style={styles.fieldHint}>Date fields accept several common formats. This preference controls how dates appear across the tracker.</Text>
        <View style={styles.actionRow}><Action label="Take the practical app walkthrough" quiet onPress={() => setTutorialOpen(true)} /></View>
        <Field field={{ label: "Default low-stock level", number: true }} value={String(db.defaultLowStock)} onChange={(value) => saveSettings("defaultLowStock", Math.max(0, asNumber(value, 3)))} />
        <Field field={{ label: "Monthly sales goal (0 disables the goal bar)", number: true, placeholder: "0.00" }} value={String(db.monthlySalesGoal || 0)} onChange={(value) => saveSettings("monthlySalesGoal", Math.max(0, asNumber(value, 0)))} />
        <Field field={{ label: "Default task priority", options: (db.dropdownOptions.taskPriorities || []).map((x) => ({ label: x, value: x })) }} value={db.defaultTaskPriority || "Normal"} onChange={(value) => saveSettings("defaultTaskPriority", value)} />
        <Field field={{ label: "Default calendar event type", options: (db.dropdownOptions.eventTypes || []).map((x) => ({ label: x, value: x })) }} value={db.defaultEventType || "Deadline"} onChange={(value) => saveSettings("defaultEventType", value)} />
      <SettingsAccordion title="Marketplaces and fees" subtitle="Optional fee estimates for listings and sales" expanded={settingsSections.marketplaces} onPress={() => toggleSection("marketplaces")}>
        <Text style={styles.bodyText}>Add the channels you actually use, such as Vinted, eBay, Mercari, Depop, or Amazon. Fee estimates are optional and can be changed anytime. Saved rates appear in listing payout estimates and sale records.</Text>
        <Text style={styles.sectionTitle}>Edit your marketplaces</Text>
        <DropdownOptionManager set={{ key: "marketplaces", label: "Sales channels" }} options={db.dropdownOptions.marketplaces || DEFAULT_DROPDOWN_OPTIONS.marketplaces} onSave={saveDropdownOption} onDelete={(key, index) => deleteDropdownOption(key, index)} />
        <SettingsAccordion title="Automatic fee estimates" subtitle="Set up now or come back later" expanded={settingsSections.fees} onPress={() => toggleSection("fees")}>
          <Text style={styles.bodyText}>These are your planning estimates, not rates downloaded from a marketplace. The percentage applies to the order’s item subtotal; the fixed fee is added once for the whole order, no matter how many items it contains. Illustrative example only: 6.5% plus $0.30 on a $40 item subtotal estimates $2.90 before extra fees. Check each channel’s current fee schedule and enter its actual rates; set either value to 0 if that charge does not apply. Add a separate extra estimate on an individual sale only for another charge you expect.</Text>
          {((db.dropdownOptions && db.dropdownOptions.marketplaces) || DEFAULT_DROPDOWN_OPTIONS.marketplaces).map((marketplace) => {
            const rule = (db.marketplaceFeeRules || {})[marketplace] || {};
            return <Card key={marketplace}>
              <Text style={styles.cardTitle}>{marketplace}</Text>
              <DecimalSettingField label="Fee percentage" value={rule.percent == null ? 0 : rule.percent} hint="Decimals are allowed, such as 6.5% or 2.75%. The value saves when you leave the field." onSave={(value) => saveMarketplaceFeeRule(marketplace, "percent", value)} />
              <DecimalSettingField label="Fixed fee per order" value={rule.fixed == null ? 0 : rule.fixed} hint="Enter dollars and cents, such as 0.30. The value saves when you leave the field." onSave={(value) => saveMarketplaceFeeRule(marketplace, "fixed", value)} />
            </Card>;
          })}
        </SettingsAccordion>
      </SettingsAccordion>
      </SettingsAccordion>
      <SettingsAccordion title="Theme and colors" subtitle="Choose a palette for every page or customize each color" expanded={settingsSections.appearance} onPress={() => toggleSection("appearance")}>
        <Text style={styles.fieldLabel}>Current app theme · 50 light and 50 dark palettes</Text>
        <Pressable onPress={() => setThemePickerOpen(true)} style={styles.themePickerButton}><View style={styles.flex}><Text style={styles.recordTitle}>{db.themeName || DEFAULT_THEME_NAME}</Text><Text style={styles.recordMeta}>Preview palette colors before choosing. Applies throughout the app.</Text></View><Text style={styles.actionText}>Choose ›</Text></Pressable>
        <ThemePreview theme={selectedTheme} />
        <Card>
          <Text style={styles.cardTitle}>Customize your current palette</Text>
          <Text style={styles.bodyText}>Custom starts from your current theme. Switch to Custom to keep the palette you chose, then adjust any color below. Your accent color is included here.</Text>
          <Text style={styles.fieldLabel}>Start with a color set</Text>
          <View style={styles.actionRow}>
            <Action label="Stone & blue · Light" quiet onPress={() => applyCustomPreset(THEME_SPECS.findIndex((spec) => spec[0] === "Stone and Blue"), "light")} />
            <Action label="Pink & white · Light" quiet onPress={() => applyCustomPreset(0, "light")} />
            <Action label="Red & black · Dark" quiet onPress={() => applyCustomPreset(1, "dark")} />
            <Action label="Blue & white · Light" quiet onPress={() => applyCustomPreset(16, "light")} />
          </View>
          <Field field={{ key: "mode", label: "Custom appearance", explanation: "Choose a light or dark base. Switching modes resets surface, text, border, and touch-feedback colors to matching defaults while keeping your accent color.", options: [{ label: "Dark Mode", value: "dark" }, { label: "Light Mode", value: "light" }] }} value={(db.customTheme || DEFAULT_CUSTOM_THEME).mode || "dark"} onChange={(value) => saveCustomThemeColor("mode", value)} />
          {CUSTOM_THEME_COLOR_GROUPS.map((group) => <SettingsAccordion key={group.key} title={group.title} subtitle={group.subtitle} expanded={!!customThemeSections[group.key]} onPress={() => toggleCustomThemeSection(group.key)}>
            {group.colors.map(([key, label]) => <CustomColorSetting key={key} label={label} value={String((db.customTheme || DEFAULT_CUSTOM_THEME)[key] || DEFAULT_CUSTOM_THEME[key])} isOpen={customColorPicker === key} onToggle={() => setCustomColorPicker(customColorPicker === key ? "" : key)} onChange={(value) => saveCustomThemeColor(key, value)} onPick={(value) => saveCustomThemeColor(key, value)} />)}
          </SettingsAccordion>)}
          <Text style={styles.fieldHint}>Pick a swatch or enter a six-digit hex code, like #E5394F. Changing a color switches the app to Custom.</Text>
        </Card>
      </SettingsAccordion>
      <SettingsAccordion title="Dashboard widgets" subtitle="Show, hide, and arrange your dashboard" expanded={settingsSections.widgets} onPress={() => toggleSection("widgets")}>
        <View style={styles.sectionHeadingRow}><Text style={styles.bodyText}>Show or hide widgets and move them to arrange your home screen.</Text><Action label="Reset" quiet onPress={resetDashboardWidgets} /></View>
        {(db.dashboardWidgetOrder || DEFAULT_DASHBOARD_WIDGET_ORDER).map((widgetId) => {
          const widget = DASHBOARD_WIDGETS.find((item) => item.id === widgetId);
          if (!widget) return null;
          const isPinned = widgetId === "fulfillment";
          const isHidden = !isPinned && (db.hiddenDashboardWidgets || []).includes(widgetId);
          return <Card key={widgetId}>
            <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{widget.label}</Text><Text style={styles.recordMeta}>{isPinned ? "Always shown near the top of your dashboard." : widget.description}</Text></View><Pill text={isPinned ? "Pinned" : isHidden ? "Hidden" : "Shown"} tone={isHidden ? "neutral" : "green"} /></View>
            {!isPinned ? <View style={styles.actionRow}>
              <Action label="↑ Up" quiet onPress={() => moveDashboardWidget(widgetId, -1)} />
              <Action label="↓ Down" quiet onPress={() => moveDashboardWidget(widgetId, 1)} />
              <Action label={isHidden ? "Show" : "Hide"} onPress={() => toggleDashboardWidget(widgetId)} />
            </View> : null}
          </Card>;
        })}
      </SettingsAccordion>
      <SettingsAccordion title="Dropdown choices" subtitle="Edit conditions, priorities, categories, and other lists" expanded={settingsSections.options} onPress={() => toggleSection("options")}>
        <Text style={styles.bodyText}>Manage reusable choices used in forms. Editing a list changes future choices; existing records keep their saved values.</Text>
        {DROPDOWN_SETS.map((set) => <DropdownOptionManager key={set.key} set={set} options={db.dropdownOptions[set.key] || []} onSave={saveDropdownOption} onDelete={(key, index) => deleteDropdownOption(key, index)} />)}
      </SettingsAccordion>
      <SettingsAccordion title="Data and backups" subtitle="Export, restore, recover, or reset the tracker" expanded={settingsSections.data} onPress={() => toggleSection("data")}>
        <Card>
          <Text style={styles.cardTitle}>Back up your tracker</Text>
          <Text style={styles.bodyText}>Export a shareable copy, restore a validated backup, or recover the last on-device copy. Before restoring, the current tracker is saved as a recovery copy. Exported backups contain all saved records; share them carefully.</Text>
          <View style={styles.actionRow}><Action label="Export backup" onPress={exportBackup} /><Action label="Restore backup" quiet onPress={showBackup} /><Action label="Recover last copy" quiet onPress={restoreLocalRecovery} /></View>
        </Card>
        <Card><Text style={styles.cardTitle}>Clear business records</Text><Text style={styles.bodyText}>This clears products, stock, listings, sales, reviews, expenses, tasks, history, and your business name. Your theme and app preferences stay. A recovery copy is saved first.</Text><View style={styles.actionRow}><Action label="Clear all business records…" quiet onPress={() => { setClearConfirmText(""); setClearDataOpen(true); }} /></View></Card>
        <Card><Text style={styles.cardTitle}>Reset app to factory defaults</Text><Text style={styles.bodyText}>Remove all business records, profile details, theme choices, settings, and local recovery files. This cannot be undone. Export a backup first if you may need your data.</Text><View style={styles.actionRow}><Action label="Reset app to factory defaults…" quiet onPress={() => { setFactoryResetConfirmText(""); setFactoryResetOpen(true); }} /></View></Card>
        <Text style={styles.fieldHint}>No account or cloud sync is connected yet. Records stay on this device in unencrypted local storage, and exported backups contain all saved records. Share backups carefully. Secure sign-up and cross-device sync require a backend.</Text>
      </SettingsAccordion>
      <SettingsAccordion title="Archived records" subtitle={archived.length ? archived.length + " archived item" + (archived.length === 1 ? "" : "s") + " · restore or delete permanently" : "Restore something you archived by mistake"} expanded={settingsSections.archive} onPress={() => toggleSection("archive")}>
        {archived.length ? archived.map((item) => <Card key={item.group + item.id}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.recordTitle}>{item.name || item.title || item.productName}</Text><Text style={styles.recordMeta}>{item.label}</Text></View></View><View style={styles.actionRow}><Action label="Restore" onPress={() => restoreRecord(item.group, item)} /><Action label="Delete permanently" quiet onPress={() => permanentlyDeleteRecord(item.group, item, item.label)} /></View></Card>) : <Text style={styles.bodyText}>Archived items will appear here. You can restore an item or delete it permanently.</Text>}
      </SettingsAccordion>
    </>;
  };
  const renderHelpPage = () => {
    const query = helpSearch.trim().toLowerCase();
    const questions = FAQ_ITEMS.filter((item) => !query || (item.question + " " + item.answer + " " + item.tags).toLowerCase().includes(query));
    const guides = Object.entries(HELP_COPY).filter(([name]) => name !== "Help & FAQ" && name !== "More").filter(([name, copy]) => !query || (name + " " + copy.join(" ")).toLowerCase().includes(query));
    return <>
      <View style={styles.helpHero}>
        <Text style={styles.helpEyebrow}>GUIDE & SUPPORT</Text>
        <Text style={styles.helpHeroTitle}>Find your way around</Text>
        <Text style={styles.helpHeroText}>Search instructions and common answers. Your tracker saves in this browser; copyable backups help you move a copy when needed.</Text>
      </View>
      <View style={styles.helpSearch}>
        <Text style={styles.helpSearchLabel}>Search the guide</Text>
        <TextInput value={helpSearch} onChangeText={(value) => { setHelpSearch(value); setHelpExpandedFaq(-1); setHelpExpandedGuide(""); }} placeholder="Try ‘supplier’, ‘purchase date’, ‘backup’…" placeholderTextColor={COLORS.placeholder} style={styles.input} returnKeyType="search" />
      </View>
      <View style={styles.helpLinkWrap}>
        {[["Components", "Manage supplies"], ["Orders", "Enter a sale"], ["Suppliers", "Supplier directory"], ["Settings", "Profile & backups"]].map(([page, label]) => <Pressable key={page} style={styles.helpLink} onPress={() => navigateRoot(page)}><Text style={styles.helpLinkLabel}>{label}</Text><Text style={styles.helpLinkArrow}>›</Text></Pressable>)}
      </View>
      <View style={styles.helpSectionHead}><Text style={styles.sectionTitle}>Questions & answers</Text><Text style={styles.subtle}>{questions.length} topics</Text></View>
      {questions.length ? questions.map((item, index) => <Pressable key={item.question} onPress={() => setHelpExpandedFaq(helpExpandedFaq === index ? -1 : index)} style={styles.helpQuestion}>
        <View style={styles.helpQuestionTop}><Text style={styles.helpQuestionText}>{item.question}</Text><Text style={styles.helpQuestionMark}>{helpExpandedFaq === index ? "−" : "+"}</Text></View>
        {helpExpandedFaq === index ? <Text style={styles.bodyText}>{item.answer}</Text> : null}
      </Pressable>) : <EmptyState title="No guide results" body="Try a shorter search such as ‘stock’, ‘backup’, or ‘date’." />}
      <View style={styles.helpSectionHead}><Text style={styles.sectionTitle}>Step-by-step instructions</Text><Text style={styles.subtle}>{guides.length} guides</Text></View>
      {guides.length ? guides.map(([name, copy]) => <Pressable key={name} onPress={() => setHelpExpandedGuide(helpExpandedGuide === name ? "" : name)} style={styles.helpGuide}>
        <View style={styles.helpQuestionTop}><View style={styles.flex}><Text style={styles.helpGuideTitle}>{name}</Text><Text style={styles.helpGuideSummary} numberOfLines={helpExpandedGuide === name ? undefined : 2}>{copy[0]}</Text></View><Text style={styles.helpQuestionMark}>{helpExpandedGuide === name ? "−" : "+"}</Text></View>
        {helpExpandedGuide === name ? <View style={styles.helpExample}><Text style={styles.fieldLabel}>Example</Text><Text style={styles.bodyText}>{copy[1]}</Text></View> : null}
      </Pressable>) : <Text style={styles.bodyText}>No matching instructions. Clear the search to browse all guides.</Text>}
    </>;
  };

  const renderMore = () => (
    <>
      <View style={styles.welcomeBoxCompact}><Text style={styles.eyebrow}>BUSINESS TOOLKIT</Text><Text style={styles.welcomeTitle}>All pages</Text><Text style={styles.welcomeText}>Choose any part of your business tracker.</Text></View>
      <View style={styles.moreGrid}>
        {MORE_ITEMS.map(([name, _icon, sub]) => (
            <Pressable key={name} onPress={() => navigateToScreen(name)} style={[styles.moreTile, wideLayout && styles.moreTileWide]}>
            <View style={styles.moreIcon}><AppIcon name={PAGE_ICON_NAMES[name] || "dashboard"} size={19} color={COLORS.wine} /></View><Text style={styles.moreTitle}>{name}</Text><Text style={styles.moreSub}>{sub}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={styles.quickNoteCard}><Text style={styles.cardTitle}>Quick capture</Text><Text style={styles.bodyText}>Ideas, tasks, and business dates are saved in their own sections.</Text><View style={styles.actionRow}><Action label="New task" onPress={() => beginAdd("task")} /><Action label="Save an idea" onPress={() => beginAdd("idea")} /><Action label="Add an event" onPress={() => beginAdd("event")} /></View></Card>
    </>
  );

  const fulfillmentRouteMatch = screen.match(/^Fulfillment:(status|phase):(.*)$/);
  const isFulfillmentPage = !!fulfillmentRouteMatch;
  const fulfillmentPageTitle = fulfillmentRouteMatch ? fulfillmentRouteMatch[2] : "";
  const contentForScreen = () => {
    if (fulfillmentRouteMatch) return renderFulfillmentStatus(fulfillmentRouteMatch[1], fulfillmentRouteMatch[2]);
    switch (screen) {
      case "Dashboard": return renderDashboard();
      case "Components": return renderComponents();
      case "Products": return renderProducts();
      case "Production": return renderProduction();
      case "Listings": return renderListings();
      case "Listing Analytics": return renderListingAnalytics();
      case "Orders": return renderOrders();
      case "Reviews": return renderReviews();
      case "Ideas": return renderIdeas();
      case "Finances": return renderFinances();
      case "Calendar": return renderCalendar();
      case "Audit": return renderAudit();
      case "Suppliers": return renderSuppliers();
      case "Help & FAQ": return renderHelpPage();
      case "Settings": return renderSettings();
      default: return renderMore();
    }
  };

  const screenTitle = isFulfillmentPage ? fulfillmentPageTitle : screen === "More" ? "All pages" : screen;
  const renderSettingsShortcut = () => {
    const selected = screen === "Settings";
    return <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => { navigateRoot("Settings"); setSearch(""); setMobileNavOpen(false); }} style={[styles.sidebarLink, styles.sidebarSettingsLink, selected && styles.sidebarLinkSelected]}>
      <View style={[styles.sidebarIcon, selected && styles.sidebarIconSelected]}><AppIcon name="settings" size={17} color={selected ? COLORS.onAccent : COLORS.muted} /></View>
      <Text style={[styles.sidebarLinkText, selected && styles.sidebarLinkTextSelected]}>Settings</Text>
      {selected ? <View style={styles.sidebarActiveMark} /> : null}
    </Pressable>;
  };
  const renderNavigationLinks = () => SIDEBAR_GROUPS.map((group) => <View key={group.label} style={styles.sidebarGroup}>
    <Text style={styles.sidebarGroupTitle}>{group.label}</Text>
    {group.pages.map((page) => {
      const selected = screen === page || (isFulfillmentPage && page === "Orders");
      return <Pressable key={page} accessibilityRole="button" accessibilityLabel={page} onPress={() => { navigateRoot(page); setSearch(""); setMobileNavOpen(false); }} style={[styles.sidebarLink, selected && styles.sidebarLinkSelected]}>
        <View style={[styles.sidebarIcon, selected && styles.sidebarIconSelected]}><AppIcon name={PAGE_ICON_NAMES[page] || "dashboard"} size={17} color={selected ? COLORS.onAccent : COLORS.muted} /></View>
        <Text style={[styles.sidebarLinkText, selected && styles.sidebarLinkTextSelected]}>{page}</Text>
        {selected ? <View style={styles.sidebarActiveMark} /> : null}
      </Pressable>;
    })}
  </View>);
  const themeMode = db.themeName === CUSTOM_THEME_NAME
    ? ((db.customTheme || DEFAULT_CUSTOM_THEME).mode || "dark")
    : (THEMES.find((theme) => theme.name === db.themeName) || DEFAULT_THEME).mode;

  if (!ready && !storageLoadError) {
    return <SafeAreaView style={styles.loading}><StatusBar barStyle={themeMode === "dark" ? "light-content" : "dark-content"} backgroundColor={COLORS.paper} /><Text style={styles.logoMark}>G</Text><Text style={styles.loadingText}>Opening your business tracker...</Text></SafeAreaView>;
  }

  if (storageLoadError) {
    return <ButtonSoundContext.Provider value={playButtonSound}><SafeAreaView style={styles.safe}><StatusBar barStyle={themeMode === "dark" ? "light-content" : "dark-content"} backgroundColor={COLORS.paper} /><ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <View style={styles.formHero}><Text style={styles.formHeroEyebrow}>TRACKER RECOVERY</Text><Text style={styles.formHeroTitle}>Your saved data needs attention</Text><Text style={styles.formHeroText}>The app could not safely open its saved data. It has not replaced that data with a blank tracker.</Text></View>
      <Card><Text style={styles.cardTitle}>What happened?</Text><Text style={styles.bodyText}>{storageLoadError}</Text><Text style={styles.bodyText}>The app tried to open and migrate the saved tracker, then checked its on-device recovery copy. Neither was readable, and both saved files have been kept.</Text>
        <Text style={styles.bodyText}>You do not need to paste backup text to load normal saved data. The optional backup box below is only for a separate backup file you already have.</Text>
        <View style={styles.actionRow}><Action label="Retry automatic recovery" onPress={retryStorageLoad} /><Action label="Open on-device recovery copy" quiet onPress={restoreLocalRecovery} /><Action label="Start fresh and keep saved file" quiet onPress={continueWithNewTracker} /></View>
      </Card>
      <Card><Text style={styles.cardTitle}>Optional: restore a backup you already have</Text><Text style={styles.bodyText}>You do not need a backup to open normally saved data. Only use this if automatic recovery cannot open the local copies.</Text><TextInput value={backupText} onChangeText={(value) => { setBackupText(value); setBackupPreview(null); setBackupFeedback(null); setBackupRestoreComplete(false); }} multiline autoCapitalize="none" style={styles.backupInput} placeholder="Paste an existing GRIMMS backup (optional)" placeholderTextColor={COLORS.placeholder} />
        {backupFeedback ? <View style={[styles.backupFeedback, backupFeedback.type === "error" && styles.backupFeedbackError, backupFeedback.type === "success" && styles.backupFeedbackSuccess, backupFeedback.type === "info" && styles.backupFeedbackInfo]}><Text accessibilityLiveRegion="polite" style={styles.backupFeedbackText}>{backupFeedback.text}</Text></View> : null}
        {backupPreview ? <View style={styles.backupReview}><Text style={styles.fieldLabel}>Backup contents</Text><Text style={styles.bodyText}>{backupPreview.summary}</Text><Text style={styles.fieldHint}>Your current in-memory tracker will be saved as a recovery copy before this backup is restored.</Text></View> : null}
        <View style={styles.actionRow}><Action label={backupRestoring ? "Restoring…" : backupRestoreComplete ? "Done" : backupPreview ? "Restore backup" : "Check backup"} onPress={backupRestoring ? () => {} : backupRestoreComplete ? () => { setStorageLoadError(""); setBackupOpen(true); } : backupPreview ? restoreCheckedBackup : checkBackupText} /></View></Card>
    </ScrollView></SafeAreaView></ButtonSoundContext.Provider>;
  }

  return (
    <ButtonSoundContext.Provider value={playButtonSound}>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={themeMode === "dark" ? "light-content" : "dark-content"} backgroundColor={COLORS.paper} />
      <View style={styles.topBar}>
        <View style={styles.topBarStart}>
          {!wideLayout ? <Pressable accessibilityRole="button" accessibilityLabel="Open all pages" style={styles.menuButton} onPress={() => setMobileNavOpen(true)}><AppIcon name="menu" size={19} color={COLORS.ink} /></Pressable> : null}
          <Pressable style={styles.brand} onPress={() => navigateRoot("Dashboard")}><View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View><View><Text style={styles.brandName}>GRIMMS</Text><Text style={styles.brandSub}>BUSINESS TRACKER</Text></View></Pressable>
        </View>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={"What's new" + (unreadAnnouncementCount ? ", " + unreadAnnouncementCount + " unread" : "")} style={styles.mailboxButton} onPress={() => setAnnouncementOpen(true)}>
            <AppIcon name="mail" size={19} color={COLORS.ink} />
            {unreadAnnouncementCount ? <View style={styles.mailCountBadge}><Text style={styles.mailCountText}>{unreadAnnouncementCount > 9 ? "9+" : unreadAnnouncementCount}</Text></View> : null}
          </Pressable>
          <Pressable onPress={saveError ? retrySave : undefined} accessibilityLabel={saveError || (saving ? "Saving tracker data" : lastSavedAt ? "Tracker saved" : "Tracker ready")}><Text style={[styles.saveState, saveError && { color: COLORS.red, fontWeight: "700" }]}>{saveError || (saving ? "Saving…" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Ready")}</Text></Pressable>
          <Pressable accessibilityLabel="Add a business record" style={styles.addCircle} onPress={() => setAddChooserOpen(true)}><AppIcon name="plus" size={19} color={COLORS.onAccent} /></Pressable>
        </View>
      </View>
      <View style={[styles.appBody, wideLayout && styles.appBodyWide]}>
      {wideLayout ? <View style={styles.sidebar}><ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>{renderNavigationLinks()}</ScrollView><View style={styles.sidebarFooter}>{renderSettingsShortcut()}</View></View> : null}
      <View style={styles.contentPane}>
      {screen !== "More" && screen !== "Dashboard" && screen !== "Settings" && screen !== "Help & FAQ" && (
        <View style={styles.searchWrap}><AppIcon name="search" size={17} color={COLORS.muted} /><TextInput value={search} onChangeText={setSearch} placeholder={"Search " + (isFulfillmentPage ? "products" : screen.toLowerCase())} placeholderTextColor={COLORS.placeholder} style={styles.searchInput} returnKeyType="search" /><Pressable onPress={() => setSearch("")}><Text style={styles.searchClear}>×</Text></Pressable></View>
      )}
      <View style={styles.screenHeading}><View style={styles.flex}><Text style={styles.screenTitle}>{screenTitle}</Text>{screen !== "Dashboard" ? <Text style={styles.screenSubtitle}>{isFulfillmentPage ? "Products in this fulfillment status" : screen === "Production" ? "Turn materials into finished inventory" : screen === "Ideas" ? "Save and move product ideas through your work" : screen === "Listing Analytics" ? "Record marketplace stats and review performance" : screen === "Help & FAQ" ? "Instructions and answers for your business tools" : "A clear view of your handmade business"}</Text> : <Text style={styles.screenSubtitle}>Your handmade business, in one place</Text>}</View>
        <View style={styles.headerActions}>
          {navigationStack.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerAdd} onPress={navigateBack}><Text style={styles.headerAddText}>‹ Back</Text></Pressable> : null}
          <Pressable accessibilityLabel={screenTitle + " help"} style={styles.helpButton} onPress={() => setHelpOpen(true)}><AppIcon name="help" size={17} color={COLORS.wine} /></Pressable>
        </View>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={styles.mainScroll} contentContainerStyle={[styles.pageContent, wideLayout && styles.pageContentWide]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {storageLoadNotice ? <Pressable onPress={() => setStorageLoadNotice("")} style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Saved data status</Text><Text style={styles.infoBannerText}>{storageLoadNotice} Tap to dismiss.</Text></Pressable> : null}
          {recordActionNotice ? <View accessibilityLiveRegion="polite" style={styles.recordActionNotice}><Text style={styles.recordActionNoticeTitle}>Change applied</Text><Text style={styles.recordActionNoticeText}>{recordActionNotice}</Text></View> : null}
          {contentForScreen()}
          <View style={styles.bottomNote}><Text style={styles.bottomNoteText}>GRIMMS · Keep your business moving, one step at a time.</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
      </View>
      </View>
      <Modal visible={!wideLayout && mobileNavOpen} animationType="fade" transparent onRequestClose={() => setMobileNavOpen(false)}>
        <View style={styles.mobileNavOverlay}>
          <Pressable style={styles.mobileNavScrim} onPress={() => setMobileNavOpen(false)} accessibilityLabel="Close pages menu" />
          <SafeAreaView style={styles.mobileNavDrawer}>
            <View style={styles.mobileNavHeader}><View><Text style={styles.mobileNavTitle}>All pages</Text><Text style={styles.mobileNavSubtitle}>Choose a workspace area</Text></View><Pressable accessibilityRole="button" onPress={() => setMobileNavOpen(false)}><Text style={styles.modalCancel}>Close</Text></Pressable></View>
            <ScrollView contentContainerStyle={styles.sidebarContent}>{renderNavigationLinks()}</ScrollView>
            <View style={styles.sidebarFooter}>{renderSettingsShortcut()}</View>
          </SafeAreaView>
        </View>
      </Modal>
      <Modal visible={announcementOpen} transparent animationType="fade" onRequestClose={() => setAnnouncementOpen(false)}>
        <View style={styles.announcementOverlay}>
          <Pressable style={styles.announcementScrim} onPress={() => setAnnouncementOpen(false)} accessibilityLabel="Close What's new inbox" />
          <SafeAreaView style={styles.announcementPanel}>
            <View style={styles.announcementHeader}>
              <View style={styles.flex}>
                <Text style={styles.announcementTitle}>What’s new</Text>
                <Text style={styles.announcementSubtitle}>{unreadAnnouncementCount ? unreadAnnouncementCount + " unread message" + (unreadAnnouncementCount === 1 ? "" : "s") : "You’re all caught up"}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setAnnouncementOpen(false)} style={styles.announcementClose}><Text style={styles.modalCancel}>Close</Text></Pressable>
            </View>
            <ScrollView style={styles.announcementList} contentContainerStyle={styles.announcementListContent}>
              <View style={styles.actionRow}>
                {visibleAnnouncements.length ? <Action label="Dismiss all" onPress={dismissAllAnnouncements} /> : null}
                {dismissedAnnouncementIds.length ? <Action label="Restore all" quiet onPress={restoreAllAnnouncements} /> : null}
                {unreadAnnouncementCount ? <Action label="Mark all read" quiet onPress={() => setData((old) => ({ ...old, readAnnouncementIds: Array.from(new Set((Array.isArray(old.readAnnouncementIds) ? old.readAnnouncementIds : []).concat(visibleAnnouncements.map((message) => message.id)))) }))} /> : null}
              </View>
              {visibleAnnouncements.length ? visibleAnnouncements.map((message) => {
                const isUnread = !readAnnouncementIds.includes(message.id);
                return <View key={message.id} style={[styles.announcementMessage, isUnread && styles.announcementUnread]}>
                  <View style={styles.announcementMessageTop}>
                    <Text style={styles.announcementMessageTitle}>{message.title}</Text>
                    {isUnread ? <View style={styles.announcementUnreadDot} /> : null}
                  </View>
                  <Text style={styles.announcementDate}>{message.date}</Text>
                  <Text style={styles.bodyText}>{message.body}</Text>
                  <View style={styles.announcementMessageActions}>{isUnread ? <Pressable accessibilityRole="button" onPress={() => markAnnouncementRead(message.id)} style={styles.announcementReadAction}><Text style={styles.announcementMarkAllText}>Mark as read</Text></Pressable> : <Text style={styles.announcementReadLabel}>Read</Text>}<Pressable accessibilityRole="button" onPress={() => dismissAnnouncement(message.id)} style={styles.announcementReadAction}><Text style={styles.announcementMarkAllText}>Dismiss</Text></Pressable></View>
                </View>;
              }) : <Text style={styles.bodyText}>{ANNOUNCEMENTS.length ? "All messages are dismissed. Choose Restore all to bring them back." : "There are no announcements yet."}</Text>}
            </ScrollView>
            <Text style={styles.announcementFootnote}>Updates are published with the website. Your read status is saved in this browser.</Text>
          </SafeAreaView>
        </View>
      </Modal>
      <RecordModal visible={!!modalType} type={modalType} record={editingRecord} db={db} prefill={formPrefill} onClose={closeForm} onSave={saveRecord} onManageOptions={manageDropdownFromField} />
      <ThemeChooserModal visible={themePickerOpen} currentName={db.themeName} customTheme={db.customTheme} onClose={() => setThemePickerOpen(false)} onSelect={(name) => { chooseTheme(name); setThemePickerOpen(false); }} />
      <HelpModal visible={helpOpen} screen={isFulfillmentPage ? "Orders" : screen} onClose={() => setHelpOpen(false)} />
      <TutorialModal visible={tutorialOpen} onClose={() => finishTutorial(false)} onOpenSettings={() => finishTutorial(true)} onRestoreBackup={openSavedBackupRestore} />
      <WelcomeSetupModal visible={welcomeOpen} db={db} onFinish={finishWelcomeSetup} onSkip={skipWelcomeSetup} onRestoreBackup={openSavedBackupRestore} />
      <WelcomeBackModal visible={welcomeBackOpen && !welcomeOpen} db={db} onContinue={() => setWelcomeBackOpen(false)} onRestoreBackup={openSavedBackupRestore} />
      <RecordDetailModal visible={!!detailSelection} type={detailSelection && detailSelection.type} record={detailRecord} currency={db.currency} inventoryHistory={detailSelection && detailSelection.type === "component" ? (db.componentTransactions || []).filter((entry) => entry.componentId === detailSelection.id).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 20) : detailSelection && detailSelection.type === "product" ? (db.productTransactions || []).filter((entry) => entry.productId === detailSelection.id).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 20) : []} onClose={() => setDetailSelection(null)} onEdit={() => { beginEdit(detailSelection.type, detailRecord); setDetailSelection(null); }} />
      <TimeEditModal visible={!!timeEdit} mode={timeEdit && timeEdit.mode} session={timeEdit && timeEdit.session} tasks={db.tasks} onClose={() => setTimeEdit(null)} onSave={saveEditedTime} />
      <DiscountPlanModal visible={!!discountEditor} listing={discountEditor ? db.listings.find((item) => item.id === discountEditor.listingId) : null} plan={discountEditor && discountEditor.plan} onClose={() => setDiscountEditor(null)} onSave={saveDiscountPlan} />
      <RelistModal visible={!!relistEditor} listing={relistEditor} product={relistEditor ? db.products.find((item) => item.id === relistEditor.productId) : null} onClose={() => setRelistEditor(null)} onSave={saveRelist} />
      <Modal visible={!!analyticsEntryMode} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAnalyticsEntryMode("")}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}><Pressable onPress={() => setAnalyticsEntryMode("")}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{analyticsEntryMode === "bulk" ? "Bulk record metrics" : "Record listing metrics"}</Text><Pressable onPress={saveAnalyticsEntry}><Text style={styles.modalSave}>Save</Text></Pressable></View>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <View style={styles.infoBanner}><Text style={styles.infoBannerTitle}>Save the totals you see right now</Text><Text style={styles.infoBannerText}>Each check is kept as a separate snapshot. Leave metrics blank if that marketplace does not provide them. The app compares checks later to estimate increases.</Text></View>
              {analyticsEntryMode === "single" ? <>
                {(() => {
                  const selected = db.listings.find((item) => item.id === analyticsEntryListingId);
                  const channels = listingAnalyticsChannels(selected);
                  return <>
                    <Field field={{ label: "Listing", options: db.listings.filter(listingAnalyticsIsActive).map((item) => ({ label: [item.productName, item.listingSku].filter(Boolean).join(" · "), value: item.id })), searchable: true, searchPlaceholder: "Search listings" }} value={analyticsEntryListingId} onChange={(id) => { const next = db.listings.find((item) => item.id === id); setAnalyticsEntryListingId(id); setAnalyticsEntryMarketplace(listingAnalyticsChannels(next)[0] || ""); }} />
                    <Field field={{ label: "Marketplace", options: channels.map((channel) => ({ label: channel, value: channel })) }} value={analyticsEntryMarketplace} onChange={setAnalyticsEntryMarketplace} />
                    <Field field={{ label: "Date checked", date: true }} value={analyticsEntryDate} onChange={setAnalyticsEntryDate} />
                    <Text style={styles.fieldLabel}>Time checked (24-hour HH:MM)</Text><TextInput value={analyticsEntryTime} onChangeText={setAnalyticsEntryTime} placeholder="14:30" placeholderTextColor={COLORS.placeholder} keyboardType="numbers-and-punctuation" style={styles.input} />
                    <View style={styles.formSection}><Text style={styles.formSectionTitle}>Marketplace totals</Text>{LISTING_ANALYTICS_METRICS.map((metric) => <View key={metric.key} style={styles.analyticsInputRow}><Text style={styles.optionText}>{metric.label}</Text><TextInput value={String(analyticsEntryMetrics[metric.key] == null ? "" : analyticsEntryMetrics[metric.key])} onChangeText={(value) => setAnalyticsEntryMetrics((old) => ({ ...old, [metric.key]: value }))} keyboardType="number-pad" placeholder="Leave blank if unavailable" placeholderTextColor={COLORS.placeholder} style={styles.analyticsInput} /></View>)}</View>
                    <Field field={{ label: "Note (optional)", multiline: true, placeholder: "What changed, or where did you read these numbers?" }} value={analyticsEntryNote} onChange={setAnalyticsEntryNote} />
                  </>;
                })()}
              </> : <>
                <Field field={{ label: "Marketplace", options: Array.from(new Set(db.listings.filter(listingAnalyticsIsActive).flatMap(listingAnalyticsChannels))).map((channel) => ({ label: channel, value: channel })) }} value={analyticsEntryMarketplace} onChange={(channel) => { setAnalyticsEntryMarketplace(channel); setAnalyticsBulkRows({}); }} />
                <Field field={{ label: "Date checked", date: true }} value={analyticsEntryDate} onChange={setAnalyticsEntryDate} />
                <Text style={styles.fieldLabel}>Time checked (24-hour HH:MM)</Text><TextInput value={analyticsEntryTime} onChangeText={setAnalyticsEntryTime} placeholder="14:30" placeholderTextColor={COLORS.placeholder} keyboardType="numbers-and-punctuation" style={styles.input} />
                <Text style={styles.fieldHint}>Enter the marketplace totals for each listing below. Unchanged cells can stay blank; each row with at least one value will save as its own snapshot.</Text>
                {db.listings.filter((item) => listingAnalyticsIsActive(item) && listingAnalyticsChannels(item).includes(analyticsEntryMarketplace)).map((listing) => <View key={listing.id} style={styles.formSection}><Text style={styles.formSectionTitle}>{listing.productName}</Text><Text style={styles.recordMeta}>{listing.listingSku || "Listing"} · {analyticsEntryMarketplace}</Text>{LISTING_ANALYTICS_METRICS.map((metric) => <View key={metric.key} style={styles.analyticsInputRow}><Text style={styles.optionText}>{metric.label}</Text><TextInput value={String((analyticsBulkRows[listing.id] || {})[metric.key] == null ? "" : (analyticsBulkRows[listing.id] || {})[metric.key])} onChangeText={(value) => setAnalyticsBulkRows((old) => ({ ...old, [listing.id]: { ...(old[listing.id] || {}), [metric.key]: value } }))} keyboardType="number-pad" placeholder="—" placeholderTextColor={COLORS.placeholder} style={styles.analyticsInput} /></View>)}</View>)}
                <Field field={{ label: "Note for these checks (optional)", multiline: true, placeholder: "Shared note" }} value={analyticsEntryNote} onChange={setAnalyticsEntryNote} />
              </>}
              <View style={styles.actionRow}><Action label="Cancel" quiet onPress={() => setAnalyticsEntryMode("")} /><Action label={analyticsEntryMode === "bulk" ? "Save completed rows" : "Save recording"} onPress={saveAnalyticsEntry} /></View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <DateEditModal visible={!!timelineEditor} entry={timelineEditor} statuses={timelineStatuses} onClose={() => setTimelineEditor(null)} onSave={saveTimelineDate} />
      <RefundModal visible={!!refundEditor} order={refundEditor ? db.orders.find((item) => item.id === refundEditor.id) : null} currency={db.currency} onClose={() => setRefundEditor(null)} onSave={(values) => saveOrderRefund(refundEditor, values)} />
      <Modal visible={addChooserOpen} animationType="fade" transparent onRequestClose={() => setAddChooserOpen(false)}>
        <View style={styles.chooserBackdrop}>
          <View style={styles.chooserCard}>
            <View style={styles.cardTop}><Text style={styles.cardTitle}>What would you like to add?</Text><Pressable onPress={() => setAddChooserOpen(false)}><Text style={styles.modalCancel}>Close</Text></Pressable></View>
            <View style={styles.chooserGrid}>
              {[
                ["component", "CM", "Component"], ["product", "PD", "Product"], ["listing", "LS", "Listing"],
                ["order", "OR", "Sale"], ["review", "RV", "Buyer review"], ["expense", "FN", "Expense"], ["task", "TK", "Task"],
                ["event", "CL", "Calendar event"], ["workPlan", "TM", "Planned work"], ["idea", "ID", "Product idea"], ["supplier", "SP", "Supplier"], ["restock", "RS", "Restock"],
              ].map(([type, _icon, label]) => (
                <Pressable key={type} style={styles.chooserOption} onPress={() => { setAddChooserOpen(false); beginAdd(type); }}>
                  <View style={styles.chooserIcon}><AppIcon name={RECORD_ICON_NAMES[type] || "dashboard"} size={17} color={COLORS.wine} /></View><Text style={styles.chooserLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={backupOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBackupOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}><Pressable onPress={() => setBackupOpen(false)}><Text style={styles.modalCancel}>Close</Text></Pressable><Text style={styles.modalTitle}>{backupMode === "export" ? "Copy backup text" : "Restore backup"}</Text>{backupMode === "export" ? <Pressable onPress={copyBackup}><Text style={styles.modalSave}>Copy text</Text></Pressable> : <View style={styles.modalHeaderSpacer} />}</View>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={styles.backupContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.cardTitle}>{backupMode === "export" ? "Your tracker backup" : "Paste a GRIMMS backup"}</Text>
            <Text style={styles.bodyText}>{backupMode === "export" ? "Choose Copy text, then keep the copied text somewhere private. To restore later, open Restore backup and paste the complete text. This is a copyable backup; nothing downloads to your computer." : "Paste the complete backup text below, then choose Check backup. You will see what is inside before confirming. Your current tracker is saved as a recovery copy first."}</Text>
            <TextInput value={backupText} onChangeText={(value) => { setBackupText(value); setBackupPreview(null); setBackupFeedback(null); setBackupRestoreComplete(false); }} multiline autoCapitalize="none" autoCorrect={false} style={styles.backupInput} placeholder="Paste backup JSON here" placeholderTextColor={COLORS.placeholder} />
            {backupMode === "export" ? <View style={styles.actionRow}><Action label="Copy backup text" onPress={copyBackup} /><Action label="Select the text to copy manually" quiet onPress={() => Alert.alert("Copy manually", "Click inside the backup box, select all text, and copy it. Keep that text somewhere private.")} /></View> : <>
              {backupFeedback ? <View style={[styles.backupFeedback, backupFeedback.type === "error" && styles.backupFeedbackError, backupFeedback.type === "success" && styles.backupFeedbackSuccess, backupFeedback.type === "info" && styles.backupFeedbackInfo]}><Text accessibilityLiveRegion="polite" style={styles.backupFeedbackText}>{backupFeedback.text}</Text></View> : null}
              {backupPreview ? <View style={styles.backupReview}><Text style={styles.fieldLabel}>Backup contents</Text><Text style={styles.bodyText}>{backupPreview.summary}</Text><Text style={styles.fieldHint}>Your current tracker will be saved in the recovery copy before this backup replaces it.</Text></View> : null}
            </>}
          </ScrollView>
          {backupMode === "restore" ? <View style={styles.backupFooter}><Pressable accessibilityRole="button" accessibilityLabel={backupRestoring ? "Restoring backup" : backupRestoreComplete ? "Done" : backupPreview ? "Restore backup" : "Check backup"} accessibilityState={{ disabled: backupRestoring || (!backupText.trim() && !backupRestoreComplete) }} disabled={backupRestoring || (!backupText.trim() && !backupRestoreComplete)} style={[styles.primaryButtonFull, styles.backupPrimaryButton, (backupRestoring || (!backupText.trim() && !backupRestoreComplete)) && styles.disabledButton]} onPress={() => { if (backupRestoreComplete) setBackupOpen(false); else if (backupPreview) restoreCheckedBackup(); else checkBackupText(); }}><Text style={styles.primaryButtonFullText}>{backupRestoring ? "Restoring…" : backupRestoreComplete ? "Done" : backupPreview ? "Restore backup" : "Check backup"}</Text></Pressable></View> : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal visible={clearDataOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setClearDataOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}><Pressable onPress={() => setClearDataOpen(false)}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>Clear business records</Text><View style={styles.modalHeaderSpacer} /></View>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <View style={styles.formHero}><Text style={styles.formHeroEyebrow}>RECOVERABLE RESET</Text><Text style={styles.formHeroTitle}>This removes business records</Text><Text style={styles.formHeroText}>A recovery copy is written before the reset. Your saved theme and app preferences are kept.</Text></View>
              <Card><Text style={styles.cardTitle}>Type DELETE to continue</Text><Text style={styles.bodyText}>The app will clear products, components, listings, sales, reviews, expenses, tasks, time records, and business profile details.</Text><TextInput value={clearConfirmText} onChangeText={setClearConfirmText} autoCapitalize="characters" autoCorrect={false} style={styles.input} placeholder="DELETE" placeholderTextColor={COLORS.placeholder} /></Card>
              <Pressable style={[styles.primaryButtonFull, clearConfirmText.trim() !== "DELETE" && styles.disabledButton]} onPress={clearBusinessData}><Text style={styles.primaryButtonFullText}>Save recovery copy and clear records</Text></Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal visible={factoryResetOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFactoryResetOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}><Pressable onPress={() => setFactoryResetOpen(false)}><Text style={styles.modalCancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>Factory reset</Text><View style={styles.modalHeaderSpacer} /></View>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <View style={styles.formHero}><Text style={styles.formHeroEyebrow}>PERMANENT RESET</Text><Text style={styles.formHeroTitle}>Return this app to its defaults</Text><Text style={styles.formHeroText}>This removes all saved tracker data and settings from this device, including recovery copies.</Text></View>
              <Card><Text style={styles.cardTitle}>Type RESET to continue</Text><Text style={styles.bodyText}>This action cannot be undone. Export a backup first if you want to keep your records. It resets this tracker’s saved data; it does not uninstall Expo Go or change device settings.</Text><TextInput value={factoryResetConfirmText} onChangeText={setFactoryResetConfirmText} autoCapitalize="characters" autoCorrect={false} style={styles.input} placeholder="RESET" placeholderTextColor={COLORS.placeholder} /></Card>
              <Pressable style={[styles.primaryButtonFull, (factoryResetConfirmText.trim() !== "RESET" || factoryResetting) && styles.disabledButton]} onPress={resetAppToFactoryDefaults}><Text style={styles.primaryButtonFullText}>{factoryResetting ? "Resetting…" : "Delete all local data and reset app"}</Text></Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal visible={!!pendingRecordConfirmation} transparent animationType="fade" onRequestClose={() => setPendingRecordConfirmation(null)}>
        <View style={styles.recordConfirmOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel confirmation" style={styles.recordConfirmScrim} onPress={() => setPendingRecordConfirmation(null)} />
          <View accessibilityViewIsModal style={styles.recordConfirmCard}>
            <Text style={styles.recordConfirmEyebrow}>PLEASE CONFIRM</Text>
            <Text style={styles.recordConfirmTitle}>{pendingRecordConfirmation && pendingRecordConfirmation.title}</Text>
            <Text style={styles.recordConfirmMessage}>{pendingRecordConfirmation && pendingRecordConfirmation.message}</Text>
            <View style={styles.recordConfirmActions}>
              <Pressable accessibilityRole="button" style={styles.recordConfirmCancel} onPress={() => setPendingRecordConfirmation(null)}><Text style={styles.recordConfirmCancelText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.recordConfirmDestructive} onPress={finishRecordConfirmation}><Text style={styles.recordConfirmDestructiveText}>{pendingRecordConfirmation && pendingRecordConfirmation.confirmLabel}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </ButtonSoundContext.Provider>
  );
}

function EmptyState({ title, body, action, onPress }) {
  return <Card style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✦</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.bodyText}>{body}</Text>{action ? <Pressable style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryButtonText}>{action}</Text></Pressable> : null}</Card>;
}

/* eslint-disable react-native/no-unused-styles -- The theme factory rebuilds this module-level stylesheet at runtime, which the static rule cannot trace. */
function makeStyles() { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  appBody: { flex: 1, minHeight: 0 },
  appBodyWide: { flexDirection: "row" },
  contentPane: { flex: 1, minWidth: 0 },
  sidebar: { width: 218, backgroundColor: COLORS.card, borderRightWidth: 1, borderRightColor: COLORS.line },
  sidebarScroll: { flex: 1 },
  sidebarContent: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  sidebarGroup: { marginBottom: 8 },
  sidebarGroupTitle: { color: COLORS.muted, fontSize: 9, letterSpacing: 1.05, fontWeight: "800", paddingHorizontal: 8, paddingBottom: 4 },
  sidebarLink: { minHeight: 35, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8, marginBottom: 1 },
  sidebarSettingsLink: { minHeight: 40 },
  sidebarLinkSelected: { backgroundColor: COLORS.soft },
  sidebarIcon: { width: 25, height: 25, borderRadius: 7, backgroundColor: COLORS.softAlt, alignItems: "center", justifyContent: "center" },
  sidebarIconSelected: { backgroundColor: COLORS.wine },
  sidebarLinkText: { flex: 1, color: COLORS.ink, fontSize: 12, fontWeight: "600" },
  sidebarLinkTextSelected: { color: COLORS.wine, fontWeight: "800" },
  sidebarActiveMark: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.wine },
  sidebarFooter: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingHorizontal: 10, paddingVertical: 8 },
  topBarStart: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuButton: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  menuLines: { width: 15, gap: 3 },
  menuLine: { width: 15, height: 2, borderRadius: 1, backgroundColor: COLORS.ink },
  mobileNavOverlay: { flex: 1, flexDirection: "row" },
  mobileNavScrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(20,18,20,0.42)" },
  mobileNavDrawer: { width: 300, maxWidth: "86%", height: "100%", backgroundColor: COLORS.card, borderRightWidth: 1, borderRightColor: COLORS.line },
  mobileNavHeader: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingHorizontal: 17 },
  mobileNavTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "800" },
  mobileNavSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.paper },
  loadingText: { color: COLORS.muted, marginTop: 12, fontSize: 14 },
  logoMark: { color: COLORS.wine, fontSize: 36, fontWeight: "800" },
  topBar: { height: 54, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: COLORS.line, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: COLORS.card },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.wine, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: COLORS.onAccent, fontSize: 21, fontWeight: "800", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  brandName: { fontSize: 13, letterSpacing: 2.2, fontWeight: "800", color: COLORS.ink },
  brandSub: { fontSize: 8, letterSpacing: 1.5, color: COLORS.muted, marginTop: 2 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  saveState: { color: COLORS.muted, fontSize: 11 },
  mailboxButton: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center", position: "relative" },
  mailCountBadge: { minWidth: 17, height: 17, borderRadius: 9, backgroundColor: COLORS.red, position: "absolute", right: -5, top: -5, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: COLORS.card },
  mailCountText: { color: "#FFFFFF", fontSize: 9, lineHeight: 11, fontWeight: "800", textAlign: "center" },
  addCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.wine, alignItems: "center", justifyContent: "center" },
  searchWrap: { marginHorizontal: 14, marginTop: 7, height: 36, borderRadius: 9, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  searchGlyph: { width: 18, height: 18, marginRight: 8, justifyContent: "center" },
  searchLens: { width: 10, height: 10, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.muted, marginLeft: 1, marginTop: -2 },
  searchHandle: { position: "absolute", width: 6, height: 1.5, borderRadius: 1, backgroundColor: COLORS.muted, left: 10, top: 12, transform: [{ rotate: "45deg" }] },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 14, paddingVertical: 8 },
  searchClear: { color: COLORS.muted, fontSize: 22, paddingHorizontal: 4 },
  screenHeading: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 5, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  screenTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "750", letterSpacing: -0.35 },
  screenSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7, marginLeft: 8 },
  helpButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  headerAdd: { backgroundColor: COLORS.wine, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 },
  headerAddText: { color: COLORS.onAccent, fontSize: 13, fontWeight: "700" },
  mainScroll: { flex: 1 },
  pageContent: { paddingHorizontal: 13, paddingBottom: 12, maxWidth: 1440, width: "100%", alignSelf: "center" },
  pageContentWide: { paddingHorizontal: 16 },
  welcomeBox: { backgroundColor: COLORS.wine, padding: 15, borderRadius: 16, marginBottom: 12, overflow: "hidden" },
  welcomeBoxCompact: { backgroundColor: COLORS.wine, padding: 14, borderRadius: 15, marginBottom: 11 },
  heroOrbOne: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.055)", right: -48, top: 4 },
  heroOrbTwo: { position: "absolute", width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", right: 29, top: 38 },
  heroTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroDate: { color: COLORS.onAccent, fontSize: 10, fontWeight: "700" },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 17, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.09)" },
  heroStat: { flex: 1, alignItems: "center", paddingVertical: 3, borderRadius: 9 },
  heroStatValue: { color: COLORS.onAccent, fontSize: 20, fontWeight: "800" },
  heroStatLabel: { color: COLORS.onAccent, fontSize: 9, marginTop: 2 },
  heroDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  eyebrow: { color: COLORS.onAccent, fontSize: 9, letterSpacing: 1.8, fontWeight: "700" },
  welcomeTitle: { color: COLORS.onAccent, fontSize: 23, fontWeight: "700", lineHeight: 29, marginTop: 9 },
  welcomeText: { color: COLORS.onAccent, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 330 },
  primaryButton: { alignSelf: "flex-start", backgroundColor: COLORS.rose, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginTop: 15 },
  primaryButtonText: { color: COLORS.wineDark, fontWeight: "700", fontSize: 13, textAlign: "center" },
  primaryButtonFull: { backgroundColor: COLORS.wine, borderRadius: 13, padding: 14, marginTop: 16 },
  primaryButtonFullText: { color: COLORS.onAccent, fontWeight: "700", fontSize: 13, textAlign: "center" },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 7, marginBottom: 9 },
  sectionTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "750", marginTop: 6, marginBottom: 5 },
  subtle: { color: COLORS.muted, fontSize: 11 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 6 },
  metricGridCompact: { flexWrap: "nowrap" },
  analyticsPlatformBlock: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  analyticsMiniGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  analyticsMiniMetric: { width: "31%", minHeight: 48, borderRadius: 9, backgroundColor: COLORS.soft, padding: 7 },
  analyticsMiniValue: { color: COLORS.wine, fontSize: 14, fontWeight: "800" },
  analyticsMiniLabel: { color: COLORS.muted, fontSize: 9, marginTop: 2 },
  analyticsHistoryRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingVertical: 9 },
  analyticsInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 5 },
  analyticsInput: { minHeight: 40, width: 150, borderRadius: 10, borderColor: COLORS.line, borderWidth: 1, paddingHorizontal: 9, color: COLORS.ink, backgroundColor: COLORS.card, fontSize: 12, textAlign: "right" },
  analyticsDateRange: { flexDirection: "row", gap: 8 },
  metric: { width: "48%", flexGrow: 1, backgroundColor: COLORS.card, borderRadius: 11, borderWidth: 1, borderColor: COLORS.line, padding: 10, minHeight: 64 },
  metricCompact: { width: 0, flex: 1, minWidth: 0, padding: 8, minHeight: 55 },
  metricLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "600" },
  metricValue: { color: COLORS.ink, fontSize: 19, fontWeight: "700", marginTop: 6 },
  metricSub: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  metricNote: { fontSize: 10, lineHeight: 15, color: COLORS.muted, marginTop: 0, marginBottom: 12, paddingHorizontal: 2 },
  dashboardCashSummary: { backgroundColor: COLORS.soft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  dashboardCashSummaryText: { color: COLORS.muted, fontSize: 10, lineHeight: 17 },
  dashboardCashSummaryValue: { color: COLORS.ink, fontWeight: "800" },
  salesGoalCard: { borderColor: COLORS.softLine, backgroundColor: COLORS.card, elevation: 2, shadowColor: COLORS.wine, shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  salesGoalLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  salesGoalValue: { color: COLORS.wine, fontSize: 27, fontWeight: "800", marginTop: 4 },
  salesIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: COLORS.rose, alignItems: "center", justifyContent: "center" },
  salesIconText: { color: COLORS.wine, fontSize: 21, fontWeight: "800" },
  salesGoalTrack: { height: 9, borderRadius: 6, backgroundColor: COLORS.softAlt, overflow: "hidden", marginTop: 13 },
  salesGoalFill: { height: "100%", borderRadius: 6, backgroundColor: COLORS.wine },
  fulfillmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  fulfillmentTile: { width: "31%", flexGrow: 1, minHeight: 82, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, elevation: 1, shadowColor: COLORS.ink, shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  fulfillmentCount: { color: COLORS.wine, fontSize: 20, fontWeight: "800" },
  fulfillmentLabel: { color: COLORS.muted, fontSize: 10, lineHeight: 13, marginTop: 3 },
  fulfillmentList: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, paddingHorizontal: 13, marginBottom: 12, overflow: "hidden" },
  fulfillmentListRow: { minHeight: 44, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, gap: 11 },
  fulfillmentListRowLast: { borderBottomWidth: 0 },
  fulfillmentListCount: { color: COLORS.wine, fontSize: 16, fontWeight: "800", width: 30, textAlign: "center" },
  fulfillmentListLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "600", flex: 1 },
  fulfillmentListArrow: { color: COLORS.muted, fontSize: 22, paddingHorizontal: 2 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 10, marginBottom: 6 },
  settingsAccordion: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, marginBottom: 7, overflow: "hidden" },
  settingsAccordionHeader: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.card },
  settingsAccordionTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  settingsAccordionSubtitle: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  settingsAccordionChevron: { width: 25, height: 25, borderRadius: 8, borderWidth: 1, borderColor: COLORS.softLine, backgroundColor: COLORS.softAlt, color: COLORS.ink, fontSize: 18, lineHeight: 22, fontWeight: "500", textAlign: "center", overflow: "hidden" },
  settingsAccordionContent: { paddingHorizontal: 11, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  cardTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "700", marginBottom: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  compactOrderCard: { padding: 12 },
  compactComponentCard: { padding: 12, marginBottom: 8 },
  componentCardActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 9 },
  compactCalendarPlanCard: { padding: 11, marginBottom: 7 },
  detailLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingVertical: 9 },
  detailLabel: { flex: 1, color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  detailValue: { flex: 1, color: COLORS.ink, fontSize: 12, fontWeight: "600", textAlign: "right", lineHeight: 17 },
  flex: { flex: 1 },
  recordTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "700", lineHeight: 20 },
  calendarItemHeader: { flexDirection: "column", alignItems: "stretch", gap: 7 },
  calendarItemText: { width: "100%", alignSelf: "stretch", flexShrink: 1 },
  calendarItemPills: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  calendarPlanTitle: { color: COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: "700", flexShrink: 1 },
  recordMeta: { color: COLORS.muted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 5, gap: 8 },
  detailText: { color: COLORS.ink, fontSize: 12, fontWeight: "600" },
  bodyText: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  actionButton: { paddingVertical: 9, paddingHorizontal: 13, backgroundColor: COLORS.card, borderRadius: 11, borderWidth: 1, borderColor: COLORS.softLine },
  actionQuiet: { backgroundColor: COLORS.card, borderColor: COLORS.softLine },
  actionText: { color: COLORS.wine, fontSize: 11, fontWeight: "700" },
  actionButtonText: { color: COLORS.ink, fontSize: 11, fontWeight: "700" },
  pressedState: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  pill: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 20, alignSelf: "flex-start" },
  pillGreen: { backgroundColor: COLORS.sage },
  pillAmber: { backgroundColor: COLORS.amberBg },
  pillRed: { backgroundColor: COLORS.redBg },
  pillNeutral: { backgroundColor: COLORS.softAlt },
  pillText: { fontSize: 9, fontWeight: "700", color: COLORS.ink },
  attentionList: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, marginBottom: 10 },
  soldOutListingRow: { paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  soldOutListingInfo: { gap: 2 },
  soldOutListingActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 7 },
  attentionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomColor: COLORS.line, borderBottomWidth: StyleSheet.hairlineWidth, gap: 9 },
  attentionIcon: { color: COLORS.wine, fontSize: 16, width: 22, textAlign: "center" },
  attentionText: { color: COLORS.ink, fontSize: 12, flex: 1 },
  rowArrow: { color: COLORS.muted, fontSize: 21, paddingHorizontal: 3 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  summaryTile: { width: "48%", flexGrow: 1, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, padding: 13, backgroundColor: COLORS.card },
  summaryNumber: { color: COLORS.wine, fontSize: 22, fontWeight: "700" },
  summaryLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "700", marginTop: 2 },
  summarySub: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  quickAddRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAddButton: { backgroundColor: COLORS.rose, borderColor: COLORS.line, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  quickAddText: { color: COLORS.wineDark, fontSize: 11, fontWeight: "700" },
  infoBanner: { backgroundColor: COLORS.lavender, borderRadius: 15, padding: 14, marginBottom: 12 },
  recordActionNotice: { backgroundColor: COLORS.sage, borderWidth: 1, borderColor: COLORS.green, borderRadius: 12, padding: 12, marginBottom: 10 },
  recordActionNoticeTitle: { color: COLORS.green, fontSize: 12, fontWeight: "800" },
  recordActionNoticeText: { color: COLORS.ink, fontSize: 11, lineHeight: 16, marginTop: 3 },
  recordConfirmOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(26,20,22,0.48)" },
  recordConfirmScrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  recordConfirmCard: { width: "100%", maxWidth: 460, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 20, shadowColor: COLORS.ink, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  recordConfirmEyebrow: { color: COLORS.wine, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  recordConfirmTitle: { color: COLORS.ink, fontSize: 19, lineHeight: 25, fontWeight: "800", marginTop: 7 },
  recordConfirmMessage: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 9 },
  recordConfirmActions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: 20 },
  recordConfirmCancel: { minHeight: 42, justifyContent: "center", paddingHorizontal: 15, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: COLORS.card },
  recordConfirmCancelText: { color: COLORS.ink, fontSize: 12, fontWeight: "700" },
  recordConfirmDestructive: { minHeight: 42, justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.red, borderRadius: 10, backgroundColor: COLORS.redBg },
  recordConfirmDestructiveText: { color: COLORS.red, fontSize: 12, fontWeight: "800" },
  screenDashboardHeader: { padding: 10, marginBottom: 6 },
  screenDashboardTitle: { color: COLORS.ink, fontSize: 17, lineHeight: 21, fontWeight: "800" },
  infoBannerTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  infoBannerText: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  themePickerButton: { minHeight: 62, marginTop: 8, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, flexDirection: "row", alignItems: "center", gap: 10 },
  themePickerOption: { minHeight: 60, padding: 11, marginBottom: 8, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, flexDirection: "row", alignItems: "center", gap: 10 },
  themePickerOptionSelected: { borderColor: COLORS.wine, borderWidth: 2 },
  themePickerSwatches: { flexDirection: "row", gap: 4 },
  themePickerSwatch: { width: 20, height: 30, borderRadius: 5, borderWidth: 1 },
  themePreview: { backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 12, marginTop: 2, marginBottom: 13 },
  themeSwatches: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
  themeSwatchWrap: { width: "17%", alignItems: "center", gap: 4 },
  themeSwatch: { width: "100%", height: 24, borderRadius: 7, borderWidth: 1 },
  themeSwatchLabel: { color: COLORS.muted, fontSize: 9 },
  customColorControl: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingTop: 11, marginTop: 3, marginBottom: 8 },
  customColorTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  customColorSample: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line },
  colorCodeInput: { width: 91, height: 40, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 8, color: COLORS.ink, backgroundColor: COLORS.card, fontSize: 12, fontWeight: "700", textAlign: "center" },
  colorPickerToggle: { alignSelf: "flex-start", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.softLine, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 10, marginTop: 7 },
  colorPickerText: { color: COLORS.ink, fontSize: 11, fontWeight: "700" },
  customSwatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, paddingTop: 10 },
  customSwatch: { width: 30, height: 30, borderRadius: 15 },
  emptyCard: { alignItems: "flex-start", padding: 18, marginTop: 4 },
  emptyIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: COLORS.rose, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyIconText: { color: COLORS.wine, fontSize: 18 },
  emptyTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "700" },
  reviewCard: { padding: 16 },
  reviewStars: { color: COLORS.amber, fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  reviewStarsEmpty: { color: COLORS.softLine },
  reviewQuote: { color: COLORS.ink, fontSize: 14, lineHeight: 21, marginTop: 11 },
  reviewResponse: { backgroundColor: COLORS.soft, borderRadius: 12, padding: 11, marginTop: 10 },
  historyCard: { paddingVertical: 9 },
  channelChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  channelChip: { backgroundColor: COLORS.lavender, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.line },
  channelChipText: { color: COLORS.wineDark, fontSize: 10, fontWeight: "700" },
  taskCard: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkCircle: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.wine, marginTop: 1, alignItems: "center", justifyContent: "center" },
  checkText: { color: COLORS.wine },
  taskDone: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 11 },
  doneMark: { color: COLORS.green, fontSize: 16, fontWeight: "800" },
  doneTitle: { color: COLORS.muted, fontSize: 13, textDecorationLine: "line-through" },
  fieldWrap: { marginBottom: 9 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  fieldLabel: { color: COLORS.ink, fontSize: 11, fontWeight: "700", marginBottom: 4 },
  fieldHelpToggle: { minWidth: 22, height: 22, textAlign: "center", textAlignVertical: "center", color: COLORS.ink, backgroundColor: COLORS.softAlt, borderColor: COLORS.softLine, borderWidth: 1, borderRadius: 11, fontSize: 12, fontWeight: "800", overflow: "hidden" },
  fieldExplanation: { color: COLORS.ink, backgroundColor: COLORS.soft, borderLeftWidth: 3, borderLeftColor: COLORS.wine, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 10, lineHeight: 15, marginBottom: 8 },
  input: { minHeight: 40, borderRadius: 9, borderColor: COLORS.line, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, color: COLORS.ink, backgroundColor: COLORS.card, fontSize: 13 },
  timeInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeTextInput: { flex: 1 },
  timeChooseButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 11, borderColor: COLORS.line, borderWidth: 1, backgroundColor: COLORS.rose, alignItems: "center", justifyContent: "center" },
  timeChooseButtonText: { color: COLORS.wine, fontSize: 12, fontWeight: "700" },
  timePickerCard: { width: "100%", maxWidth: 500, alignSelf: "center", backgroundColor: COLORS.paper, borderTopLeftRadius: 23, borderTopRightRadius: 23, borderRadius: 23, padding: 16, paddingBottom: 25 },
  timeWheelRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  timeWheelColumn: { flex: 1, minWidth: 0 },
  timeWheelLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "700", textAlign: "center", marginBottom: 5 },
  timeWheelScroll: { height: 164, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  timeWheelItem: { minHeight: 34, alignItems: "center", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  timeWheelItemSelected: { backgroundColor: COLORS.rose },
  timeWheelText: { color: COLORS.ink, fontSize: 13 },
  timeWheelTextSelected: { color: COLORS.wine, fontWeight: "800" },
  timePeriodOptions: { gap: 8 },
  timePickerPreview: { color: COLORS.wine, fontSize: 22, fontWeight: "800", textAlign: "center", marginTop: 14 },
  multilineInput: { minHeight: 84, textAlignVertical: "top" },
  inputText: { color: COLORS.ink, fontSize: 14 },
  placeholder: { color: COLORS.placeholder },
  selectBox: { minHeight: 44, borderRadius: 11, borderColor: COLORS.line, borderWidth: 1, paddingHorizontal: 12, backgroundColor: COLORS.card, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectChevron: { color: COLORS.muted, fontSize: 17 },
  optionList: { marginTop: 5, borderRadius: 11, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card, overflow: "hidden" },
  optionItem: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  inlineOptionRow: { minHeight: 42, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingHorizontal: 8, gap: 12 },
  inlineOptionSelect: { flex: 1, paddingVertical: 11 },
  inlineManageText: { color: COLORS.wine, fontSize: 11, fontWeight: "700", paddingVertical: 10 },
  inlineAddOption: { padding: 12, backgroundColor: COLORS.soft },
  inlineEditor: { padding: 10, backgroundColor: COLORS.soft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  optionText: { color: COLORS.ink, fontSize: 13 },
  fieldHint: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  announcementOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  announcementScrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(20,18,20,0.42)" },
  announcementPanel: { width: "100%", maxWidth: 620, maxHeight: "86%", backgroundColor: COLORS.paper, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, overflow: "hidden" },
  announcementHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line, backgroundColor: COLORS.card },
  announcementTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "800" },
  announcementSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  announcementMarkAll: { paddingHorizontal: 8, paddingVertical: 7 },
  announcementMarkAllText: { color: COLORS.wine, fontSize: 11, fontWeight: "800" },
  announcementClose: { paddingHorizontal: 4, paddingVertical: 7 },
  announcementList: { flexShrink: 1 },
  announcementListContent: { padding: 12 },
  announcementMessage: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, padding: 12, marginBottom: 8 },
  announcementUnread: { borderColor: COLORS.wine, backgroundColor: COLORS.soft },
  announcementMessageTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  announcementMessageTitle: { flex: 1, color: COLORS.ink, fontSize: 14, fontWeight: "800" },
  announcementUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.wine },
  announcementDate: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  announcementMessageActions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 3 },
  announcementReadAction: { alignSelf: "flex-start", paddingTop: 8 },
  announcementReadLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "700", marginTop: 8 },
  announcementFootnote: { color: COLORS.muted, fontSize: 10, lineHeight: 14, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: COLORS.card },
  announcementSettingsRow: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  modalSafe: { flex: 1, backgroundColor: COLORS.paper },
  modalHeader: { minHeight: 54, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: COLORS.line },
  modalTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "700" },
  tutorialProgress: { color: COLORS.muted, fontSize: 11, minWidth: 40, textAlign: "right" },
  modalHeaderSpacer: { width: 36 },
  modalCancel: { color: COLORS.muted, fontSize: 14 },
  modalSave: { color: COLORS.wine, fontSize: 14, fontWeight: "700" },
  disabledText: { color: COLORS.placeholder },
  disabledButton: { opacity: 0.6 },
  formContent: { padding: 18, paddingBottom: 40 },
  formHero: { backgroundColor: COLORS.wine, borderRadius: 20, padding: 18, marginBottom: 15, overflow: "hidden" },
  onboardingHero: { minHeight: 162, justifyContent: "center" },
  onboardingPrivacy: { backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.line, borderRadius: 13, padding: 13, marginTop: 2, marginBottom: 8 },
  optionalFeeSetup: { backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.line, borderRadius: 13, padding: 12, marginTop: 8 },
  optionalFeeRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingTop: 10, marginTop: 8 },
  welcomeBackScreen: { flex: 1, backgroundColor: COLORS.paper, justifyContent: "center", padding: 20 },
  welcomeBackCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 24, padding: 22, maxWidth: 560, width: "100%", alignSelf: "center", shadowColor: COLORS.ink, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  welcomeBackMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.wine, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  welcomeBackMarkText: { color: COLORS.onAccent, fontSize: 27, fontWeight: "800", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  welcomeBackTitle: { color: COLORS.ink, fontSize: 26, fontWeight: "800", lineHeight: 32, marginTop: 8, marginBottom: 10 },
  welcomeBackStats: { flexDirection: "row", gap: 8, marginTop: 16 },
  welcomeBackStat: { flex: 1, minHeight: 72, borderRadius: 13, padding: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.line },
  welcomeBackNumber: { color: COLORS.wine, fontSize: 21, fontWeight: "800" },
  welcomeBackLabel: { color: COLORS.muted, fontSize: 9, lineHeight: 13, textAlign: "center", marginTop: 3 },
  formHeroEyebrow: { color: COLORS.onAccent, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  formHeroTitle: { color: COLORS.onAccent, fontSize: 22, lineHeight: 27, fontWeight: "800", marginTop: 6 },
  formHeroText: { color: COLORS.onAccent, fontSize: 12, lineHeight: 18, marginTop: 7 },
  formSection: { backgroundColor: COLORS.card, borderColor: COLORS.line, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 8, shadowColor: COLORS.ink, shadowOpacity: 0.025, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  formSectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  formSectionMark: { width: 4, minHeight: 32, borderRadius: 4, backgroundColor: COLORS.wine, marginTop: 2 },
  formSectionTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "800" },
  formSectionText: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  formFootnote: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 10 },
  errorText: { color: COLORS.red, fontSize: 12, marginTop: 4, marginBottom: 8 },
  recipePreview: { backgroundColor: COLORS.soft, borderRadius: 12, padding: 12, marginTop: 4 },
  orderPayoutEstimate: { color: COLORS.wine, fontSize: 23, fontWeight: "800", marginTop: 2, marginBottom: 3 },
  listingPayoutEstimate: { backgroundColor: COLORS.soft, borderRadius: 11, padding: 11, marginTop: 10 },
  listingPayoutRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  listingPayoutChannel: { color: COLORS.ink, fontSize: 11, fontWeight: "600" },
  listingPayoutValue: { color: COLORS.wine, fontSize: 12, fontWeight: "800" },
  recipeEditor: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 12, marginBottom: 13, backgroundColor: COLORS.card },
  recipeLine: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingTop: 9, marginTop: 9 },
  recipeQuantity: { width: 62, height: 42, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 8, textAlign: "center", color: COLORS.ink, backgroundColor: COLORS.card },
  deleteOptionText: { color: COLORS.red, fontSize: 11, fontWeight: "700", padding: 4 },
  optionManagerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingVertical: 9, gap: 8 },
  optionManagerLabel: { color: COLORS.ink, fontSize: 12, flex: 1 },
  optionManagerActions: { flexDirection: "row", gap: 15 },
  discountPlanList: { marginTop: 10, padding: 11, backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12 },
  discountPlanRow: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingVertical: 10, gap: 10 },
  calendarWorkspace: { flexDirection: "column" },
  calendarWorkspaceWide: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  calendarMain: { width: "100%", minWidth: 0 },
  calendarMainWide: { flex: 1.15, width: 0, maxWidth: 660 },
  calendarAgenda: { width: "100%", minWidth: 0 },
  calendarAgendaWide: { flex: 0.85, width: 0, minWidth: 285, maxWidth: 440 },
  calendarCard: { width: "100%", maxWidth: 620, paddingHorizontal: 10, paddingTop: 10, alignSelf: "center" },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthArrow: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.rose, borderRadius: 9 },
  monthArrowText: { color: COLORS.wine, fontSize: 23, lineHeight: 25 },
  monthTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "700" },
  todayButton: { alignSelf: "flex-end", padding: 4 },
  calendarWeek: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2 },
  weekDay: { width: "14%", textAlign: "center", color: COLORS.muted, fontSize: 10, fontWeight: "700", paddingVertical: 6 },
  calendarCell: { width: "14%", maxWidth: 72, aspectRatio: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  dateInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateTextInput: { flex: 1 },
  dateCalendarButton: { height: 46, width: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.rose, alignItems: "center", justifyContent: "center" },
  dateCalendarButtonText: { color: COLORS.wine, fontSize: 19, fontWeight: "800" },
  datePickerCard: { width: "100%", maxWidth: 430, alignSelf: "center", backgroundColor: COLORS.paper, borderTopLeftRadius: 23, borderTopRightRadius: 23, borderRadius: 23, padding: 16, paddingBottom: 25 },
  datePickerGrid: { flexDirection: "row", flexWrap: "wrap" },
  datePickerOutside: { opacity: 0.45 },
  activityHistoryRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingVertical: 9, marginTop: 5 },
  calendarCellSelected: { backgroundColor: COLORS.rose },
  calendarDay: { color: COLORS.ink, fontSize: 12, fontWeight: "600" },
  calendarDayOutside: { color: COLORS.placeholder },
  calendarDayToday: { color: COLORS.wine, fontWeight: "800" },
  calendarDayPicked: { color: COLORS.wineDark, fontWeight: "800" },
  calendarDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "transparent", marginTop: 3 },
  calendarDotActive: { backgroundColor: COLORS.wine },
  timeDisplay: { color: COLORS.wine, fontSize: 30, fontWeight: "800", marginTop: 9 },
  chartCard: { paddingBottom: 12 },
  chartRow: { minHeight: 132, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", gap: 3, marginTop: 4 },
  chartColumn: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "flex-end" },
  chartValue: { color: COLORS.muted, fontSize: 8, minHeight: 12, textAlign: "center" },
  chartTrack: { height: 94, width: "80%", alignItems: "center", justifyContent: "flex-end", backgroundColor: COLORS.softAlt, borderRadius: 7, overflow: "hidden" },
  chartBar: { width: "72%", backgroundColor: COLORS.wine, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  chartLabel: { color: COLORS.muted, fontSize: 8, marginTop: 5, textAlign: "center" },
  rangeSwitch: { flexDirection: "row", backgroundColor: COLORS.softAlt, borderRadius: 12, padding: 3, marginBottom: 10 },
  rangeButton: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 9 },
  rangeButtonSelected: { backgroundColor: COLORS.wine },
  rangeButtonText: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  rangeButtonTextSelected: { color: COLORS.onAccent },
  planningPeriodNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  planningPeriodText: { color: COLORS.ink, fontSize: 12, fontWeight: "700" },
  bottomNav: { height: 0, display: "none" },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  navCenterItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1, overflow: "visible" },
  navCenterButton: { width: 44, height: 44, borderRadius: 22, marginTop: -18, borderWidth: 3, borderColor: COLORS.card, backgroundColor: COLORS.wine, alignItems: "center", justifyContent: "center", elevation: 5 },
  navCenterButtonActive: { backgroundColor: COLORS.wineDark },
  navCenterIcon: { color: COLORS.onAccent, fontSize: 20, fontWeight: "800" },
  navIcon: { color: COLORS.muted, fontSize: 19, lineHeight: 23 },
  navActive: { color: COLORS.wine, fontWeight: "800" },
  navLabel: { color: COLORS.muted, fontSize: 8 },
  navLabelActive: { color: COLORS.wine, fontWeight: "700" },
  bottomNote: { paddingVertical: 9, alignItems: "center" },
  bottomNoteText: { color: COLORS.muted, fontSize: 9, letterSpacing: 0.3 },
  profitCard: { backgroundColor: COLORS.wine, borderColor: COLORS.wine, marginTop: 5 },
  profitLabel: { color: COLORS.onAccent, fontSize: 11, fontWeight: "600" },
  profitValue: { color: COLORS.onAccent, fontSize: 29, fontWeight: "800", marginTop: 5 },
  profitFootnote: { color: COLORS.onAccent, fontSize: 10, lineHeight: 15, marginTop: 8 },
  financeIntro: { backgroundColor: COLORS.soft, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginBottom: 12 },
  financeEyebrow: { color: COLORS.wine, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  financeHeading: { color: COLORS.ink, fontSize: 22, lineHeight: 27, fontWeight: "800", marginTop: 5 },
  financeIntroText: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  financeSummaryCard: { backgroundColor: COLORS.wine, borderColor: COLORS.wine, padding: 17 },
  financeSummaryValue: { color: COLORS.onAccent, fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 5 },
  financeSummaryCaption: { color: COLORS.onAccent, opacity: 0.88, fontSize: 11, lineHeight: 16, marginTop: 4 },
  financeSummaryDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.22)", marginVertical: 13 },
  financeCashRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  financeCashLabel: { color: COLORS.onAccent, fontSize: 12, fontWeight: "700" },
  financeCashHint: { color: COLORS.onAccent, opacity: 0.8, fontSize: 10, marginTop: 3 },
  financeCashValue: { color: COLORS.onAccent, fontSize: 17, fontWeight: "800" },
  financeBreakdownCard: { marginTop: 2 },
  financeBreakdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  financeBreakdownLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "600" },
  financeBreakdownHint: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  financeBreakdownValue: { color: COLORS.ink, fontSize: 12, fontWeight: "700", textAlign: "right" },
  expenseAmount: { color: COLORS.red, fontWeight: "700", fontSize: 13 },
  ideaLane: { padding: 0, overflow: "hidden" },
  ideaLaneHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 10, gap: 12 },
  ideaLaneTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "800" },
  ideaLaneChevron: { color: COLORS.wine, fontSize: 22, fontWeight: "600", paddingHorizontal: 6 },
  ideaLaneEmpty: { marginHorizontal: 10, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.softLine, alignItems: "center", gap: 6 },
  ideaLaneEmptyText: { color: COLORS.ink, fontSize: 13, fontWeight: "700", textAlign: "center" },
  ideaLaneEmptyHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: "center", marginBottom: 4 },
  ideaNote: { padding: 12, marginHorizontal: 10, marginBottom: 10, borderRadius: 13, backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.line },
  moreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  moreTile: { width: "48%", flexGrow: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, padding: 10, minHeight: 76 },
  moreTileWide: { width: "31%" },
  moreIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  moreTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  moreSub: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  helpHero: { backgroundColor: COLORS.wine, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  helpEyebrow: { color: COLORS.onAccent, opacity: 0.84, fontSize: 9, letterSpacing: 1.2, fontWeight: "800" },
  helpHeroTitle: { color: COLORS.onAccent, fontSize: 20, fontWeight: "800", marginTop: 4 },
  helpHeroText: { color: COLORS.onAccent, opacity: 0.9, fontSize: 11, lineHeight: 16, marginTop: 4 },
  helpSearch: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  helpSearchLabel: { color: COLORS.ink, fontSize: 11, fontWeight: "700", marginBottom: 5 },
  helpLinkWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 5 },
  helpLink: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, paddingHorizontal: 10 },
  helpLinkLabel: { color: COLORS.wine, fontSize: 10, fontWeight: "700" },
  helpLinkArrow: { color: COLORS.muted, fontSize: 17, lineHeight: 20 },
  helpSectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  helpQuestion: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 5 },
  helpQuestionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  helpQuestionText: { flex: 1, color: COLORS.ink, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  helpQuestionMark: { color: COLORS.wine, fontSize: 18, lineHeight: 20, fontWeight: "600" },
  helpGuide: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 5 },
  helpGuideTitle: { color: COLORS.ink, fontSize: 11, fontWeight: "800" },
  helpGuideSummary: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  quickNoteCard: { marginTop: 14 },
  helpCard: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 19, margin: 20 },
  helpExample: { backgroundColor: COLORS.soft, borderColor: COLORS.line, borderWidth: 1, borderRadius: 13, padding: 12, marginTop: 12, marginBottom: 12 },
  tutorialDots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 4 },
  tutorialDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.softLine },
  tutorialDotSelected: { width: 20, backgroundColor: COLORS.wine },
  outlineButton: { backgroundColor: COLORS.rose, borderRadius: 11, borderWidth: 1, borderColor: COLORS.wine, padding: 11, marginTop: 13, alignItems: "center" },
  outlineButtonText: { color: COLORS.wine, fontSize: 12, fontWeight: "700" },
  backupContent: { padding: 18, paddingBottom: 24 },
  backupFooter: { flexShrink: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: COLORS.card, zIndex: 5, elevation: 4 },
  backupPrimaryButton: { minHeight: 50, justifyContent: "center", marginTop: 0, zIndex: 6, elevation: 2 },
  backupFeedback: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, backgroundColor: COLORS.soft, padding: 11, marginTop: 11 },
  backupFeedbackError: { borderColor: COLORS.red, backgroundColor: COLORS.rose },
  backupFeedbackSuccess: { borderColor: COLORS.green, backgroundColor: COLORS.soft },
  backupFeedbackInfo: { borderColor: COLORS.wine, backgroundColor: COLORS.soft },
  backupFeedbackText: { color: COLORS.ink, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  backupReview: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, backgroundColor: COLORS.card, padding: 12, marginTop: 11 },
  backupInput: { minHeight: 300, maxHeight: 480, backgroundColor: COLORS.card, borderColor: COLORS.line, borderWidth: 1, borderRadius: 12, marginTop: 12, padding: 12, textAlignVertical: "top", color: COLORS.ink, fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  chooserBackdrop: { flex: 1, backgroundColor: "rgba(38,32,31,0.42)", justifyContent: "flex-end" },
  chooserCard: { backgroundColor: COLORS.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 30 },
  chooserGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 6 },
  chooserOption: { width: "31%", flexGrow: 1, minHeight: 64, borderRadius: 12, backgroundColor: COLORS.card, borderColor: COLORS.line, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 7 },
  chooserIcon: { width: 27, height: 27, borderRadius: 8, overflow: "hidden", backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  chooserLabel: { color: COLORS.ink, fontSize: 10, fontWeight: "700", marginTop: 4 },
}); }
/* eslint-enable react-native/no-unused-styles */
let styles = makeStyles();
