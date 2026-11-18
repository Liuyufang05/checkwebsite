"""Human-readable names for features (used in explanations and the UI)."""

DESCRIPTIONS: dict[str, str] = {
    # URL lexical
    "url_length": "Độ dài URL", "host_length": "Độ dài tên máy chủ", "path_length": "Độ dài đường dẫn",
    "query_length": "Độ dài chuỗi truy vấn", "num_path_segments": "Số đoạn đường dẫn",
    "max_path_segment_length": "Đoạn đường dẫn dài nhất", "num_subdomains": "Số tên miền phụ",
    "sld_length": "Độ dài tên miền", "tld_length": "Độ dài TLD", "is_ip_host": "Máy chủ là địa chỉ IP thô",
    "has_port": "Có cổng trong URL", "has_at_symbol": "Có ký hiệu '@' trong URL", "num_dots_host": "Số dấu chấm trong tên máy chủ",
    "num_hyphens_host": "Số dấu gạch ngang trong tên máy chủ", "num_hyphens_url": "Số dấu gạch ngang trong URL", "num_underscores": "Số dấu gạch dưới trong URL",
    "num_slashes": "Số dấu gạch chéo trong URL", "has_double_slash_in_path": "Có '//' trong đường dẫn", "num_equals": "Số ký tự '='",
    "num_question": "Số ký tự '?'", "num_ampersand": "Số ký tự '&'", "num_percent": "Số ký tự mã hóa phần trăm",
    "num_tilde": "Số ký tự '~'", "num_digits_url": "Số chữ số trong URL", "digit_ratio_url": "Tỷ lệ chữ số trong URL",
    "num_digits_host": "Số chữ số trong tên máy chủ", "letter_ratio_url": "Tỷ lệ chữ cái trong URL", "host_entropy": "Độ ngẫu nhiên của tên máy chủ",
    "url_entropy": "Độ ngẫu nhiên của URL", "longest_token_length": "Từ hoặc chuỗi dài nhất", "num_host_tokens": "Số từ trong tên máy chủ",
    "has_punycode": "Punycode (ký tự giống chữ thật)", "sensitive_word_count": "Từ nhạy cảm (đăng nhập, xác minh, tài khoản...)",
    "brand_outside_domain": "Tên thương hiệu nằm ngoài tên miền thật", "brand_in_domain_not_exact": "Tên thương hiệu nhúng trong tên miền khác",
    "is_shortener": "URL rút gọn", "is_free_hosting": "Tên miền hosting hoặc công cụ tạo trang miễn phí", "suspicious_tld": "TLD bị lạm dụng nhiều",
    "has_file_extension": "Đường dẫn kết thúc bằng tệp hoặc phần mở rộng script", "has_php": "Script PHP trong đường dẫn", "http_token_in_url": "Chuỗi 'http' trong máy chủ hoặc đường dẫn",
    "embedded_url": "Có URL khác nhúng trong đường dẫn hoặc truy vấn", "max_char_repeat": "Chuỗi ký tự lặp dài nhất",
    "num_hex_runs": "Chuỗi hex dài (theo dõi hoặc che giấu)",
    # HTML content (PhiUSIIL names)
    "LineOfCode": "Số dòng HTML", "LargestLineLength": "Dòng HTML dài nhất", "HasTitle": "Trang có thẻ <title>",
    "HasFavicon": "Trang có favicon", "Robots": "Website có robots.txt", "IsResponsive": "Thích ứng với thiết bị di động",
    "HasDescription": "Có mô tả meta", "NoOfPopup": "Cửa sổ bật lên", "NoOfiFrame": "Số iframe",
    "HasExternalFormSubmit": "Biểu mẫu gửi sang tên miền khác", "HasSocialNet": "Liên kết mạng xã hội",
    "HasSubmitButton": "Có nút gửi", "HasHiddenFields": "Trường biểu mẫu ẩn", "HasPasswordField": "Trường mật khẩu",
    "Bank": "Từ khóa ngân hàng", "Pay": "Từ khóa thanh toán", "Crypto": "Từ khóa ví tiền mã hóa",
    "HasCopyrightInfo": "Thông báo bản quyền", "NoOfImage": "Số hình ảnh", "NoOfCSS": "Số tệp định kiểu",
    "NoOfJS": "Số script", "NoOfSelfRef": "Liên kết tới cùng website", "NoOfEmptyRef": "Liên kết trống (#)",
    "NoOfExternalRef": "Liên kết tới website khác",
}


def describe(feature: str) -> str:
    return DESCRIPTIONS.get(feature, feature)
