import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-reef/60 pb-32 pt-14">
      <div className="shell grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight">
            <img src="/favicon.svg" alt="" className="h-8 w-8" /> PhishGuard
          </p>
          <p className="mt-3 max-w-[40ch] text-sm text-mist">Check the bait before you bite. Open-source phishing detection with the evidence on show.</p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <p className="mb-3 text-mist">Explore</p>
          <ul className="space-y-2">
            <li><Link className="hover:text-biolume" to="/research">Inside the models</Link></li>
            <li><Link className="hover:text-biolume" to="/history">Recent scans</Link></li>
            <li><a className="hover:text-biolume" href="/api/docs">API documentation</a></li>
            <li><a className="hover:text-biolume" href="https://github.com/demonmj/phishing-detector">Source code</a></li>
          </ul>
        </nav>
        <div className="text-sm text-mist">
          <p className="mb-3">Credits</p>
          <p>Datasets: UCI Phishing Websites, PhiUSIIL (CC BY 4.0), faizann24 URL corpus.</p>
          <p className="mt-2">Photography from Unsplash: Digital Reach, Kaptured by Kasia, Anne Nygård.</p>
          <p className="mt-2">Released under the MIT License.</p>
        </div>
      </div>
    </footer>
  );
}
