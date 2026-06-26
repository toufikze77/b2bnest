import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSpace } from "@remotion/google-fonts/SpaceGrotesk";

const inter = loadInter("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
const space = loadSpace("normal", { weights: ["500", "700"], subsets: ["latin"] });

const COLORS = {
  bg: "#0A1628",
  bg2: "#0F1F38",
  primary: "#FF6B35",
  accent: "#FFD23F",
  ink: "#F5F1E8",
  mute: "#8FA3BF",
  green: "#4ADE80",
};

const DISPLAY = space.fontFamily;
const BODY = inter.fontFamily;

// ============ Persistent background ============
const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const hue = interpolate(t, [0, 1], [0, 18]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at ${20 + hue * 2}% ${30 + hue}%, ${COLORS.bg2} 0%, ${COLORS.bg} 60%)`,
      }}
    />
  );
};

const FloatingGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 1800], [0, -200]);
  return (
    <AbsoluteFill style={{ opacity: 0.07 }}>
      <svg width="100%" height="100%" style={{ transform: `translateY(${y}px)` }}>
        <defs>
          <pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke={COLORS.ink} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="200%" fill="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

// ============ Scene 1: HOOK (5s) ============
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s1 = spring({ frame: frame - 5, fps, config: { damping: 14 } });
  const s2 = spring({ frame: frame - 25, fps, config: { damping: 14 } });
  const s3 = spring({ frame: frame - 50, fps, config: { damping: 14 } });
  const pulse = 1 + Math.sin(frame / 8) * 0.02;

  return (
    <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{
        fontFamily: BODY, color: COLORS.primary, fontSize: 28, letterSpacing: 8,
        opacity: s1, transform: `translateX(${interpolate(s1, [0, 1], [-40, 0])}px)`,
        textTransform: "uppercase", marginBottom: 30, fontWeight: 600,
      }}>
        Running 12 apps for your business?
      </div>
      <div style={{
        fontFamily: DISPLAY, color: COLORS.ink, fontSize: 160, lineHeight: 0.95,
        fontWeight: 700, opacity: s2,
        transform: `translateY(${interpolate(s2, [0, 1], [60, 0])}px) scale(${pulse})`,
        transformOrigin: "left center",
      }}>
        Stop paying.<br />
        <span style={{ color: COLORS.primary }}>Start building.</span>
      </div>
      <div style={{
        marginTop: 50, fontFamily: BODY, color: COLORS.mute, fontSize: 32,
        opacity: s3, transform: `translateY(${interpolate(s3, [0, 1], [20, 0])}px)`,
      }}>
        One platform replaces all of them.
      </div>
    </AbsoluteFill>
  );
};

// ============ Scene 2: PROBLEM — cost stack (8s) ============
const CostBar: React.FC<{ label: string; cost: number; delay: number; max: number }> = ({ label, cost, delay, max }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 18 } });
  const w = interpolate(s, [0, 1], [0, (cost / max) * 700]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, opacity: s }}>
      <div style={{ width: 240, fontFamily: BODY, color: COLORS.ink, fontSize: 26, fontWeight: 600 }}>{label}</div>
      <div style={{ width: 700, height: 36, background: "#ffffff10", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: w, height: "100%", background: `linear-gradient(90deg, ${COLORS.primary}, #ff8c5a)` }} />
      </div>
      <div style={{ fontFamily: DISPLAY, color: COLORS.accent, fontSize: 28, fontWeight: 700, width: 100 }}>
        £{cost}
      </div>
    </div>
  );
};

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 18 } });
  const totalSpring = spring({ frame: frame - 130, fps, config: { damping: 14 } });
  const items = [
    { l: "QuickBooks", c: 25 },
    { l: "Salesforce", c: 75 },
    { l: "Asana", c: 30 },
    { l: "Mailchimp", c: 20 },
    { l: "Calendly + Zoom + …", c: 40 },
  ];
  const total = items.reduce((a, b) => a + b.c, 0);
  return (
    <AbsoluteFill style={{ padding: "100px 140px", flexDirection: "column", gap: 24 }}>
      <div style={{
        fontFamily: DISPLAY, fontSize: 72, color: COLORS.ink, fontWeight: 700,
        opacity: head, transform: `translateY(${interpolate(head, [0, 1], [30, 0])}px)`,
      }}>
        Your monthly SaaS bill
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 30 }}>
        {items.map((it, i) => (
          <CostBar key={it.l} label={it.l} cost={it.c} delay={20 + i * 15} max={total} />
        ))}
      </div>
      <div style={{
        marginTop: 40, display: "flex", alignItems: "baseline", gap: 24,
        opacity: totalSpring, transform: `translateX(${interpolate(totalSpring, [0, 1], [-30, 0])}px)`,
      }}>
        <div style={{ fontFamily: BODY, fontSize: 28, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 3 }}>
          Total
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 120, color: COLORS.primary, fontWeight: 700, lineHeight: 1 }}>
          £{total}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 32, color: COLORS.mute }}>/ month</div>
      </div>
    </AbsoluteFill>
  );
};

// ============ Scene 3: SOLUTION — B2BNest unified (10s) ============
const ToolChip: React.FC<{ label: string; delay: number; x: number; y: number }> = ({ label, delay, x, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 12 } });
  const float = Math.sin((frame + delay) / 20) * 6;
  return (
    <div style={{
      position: "absolute", left: x, top: y + float,
      padding: "14px 24px", borderRadius: 12,
      background: "#ffffff0d", border: `1px solid ${COLORS.primary}40`,
      fontFamily: BODY, color: COLORS.ink, fontSize: 22, fontWeight: 600,
      opacity: s, transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
      backdropFilter: undefined,
    }}>
      {label}
    </div>
  );
};

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 16 } });
  const logoS = spring({ frame: frame - 30, fps, config: { damping: 10 } });
  const ring = interpolate(frame, [40, 200], [0, 360]);
  const tools = [
    { l: "CRM", x: 200, y: 200 }, { l: "Invoicing", x: 1500, y: 180 },
    { l: "Projects", x: 150, y: 420 }, { l: "Payroll", x: 1560, y: 420 },
    { l: "Contracts", x: 220, y: 660 }, { l: "Lead Gen", x: 1500, y: 660 },
    { l: "Rota", x: 350, y: 860 }, { l: "AI Advisor", x: 1380, y: 860 },
  ];
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", top: 80, left: 0, right: 0, textAlign: "center",
        fontFamily: DISPLAY, fontSize: 64, color: COLORS.ink, fontWeight: 700,
        opacity: head, transform: `translateY(${interpolate(head, [0, 1], [-30, 0])}px)`,
      }}>
        Meet <span style={{ color: COLORS.primary }}>B2BNest</span>
      </div>

      {/* Center hub */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{
          width: 280, height: 280, borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.primary}, #c44a1f)`,
          display: "flex", justifyContent: "center", alignItems: "center",
          fontFamily: DISPLAY, color: COLORS.ink, fontSize: 48, fontWeight: 700,
          boxShadow: `0 0 80px ${COLORS.primary}80`,
          transform: `scale(${logoS})`,
        }}>
          B2BNest
        </div>
        <div style={{
          position: "absolute", width: 520, height: 520, borderRadius: "50%",
          border: `2px dashed ${COLORS.accent}60`, transform: `rotate(${ring}deg)`,
        }} />
        <div style={{
          position: "absolute", width: 720, height: 720, borderRadius: "50%",
          border: `1px solid ${COLORS.mute}30`, transform: `rotate(${-ring * 0.5}deg)`,
        }} />
      </AbsoluteFill>

      {tools.map((t, i) => (
        <ToolChip key={t.l} label={t.l} delay={60 + i * 10} x={t.x} y={t.y} />
      ))}
    </AbsoluteFill>
  );
};

// ============ Scene 4: SAVINGS (8s) ============
const Counter: React.FC<{ from: number; to: number; prefix?: string; suffix?: string; delay: number }> = ({ from, to, prefix = "", suffix = "", delay }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame - delay, [0, 40], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <>{prefix}{Math.round(v)}{suffix}</>;
};

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 16 } });
  const stripe = spring({ frame: frame - 70, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{
        fontFamily: BODY, color: COLORS.mute, fontSize: 28, letterSpacing: 6,
        textTransform: "uppercase", opacity: head, marginBottom: 30,
      }}>
        Switch to B2BNest
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 280, color: COLORS.green, fontWeight: 700, lineHeight: 1,
        opacity: head, transform: `scale(${interpolate(head, [0, 1], [0.7, 1])})`,
      }}>
        <Counter from={0} to={2280} prefix="£" delay={20} />
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 56, color: COLORS.ink, marginTop: 10,
        opacity: spring({ frame: frame - 50, fps, config: { damping: 18 } }),
      }}>
        saved per year
      </div>
      <div style={{
        marginTop: 60, padding: "20px 40px", background: `${COLORS.primary}20`,
        border: `1px solid ${COLORS.primary}`, borderRadius: 8,
        fontFamily: BODY, fontSize: 30, color: COLORS.ink,
        opacity: stripe, transform: `translateY(${interpolate(stripe, [0, 1], [20, 0])}px)`,
      }}>
        From <s style={{ color: COLORS.mute }}>£190/mo</s> &nbsp; to &nbsp;
        <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 40 }}>£56/mo</span>
      </div>
    </AbsoluteFill>
  );
};

// ============ Scene 5: CTA (5s) ============
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 12 } });
  const cta = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const url = spring({ frame: frame - 55, fps, config: { damping: 16 } });
  const glow = 0.5 + Math.sin(frame / 10) * 0.3;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 40 }}>
      <div style={{
        fontFamily: DISPLAY, fontSize: 200, fontWeight: 700, color: COLORS.ink,
        opacity: logo, transform: `scale(${logo})`,
        textShadow: `0 0 ${40 * glow}px ${COLORS.primary}`,
      }}>
        B2B<span style={{ color: COLORS.primary }}>Nest</span>
      </div>
      <div style={{
        fontFamily: BODY, fontSize: 42, color: COLORS.mute,
        opacity: cta, transform: `translateY(${interpolate(cta, [0, 1], [20, 0])}px)`,
      }}>
        Your entire business. One subscription.
      </div>
      <div style={{
        marginTop: 30, padding: "28px 60px", borderRadius: 12,
        background: COLORS.primary, fontFamily: DISPLAY, fontSize: 44, fontWeight: 700,
        color: COLORS.bg, opacity: url, transform: `scale(${url})`,
        boxShadow: `0 20px 60px ${COLORS.primary}60`,
      }}>
        b2bnest.online
      </div>
      <div style={{
        fontFamily: BODY, fontSize: 24, color: COLORS.mute, opacity: url, marginTop: 10,
      }}>
        Start free · No credit card required
      </div>
    </AbsoluteFill>
  );
};

// ============ Main ============
export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Bg />
      <FloatingGrid />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={170}>
          <Scene1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })} />
        <TransitionSeries.Sequence durationInFrames={290}>
          <Scene2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })} />
        <TransitionSeries.Sequence durationInFrames={350}>
          <Scene3 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })} />
        <TransitionSeries.Sequence durationInFrames={280}>
          <Scene4 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })} />
        <TransitionSeries.Sequence durationInFrames={250}>
          <Scene5 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
