const PinkSalePresaleSection = () => {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Glow */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: "radial-gradient(60% 40% at 50% 0%, rgba(56,189,248,.35) 0%, rgba(0,0,0,0) 60%)" }}
      />

      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            B2BN Token Presale — <span className="text-cyan-300">ERC-20 on Ethereum</span>
          </h1>
          <p className="mt-4 text-slate-300">
            B2BNEST is an <span className="font-semibold text-white">AI-powered, multitenant SaaS ecosystem</span> that helps founders build smarter.
            The <span className="font-semibold">B2BN Token</span> fuels utility, incentives, and community growth across the platform.
          </p>
          {/* Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-full bg-slate-800/70 px-3 py-1 text-sm">Standard: ERC-20</span>
            <span className="rounded-full bg-slate-800/70 px-3 py-1 text-sm">Network: Ethereum</span>
            <span className="rounded-full bg-slate-800/70 px-3 py-1 text-sm">Focus: AI + SaaS</span>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-4">
          <a 
            href="PINKSALE_PRESALE_URL" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-900 hover:bg-cyan-300 transition"
          >
            Join Presale
          </a>
          <a 
            href="/whitepaper" 
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-800 transition"
          >
            Read Whitepaper
          </a>
        </div>

        {/* Key Stats */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-sm text-slate-400">Sale Type</p>
            <p className="mt-1 text-xl font-semibold">Presale (Fixed Price)</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-sm text-slate-400">Contract</p>
            <p className="mt-1 text-xl font-semibold">CONTRACT_ADDRESS</p>
            <p className="text-xs text-slate-400 mt-1">Replace after deployment</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-sm text-slate-400">Ticker</p>
            <p className="mt-1 text-xl font-semibold">B2BN</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-sm text-slate-400">Chain</p>
            <p className="mt-1 text-xl font-semibold">Ethereum</p>
          </div>
        </div>

        {/* Tokenomics */}
        <div className="mx-auto mt-14 max-w-6xl">
          <h2 className="text-2xl font-bold">Tokenomics Allocation</h2>
          <p className="mt-2 text-slate-300">Balanced for growth, liquidity, and long-term alignment.</p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Presale</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-300">30%</p>
              <p className="text-slate-300 text-sm mt-1">Early believers, fixed entry.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Team &amp; Advisors</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-300">10%</p>
              <p className="text-slate-300 text-sm mt-1">Long-term commitment (vesting recommended).</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Development</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-300">22%</p>
              <p className="text-slate-300 text-sm mt-1">AI features, product upgrades, scalability.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Marketing</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-300">15%</p>
              <p className="text-slate-300 text-sm mt-1">Growth, partnerships, community.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Treasury / Liquidity</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-300">20%</p>
              <p className="text-slate-300 text-sm mt-1">Healthy liquidity and runway.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Unlocked at TGE</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-300">3%</p>
              <p className="text-slate-300 text-sm mt-1">Initial ops &amp; seed liquidity.</p>
            </div>
          </div>
        </div>

        {/* Utility & Features */}
        <div className="mx-auto mt-14 max-w-6xl">
          <h2 className="text-2xl font-bold">Utility &amp; Ecosystem</h2>
          <ul className="mt-4 grid list-disc gap-3 pl-5 text-slate-300 sm:grid-cols-2">
            <li>Token utility inside the <span className="font-semibold text-white">AI-powered B2BNEST</span> SaaS suite.</li>
            <li>Access, discounts, and incentives across business tools and modules.</li>
            <li>Community growth loops: referrals, ambassador rewards, engagement tiers.</li>
            <li>Treasury-backed liquidity for sustainable long-term growth.</li>
          </ul>
        </div>

        {/* Timeline / Placeholders */}
        <div className="mx-auto mt-14 max-w-6xl">
          <h2 className="text-2xl font-bold">Presale Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Start</p>
              <p className="mt-1 text-lg font-semibold">PRESALE_START_DATE</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">End</p>
              <p className="mt-1 text-lg font-semibold">PRESALE_END_DATE</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Presale Price</p>
              <p className="mt-1 text-lg font-semibold">PRESALE_RATE (e.g., 1 B2BN = 0.000X ETH)</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Soft / Hard Cap</p>
              <p className="mt-1 text-lg font-semibold">SOFT_CAP / HARD_CAP</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">Vesting (if any)</p>
              <p className="mt-1 text-lg font-semibold">VESTING_DETAILS</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-sm text-slate-400">DEX Listing</p>
              <p className="mt-1 text-lg font-semibold">POST-PRESALE_ETH/USDT POOL + TGE</p>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mx-auto mt-12 flex max-w-md items-center justify-center gap-4">
          <a 
            href="PINKSALE_PRESALE_URL" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-900 hover:bg-cyan-300 transition"
          >
            Join Presale Now
          </a>
          <a 
            href="/tokenomics" 
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-800 transition"
          >
            View Tokenomics
          </a>
        </div>
      </div>
    </section>
  );
};

export default PinkSalePresaleSection;
