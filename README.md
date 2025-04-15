
# Klok Automation Robot

## Giới thiệu

**Klok Automation Robot** là một chương trình tự động hóa được viết bằng JavaScript, sử dụng Node.js để tương tác với nền tảng Klok (klokapp.ai). Chương trình hỗ trợ thực hiện các tác vụ như đăng nhập, trò chuyện với các mô hình AI, hoàn thành nhiệm vụ xã hội (Twitter, Discord), và tích lũy điểm số cho nhiều tài khoản thông qua các khóa riêng (private keys). Nó sử dụng các công cụ như proxy, giải reCAPTCHA v3 thông qua Capsolver, và lập lịch chạy định kỳ với `node-cron`.

Chương trình được thiết kế để chạy đa luồng (multi-thread) bằng `worker_threads`, tối ưu hóa hiệu suất khi xử lý nhiều tài khoản cùng lúc, đồng thời cung cấp giao diện log màu sắc rõ ràng với `chalk`.

### Các tính năng chính
- **Đăng nhập tự động**: Sử dụng khóa riêng Ethereum để đăng nhập vào Klok.
- **Tương tác với mô hình AI**: Tự động gửi câu hỏi ngẫu nhiên từ danh sách và nhận câu trả lời từ các mô hình AI của Klok.
- **Hoàn thành nhiệm vụ xã hội**: Tự động kiểm tra và hoàn thành các nhiệm vụ liên quan đến Twitter (Mira, Klok) và Discord.
- **Quản lý proxy**: Hỗ trợ sử dụng proxy (HTTP/SOCKS) để tránh giới hạn truy cập.
- **Giải reCAPTCHA v3**: Tích hợp Capsolver để vượt qua xác thực reCAPTCHA.
- **Lập lịch chạy**: Chạy định kỳ các tác vụ thông qua cấu hình cron.
- **Tổng kết điểm số**: Theo dõi và hiển thị điểm tích lũy của từng tài khoản.
- **Đa luồng**: Xử lý nhiều tài khoản đồng thời với số lượng luồng tùy chỉnh.

## Cấu trúc thư mục
```bash
├── config.yaml          # Cấu hình chương trình (API, scheduler, Capsolver, v.v.)
├── main.js              # File chính khởi động chương trình
├── worker.js            # File xử lý logic cho từng tài khoản
├── private_keys.txt     # Danh sách khóa riêng của các tài khoản
├── proxies.txt          # Danh sách proxy (tùy chọn)
├── messages.txt         # Danh sách câu hỏi gửi đến mô hình AI
└── README.md            # Tài liệu hướng dẫn (file này)
```


## Yêu cầu
- **Node.js**: Phiên bản 18.x hoặc cao hơn.
- **Tài khoản Capsolver**: Để giải reCAPTCHA v3 (cần API key).
- **Proxy (tùy chọn)**: Nếu muốn sử dụng proxy để quản lý nhiều tài khoản.
- **Khóa riêng Ethereum**: Các tài khoản Klok được liên kết với ví Ethereum.

## Cài đặt

1. **Cài đặt Node.js**
   - Tải và cài đặt Node.js từ [trang chính thức](https://nodejs.org/).
   - Kiểm tra phiên bản:
     ```bash
     node -v
     npm -v
     ```
2. **Tải mã nguồn**
Clone hoặc tải repository về máy:
``` bash
git clone https://github.com/Crazyscholarr/klok_bot.git
cd klok_bot
```
3. ***Cài đặt thư viện**
Chạy lệnh sau để cài đặt các thư viện cần thiết:
```bash
npm install
```
Các thư viện chính bao gồm:
**ethers**: Xử lý ví Ethereum.
**axios**: Gửi yêu cầu HTTP.
**node-cron**: Lập lịch chạy.
**chalk**: Tô màu log.
**js-yaml**: Đọc file YAML.
**worker_threads**: Xử lý đa luồng.
**socks-proxy-agent, https-proxy-agent**: Hỗ trợ proxy.
4. **Cấu hình chương trình**
Tạo file **config.yaml**:
Sao chép nội dung từ mẫu dưới đây và cập nhật các giá trị cần thiết:
**yaml**
```bash
base:
  api_base_url: 'https://api1-pp.klokapp.ai/v1'
  referral_code: "YOUR_REFERRAL_CODE"
  language: "english"
runner:
  thread_count: 2
  max_thread_delay: 60
scheduler:
  jobs:
    - name: "chat_daily"
      schedule: "0 9 * * *"
capsolver:
  api_key: "YOUR_CAPSOLVER_API_KEY"
  website_url: "https://klokapp.ai"
  website_key: "YOUR_RECAPTCHA_WEBSITE_KEY"
  ```
**Giải thích:**

  **api_base_url**: URL API của Klok.
  **referral_code**: Mã mời (tùy chọn).
  **thread_count**: Số lượng tài khoản chạy đồng thời.
  **max_thread_delay**: Thời gian chờ tối đa giữa các luồng (giây).
  **schedule:** Lịch chạy định kỳ (theo cú pháp cron, ví dụ: 0 9 * * * là 9h sáng mỗi ngày).
  **capsolver.api_key:** Khóa API từ Capsolver.
  **website_key:** Khóa reCAPTCHA v3 của Klok.

Tạo file **private_keys.txt:**
Thêm danh sách khóa riêng Ethereum, mỗi khóa trên một dòng:
```bash
0xYourPrivateKey1
0xYourPrivateKey2
...
```
Lưu ý: Không chia sẻ khóa riêng với bất kỳ ai.
Tạo file **proxies.txt** (tùy chọn):
Thêm danh sách proxy (HTTP hoặc SOCKS), mỗi proxy trên một dòng:
```bash

Sao chép
http://user:pass@ip:port
socks5://user:pass@ip:port
...
```
Nếu không dùng proxy, để file trống hoặc không tạo file.
Tạo file **messages.txt:**
Thêm danh sách câu hỏi để gửi đến mô hình AI, mỗi câu trên một dòng:
```bash
text

What is the capital of France?
How does blockchain work?
...
```
5. **Kiểm tra Capsolver**
Đảm bảo tài khoản Capsolver của bạn có đủ số dư.
Kiểm tra API key và website key trong config.yaml.
### Hướng dẫn chạy
1 **Khởi động chương trình**
Chạy lệnh sau từ thư mục dự án:
```bash
node main.js
```
  **Chương trình sẽ:**
      Đọc cấu hình từ **config.yaml.**
      Tải danh sách khóa riêng và proxy.
      Khởi động các luồng xử lý tài khoản (số lượng luồng được xác định bởi thread_count).
      Thực hiện đăng nhập, kiểm tra nhiệm vụ, và trò chuyện với mô hình AI.
      Hiển thị log chi tiết với màu sắc.
2. **Theo dõi log**
  Log sẽ hiển thị thông tin như:
      Trạng thái đăng nhập.
      Điểm tích lũy của từng tài khoản.
      Kết quả giải reCAPTCHA.
      Lỗi (nếu có).
3. **Lập lịch chạy**
    Chương trình sẽ tự động chạy lại theo lịch được định nghĩa trong **config.yaml** (mặc định là 9h sáng mỗi ngày).
    Để tắt lịch, xóa phần scheduler trong **config.yaml** hoặc sửa lịch theo ý muốn.
4. **Dừng chương trình**
Nhấn ``` Ctrl + C ```để dừng chương trình.
Chương trình sẽ hiển thị tổng kết điểm trước khi thoát.
### Lưu ý
**Bảo mật:**
Không chia sẻ ``private_keys.txt`` hoặc ``config.yaml`` công khai.
Lưu trữ khóa riêng an toàn, sử dụng ví phần cứng nếu cần.
**Hiệu suất:**
Số lượng ``thread_count ``nên phù hợp với tài nguyên máy (CPU, RAM).
Proxy chất lượng cao sẽ giúp tránh bị chặn IP.
**Capsolver:**
Đảm bảo tài khoản Capsolver có đủ số dư để giải reCAPTCHA.
Nếu gặp lỗi liên quan đến Capsolver, kiểm tra API key và website key.
**Khắc phục sự cố:**
Nếu chương trình báo lỗi về proxy, kiểm tra danh sách proxy trong ``proxies.txt.``
Nếu không đăng nhập được, kiểm tra khóa riêng trong ``private_keys.txt.``
Kiểm tra log để biết chi tiết lỗi.
**Ví dụ log**
```bash
=================== Robot tự động Klok ===================
📄 Đang đọc file cấu hình: /path/to/config.yaml
🚀 Khởi động nhóm Account động (tối đa 2 Account)
[12:00:00 | 15-04-2025] [Crazyscholar @ KLOL] |Account 1| ⇄ Bắt đầu đăng nhập..., sử dụng proxy http://ip:port
[12:00:01 | 15-04-2025] [Crazyscholar @ KLOL] |Account 1| Proxy http://ip:port hoạt động, IP: 123.456.789.012
[12:00:02 | 15-04-2025] [Crazyscholar @ KLOL] |Account 1| 🔐 ✅ Đăng nhập thành công
[12:00:03 | 15-04-2025] [Crazyscholar @ KLOL] |Account 1| Tổng điểm: 150
```
### Đóng góp
Nếu bạn muốn đóng góp, hãy tạo issue hoặc pull request trên repository.
Các cải tiến có thể bao gồm:
Tối ưu hóa hiệu suất đa luồng.
Thêm hỗ trợ cho các dịch vụ CAPTCHA khác.
Cải thiện giao diện log.
### Giấy phép
Chương trình được phát hành dưới dạng mã nguồn mở theo . Vui lòng đọc kỹ trước khi sử dụng.

### Liên hệ
Nếu bạn có câu hỏi hoặc cần hỗ trợ, hãy liên hệ qua: https://web.telegram.org/k/#@Crzscholar
