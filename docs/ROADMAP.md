# TTS Pro — Nghiên cứu thị trường & Lộ trình sản phẩm

_Cập nhật: 27/09/2026. Các con số từ bên thứ ba chưa kiểm chứng được đánh dấu (*)._

## 1. Thị trường TTS hiện nay: ai thắng và vì sao

### Bảng xếp hạng chất lượng tiếng Việt (so sánh mù, voicearena.com)

| Hạng | Model | Elo |
|---|---|---|
| 1 | Gemini 3.8 Flash-Lite TTS | 1156 |
| 2 | Gemini 3.8 Flash TTS | 1135 |
| 3 | Gemini 3.1 Flash TTS | 1099 |
| 4 | ElevenLabs v3 | 1043 |
| 5 | Cartesia Sonic-3 | 963 |
| 8 | Azure Dragon HD Omni | 898 |
| 9 | OpenAI gpt-4o-mini-tts | 839 |

Nguồn: https://voicearena.com/tts-leaderboard/vietnamese — hai model 3.8 mới có ~600 lượt vote.

### Đối thủ và điều họ bán

| Sản phẩm | Điểm mạnh | Tiếng Việt |
|---|---|---|
| **Google Gemini TTS** | Điều khiển giọng bằng câu lệnh tự nhiên ("giọng phát thanh viên…"), thẻ `<short pause>`, 2 người nói, clone giọng có xác nhận | Tốt nhất hiện nay |
| **ElevenLabs** (v3, Studio) | Thẻ cảm xúc `[whispers]`, dự án dài, sửa từng đoạn, từ điển phát âm, xuất phụ đề | Có (v3, Flash v2.5). **Multilingual v2 KHÔNG hỗ trợ tiếng Việt** |
| **Azure Speech** | SSML đầy đủ, style `newscast` (chỉ tiếng Anh), mốc thời gian từng từ | Chỉ 2 giọng chuẩn: HoaiMy, NamMinh; không có HD, không style |
| **Vbee** | 1.000+ giọng, giọng bản tin/sách nói 3 miền, từ điển phát âm, chèn ngắt, SRT, API | Chuyên tiếng Việt |
| **FPT.AI / Viettel AI / Zalo** | Giọng 3 miền, gói theo ký tự (FPT free 100k ký tự/tháng) | Chuyên tiếng Việt |
| **VieNeu-TTS v3 Turbo** (mã nguồn mở) | Apache 2.0, 48 kHz, 25 giọng 3 miền, clone 3–8 s, có bản ONNX | Bản mở tốt nhất dùng được cho thương mại |

Không dùng cho thương mại: F5-TTS (trọng số CC-BY-NC), viXTTS (Coqui non-commercial), Higgs TTS 3 (research).
Play.ht đã đóng cửa (31/12/2025).

### Tính năng tạo khác biệt (rút ra từ các sản phẩm dẫn đầu)

1. **Từ điển phát âm** — không model nào tự đọc đúng mọi viết tắt/tên riêng.
2. **Điều khiển ngắt nghỉ** — `<break>`, thẻ pause, hoặc tự chèn khoảng lặng.
3. **Điều khiển phong cách** — preset hoặc câu lệnh tự nhiên.
4. **Sửa/đọc lại từng câu** — model HD cố tình đọc mỗi lần một khác.
5. **Mốc thời gian & phụ đề** — SRT/VTT cho video.
6. **Dự án dài** (sách nói, chương), **nhiều người nói**, **clone giọng có đồng ý + watermark**.

### Chuẩn đọc bản tin

- Ngắt dấu phẩy 150–300 ms; hết câu 400–700 ms (bản tin ngắn hơn đọc truyện); hết đoạn 800–1200 ms; chuyển mục 1,5–2 s.
- Tốc độ: tin tiếng Anh 150–190 từ/phút (BBC ~168); tin tiếng Việt khuyến nghị ~200–220 âm tiết/phút (*).
- Câu dài phải tách thành cụm 6–12 âm tiết, lấy hơi trước liên từ ("nhưng", "tuy nhiên", "trong khi đó").

## 2. Đã làm trong bản nâng cấp này

**Vấn đề gốc (đã đo thực tế):** Edge TTS chèn 0,84 s im lặng cuối mỗi request với giọng tiếng Việt (0,36 s với giọng tiếng Anh) và **từ chối** mọi thẻ `<break>`/style SSML. Bản cũ cắt văn bản theo cụm ~200 ký tự rồi nối thô, nên ngắt nghỉ dài ngắn thất thường, câu dài không có nhịp lấy hơi, "2-3 ngày" bị đọc thành "hai tháng ba ngày". Ngoài ra `ws` bị bundle sai nên Edge TTS treo hoàn toàn trên dev server.

**Voice Studio engine** (`src/lib/speech/`):

- Mỗi câu một request (song song, có giới hạn), cắt im lặng dựa trên mốc thời gian từng từ, chèn frame MP3 im lặng chính xác 24 ms.
- 5 phong cách: Tự nhiên, Bản tin thời sự, Kể chuyện/Sách nói, Podcast, Quảng cáo. Mỗi phong cách có tốc độ, cao độ và bảng ngắt nghỉ riêng: sau tiêu đề, giữa câu, xuống dòng, hết đoạn, sau câu hỏi.
- Ngữ điệu từng câu: tiêu đề chậm và cao hơn, câu hỏi và câu cảm thán lên giọng, đầu đoạn reset cao độ, cuối đoạn chậm lại.
- Ngắt hơi thông minh trước liên từ ở mệnh đề dài.
- Từ điển phát âm: 60+ viết tắt báo chí/hành chính có sẵn (UBND, TP.HCM, GS.TS, BHXH, GDP…) và từ điển riêng của người dùng.
- Chuẩn hoá tiếng Việt: khoảng số ("2-3 ngày"), "50k", "15tr", số La Mã ("Đại hội XIII").
- Thẻ ngắt thủ công: `[ngắt 1s]`, `[pause 500ms]`, `<break time="1s"/>`. Dùng được cho Edge, Gemini và ElevenLabs (chuyển thành `<break>`).
- Xuất phụ đề SRT/VTT khớp từng câu, bản chép lời kiểu karaoke (bấm vào câu để tua).
- Engine **Gemini TTS** (Premium, tuỳ chọn): đọc theo cả đoạn, có chỉ dẫn phong cách phát thanh viên.
- Cache câu (sửa một câu chỉ tổng hợp lại câu đó), retry, tự sửa lệch đồng hồ.
- Sửa lỗi: ElevenLabs trước đây bị gửi model Multilingual v2 (không hỗ trợ tiếng Việt). Giọng mặc định trước đây là giọng ONNX, cần model không có sẵn trong repo.

## 3. Lộ trình tiếp theo

### Giai đoạn 1 — Chất lượng (0–1 tháng)
- [ ] **Đọc lại từng câu** (re-roll) ngay trong transcript, giữ nguyên phần còn lại (engine đã cache theo câu).
- [ ] **Nhấn mạnh từ**: cú pháp `*từ*`, tách thành cụm có prosody riêng, chỉ dùng khi cần.
- [ ] **VieNeu-TTS v3 Turbo (ONNX, Apache 2.0)** thay bộ ONNX cũ: giọng 3 miền, clone giọng chạy ngay trong trình duyệt.
- [ ] **ElevenLabs v3**: dùng thẻ `[short pause]` thay `<break>`; bỏ proxy MakeVoice, dùng API chính thức.
- [ ] Chuẩn hoá thêm: số điện thoại có dấu cách, biển số xe, mã chứng khoán, tên nước ngoài (phiên âm).

### Giai đoạn 2 — Sản phẩm (1–3 tháng)
- [ ] **Dự án dài**: chia chương, lưu dự án, xuất một file MP3 + SRT cho cả sách.
- [ ] **Hội thoại nhiều giọng**: cú pháp `A: … / B: …` cho podcast và phỏng vấn (Gemini hỗ trợ 2 giọng).
- [ ] **"Đạo diễn AI"**: LLM gợi ý phong cách, chỗ nhấn và chỗ ngắt cho từng câu. Schema `PlannedSegment` đã sẵn để nhận dữ liệu này.
- [ ] Tài khoản, lưu lịch sử, hạn mức theo gói, API key cho developer.
- [ ] Chia sẻ link nghe, nhúng player lên web.

### Giai đoạn 3 — Kinh doanh
- **Freemium**: miễn phí giọng Microsoft (giới hạn ký tự/ngày). Pro ~99–199k/tháng: Gemini/ElevenLabs, dự án dài, clone giọng, xuất WAV.
- **API B2B** cho tòa soạn, nhà xuất bản sách nói, e-learning, tổng đài; tính giá theo ký tự, cạnh tranh trực tiếp với Vbee/FPT.
- **Tin cậy**: clone giọng bắt buộc ghi âm xác nhận, watermark audio, nhật ký sử dụng (giống cách Gemini và Resemble làm).
- **Lưu ý pháp lý**: endpoint Edge "Read Aloud" là dịch vụ tiêu dùng không chính thức. Bản thương mại cần chuyển sang **Azure Speech** (cùng giọng, có SLA). Toàn bộ pipeline hiện tại dùng lại được nguyên vẹn vì Azure chấp nhận cùng giọng và trả cùng mốc thời gian từng từ.
