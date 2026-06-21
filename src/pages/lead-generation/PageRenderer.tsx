import { LandingPage, getForms } from "@/lib/leadGen";
import FormRenderer from "./FormRenderer";

export default function PageRenderer({ page, preview }: { page: LandingPage; preview?: boolean }) {
  return (
    <div className="bg-white">
      {page.blocks.map(b => {
        if (b.type === "hero") {
          return (
            <section key={b.id} className="py-20 px-6 text-center text-white" style={{ background: b.content.bgColor }}>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">{b.content.headline}</h1>
              <p className="text-lg opacity-90 max-w-2xl mx-auto">{b.content.subheadline}</p>
            </section>
          );
        }
        if (b.type === "text") {
          return <section key={b.id} className="py-10 px-6 max-w-3xl mx-auto"><p className="text-gray-700 whitespace-pre-line">{b.content.text}</p></section>;
        }
        if (b.type === "features") {
          return (
            <section key={b.id} className="py-12 px-6 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {b.content.items.map((it: any, i: number) => (
                  <div key={i} className="text-center p-4">
                    <div className="text-4xl mb-2">{it.icon}</div>
                    <h3 className="font-semibold text-[#0A1628] mb-1">{it.title}</h3>
                    <p className="text-sm text-gray-600">{it.description}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        }
        if (b.type === "form") {
          const form = getForms().find(f => f.id === b.content.formId);
          return (
            <section key={b.id} className="py-12 px-6 bg-[#f0f4f8]">
              <div className="max-w-md mx-auto">
                {form ? <FormRenderer form={form} preview={preview} pageId={page.id} /> : <p className="text-center text-gray-400">No form selected</p>}
              </div>
            </section>
          );
        }
        if (b.type === "social") {
          return (
            <section key={b.id} className="py-12 px-6 max-w-3xl mx-auto text-center">
              <p className="text-xl italic text-[#0A1628] mb-3">"{b.content.quote}"</p>
              <p className="text-sm text-gray-600">— {b.content.name}, {b.content.company}</p>
            </section>
          );
        }
        if (b.type === "cta") {
          return (
            <section key={b.id} className="py-12 px-6 text-center">
              <a href={b.content.link} className="inline-block px-8 py-3 rounded-lg text-white font-semibold" style={{ background: "#2563eb" }}>{b.content.label}</a>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
