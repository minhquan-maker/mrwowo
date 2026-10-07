# Quy tắc nghiệp vụ — mrwowo

Tài liệu này mô tả đúng những gì `assets/js/engine.js` thực thi. Khi đổi luật trong code, cập nhật tài liệu và chạy `npm test`.
Bản tiếng Anh (bản chính): [`../BUSINESS-RULES.md`](../BUSINESS-RULES.md).

## 1. Phạm vi hàng hóa

| Loại | Nhận? | Đường an toàn (gỡ khỏi kênh bán) | Trong dữ liệu mẫu |
|---|---|---|---|
| Hàng khô đóng gói, còn niêm phong | Có | 30 ngày (cấu hình 30–90) | Có — 15 lô |
| Hàng lạnh | Có (cấu hình) | 7 ngày (cấu hình 7–30) | Không |
| Hàng tươi | **Không** | — | Không |
| Hàng đã quá hạn | **Không** — chỉ hủy có hồ sơ | — | Không |

## 2. Luật chủ hàng (màn 1)

| Luật | Mặc định | Giới hạn | Tác dụng |
|---|---|---|---|
| Giá sàn | 60% giá gốc | 20–90% | Không đơn vị nào bán dưới mức này ở bất kỳ kênh nào |
| Mức giảm tối đa (trần) | 50% | 0–80% | Không bậc giá / người duyệt nào vượt được. *70% chỉ là ví dụ một chủ hàng có thể đặt.* |
| Giới hạn mỗi người mua | 6 đơn vị/đơn | 1–50 | Áp dụng mọi kênh; giới hạn thấp làm tốc độ bán giảm nhẹ trong mô phỏng |
| Hiển thị thương hiệu | Hiện; ẩn ở nhóm Zalo | Mặc định + ghi đè theo kênh | Khi ẩn, listing hiển thị "… — hàng chính hãng (ẩn thương hiệu)" |
| Khu vực loại trừ | Không | 5 khu vực | Kênh chỉ có mặt ở khu vực bị loại trừ → bị chặn; kênh nhiều khu vực → ẩn listing tại khu vực đó |
| Quyên góp tối thiểu | ≥ 21 ngày | 7–60 | Tổ chức từ thiện chỉ nhận hàng còn đủ ngày phân phối |

**Giá thấp nhất cho phép** = `max(giá sàn, giá gốc × (1 − trần giảm))`, làm tròn **lên** bội số 500 đ.

## 3. Bậc giá theo số ngày còn lại

Chuyển thể từ `ladder()` / `priceAt()` của prototype cũ (`index_1.html`): giữ cách làm tròn 500 đ và kẹp ở giá sàn,
thêm bậc "giữ giá" khi còn trên 90 ngày.

| Còn (ngày) | ≥ 91 | 61–90 | 46–60 | 31–45 | 15–30 | 7–14 | 0–6 |
|---|---|---|---|---|---|---|---|
| Bậc giảm | 0% | 20% | 30% | 40% | 50% | 60% | 65% |

```
giá = clamp( round500(giá gốc × (1 − (bậc + giảm thủ công + giảm riêng của kênh))),
             giá thấp nhất cho phép,
             giá gốc )
```

- Kênh nhóm mua chung giảm thêm 5% cho đơn nhóm — vẫn bị kẹp ở giá sàn.
- Giảm thủ công chỉ được nhập ở màn Duyệt; `guard()` chặn nếu giá yêu cầu < giá sàn hoặc mức giảm yêu cầu > trần.

## 4. Đề xuất hành động — `recommend(lô, ngày còn lại, luật)`

Tốc độ bán ở giá gốc `v` = nhu cầu × Σ sức bán của các kênh còn mở × hệ số giới hạn mua.
Cần `need = tồn / v` ngày; còn `window = ngày còn lại − đường an toàn` ngày.

**Đã chạm đường an toàn (ngày còn lại ≤ đường an toàn):**
1. *Trả nhà cung cấp* — nếu hợp đồng có điều khoản và còn ≥ hạn trả.
2. *Quyên góp* — nếu thuộc danh mục nhận, còn ≥ ngưỡng quyên góp, và tổ chức không bị loại trừ hết khu vực.
3. *Hủy có hồ sơ* — còn lại.

**Còn trên đường an toàn:**
1. *Chuyển kho* — nếu có kho nhận phù hợp và `window ≥ 45`.
2. *Giữ giá, theo dõi* — nếu `need ≤ 0,85 × window`.
3. *Bán kèm (bundle)* — nếu có sản phẩm ghép và `window ≥ 20`.
4. *Bán qua kênh* — nếu còn > đường an toàn + 30 ngày.
5. *Giảm giá theo bậc* — còn lại.

Mỗi đề xuất trả kèm lý do bằng số (tồn, tốc độ bán, số ngày cần, số ngày còn).

## 5. Kiểm tra luật — `guard(lô, đề xuất, ngày còn lại, luật)`

| Kiểm tra | Áp dụng | Chặn khi |
|---|---|---|
| Hàng khô, còn niêm phong | Mọi hành động | Không phải hàng khô / mất niêm phong |
| Chưa quá hạn | Mọi hành động | Ngày còn lại ≤ 0 |
| Trên đường an toàn | Hành động bán | Ngày còn lại ≤ đường an toàn |
| Không thấp hơn giá sàn | Hành động bán | Giảm thủ công đẩy giá < giá sàn |
| Mức giảm ≤ trần | Hành động bán | Giảm thủ công đẩy mức giảm > trần |
| Không bán vào khu vực loại trừ | Hành động bán | Có phân bổ > 0 vào kênh bị chặn |
| Phân kênh không vượt tồn | Hành động bán | Tổng phân bổ > tồn |
| Điều khoản trả NCC | Trả NCC | Không có điều khoản / quá hạn trả |
| Tổ chức nhận được | Quyên góp | Ngoài danh mục / dưới ngưỡng ngày / bị loại trừ |
| Có sản phẩm ghép / kho nhận | Bundle / Chuyển kho | Thiếu khai báo |

Giới hạn mỗi người mua, hiển thị thương hiệu, hồ sơ hủy là kiểm tra **thông tin** (luôn đạt, hiển thị để người duyệt thấy).
Người thao tác vai trò *Kế toán trưởng* chỉ xem và xuất — không duyệt, không đổi luật.

## 6. Mô phỏng & hồ sơ lô — `simulateLot()`

- Ngày 0 = hôm nay. Bán theo ngày cho tới khi hết hàng hoặc chạm đường an toàn.
- Tốc độ bán mỗi kênh = nhu cầu × sức bán kênh × (1 + 2,5 × mức giảm) × hệ số hành động × hệ số giới hạn mua.
  - Bundle: × 1,35, thêm 1.000 đ/đơn vị chi phí đóng combo.
  - Chuyển kho: không bán trong thời gian vận chuyển; sau đó × hệ số vùng nhận; tính phí chuyển kho trên số lượng phân cho kênh bán.
- Chạm đường an toàn → **tự gỡ** khỏi mọi kênh; phần còn lại xử lý theo mục 4 sau 2 ngày.
- Quyên góp / trả NCC / hủy trực tiếp thực hiện sau 2 ngày xử lý.
- Mỗi sự kiện sinh chứng từ: biên bản bàn giao quyên góp (`QG-…`), phiếu trả hàng (`TH-…`), biên bản hủy (`HB-…`), phiếu điều chuyển (`DC-…`).
- Sổ đơn hợp nhất: mỗi ngày × kênh là một bút toán `MM|ZL|AP|TT-<mã lô>-<số>`, ước tính số đơn = ⌈số lượng / 3⌉.

## 7. Giá trị thu hồi ròng

```
Thu hồi ròng = Doanh thu + Hoàn NCC − Phí kênh − Vận chuyển − Xử lý − Chuyển kho − Hủy
```

| Tham số (ước tính) | Mặc định |
|---|---|
| Phí kênh | mini-mart 15%, nhóm mua chung 5%, app đối tác 12%, từ thiện 0% |
| Vận chuyển / đơn vị | 600 / 1.200 / 900 / 300 đ × hệ số cồng kềnh của lô |
| Chi phí xử lý | 500 đ/đơn vị |
| Chi phí hủy có giám sát | 2.500 đ/đơn vị × hệ số cồng kềnh |
| Vận chuyển trả NCC | 800 đ/đơn vị × hệ số cồng kềnh |

**Mốc so sánh (cách hiện tại):** xả hàng cho đầu nậu = tồn × giá gốc × 22% − 400 đ/đơn vị bốc xếp; hủy cuối kỳ = − tồn × chi phí hủy.

**Tổng hợp danh mục:** lô đã duyệt → kế hoạch mrwowo; lô chờ duyệt / bị từ chối → cách hiện tại.

**CO2e (ước tính):** (bán + quyên góp + trả NCC) × hệ số theo nhóm hàng × hệ số cồng kềnh. Hệ số là giả định, luôn gắn nhãn "ước tính".

## 8. Nhật ký quyết định

Mỗi thao tác ghi: thời điểm, người, vai trò, loại (`approve`, `reject`, `blocked`, `undo`, `rules`, `allocation`, `export`, `system`), lô và thông điệp dạng `{ key, vars }` — nên nhật ký hiển thị theo ngôn ngữ đang chọn.
Xuất CSV (UTF-8 có BOM, mở được bằng Excel) ở màn Báo cáo.

## 9. Niêm yết trên cửa hàng — `storefront(lô, kế hoạch, luật, ngày, 'shop')`

Cửa hàng cho người mua (`shop.html`) chỉ là một kênh bán khác (`shop`: độ phủ 0,6, phí 3%, vận chuyển 800 đ/đơn vị,
mọi khu vực). Một lô chỉ được niêm yết khi thỏa **tất cả**:

| Điều kiện | Nếu không |
|---|---|
| Quyết định của lô **đã duyệt** và là hành động bán | không niêm yết |
| Số ngày còn lại > ngưỡng an toàn | `removed` |
| Kênh cửa hàng không bị chặn bởi vùng loại trừ | `blocked` |
| Lô chuyển kho đã qua số ngày vận chuyển | `transit` |
| Phân bổ cho cửa hàng − đã bán ở cửa hàng − đơn đang chờ > 0, và tồn − mọi đơn đang chờ > 0 | `soldOut` |

- Giá = `priceAt()` cho kênh `shop` tại ngày mô phỏng, gồm cả mức giảm thủ công đã duyệt — luôn nằm giữa giá sàn và
  giá gốc. Thẻ sản phẩm hiện mức giá thấp hơn tiếp theo và ngày áp dụng.
- Mỗi dòng giỏ hàng tối đa `min(giới hạn mỗi người mua, số còn lại)`; người mua ở vùng loại trừ không đặt được hàng.
- Đơn `{ id, day, channel: 'shop', units, price }` được ghi vào đúng ngày **trước** nhu cầu mô phỏng, theo giá người mua
  đã trả; số lượng đã hứa cho đơn ở ngày sau được giữ lại. Đơn hiện trong sổ cái chung (`SH-…`), hồ sơ lô và nhật ký
  quyết định (loại *Đơn cửa hàng*).
