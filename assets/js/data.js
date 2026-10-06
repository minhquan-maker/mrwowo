/*
 * mrwowo — sample data.
 *
 * Every figure in this file is SAMPLE / ESTIMATED data for Phase 0 interviews.
 * Brands, the distributor and the approvers are fictional.
 *
 * Text that users see is bilingual: { en, vi }. Pick with i18n.L(value).
 * Runs in the browser (window.Mrwowo.data) and in Node (module.exports) for tests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Mrwowo = root.Mrwowo || {}).data = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OWNER = {
    name: { en: 'Minh Phat Distribution Co., Ltd.', vi: 'Công ty TNHH Phân phối Minh Phát' },
    short: { en: 'Minh Phat Distribution', vi: 'NPP Minh Phát' },
    initials: 'MP'
  };

  /* Operators — used for the decision log. */
  var PERSONAS = [
    { id: 'ha', name: 'Nguyễn Thu Hà', role: { en: 'Head of Trade Marketing', vi: 'Trưởng phòng Trade Marketing' }, canApprove: true, initials: 'TH' },
    { id: 'duc', name: 'Trần Minh Đức', role: { en: 'Head of Supply Chain', vi: 'Trưởng phòng Supply Chain' }, canApprove: true, initials: 'MĐ' },
    { id: 'anh', name: 'Lê Phương Anh', role: { en: 'Chief Accountant (view & export)', vi: 'Kế toán trưởng (chỉ xem & xuất)' }, canApprove: false, initials: 'PA' }
  ];

  /* Storage types. The demo only carries dry goods; chilled is configurable; fresh is refused. */
  var STORAGE = {
    kho: { label: { en: 'Dry packaged goods', vi: 'Hàng khô đóng gói' }, accepted: true, inDemo: true },
    lanh: { label: { en: 'Chilled goods', vi: 'Hàng lạnh' }, accepted: true, inDemo: false },
    tuoi: { label: { en: 'Fresh goods', vi: 'Hàng tươi' }, accepted: false, inDemo: false }
  };

  /* co2PerUnit — kg CO2e per unit, an ASSUMED factor (always labelled "estimate"). */
  var CATEGORIES = {
    snack: { label: { en: 'Snacks', vi: 'Đồ ăn vặt' }, co2PerUnit: 0.35 },
    drink: { label: { en: 'Packaged drinks', vi: 'Đồ uống đóng gói' }, co2PerUnit: 0.6 },
    personal: { label: { en: 'Personal care', vi: 'Hóa mỹ phẩm' }, co2PerUnit: 0.8 },
    home: { label: { en: 'Household', vi: 'Gia dụng' }, co2PerUnit: 1.1 }
  };

  var WAREHOUSES = {
    BD: { label: { en: 'Binh Duong DC', vi: 'Kho Bình Dương' }, region: 'hcm' },
    HN: { label: { en: 'Long Bien DC, Hanoi', vi: 'Kho Long Biên, Hà Nội' }, region: 'hn' },
    DN: { label: { en: 'Lien Chieu DC, Da Nang', vi: 'Kho Liên Chiểu, Đà Nẵng' }, region: 'dn' }
  };

  var REGIONS = [
    { id: 'hcm', label: { en: 'Ho Chi Minh City', vi: 'TP. Hồ Chí Minh' } },
    { id: 'hn', label: { en: 'Hanoi', vi: 'Hà Nội' } },
    { id: 'dn', label: { en: 'Da Nang', vi: 'Đà Nẵng' } },
    { id: 'mt', label: { en: 'Mekong Delta', vi: 'Miền Tây' } },
    { id: 'mb', label: { en: 'Northern provinces', vi: 'Các tỉnh phía Bắc' } }
  ];

  /*
   * Channels are only "doors": every order is written back to one lot record.
   *   reach        — sell-through multiplier vs. the lot's base demand
   *   feePct       — channel fee / commission on revenue
   *   shipPerUnit  — VND per unit (× the lot's bulk factor)
   *   extraCutPct  — channel-specific extra discount (still clamped by floor & cap)
   */
  var CHANNELS = [
    {
      id: 'minimart', kind: 'sale', reach: 1.0, feePct: 15, shipPerUnit: 600, extraCutPct: 0,
      regions: ['hcm', 'mt'], color: '#15803D', icon: 'store',
      label: { en: 'Mini-mart chain', vi: 'Chuỗi mini-mart' },
      note: { en: '38 convenience stores (sample), "short-dated, documented" shelf', vi: '38 cửa hàng tiện lợi (mẫu), kệ "cận date có hồ sơ"' }
    },
    {
      id: 'zalo', kind: 'sale', reach: 0.6, feePct: 5, shipPerUnit: 1200, extraCutPct: 5,
      regions: ['hn', 'dn'], color: '#2563EB', icon: 'users',
      label: { en: 'Zalo group-buy', vi: 'Nhóm mua chung Zalo' },
      note: { en: '12 group leaders, ~4,800 members (sample); extra 5% off for group orders', vi: '12 trưởng nhóm, ~4.800 thành viên (mẫu); giảm thêm 5% cho đơn nhóm' }
    },
    {
      id: 'partner', kind: 'sale', reach: 1.4, feePct: 12, shipPerUnit: 900, extraCutPct: 0,
      regions: ['hcm', 'hn', 'dn', 'mt', 'mb'], color: '#C2410C', icon: 'phone',
      label: { en: 'Partner app (illustrative)', vi: 'App đối tác (minh họa)' },
      note: { en: 'Illustrative channel for a partner app — no actual partnership', vi: 'Kênh minh họa cho một ứng dụng đối tác — chưa có hợp tác thực tế' }
    },
    {
      id: 'charity', kind: 'donate', reach: 0, feePct: 0, shipPerUnit: 300, extraCutPct: 0,
      regions: ['hcm', 'hn', 'dn', 'mt', 'mb'], color: '#7C6FD0', icon: 'heart',
      label: { en: 'Charity partner', vi: 'Tổ chức từ thiện' },
      note: { en: 'Food bank (sample) — accepts stock above a minimum shelf life, with a handover record', vi: 'Ngân hàng thực phẩm (mẫu) — nhận hàng còn đủ hạn, có biên bản' }
    }
  ];

  /* Lot actions. kind "sell" = sold through channels on the price ladder. */
  var ACTIONS = {
    theo_doi: { kind: 'sell', icon: 'eye', boost: 1, label: { en: 'Hold price & monitor', vi: 'Giữ giá, theo dõi' } },
    ban_kenh: { kind: 'sell', icon: 'share', boost: 1, label: { en: 'Sell via channels', vi: 'Bán qua kênh' } },
    giam_gia: { kind: 'sell', icon: 'tag', boost: 1, label: { en: 'Step markdown', vi: 'Giảm giá theo bậc' } },
    bundle: { kind: 'sell', icon: 'gift', boost: 1.35, extraHandling: 1000, label: { en: 'Bundle', vi: 'Bán kèm (bundle)' } },
    chuyen_kho: { kind: 'sell', icon: 'truck', boost: 1, label: { en: 'Transfer stock', vi: 'Chuyển kho' } },
    tra_ncc: { kind: 'return', icon: 'undo', label: { en: 'Return to supplier', vi: 'Trả nhà cung cấp' } },
    quyen_gop: { kind: 'donate', icon: 'heart', label: { en: 'Donate', vi: 'Quyên góp' } },
    huy: { kind: 'destroy', icon: 'file', label: { en: 'Documented disposal', vi: 'Hủy có hồ sơ' } }
  };

  /* The owner's current practice — the comparison baseline. */
  var PRACTICES = {
    thanh_ly: { label: { en: 'Bulk liquidation to jobbers', vi: 'Xả hàng cho đầu nậu' } },
    huy: { label: { en: 'End-of-period disposal', vi: 'Hủy cuối kỳ' } }
  };

  /*
   * Price steps by days left — adapted from ladder()/priceAt() in the old prototype
   * (index_1.html): 500 VND rounding, clamped at the floor. Adds a "hold price" step
   * above 90 days. Steps below 30 days only matter for chilled goods.
   */
  var DEFAULT_LADDER = [
    { minDays: 91, cut: 0 },
    { minDays: 61, cut: 20 },
    { minDays: 46, cut: 30 },
    { minDays: 31, cut: 40 },
    { minDays: 15, cut: 50 },
    { minDays: 7, cut: 60 },
    { minDays: 0, cut: 65 }
  ];

  var DEFAULT_RULES = {
    floorPct: 60,              // price floor, % of list price
    maxDiscountPct: 50,        // discount cap set by the owner
    perBuyerCap: 6,            // units per buyer per order
    showBrand: true,           // default brand visibility
    brandByChannel: { zalo: false }, // per-channel override: false = hidden
    excludedRegions: [],
    safetyDays: { kho: 30, lanh: 7 }, // safety line: pulled from every sales channel
    donationMinDays: 21,       // charity accepts stock with ≥ N days left
    handlingPerUnit: 500,      // seal check, lot sticker, expiry photo
    destroyCostPerUnit: 2500,  // supervised disposal + record (× bulk)
    liquidationPct: 22,        // jobbers pay ~22% of list price (baseline)
    returnShipPerUnit: 800,    // freight back to supplier (× bulk)
    ladder: DEFAULT_LADDER
  };

  /*
   * 15 dry, sealed lots.
   *   daysLeft — days to expiry as of the demo's "today"; the expiry date is derived on load
   *   demand   — units/day at list price on a reference channel (estimate)
   *   bulk     — size factor for freight/disposal (1 = small pack, 4 = case)
   */
  var LOTS = [
    {
      id: 'L01', sku: 'GV-SNK-RB54', brand: 'Giòn Vui', cat: 'snack', storage: 'kho', lotNo: 'GV2604-15A',
      qty: 2400, base: 12000, daysLeft: 52, warehouse: 'BD', demand: 13, bulk: 0.5, practice: 'thanh_ly',
      bundleWith: 'L03', charityOk: true, sealed: true,
      name: { en: 'Seaweed potato chips 54g', vi: 'Snack khoai tây vị rong biển 54g' },
      unit: { en: 'packs', vi: 'gói' },
      story: { en: 'Extra stock ordered for the festival season; the season is over.', vi: 'Nhập thêm cho mùa lễ hội, lễ qua còn tồn.' }
    },
    {
      id: 'L02', sku: 'BB-BIS-454', brand: 'Bếp Bơ', cat: 'snack', storage: 'kho', lotNo: 'BB2512-02',
      qty: 640, base: 115000, daysLeft: 74, warehouse: 'HN', demand: 3, bulk: 2, practice: 'thanh_ly',
      charityOk: true, sealed: true,
      name: { en: 'Butter cookies, 454g tin', vi: 'Bánh quy bơ hộp thiếc 454g' },
      unit: { en: 'tins', vi: 'hộp' },
      story: { en: 'Year-end gift stock, over-ordered by 20%.', vi: 'Hàng biếu dịp cuối năm, đơn đặt dư 20%.' }
    },
    {
      id: 'L03', sku: 'BP-NTL-250', brand: 'Bứt Phá', cat: 'drink', storage: 'kho', lotNo: 'BP2603-27',
      qty: 380, base: 216000, daysLeft: 38, warehouse: 'BD', demand: 5, bulk: 4, practice: 'thanh_ly',
      charityOk: false, sealed: true,
      name: { en: 'Energy drink 250ml (case of 24)', vi: 'Nước tăng lực lon 250ml (thùng 24)' },
      unit: { en: 'cases', vi: 'thùng' },
      story: { en: 'Summer promotion over-ordered and never cleared.', vi: 'Chương trình hè đặt quá tay, chưa xả hết.' }
    },
    {
      id: 'L04', sku: 'LM-TXC-455', brand: 'Lá Mát', cat: 'drink', storage: 'kho', lotNo: 'LM2603-08',
      qty: 520, base: 192000, daysLeft: 29, warehouse: 'DN', demand: 4, bulk: 4, practice: 'huy',
      supplierReturn: { pct: 60, minDaysLeft: 20, partner: { en: 'Lá Mát factory (sample)', vi: 'Nhà máy Lá Mát (mẫu)' } },
      charityOk: true, sealed: true,
      name: { en: 'Lemon green tea 455ml (case of 24)', vi: 'Trà xanh chanh chai 455ml (thùng 24)' },
      unit: { en: 'cases', vi: 'thùng' },
      story: { en: 'Just crossed the safety line; the contract allows return to the factory until 20 days.', vi: 'Vừa chạm đường an toàn; hợp đồng cho phép trả nhà máy trước 20 ngày.' }
    },
    {
      id: 'L05', sku: 'SS-CF3-20', brand: 'Sương Sớm', cat: 'drink', storage: 'kho', lotNo: 'SS2606-11',
      qty: 900, base: 58000, daysLeft: 96, warehouse: 'BD', demand: 3, bulk: 1, practice: 'thanh_ly',
      transfer: { to: 'HN', costPerUnit: 1800, transitDays: 4, demandFactor: 2.2,
        reason: { en: 'the North is entering winter; Hanoi sells ~2.2× faster', vi: 'miền Bắc vào mùa lạnh, Hà Nội bán nhanh ~2,2 lần' } },
      charityOk: true, sealed: true,
      name: { en: '3-in-1 instant coffee, box of 20', vi: 'Cà phê hòa tan 3in1 hộp 20 gói' },
      unit: { en: 'boxes', vi: 'hộp' },
      story: { en: 'Slow in the South after the last promotion.', vi: 'Kho miền Nam bán chậm sau đợt khuyến mãi.' }
    },
    {
      id: 'L06', sku: 'BN-MLY-65', brand: 'Bếp Nhà', cat: 'snack', storage: 'kho', lotNo: 'BN2604-03',
      qty: 300, base: 168000, daysLeft: 34, warehouse: 'HN', demand: 7, bulk: 3, practice: 'thanh_ly',
      charityOk: true, sealed: true,
      name: { en: 'Hot & sour shrimp cup noodles 65g (case of 24)', vi: 'Mì ly tôm chua cay 65g (thùng 24)' },
      unit: { en: 'cases', vi: 'thùng' },
      story: { en: 'Cup design changed; the old-packaging run must clear.', vi: 'Đổi thiết kế ly, lô bao bì cũ cần xả.' }
    },
    {
      id: 'L07', sku: 'MA-YM-500', brand: 'Mộc An', cat: 'snack', storage: 'kho', lotNo: 'MA2607-20',
      qty: 450, base: 89000, daysLeft: 120, warehouse: 'BD', demand: 2, bulk: 1, practice: 'thanh_ly',
      charityOk: true, sealed: true,
      name: { en: 'Rolled oats 500g', vi: 'Ngũ cốc yến mạch 500g' },
      unit: { en: 'bags', vi: 'gói' },
      story: { en: 'New arrival with plenty of time — monitor only.', vi: 'Lô mới về, còn nhiều thời gian — chỉ cần theo dõi.' }
    },
    {
      id: 'L08', sku: 'BX-HD-500', brand: 'Bình Phước Xanh', cat: 'snack', storage: 'kho', lotNo: 'BX2605-14',
      qty: 260, base: 185000, daysLeft: 63, warehouse: 'BD', demand: 1, bulk: 1, practice: 'thanh_ly',
      bundleWith: 'L02', charityOk: true, sealed: true,
      name: { en: 'Salted roasted cashews, 500g jar', vi: 'Hạt điều rang muối hũ 500g' },
      unit: { en: 'jars', vi: 'hũ' },
      story: { en: 'Gift item that sells slowly on its own.', vi: 'Hàng quà tặng, bán lẻ chậm khi đứng một mình.' }
    },
    {
      id: 'L09', sku: 'TM-DG-650', brand: 'Thảo Mộc Việt', cat: 'personal', storage: 'kho', lotNo: 'TM2607-05',
      qty: 720, base: 96000, daysLeft: 88, warehouse: 'HN', demand: 2, bulk: 1, practice: 'thanh_ly',
      bundleWith: 'L10', charityOk: true, sealed: true,
      name: { en: 'Pomelo shampoo 650ml', vi: 'Dầu gội bưởi 650ml' },
      unit: { en: 'bottles', vi: 'chai' },
      story: { en: 'A retail chain delisted the line and returned stock.', vi: 'Chuỗi bán lẻ ngừng dòng sản phẩm, trả về kho.' }
    },
    {
      id: 'L10', sku: 'TM-ST-900', brand: 'Thảo Mộc Việt', cat: 'personal', storage: 'kho', lotNo: 'TM2604-22',
      qty: 540, base: 135000, daysLeft: 45, warehouse: 'HN', demand: 3, bulk: 1.5, practice: 'thanh_ly',
      charityOk: true, sealed: true,
      name: { en: 'Green tea body wash 900g', vi: 'Sữa tắm hương trà xanh 900g' },
      unit: { en: 'bottles', vi: 'chai' },
      story: { en: 'New packaging launching; old stock must clear first.', vi: 'Đổi bao bì mới, lô cũ cần xả trước khi lên kệ bao bì mới.' }
    },
    {
      id: 'L11', sku: 'RX-KDR-180', brand: 'Răng Xinh', cat: 'personal', storage: 'kho', lotNo: 'RX2603-30',
      qty: 1800, base: 32000, daysLeft: 27, warehouse: 'DN', demand: 12, bulk: 0.5, practice: 'huy',
      charityOk: true, sealed: true,
      name: { en: 'Charcoal toothpaste 180g', vi: 'Kem đánh răng than tre 180g' },
      unit: { en: 'tubes', vi: 'tuýp' },
      story: { en: 'Past the safety line; the charity still accepts it with over 21 days left.', vi: 'Đã qua đường an toàn; từ thiện vẫn nhận vì còn trên 21 ngày.' }
    },
    {
      id: 'L12', sku: 'ST-NG-36', brand: 'Sạch Thơm', cat: 'home', storage: 'kho', lotNo: 'ST2607-18',
      qty: 260, base: 189000, daysLeft: 104, warehouse: 'DN', demand: 1, bulk: 3, practice: 'thanh_ly',
      transfer: { to: 'BD', costPerUnit: 4500, transitDays: 5, demandFactor: 2.5,
        reason: { en: 'Da Nang sells 1 can/day; the HCMC area is ~2.5× faster', vi: 'Đà Nẵng bán 1 can/ngày; khu vực TP.HCM nhanh ~2,5 lần' } },
      charityOk: true, sealed: true,
      name: { en: 'Sunshine laundry liquid, 3.6kg', vi: 'Nước giặt hương nắng can 3,6kg' },
      unit: { en: 'cans', vi: 'can' },
      story: { en: 'Over-allocated to Central Vietnam.', vi: 'Phân bổ dư cho miền Trung.' }
    },
    {
      id: 'L13', sku: 'BY-KGU-80', brand: 'Bé Yêu', cat: 'home', storage: 'kho', lotNo: 'BY2603-12',
      qty: 1500, base: 28000, daysLeft: 36, warehouse: 'DN', demand: 22, bulk: 0.5, practice: 'thanh_ly',
      charityOk: true, sealed: true,
      name: { en: 'Alcohol-free wet wipes, 80 sheets', vi: 'Khăn giấy ướt không cồn gói 80 tờ' },
      unit: { en: 'packs', vi: 'gói' },
      story: { en: 'Ordered against a forecast 30% above actual demand.', vi: 'Đặt theo dự báo cao hơn thực tế 30%.' }
    },
    {
      id: 'L14', sku: 'GV-BG-PM12', brand: 'Giòn Vui', cat: 'snack', storage: 'kho', lotNo: 'GV2603-09',
      qty: 1100, base: 42000, daysLeft: 25, warehouse: 'BD', demand: 8, bulk: 1, practice: 'huy',
      charityOk: true, sealed: true,
      name: { en: 'Cheese rice crackers, pack of 12', vi: 'Bánh gạo vị phô mai gói 12 cái' },
      unit: { en: 'packs', vi: 'gói' },
      story: { en: 'Display stock left over when the promotion ended.', vi: 'Hàng trưng bày khuyến mãi, kết thúc chương trình còn dư.' }
    },
    {
      id: 'L15', sku: 'ST-XP-280', brand: 'Sạch Thơm', cat: 'home', storage: 'kho', lotNo: 'ST2602-26',
      qty: 420, base: 64000, daysLeft: 24, warehouse: 'BD', demand: 2, bulk: 1, practice: 'huy',
      charityOk: false, sealed: true,
      name: { en: 'Lavender room spray 280ml', vi: 'Xịt phòng hương oải hương 280ml' },
      unit: { en: 'bottles', vi: 'chai' },
      story: { en: 'Outside the charity\'s accepted categories; no return clause.', vi: 'Không thuộc danh mục nhận của tổ chức từ thiện; không có điều khoản trả hàng.' }
    }
  ];

  return {
    OWNER: OWNER,
    PERSONAS: PERSONAS,
    STORAGE: STORAGE,
    CATEGORIES: CATEGORIES,
    WAREHOUSES: WAREHOUSES,
    REGIONS: REGIONS,
    CHANNELS: CHANNELS,
    ACTIONS: ACTIONS,
    PRACTICES: PRACTICES,
    DEFAULT_LADDER: DEFAULT_LADDER,
    DEFAULT_RULES: DEFAULT_RULES,
    LOTS: LOTS
  };
});
