// app/(tabs)/xaze.tsx
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { createClient } from "@supabase/supabase-js";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";



/**
 * IMPORTANT:
 * You supplied these credentials earlier. If you don't want them in code,
 * move them to environment variables and load with expo-constants or similar.
 */
const SUPABASE_URL = "https://xetomtmbtiqwfisynrrl.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldG9tdG1idGlxd2Zpc3lucnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDg5NDMsImV4cCI6MjA3MjkyNDk0M30.eJNpLnTwzLyCIEVjwSzh3K1N4Y0mA9HV914pY6q3nRo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_MARGIN = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - CARD_MARGIN * 3) / 2);

const PLACEHOLDER_IMAGE = "https://placehold.co/600x600/E0E0E0/333333?text=No+Image";

/**
 * XazeChat
 * - Top header + ribbon
 * - Product grid (two-column)
 * - Product details overlay
 * - Chat docked at bottom with messages appearing above it when expanded
 *
 * Design decisions:
 * - Product card has overlay elements for rating/try-on (optimized for tap)
 * - Price emphasized (primary color) and, if available, shows strikethrough original price + discount label
 * - Chat input is fixed at bottom to match the 'docked chat' UX in your reference
 */
export default function XazeChat() {
  const router = useRouter();
  const { query } = useLocalSearchParams(); // from route params (your existing flow)

  // ----- Local state (keep existing state structure) -----
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchedProducts, setSearchedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [chatOpen, setChatOpen] = useState(true); // chat panel open/closed
  const scrollRef = useRef(null);

  // Keep scroll pinned to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      try {
        scrollRef.current.scrollToEnd({ animated: true });
      } catch (e) {
        /* ignore if not ready */
      }
    }
  }, [messages]);

  // if the page got a 'query' param prefilled, feed it to chat
  useEffect(() => {
    if (query) {
      const id = Math.random().toString(36).slice(2, 9);
      setMessages((p) => [...p, { id, text: String(query), user: { id: 1 } }]);
      // trigger search + ai flow for initial query
      void handleSearchAndGemini(String(query));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ----- Supabase search + Gemini AI -----
  // useCallback so references are stable for useEffect/useCallback deps
  const handleSearchAndGemini = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      // Supabase search: case-insensitive like
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .ilike("name", `%${searchQuery}%`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase search error:", error);
        setSearchedProducts([]);
      } else {
        setSearchedProducts(data || []);
      }

      // Build prompt for Gemini — keep existing approach but make it safe
      const promptText =
        data && data.length > 0
          ? `I am looking for products like "${data[0].name}". Answer in a concise paragraph with styling recommendations and pairing ideas.`
          : `Provide fashion advice and recommendations for "${searchQuery}". Respond only to fashion-related queries.`;

      // NOTE: keep API key management secure in production
      const apiKey = "AIzaSyCA6DjyXomC-P_cRNvgaxYVeAFqBaZg5Hk"; // optional: move to env
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      const geminiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      });

      if (!geminiResponse.ok) {
        console.warn("Gemini API returned non-OK:", geminiResponse.status);
        // still continue — we already have product results
      } else {
        const geminiData = await geminiResponse.json();
        const aiReply =
          geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Sorry, I didn't understand that. Please try again.";

        // append AI reply to chat messages
        setMessages((p) => [
          ...p,
          { id: Math.random().toString(36).slice(2, 9), text: aiReply, user: { id: 2, name: "Alle" } },
        ]);
      }
    } catch (err) {
      console.error("Search/Gemini error:", err);
      setMessages((p) => [
        ...p,
        { id: Math.random().toString(36).slice(2, 9), text: "⚠️ Network or API error, please try again.", user: { id: 2, name: "Alle" } },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);


  const handleTryOn = (product) => {
  if (!product?.image_url1) return;

  // navigate to a TryOn page and pass product image
  router.push({
    pathname: "/tryon",
    params: {
      productImage: product.image_url1,
      productId: product.id,
    },
  });
};


  // send message from bottom input (keeps same flow as original)
  const onSend = useCallback(async () => {
    if (!inputMessage.trim()) return;
    const msg = { id: Math.random().toString(36).slice(2, 9), text: inputMessage.trim(), user: { id: 1 } };
    setMessages((p) => [...p, msg]);
    setInputMessage("");
    // call search + AI
    await handleSearchAndGemini(msg.text);
  }, [inputMessage, handleSearchAndGemini]);

  // ----- UI child components for clarity -----
  const Header = ({ title }: { title?: string }) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
        <AntDesign name="arrowleft" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={{ flex: 1, paddingHorizontal: 8 }}>
        <Text numberOfLines={1} style={styles.pageTitle}>
          {title || "Search"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity style={styles.iconBtn}>
          <Feather name="bell" size={20} color="#374151" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="share-outline" size={20} color="#374151" />
        </TouchableOpacity>
      </View>
    </View>
  );


  /**
   * ProductCard: memoized for performance
   * Shows image, overlay heart (wishlist), rating badge, try-on overlay
   * Price block sits under image for emphasis (see reference)
   */
  const ProductCard = React.memo(({ item }: { item: any }) => {
    const mrp = item.mrp || item.original_price || null;
    const price = item.price ?? item.sale_price ?? "0";

    // compute discount if mrp given
    const discount =
      mrp && parseFloat(String(mrp)) > 0 ? Math.round((1 - parseFloat(String(price)) / parseFloat(String(mrp))) * 100) : null;

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedProduct(item)}>
        {/* top-right heart */}
        <TouchableOpacity style={styles.heartBtn}>
          <AntDesign name="hearto" size={18} color="#fff" />
        </TouchableOpacity>

        {/* main image */}
        <Image source={{ uri: item.image_url1 || PLACEHOLDER_IMAGE }} style={styles.cardImage} />

        {/* overlay rating (bottom-left over image) */}
        <View style={styles.ratingBadge}>
          <AntDesign name="star" size={12} color="#FFD700" />
          <Text style={styles.ratingText}>{item.rating ?? "4.5"}</Text>
        </View>

        {/* Try-On button overlay (bottom-right) */}
       <TouchableOpacity
          style={styles.tryOnBtn}
          onPress={() => handleTryOn(item)}
        >
          <Feather name="layers" size={14} color="#111827" />
          <Text style={styles.tryOnText}>Try-On</Text>
        </TouchableOpacity>


        {/* Price & title area */}
        <View style={styles.cardFooter}>
          <Text style={styles.pricePrimary}>₹{price}</Text>
          {mrp ? (
            <View style={styles.row}>
              <Text style={styles.mrp}>₹{mrp}</Text>
              {discount !== null && <Text style={styles.discount}>{discount}% OFF</Text>}
            </View>
          ) : null}
          <Text style={styles.titleSmall} numberOfLines={2}>
            {item.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  });

  ProductCard.displayName = "ProductCard";

  // Memoize data for FlatList
  const listData = useMemo(() => searchedProducts || [], [searchedProducts]);

  // detail overlay rendering (simple full-screen modal inside same component)
  const ProductDetails = ({ product, onBack }) => {
  if (!product) return null;

  const [currentIndex, setCurrentIndex] = useState(0);

  // gather all product images dynamically
  const images = [];
  for (let i = 1; i <= 6; i++) {
    const u = product[`image_url${i}`];
    if (u) images.push(u);
  }

  // track visible index when scrolling
  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  return (
    <View style={styles.detailsOverlay}>
      {/* header */}
      <View style={styles.detailsHeader}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <AntDesign name="arrowleft" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.detailsTitle} numberOfLines={1}>
          {product.name}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {images.length > 0 ? (
          <FlatList
            horizontal
            pagingEnabled
            data={images}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.detailsImage} />
            )}
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewRef.current}
            viewabilityConfig={viewConfigRef.current}
          />
        ) : (
          <Image source={{ uri: PLACEHOLDER_IMAGE }} style={styles.detailsImage} />
        )}

        {/* ✅ Try-On button for current image */}
        <TouchableOpacity
          style={styles.detailsTryOnBtn}
          onPress={() =>
            router.push({
              pathname: "/tryon",
              params: {
                productImage: images[currentIndex], // <-- currently viewed image
                productId: product.id,
              },
            })
          }
        >
          <Feather name="layers" size={16} color="#fff" />
          <Text style={styles.detailsTryOnText}>Try On</Text>
        </TouchableOpacity>

        <View style={styles.detailsContent}>
          <Text style={styles.detailsName}>{product.name}</Text>
          <Text style={styles.detailsPrice}>₹{product.price}</Text>
          {product.brand && <Text style={styles.detailsMeta}>Brand: {product.brand}</Text>}
          {product.category && <Text style={styles.detailsMeta}>Category: {product.category}</Text>}
          {product.description && <Text style={styles.detailsDesc}>{product.description}</Text>}
          <TouchableOpacity style={styles.addToCartBtn} onPress={() => handleBuy(product.link)}>
            <Text style={styles.addToCartText}>Buy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};


  // handle opening external link for buy; keep portability
  const handleBuy = async (link) => {
    if (!link) return;
    try {
      await Linking.openURL(link);
    } catch (err) {
      console.error("Failed to open link:", err);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* HEADER + Ribbon */}
      <Header title={String(query || "Xaze")} />
   
      {/* Loading / Product Grid */}
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <FlatList
            data={listData}
            renderItem={({ item }) => <ProductCard item={item} />}
            keyExtractor={(i) => String(i.id)}
            numColumns={2}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={8}
          />
        )}
      </View>

      {/* Product details overlay (full-screen) */}
      {selectedProduct ? <ProductDetails product={selectedProduct} onBack={() => setSelectedProduct(null)} /> : null}

      {/* Chat dock (persisted at bottom). Input is fixed at bottom for easy access */}
        <View style={styles.chatDock}>
  {/* optionally expand/collapse the messages area */}
        <TouchableOpacity
          style={styles.chatDockHandleRow}
          onPress={() => setChatOpen((s) => !s)}
          activeOpacity={0.8}
        >
          <Text style={styles.chatDockTitle}>Chat with Xaze</Text>
          <AntDesign name={chatOpen ? "down" : "up"} size={18} color="#111827" />
        </TouchableOpacity>
      

        {chatOpen ? (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.messagesScroll}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((m) => (
                <View key={m.id} style={[styles.msgWrap, m.user?.id === 1 ? styles.msgUser : styles.msgAlle]}>
                  <Text style={styles.msgText}>{m.text}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TouchableOpacity style={styles.attachBtn}>
                <Feather name="image" size={18} color="#6b7280" />
              </TouchableOpacity>

              <TextInput
                placeholder="Ask follow up..."
                placeholderTextColor="#9CA3AF"
                value={inputMessage}
                onChangeText={setInputMessage}
                style={styles.chatInput}
                returnKeyType="send"
                onSubmitEditing={onSend}
                editable={!isLoading}
              />

              <TouchableOpacity onPress={onSend} style={[styles.sendBtn, (!inputMessage.trim() || isLoading) && styles.disabledBtn]}>
                <AntDesign name="arrowup" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
        <TouchableOpacity
          style={styles.chatCollapsed}
          onPress={() => setChatOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.chatCollapsedText}>Tap to open chat</Text>
        </TouchableOpacity>
      )}
      
          
      </View>
    </KeyboardAvoidingView>
  );
}

/* ===========================
   Styles
   =========================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  /* Header */
  header: {
    backgroundColor: "#fff",
    borderBottomColor: "#E5E7EB",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 40,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: { padding: 8 },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  filterChipText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 14,
  },

  /* Grid */
  grid: {
    paddingHorizontal: CARD_MARGIN,
    paddingBottom: 130, // leave space for chat dock
  },
  card: {
    width: CARD_WIDTH,
    marginLeft: CARD_MARGIN,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
  },
  cardImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#eee",
  },

  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 6,
    borderRadius: 20,
  },

  ratingBadge: {
    position: "absolute",
    left: 8,
    bottom: 70,
    zIndex: 3,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingText: { marginLeft: 6, fontSize: 12, color: "#111827", fontWeight: "600" },

  tryOnBtn: {
    position: "absolute",
    right: 8,
    bottom: 62,
    zIndex: 3,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  tryOnText: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#111827" },

  cardFooter: { padding: 10, paddingTop: 12 },
  pricePrimary: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center" },
  mrp: { textDecorationLine: "line-through", marginRight: 8, color: "#6b7280" },
  discount: { color: "#16a34a", fontWeight: "700" },
  titleSmall: { color: "#374151", marginTop: 6, fontSize: 13 },

  /* loader */
  loaderWrap: { padding: 20, alignItems: "center", justifyContent: "center" },

  /* Product details */
  detailsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    zIndex: 2000,
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
  },
  detailsTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#111827", marginLeft: 8 },
  detailsImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.9, resizeMode: "cover" },
  detailsContent: { padding: 16 },
  detailsName: { fontSize: 22, fontWeight: "800", color: "#111827" },
  detailsPrice: { fontSize: 18, fontWeight: "700", color: "#4F46E5", marginTop: 8 },
  detailsMeta: { color: "#6B7280", marginTop: 6 },
  detailsDesc: { marginTop: 12, color: "#374151", lineHeight: 22 },
  addToCartBtn: {
    marginTop: 20,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  addToCartText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  /* ======================
     Chat dock
     ====================== */
  chatDock: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    padding: 10,
    zIndex: 3000,
    // cap height to allow messages to be visible above input
    maxHeight: Platform.OS === "ios" ? 360 : 330,
  },
  chatDockHandleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chatDockTitle: { fontWeight: "700", color: "#111827", fontSize: 16 },
  messagesScroll: { maxHeight: 200, marginBottom: 6 },
  msgWrap: { padding: 10, marginVertical: 6, borderRadius: 12, maxWidth: "80%" },
  msgUser: { alignSelf: "flex-end", backgroundColor: "#E0E7FF" },
  msgAlle: { alignSelf: "flex-start", backgroundColor: "#F9FAFB" },
  msgText: { color: "#111827" },

  chatInputRow: { flexDirection: "row", alignItems: "center" },
  attachBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 10,
  },
  chatInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    color: "#111827",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4F46E5",
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledBtn: { backgroundColor: "#D1D5DB" },

  chatCollapsed: {
    width: "100%",
    height: 20,            
    backgroundColor: "#ffffff",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  
  chatCollapsedText: {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: "500",
},
});
