import { useLayoutEffect, useRef } from "react";
import { gsap, usePrefersReducedMotion } from "../lib/motion";

const IMG = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

type Card = { kind: "stat" | "text" | "image"; title: string; body: string; stat?: string; img?: string; credit?: string };

const CARDS: Card[] = [
  {
    kind: "image", title: "Ba bộ dữ liệu công khai", img: IMG("photo-1760039894970-eb66a3633c5a"), credit: "Ảnh: Digital Reach / Unsplash",
    body: "Hai bộ đến từ nhà nghiên cứu đại học và một bộ từ GitHub. Chúng được tải tự động và kiểm tra để tránh thay đổi ngầm.",
  },
  {
    kind: "stat", stat: "100%", title: "liên kết 'thật' trong một bộ dữ liệu là trang chủ thuần túy",
    body: "Mô hình lười có thể học rằng 'mọi liên kết có trang sau dấu gạch chéo đều là giả'. Chúng tôi chuẩn hóa mọi liên kết giống nhau và bổ sung liên kết thật sâu hơn, nên mô hình không thể dùng lối tắt đó.",
  },
  {
    kind: "stat", stat: "1", title: "cột dữ liệu đã tiết lộ đáp án",
    body: "Một cột trong bộ dữ liệu gần như nói thẳng đáp án cho mô hình. Liên kết bạn dán không có cột này, nên chúng tôi bỏ cột đó và chỉ dùng dấu hiệu đọc được từ trang thực.",
  },
  {
    kind: "image", title: "Không nhìn trộm đề thi", img: IMG("photo-1714880003292-17685b9999b6"), credit: "Ảnh: Kaptured by Kasia / Unsplash",
    body: "Nếu mô hình luyện trên một trang của website rồi được thử trên trang khác cùng website, giống như xem trước đề thi. Mỗi website chỉ thuộc một phía. Điểm giảm từ 87,9 xuống 85,5: đó là con số trung thực.",
  },
  {
    kind: "text", title: "Cùng quy tắc cho mọi mô hình",
    body: "Mọi mô hình đều nhận cùng ví dụ luyện tập, cùng mức tinh chỉnh và cùng bài thi cuối. Chúng tôi đo thời gian mỗi mô hình học và trả lời.",
  },
  {
    kind: "image", title: "Một quy tắc, dùng hai lần", img: IMG("photo-1750944881571-458e33204353"), credit: "Ảnh: Anne Nyg\u00e5rd / Unsplash",
    body: "Cùng một đoạn mã đọc dấu hiệu khi mô hình học và khi bạn dán liên kết, nên luôn xem dữ liệu theo cách đã được dạy.",
  },
  {
    kind: "text", title: "Những điều nó không thể đảm bảo",
    body: "Lừa đảo mới ra mắt, website thật bị tấn công và trang che giấu khỏi bộ quét vẫn có thể lọt qua. Hãy xem kết quả là lời khuyên mạnh, không phải bảo đảm tuyệt đối.",
  },
];

export default function Methodology() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (reduced) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const el = track.current!;
      const distance = () => el.scrollWidth - window.innerWidth + 48;
      gsap.to(el, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, scrub: 0.8, pin: true, invalidateOnRefresh: true, anticipatePin: 1 },
      });
    });
    return () => mm.revert();
  }, [reduced]);

  return (
    <section id="method" ref={root} className="relative z-10 overflow-hidden bg-abyss py-24 md:py-0">
      <div className="flex min-h-[100svh] flex-col justify-center">
        <div className="shell">
          <p className="font-display text-lg font-bold text-biolume">Chương 5</p>
          <h2 className="mt-2 max-w-[20ch] font-display text-display-lg font-extrabold">Cách chúng tôi giữ điểm số trung thực</h2>
          <p className="lede mt-5 text-xl">Nhiều dự án chống lừa đảo trực tuyến báo điểm gần như hoàn hảo vì dữ liệu có lối tắt tiềm ẩn. Đây là những lối tắt chúng tôi tìm thấy và cách xử lý.</p>
        </div>
        <div ref={track} className="mt-12 flex gap-5 overflow-x-auto px-5 pb-6 sm:px-8 md:overflow-visible lg:px-12" style={{ scrollbarWidth: "none" }}>
          {CARDS.map((c) => (
            <article key={c.title} className={`panel relative flex w-[82vw] shrink-0 flex-col justify-end overflow-hidden p-7 sm:w-[440px] ${c.kind === "image" ? "min-h-[440px]" : "min-h-[440px]"}`}>
              {c.img && (
                <>
                  <img src={c.img} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-45" />
                  <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/70 to-transparent" />
                </>
              )}
              <div className="relative">
                {c.stat && <p className="font-display text-[clamp(4rem,9vw,7rem)] font-extrabold leading-none tracking-tighter text-lure">{c.stat}</p>}
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight">{c.title}</h3>
                <p className="mt-3 text-mist">{c.body}</p>
                {c.credit && <p className="mt-4 text-[11px] text-mist/80">{c.credit}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
