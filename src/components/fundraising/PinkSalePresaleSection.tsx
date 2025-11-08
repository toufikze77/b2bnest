const PinkSalePresaleSection = () => {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background">
      {/* Glow */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{ background: "radial-gradient(60% 40% at 50% 0%, hsl(var(--primary) / 0.3) 0%, transparent 60%)" }}
      />

      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            B2BN Token Presale — <span className="text-primary">ERC-20 on Ethereum</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            B2BNEST is an <span className="font-semibold text-foreground">AI-powered, multitenant SaaS ecosystem</span> that helps founders build smarter.
            The <span className="font-semibold text-foreground">B2BN Token</span> fuels utility, incentives, and community growth across the platform.
          </p>
          {/* Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-sm text-foreground">Standard: ERC-20</span>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-sm text-foreground">Network: Ethereum</span>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-sm text-foreground">Focus: AI + SaaS</span>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-4">
          <a 
            href="PINKSALE_PRESALE_URL" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            Join Presale
          </a>
          <a 
            href="/whitepaper" 
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 font-semibold text-foreground hover:bg-accent transition"
          >
            Read Whitepaper
          </a>
        </div>

        {/* Key Stats */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 hover-scale">
            <p className="text-sm text-muted-foreground">Sale Type</p>
            <p className="mt-1 text-xl font-semibold text-foreground">Presale (Fixed Price)</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 hover-scale">
            <p className="text-sm text-muted-foreground">Ticker</p>
            <p className="mt-1 text-xl font-semibold text-foreground">B2BN</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 hover-scale">
            <p className="text-sm text-muted-foreground">Chain</p>
            <p className="mt-1 text-xl font-semibold text-foreground">Ethereum</p>
          </div>
        </div>

        {/* Tokenomics */}
        <div className="mx-auto mt-14 max-w-6xl">
          <h2 className="text-2xl font-bold text-foreground">Tokenomics Allocation</h2>
          <p className="mt-2 text-muted-foreground">Balanced for growth, liquidity, and long-term alignment.</p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 hover-scale animate-fade-in">
              <p className="text-sm text-muted-foreground">Presale</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">30%</p>
              <p className="text-muted-foreground text-sm mt-1">Early believers, fixed entry.</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 hover-scale animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <p className="text-sm text-muted-foreground">Team &amp; Advisors</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">10%</p>
              <p className="text-muted-foreground text-sm mt-1">Long-term commitment (vesting recommended).</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 hover-scale animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <p className="text-sm text-muted-foreground">Development</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">22%</p>
              <p className="text-muted-foreground text-sm mt-1">AI features, product upgrades, scalability.</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 hover-scale animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <p className="text-sm text-muted-foreground">Marketing</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">15%</p>
              <p className="text-muted-foreground text-sm mt-1">Growth, partnerships, community.</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 hover-scale animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <p className="text-sm text-muted-foreground">Treasury / Liquidity</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">20%</p>
              <p className="text-muted-foreground text-sm mt-1">Healthy liquidity and runway.</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 hover-scale animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <p className="text-sm text-muted-foreground">Unlocked at TGE</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">3%</p>
              <p className="text-muted-foreground text-sm mt-1">Initial ops &amp; seed liquidity.</p>
            </div>
          </div>
        </div>

        {/* Utility & Features */}
        <div className="mx-auto mt-14 max-w-6xl">
          <h2 className="text-2xl font-bold text-foreground">Utility &amp; Ecosystem</h2>
          <ul className="mt-4 grid list-disc gap-3 pl-5 text-muted-foreground sm:grid-cols-2">
            <li>Token utility inside the <span className="font-semibold text-foreground">AI-powered B2BNEST</span> SaaS suite.</li>
            <li>Access, discounts, and incentives across business tools and modules.</li>
            <li>Community growth loops: referrals, ambassador rewards, engagement tiers.</li>
            <li>Treasury-backed liquidity for sustainable long-term growth.</li>
          </ul>
        </div>

        {/* Footer CTA */}
        <div className="mx-auto mt-12 flex max-w-md items-center justify-center gap-4">
          <a 
            href="PINKSALE_PRESALE_URL" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition hover-scale"
          >
            Join Presale Now
          </a>
          <a 
            href="/tokenomics" 
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 font-semibold text-foreground hover:bg-accent transition hover-scale"
          >
            View Tokenomics
          </a>
        </div>
      </div>
    </section>
  );
};

export default PinkSalePresaleSection;
