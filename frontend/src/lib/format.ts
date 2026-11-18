import type { Verdict } from "./types";

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null || Number.isNaN(v) ? "không có" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 3) =>
  v == null || Number.isNaN(v) ? "không có" : v.toFixed(digits);

export const ms = (v: number | null | undefined) =>
  v == null ? "không có" : v < 1 ? `${(v * 1000).toFixed(0)} µs` : v < 1000 ? `${v.toFixed(v < 10 ? 2 : 0)} ms` : `${(v / 1000).toFixed(1)} s`;

export const VERDICT: Record<Verdict, { title: string; line: string; color: string; tw: string }> = {
  legitimate: {
    title: "Có vẻ hợp pháp",
    line: "Không có dấu hiệu của bẫy. Vẫn hãy kiểm tra địa chỉ trước khi nhập mật khẩu.",
    color: "rgb(var(--biolume))",
    tw: "text-biolume",
  },
  suspicious: {
    title: "Đáng ngờ",
    line: "Một số tín hiệu bất thường. Đừng đăng nhập hoặc thanh toán cho đến khi xác nhận website bằng kênh khác.",
    color: "rgb(var(--kelp))",
    tw: "text-kelp",
  },
  phishing: {
    title: "Lừa đảo",
    line: "Đây có vẻ là bẫy nhằm đánh cắp thông tin đăng nhập hoặc thanh toán. Hãy đóng trang và không nhập dữ liệu.",
    color: "rgb(var(--lure))",
    tw: "text-lure",
  },
};

export const FEATURE_LABELS: Record<string, string> = {
  url_length: "Độ dài URL", host_length: "Độ dài tên máy chủ", path_length: "Độ dài đường dẫn", query_length: "Độ dài truy vấn",
  num_path_segments: "Số đoạn đường dẫn", max_path_segment_length: "Đoạn đường dẫn dài nhất", num_subdomains: "Tên miền phụ",
  sld_length: "Độ dài tên miền", tld_length: "Độ dài TLD", is_ip_host: "IP thô làm máy chủ", has_port: "Cổng được khai báo",
  has_at_symbol: "Ký hiệu '@' trong URL", num_dots_host: "Dấu chấm trong tên máy chủ", num_hyphens_host: "Dấu gạch ngang trong tên máy chủ",
  num_hyphens_url: "Dấu gạch ngang trong URL", num_underscores: "Dấu gạch dưới", num_slashes: "Dấu gạch chéo", has_double_slash_in_path: "'//' trong đường dẫn",
  num_equals: "Số dấu '='", num_question: "Số dấu '?'", num_ampersand: "Số dấu '&'", num_percent: "Mã hóa phần trăm",
  num_tilde: "Số dấu '~'", num_digits_url: "Chữ số trong URL", digit_ratio_url: "Tỷ lệ chữ số", num_digits_host: "Chữ số trong tên máy chủ",
  letter_ratio_url: "Tỷ lệ chữ cái", host_entropy: "Tên máy chủ ngẫu nhiên", url_entropy: "URL ngẫu nhiên",
  longest_token_length: "Chuỗi dài nhất", num_host_tokens: "Từ trong tên máy chủ", has_punycode: "Tên giả mạo Punycode",
  sensitive_word_count: "Từ đăng nhập / xác minh", brand_outside_domain: "Thương hiệu ngoài tên miền",
  brand_in_domain_not_exact: "Thương hiệu trong tên miền khác", is_shortener: "URL rút gọn", is_free_hosting: "Hosting miễn phí",
  suspicious_tld: "TLD bị lạm dụng nhiều", has_file_extension: "Tệp script trong đường dẫn", has_php: "PHP trong đường dẫn",
  http_token_in_url: "'http' trong URL", embedded_url: "URL được nhúng", max_char_repeat: "Ký tự lặp lại", num_hex_runs: "Chuỗi hex",
  LineOfCode: "Số dòng HTML", LargestLineLength: "Dòng HTML dài nhất", HasTitle: "Có tiêu đề", HasFavicon: "Có favicon",
  Robots: "Có robots.txt", IsResponsive: "Giao diện thích ứng", HasDescription: "Có mô tả meta", NoOfPopup: "Cửa sổ bật lên",
  NoOfiFrame: "Iframe", HasExternalFormSubmit: "Biểu mẫu gửi sang ngoài", HasSocialNet: "Liên kết mạng xã hội", HasSubmitButton: "Có nút gửi",
  HasHiddenFields: "Trường ẩn", HasPasswordField: "Trường mật khẩu", Bank: "Từ ngân hàng", Pay: "Từ thanh toán",
  Crypto: "Từ tiền mã hóa", HasCopyrightInfo: "Thông tin bản quyền", NoOfImage: "Số hình ảnh", NoOfCSS: "Tệp stylesheet", NoOfJS: "Tệp script",
  NoOfSelfRef: "Liên kết nội bộ", NoOfEmptyRef: "Liên kết trống", NoOfExternalRef: "Liên kết ngoài",
};

export const featureLabel = (f: string) => FEATURE_LABELS[f] ?? f.replace(/_/g, " ");

export const SET_LABEL: Record<string, string> = {
  url: "Mô hình URL trực tiếp",
  content: "Mô hình nội dung trang trực tiếp",
  uci: "Bộ chuẩn UCI",
};
