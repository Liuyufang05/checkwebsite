import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-reef/60 pb-32 pt-14">
      <div className="shell grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight">
            <img src="/favicon.svg" alt="" className="h-8 w-8" /> PhishGuard
          </p>
          <p className="mt-3 max-w-[40ch] text-sm text-mist">Kiểm tra liên kết trước khi nhấp. Công cụ mã nguồn mở giúp phát hiện website lừa đảo với bằng chứng minh bạch.</p>
        </div>
        <nav aria-label="Chân trang" className="text-sm">
          <p className="mb-3 text-mist">Khám phá</p>
          <ul className="space-y-2">
            <li><Link className="hover:text-biolume" to="/research">Bên trong mô hình</Link></li>
            <li><Link className="hover:text-biolume" to="/history">Lần quét gần đây</Link></li>
            <li><a className="hover:text-biolume" href="/api/docs">Tài liệu API</a></li>
            <li><a className="hover:text-biolume" href="https://github.com/demonmj/phishing-detector">Mã nguồn</a></li>
          </ul>
        </nav>
        <div className="text-sm text-mist">
          <p className="mb-3">Ghi công</p>
          <p>Bộ dữ liệu: UCI Phishing Websites, PhiUSIIL (CC BY 4.0), bộ URL faizann24.</p>
          <p className="mt-2">Ảnh từ Unsplash: Digital Reach, Kaptured by Kasia, Anne Nygård.</p>
          <p className="mt-2">Phát hành theo Giấy phép MIT.</p>
        </div>
      </div>
    </footer>
  );
}
